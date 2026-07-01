// import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
// import { sql } from 'drizzle-orm';
// import { setupTestDatabase, cleanupTestDatabase, resetTestDatabase } from '../setup/test-db';
// import { createTestServices, createTestUser } from '../setup/test-helpers';
// import { getEncryption } from '@/shared/crypto/encryption.service';
// import "dotenv/config"


// describe('User Data Encryption', () => {
//   beforeAll(async () => {
//     await setupTestDatabase();
//   });

//   afterAll(async () => {
//     await cleanupTestDatabase();
//   });

//   beforeEach(async () => {
//     await resetTestDatabase();
//   });

//   it('should encrypt email and name in database', async () => {
//     const { userController, db } = createTestServices();
//     const userData = await createTestUser();

//     const registerResult = await userController.register({ body: userData });
//     expect(registerResult.success).toBe(true);

//     if (registerResult.success) {
//       // Query raw database to verify encryption
//       const rawUsers = await db.execute(
//         sql`SELECT email, name FROM users WHERE id = ${registerResult.value.id}`
//       );

//       const rawUser = rawUsers[0] as { email: string; name: string };

//       // Email and name should NOT match plaintext in database
//       expect(rawUser.email).not.toBe(userData.email);
//       expect(rawUser.name).not.toBe(userData.name);

//       // Should be base64 encrypted strings
//       expect(rawUser.email).toMatch(/^[A-Za-z0-9+/]+=*$/);
//       expect(rawUser.name).toMatch(/^[A-Za-z0-9+/]+=*$/);
//     }
//   });

//   it('should decrypt data when retrieving user', async () => {
//     const { userController } = createTestServices();
//     const userData = await createTestUser();

//     const registerResult = await userController.register({ body: userData });
//     expect(registerResult.success).toBe(true);

//     if (registerResult.success) {
//       const meResult = await userController.me({ userId: registerResult.value.id });

//       expect(meResult.success).toBe(true);
//       if (meResult.success) {
//         // Data returned to application should be decrypted
//         expect(meResult.value.email).toBe(userData.email);
//         expect(meResult.value.name).toBe(userData.name);
//       }
//     }
//   });

//   it('should use emailHash for O(1) lookup', async () => {
//     const { userController, db } = createTestServices();
//     const userData = await createTestUser();

//     const registerResult = await userController.register({ body: userData });
//     expect(registerResult.success).toBe(true);

//     if (registerResult.success) {
//       // Query raw database to verify emailHash exists
//       const rawUsers = await db.execute(
//         sql`SELECT email_hash FROM users WHERE id = ${registerResult.value.id}`
//       );

//       const rawUser = rawUsers[0] as { email_hash: string };

//       expect(rawUser.email_hash).toBeDefined();
//       expect(rawUser.email_hash).toHaveLength(64); // SHA-256 hex = 64 chars

//       // Verify hash matches
//       const encryption = getEncryption();
//       const expectedHash = encryption.hash(userData.email);
//       expect(rawUser.email_hash).toBe(expectedHash);
//     }
//   });

//   it('should find user by email using hash index', async () => {
//     const { userController, userRepository } = createTestServices();
//     const userData = await createTestUser();

//     await userController.register({ body: userData });

//     // findByEmail should use emailHash for lookup
//     const user = await userRepository.findByEmail(userData.email);

//     expect(user).toBeDefined();
//     expect(user?.email).toBe(userData.email);
//   });

//   it('should handle case-insensitive email search', async () => {
//     const { userController, userRepository } = createTestServices();
//     const userData = await createTestUser({ email: 'Test@Example.COM' });

//     await userController.register({ body: userData });

//     // Should find with lowercase
//     const user1 = await userRepository.findByEmail('test@example.com');
//     expect(user1).toBeDefined();
//     expect(user1?.email).toBe('Test@Example.COM');

//     // Should find with uppercase
//     const user2 = await userRepository.findByEmail('TEST@EXAMPLE.COM');
//     expect(user2).toBeDefined();

//     // Should find with mixed case
//     const user3 = await userRepository.findByEmail('TeSt@ExAmPlE.cOm');
//     expect(user3).toBeDefined();
//   });

//   it('should encrypt updated fields', async () => {
//     const { userController, db } = createTestServices();
//     const userData = await createTestUser();

//     const registerResult = await userController.register({ body: userData });
//     expect(registerResult.success).toBe(true);

//     if (registerResult.success) {
//       const newName = 'Updated Name';
//       await userController.update({
//         userId: registerResult.value.id,
//         body: { name: newName },
//       });

//       // Verify encryption in database
//       const rawUsers = await db.execute(
//         sql`SELECT name FROM users WHERE id = ${registerResult.value.id}`
//       );

//       const rawUser = rawUsers[0] as { name: string };
//       expect(rawUser.name).not.toBe(newName);
//       expect(rawUser.name).toMatch(/^[A-Za-z0-9+/]+=*$/);
//     }
//   });
// });