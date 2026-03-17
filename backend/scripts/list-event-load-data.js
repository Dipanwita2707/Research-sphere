const prisma = require('../src/shared/config/database');

async function main() {
  const [events, notes] = await Promise.all([
    prisma.event.findMany({
      select: {
        id: true,
        eventId: true,
        name: true,
        status: true,
        paymentType: true,
        participationType: true,
        registrationStartDate: true,
        registrationEndDate: true,
        startDate: true,
        endDate: true,
        createdAt: true,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.note.findMany({
      where: { status: 'approved' },
      select: {
        id: true,
        notingId: true,
        status: true,
        eventName: true,
        notingEventType: true,
        createdAt: true,
        createdById: true,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  console.log(JSON.stringify({ events, approvedNotes: notes }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});