import { httpServer } from './http_server';
import { WebSocketServer } from 'ws';
import { INCOMING_TYPES } from './constants';
import { db } from './db';
import { getAttackStatus } from './utils';

const HTTP_PORT = 8181;

const wss = new WebSocketServer({ port: 3000 }, () => {
  console.log('WebSocket Server started on port 3000');
});

wss.on('connection', (ws, req) => {
  ws.on('error', console.error);

  ws.send(JSON.stringify(httpServer.address()));
  ws.send(JSON.stringify({ origin: req.headers.origin }));
  ws.send(JSON.stringify({ userAgent: req.headers['user-agent'] }));

  ws.on('message', (message) => {
    console.log('received: %s', message);

    const { users, rooms, ships, winners } = db;

    const jsonMessage = JSON.parse(message.toString());
    const { type, data: incomingData, id } = jsonMessage;
    switch (type) {
      case INCOMING_TYPES.reg: {
        const { name } = JSON.parse(incomingData);
        const index = Object.keys(db).length;
        db.users[index] = JSON.parse(incomingData);
        const userData = JSON.stringify({ name, index, error: false, errorMessage: '' });
        ws.send(JSON.stringify({ type: INCOMING_TYPES.reg, data: userData, id }));
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
});

console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);
