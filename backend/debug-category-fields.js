const p = require('./src/shared/config/database');
async function main() {
  const rows = await p.researchContribution.findMany({
    select: {
      publicationType: true, indexedIn: true, indexingCategories: true,
      quartile: true, conferenceType: true, conferenceSubType: true,
      nationalInternational: true, bookPublicationType: true, bookIndexingType: true,
      fundingAgency: true, proposalType: true
    }
  });
  rows.forEach(r => console.log(JSON.stringify(r)));
}
main().catch(console.error).finally(() => p.$disconnect());
