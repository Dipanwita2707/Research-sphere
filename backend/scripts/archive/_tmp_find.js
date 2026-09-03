const prisma = require('./src/shared/config/database');
async function main() {
  const note = await prisma.note.findFirst({
    where: { notingId: 'SGTU/ACAD/EVENT/2026/95797' },
    select: { id: true, notingId: true, status: true, notingEventType: true }
  });
  console.log(JSON.stringify(note, null, 2));
  await prisma.$disconnect();
}
main();
