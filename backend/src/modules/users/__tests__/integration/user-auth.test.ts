// import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
// import { setupTestDatabase, cleanupTestDatabase, resetTestDatabase } from '../setup/test-db';
// import { createTestServices, createTestUser } from '../setup/test-helpers';
// import "dotenv/config"

// describe('User Authentication Flow', () => {
//   beforeAll(async () => {
//     await setupTestDatabase();
//   });

//   afterAll(async () => {
//     await cleanupTestDatabase();
//   });

//   beforeEach(async () => {
//     await resetTestDatabase();
//   });

//   describe('POST /auth/register', () => {
//     it('should register a new user successfully', async () => {
//       const { userController } = createTestServices();
//       const userData = await createTestUser();

//       const result = await userController.register({ body: userData });

//       expect(result.success).toBe(true);
//       if (result.success) {
//         expect(result.value).toMatchObject({
//           email: userData.email,
//           name: userData.name,
//         });
//         expect(result.value.id).toBeDefined();
//         expect(result.value.createdAt).toBeInstanceOf(Date);
//         expect(result.value).not.toHaveProperty('password');
//         expect(result.value).not.toHaveProperty('passwordHash');
//       }
//     });

//     it('should fail when email already exists', async () => {
//       const { userController } = createTestServices();
//       const userData = await createTestUser();

//       // First registration
//       await userController.register({ body: userData });

//       // Second registration with same email
//       const result = await userController.register({ body: userData });

//       expect(result.success).toBe(false);
//       if (!result.success) {
//         expect(result.error.type).toBe('CONFLICT');
//         expect(result.error.message).toContain('Email already registered');
//       }
//     });

//     it('should hash password before storing', async () => {
//       const { userController, userRepository } = createTestServices();
//       const userData = await createTestUser();

//       const registerResult = await userController.register({ body: userData });
//       expect(registerResult.success).toBe(true);

//       if (registerResult.success) {
//         // Fetch user directly from repository to check passwordHash
//         const user = await userRepository.findByEmail(userData.email);
//         expect(user).toBeDefined();
//         expect(user?.passwordHash).toBeDefined();
//         expect(user?.passwordHash).not.toBe(userData.password);
//         expect(user?.passwordHash).toContain('$argon2'); // Argon2 hash format
//       }
//     });
//   });

//   describe('POST /auth/login', () => {
//     it('should login with valid credentials', async () => {
//       const { userController } = createTestServices();
//       const userData = await createTestUser();

//       // Register user first
//       await userController.register({ body: userData });

//       // Login
//       const result = await userController.login({
//         body: { email: userData.email, password: userData.password },
//         userAgent: 'test-agent',
//         ipAddress: '127.0.0.1',
//       });

//       expect(result.success).toBe(true);
//       if (result.success) {
//         expect(result.value.user.email).toBe(userData.email);
//         expect(result.value.accessToken).toBeDefined();
//         expect(result.value.refreshToken).toBeDefined();
//         expect(typeof result.value.accessToken).toBe('string');
//         expect(typeof result.value.refreshToken).toBe('string');
//       }
//     });

//     it('should fail login with wrong password', async () => {
//       const { userController } = createTestServices();
//       const userData = await createTestUser();

//       await userController.register({ body: userData });

//       const result = await userController.login({
//         body: { email: userData.email, password: 'WrongPassword123' },
//       });

//       expect(result.success).toBe(false);
//       if (!result.success) {
//         expect(result.error.type).toBe('UNAUTHORIZED');
//         expect(result.error.message).toContain('Invalid credentials');
//       }
//     });

//     it('should fail login with non-existent email', async () => {
//       const { userController } = createTestServices();

//       const result = await userController.login({
//         body: { email: 'nonexistent@example.com', password: 'SomePassword123' },
//       });

//       expect(result.success).toBe(false);
//       if (!result.success) {
//         expect(result.error.type).toBe('UNAUTHORIZED');
//         expect(result.error.message).toContain('Invalid credentials');
//       }
//     });

//     it('should create session on successful login', async () => {
//       const { userController } = createTestServices();
//       const userData = await createTestUser();

//       const registerResult = await userController.register({ body: userData });
//       expect(registerResult.success).toBe(true);

//       if (registerResult.success) {
//         const loginResult = await userController.login({
//           body: { email: userData.email, password: userData.password },
//           userAgent: 'test-agent',
//           ipAddress: '127.0.0.1',
//         });

//         expect(loginResult.success).toBe(true);

//         if (loginResult.success) {
//           expect(loginResult.value.accessToken).toBeTruthy();
//           expect(loginResult.value.refreshToken).toBeTruthy();
//         }
//       }
//     });
//   });
// });