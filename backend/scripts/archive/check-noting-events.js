const prisma = require('./src/shared/config/database');

async function main() {
  const noteId = process.argv[2] || 'aae465e9-ed38-4da5-ab37-1b036793340e';
  const events = await prisma.event.findMany({
    where: { notingId: noteId },
    select: { eventId: true, name: true, status: true, createdAt: true }
  });
  console.log(`Events for noting ${noteId}:`);
  if (events.length === 0) {
    console.log('  No events found.');
  } else {
    events.forEach(e => console.log(`  ${e.eventId} | ${e.name} | ${e.status} | ${e.createdAt}`));
  }
  await prisma.$disconnect();
}
main();
