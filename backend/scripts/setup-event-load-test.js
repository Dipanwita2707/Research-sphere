const prisma = require('../src/shared/config/database');

const SOURCE_EVENT_ID = process.argv[2] || 'EVT-2026-0006';

async function nextEventId() {
  const currentYear = new Date().getFullYear();
  const prefix = `EVT-${currentYear}-`;
  const latest = await prisma.event.findFirst({
    where: { eventId: { startsWith: prefix } },
    select: { eventId: true },
    orderBy: { eventId: 'desc' },
  });

  const nextSequence = latest
    ? Number(latest.eventId.split('-')[2]) + 1
    : 1;

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

async function main() {
  const sourceEvent = await prisma.event.findUnique({
    where: { eventId: SOURCE_EVENT_ID },
    select: {
      id: true,
      createdById: true,
      eventType: true,
      venue: true,
      bannerImageUrl: true,
      logoImageUrl: true,
      contactPersonName: true,
      contactEmail: true,
      contactMobile: true,
    },
  });

  if (!sourceEvent) {
    throw new Error(`Source event ${SOURCE_EVENT_ID} not found`);
  }

  const eventId = await nextEventId();
  const now = new Date();
  const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const endDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const registrationStartDate = new Date(now.getTime() - 60 * 60 * 1000);
  const registrationEndDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const event = await prisma.event.create({
    data: {
      id: eventId,
      eventId,
      name: `k6-load-test-${eventId}`,
      eventType: sourceEvent.eventType,
      description: 'Dedicated event for automated k6 load testing',
      longDescription: 'Created automatically for event module performance testing.',
      startDate,
      endDate,
      paymentType: 'free',
      venue: sourceEvent.venue || 'Load Test Venue',
      maxCapacity: 5000,
      registrationCap: 5000,
      registrationStartDate,
      registrationEndDate,
      status: 'published',
      publishedAt: now,
      opportunityMode: 'online',
      participationType: 'individual',
      bannerImageUrl: sourceEvent.bannerImageUrl,
      logoImageUrl: sourceEvent.logoImageUrl,
      contactPersonName: sourceEvent.contactPersonName,
      contactEmail: sourceEvent.contactEmail,
      contactMobile: sourceEvent.contactMobile,
      allowExtraPasses: false,
      maxExtraPassesPerUser: 0,
      createdById: sourceEvent.createdById,
      updatedAt: now,
    },
  });

  const visibility = await prisma.eventVisibility.upsert({
    where: { eventId: event.id },
    create: {
      eventId: event.id,
      isActive: true,
      autoClosed: false,
      manuallyOverridden: true,
      visibleToRoles: ['student', 'faculty', 'staff', 'admin', 'superadmin', 'parent'],
      studentFilterType: 'all',
      allowedSchoolIds: [],
      allowedDepartmentIds: [],
      allowedProgramIds: [],
      allowedBatchYears: [],
      allowedSectionIds: [],
    },
    update: {
      isActive: true,
      autoClosed: false,
      manuallyOverridden: true,
      visibleToRoles: ['student', 'faculty', 'staff', 'admin', 'superadmin', 'parent'],
      studentFilterType: 'all',
      allowedSchoolIds: [],
      allowedDepartmentIds: [],
      allowedProgramIds: [],
      allowedBatchYears: [],
      allowedSectionIds: [],
    },
  });

  console.log(JSON.stringify({
    eventId: event.eventId,
    id: event.id,
    name: event.name,
    registrationStartDate: event.registrationStartDate,
    registrationEndDate: event.registrationEndDate,
    visibility: {
      isActive: visibility.isActive,
      manuallyOverridden: visibility.manuallyOverridden,
    },
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
