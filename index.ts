import { httpServer } from './src/http_server';
import { WebSocketServer } from 'ws';
import { INCOMING_TYPES } from './src/constants';
import { db } from './src/db';

const HTTP_PORT = 8181;

const wss = new WebSocketServer({ port: 3000 });

wss.on('connection', (ws, req) => {
  ws.on('error', console.error);

  ws.send(JSON.stringify(httpServer.address()));
  ws.send(JSON.stringify({ origin: req.headers.origin }));
  ws.send(JSON.stringify({ userAgent: req.headers['user-agent'] }));

  ws.on('message', (message) => {
    console.log('received: %s', message);

    const { users, rooms, ships, winners } = db;

    const jsonMessage = JSON.parse(message.toString());
    const { data: incomingData, id } = jsonMessage;
    switch (jsonMessage.type) {
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
      }
    }
  });
});

console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);
