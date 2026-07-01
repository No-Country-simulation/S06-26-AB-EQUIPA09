// import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
// import { setupTestDatabase, cleanupTestDatabase, resetTestDatabase } from '../setup/test-db';
// import { createTestServices, createTestUser } from '../setup/test-helpers';
// import "dotenv/config"


// describe('User CRUD Operations', () => {
//   beforeAll(async () => {
//     await setupTestDatabase();
//   });

//   afterAll(async () => {
//     await cleanupTestDatabase();
//   });

//   beforeEach(async () => {
//     await resetTestDatabase();
//   });

//   describe('GET /protected/me', () => {
//     it('should return current user data', async () => {
//       const { userController } = createTestServices();
//       const userData = await createTestUser();

//       const registerResult = await userController.register({ body: userData });
//       expect(registerResult.success).toBe(true);

//       if (registerResult.success) {
//         const result = await userController.me({ userId: registerResult.value.id });

//         expect(result.success).toBe(true);
//         if (result.success) {
//           expect(result.value.id).toBe(registerResult.value.id);
//           expect(result.value.email).toBe(userData.email);
//           expect(result.value.name).toBe(userData.name);
//         }
//       }
//     });

//     it('should fail for non-existent user', async () => {
//       const { userController } = createTestServices();
//       const fakeUserId = '00000000-0000-0000-0000-000000000000';

//       const result = await userController.me({ userId: fakeUserId });

//       expect(result.success).toBe(false);
//       if (!result.success) {
//         expect(result.error.type).toBe('NOT_FOUND');
//       }
//     });
//   });

//   describe('GET /protected/', () => {
//     it('should list users with pagination', async () => {
//       const { userController } = createTestServices();

//       // Create 3 users
//       const users = await Promise.all([
//         createTestUser(),
//         createTestUser(),
//         createTestUser(),
//       ]);

//       for (const userData of users) {
//         await userController.register({ body: userData });
//       }

//       const result = await userController.list({ query: { page: 1, perPage: 10 } });

//       expect(result.success).toBe(true);
//       if (result.success) {
//         expect(result.value.data.length).toBe(3);
//         expect(result.value.pagination).toMatchObject({
//           currentPage: 1,
//           perPage: 10,
//           totalItems: 3,
//           totalPages: 1,
//         });
//       }
//     });

//     it('should respect pagination limits', async () => {
//       const { userController } = createTestServices();

//       // Create 5 users
//       const users = await Promise.all(
//         Array.from({ length: 5 }, () => createTestUser())
//       );

//       for (const userData of users) {
//         await userController.register({ body: userData });
//       }

//       const result = await userController.list({ query: { page: 1, perPage: 2 } });

//       expect(result.success).toBe(true);
//       if (result.success) {
//         expect(result.value.data.length).toBe(2);
//         expect(result.value.pagination.totalItems).toBe(5);
//         expect(result.value.pagination.totalPages).toBe(3);
//       }
//     });
//   });

//   describe('PATCH /protected/me', () => {
//     it('should update user name', async () => {
//       const { userController } = createTestServices();
//       const userData = await createTestUser();

//       const registerResult = await userController.register({ body: userData });
//       expect(registerResult.success).toBe(true);

//       if (registerResult.success) {
//         const updateResult = await userController.update({
//           userId: registerResult.value.id,
//           body: { name: 'Updated Name' },
//         });

//         expect(updateResult.success).toBe(true);
//         if (updateResult.success) {
//           expect(updateResult.value.name).toBe('Updated Name');
//           expect(updateResult.value.email).toBe(userData.email);
//         }
//       }
//     });

//     it('should update user email', async () => {
//       const { userController } = createTestServices();
//       const userData = await createTestUser();

//       const registerResult = await userController.register({ body: userData });
//       expect(registerResult.success).toBe(true);

//       if (registerResult.success) {
//         const newEmail = `updated_${userData.email}`;
//         const updateResult = await userController.update({
//           userId: registerResult.value.id,
//           body: { email: newEmail },
//         });

//         expect(updateResult.success).toBe(true);
//         if (updateResult.success) {
//           expect(updateResult.value.email).toBe(newEmail);
//         }
//       }
//     });

//     it('should fail when updating to existing email', async () => {
//       const { userController } = createTestServices();
//       const user1Data = await createTestUser();
//       const user2Data = await createTestUser();

//       const user1 = await userController.register({ body: user1Data });
//       const user2 = await userController.register({ body: user2Data });

//       expect(user1.success && user2.success).toBe(true);

//       if (user1.success && user2.success) {
//         const result = await userController.update({
//           userId: user2.value.id,
//           body: { email: user1Data.email }, // Try to use user1's email
//         });

//         expect(result.success).toBe(false);
//         if (!result.success) {
//           expect(result.error.type).toBe('CONFLICT');
//           expect(result.error.message).toContain('Email already in use');
//         }
//       }
//     });

//     it('should update password and hash it', async () => {
//       const { userController } = createTestServices();
//       const userData = await createTestUser();

//       const registerResult = await userController.register({ body: userData });
//       expect(registerResult.success).toBe(true);

//       if (registerResult.success) {
//         const newPassword = 'NewPassword123';
//         const updateResult = await userController.update({
//           userId: registerResult.value.id,
//           body: { password: newPassword },
//         });

//         expect(updateResult.success).toBe(true);

//         // Verify new password works for login
//         const loginResult = await userController.login({
//           body: { email: userData.email, password: newPassword },
//         });

//         expect(loginResult.success).toBe(true);

//         // Verify old password doesn't work
//         const oldLoginResult = await userController.login({
//           body: { email: userData.email, password: userData.password },
//         });

//         expect(oldLoginResult.success).toBe(false);
//       }
//     });
//   });

//   describe('DELETE /protected/:id', () => {
//     it('should soft delete user', async () => {
//       const { userController } = createTestServices();
//       const userData = await createTestUser();

//       const registerResult = await userController.register({ body: userData });
//       expect(registerResult.success).toBe(true);

//       if (registerResult.success) {
//         const deleteResult = await userController.delete({
//           params: { id: registerResult.value.id },
//         });

//         expect(deleteResult.success).toBe(true);

//         // Verify user can't be found
//         const findResult = await userController.me({ userId: registerResult.value.id });
//         expect(findResult.success).toBe(false);
//       }
//     });

//     it('should fail deleting non-existent user', async () => {
//       const { userController } = createTestServices();
//       const fakeUserId = '00000000-0000-0000-0000-000000000000';

//       const result = await userController.delete({ params: { id: fakeUserId } });

//       expect(result.success).toBe(false);
//       if (!result.success) {
//         expect(result.error.type).toBe('NOT_FOUND');
//       }
//     });

//     it('should allow creating new user with same email after soft delete', async () => {
//       const { userController } = createTestServices();
//       const userData = await createTestUser();

//       // Create user
//       const user1 = await userController.register({ body: userData });
//       expect(user1.success).toBe(true);

//       if (user1.success) {
//         // Delete user
//         await userController.delete({ params: { id: user1.value.id } });

//         // Create new user with same email
//         const user2 = await userController.register({ body: userData });

//         expect(user2.success).toBe(true);
//         if (user2.success) {
//           expect(user2.value.id).not.toBe(user1.value.id);
//           expect(user2.value.email).toBe(userData.email);
//         }
//       }
//     });
//   });
// });