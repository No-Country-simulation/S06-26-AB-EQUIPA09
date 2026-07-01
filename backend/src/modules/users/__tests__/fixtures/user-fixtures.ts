// import type { CreateUserDTO } from '../../application/dtos/user.dto';

export const validUserData = {
  email: 'valid@example.com',
  name: 'Valid User',
  password: 'ValidPass123',
};

export const invalidUserData = {
  noEmail: {
    name: 'No Email',
    password: 'ValidPass123',
  },
  shortPassword: {
    email: 'short@example.com',
    name: 'Short Password',
    password: '12345',
  },
  invalidEmail: {
    email: 'not-an-email',
    name: 'Invalid Email',
    password: 'ValidPass123',
  },
  shortName: {
    email: 'short@example.com',
    name: 'A',
    password: 'ValidPass123',
  },
};