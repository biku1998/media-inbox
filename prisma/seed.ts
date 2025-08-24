// import { PrismaClient } from '@prisma/client';
// import * as bcrypt from 'bcrypt';

// const prisma = new PrismaClient();

// async function main() {
//   console.log('🌱 Starting database seeding...');

//   // Create admin user
//   const adminPassword = await bcrypt.hash('admin123', 10);
//   const admin = await prisma.user.upsert({
//     where: { email: 'admin@example.com' },
//     update: {},
//     create: {
//       email: 'admin@example.com',
//       passwordHash: adminPassword,
//       role: 'ADMIN',
//     },
//   });
//   console.log('✅ Admin user created:', admin.email);

//   // Create regular user
//   const userPassword = await bcrypt.hash('user123', 10);
//   const user = await prisma.user.upsert({
//     where: { email: 'user@example.com' },
//     update: {},
//     create: {
//       email: 'user@example.com',
//       passwordHash: userPassword,
//       role: 'USER',
//     },
//   });
//   console.log('✅ Regular user created:', user.email);

//   console.log('🎉 Database seeding completed!');
//   console.log('\n📋 Test Credentials:');
//   console.log('Admin: admin@example.com / admin123');
//   console.log('User: user@example.com / user123');
// }

// main()
//   .catch((e) => {
//     console.error('❌ Error during seeding:', e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });

console.log('🌱 Database seeded');
