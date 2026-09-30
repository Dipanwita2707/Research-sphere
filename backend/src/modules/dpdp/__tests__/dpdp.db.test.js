/**
 * DPDP models against a real database. Everything runs inside one transaction that is
 * always rolled back, so nothing is left behind.
 *
 * Opt-in: RUN_DB_TESTS=1 npx jest src/modules/dpdp/__tests__/dpdp.db.test.js
 */
const runDbTests = process.env.RUN_DB_TESTS === '1';
const describeDb = runDbTests ? describe : describe.skip;

describeDb('DPDP (database)', () => {
  jest.setTimeout(120000);

  let prisma;
  let tenantContext;
  let utils;
  let constants;

  beforeAll(() => {
    prisma = require('../../../shared/config/database');
    tenantContext = require('../../../shared/tenancy/tenantContext');
    utils = require('../dpdp.utils');
    constants = require('../dpdp.constants');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  class Rollback extends Error {}

  it('scopes notices/consents per tenant and anonymises a user', async () => {
    const results = {};
    const suffix = Date.now().toString(36);

    await prisma.$transaction(async (tx) => {
      const [uniA, uniB] = await tenantContext.runAsSystem(() => Promise.all([
        tx.university.create({ data: { code: `DA${suffix}`, name: 'DPDP A', slug: `dpdp-a-${suffix}` } }),
        tx.university.create({ data: { code: `DB${suffix}`, name: 'DPDP B', slug: `dpdp-b-${suffix}` } }),
      ]));
      const platformNotice = await tenantContext.runAsSystem(() => tx.consentNotice.create({
        data: { universityId: null, version: `t-${suffix}`, title: 'P', content: constants.DEFAULT_NOTICE.content, purposes: constants.DEFAULT_NOTICE.purposes },
      }));
      await tenantContext.runAsSystem(() => tx.consentNotice.create({
        data: { universityId: uniB.id, version: `b-${suffix}`, title: 'B', content: 'b', purposes: [] },
      }));

      await tenantContext.runForTenant(uniA.id, async () => {
        const user = await tx.userLogin.create({ data: { uid: `D${suffix}`, email: `d-${suffix}@example.test`, passwordHash: 'x', role: 'student' } });
        await tx.studentDetails.create({
          data: { studentId: `S${suffix}`, firstName: 'Asha', email: `s-${suffix}@example.test`, dateOfBirth: new Date('2012-01-01'), userLoginId: user.id, address: 'Somewhere' },
        });
        results.userUniversity = user.universityId;

        const visible = await tx.consentNotice.findMany({ where: { version: { in: [`t-${suffix}`, `b-${suffix}`] } } });
        results.visibleNotices = visible.map((n) => n.version).sort();

        const rec = await tx.consentRecord.create({
          data: { userId: user.id, noticeId: platformNotice.id, purpose: 'core_services', granted: true, grantedAt: new Date() },
        });
        results.recordUniversity = rec.universityId;

        const nominee = await tx.dataPrincipalNominee.create({ data: { userId: user.id, name: 'Parent' } });
        results.nomineeUniversity = nominee.universityId;

        const request = await tx.dataPrincipalRequest.create({ data: { userId: user.id, type: 'erasure', dueAt: utils.computeDueAt('erasure') } });
        results.requestUniversity = request.universityId;

        const incident = await tx.dataBreachIncident.create({
          data: { title: 't', description: 'd', detectedAt: new Date(), boardReportDueAt: utils.computeBoardReportDueAt(new Date()) },
        });
        results.incidentUniversity = incident.universityId;

        // anonymisation writes as the service does them
        const f = utils.buildAnonymisedFields(user.id);
        await tx.userLogin.update({ where: { id: user.id }, data: f.userLogin });
        await tx.studentDetails.updateMany({ where: { userLoginId: user.id }, data: f.studentDetails });
        await tx.employeeDetails.updateMany({ where: { userLoginId: user.id }, data: f.employeeDetails });
        await tx.dataPrincipalNominee.deleteMany({ where: { userId: user.id } });
        const after = await tx.userLogin.findUnique({ where: { id: user.id }, include: { studentLogin: true } });
        results.after = {
          email: after.email,
          status: after.status,
          tokenVersion: after.tokenVersion,
          anonymized: !!after.anonymizedAt,
          firstName: after.studentLogin.firstName,
          dob: after.studentLogin.dateOfBirth,
          address: after.studentLogin.address,
          studentId: after.studentLogin.studentId,
        };
      });

      // tenant B cannot see A's consent record
      await tenantContext.runForTenant(uniB.id, async () => {
        results.bSeesRecords = await tx.consentRecord.count({ where: { purpose: 'core_services', notice: { version: `t-${suffix}` } } });
      });

      results.uniA = uniA.id;
      throw new Rollback();
    }).catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });

    expect(results.userUniversity).toBe(results.uniA);
    expect(results.visibleNotices).toEqual([`t-${suffix}`]);
    expect(results.recordUniversity).toBe(results.uniA);
    expect(results.nomineeUniversity).toBe(results.uniA);
    expect(results.requestUniversity).toBe(results.uniA);
    expect(results.incidentUniversity).toBe(results.uniA);
    expect(results.after).toMatchObject({ status: 'erased', tokenVersion: 1, anonymized: true, firstName: 'Erased', dob: null, address: null, studentId: expect.any(String) });
    expect(results.after.email).toMatch(/@erased\.invalid$/);
    expect(results.bSeesRecords).toBe(0);
  });
});
