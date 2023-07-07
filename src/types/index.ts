export type User = {
  login: string;
  password: string;
};

export type Users = {
  [key: string]: User;
};
