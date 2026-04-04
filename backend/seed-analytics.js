/**
 * seed-analytics.js
 * Comprehensive seed script for analytics dashboard testing.
 * Creates faculty users across 3 schools/departments, then seeds:
 *   - ResearchContributions (research_paper, book, book_chapter, conference_paper)
 *   - IprApplications (patent, copyright, trademark, design)
 *   - GrantApplications (govt, non_govt, industry)
 * Data is spread across the last 12 months for monthly chart visibility.
 * Run from backend/: node seed-analytics.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Helper: date N months ago
function monthsAgo(n, dayOffset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(10, 0, 0, 0);
  return d;
}

// Sequential application number counters to avoid collisions
let researchCounter = 500;
let iprCounter = 500;
let grantCounter = 500;

function nextResearchAppNum() {
  researchCounter++;
  return `RC-SEED-${researchCounter}`;
}
function nextIprAppNum(type) {
  iprCounter++;
  const prefixes = { patent: 'PAT', copyright: 'CPR', trademark: 'TRM', design: 'DSN' };
  const pre = prefixes[type] || 'IPR';
  return `${pre}-SEED-${iprCounter}`;
}
function nextGrantAppNum() {
  grantCounter++;
  return `GR-SEED-${grantCounter}`;
}

async function main() {
  console.log('🌱 Starting analytics seed...\n');

  const password = await bcrypt.hash('Faculty@123', 10);

  // ─────────────────────────────────────────────
  // 1. Schools
  // ─────────────────────────────────────────────
  const engSchool = await prisma.facultySchoolList.upsert({
    where: { facultyCode: 'SOE' },
    update: {},
    create: {
      facultyCode: 'SOE',
      facultyName: 'School of Engineering',
      facultyType: 'engineering',
      shortName: 'Engineering',
      isActive: true,
    },
  });

  const mgtSchool = await prisma.facultySchoolList.upsert({
    where: { facultyCode: 'SOM' },
    update: {},
    create: {
      facultyCode: 'SOM',
      facultyName: 'School of Management',
      facultyType: 'management',
      shortName: 'Management',
      isActive: true,
    },
  });

  const sciSchool = await prisma.facultySchoolList.upsert({
    where: { facultyCode: 'SOS' },
    update: {},
    create: {
      facultyCode: 'SOS',
      facultyName: 'School of Sciences',
      facultyType: 'science',
      shortName: 'Sciences',
      isActive: true,
    },
  });

  console.log('✅ Schools upserted (SOE, SOM, SOS)');

  // ─────────────────────────────────────────────
  // 2. Departments
  // ─────────────────────────────────────────────
  const cseDept = await prisma.department.upsert({
    where: { departmentCode: 'SOE-CSE' },
    update: {},
    create: {
      facultyId: engSchool.id,
      departmentCode: 'SOE-CSE',
      departmentName: 'Computer Science & Engineering',
      shortName: 'CSE',
      isActive: true,
    },
  });

  const eceDept = await prisma.department.upsert({
    where: { departmentCode: 'SOE-ECE' },
    update: {},
    create: {
      facultyId: engSchool.id,
      departmentCode: 'SOE-ECE',
      departmentName: 'Electronics & Communication Engineering',
      shortName: 'ECE',
      isActive: true,
    },
  });

  const mbaDept = await prisma.department.upsert({
    where: { departmentCode: 'SOM-MBA' },
    update: {},
    create: {
      facultyId: mgtSchool.id,
      departmentCode: 'SOM-MBA',
      departmentName: 'Master of Business Administration',
      shortName: 'MBA',
      isActive: true,
    },
  });

  const mktDept = await prisma.department.upsert({
    where: { departmentCode: 'SOM-MKT' },
    update: {},
    create: {
      facultyId: mgtSchool.id,
      departmentCode: 'SOM-MKT',
      departmentName: 'Marketing Management',
      shortName: 'Marketing',
      isActive: true,
    },
  });

  const phyDept = await prisma.department.upsert({
    where: { departmentCode: 'SOS-PHY' },
    update: {},
    create: {
      facultyId: sciSchool.id,
      departmentCode: 'SOS-PHY',
      departmentName: 'Department of Physics',
      shortName: 'Physics',
      isActive: true,
    },
  });

  const chemDept = await prisma.department.upsert({
    where: { departmentCode: 'SOS-CHEM' },
    update: {},
    create: {
      facultyId: sciSchool.id,
      departmentCode: 'SOS-CHEM',
      departmentName: 'Department of Chemistry',
      shortName: 'Chemistry',
      isActive: true,
    },
  });

  console.log('✅ Departments upserted (CSE, ECE, MBA, MKT, PHY, CHEM)');

  // ─────────────────────────────────────────────
  // 3. Faculty Users
  // ─────────────────────────────────────────────
  const users = [
    {
      uid: 'FA-SEED-001', email: 'amit.sharma@sgtuniversity.ac.in',
      firstName: 'Amit', lastName: 'Sharma', displayName: 'Dr. Amit Sharma',
      empId: 'EMP-SEED-001', designation: 'Associate Professor',
      schoolId: engSchool.id, deptId: cseDept.id,
    },
    {
      uid: 'FA-SEED-002', email: 'priya.singh@sgtuniversity.ac.in',
      firstName: 'Priya', lastName: 'Singh', displayName: 'Dr. Priya Singh',
      empId: 'EMP-SEED-002', designation: 'Assistant Professor',
      schoolId: engSchool.id, deptId: eceDept.id,
    },
    {
      uid: 'FA-SEED-003', email: 'rahul.gupta@sgtuniversity.ac.in',
      firstName: 'Rahul', lastName: 'Gupta', displayName: 'Dr. Rahul Gupta',
      empId: 'EMP-SEED-003', designation: 'Professor',
      schoolId: mgtSchool.id, deptId: mbaDept.id,
    },
    {
      uid: 'FA-SEED-004', email: 'sneha.patel@sgtuniversity.ac.in',
      firstName: 'Sneha', lastName: 'Patel', displayName: 'Dr. Sneha Patel',
      empId: 'EMP-SEED-004', designation: 'Associate Professor',
      schoolId: mgtSchool.id, deptId: mktDept.id,
    },
    {
      uid: 'FA-SEED-005', email: 'vikram.rao@sgtuniversity.ac.in',
      firstName: 'Vikram', lastName: 'Rao', displayName: 'Dr. Vikram Rao',
      empId: 'EMP-SEED-005', designation: 'Professor',
      schoolId: sciSchool.id, deptId: phyDept.id,
    },
    {
      uid: 'FA-SEED-006', email: 'kavita.mehta@sgtuniversity.ac.in',
      firstName: 'Kavita', lastName: 'Mehta', displayName: 'Dr. Kavita Mehta',
      empId: 'EMP-SEED-006', designation: 'Assistant Professor',
      schoolId: sciSchool.id, deptId: chemDept.id,
    },
  ];

  const createdUsers = [];
  for (const u of users) {
    const user = await prisma.userLogin.upsert({
      where: { uid: u.uid },
      update: {},
      create: {
        uid: u.uid,
        email: u.email,
        passwordHash: password,
        role: 'faculty',
        employeeDetails: {
          create: {
            empId: u.empId,
            firstName: u.firstName,
            lastName: u.lastName,
            displayName: u.displayName,
            designation: u.designation,
            primarySchoolId: u.schoolId,
            primaryDepartmentId: u.deptId,
            isActive: true,
          },
        },
      },
    });
    createdUsers.push({ ...user, schoolId: u.schoolId, deptId: u.deptId });
  }

  const [u1, u2, u3, u4, u5, u6] = createdUsers;
  console.log('✅ 6 Faculty users upserted');

  // ─────────────────────────────────────────────
  // 4. Research Contributions — research_paper
  // ─────────────────────────────────────────────
  const researchPapers = [
    {
      user: u1, mo: 11, indexing: ['SCI'], journal: 'IEEE Transactions on Neural Networks',
      status: 'approved', completedOffset: 10,
    },
    {
      user: u2, mo: 10, indexing: ['Scopus'], journal: 'Elsevier Journal of Signal Processing',
      status: 'submitted',
    },
    {
      user: u3, mo: 9, indexing: ['WoS'], journal: 'Taylor & Francis Review of Business Studies',
      status: 'approved', completedOffset: 8,
    },
    {
      user: u4, mo: 8, indexing: ['Scopus', 'WoS'], journal: 'Springer Marketing Intelligence & Planning',
      status: 'submitted',
    },
    {
      user: u5, mo: 7, indexing: ['SCI', 'WoS'], journal: 'Elsevier Physical Review B',
      status: 'approved', completedOffset: 7,
    },
    {
      user: u6, mo: 6, indexing: ['Scopus'], journal: 'RSC Advances — Chemistry',
      status: 'submitted',
    },
    {
      user: u1, mo: 5, indexing: ['SCI'], journal: 'ACM Computing Surveys',
      status: 'approved', completedOffset: 5,
    },
    {
      user: u2, mo: 4, indexing: ['Scopus'], journal: 'IET Communications',
      status: 'submitted',
    },
    {
      user: u5, mo: 3, indexing: ['WoS', 'SCI'], journal: 'Physical Chemistry Chemical Physics',
      status: 'approved', completedOffset: 2,
    },
    {
      user: u3, mo: 2, indexing: ['Scopus'], journal: 'Journal of Business Ethics',
      status: 'submitted',
    },
    {
      user: u6, mo: 1, indexing: ['SCI'], journal: 'Journal of Organic Chemistry',
      status: 'submitted',
    },
    {
      user: u4, mo: 0, indexing: ['Scopus'], journal: 'International Journal of Research in Marketing',
      status: 'submitted',
    },
  ];

  for (const rp of researchPapers) {
    const submittedAt = monthsAgo(rp.mo, 3);
    const completedAt = rp.completedOffset ? monthsAgo(rp.mo - 0, rp.completedOffset * -1 + 3) : null;
    await prisma.researchContribution.create({
      data: {
        applicationNumber: nextResearchAppNum(),
        applicantUserId: rp.user.id,
        applicantType: 'internal_faculty',
        publicationType: 'research_paper',
        title: `Research on ${rp.journal} — ${rp.mo}M`,
        abstract: 'This study presents novel findings in the domain relevant to the journal.',
        schoolId: rp.user.schoolId,
        departmentId: rp.user.deptId,
        status: rp.status,
        submittedAt,
        completedAt: rp.status === 'approved' ? (completedAt || monthsAgo(rp.mo - 1)) : null,
        journalName: rp.journal,
        indexingCategories: rp.indexing,
        internationalAuthor: rp.indexing.includes('SCI'),
        foreignCollaborationsCount: rp.indexing.includes('SCI') ? 1 : 0,
        impactFactor: rp.indexing.includes('SCI') ? 3.5 : 1.8,
        totalAuthors: 3,
        sgtAffiliatedAuthors: 2,
        incentiveAmount: rp.status === 'approved' ? 25000 : null,
        communicatedWithOfficialId: true,
        interdisciplinaryFromSgt: false,
      },
    });
  }
  console.log(`✅ ${researchPapers.length} research_paper records created`);

  // ─────────────────────────────────────────────
  // 5. Research Contributions — book
  // ─────────────────────────────────────────────
  const books = [
    { user: u1, mo: 11, pubType: 'authored', title: 'Machine Learning for Engineers', publisher: 'Springer', status: 'submitted' },
    { user: u3, mo: 9, pubType: 'edited', title: 'Contemporary Management Practices', publisher: 'Pearson', status: 'approved' },
    { user: u5, mo: 7, pubType: 'authored', title: 'Quantum Mechanics and Applications', publisher: 'Cambridge University Press', status: 'submitted' },
    { user: u2, mo: 5, pubType: 'authored', title: 'Signal Processing Fundamentals', publisher: 'McGraw-Hill', status: 'approved' },
    { user: u6, mo: 3, pubType: 'edited', title: 'Green Chemistry Approaches', publisher: 'Wiley', status: 'submitted' },
    { user: u4, mo: 1, pubType: 'authored', title: 'Digital Marketing Strategy', publisher: 'Oxford Press', status: 'submitted' },
  ];

  for (const b of books) {
    const submittedAt = monthsAgo(b.mo, 5);
    await prisma.researchContribution.create({
      data: {
        applicationNumber: nextResearchAppNum(),
        applicantUserId: b.user.id,
        applicantType: 'internal_faculty',
        publicationType: 'book',
        title: b.title,
        abstract: 'A comprehensive textbook covering fundamental and advanced topics.',
        schoolId: b.user.schoolId,
        departmentId: b.user.deptId,
        status: b.status,
        submittedAt,
        completedAt: b.status === 'approved' ? monthsAgo(b.mo - 1) : null,
        publisherName: b.publisher,
        bookPublicationType: b.pubType,
        internationalAuthor: false,
        foreignCollaborationsCount: 0,
        incentiveAmount: b.status === 'approved' ? 30000 : null,
        communicatedWithOfficialId: true,
        interdisciplinaryFromSgt: false,
      },
    });
  }
  console.log(`✅ ${books.length} book records created`);

  // ─────────────────────────────────────────────
  // 6. Research Contributions — book_chapter
  // ─────────────────────────────────────────────
  const bookChapters = [
    { user: u1, mo: 10, bookTitle: 'Advances in AI & ML', chapterTitle: 'Deep Learning in Computer Vision', publisher: 'Springer', status: 'submitted' },
    { user: u2, mo: 8, bookTitle: 'Modern Communication Systems', chapterTitle: 'OFDM Techniques for 5G', publisher: 'IEEE Press', status: 'approved' },
    { user: u3, mo: 6, bookTitle: 'Strategic Management Handbook', chapterTitle: 'Blue Ocean Strategy in Emerging Markets', publisher: 'Pearson', status: 'submitted' },
    { user: u5, mo: 4, bookTitle: 'Physics of Nanomaterials', chapterTitle: 'Optical Properties of Quantum Dots', publisher: 'Elsevier', status: 'approved' },
    { user: u6, mo: 2, bookTitle: 'Environmental Chemistry', chapterTitle: 'Heavy Metal Remediation Techniques', publisher: 'Wiley', status: 'submitted' },
    { user: u4, mo: 0, bookTitle: 'Consumer Behaviour Studies', chapterTitle: 'Digital Influence on Purchase Decisions', publisher: 'Routledge', status: 'submitted' },
  ];

  for (const bc of bookChapters) {
    const submittedAt = monthsAgo(bc.mo, 7);
    await prisma.researchContribution.create({
      data: {
        applicationNumber: nextResearchAppNum(),
        applicantUserId: bc.user.id,
        applicantType: 'internal_faculty',
        publicationType: 'book_chapter',
        title: bc.chapterTitle,
        abstract: `A chapter contribution to: ${bc.bookTitle}`,
        schoolId: bc.user.schoolId,
        departmentId: bc.user.deptId,
        status: bc.status,
        submittedAt,
        completedAt: bc.status === 'approved' ? monthsAgo(bc.mo - 1) : null,
        bookTitle: bc.bookTitle,
        publisherName: bc.publisher,
        bookPublicationType: 'chapter',
        internationalAuthor: false,
        foreignCollaborationsCount: 0,
        incentiveAmount: bc.status === 'approved' ? 15000 : null,
        communicatedWithOfficialId: true,
        interdisciplinaryFromSgt: false,
      },
    });
  }
  console.log(`✅ ${bookChapters.length} book_chapter records created`);

  // ─────────────────────────────────────────────
  // 7. Research Contributions — conference_paper
  // ─────────────────────────────────────────────
  const conferencePapers = [
    { user: u1, mo: 11, type: 'international', conf: 'IEEE International Conference on AI', loc: 'Singapore', status: 'approved' },
    { user: u2, mo: 10, type: 'national', conf: 'National Conference on Signal Processing', loc: 'Delhi', status: 'submitted' },
    { user: u3, mo: 9, type: 'international', conf: 'International Business Strategy Summit', loc: 'London', status: 'submitted' },
    { user: u5, mo: 8, type: 'national', conf: 'Indian Physics Conference', loc: 'Bangalore', status: 'approved' },
    { user: u6, mo: 7, type: 'international', conf: 'International Chemistry Symposium', loc: 'Tokyo', status: 'submitted' },
    { user: u4, mo: 6, type: 'national', conf: 'National Marketing Conference', loc: 'Mumbai', status: 'submitted' },
    { user: u1, mo: 5, type: 'international', conf: 'ACM Conference on Computing Systems', loc: 'New York', status: 'approved' },
    { user: u2, mo: 3, type: 'international', conf: 'Wireless Communications & Networking', loc: 'Dubai', status: 'submitted' },
  ];

  for (const cp of conferencePapers) {
    const submittedAt = monthsAgo(cp.mo, 2);
    await prisma.researchContribution.create({
      data: {
        applicationNumber: nextResearchAppNum(),
        applicantUserId: cp.user.id,
        applicantType: 'internal_faculty',
        publicationType: 'conference_paper',
        title: `Paper presented at ${cp.conf}`,
        abstract: 'This conference paper presents original research findings.',
        schoolId: cp.user.schoolId,
        departmentId: cp.user.deptId,
        status: cp.status,
        submittedAt,
        completedAt: cp.status === 'approved' ? monthsAgo(cp.mo - 1) : null,
        conferenceName: cp.conf,
        conferenceLocation: cp.loc,
        conferenceType: cp.type,
        internationalAuthor: cp.type === 'international',
        foreignCollaborationsCount: cp.type === 'international' ? 1 : 0,
        incentiveAmount: cp.status === 'approved' ? (cp.type === 'international' ? 20000 : 10000) : null,
        communicatedWithOfficialId: true,
        interdisciplinaryFromSgt: false,
      },
    });
  }
  console.log(`✅ ${conferencePapers.length} conference_paper records created`);

  // ─────────────────────────────────────────────
  // 8. IPR Applications
  // ─────────────────────────────────────────────
  const iprData = [
    {
      user: u1, iprType: 'patent', projectType: 'faculty_research', filingType: 'provisional', mo: 11,
      title: 'Smart Energy Management System Using IoT',
      description: 'A novel IoT-based system for real-time energy monitoring and optimization in buildings.',
      status: 'submitted',
    },
    {
      user: u2, iprType: 'patent', projectType: 'industry_collaboration', filingType: 'complete', mo: 9,
      title: 'Adaptive Beamforming Algorithm for 5G Networks',
      description: 'An efficient beamforming algorithm significantly improving 5G signal quality.',
      status: 'finance_approved',
    },
    {
      user: u3, iprType: 'copyright', projectType: 'faculty_research', filingType: 'complete', mo: 8,
      title: 'Business Analytics Course Material — Advanced Module',
      description: 'Comprehensive copyrighted educational material for business analytics training.',
      status: 'submitted',
    },
    {
      user: u5, iprType: 'patent', projectType: 'phd', filingType: 'provisional', mo: 7,
      title: 'Nano-Photonic Device for Optical Data Transmission',
      description: 'A photonic nanostructure enabling ultra-high-speed optical fiber data transmission.',
      status: 'submitted',
    },
    {
      user: u6, iprType: 'trademark', projectType: 'faculty_research', filingType: 'complete', mo: 5,
      title: 'GreenChem™ — Eco-Friendly Chemical Brand',
      description: 'Trademark registration for a branded line of environmentally safe chemical compounds.',
      status: 'finance_approved',
    },
    {
      user: u4, iprType: 'copyright', projectType: 'faculty_research', filingType: 'complete', mo: 4,
      title: 'Digital Marketing Playbook 2025',
      description: 'An original copyrighted guide for digital marketing strategy in emerging markets.',
      status: 'submitted',
    },
    {
      user: u1, iprType: 'design', projectType: 'ug_project', filingType: 'provisional', mo: 2,
      title: 'Ergonomic Wearable Device Design',
      description: 'Industrial design registration for a wearable health-monitoring device.',
      status: 'submitted',
    },
    {
      user: u5, iprType: 'trademark', projectType: 'industry_collaboration', filingType: 'complete', mo: 1,
      title: 'QuantumSense™ Sensor Brand',
      description: 'Trademark for high-precision quantum sensor product line.',
      status: 'submitted',
    },
  ];

  for (const ipr of iprData) {
    const submittedAt = monthsAgo(ipr.mo, 4);
    await prisma.iprApplication.create({
      data: {
        applicationNumber: nextIprAppNum(ipr.iprType),
        applicantUserId: ipr.user.id,
        applicantType: 'internal_faculty',
        iprType: ipr.iprType,
        projectType: ipr.projectType,
        filingType: ipr.filingType,
        title: ipr.title,
        description: ipr.description,
        schoolId: ipr.user.schoolId,
        departmentId: ipr.user.deptId,
        status: ipr.status,
        submittedAt,
        completedAt: ['finance_approved', 'completed'].includes(ipr.status) ? monthsAgo(ipr.mo - 1) : null,
        incentiveAmount: ['finance_approved', 'completed'].includes(ipr.status) ? 50000 : null,
      },
    });
  }
  console.log(`✅ ${iprData.length} IPR applications created`);

  // ─────────────────────────────────────────────
  // 9. Grant Applications
  // ─────────────────────────────────────────────
  const grantsData = [
    {
      user: u1, category: 'govt', projectType: 'indian', agency: 'dst', agencyName: 'Department of Science & Technology',
      title: 'AI-Based Predictive Models for Climate Change', mo: 11, status: 'submitted', projectStatus: 'submitted',
    },
    {
      user: u5, category: 'govt', projectType: 'international', agency: 'anrf', agencyName: 'Anusandhan National Research Foundation',
      title: 'Quantum Computing Applications in Material Science', mo: 9, status: 'approved', projectStatus: 'approved',
    },
    {
      user: u6, category: 'govt', projectType: 'indian', agency: 'dbt', agencyName: 'Department of Biotechnology',
      title: 'Green Synthesis of Nanoparticles for Drug Delivery', mo: 7, status: 'submitted', projectStatus: 'submitted',
    },
    {
      user: u3, category: 'non_govt', projectType: 'indian', agency: 'other', agencyName: 'Tata Trusts',
      title: 'Entrepreneurship Development Program for Rural Youth', mo: 6, status: 'approved', projectStatus: 'approved',
    },
    {
      user: u4, category: 'non_govt', projectType: 'indian', agency: 'other', agencyName: 'Gates Foundation India',
      title: 'Digital Literacy and Skill Building Initiative', mo: 4, status: 'submitted', projectStatus: 'submitted',
    },
    {
      user: u2, category: 'industry', projectType: 'indian', agency: 'other', agencyName: 'Qualcomm India Research',
      title: 'Next-Generation mmWave Antenna Design for 6G', mo: 3, status: 'approved', projectStatus: 'approved',
    },
    {
      user: u1, category: 'govt', projectType: 'indian', agency: 'csir', agencyName: 'Council of Scientific & Industrial Research',
      title: 'Explainable AI for Healthcare Diagnostics', mo: 2, status: 'submitted', projectStatus: 'submitted',
    },
    {
      user: u5, category: 'industry', projectType: 'international', agency: 'other', agencyName: 'Samsung Global Research',
      title: 'Novel Semiconductor Materials for Next-Gen Displays', mo: 1, status: 'submitted', projectStatus: 'submitted',
    },
  ];

  for (const g of grantsData) {
    const submittedAt = monthsAgo(g.mo, 6);
    await prisma.grantApplication.create({
      data: {
        applicationNumber: nextGrantAppNum(),
        applicantUserId: g.user.id,
        applicantType: 'internal_faculty',
        title: g.title,
        projectCategory: g.category,
        projectType: g.projectType,
        projectStatus: g.projectStatus,
        fundingAgencyType: g.agency,
        fundingAgencyName: g.agencyName,
        submittedAmount: 1500000 + Math.floor(Math.random() * 3500000),
        schoolId: g.user.schoolId,
        departmentId: g.user.deptId,
        status: g.status,
        submittedAt,
        completedAt: g.status === 'approved' ? monthsAgo(g.mo - 1) : null,
        approvedAt: g.status === 'approved' ? monthsAgo(g.mo - 1) : null,
        totalInvestigators: 2,
        numberOfInternalPIs: 1,
        numberOfInternalCoPIs: 1,
        myRole: 'pi',
        sdgGoals: ['SDG4', 'SDG9'],
        incentiveAmount: g.status === 'approved' ? 100000 : null,
      },
    });
  }
  console.log(`✅ ${grantsData.length} grant applications created`);

  // ─────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────
  const [rc, ipr, ga] = await Promise.all([
    prisma.researchContribution.count(),
    prisma.iprApplication.count(),
    prisma.grantApplication.count(),
  ]);

  console.log('\n─────────────────────────────────');
  console.log('📊 Database totals after seed:');
  console.log(`   ResearchContributions : ${rc}`);
  console.log(`   IprApplications       : ${ipr}`);
  console.log(`   GrantApplications     : ${ga}`);
  console.log('─────────────────────────────────');
  console.log('\n🎉 Analytics seed complete!');
  console.log('\n👤 Seeded faculty login credentials (all same password):');
  console.log('   UID: FA-SEED-001  →  Dr. Amit Sharma   (CSE, Engineering)');
  console.log('   UID: FA-SEED-002  →  Dr. Priya Singh    (ECE, Engineering)');
  console.log('   UID: FA-SEED-003  →  Dr. Rahul Gupta    (MBA, Management)');
  console.log('   UID: FA-SEED-004  →  Dr. Sneha Patel    (Marketing, Management)');
  console.log('   UID: FA-SEED-005  →  Dr. Vikram Rao     (Physics, Sciences)');
  console.log('   UID: FA-SEED-006  →  Dr. Kavita Mehta   (Chemistry, Sciences)');
  console.log('   Password: Faculty@123');
  console.log('\n⚠️  Remember to clear analytics cache: node clear-analytics-cache.js');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
