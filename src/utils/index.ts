import { db } from '../db';
import { User } from '../types';

const cells = 10;

export const getAttackStatus = (column: number, raw: number) => {
  const ships = db.ships;

  const empty = 0;
  const filled = 1;
  const matrix = new Array(cells * cells).fill(empty);
  console.log(ships);

  ships.forEach((el) => {
    const { x, y } = el.position;

    for (let i = 0; i < el.length; i += 1) {
      el.direction === true ? (matrix[(y + i) * cells + x] = filled) : (matrix[y * cells + x + i] = filled);
    }
  });
  console.log(matrix);
  if (matrix[raw * cells + column] === filled) {
    const leftFilled = matrix[raw * cells + column - 1] && matrix[raw * cells + column - 1] === filled;
    const rightFilled = matrix[raw * cells + column + 1] && matrix[raw * cells + column + 1] === filled;
    const upperFilled = matrix[(raw - 1) * cells] && matrix[(raw - 1) * cells + column] === filled;
    const bottomFilled = matrix[(raw + 1) * cells] && matrix[(raw - 1) * cells + column] === filled;
    return leftFilled || rightFilled || upperFilled || bottomFilled ? 'shot' : 'killed';
  } else {
    return 'miss';
  }
};

export const validateUser = (name: string, password: string) => {
  return name.length >= 5 && password.length >= 5;
};

export const hasUser = (name: string, password: string) => {
  return Object.values(db.users).some((user: User) => user.name === name && user.password === password);
};

export const getRandomCell = () => {
  const randomX = Math.floor(Math.random() * 10);
  const randomY = Math.floor(Math.random() * 10);

  return { x: randomX, y: randomY };
};
