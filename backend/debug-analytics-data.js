const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.researchContribution.count();
  console.log('Total ResearchContributions:', total);

  const withSubmitted = await prisma.researchContribution.count({ where: { submittedAt: { not: null } } });
  const withoutSubmitted = await prisma.researchContribution.count({ where: { submittedAt: null } });
  console.log('With submittedAt:', withSubmitted, '  Without submittedAt (drafts):', withoutSubmitted);

  const byStatus = await prisma.researchContribution.groupBy({ by: ['status'], _count: true });
  console.log('\nBy Status:');
  byStatus.forEach(r => console.log('  ', r.status, ':', r._count));

  const byType = await prisma.researchContribution.groupBy({ by: ['publicationType'], _count: true });
  console.log('\nBy Publication Type:');
  byType.forEach(r => console.log('  ', r.publicationType, ':', r._count));

  const sample = await prisma.researchContribution.findMany({
    select: { id: true, status: true, submittedAt: true, createdAt: true, publicationType: true },
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  console.log('\nLast 10 records:');
  sample.forEach(r => console.log(JSON.stringify({ id: r.id.slice(0,8), status: r.status, submittedAt: r.submittedAt, type: r.publicationType })));

  const ipr = await prisma.iprApplication.count();
  const grants = await prisma.grantApplication.count();
  console.log('\nIPR count:', ipr);
  console.log('Grants count:', grants);
}

main().catch(console.error).finally(() => prisma.$disconnect());
