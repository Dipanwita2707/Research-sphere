/**
 * assertTenantOwned: ids taken from a request must exist in the caller's tenant.
 */
const tenantContext = require('../tenantContext');
const { findMissingIds, findTenantOwnershipError } = require('../assertTenantOwned');

const T = '11111111-1111-1111-1111-111111111111';
const U1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const U2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const makePrisma = (existing) => {
  const findMany = jest.fn(async ({ where }) => where.id.in.filter((id) => existing.includes(id)).map((id) => ({ id })));
  return { userLogin: { findMany }, role: { findMany }, department: { findMany }, findMany };
};

describe('findMissingIds', () => {
  it('scopes the lookup to the current tenant explicitly', async () => {
    const prisma = makePrisma([U1]);
    const missing = await tenantContext.runForTenant(T, () => findMissingIds(prisma, 'userLogin', [U1, U2]));
    expect(missing).toEqual([U2]);
    expect(prisma.findMany).toHaveBeenCalledWith({
      where: { id: { in: [U1, U2] }, universityId: T },
      select: { id: true },
    });
  });

  it('allows global rows for shared models (roles)', async () => {
    const prisma = makePrisma([U1]);
    await tenantContext.runForTenant(T, () => findMissingIds(prisma, 'role', U1));
    expect(prisma.findMany.mock.calls[0][0].where).toEqual({
      id: { in: [U1] },
      OR: [{ universityId: T }, { universityId: null }],
    });
  });

  it('treats malformed ids as missing without querying', async () => {
    const prisma = makePrisma([]);
    const missing = await tenantContext.runForTenant(T, () => findMissingIds(prisma, 'userLogin', ['not-a-uuid', 42]));
    expect(missing).toEqual(['not-a-uuid', 42]);
    expect(prisma.findMany).not.toHaveBeenCalled();
  });

  it('deduplicates ids', async () => {
    const prisma = makePrisma([U1]);
    const missing = await tenantContext.runForTenant(T, () => findMissingIds(prisma, 'userLogin', [U1, U1]));
    expect(missing).toEqual([]);
    expect(prisma.findMany.mock.calls[0][0].where.id.in).toEqual([U1]);
  });
});

describe('findTenantOwnershipError', () => {
  it('returns the first failing message and skips empty checks', async () => {
    const prisma = makePrisma([U1]);
    const msg = await tenantContext.runForTenant(T, () => findTenantOwnershipError(prisma, [
      { model: 'userLogin', ids: U1, message: 'User not found' },
      { model: 'department', ids: null, message: 'Department not found' },
      { model: 'department', ids: [], message: 'Department not found' },
      { model: 'department', ids: [U2], message: 'One or more departments not found' },
    ]));
    expect(msg).toBe('One or more departments not found');
  });

  it('returns null when everything belongs to the tenant', async () => {
    const prisma = makePrisma([U1, U2]);
    const msg = await tenantContext.runForTenant(T, () => findTenantOwnershipError(prisma, [
      { model: 'userLogin', ids: U1, message: 'User not found' },
      { model: 'department', ids: [U2], message: 'Department not found' },
    ]));
    expect(msg).toBeNull();
  });
});
