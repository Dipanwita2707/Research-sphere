const prisma = require('../src/shared/config/database');

async function main() {
  const userId = '0cef99ef-c98a-409b-b2ab-cf8c936c62a9';
  
  // Find all team memberships for this user
  const memberships = await prisma.eventTeamMember.findMany({
    where: { userId },
    include: {
      EventTeam: {
        select: { id: true, name: true, eventId: true, status: true, _count: { select: { EventTeamMember: true } } }
      }
    }
  });

  console.log('Found memberships:', JSON.stringify(memberships, null, 2));

  for (const m of memberships) {
    const team = m.EventTeam;
    console.log(`\nTeam: ${team.name} (${team.id}), members: ${team._count.EventTeamMember}`);
    
    // Delete the member first
    await prisma.eventTeamMember.delete({ where: { id: m.id } });
    console.log(`  Deleted membership ${m.id}`);

    // If user was the only member, delete the team too
    if (team._count.EventTeamMember <= 1) {
      await prisma.eventTeam.delete({ where: { id: team.id } });
      console.log(`  Deleted orphan team ${team.id}`);
    }
  }

  console.log('\nCleanup complete!');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
