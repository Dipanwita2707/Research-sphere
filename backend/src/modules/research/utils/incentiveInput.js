/**
 * Normalise contribution data for IncentiveCalculator.
 *
 * Accepts either a submission payload (form field names) or a stored ResearchContribution
 * row (database column names) and returns the field names the calculator reads. Submission
 * and DRD approval both go through here, so the amount an author is shown when submitting
 * is the amount finance later pays.
 */
const yes = (v) => v === true || v === 'yes' || v === 'true';

function toIncentiveInput(source = {}) {
  const indexingCategories = source.indexingCategories || [];
  const impactFactor = source.impactFactor != null && source.impactFactor !== '' ? Number(source.impactFactor) : null;
  const subsidiaryIF = source.subsidiaryImpactFactor ||
    (indexingCategories.includes('subsidiary_if_above_20') ? impactFactor : null);
  const nationalInternational = source.nationalInternational || null;

  return {
    publicationDate: source.publicationDate,
    quartile: source.quartile,
    conferenceSubType: source.conferenceSubType,
    proceedingsQuartile: source.proceedingsQuartile,
    // Books / chapters: stored as bookPublicationType + bookIndexingType.
    bookType: source.bookType || source.bookPublicationType || null,
    indexing: source.indexing || source.bookIndexingType || null,
    indexingCategories,
    impactFactor,
    sjr: Number(source.sjr) || 0,
    naasRating: source.naasRating ? Number(source.naasRating) : null,
    subsidiaryImpactFactor: subsidiaryIF ? Number(subsidiaryIF) : null,
    conferenceType: source.conferenceType,
    conferenceHeldLocation: source.conferenceHeldLocation,
    nationalInternational,
    // Stored as Boolean, submitted as 'yes'/'no'; the calculator compares with 'yes'.
    conferenceBestPaperAward: yes(source.conferenceBestPaperAward) ? 'yes' : 'no',
    isInternational: yes(source.isInternational) || nationalInternational === 'international',
  };
}

module.exports = { toIncentiveInput };
