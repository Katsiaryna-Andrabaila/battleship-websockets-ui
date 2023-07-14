import { WebSocketServer } from 'ws';
import { COMMAND_TYPES, PING_INTERVAL } from './constants';
import { db } from './db';
import { getAttackStatus, getMatrix, getShipNeighborCells, hasUser, validateUser } from './utils';
import { AddShips, ExtendedWebSocket } from './types';
import { httpServer } from './http_server';

const wss = new WebSocketServer({ port: 3000 }, () => {
  console.log('WebSocket Server started on port 3000');
});

wss.on('connection', (ws: ExtendedWebSocket, req) => {
  ws.isAlive = true;
  ws.on('error', console.error);

  ws.send(JSON.stringify(httpServer.address()));
  ws.send(JSON.stringify({ origin: req.headers.origin }));
  ws.send(JSON.stringify({ userAgent: req.headers['user-agent'] }));

  ws.on('message', (message) => {
    console.log('received: %s', message);

    const { users, rooms, games, winners } = db;

    const jsonMessage = JSON.parse(message.toString());
    const { type, data: incomingData, id } = jsonMessage;

    const usersEntries = Object.entries(users);

    switch (type) {
      case COMMAND_TYPES.reg: {
        const userParsedData = JSON.parse(incomingData);
        const { name, password } = userParsedData;
        userParsedData.socket = ws;

        const isValid = validateUser(name, password);

        const hasDbUser = hasUser(name, password);

        if (isValid && !hasDbUser) {
          users[Object.keys(users).length] = userParsedData;
        }

        const userData = JSON.stringify({
          name,
          index: isValid && !hasDbUser ? Object.keys(users).length : 0,
          error: !isValid || hasDbUser,
          errorMessage: !isValid ? 'invalid password or name' : hasDbUser ? 'user already exists' : '',
        });
        ws.send(JSON.stringify({ type: COMMAND_TYPES.reg, data: userData, id }));

        rooms.length &&
          wss.clients.forEach((client) => {
            const availableRooms = rooms.filter((room) => room.roomUsers.length < 2);
            const updateData = JSON.stringify(availableRooms);
            client.send(JSON.stringify({ type: COMMAND_TYPES.updateRoom, data: updateData, id }));
          });

        winners.length &&
          wss.clients.forEach((client) => {
            const updateData = JSON.stringify(winners);
            client.send(JSON.stringify({ type: COMMAND_TYPES.updateWinners, data: updateData, id }));
          });

        break;
      }
      case COMMAND_TYPES.createRoom: {
        const roomUser = usersEntries.find((user) => user[1].socket === ws);

        rooms.push({
          roomId: rooms.length,
          roomUsers: [{ name: roomUser![1].name, index: +roomUser![0] }],
        });

        const availableRooms = rooms.filter((room) => room.roomUsers.length < 2);
        const updateRoomsData = JSON.stringify(availableRooms);
        wss.clients.forEach((client) => {
          client.send(JSON.stringify({ type: COMMAND_TYPES.updateRoom, data: updateRoomsData, id }));
        });

        break;
      }
      case COMMAND_TYPES.addUser: {
        const { indexRoom } = JSON.parse(incomingData);
        const newRoomUser = usersEntries.find((user) => user[1].socket === ws);

        const targetRoom = rooms.find((room) => room.roomId === indexRoom);

        targetRoom?.roomUsers.push({
          name: newRoomUser![1].name,
          index: +newRoomUser![0],
        });

        wss.clients.forEach((client) => {
          const updateData = JSON.stringify(rooms);
          client.send(JSON.stringify({ type: COMMAND_TYPES.updateRoom, data: updateData, id }));
        });

        const newGame = {
          idGame: games.length,
          users: targetRoom?.roomUsers,
          0: { ships: [], matrix: [] },
          1: { ships: [], matrix: [] },
          turn: 0,
        };
        games.push(newGame);

        wss.clients.forEach((client) => {
          targetRoom?.roomUsers.forEach((user, i) => {
            const targetUser = usersEntries.find((el) => +el[0] === user.index);
            if (targetUser![1].socket === client) {
              client.send(
                JSON.stringify({
                  type: COMMAND_TYPES.createGame,
                  data: JSON.stringify({ idGame: games.length, idPlayer: i }),
                  id,
                })
              );
            }
          });
        });

        break;
      }
      case COMMAND_TYPES.addShips: {
        const { gameId, ships, indexPlayer }: AddShips = JSON.parse(incomingData);
        const targetGame = db.games.find((el) => el.idGame === gameId);
        targetGame![indexPlayer].ships = ships;

        const gameData = JSON.stringify({ ships, currentPlayerIndex: indexPlayer });

        const matrix0 = getMatrix(targetGame![0].ships);
        const matrix1 = getMatrix(targetGame![1].ships);
        targetGame![0].matrix = matrix0;
        targetGame![1].matrix = matrix1;

        //if (targetGame?.[0].length && targetGame?.[1].length) {
        ws.send(JSON.stringify({ type: COMMAND_TYPES.startGame, data: gameData, id }));
        ws.send(
          JSON.stringify({
            type: COMMAND_TYPES.turn,
            data: JSON.stringify({ currentPlayer: targetGame?.turn }),
            id: 0,
          })
        );
        //}

        break;
      }
      case COMMAND_TYPES.attack: {
        const { gameId, x, y, indexPlayer } = JSON.parse(incomingData);
        const targetGame = db.games.find((el) => el.idGame === gameId);

        const attackStatus = getAttackStatus(indexPlayer === 0 ? targetGame![1].matrix : targetGame![0].matrix, x, y);
        const attackData = JSON.stringify({ position: { x, y }, currentPlayer: indexPlayer, status: attackStatus });

        wss.clients.forEach((client) => {
          targetGame?.users?.forEach((user, i) => {
            const targetUser = usersEntries.find((el) => +el[0] === user.index);
            if (targetUser![1].socket === client) {
              client.send(JSON.stringify({ type: COMMAND_TYPES.attack, data: attackData, id }));

              const nextTurn = attackStatus === 'miss' ? targetGame.turn : targetGame.turn === 0 ? 1 : 0;

              client.send(
                JSON.stringify({
                  type: COMMAND_TYPES.turn,
                  data: JSON.stringify({ currentPlayer: nextTurn }),
                  id: 0,
                })
              );

              if (attackStatus === 'killed') {
                const neighborCells = getShipNeighborCells(targetGame![indexPlayer === 0 ? 1 : 0].matrix, x, y);
                neighborCells.forEach((el) => {
                  const attackNeighborData = JSON.stringify({
                    position: { x: el.x, y: el.y },
                    currentPlayer: indexPlayer,
                    status: attackStatus,
                  });
                  client.send(
                    JSON.stringify({
                      type: COMMAND_TYPES.attack,
                      data: attackNeighborData,
                      id: 0,
                    })
                  );
                });
              }
            }
          });
        });

        break;
      }
    }
  });

  ws.on('pong', () => {
    (this as unknown as ExtendedWebSocket).isAlive = true;
  });
});

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if ((ws as unknown as ExtendedWebSocket).isAlive === false) {
      return ws.terminate();
    }

    (ws as unknown as ExtendedWebSocket).isAlive = false;
    ws.ping();
  });
}, PING_INTERVAL);

wss.on('close', () => clearInterval(interval));
