/**
 * Field allowlists for writes that take their keys from a request (mass-assignment guard).
 * Shared by contribution.service (applicant edits) and review.service (accepted edit suggestions).
 */

/**
 * Fields an applicant may change on their own contribution (draft / changes_required /
 * resubmitted). Mirrors the publication fields the create path takes from the form.
 * Everything else — status, incentive/points amounts, crediting, reviewer/workflow state,
 * application number, ownership, tenant, file paths and import provenance — is set by the
 * server only. Unknown keys are dropped.
 */
const APPLICANT_EDITABLE_FIELDS = new Set([
  'title', 'abstract', 'keywords', 'publicationType',
  'indexingCategories', 'internationalAuthor', 'foreignCollaborationsCount',
  'impactFactor', 'quartile', 'sjr', 'naasRating', 'subsidiaryImpactFactor',
  'interdisciplinaryFromSgt', 'studentsFromSgt',
  'journalName', 'totalAuthors', 'sgtAffiliatedAuthors', 'internalCoAuthors',
  'volume', 'issue', 'pageNumbers', 'doi', 'issn', 'publisherName',
  'isbn', 'edition', 'chapterNumber', 'bookTitle', 'editors', 'publisherLocation',
  'nationalInternational', 'bookPublicationType', 'bookIndexingType', 'bookLetter',
  'communicatedWithOfficialId', 'personalEmail', 'facultyRemarks',
  'conferenceName', 'conferenceLocation', 'conferenceDate', 'proceedingsTitle',
  'conferenceSubType', 'proceedingsQuartile', 'totalPresenters', 'isPresenter',
  'virtualConference', 'fullPaper', 'conferenceHeldAtSgt', 'conferenceBestPaperAward',
  'industryCollaboration', 'centralFacilityUsed', 'issnIsbnIssueNo', 'paperDoi',
  'weblink', 'paperweblink', 'priorityFundingArea', 'conferenceRole', 'indexedIn',
  'conferenceHeldLocation', 'venue', 'topic', 'attendedVirtual', 'eventCategory',
  'organizerRole', 'conferenceType',
  'fundingAgency', 'proposalType', 'requestedAmount', 'projectDurationMonths',
  'projectStartDate', 'projectEndDate',
  'publicationDate', 'publicationStatus', 'indexingDetails',
  'sdgGoals', 'sdg_goals',
  // UGC-CARE listing (journal papers); normalised by utils/ugcCare before it is written
  'ugcCareListed', 'ugcCareGroup',
]);

/** Applicant-details fields the applicant may change (same set the create path writes). */
const APPLICANT_DETAILS_EDITABLE_FIELDS = new Set([
  'employeeCategory', 'employeeType', 'uid', 'email', 'phone', 'universityDeptName',
  'mentorName', 'mentorUid', 'isPhdWork', 'phdTitle', 'phdObjectives', 'coveredObjectives',
  'addressesSocietal', 'addressesGovernment', 'addressesEnvironmental', 'addressesIndustrial',
  'addressesBusiness', 'addressesConceptual', 'enrichesDiscipline', 'isNewsworthy', 'metadata',
]);

/**
 * Author fields the applicant may change through PUT /:id/authors/:authorId. Identity
 * (userId, uid, registrationNo), incentive shares and access flags are not editable here.
 */
const AUTHOR_EDITABLE_FIELDS = new Set([
  'name', 'email', 'phone', 'affiliation', 'department', 'designation',
  'authorOrder', 'authorPosition', 'isCorresponding', 'authorCategory', 'scopusAuthorId',
  'isPhdWork', 'phdTitle', 'phdObjectives', 'coveredObjectives',
  'addressesSocietal', 'addressesGovernment', 'addressesEnvironmental', 'addressesIndustrial',
  'addressesBusiness', 'addressesConceptual', 'isNewsworthy',
]);

/** Copy only allowlisted own keys of `source` (undefined values skipped). */
const pickAllowed = (source, allowed) => {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  for (const key of Object.keys(source)) {
    if (allowed.has(key) && source[key] !== undefined) out[key] = source[key];
  }
  return out;
};

/**
 * IPR application columns that reviewer/mentor edit suggestions (and accept-edits-and-resubmit)
 * may change. Status, incentive, applicant and mentor-identity columns are never writable this way.
 */
const IPR_EDITABLE_FIELDS = new Set(['title', 'description', 'remarks', 'iprType', 'projectType', 'filingType']);

module.exports = {
  APPLICANT_EDITABLE_FIELDS,
  IPR_EDITABLE_FIELDS,
  APPLICANT_DETAILS_EDITABLE_FIELDS,
  AUTHOR_EDITABLE_FIELDS,
  pickAllowed,
};
