/**
 * Bug Condition Exploration Test for ORCID Sync
 * 
 * Property 1: Bug Condition - ORCID Save Does Not Trigger Automatic Sync
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * GOAL: Surface counterexamples that demonstrate the bug exists
 */

const request = require('supertest');
const app = require('../../../server');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Property 1: ORCID Save Should Trigger Automatic Sync', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Create a test user
    testUser = await prisma.userLogin.create({
      data: {
        uid: `TEST_ORCID_${Date.now()}`,
        email: `test.orcid.${Date.now()}@sgt.edu`,
        password: 'hashedpassword',
        role: 'faculty',
        isActive: true,
        employeeDetails: {
          create: {
            displayName: 'Test ORCID User',
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
   * Scenario 1: User saves new ORCID ID (first time)
   * Expected: Sync should be triggered automatically
   * Bug: No sync is triggered - user must manually click "Sync ORCID"
   */
  test('Scenario 1: Saving new ORCID ID should trigger automatic sync', async () => {
    const newOrcid = '0000-0002-7080-5336'; // Real ORCID ID for testing

    // Make request to update identity with new ORCID
    const response = await request(app)
      .put(`/research/profile/${testUser.id}/identity`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orcid: newOrcid,
        autoSyncEnabled: true,
        syncFrequencyDays: 7,
      });

    // Verify response indicates sync was triggered
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    // CRITICAL ASSERTION: This will FAIL on unfixed code
    expect(response.body.data.syncTriggered).toBe(true);
    expect(response.body.message).toContain('sync initiated');

    // Verify PublicationImportRun record was created
    const importRuns = await prisma.publicationImportRun.findMany({
      where: {
        researchProfile: {
          userId: testUser.id,
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 1,
    });

    // CRITICAL ASSERTION: This will FAIL on unfixed code
    expect(importRuns.length).toBeGreaterThan(0);
    expect(importRuns[0].triggerType).toBe('auto_on_identity_update');
    expect(importRuns[0].importFormat).toBe('orcid');

    // Verify sync status was updated
    const identity = await prisma.researchProfileIdentity.findUnique({
      where: { userId: testUser.id },
    });

    // CRITICAL ASSERTION: This will FAIL on unfixed code
    expect(identity.syncStatus).not.toBe('never_synced');
    expect(identity.lastSyncedAt).not.toBeNull();
  });

  /**
   * Scenario 2: User updates existing ORCID ID to different value
   * Expected: Sync should be triggered automatically
   * Bug: No sync is triggered - user must manually click "Sync ORCID"
   */
  test('Scenario 2: Updating ORCID ID to different value should trigger automatic sync', async () => {
    const firstOrcid = '0000-0002-1111-1111';
    const secondOrcid = '0000-0002-7080-5336'; // Real ORCID ID for testing

    // First, save an ORCID ID
    await prisma.researchProfileIdentity.upsert({
      where: { userId: testUser.id },
      update: { orcid: firstOrcid },
      create: {
        userId: testUser.id,
        orcid: firstOrcid,
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

    // Now update to a different ORCID ID
    const response = await request(app)
      .put(`/research/profile/${testUser.id}/identity`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orcid: secondOrcid,
      });

    // Verify response indicates sync was triggered
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    // CRITICAL ASSERTION: This will FAIL on unfixed code
    expect(response.body.data.syncTriggered).toBe(true);

    // Verify a NEW PublicationImportRun record was created
    const runsAfter = await prisma.publicationImportRun.count({
      where: {
        researchProfile: {
          userId: testUser.id,
        },
      },
    });

    // CRITICAL ASSERTION: This will FAIL on unfixed code
    expect(runsAfter).toBe(runsBefore + 1);

    // Verify the new import run has correct metadata
    const latestRun = await prisma.publicationImportRun.findFirst({
      where: {
        researchProfile: {
          userId: testUser.id,
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // CRITICAL ASSERTION: This will FAIL on unfixed code
    expect(latestRun.triggerType).toBe('auto_on_identity_update');
    expect(latestRun.importFormat).toBe('orcid');
  });

  /**
   * Scenario 3: User saves ORCID ID with auto-sync enabled
   * Expected: Immediate sync should be triggered
   * Bug: No immediate sync occurs - user must manually click "Sync ORCID"
   */
  test('Scenario 3: Saving ORCID with auto-sync enabled should trigger immediate sync', async () => {
    const newOrcid = '0000-0002-7080-5336'; // Real ORCID ID for testing

    // Make request to update identity with new ORCID and auto-sync enabled
    const response = await request(app)
      .put(`/research/profile/${testUser.id}/identity`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orcid: newOrcid,
        autoSyncEnabled: true,
        syncFrequencyDays: 1,
      });

    // Verify response indicates sync was triggered
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    // CRITICAL ASSERTION: This will FAIL on unfixed code
    expect(response.body.data.syncTriggered).toBe(true);
    expect(response.body.message).toContain('sync initiated');

    // Verify sync status is updated (not "never_synced")
    const identity = await prisma.researchProfileIdentity.findUnique({
      where: { userId: testUser.id },
    });

    // CRITICAL ASSERTION: This will FAIL on unfixed code
    expect(identity.syncStatus).toMatch(/in_progress|syncing|success/);
    expect(identity.lastSyncedAt).not.toBeNull();
  });
});

/**
 * EXPECTED OUTCOME ON UNFIXED CODE:
 * 
 * All three test scenarios should FAIL with assertions like:
 * - expect(response.body.data.syncTriggered).toBe(true) → FAILS (syncTriggered is undefined or false)
 * - expect(importRuns.length).toBeGreaterThan(0) → FAILS (no import runs created)
 * - expect(importRuns[0].triggerType).toBe('auto_on_identity_update') → FAILS (no import run exists)
 * - expect(identity.syncStatus).not.toBe('never_synced') → FAILS (status remains "never_synced")
 * - expect(identity.lastSyncedAt).not.toBeNull() → FAILS (lastSyncedAt is null)
 * 
 * COUNTEREXAMPLES DOCUMENTED:
 * 1. No PublicationImportRun records are created when ORCID ID is saved
 * 2. syncStatus remains "never_synced" after saving ORCID ID
 * 3. lastSyncedAt remains null after saving ORCID ID
 * 4. Response does not include syncTriggered flag
 * 5. Response message does not indicate sync was initiated
 * 
 * ROOT CAUSE CONFIRMED:
 * The updateProfileIdentity controller only calls upsertProfileIdentity() to save the data,
 * but does not check if ORCID changed and trigger syncFacultyPublications().
 */
