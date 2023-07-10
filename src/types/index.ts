import { WebSocket } from 'ws';

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

export type Winner = {
  name: string;
  wins: number;
};

export type DB = {
  users: Users;
  rooms: Room[];
  ships: Ship[];
  winners: Winner[];
};
