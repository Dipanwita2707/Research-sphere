/**
 * Retry event creation for an approved noting whose auto-create failed.
 *
 * Usage:
 *   node retry-event-creation.js <noting-id>
 *
 * Example:
 *   node retry-event-creation.js aae465e9-ed38-4da5-ab37-1b036793340e
 */

const prisma = require('./src/shared/config/database');
const eventService = require('./src/modules/event-management/services/event.service');

async function main() {
  const noteId = process.argv[2];
  if (!noteId) {
    console.error('Usage: node retry-event-creation.js <noting-id>');
    process.exit(1);
  }

  console.log(`\n🔄 Retrying event creation for noting: ${noteId}\n`);

  // Verify noting exists and is approved
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      notingId: true,
      status: true,
      eventName: true,
      notingEventType: true,
      subEvents: true,
      createdById: true,
    },
  });

  if (!note) {
    console.error('❌ Noting not found');
    process.exit(1);
  }

  if (note.status !== 'approved') {
    console.error(`❌ Noting status is "${note.status}", not "approved". Cannot create events.`);
    process.exit(1);
  }

  // Check if events already exist
  const existing = await prisma.event.findMany({
    where: { notingId: note.id },
    select: { eventId: true },
  });

  if (existing.length > 0) {
    console.log(`ℹ️  Events already exist for this noting: ${existing.map(e => e.eventId).join(', ')}`);
    console.log('   No action needed.');
    process.exit(0);
  }

  console.log(`📋 Noting ID: ${note.notingId}`);
  console.log(`   Type: ${note.notingEventType || 'venue'}`);
  if (note.notingEventType === 'festival' && Array.isArray(note.subEvents)) {
    console.log(`   Sub-events: ${note.subEvents.length}`);
  } else {
    console.log(`   Event Name: ${note.eventName}`);
  }

  try {
    const result = await eventService.createEventFromNoting(note.id, note.createdById);

    if (result.isFestival) {
      console.log(`\n✅ Created ${result.events.length} sub-event(s):`);
      result.events.forEach((e) => {
        console.log(`   - ${e.eventId}: ${e.name}`);
      });
    } else {
      console.log(`\n✅ Created event: ${result.event.eventId} — ${result.event.name}`);
    }
  } catch (err) {
    console.error(`\n❌ Failed: ${err.message}`);
    process.exit(1);
  }

  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
