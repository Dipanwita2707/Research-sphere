/**
 * Demo university seed — makes the system demoable end to end.
 *
 *   npm run seed:demo
 *
 * Creates (idempotently) one university "SGT Demo University" with:
 *   - subscription, DRD central department, 3 schools / 5 departments, a program and section
 *   - an administrator, 11 faculty, 4 students, DRD staff (head + reviewer), plus a security guard
 *   - ~40 published papers with internal/external co-authors, quartiles, citations and keywords
 *   - Research Intelligence: module enabled, two role templates assigned, keywords extracted,
 *     a curated 3-level taxonomy mapping, researcher expertise (no AI key needed)
 * It also LINKS existing accounts that belong to no university (e.g. ADMIN001, FAC001, STU001,
 * STF001, GUARD001, admin) to the demo university so they can sign in; their passwords are not touched.
 *
 * New demo accounts share one password: DEMO_PASSWORD, or the default printed at the end.
 * Development only: refuses to run when NODE_ENV=production.
 */

'use strict';

require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data with NODE_ENV=production.');
  process.exit(1);
}

const prisma = require('../../../src/shared/config/database');
const tenantContext = require('../../../src/shared/tenancy/tenantContext');
const keywords = require('../../../src/modules/research-intelligence/services/keywordExtraction.service');
const taxonomy = require('../../../src/modules/research-intelligence/services/taxonomy.service');
const expertise = require('../../../src/modules/research-intelligence/services/expertise.service');
const access = require('../../../src/modules/research-intelligence/services/access.service');
const { toSlug } = require('../../../src/modules/research-intelligence/services/researchData');

const DEMO_CODE = 'DEMO';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@2026-ResearchSphere';
const DOMAIN = 'demo.sgt.example';

// ─── Deterministic pseudo-random numbers, so every run produces the same demo data ───
const rng = (() => {
  let a = 20261001;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const chance = (p) => rng() < p;

// ─── Organisation ───────────────────────────────────────────────────────────────
const SCHOOLS = [
  { code: 'SOET', name: 'School of Engineering & Technology', type: 'engineering', depts: [
    { code: 'CSE', name: 'Computer Science & Engineering' },
    { code: 'ECE', name: 'Electronics & Communication Engineering' },
    { code: 'ME', name: 'Mechanical Engineering' },
  ] },
  { code: 'FDS', name: 'Faculty of Dental Sciences', type: 'medical', depts: [{ code: 'OPM', name: 'Oral Pathology & Microbiology' }] },
  { code: 'SOPS', name: 'School of Pharmaceutical Sciences', type: 'medical', depts: [{ code: 'PHM', name: 'Pharmaceutics & Pharmacology' }] },
];

const FACULTY = [
  { dept: 'CSE', name: 'Dr. Anita Sharma', designation: 'Professor' },
  { dept: 'CSE', name: 'Dr. Rohan Mehta', designation: 'Associate Professor' },
  { dept: 'ECE', name: 'Dr. Priya Nair', designation: 'Professor' },
  { dept: 'ECE', name: 'Dr. Vikram Singh', designation: 'Assistant Professor' },
  { dept: 'ME', name: 'Dr. Suresh Patel', designation: 'Professor' },
  { dept: 'ME', name: 'Dr. Kavita Rao', designation: 'Assistant Professor' },
  { dept: 'OPM', name: 'Dr. Neha Gupta', designation: 'Professor' },
  { dept: 'OPM', name: 'Dr. Arjun Verma', designation: 'Associate Professor' },
  { dept: 'PHM', name: 'Dr. Meera Iyer', designation: 'Professor' },
  { dept: 'PHM', name: 'Dr. Rahul Das', designation: 'Associate Professor' },
];

const STUDENTS = ['Aarav Khanna', 'Ishita Bansal', 'Kabir Malhotra'];
const EXTERNAL_COAUTHORS = [
  ['Prof. L. Fernandes', 'University of Lisbon', true],
  ['Dr. S. Banerjee', 'IIT Delhi', false],
  ['Dr. M. Okafor', 'University of Lagos', true],
  ['Dr. T. Chowdhury', 'AIIMS New Delhi', false],
  ['Prof. J. Lindqvist', 'KTH Royal Institute of Technology', true],
  ['Dr. P. Joshi', 'CSIR-NPL', false],
];

// Existing unlinked accounts → how to present them inside the demo university.
const LEGACY = {
  ADMIN001: { name: 'University Administrator', kind: 'admin' },
  admin: { name: 'Administrator', kind: 'admin' },
  FAC001: { name: 'Dr. Demo Faculty', kind: 'faculty', dept: 'CSE', designation: 'Assistant Professor' },
  STU001: { name: 'Demo Student', kind: 'student' },
  STF001: { name: 'DRD Member (Demo)', kind: 'drd' },
  GUARD001: { name: 'Security Guard', kind: 'guard' },
};

// Papers per department: [title, author keywords, journals-key]
const PAPERS = {
  CSE: [
    ['Federated learning for privacy-preserving healthcare analytics', 'federated learning; privacy; healthcare; edge computing'],
    ['Convolutional neural networks for early detection of diabetic retinopathy', 'deep learning; convolutional neural network; medical imaging; diabetic retinopathy'],
    ['Transformer-based sentiment analysis for low-resource Indian languages', 'natural language processing; transformer; sentiment analysis; low-resource languages'],
    ['Intrusion detection in IoT networks using ensemble machine learning', 'intrusion detection; internet of things; machine learning; cyber security'],
    ['Explainable AI for loan default prediction', 'explainable ai; machine learning; credit risk'],
    ['Blockchain-based credential verification for universities', 'blockchain; credential verification; smart contracts'],
    ['Object detection with lightweight YOLO variants on embedded devices', 'object detection; computer vision; edge computing; deep learning'],
    ['Graph neural networks for citation recommendation', 'graph neural network; recommender system; citation analysis'],
    ['Differentially private training of language models', 'privacy; natural language processing; deep learning'],
  ],
  ECE: [
    ['Compact MIMO antenna design for 5G millimetre-wave applications', 'antenna design; 5G; MIMO; millimetre wave'],
    ['Low-power VLSI architecture for ECG signal processing', 'VLSI; ECG; signal processing; low power'],
    ['Deep learning for modulation recognition in cognitive radio', 'deep learning; cognitive radio; modulation recognition'],
    ['Energy-efficient routing in wireless sensor networks using particle swarm optimization', 'wireless sensor network; particle swarm optimization; routing'],
    ['FPGA implementation of convolutional neural network accelerators', 'FPGA; convolutional neural network; hardware acceleration'],
    ['Compressive sensing for biomedical signal acquisition', 'compressive sensing; biomedical signals; signal processing'],
    ['Terahertz metamaterial absorbers for sensing', 'terahertz; metamaterial; absorber'],
    ['Visible light communication for indoor positioning', 'visible light communication; indoor positioning; internet of things'],
  ],
  ME: [
    ['Computational fluid dynamics analysis of heat transfer in microchannel heat sinks', 'computational fluid dynamics; heat transfer; microchannel'],
    ['Additive manufacturing of titanium lattice structures', 'additive manufacturing; titanium; lattice structures'],
    ['Thermal performance of nanofluid-based solar collectors', 'nanofluid; solar collector; heat transfer; renewable energy'],
    ['Finite element analysis of composite wind turbine blades', 'finite element analysis; composite materials; wind turbine'],
    ['Machine learning for predictive maintenance of rotating machinery', 'machine learning; predictive maintenance; condition monitoring'],
    ['Friction stir welding of aluminium alloys', 'friction stir welding; aluminium alloys; mechanical properties'],
    ['Phase change materials for building energy storage', 'phase change materials; energy storage; thermal comfort'],
    ['Topology optimization for lightweight automotive brackets', 'topology optimization; lightweight design; additive manufacturing'],
  ],
  OPM: [
    ['Prevalence of dental caries among school children in Delhi NCR: a cross-sectional study', 'dental caries; cross-sectional study; oral health; public health'],
    ['Salivary biomarkers for early detection of oral squamous cell carcinoma', 'oral cancer; salivary biomarkers; early detection'],
    ['Antimicrobial efficacy of herbal mouthwashes against Streptococcus mutans', 'herbal mouthwash; antimicrobial activity; streptococcus mutans; dental caries'],
    ['Cone beam computed tomography in assessment of peri-implant bone loss', 'cone beam computed tomography; dental implants; bone loss'],
    ['Artificial intelligence for radiographic detection of periapical lesions', 'artificial intelligence; deep learning; dental radiography; medical imaging'],
    ['Nanohydroxyapatite in remineralisation of enamel lesions', 'nanohydroxyapatite; enamel remineralisation; dental caries'],
    ['Oral microbiome changes in periodontal disease', 'oral microbiome; periodontal disease; 16S sequencing'],
    ['Zirconia versus titanium dental implants: a systematic review', 'dental implants; zirconia; titanium; systematic review'],
  ],
  PHM: [
    ['Nanoparticle-based targeted drug delivery for breast cancer therapy', 'nanoparticles; targeted drug delivery; breast cancer'],
    ['Molecular docking of phytochemicals against SARS-CoV-2 main protease', 'molecular docking; phytochemicals; SARS-CoV-2; drug discovery'],
    ['Green synthesis of silver nanoparticles using Ocimum sanctum and antimicrobial activity', 'green synthesis; silver nanoparticles; antimicrobial activity; ocimum sanctum'],
    ['Pharmacokinetic modelling of sustained-release metformin formulations', 'pharmacokinetics; sustained release; metformin'],
    ['In vitro antioxidant and anti-inflammatory activity of Curcuma extracts', 'antioxidant activity; anti-inflammatory; curcuma; phytochemicals'],
    ['Machine learning models for ADMET prediction', 'machine learning; ADMET prediction; drug discovery'],
    ['Transdermal delivery of ibuprofen using microneedle patches', 'transdermal delivery; microneedles; drug delivery'],
    ['Antidiabetic potential of polyherbal formulations: an in vivo study', 'polyherbal formulation; antidiabetic activity; in vivo'],
  ],
};

const JOURNALS = {
  CSE: ['IEEE Access', 'Expert Systems with Applications', 'Journal of Network and Computer Applications', 'Knowledge-Based Systems', 'ACM Computing Surveys'],
  ECE: ['IEEE Transactions on Antennas and Propagation', 'IEEE Sensors Journal', 'Microelectronics Journal', 'AEU - International Journal of Electronics and Communications'],
  ME: ['International Journal of Heat and Mass Transfer', 'Journal of Manufacturing Processes', 'Renewable Energy', 'Materials & Design'],
  OPM: ['Journal of Oral Pathology & Medicine', 'Clinical Oral Investigations', 'BMC Oral Health', 'Journal of Dentistry'],
  PHM: ['International Journal of Pharmaceutics', 'Journal of Controlled Release', 'Phytomedicine', 'Journal of Drug Delivery Science and Technology'],
};

// Curated keyword → taxonomy placement (domain → category → optional specialization) so topic
// intelligence works without an AI key. Order matters: first match wins.
const TAXONOMY_RULES = [
  [/blockchain|smart contract|credential/i, 'Blockchain & Distributed Ledgers', 'Credential verification'],
  [/intrusion|cyber|privacy|differential/i, 'Cybersecurity & Cryptography', null],
  [/natural language|sentiment|low-resource|language model|transformer/i, 'Natural Language Processing', null],
  [/medical imaging|retinopathy|radiograph|periapical|cone beam/i, 'Medical Imaging & Diagnostics', 'Medical image analysis'],
  [/computer vision|object detection|yolo/i, 'Computer Vision & Image Processing', null],
  [/federated/i, 'Artificial Intelligence & Machine Learning', 'Federated learning'],
  [/explainable/i, 'Artificial Intelligence & Machine Learning', 'Explainable AI'],
  [/convolutional|neural network|deep learning/i, 'Artificial Intelligence & Machine Learning', 'Deep neural networks'],
  [/machine learning|recommender|credit risk|artificial intelligence/i, 'Artificial Intelligence & Machine Learning', null],
  [/internet of things|iot|edge computing|wireless sensor|routing|indoor positioning/i, 'Networks, IoT & Edge Computing', null],
  [/antenna|5g|mimo|millimetre|terahertz|metamaterial|absorber|visible light|cognitive radio|modulation/i, 'Electronics & Communication', null],
  [/vlsi|fpga|hardware acceleration|low power/i, 'Electronics & Communication', 'VLSI & hardware design'],
  [/ecg|compressive|signal|biomedical signals/i, 'Signal Processing', null],
  [/predictive maintenance|condition monitoring/i, 'Manufacturing & Industrial Engineering', null],
  [/heat transfer|fluid|nanofluid|solar|phase change|thermal|microchannel|energy storage/i, 'Mechanical & Thermal Engineering', 'Heat transfer'],
  [/welding|additive|titanium|lattice|composite|wind turbine|topology|finite element|lightweight|aluminium/i, 'Mechanical & Thermal Engineering', null],
  [/oral cancer|breast cancer/i, 'Oncology', null],
  [/implant|zirconia|bone loss|periodontal/i, 'Periodontics & Implantology', null],
  [/caries|oral|dental|enamel|saliva|mouthwash|streptococcus|microbiome|nanohydroxyapatite|public health|cross-sectional|systematic review/i, 'Oral Pathology & Oral Medicine', null],
  [/docking|admet|drug discovery|sars/i, 'Computational Drug Discovery', null],
  [/drug delivery|nanoparticle|pharmacokinetic|transdermal|microneedle|sustained release|metformin/i, 'Drug Delivery & Pharmaceutics', null],
  [/phytochemical|antioxidant|inflammatory|curcuma|herbal|polyherbal|antidiabetic|ocimum|green synthesis|antimicrobial|silver/i, 'Phytochemistry & Natural Products', null],
];

// ─── Helpers ────────────────────────────────────────────────────────────────────
const sys = (fn) => tenantContext.runAsSystem(fn);
const splitName = (full) => {
  const parts = full.replace(/^(Dr|Prof)\.?\s+/i, '').trim().split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') || null };
};

async function ensureUser({ uid, email, role, name, universityId, passwordHash }) {
  let user = await sys(async () => prisma.userLogin.findFirst({ where: { uid } }));
  if (user) {
    if (!user.universityId && universityId) user = await sys(async () => prisma.userLogin.update({ where: { id: user.id }, data: { universityId } }));
    return { user, created: false };
  }
  user = await sys(async () =>
    prisma.userLogin.create({ data: { uid, email, passwordHash, passwordChangedAt: new Date(), role, status: 'active', universityId } })
  );
  await sys(async () => prisma.userSettings.create({ data: { userId: user.id } })).catch(() => {});
  return { user, created: true };
}

async function ensureEmployee(universityId, user, { name, designation, empId, schoolId, departmentId, centralDeptId }) {
  const existing = await sys(async () => prisma.employeeDetails.findFirst({ where: { userLoginId: user.id } }));
  if (existing) return existing;
  const { firstName, lastName } = splitName(name);
  return sys(async () =>
    prisma.employeeDetails.create({
      data: {
        universityId, userLoginId: user.id, firstName, lastName, displayName: name, email: user.email,
        empId, designation, primarySchoolId: schoolId || null, primaryDepartmentId: departmentId || null, primaryCentralDeptId: centralDeptId || null, isActive: true,
      },
    })
  );
}

async function main() {
  const started = Date.now();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, parseInt(process.env.BCRYPT_ROUNDS, 10) || 10);
  const accounts = []; // for the final printout

  // ── Subscription tier ───────────────────────────────────────────────────────
  let tier = await sys(async () => prisma.saaSTier.findFirst({ orderBy: { sortOrder: 'desc' } }));
  if (!tier) {
    tier = await sys(async () =>
      prisma.saaSTier.create({
        data: { name: 'professional', displayName: 'Professional', monthlyPriceCents: 0, yearlyPriceCents: 0, maxUsers: 5000, maxApiCallsPerMonth: 1000000, maxStorageGb: 100, features: {}, isPublic: false, sortOrder: 10 },
      })
    );
  }

  // ── University ──────────────────────────────────────────────────────────────
  let uni = await sys(async () => prisma.university.findFirst({ where: { code: DEMO_CODE } }));
  if (!uni) {
    uni = await sys(async () =>
      prisma.university.create({
        data: { code: DEMO_CODE, name: 'SGT Demo University', slug: 'sgt-demo', contactEmail: `office@${DOMAIN}`, websiteUrl: 'https://example.org', city: 'Gurugram', state: 'Haryana', affiliationAliases: ['SGT Demo University', 'SGT University'], isActive: true },
      })
    );
    const start = new Date();
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    await sys(async () => prisma.universitySubscription.create({ data: { universityId: uni.id, tierId: tier.id, status: 'active', billingCycle: 'yearly', currentPeriodStart: start, currentPeriodEnd: end } }));
    console.log(`✓ University created: ${uni.name}`);
  } else {
    console.log(`• University exists: ${uni.name} (re-running fills in anything missing)`);
  }
  const U = uni.id;

  // ── Organisation ────────────────────────────────────────────────────────────
  const drd = await sys(async () =>
    prisma.centralDepartment.upsert({
      where: { universityId_departmentCode: { universityId: U, departmentCode: 'DRD' } },
      update: {},
      create: { universityId: U, departmentCode: 'DRD', departmentName: 'Director of Research and Development', shortName: 'DRD', departmentType: 'drd', isActive: true },
    })
  );
  const school = {};
  const dept = {};
  for (const s of SCHOOLS) {
    school[s.code] =
      (await sys(async () => prisma.facultySchoolList.findFirst({ where: { universityId: U, facultyCode: s.code } }))) ||
      (await sys(async () => prisma.facultySchoolList.create({ data: { universityId: U, facultyCode: s.code, facultyName: s.name, shortName: s.code, facultyType: s.type, isActive: true } })));
    for (const d of s.depts) {
      dept[d.code] =
        (await sys(async () => prisma.department.findFirst({ where: { universityId: U, departmentCode: d.code } }))) ||
        (await sys(async () => prisma.department.create({ data: { universityId: U, facultyId: school[s.code].id, departmentCode: d.code, departmentName: d.name, shortName: d.code, isActive: true } })));
    }
  }
  const schoolOf = (deptCode) => school[SCHOOLS.find((s) => s.depts.some((d) => d.code === deptCode)).code];

  const program =
    (await sys(async () => prisma.program.findFirst({ where: { universityId: U, programCode: 'BTECH-CSE' } }))) ||
    (await sys(async () => prisma.program.create({ data: { universityId: U, departmentId: dept.CSE.id, programCode: 'BTECH-CSE', programName: 'B.Tech Computer Science & Engineering', programType: 'undergraduate', durationYears: 4, durationSemesters: 8, admissionCapacity: 120, isActive: true } })));
  const section =
    (await sys(async () => prisma.section.findFirst({ where: { universityId: U, programId: program.id, sectionCode: 'A' } }))) ||
    (await sys(async () => prisma.section.create({ data: { universityId: U, programId: program.id, sectionCode: 'A', sectionName: 'Section A', academicYear: '2025-26', batchYear: 2023, semester: 5, capacity: 60 } })));

  // ── People ──────────────────────────────────────────────────────────────────
  const facultyByDept = {};
  const addFaculty = (deptCode, user) => ((facultyByDept[deptCode] = facultyByDept[deptCode] || []).push(user));
  const nameOf = {};

  // new demo accounts
  const adminAcc = await ensureUser({ uid: 'DEMO-ADMIN', email: `admin@${DOMAIN}`, role: 'admin', name: 'Demo Administrator', universityId: U, passwordHash });
  await ensureEmployee(U, adminAcc.user, { name: 'Demo Administrator', designation: 'University Administrator', empId: 'DEMO-ADMIN' });
  accounts.push({ role: 'admin', uid: 'DEMO-ADMIN', password: DEMO_PASSWORD, note: 'full access incl. Research Intelligence' });

  for (const [i, f] of FACULTY.entries()) {
    const uid = `DEMO-FAC-${String(i + 1).padStart(2, '0')}`;
    const { user } = await ensureUser({ uid, email: `${uid.toLowerCase()}@${DOMAIN}`, role: 'faculty', name: f.name, universityId: U, passwordHash });
    await ensureEmployee(U, user, { name: f.name, designation: f.designation, empId: uid, schoolId: schoolOf(f.dept).id, departmentId: dept[f.dept].id });
    addFaculty(f.dept, user);
    nameOf[user.id] = { name: f.name, designation: f.designation, dept: f.dept };
    if (i < 2) accounts.push({ role: 'faculty', uid, password: DEMO_PASSWORD, note: `${f.name}, ${f.dept}` });
  }

  for (const [i, name] of STUDENTS.entries()) {
    const uid = `DEMO-STU-${String(i + 1).padStart(2, '0')}`;
    const { user } = await ensureUser({ uid, email: `${uid.toLowerCase()}@${DOMAIN}`, role: 'student', name, universityId: U, passwordHash });
    const has = await sys(async () => prisma.studentDetails.findFirst({ where: { userLoginId: user.id } }));
    if (!has) {
      const { firstName, lastName } = splitName(name);
      await sys(async () => prisma.studentDetails.create({ data: { universityId: U, userLoginId: user.id, studentId: uid, firstName, lastName, displayName: name, email: user.email, programId: program.id, sectionId: section.id, currentSemester: 5, isActive: true } }));
    }
    if (i === 0) accounts.push({ role: 'student', uid, password: DEMO_PASSWORD, note: name });
  }

  const drdPerms = { research_review: true, research_approve: true, research_assign_school: true, applicant_analytics: true, drd_member_analytics: true };
  const drdUsers = [];
  for (const [uid, name, perms, designation] of [
    ['DEMO-DRD-01', 'Dr. Sunita Kapoor', drdPerms, 'Director, R&D'],
    ['DEMO-DRD-02', 'Mr. Deepak Arora', { research_review: true, applicant_analytics: true }, 'Research Officer'],
  ]) {
    const { user } = await ensureUser({ uid, email: `${uid.toLowerCase()}@${DOMAIN}`, role: 'staff', name, universityId: U, passwordHash });
    await ensureEmployee(U, user, { name, designation, empId: uid, centralDeptId: drd.id });
    const has = await sys(async () => prisma.centralDepartmentPermission.findFirst({ where: { userId: user.id, centralDeptId: drd.id } }));
    if (!has) await sys(async () => prisma.centralDepartmentPermission.create({ data: { universityId: U, userId: user.id, centralDeptId: drd.id, permissions: perms, isPrimary: true, isActive: true } }));
    drdUsers.push(user);
    if (uid === 'DEMO-DRD-01') accounts.push({ role: 'DRD head (staff)', uid, password: DEMO_PASSWORD, note: 'reviews & approves research' });
  }

  // existing accounts that belonged to no university
  const orphans = await sys(async () => prisma.userLogin.findMany({ where: { universityId: null, role: { in: ['admin', 'faculty', 'student', 'staff'] } } }));
  const linked = [];
  for (const o of orphans) {
    const spec = LEGACY[o.uid] || { name: o.uid, kind: o.role === 'student' ? 'student' : o.role === 'admin' ? 'admin' : o.role === 'faculty' ? 'faculty' : 'guard', dept: 'CSE' };
    await sys(async () => prisma.userLogin.update({ where: { id: o.id }, data: { universityId: U } }));
    if (spec.kind === 'student') {
      const has = await sys(async () => prisma.studentDetails.findFirst({ where: { userLoginId: o.id } }));
      if (!has) {
        const { firstName, lastName } = splitName(spec.name);
        await sys(async () => prisma.studentDetails.create({ data: { universityId: U, userLoginId: o.id, studentId: o.uid, firstName, lastName, displayName: spec.name, email: o.email, programId: program.id, sectionId: section.id, currentSemester: 5, isActive: true } }));
      }
    } else if (spec.kind === 'faculty') {
      await ensureEmployee(U, o, { name: spec.name, designation: spec.designation, empId: o.uid, schoolId: schoolOf(spec.dept).id, departmentId: dept[spec.dept].id });
      addFaculty(spec.dept, o);
      nameOf[o.id] = { name: spec.name, designation: spec.designation, dept: spec.dept };
    } else if (spec.kind === 'drd') {
      await ensureEmployee(U, o, { name: spec.name, designation: 'Research Officer', empId: o.uid, centralDeptId: drd.id });
      const has = await sys(async () => prisma.centralDepartmentPermission.findFirst({ where: { userId: o.id, centralDeptId: drd.id } }));
      if (!has) await sys(async () => prisma.centralDepartmentPermission.create({ data: { universityId: U, userId: o.id, centralDeptId: drd.id, permissions: drdPerms, isPrimary: true, isActive: true } }));
    } else {
      await ensureEmployee(U, o, { name: spec.name, designation: spec.kind === 'admin' ? 'University Administrator' : 'Security Guard', empId: o.uid });
    }
    linked.push(`${o.uid} (${o.role})`);
  }
  if (linked.length) console.log(`✓ Linked existing accounts to the demo university: ${linked.join(', ')}`);

  // ── Publications ────────────────────────────────────────────────────────────
  const already = await sys(async () => prisma.researchContribution.count({ where: { universityId: U } }));
  if (already > 0) {
    console.log(`• ${already} publications already present; skipping`);
  } else {
    const contributions = [];
    const authors = [];
    let n = 0;
    for (const [deptCode, papers] of Object.entries(PAPERS)) {
      const pool = facultyByDept[deptCode];
      const others = Object.entries(facultyByDept).filter(([k]) => k !== deptCode).flatMap(([, v]) => v);
      for (const [i, [title, kw]] of papers.entries()) {
        n += 1;
        const id = crypto.randomUUID();
        const applicant = pool[i % pool.length];
        const year = 2019 + Math.floor(rng() * 8);
        const month = year === 2026 ? Math.floor(rng() * 9) : Math.floor(rng() * 12);
        const date = new Date(Date.UTC(year, month, 1 + Math.floor(rng() * 27)));
        const q = rng();
        const quartile = q < 0.35 ? 'Q1' : q < 0.65 ? 'Q2' : q < 0.85 ? 'Q3' : 'Q4';
        const impact = { Q1: 5.5, Q2: 3.4, Q3: 2.1, Q4: 1.1 }[quartile] + rng();
        const citations = Math.floor(rng() ** 2 * 70 * ((2027 - year) / 4));
        const [k1, k2] = kw.split(';').map((s) => s.trim());
        const coInternal = [...new Set([...pool.filter((p) => p.id !== applicant.id), ...(chance(0.3) ? [pick(others)] : [])])].slice(0, 3);
        const external = chance(0.6) ? pick(EXTERNAL_COAUTHORS) : null;

        contributions.push({
          id, universityId: U, applicantUserId: applicant.id, applicantType: 'internal_faculty', publicationType: chance(0.12) ? 'conference_paper' : 'research_paper',
          title, abstract: `${title}. This study investigates ${k1} and ${k2}, reporting methodology, experimental results and implications for practice.`,
          keywords: kw, schoolId: schoolOf(deptCode).id, departmentId: dept[deptCode].id, status: chance(0.8) ? 'approved' : 'completed',
          journalName: pick(JOURNALS[deptCode]), impactFactor: Math.round(impact * 100) / 100, quartile, doi: `10.5555/demo.${n}`, indexedIn: 'Scopus',
          publicationDate: date, submittedAt: date, completedAt: date, totalAuthors: 1 + coInternal.length + (external ? 1 : 0),
          internationalAuthor: !!external?.[2], sourceType: 'manual', indexingDetails: { citationCount: citations, sourceSystems: ['scopus'] },
        });
        authors.push({ researchContributionId: id, universityId: U, userId: applicant.id, uid: null, name: nameOf[applicant.id]?.name || applicant.uid, email: applicant.email, affiliation: uni.name, department: SCHOOLS.flatMap((s) => s.depts).find((d) => d.code === deptCode).name, authorOrder: 1, authorType: 'first_and_corresponding_author', isInternal: true, designation: nameOf[applicant.id]?.designation || null });
        coInternal.forEach((c, j) =>
          authors.push({ researchContributionId: id, universityId: U, userId: c.id, uid: null, name: nameOf[c.id]?.name || c.uid, email: c.email, affiliation: uni.name, department: null, authorOrder: j + 2, authorType: 'co_author', isInternal: true, designation: nameOf[c.id]?.designation || null })
        );
        if (external) authors.push({ researchContributionId: id, universityId: U, userId: null, uid: null, name: external[0], email: null, affiliation: external[1], department: null, authorOrder: coInternal.length + 2, authorType: 'co_author', isInternal: false, isInternational: external[2] });
      }
    }
    await sys(async () => prisma.researchContribution.createMany({ data: contributions }));
    await sys(async () => prisma.researchContributionAuthor.createMany({ data: authors }));
    console.log(`✓ ${contributions.length} publications, ${authors.length} author links`);
  }

  // ── Research Intelligence ───────────────────────────────────────────────────
  const adminActor = { id: adminAcc.user.id, role: 'admin' };
  await access.setUniversityModule(adminActor, U, { enabled: true, notes: 'Demo university' });
  await tenantContext.runForTenant(U, async () => {
    const explorer = (await access.createRoleFromTemplate(adminActor, 'explorer')).role;
    const analyst = (await access.createRoleFromTemplate(adminActor, 'analyst')).role;
    const allFaculty = Object.values(facultyByDept).flat();
    for (const f of allFaculty) await access.setUserRoles(f.id, [explorer.id]);
    for (const d of drdUsers) await access.setUserRoles(d.id, [analyst.id]);
    const legacyDrd = orphans.find((o) => (LEGACY[o.uid] || {}).kind === 'drd');
    if (legacyDrd) await access.setUserRoles(legacyDrd.id, [analyst.id]);
    console.log(`✓ Research Intelligence enabled; roles "${explorer.name}" → ${allFaculty.length} faculty, "${analyst.name}" → DRD staff`);

    await taxonomy.ensureSeeded();
    const kwStats = await keywords.extractForTenant({ tenantId: U, useAi: false });
    await keywords.recomputeKeywordMetrics(U);

    // curated placement
    const cats = await prisma.ripTaxonomyCategory.findMany({ select: { id: true, name: true } });
    const catByName = new Map(cats.map((c) => [c.name, c]));
    const kws = await prisma.ripResearchKeyword.findMany({ where: { taxonomyMappings: { none: {} } }, select: { id: true, canonicalName: true } });
    const specCache = new Map();
    let placed = 0;
    const rows = [];
    for (const k of kws) {
      const rule = TAXONOMY_RULES.find(([re]) => re.test(k.canonicalName));
      const cat = rule && catByName.get(rule[1]);
      if (!cat) continue;
      let specializationId = null;
      if (rule[2]) {
        const key = `${cat.id}|${rule[2]}`;
        if (!specCache.has(key)) {
          const slug = toSlug(rule[2], 128);
          const s = (await prisma.ripTaxonomySpecialization.findFirst({ where: { categoryId: cat.id, slug } })) || (await prisma.ripTaxonomySpecialization.create({ data: { categoryId: cat.id, name: rule[2], slug, status: 'active', origin: 'manual' } }));
          specCache.set(key, s.id);
        }
        specializationId = specCache.get(key);
      }
      rows.push({ keywordId: k.id, categoryId: cat.id, specializationId, source: 'manual', confidenceScore: 1, isPrimary: true, status: 'approved' });
      placed += 1;
    }
    if (rows.length) await prisma.ripKeywordTaxonomyMapping.createMany({ data: rows, skipDuplicates: true });
    await taxonomy.recomputeTaxonomyStats(U);
    const ex = await expertise.computeForTenant(U);
    console.log(`✓ ${kwStats.keywords} keywords indexed, ${placed} placed in the taxonomy, ${ex.researchers} researcher profiles`);
  });

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\nDemo ready in ${((Date.now() - started) / 1000).toFixed(1)}s. Sign in with:\n`);
  console.table(accounts.map((a) => ({ role: a.role, username: a.uid, password: a.password, note: a.note })));
  if (linked.length) console.log(`Existing accounts now linked to "${uni.name}" keep their own passwords: ${linked.join(', ')}`);
  console.log('Superadmin accounts are unchanged. The first sign-in for each user shows the privacy-notice consent screen.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nSeed failed:', err.message);
    if (err.meta) console.error(JSON.stringify(err.meta));
    process.exit(1);
  });
