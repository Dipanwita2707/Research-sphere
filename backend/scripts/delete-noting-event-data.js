/**
 * ============================================================
 *  DELETE ALL NOTING + EVENT DATA FROM THE SYSTEM
 * ============================================================
 *  Yeh script NOTE aur EVENT ke related saare records
 *  database se delete karta hai, foreign-key order mein.
 *
 *  RUN:
 *    cd backend
 *    node scripts/delete-noting-event-data.js
 *
 *  CAUTION: IRREVERSIBLE. Pehle backup lo.
 * ============================================================
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('========================================================');
  console.log('  NOTING + EVENT DATA CLEANUP SCRIPT');
  console.log('========================================================');
  console.log('\nStarting deletion in correct foreign-key order...\n');

  // ─── Helper ────────────────────────────────────────────────
  async function del(label, fn) {
    try {
      const result = await fn();
      const count = result?.count ?? result;
      console.log(`  ✓  ${label.padEnd(40)} → ${count} record(s) deleted`);
    } catch (err) {
      console.error(`  ✗  ${label}: FAILED — ${err.message}`);
      throw err;
    }
  }

  // ─── Wrap everything in a transaction ──────────────────────
  await prisma.$transaction(
    async (tx) => {

      // ──────────────────────────────────────────────────────
      // STEP 1: Handle tables that reference Note but should
      //         NOT be fully deleted:
      //   • Club          → notingId is nullable  → NULL it
      //   • ClubChangeRequest → notingId is required → DELETE
      //     (these are noting-created requests; no noting = no meaning)
      // ──────────────────────────────────────────────────────
      console.log('[ Step 1 ] Handling cross-references to Noting data');

      // ClubChangeRequest: notingId is NOT NULL so we delete them all
      await del('ClubChangeRequest (all)', () => tx.clubChangeRequest.deleteMany({}));

      // Club.notingId is nullable — just clear the reference; keep club rows
      await del('Club.notingId → NULL', () =>
        tx.$executeRaw`UPDATE "club" SET "noting_id" = NULL WHERE "noting_id" IS NOT NULL`
      );

      // ──────────────────────────────────────────────────────
      // STEP 2: Event leaf tables
      //         (children before parents)
      // ──────────────────────────────────────────────────────
      console.log('\n[ Step 2 ] Deleting Event leaf data');

      await del('EventFieldResponse',        () => tx.eventFieldResponse.deleteMany({}));
      await del('EventEntry',                () => tx.eventEntry.deleteMany({}));
      await del('EventTeamRequest',          () => tx.eventTeamRequest.deleteMany({}));
      await del('EventTeamInvitation',       () => tx.eventTeamInvitation.deleteMany({}));
      await del('EventTeamMember',           () => tx.eventTeamMember.deleteMany({}));
      await del('EventRegistration',         () => tx.eventRegistration.deleteMany({}));
      await del('EventTeam',                 () => tx.eventTeam.deleteMany({}));
      await del('EventVolunteer',            () => tx.eventVolunteer.deleteMany({}));
      await del('EventCustomField',          () => tx.eventCustomField.deleteMany({}));
      await del('EventPrize',                () => tx.eventPrize.deleteMany({}));
      await del('EventFeedback',             () => tx.eventFeedback.deleteMany({}));
      await del('EventVisibility',           () => tx.eventVisibility.deleteMany({}));

      // ──────────────────────────────────────────────────────
      // STEP 3: Stall data (linked to Event)
      // ──────────────────────────────────────────────────────
      console.log('\n[ Step 3 ] Deleting Stall data');

      await del('StallFeedback',             () => tx.stallFeedback.deleteMany({}));
      await del('StallApplication',          () => tx.stallApplication.deleteMany({}));
      await del('Stall',                     () => tx.stall.deleteMany({}));

      // ──────────────────────────────────────────────────────
      // STEP 4: Event (parent)
      // ──────────────────────────────────────────────────────
      console.log('\n[ Step 4 ] Deleting Events');

      await del('Event',                     () => tx.event.deleteMany({}));

      // ──────────────────────────────────────────────────────
      // STEP 5: Noting leaf tables
      // ──────────────────────────────────────────────────────
      console.log('\n[ Step 5 ] Deleting Noting leaf data');

      await del('NoteCopyReply',             () => tx.noteCopyReply.deleteMany({}));
      await del('NoteCopy',                  () => tx.noteCopy.deleteMany({}));
      await del('NoteAttachment',            () => tx.noteAttachment.deleteMany({}));
      await del('NoteHistory',               () => tx.noteHistory.deleteMany({}));
      await del('NotePoint',                 () => tx.notePoint.deleteMany({}));

      // ──────────────────────────────────────────────────────
      // STEP 6: Note (parent)
      // ──────────────────────────────────────────────────────
      console.log('\n[ Step 6 ] Deleting Notes');

      await del('Note',                      () => tx.note.deleteMany({}));

      // ──────────────────────────────────────────────────────
      // STEP 7: NotingAuthority
      // ──────────────────────────────────────────────────────
      console.log('\n[ Step 7 ] Deleting NotingAuthority');

      await del('NotingAuthority',           () => tx.notingAuthority.deleteMany({}));

      console.log('\n========================================================');
      console.log('  ALL NOTING + EVENT DATA DELETED SUCCESSFULLY ✓');
      console.log('========================================================\n');
    },
    {
      // Large datasets can take time; increase timeout to 5 min
      timeout: 300_000,
    }
  );
}

main()
  .catch((err) => {
    console.error('\n[FATAL] Deletion failed, transaction rolled back.');
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
