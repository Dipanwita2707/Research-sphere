const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const club = await p.club.findFirst({
    where: { clubId: 'CLB-2026-00001' },
    select: {
      id: true,
      clubId: true,
      name: true,
      status: true,
      lifecycleState: true,
      chairpersonId: true,
      chairperson: {
        select: { id: true, uid: true, email: true, role: true }
      }
    }
  });
  console.log(JSON.stringify(club, null, 2));
  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
