const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const userId = '2146efe7-20c3-41f7-8bde-9c4555b38f73';

  // Get all contributions with their externalIds to compare
  const all = await prisma.researchContribution.findMany({
    where: { applicantUserId: userId },
    select: {
      id: true,
      doi: true,
      title: true,
      publicationType: true,
      status: true,
      externalIds: true,
      sourceSystems: true,
      createdAt: true,
      updatedAt: true,
      lastSyncedAt: true,
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log('Total:', all.length);

  // Find duplicate DOIs
  const doiGroups = {};
  const noDoiDupes = {};

  for (const c of all) {
    if (c.doi) {
      if (!doiGroups[c.doi]) doiGroups[c.doi] = [];
      doiGroups[c.doi].push(c);
    } else {
      // Check by title for no-DOI dupes
      const titleKey = (c.title || '').toLowerCase().trim().slice(0, 80);
      if (!noDoiDupes[titleKey]) noDoiDupes[titleKey] = [];
      noDoiDupes[titleKey].push(c);
    }
  }

  const doiDupes = Object.entries(doiGroups).filter(([, arr]) => arr.length > 1);
  const titleDupes = Object.entries(noDoiDupes).filter(([, arr]) => arr.length > 1);

  console.log('\n=== DUPLICATE DOIs ===', doiDupes.length);
  for (const [doi, arr] of doiDupes) {
    console.log('\nDOI:', doi);
    for (const c of arr) {
      console.log('  id:', c.id);
      console.log('  created:', c.createdAt, 'updated:', c.updatedAt);
      console.log('  externalIds:', JSON.stringify(c.externalIds));
      console.log('  sourceSystems:', JSON.stringify(c.sourceSystems));
      console.log('  status:', c.status, '| type:', c.publicationType);
    }
  }

  console.log('\n=== DUPLICATE TITLES (no DOI) ===', titleDupes.length);
  for (const [title, arr] of titleDupes) {
    console.log('\nTitle:', title);
    for (const c of arr) {
      console.log('  id:', c.id, '| created:', c.createdAt);
      console.log('  externalIds:', JSON.stringify(c.externalIds));
    }
  }

  // How many have duplicate scopus IDs?
  const allExtIds = all.map(c => ({ id: c.id, scopus: c.externalIds && c.externalIds.scopus }));
  const scopusIdGroups = {};
  for (const c of allExtIds) {
    if (c.scopus) {
      if (!scopusIdGroups[c.scopus]) scopusIdGroups[c.scopus] = [];
      scopusIdGroups[c.scopus].push(c.id);
    }
  }
  const scopusDupes = Object.entries(scopusIdGroups).filter(([, arr]) => arr.length > 1);
  console.log('\n=== DUPLICATE SCOPUS IDs ===', scopusDupes.length);
  for (const [scopusId, ids] of scopusDupes.slice(0, 5)) {
    console.log('Scopus ID:', scopusId, '-> DB IDs:', ids);
  }

  await prisma.$disconnect();
})().catch(e => { console.error(e.message || e); });
