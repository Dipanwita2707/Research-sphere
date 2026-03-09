/**
 * Cleanup script: Delete a noting and ALL related data from DB
 * Usage: node scripts/cleanup-noting.js [NOTING_ID]
 * Example: node scripts/cleanup-noting.js SGTU/ACAD/CURR/2026/81471
 *
 * Deletes: Note, NoteHistory, NoteAttachment, NotePoint, NoteCopy, NoteCopyReply,
 *          ClubChangeRequest (if linked), unlinks Event/Club (if linked)
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NOTING_ID = process.argv[2] || 'SGTU/ACAD/CURR/2026/81471';

async function main() {
  console.log(`\n🔍 Looking for noting: ${NOTING_ID}\n`);

  const note = await prisma.note.findUnique({
    where: { notingId: NOTING_ID },
    select: {
      id: true,
      notingId: true,
      category: true,
      subcategory: true,
      status: true,
      _count: {
        select: {
          history: true,
          copies: true,
          attachments: true,
          points: true,
        },
      },
    },
  });

  if (!note) {
    console.log('❌ Noting not found. Exiting.');
    process.exit(1);
  }

  console.log('Found noting:');
  console.log(`  ID: ${note.id}`);
  console.log(`  Category: ${note.category} / ${note.subcategory}`);
  console.log(`  Status: ${note.status}`);
  console.log(`  History: ${note._count.history}, Copies: ${note._count.copies}, Attachments: ${note._count.attachments}, Points: ${note._count.points}`);
  console.log('');

  // Get copy IDs for reply count
  const copies = await prisma.noteCopy.findMany({
    where: { noteId: note.id },
    select: { id: true, _count: { select: { replies: true } } },
  });
  const totalReplies = copies.reduce((s, c) => s + c._count.replies, 0);
  console.log(`  NoteCopy replies: ${totalReplies}`);
  console.log('');

  // Check linked records
  const club = await prisma.club.findFirst({ where: { notingId: note.id }, select: { id: true, name: true } });
  const clubChange = await prisma.clubChangeRequest.findFirst({ where: { notingId: note.id }, select: { id: true } });
  const events = await prisma.event.findMany({ where: { notingId: note.id }, select: { id: true, eventId: true, name: true } });

  if (club) console.log(`  Linked Club: ${club.name} (${club.id})`);
  if (clubChange) console.log(`  Linked ClubChangeRequest: ${clubChange.id}`);
  if (events.length) console.log(`  Linked Events: ${events.map((e) => e.eventId).join(', ')}`);
  console.log('');

  console.log('🗑️  Deleting in transaction...\n');

  await prisma.$transaction(async (tx) => {
    // 1. Break NoteCopy self-reference (rootCopyId) before delete
    await tx.noteCopy.updateMany({
      where: { noteId: note.id },
      data: { rootCopyId: null },
    });
    console.log('  ✓ Cleared rootCopyId on NoteCopy');

    // 2. Delete NoteCopyReply (via copyIds)
    const copyIds = copies.map((c) => c.id);
    if (copyIds.length > 0) {
      const delReplies = await tx.noteCopyReply.deleteMany({
        where: { copyId: { in: copyIds } },
      });
      console.log(`  ✓ Deleted ${delReplies.count} NoteCopyReply`);
    }

    // 3. Delete NoteCopy
    const delCopies = await tx.noteCopy.deleteMany({
      where: { noteId: note.id },
    });
    console.log(`  ✓ Deleted ${delCopies.count} NoteCopy`);

    // 4. Unlink Club (set notingId = null)
    if (club) {
      await tx.club.update({
        where: { id: club.id },
        data: { notingId: null },
      });
      console.log(`  ✓ Unlinked Club: ${club.name}`);
    }

    // 5. Delete ClubChangeRequest if linked
    if (clubChange) {
      await tx.clubChangeRequest.delete({
        where: { id: clubChange.id },
      });
      console.log(`  ✓ Deleted ClubChangeRequest`);
    }

    // 6. Unlink Events (set notingId = null)
    for (const ev of events) {
      await tx.event.update({
        where: { id: ev.id },
        data: { notingId: null },
      });
    }
    if (events.length) {
      console.log(`  ✓ Unlinked ${events.length} Event(s)`);
    }

    // 7. Delete Note (cascades: NoteHistory, NoteAttachment, NotePoint)
    await tx.note.delete({
      where: { id: note.id },
    });
    console.log(`  ✓ Deleted Note: ${note.notingId}`);
  });

  console.log('\n✅ Cleanup complete. DB is clean for this noting.\n');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
