/**
 * Preservation Property Tests for ORCID Sync Fix
 * 
 * Property 2: Preservation - Non-ORCID Changes Do Not Trigger Sync
 * 
 * IMPORTANT: Follow observation-first methodology
 * These tests capture the baseline behavior on UNFIXED code
 * Expected to PASS on unfixed code (confirms behavior to preserve)
 * 
 * GOAL: Ensure the fix doesn't break existing functionality
 */

const request = require('supertest');
const app = require('../../../server');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Property 2: Preservation - Non-ORCID Changes Should Not Trigger Sync', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Create a test user
    testUser = await prisma.userLogin.create({
      data: {
        uid: `TEST_PRES_${Date.now()}`,
        email: `test.preservation.${Date.now()}@sgt.edu`,
        password: 'hashedpassword',
        role: 'faculty',
        isActive: true,
        employeeDetails: {
          create: {
            displayName: 'Test Preservation User',
            designation: 'Assistant Professor',
            department: 'Computer Science',
            school: 'Engineering',
          },
        },
      },
      include: {
        employeeDetails: true,
      },
    });

    // Generate auth token (simplified - in real app would use proper auth)
    authToken = 'mock-token'; // This would be a real JWT token in production
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    if (testUser) {
      await prisma.publicationImportRun.deleteMany({
        where: {
          researchProfile: {
            userId: testUser.id,
          },
        },
      });
      await prisma.researchProfileIdentity.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.employeeDetails.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.userLogin.delete({
        where: { id: testUser.id },
      });
    }
    await prisma.$disconnect();
  });

  /**
   * Scenario 1: Save settings without changing ORCID ID
   * Expected: No sync should be triggered (ORCID unchanged)
   * Preservation: This behavior must remain unchanged after fix
   */
  test('Scenario 1: Saving settings without ORCID change should NOT trigger sync', async () => {
    const orcid = '0000-0002-7080-5336';

    // First, set up an existing ORCID
    await prisma.researchProfileIdentity.upsert({
      where: { userId: testUser.id },
      update: { orcid },
      create: {
        userId: testUser.id,
        orcid,
        syncStatus: 'success',
        lastSyncedAt: new Date('2026-01-01'),
      },
    });

    // Get count of import runs before update
    const runsBefore = await prisma.publicationImportRun.count({
      where: {
        researchProfile: {
          userId: testUser.id
        }
      }
    });

    // Update settings WITHOUT changing ORCID (only change sync frequency)
    const response = await request(app)
      .put(`/research/profile/${testUser.id}/identity`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orcid, // Same ORCID
        syncFrequencyDays: 14, // Only changing this
        autoSyncEnabled: true,
      });

    // Verify response is successful
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // PRESERVATION ASSERTION: No sync should be triggered
    expect(response.body.data.syncTriggered).not.toBe(true);

    // Verify NO new import runs were created
    const runsAfter = await prisma.publicationImportRun.count({
      where: {
        researchProfile: {
          userId: testUser.id,
        },
      },
    });

    // PRESERVATION ASSERTION: Import run count should be unchanged
    expect(runsAfter).toBe(runsBefore);
  });

  /**
   * Scenario 2: Save with empty/null ORCID ID
   * Expected: No sync should be triggered (no ORCID to sync)
   * Preservation: This behavior must remain unchanged after fix
   */
  test('Scenario 2: Saving with empty ORCID should NOT trigger sync', async () => {
    // Get count of import runs before update
    const runsBefore = await prisma.publicationImportRun.count({
      where: {
        researchProfile: {
          userId: testUser.id,
        },
      },
    });

    // Update settings with empty ORCID
    const response = await request(app)
      .put(`/research/profile/${testUser.id}/identity`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orcid: '', // Empty ORCID
        syncFrequencyDays: 7,
        autoSyncEnabled: true,
      });

    // Verify response is successful
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // PRESERVATION ASSERTION: No sync should be triggered
    expect(response.body.data.syncTriggered).not.toBe(true);

    // Verify NO new import runs were created
    const runsAfter = await prisma.publicationImportRun.count({
      where: {
        researchProfile: {
          userId: testUser.id,
        },
      },
    });

    // PRESERVATION ASSERTION: Import run count should be unchanged
    expect(runsAfter).toBe(runsBefore);
  });

  /**
   * Scenario 3: Save Scopus/Web of Science IDs only (no ORCID)
   * Expected: No sync should be triggered (only non-ORCID fields updated)
   * Preservation: This behavior must remain unchanged after fix
   */
  test('Scenario 3: Saving only Scopus/Web of Science IDs should NOT trigger sync', async () => {
    // Get count of import runs before update
    const runsBefore = await prisma.publicationImportRun.count({
      where: {
        researchProfile: {
          userId: testUser.id,
        },
      },
    });

    // Update settings with only Scopus and Web of Science IDs
    const response = await request(app)
      .put(`/research/profile/${testUser.id}/identity`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        scopusAuthorId: '12345678900',
        webOfScienceId: 'ABC-1234-2026',
        autoSyncEnabled: true,
      });

    // Verify response is successful
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // PRESERVATION ASSERTION: No sync should be triggered
    expect(response.body.data.syncTriggered).not.toBe(true);

    // Verify NO new import runs were created
    const runsAfter = await prisma.publicationImportRun.count({
      where: {
        researchProfile: {
          userId: testUser.id,
        },
      },
    });

    // PRESERVATION ASSERTION: Import run count should be unchanged
    expect(runsAfter).toBe(runsBefore);

    // Verify the other fields were saved correctly
    const identity = await prisma.researchProfileIdentity.findUnique({
      where: { userId: testUser.id },
    });

    expect(identity.scopusAuthorId).toBe('12345678900');
    expect(identity.webOfScienceId).toBe('ABC-1234-2026');
  });

  /**
   * Scenario 4: Save auto-sync settings without ORCID change
   * Expected: No sync should be triggered (only settings changed)
   * Preservation: This behavior must remain unchanged after fix
   */
  test('Scenario 4: Saving auto-sync settings without ORCID change should NOT trigger sync', async () => {
    const orcid = '0000-0002-7080-5336';

    // First, set up an existing ORCID
    await prisma.researchProfileIdentity.upsert({
      where: { userId: testUser.id },
      update: { orcid },
      create: {
        userId: testUser.id,
        orcid,
        syncStatus: 'success',
        lastSyncedAt: new Date('2026-01-01'),
      },
    });

    // Get count of import runs before update
    const runsBefore = await prisma.publicationImportRun.count({
      where: {
        researchProfile: {
          userId: testUser.id,
        },
      },
    });

    // Update only auto-sync settings
    const response = await request(app)
      .put(`/research/profile/${testUser.id}/identity`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orcid, // Same ORCID
        autoSyncEnabled: false, // Changing auto-sync setting
        syncFrequencyDays: 30,
      });

    // Verify response is successful
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // PRESERVATION ASSERTION: No sync should be triggered
    expect(response.body.data.syncTriggered).not.toBe(true);

    // Verify NO new import runs were created
    const runsAfter = await prisma.publicationImportRun.count({
      where: {
        researchProfile: {
          userId: testUser.id,
        },
      },
    });

    // PRESERVATION ASSERTION: Import run count should be unchanged
    expect(runsAfter).toBe(runsBefore);

    // Verify the settings were saved correctly
    const identity = await prisma.researchProfileIdentity.findUnique({
      where: { userId: testUser.id },
    });

    expect(identity.autoSyncEnabled).toBe(false);
    expect(identity.syncFrequencyDays).toBe(30);
  });

  /**
   * Scenario 5: Manual sync button continues to work
   * Expected: Manual sync endpoint should still trigger sync
   * Preservation: Manual sync functionality must remain unchanged
   */
  test('Scenario 5: Manual sync button should continue to work', async () => {
    const orcid = '0000-0002-7080-5336';

    // Set up an existing ORCID
    await prisma.researchProfileIdentity.upsert({
      where: { userId: testUser.id },
      update: { orcid },
      create: {
        userId: testUser.id,
        orcid,
        syncStatus: 'success',
        lastSyncedAt: new Date('2026-01-01'),
      },
    });

    // Get count of import runs before manual sync
    const runsBefore = await prisma.publicationImportRun.count({
      where: {
        researchProfile: {
          userId: testUser.id,
        },
      },
    });

    // Trigger manual sync via the sync endpoint
    const response = await request(app)
      .post(`/research/profile/${testUser.id}/sync`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sourcePreference: 'orcid',
      });

    // Verify response is successful
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // PRESERVATION ASSERTION: Manual sync should create import run
    const runsAfter = await prisma.publicationImportRun.count({
      where: {
        researchProfile: {
          userId: testUser.id,
        },
      },
    });

    expect(runsAfter).toBeGreaterThan(runsBefore);

    // Verify the import run has correct trigger type for manual sync
    const latestRun = await prisma.publicationImportRun.findFirst({
      where: {
        researchProfile: {
          userId: testUser.id,
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    expect(latestRun.triggerType).toBe('manual');
  });
});

/**
 * EXPECTED OUTCOME ON UNFIXED CODE:
 * 
 * All five test scenarios should PASS, confirming baseline behavior:
 * 1. Saving without ORCID change → No sync triggered ✓
 * 2. Saving with empty ORCID → No sync triggered ✓
 * 3. Saving only Scopus/Web of Science → No sync triggered ✓
 * 4. Saving auto-sync settings without ORCID change → No sync triggered ✓
 * 5. Manual sync button → Sync triggered as expected ✓
 * 
 * BASELINE BEHAVIOR DOCUMENTED:
 * - Non-ORCID field updates do not trigger sync
 * - Empty/null ORCID does not trigger sync
 * - ORCID unchanged (same value) does not trigger sync
 * - Manual sync endpoint continues to work correctly
 * - Settings are saved correctly regardless of sync trigger
 * 
 * AFTER FIX IS IMPLEMENTED:
 * These tests should STILL PASS, confirming no regressions occurred.
 */
