/**
 * Demo tenant branding (idempotent):
 *
 *   node scripts/database/seeds/seed-tenant-branding.js
 *
 *   DEMO    SGT Demo University — Classic Wine (the default ResearchSphere theme)
 *   RUNGTA  Rungta International Skills University (RISU) — Royal Blue & White
 *
 * No logo files are created: universities without an uploaded logo show a generated
 * monogram (their short name on the primary colour). Upload the real logos from
 * Superadmin → Universities → <university> → Branding & theme.
 * Development only: refuses to run when NODE_ENV=production.
 */
'use strict';

require('dotenv').config({ quiet: true });

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo branding with NODE_ENV=production.');
  process.exit(1);
}

const prisma = require('../../../src/shared/config/database');
const tenantContext = require('../../../src/shared/tenancy/tenantContext');

const BRANDING = [
  {
    code: 'DEMO',
    data: { displayName: 'SGT Demo University', shortName: 'SGT Demo', themePreset: 'classic-wine', primaryColor: null, accentColor: null },
  },
  {
    code: 'RUNGTA',
    data: {
      displayName: 'Rungta International Skills University',
      shortName: 'RISU',
      themePreset: 'royal-blue',
      primaryColor: null,
      accentColor: null,
    },
  },
];

async function seedTenantBranding() {
  for (const { code, data } of BRANDING) {
    const uni = await tenantContext.runAsSystem(() => prisma.university.findUnique({ where: { code }, select: { id: true } }));
    if (!uni) {
      console.log(`- ${code}: not found, skipped`);
      continue;
    }
    await tenantContext.runAsSystem(() =>
      prisma.university.update({ where: { id: uni.id }, data: { ...data, brandingUpdatedAt: new Date() } }),
    );
    console.log(`- ${code}: ${data.displayName} (${data.shortName}) → ${data.themePreset}`);
  }
}

if (require.main === module) {
  seedTenantBranding()
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error(err.message);
      await prisma.$disconnect().catch(() => {});
      process.exit(1);
    });
}

module.exports = { seedTenantBranding };
