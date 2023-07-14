import { db } from '../db';
import { Ship, User } from '../types';

const cells = 10;
const empty = 0;
const single = 1;
const double = 2;
const triple = 3;
const quadruple = 4;
const shot = 5;
const killed = 6;
const miss = -1;

const hiddenValues = [single, double, triple, quadruple];

export const getMatrix = (ships: Ship[]) => {
  const matrix = new Array(cells * cells).fill(empty);

  ships.forEach((el) => {
    const { x, y } = el.position;

    switch (el.length) {
      case 1: {
        matrix[y * cells + x] = single;
        break;
      }
      case 2: {
        el.direction ? (matrix[(y + 1) * cells + x] = double) : (matrix[y * cells + x + 1] = double);
        matrix[y * cells + x] = single;
        break;
      }
      case 3: {
        for (let i = 0; i < 3; i += 1) {
          el.direction ? (matrix[(y + i) * cells + x] = triple) : (matrix[y * cells + x + i] = triple);
        }
        break;
      }
      case 4: {
        for (let i = 0; i < 4; i += 1) {
          el.direction ? (matrix[(y + i) * cells + x] = quadruple) : (matrix[y * cells + x + i] = quadruple);
        }
        break;
      }
    }
  });

  return matrix;
};

export const getAttackStatus = (matrix: number[], column: number, raw: number) => {
  let result = '';
  let cell = matrix[raw * cells + column];

  if (hiddenValues.includes(cell)) {
    const leftFilled = matrix[raw * cells + column - 1] && hiddenValues.includes(matrix[raw * cells + column - 1]);
    const rightFilled = matrix[raw * cells + column + 1] && hiddenValues.includes(matrix[raw * cells + column + 1]);
    const upperFilled = matrix[(raw - 1) * cells] && hiddenValues.includes(matrix[(raw - 1) * cells + column]);
    const bottomFilled = matrix[(raw + 1) * cells] && hiddenValues.includes(matrix[(raw + 1) * cells + column]);

    if (leftFilled || rightFilled || upperFilled || bottomFilled) {
      result = 'shot';
      cell = shot;
    } else {
      result = 'killed';
      cell = killed;
    }
  } else if (matrix[raw * cells + column] === empty) {
    result = 'miss';
    cell = miss;
  }

  return result;
};

export const getCellNeighbors = (matrix: number[], index: number) => {
  const neighbors: number[] = [];

  const leftCell = matrix[index - 1];
  const leftUpperCell = matrix[index - cells - 1];
  const upperCell = matrix[index - cells];
  const rightUpperCell = matrix[index - cells + 1];
  const rightCell = matrix[index + 1];
  const rightBottomCell = matrix[index + cells + 1];
  const bottomCell = matrix[index + cells];
  const leftBottomCell = matrix[index + cells - 1];

  [leftCell, leftUpperCell, upperCell, rightUpperCell, rightCell, rightBottomCell, bottomCell, leftBottomCell].forEach(
    (el, i) => {
      if (el) {
        neighbors.push(i);
      }
    }
  );

  return neighbors;
};

export const getShipNeighborCells = (matrix: number[], column: number, raw: number) => {
  const cell = matrix[raw * cells + column];
  const index = matrix.indexOf(cell);

  const shipNeighborCells: number[] = [];

  const possiblePosition = [
    index - triple * cells,
    index - double * cells,
    index - single * cells,
    index - triple,
    index - double,
    index - single,
    index,
    index + single,
    index + double,
    index + triple,
    index + triple * cells,
    index + double * cells,
    index + single * cells,
  ];

  possiblePosition.forEach((el) => {
    const neighbors = getCellNeighbors(matrix, el);
    neighbors.forEach((item) => {
      shipNeighborCells.push(item);
    });
  });

  const result = Array.from(new Set(shipNeighborCells));

  return result.map((el) => ({ x: el % 10, y: Math.floor(el) / 10 }));
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
