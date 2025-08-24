import { PrismaClient } from '@prisma/client';

// Increase timeout for E2E tests
jest.setTimeout(30000);

// Global test database client - use the same database as the app for now
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/media_inbox?schema=public',
    },
  },
});

// Clean up database before and after tests
beforeAll(async () => {
  // Connect to test database
  await testPrisma.$connect();

  // Clean up any existing data
  await testPrisma.session.deleteMany();
  await testPrisma.user.deleteMany();
});

afterAll(async () => {
  // Clean up test data
  await testPrisma.session.deleteMany();
  await testPrisma.user.deleteMany();

  // Disconnect from test database
  await testPrisma.$disconnect();
});

afterEach(async () => {
  // Clean up after each test
  await testPrisma.session.deleteMany();
  await testPrisma.user.deleteMany();
});
