/**
 * One-time fix: set festivalNotingId on existing festival sub-events.
 * EVT-2026-0003 and EVT-2026-0004 were created from the Techfest 2025 noting.
 * We need to set festivalNotingId = noting.id on both of them.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find the festival noting (Techfest 2025 — approved)
  const noting = await prisma.note.findFirst({
    where: { notingEventType: 'festival', status: 'approved' },
    select: { id: true, festivalMeta: true },
  });

  if (!noting) {
    console.log('No approved festival noting found.');
    return;
  }

  const festivalName = noting.festivalMeta?.name || '(unknown)';
  console.log(`Found festival noting: ${noting.id} — "${festivalName}"`);

  // Find all sub-events linked to this noting (via notingId) that don't yet have festivalNotingId
  const events = await prisma.event.findMany({
    where: { notingId: noting.id },
    select: { id: true, eventId: true, name: true, festivalNotingId: true },
  });

  console.log(`Found ${events.length} event(s) linked to this noting:`);
  events.forEach((e) => console.log(`  ${e.eventId} — ${e.name} — festivalNotingId: ${e.festivalNotingId || 'NULL'}`));

  // Update those missing festivalNotingId
  const toFix = events.filter((e) => !e.festivalNotingId);
  if (toFix.length === 0) {
    console.log('All events already have festivalNotingId set. Nothing to do.');
    return;
  }

  for (const ev of toFix) {
    await prisma.event.update({
      where: { id: ev.id },
      data: { festivalNotingId: noting.id },
    });
    console.log(`Updated ${ev.eventId} (${ev.name}) -> festivalNotingId = ${noting.id}`);
  }

  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
