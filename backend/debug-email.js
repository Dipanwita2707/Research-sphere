const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const r = await p.gate_pass.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    select: { pass_id: true, email: true, visitor_name: true, pass_status: true }
  });
  console.log(JSON.stringify(r, null, 2));
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
