require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const uid = '8fa6bb69-6cd9-48da-84a7-c3061e4dafbb';
  const contribs = await p.researchContribution.count({ where: { applicantUserId: uid } });
  const authorRows = await p.researchContributionAuthor.count({
    where: { researchContribution: { applicantUserId: uid } },
  });
  const sample = await p.researchContribution.findMany({
    where: { applicantUserId: uid },
    select: { id: true, title: true, _count: { select: { authors: true } } },
    take: 5,
  });
  const grouped = await p.researchContributionAuthor.groupBy({
    by: ['researchContributionId'],
    where: { researchContribution: { applicantUserId: uid } },
    _count: { _all: true },
  });
  const multi = grouped.filter((g) => g._count._all > 1).length;
  console.log({ contribs, authorRows, papersWithMultipleAuthors: multi, sample });
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
