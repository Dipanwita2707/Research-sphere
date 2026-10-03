/**
 * @module reports/services/reportData
 * @description Prisma loaders for accreditation reports. Every query runs in the request's
 * tenant context (the Prisma tenant extension scopes it), so these never filter by university.
 * Loaders return raw rows; all bucketing/counting lives in aggregations.js (pure, unit-tested).
 */
const prisma = require('../../../shared/config/database');
const { rangeBounds } = require('../utils/period');

const COUNTED_RESEARCH_STATUSES = ['approved', 'completed'];
const COUNTED_GRANT_STATUSES = ['approved', 'completed'];
const PUBLICATION_TYPES = ['research_paper', 'book', 'book_chapter', 'conference_paper'];

const contributionSelect = {
  id: true,
  applicationNumber: true,
  publicationType: true,
  status: true,
  title: true,
  journalName: true,
  issn: true,
  isbn: true,
  doi: true,
  paperDoi: true,
  weblink: true,
  paperweblink: true,
  publicationDate: true,
  conferenceDate: true,
  indexingCategories: true,
  indexedIn: true,
  indexingDetails: true,
  sourceSystems: true,
  quartile: true,
  ugcCareListed: true,
  ugcCareGroup: true,
  bookTitle: true,
  publisherName: true,
  bookPublicationType: true,
  nationalInternational: true,
  conferenceName: true,
  conferenceSubType: true,
  conferenceType: true,
  proceedingsTitle: true,
  issnIsbnIssueNo: true,
  applicantUserId: true,
  department: { select: { departmentName: true } },
  school: { select: { facultyName: true } },
  authors: {
    select: { name: true, userId: true, isInternal: true, authorType: true, authorOrder: true, affiliation: true },
    orderBy: { authorOrder: 'asc' },
  },
};

/** University name/code for the current tenant (University itself is not tenant-scoped). */
const loadUniversity = (universityId) =>
  prisma.university.findUnique({ where: { id: universityId }, select: { id: true, name: true, code: true } });

/** Faculty accounts with their employee record (= teachers for NAAC/NIRF). */
const loadTeachers = async () => {
  const rows = await prisma.employeeDetails.findMany({
    where: { userLoginId: { not: null }, userLogin: { is: { role: 'faculty' } } },
    select: {
      userLoginId: true,
      empId: true,
      firstName: true,
      lastName: true,
      displayName: true,
      designation: true,
      isActive: true,
      joinDate: true,
      primaryDepartment: { select: { departmentName: true } },
      primarySchool: { select: { facultyName: true } },
    },
  });
  return rows.map((r) => ({
    userId: r.userLoginId,
    empId: r.empId || '',
    name: (r.displayName || [r.firstName, r.lastName].filter(Boolean).join(' ')).trim() || r.empId || 'Unnamed',
    designation: r.designation || '',
    department: r.primaryDepartment?.departmentName || '',
    school: r.primarySchool?.facultyName || '',
    isActive: r.isActive !== false,
    joinDate: r.joinDate || null,
  }));
};

/**
 * Approved/completed publications whose publication date (or, for conference papers with no
 * publication date, conference date) falls in the window. Also counts approved records with no
 * usable date at all, which cannot be placed in any year.
 */
const loadContributions = async ({ start, end }) => {
  const base = { status: { in: COUNTED_RESEARCH_STATUSES }, publicationType: { in: PUBLICATION_TYPES } };
  const [rows, undated] = await Promise.all([
    prisma.researchContribution.findMany({
      where: {
        ...base,
        OR: [
          { publicationDate: { gte: start, lt: end } },
          { publicationDate: null, conferenceDate: { gte: start, lt: end } },
        ],
      },
      select: contributionSelect,
      orderBy: [{ publicationDate: 'asc' }, { title: 'asc' }],
    }),
    prisma.researchContribution.count({ where: { ...base, publicationDate: null, conferenceDate: null } }),
  ]);
  return { rows, undated };
};

/** DRD-approved grant records with investigators and fund receipts (filtered by year in JS). */
const loadGrants = () =>
  prisma.grantApplication.findMany({
    where: { status: { in: COUNTED_GRANT_STATUSES } },
    select: {
      id: true,
      applicationNumber: true,
      title: true,
      status: true,
      projectStatus: true,
      projectCategory: true,
      projectType: true,
      fundingAgencyType: true,
      fundingAgencyName: true,
      submittedAmount: true,
      sanctionedAmount: true,
      sanctionDate: true,
      sanctionOrderNumber: true,
      projectStartDate: true,
      projectEndDate: true,
      projectDurationMonths: true,
      approvedAt: true,
      department: { select: { departmentName: true } },
      applicantUser: { select: { id: true, employeeDetails: { select: { displayName: true, firstName: true, lastName: true } } } },
      investigators: {
        select: { name: true, userId: true, roleType: true, isInternal: true, department: true, displayOrder: true },
        orderBy: { displayOrder: 'asc' },
      },
      fundReceipts: { select: { amount: true, receivedDate: true, financialYear: true }, orderBy: { receivedDate: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  });

/** Patent records past draft (filing/publication/grant counted from their own dates). */
const loadPatents = () =>
  prisma.iprApplication.findMany({
    where: { iprType: 'patent', status: { notIn: ['draft', 'cancelled'] } },
    select: {
      id: true,
      title: true,
      status: true,
      filingType: true,
      govtApplicationId: true,
      govtFilingDate: true,
      publicationDate: true,
      publicationId: true,
      grantedAt: true,
      patentNumber: true,
    },
  });

/** Students on doctoral programmes. */
const loadPhdStudents = () =>
  prisma.studentDetails.findMany({
    where: { program: { is: { programType: 'doctoral' } } },
    select: {
      id: true,
      isActive: true,
      admissionDate: true,
      phdRegistrationDate: true,
      phdAwardedAt: true,
      thesisTitle: true,
      mentorId: true,
    },
  });

/** Citation coverage from researcher expertise profiles (h-index / total citations). */
const loadExpertiseTotals = async () => {
  const agg = await prisma.ripResearcherExpertiseProfile.aggregate({
    _sum: { totalCitations: true },
    _count: { _all: true },
  });
  return { profiles: agg._count?._all || 0, totalCitations: agg._sum?.totalCitations || 0 };
};

/** Window helper: the widest span any section of a report needs. */
const windowFor = (fromYear, toYear) => {
  const cal = rangeBounds(fromYear, toYear, 'calendar');
  const fy = rangeBounds(fromYear, toYear, 'financial');
  return { start: cal.start < fy.start ? cal.start : fy.start, end: cal.end > fy.end ? cal.end : fy.end };
};

module.exports = {
  COUNTED_RESEARCH_STATUSES,
  COUNTED_GRANT_STATUSES,
  loadUniversity,
  loadTeachers,
  loadContributions,
  loadGrants,
  loadPatents,
  loadPhdStudents,
  loadExpertiseTotals,
  windowFor,
};
