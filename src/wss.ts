import { WebSocketServer } from 'ws';
import { COMMAND_TYPES, PING_INTERVAL } from './constants';
import { db } from './db';
import { getAttackStatus, hasUser, validateUser } from './utils';
import { ExtendedWebSocket } from './types';
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
          roomUsers: [{ name: roomUser![1].name, index: Number(roomUser![0]) }],
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
          index: Number(newRoomUser![0]),
        });

        wss.clients.forEach((client) => {
          const updateData = JSON.stringify(rooms);
          client.send(JSON.stringify({ type: COMMAND_TYPES.updateRoom, data: updateData, id }));
        });

        const newGame = { idGame: games.length, idPlayer: 0 };
        games.push(newGame);

        wss.clients.forEach((client) => {
          targetRoom?.roomUsers.forEach((user, i) => {
            const targetUser = usersEntries.find((el) => Number(el[0]) === user.index);
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
        const { ships, indexPlayer } = JSON.parse(incomingData);
        db.ships = ships;
        const gameData = JSON.stringify({ ships: db.ships, currentPlayerIndex: indexPlayer });
        ws.send(JSON.stringify({ type: COMMAND_TYPES.startGame, data: gameData, id }));
        break;
      }
      case COMMAND_TYPES.attack: {
        const { gameId, x, y, indexPlayer } = JSON.parse(incomingData);
        const attackStatus = getAttackStatus(x, y);
        const attackData = JSON.stringify({ position: { x, y }, currentPlayer: indexPlayer, status: attackStatus });
        ws.send(JSON.stringify({ type: COMMAND_TYPES.attack, data: attackData, id }));
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
