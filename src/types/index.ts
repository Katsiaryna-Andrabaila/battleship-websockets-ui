import { WebSocket } from 'ws';

export interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
}

export type User = {
  socket: WebSocket;
  name: string;
  password: string;
};

export type Users = {
  [key: string]: User;
};

export type RoomUser = {
  name: string;
  index: number;
};

export type Room = {
  roomId: number;
  roomUsers: RoomUser[];
};

export type Ship = {
  position: {
    x: number;
    y: number;
  };
  direction: boolean;
  length: number;
  type: 'small' | 'medium' | 'large' | 'huge';
};

export type GameShip = Ship & {
  cells: number[];
};

export type Winner = {
  name: string;
  wins: number;
};

export type Game = {
  idGame: number;
  users: RoomUser[] | undefined;
  0: { ships: Ship[]; matrix: number[]; position: Array<Array<number>> };
  1: { ships: Ship[]; matrix: number[]; position: Array<Array<number>> };
  turn: number;
};

export type DB = {
  users: Users;
  rooms: Room[];
  games: Game[];
  winners: Winner[];
};

export type AddShips = {
  gameId: number;
  ships: Ship[];
  indexPlayer: 0 | 1;
};
