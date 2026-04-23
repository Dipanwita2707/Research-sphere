const loanLetterService = require('./loan-letter.service');

/**
 * Create a new loan letter
 */
exports.create = async (req, res) => {
  try {
    const { applicationNumber, studentEmail, studentPhone, studentName, relationPrefix, relationName, programId, specializationId, selectedSemesters, transportIncluded, hostelIncluded } = req.body;

    if (!applicationNumber || !studentName || !relationPrefix || !relationName || !programId) {
      return res.status(400).json({ success: false, message: 'applicationNumber, studentName, relationPrefix, relationName, and programId are required' });
    }
    if (!Array.isArray(selectedSemesters) || selectedSemesters.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one semester must be selected' });
    }
    const validPrefixes = ['Son of', 'Daughter of', 'Ward of'];
    if (!validPrefixes.includes(relationPrefix)) {
      return res.status(400).json({ success: false, message: 'relationPrefix must be one of: Son of, Daughter of, Ward of' });
    }

    const data = await loanLetterService.create({
      applicationNumber,
      studentEmail: studentEmail || null,
      studentPhone: studentPhone || null,
      studentName,
      relationPrefix,
      relationName,
      programId,
      specializationId: specializationId || null,
      selectedSemesters,
      transportIncluded: transportIncluded || false,
      hostelIncluded: hostelIncluded || false,
      printedById: req.user.id,
    });

    res.status(201).json({ success: true, message: 'Loan letter generated', data });
  } catch (error) {
    console.error('Create loan letter error:', error);
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to generate loan letter',
      code: error.code,
      existingLetter: error.data || null,
    });
  }
};

/**
 * List loan letters (paginated)
 */
exports.list = async (req, res) => {
  try {
    const { page, limit, search, departmentId, programId } = req.query;
    const result = await loanLetterService.list({
      page,
      limit,
      search,
      departmentId,
      programId,
      ownOnly: true,
      userId: req.user.id,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('List loan letters error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch loan letters' });
  }
};

/**
 * Get loan letter by ID (with fee breakdown for print)
 */
exports.getById = async (req, res) => {
  try {
    const data = await loanLetterService.getById(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get loan letter error:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to fetch loan letter' });
  }
};

exports.recordReprint = async (req, res) => {
  try {
    const data = await loanLetterService.recordReprint({
      id: req.params.id,
      actorId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
    res.json({ success: true, message: 'Loan letter reprint recorded', data });
  } catch (error) {
    console.error('Record loan letter reprint error:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to record loan letter reprint' });
  }
};
