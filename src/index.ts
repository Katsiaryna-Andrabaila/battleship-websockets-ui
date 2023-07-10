import { httpServer } from './http_server';
import { WebSocketServer } from 'ws';
import { INCOMING_TYPES, PING_INTERVAL } from './constants';
import { db } from './db';
import { getAttackStatus, hasUser, validateUser } from './utils';
import { ExtendedWebSocket } from './types';

const HTTP_PORT = 8181;

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

    const { users, rooms, winners } = db;

    const jsonMessage = JSON.parse(message.toString());
    const { type, data: incomingData, id } = jsonMessage;
    switch (type) {
      case INCOMING_TYPES.reg: {
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
        ws.send(JSON.stringify({ type: INCOMING_TYPES.reg, data: userData, id }));

        rooms.length &&
          wss.clients.forEach((client) => {
            const updateData = JSON.stringify(rooms);
            client.send(JSON.stringify({ type: INCOMING_TYPES.updateRoom, data: updateData, id }));
          });

        winners.length &&
          wss.clients.forEach((client) => {
            const updateData = JSON.stringify(winners);
            client.send(JSON.stringify({ type: INCOMING_TYPES.updateWinners, data: updateData, id }));
          });

        break;
      }
      case INCOMING_TYPES.createRoom: {
        const roomUser = { name: '', index: 0 };
        rooms.push({ roomId: rooms.length, roomUsers: [roomUser] });
        const updateData = JSON.stringify(rooms);
        ws.send(JSON.stringify({ type: INCOMING_TYPES.updateRoom, data: updateData, id }));
        break;
      }
      case INCOMING_TYPES.addUser: {
        //const {indexRoom} = JSON.parse(incomingData);
        const roomData = JSON.stringify({ idGame: 0, idPlayer: 0 });
        ws.send(JSON.stringify({ type: INCOMING_TYPES.createGame, data: roomData, id }));
        break;
      }
      case INCOMING_TYPES.addShips: {
        const { ships, indexPlayer } = JSON.parse(incomingData);
        db.ships = ships;
        const gameData = JSON.stringify({ ships: db.ships, currentPlayerIndex: indexPlayer });
        ws.send(JSON.stringify({ type: INCOMING_TYPES.startGame, data: gameData, id }));
        break;
      }
      case INCOMING_TYPES.attack: {
        const { gameId, x, y, indexPlayer } = JSON.parse(incomingData);
        const attackStatus = getAttackStatus(x, y);
        const attackData = JSON.stringify({ position: { x, y }, currentPlayer: indexPlayer, status: attackStatus });
        ws.send(JSON.stringify({ type: INCOMING_TYPES.attack, data: attackData, id }));
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

console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);
