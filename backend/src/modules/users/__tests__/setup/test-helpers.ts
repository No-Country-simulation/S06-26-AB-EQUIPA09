// import { getTestDatabase } from './test-db';
// import { createUserRepository } from '../../infrastructure/persistence/user.repository';
// import { createSessionRepository } from '../../infrastructure/persistence/session.repository';
// import { createSessionService } from '../../application/services/session.service';
// import { createUserService } from '../../application/services/user.service';
// import type { CreateUserDTO } from '../../application/dtos/user.dto';
// import "dotenv/config"
// // import { createUserController } from '../../infrastructure/http/controllers/user.controller';


// export const createTestServices = () => {
//   const db = getTestDatabase();
//   const userRepository = createUserRepository(db);
//   const sessionRepository = createSessionRepository(db);
//   const sessionService = createSessionService(sessionRepository);
//   const userService = createUserService(userRepository, sessionService);
//   const userController = createUserController(userService);

//   return {
//     db,
//     userRepository,
//     sessionRepository,
//     sessionService,
//     userService,
//     userController,
//   };
// };

// export const createTestUser = async (
//   overrides?: Partial<CreateUserDTO>
// ): Promise<{ email: string; password: string; name: string }> => {
//   const timestamp = Date.now();
  
//   return {
//     email: overrides?.email || `test${timestamp}@example.com`,
//     password: overrides?.password || 'Test@123456',
//     name: overrides?.name || `Test User ${timestamp}`,
//   };
// };

// export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));