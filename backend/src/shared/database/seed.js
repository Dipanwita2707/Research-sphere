/**
 * Development / demo seed (idempotent).
 *
 *   npm run seed                              # tenant SGT
 *   npm run seed -- --university DEMO         # another demo tenant (code DEMO, slug demo)
 *   npm run seed -- --force                   # required when NODE_ENV=production
 *
 * Creates, only when missing:
 *   - SaaS tiers: starter, growth, enterprise
 *   - one university with an active 1-year enterprise subscription and a DPO placeholder
 *   - inside that university: the central departments (DRD, IPR, FINANCE, HR, REGISTRAR,
 *     ADMISSIONS), one school / department / program / section, and four users
 *     (admin, faculty, staff, student) with employee/student details
 *   - DRD and IPR central-department permissions for the admin, a REGISTRAR
 *     department permission for the faculty member
 *
 * Passwords: SEED_DEFAULT_PASSWORD for every new account if set, otherwise a strong
 * random password per account, printed once at the end. Existing accounts are never
 * modified, so re-running never resets a password.
 *
 * Every tenant-owned row is written with an explicit universityId (no tenant context
 * is open, so the tenant extension does not scope these queries).
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const {
  getArg, assertNotProduction, resolvePassword, printCredentials,
} = require('./seedUtils');

const SCRIPT = 'seed';
const PASSWORD_ENV = 'SEED_DEFAULT_PASSWORD';

const TIERS = [
  {
    name: 'starter', displayName: 'Starter Plan', monthlyPriceCents: 500000, yearlyPriceCents: 5000000,
    maxUsers: 500, maxApiCallsPerMonth: 100000, maxStorageGb: 10, overagePer1kCalls: 1000, sortOrder: 1,
    features: { audit_logs: true, custom_domain: false, sso: false },
  },
  {
    name: 'growth', displayName: 'Growth Plan', monthlyPriceCents: 1500000, yearlyPriceCents: 15000000,
    maxUsers: 2500, maxApiCallsPerMonth: 1000000, maxStorageGb: 50, overagePer1kCalls: 500, sortOrder: 2,
    features: { audit_logs: true, custom_domain: true, sso: false },
  },
  {
    name: 'enterprise', displayName: 'Enterprise Plan', monthlyPriceCents: 5000000, yearlyPriceCents: 50000000,
    maxUsers: -1, maxApiCallsPerMonth: -1, maxStorageGb: 500, overagePer1kCalls: 0, sortOrder: 3,
    features: { audit_logs: true, custom_domain: true, sso: true },
  },
];

const CENTRAL_DEPARTMENTS = [
  { departmentCode: 'DRD', departmentName: 'Directorate of Research and Development', shortName: 'DRD', departmentType: 'drd' },
  { departmentCode: 'IPR', departmentName: 'Intellectual Property Rights', shortName: 'IPR', departmentType: 'ipr' },
  { departmentCode: 'FINANCE', departmentName: 'Finance Department', shortName: 'Finance', departmentType: 'finance' },
  { departmentCode: 'HR', departmentName: 'Human Resources', shortName: 'HR', departmentType: 'hr' },
  { departmentCode: 'REGISTRAR', departmentName: 'Registrar Office', shortName: 'Registrar', departmentType: 'registrar' },
  { departmentCode: 'ADMISSIONS', departmentName: 'Admissions Office', shortName: 'Admissions', departmentType: 'admissions' },
];

// DRD reviewer/approver rights for every research workflow
const DRD_PERMISSIONS = ['ipr', 'research', 'book', 'conference', 'grant'].reduce((acc, kind) => {
  acc[`${kind}_review`] = true;
  acc[`${kind}_approve`] = true;
  acc[`${kind}_assign_school`] = true;
  return acc;
}, { applicant_analytics: true, drd_member_analytics: true });

const IPR_PERMISSIONS = { ipr_review: true, ipr_approve: true, ipr_assign_school: true };

/** Academic year starting in July, e.g. "2026-27". */
const currentAcademicYear = () => {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return { label: `${start}-${String((start + 1) % 100).padStart(2, '0')}`, startYear: start };
};

async function seed(prisma) {
  const code = String(getArg('university', 'SGT')).trim().toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(code)) throw new Error('--university must be 2-12 letters/digits');
  const slug = code.toLowerCase();
  const name = getArg('name', code === 'SGT' ? 'SGT University' : `${code} University (demo)`);
  const mailDomain = `${slug}.example.com`;
  const created = [];

  // ── SaaS tiers (global) ────────────────────────────────────────────────────
  const tiers = {};
  for (const t of TIERS) {
    tiers[t.name] = await prisma.saaSTier.upsert({
      where: { name: t.name },
      update: {},
      create: { ...t, isPublic: true },
    });
  }
  console.log(`Tiers: ${Object.keys(tiers).join(', ')}`);

  // ── University + subscription ──────────────────────────────────────────────
  let university = await prisma.university.findUnique({ where: { code } });
  if (!university) {
    const slugTaken = await prisma.university.findUnique({ where: { slug } });
    if (slugTaken) throw new Error(`Slug "${slug}" is already used by university ${slugTaken.code}`);
    university = await prisma.university.create({
      data: {
        code,
        name,
        slug,
        contactEmail: `admin@${mailDomain}`,
        isActive: true,
        // DPDP: placeholder grievance officer; replace via the superadmin console before go-live
        dpoName: 'Data Protection Officer (placeholder)',
        dpoEmail: `dpo@${mailDomain}`,
      },
    });
    console.log(`University created: ${code} (${university.id})`);
  } else {
    console.log(`University exists: ${code} (${university.id})`);
    if (!university.dpoEmail) {
      university = await prisma.university.update({
        where: { id: university.id },
        data: { dpoName: university.dpoName || 'Data Protection Officer (placeholder)', dpoEmail: `dpo@${mailDomain}` },
      });
    }
  }
  const universityId = university.id;

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  await prisma.universitySubscription.upsert({
    where: { universityId },
    update: {},
    create: {
      universityId,
      tierId: tiers.enterprise.id,
      status: 'active',
      billingCycle: 'yearly',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });

  // ── Central departments ────────────────────────────────────────────────────
  const central = {};
  for (const d of CENTRAL_DEPARTMENTS) {
    central[d.departmentCode] = await prisma.centralDepartment.upsert({
      where: { universityId_departmentCode: { universityId, departmentCode: d.departmentCode } },
      update: {},
      create: { ...d, universityId, isActive: true },
    });
  }
  console.log(`Central departments: ${Object.keys(central).join(', ')}`);

  // ── Academic structure ─────────────────────────────────────────────────────
  const school = await prisma.facultySchoolList.upsert({
    where: { universityId_facultyCode: { universityId, facultyCode: 'ENG' } },
    update: {},
    create: {
      universityId, facultyCode: 'ENG', facultyName: 'School of Engineering and Technology',
      facultyType: 'engineering', shortName: 'SET', isActive: true,
    },
  });
  const department = await prisma.department.upsert({
    where: { universityId_departmentCode: { universityId, departmentCode: 'CSE' } },
    update: {},
    create: {
      universityId, facultyId: school.id, departmentCode: 'CSE',
      departmentName: 'Computer Science & Engineering', shortName: 'CSE', isActive: true,
    },
  });
  const program = await prisma.program.upsert({
    where: { universityId_programCode: { universityId, programCode: 'BTECH-CSE' } },
    update: {},
    create: {
      universityId, departmentId: department.id, programCode: 'BTECH-CSE',
      programName: 'Bachelor of Technology in Computer Science', programType: 'undergraduate',
      shortName: 'B.Tech CSE', durationYears: 4, durationSemesters: 8, admissionCapacity: 120, isActive: true,
    },
  });
  const ay = currentAcademicYear();
  const section = await prisma.section.upsert({
    where: {
      programId_sectionCode_academicYear_semester: {
        programId: program.id, sectionCode: 'A', academicYear: ay.label, semester: 1,
      },
    },
    update: {},
    create: {
      universityId, programId: program.id, sectionCode: 'A', sectionName: 'Section A',
      academicYear: ay.label, semester: 1, batchYear: ay.startYear, capacity: 60, status: 'active',
    },
  });
  console.log(`Academic structure: ENG / CSE / BTECH-CSE / section A (${ay.label})`);

  // ── Users ──────────────────────────────────────────────────────────────────
  /**
   * Create a user unless the uid exists. uid and email are globally unique, so a
   * clash with another tenant is reported instead of silently reusing that account.
   */
  const ensureUser = async ({ uid, email, role, details }) => {
    const existing = await prisma.userLogin.findUnique({ where: { uid } });
    if (existing) {
      if (existing.universityId !== universityId) {
        throw new Error(`uid "${uid}" already exists outside university ${code}; pick another --university code`);
      }
      return existing;
    }
    const emailOwner = await prisma.userLogin.findUnique({ where: { email }, select: { uid: true } });
    if (emailOwner) throw new Error(`email "${email}" is already used by uid "${emailOwner.uid}"`);

    const { password, generated } = resolvePassword(PASSWORD_ENV);
    const user = await prisma.userLogin.create({
      data: {
        uid,
        email,
        role,
        status: 'active',
        universityId,
        passwordHash: await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS, 10) || 10),
        ...(details ? { employeeDetails: { create: { universityId, email, ...details } } } : {}),
      },
    });
    created.push({ role, uid, password, generated });
    return user;
  };

  const admin = await ensureUser({
    uid: `${code}-ADMIN`, email: `admin@${mailDomain}`, role: 'admin',
    details: { empId: `${code}-EMP0001`, firstName: 'University', lastName: 'Admin', designation: 'Administrator' },
  });
  const faculty = await ensureUser({
    uid: `${code}-FAC001`, email: `faculty@${mailDomain}`, role: 'faculty',
    details: {
      empId: `${code}-EMP0002`, firstName: 'Demo', lastName: 'Faculty', designation: 'Assistant Professor',
      primarySchoolId: school.id, primaryDepartmentId: department.id,
    },
  });
  await ensureUser({
    uid: `${code}-STF001`, email: `staff@${mailDomain}`, role: 'staff',
    details: {
      empId: `${code}-EMP0003`, firstName: 'Demo', lastName: 'Staff', designation: 'Administrative Officer',
      primaryCentralDeptId: central.DRD.id,
    },
  });
  const studentUser = await ensureUser({ uid: `${code}-STU001`, email: `student@${mailDomain}`, role: 'student' });

  const studentId = `${code}${ay.startYear}0001`;
  const existingStudent = await prisma.studentDetails.findUnique({ where: { userLoginId: studentUser.id } });
  if (!existingStudent) {
    await prisma.studentDetails.create({
      data: {
        universityId,
        userLoginId: studentUser.id,
        studentId,
        firstName: 'Demo',
        lastName: 'Student',
        email: `student@${mailDomain}`,
        sectionId: section.id,
        programId: program.id,
        mentorId: faculty.id,
        currentSemester: 1,
        isActive: true,
        dataEntryStatus: 'approved',
      },
    });
  }

  // Heads / coordinators: fill only when still empty (never overwrite real data)
  await prisma.facultySchoolList.updateMany({ where: { id: school.id, headOfFacultyId: null }, data: { headOfFacultyId: faculty.id } });
  await prisma.department.updateMany({ where: { id: department.id, headOfDepartmentId: null }, data: { headOfDepartmentId: faculty.id } });
  await prisma.program.updateMany({ where: { id: program.id, programCoordinatorId: null }, data: { programCoordinatorId: faculty.id } });
  await prisma.section.updateMany({ where: { id: section.id, classTeacherId: null }, data: { classTeacherId: faculty.id } });
  for (const d of Object.values(central)) {
    await prisma.centralDepartment.updateMany({ where: { id: d.id, headOfDepartmentId: null }, data: { headOfDepartmentId: admin.id } });
  }

  // ── Permissions ────────────────────────────────────────────────────────────
  const grantCentral = (centralDeptId, permissions, isPrimary) => prisma.centralDepartmentPermission.upsert({
    where: { userId_centralDeptId: { userId: admin.id, centralDeptId } },
    update: {},
    create: {
      universityId, userId: admin.id, centralDeptId, permissions, isPrimary, isActive: true, assignedBy: admin.id,
      assignedSchoolIds: [], assignedResearchSchoolIds: [],
    },
  });
  await grantCentral(central.DRD.id, DRD_PERMISSIONS, true);
  await grantCentral(central.IPR.id, IPR_PERMISSIONS, false);

  await prisma.userDepartmentPermission.upsert({
    where: { userId_department: { userId: faculty.id, department: 'REGISTRAR' } },
    update: {},
    create: {
      universityId, userId: faculty.id, department: 'REGISTRAR',
      permissions: { viewStudents: true, editStudents: false, approveData: true },
      isActive: true, assignedBy: admin.id,
    },
  });
  console.log('Permissions: admin -> DRD, IPR; faculty -> REGISTRAR');

  console.log(`\nSeed complete for university ${code} (slug "${slug}").`);
  printCredentials(created, PASSWORD_ENV);
}

if (require.main === module) {
  assertNotProduction(SCRIPT);
  const prisma = require('../config/database');
  seed(prisma)
    .catch((error) => {
      console.error(`[${SCRIPT}] failed:`, error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { seed };
