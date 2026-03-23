// Seed a couple of example tasks using the generated Prisma client
const { PrismaClient } = require('../generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  const now = new Date();
  const today11 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0);
  const tomorrow16 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 16, 0, 0);

  const created = [];
  created.push(await prisma.task.create({ data: { title: 'Call 3 hot leads', dueDate: today11, status: 'pending' } }));
  created.push(await prisma.task.create({ data: { title: 'Prepare weekly report', dueDate: tomorrow16, status: 'pending' } }));
  console.log('Seeded tasks:', created.map(t => t.id));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });


