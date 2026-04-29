const analyticsService = require('./finance-analytics.service');
const loanLetterService = require('../loan-letter/loan-letter.service');

const SECTION_LOADERS = {
  summary: () => analyticsService.getSummary(),
  programBreakdown: () => analyticsService.getProgramFeeBreakdown(),
  loanLettersByProgram: () => analyticsService.getLoanLettersByProgram(),
  loanLettersBySchool: () => analyticsService.getLoanLettersBySchool(),
  loanLettersByStaff: () => analyticsService.getLoanLettersByStaff(),
  loanLetterMonthlyTrend: () => analyticsService.getLoanLetterMonthlyTrend(),
};

function parseRequestedSections(rawSections) {
  const requested = Array.isArray(rawSections)
    ? rawSections.flatMap(value => String(value).split(','))
    : String(rawSections || '').split(',');

  return [...new Set(
    requested
      .map(section => section.trim())
      .filter(section => section && SECTION_LOADERS[section])
  )];
}

exports.getSummary = async (req, res) => {
  try {
    const requestedSections = parseRequestedSections(req.query.sections);
    const sectionsToLoad = requestedSections.length > 0
      ? requestedSections
      : Object.keys(SECTION_LOADERS);

    const sectionEntries = await Promise.all(
      sectionsToLoad.map(async (section) => [section, await SECTION_LOADERS[section]()])
    );

    const data = {};
    for (const [section, value] of sectionEntries) {
      if (section === 'summary') {
        Object.assign(data, value);
      } else {
        data[section] = value;
      }
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Finance analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch finance analytics' });
  }
};

exports.getLoanLetterRegistry = async (req, res) => {
  try {
    const { page, limit, search, departmentId, programId } = req.query;
    const result = await loanLetterService.list({
      page,
      limit,
      search,
      departmentId,
      programId,
      ownOnly: false,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Finance loan letter registry error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch loan letter registry' });
  }
};

exports.getProgramLoanLetters = async (req, res) => {
  try {
    const { programId } = req.params;
    const { page, limit } = req.query;
    const result = await analyticsService.getProgramLoanLetterDetails({ programId, page, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Finance program loan-letter detail error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch programme loan letters' });
  }
};

exports.getStaffLoanLetters = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { page, limit } = req.query;
    const result = await analyticsService.getStaffLoanLetterDetails({ staffId, page, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Finance staff loan-letter detail error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch staff loan letters' });
  }
};
