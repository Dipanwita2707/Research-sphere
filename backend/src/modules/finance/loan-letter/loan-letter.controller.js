const loanLetterService = require('./loan-letter.service');
const { createModuleLogger } = require('../../../shared/utils/logger');

// Create module-specific logger
const logger = createModuleLogger('loan-letter');

/**
 * Create a new loan letter
 */
exports.create = async (req, res) => {
  try {
    const { applicationNumber, studentEmail, studentPhone, studentName, relationPrefix, relationName, programId, specializationId, selectedSemesters, transportIncluded, hostelIncluded } = req.body;

    logger.logUserAction(req.user.id, 'create_loan_letter', 'Creating new loan letter', {
      applicationNumber,
      studentName,
      programId,
      semesterCount: selectedSemesters?.length
    });

    if (!applicationNumber || !studentName || !relationPrefix || !relationName || !programId) {
      logger.logUserAction(req.user.id, 'create_loan_letter_validation_error', 'Loan letter creation failed - missing required fields');
      return res.status(400).json({ success: false, message: 'applicationNumber, studentName, relationPrefix, relationName, and programId are required' });
    }
    if (!Array.isArray(selectedSemesters) || selectedSemesters.length === 0) {
      logger.logUserAction(req.user.id, 'create_loan_letter_validation_error', 'Loan letter creation failed - no semesters selected');
      return res.status(400).json({ success: false, message: 'At least one semester must be selected' });
    }
    const validPrefixes = ['Son of', 'Daughter of', 'Ward of'];
    if (!validPrefixes.includes(relationPrefix)) {
      logger.logUserAction(req.user.id, 'create_loan_letter_validation_error', 'Loan letter creation failed - invalid relation prefix', { relationPrefix });
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

    logger.logUserAction(req.user.id, 'create_loan_letter_success', 'Loan letter created successfully', {
      loanLetterId: data.id,
      applicationNumber: data.applicationNumber
    });

    res.status(201).json({ success: true, message: 'Loan letter generated', data });
  } catch (error) {
    logger.logError('create_loan_letter', error, { 
      userId: req.user.id,
      applicationNumber: req.body.applicationNumber 
    });
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
    
    logger.logUserAction(req.user.id, 'list_loan_letters', 'Fetching loan letters list', {
      page, limit, search, departmentId, programId
    });
    
    const result = await loanLetterService.list({
      page,
      limit,
      search,
      departmentId,
      programId,
      ownOnly: true,
      userId: req.user.id,
    });
    
    logger.logUserAction(req.user.id, 'list_loan_letters_success', 'Loan letters fetched successfully', {
      count: result.data?.length || 0,
      total: result.total
    });
    
    res.json({ success: true, ...result });
  } catch (error) {
    logger.logError('list_loan_letters', error, { userId: req.user.id });
    res.status(500).json({ success: false, message: 'Failed to fetch loan letters' });
  }
};

/**
 * Get loan letter by ID (with fee breakdown for print)
 */
exports.getById = async (req, res) => {
  try {
    logger.logUserAction(req.user.id, 'get_loan_letter', 'Fetching loan letter by ID', {
      loanLetterId: req.params.id
    });
    
    const data = await loanLetterService.getById(req.params.id);
    
    logger.logUserAction(req.user.id, 'get_loan_letter_success', 'Loan letter fetched successfully', {
      loanLetterId: req.params.id,
      applicationNumber: data.applicationNumber
    });
    
    res.json({ success: true, data });
  } catch (error) {
    logger.logError('get_loan_letter', error, { 
      userId: req.user.id, 
      loanLetterId: req.params.id 
    });
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to fetch loan letter' });
  }
};

exports.recordReprint = async (req, res) => {
  try {
    logger.logUserAction(req.user.id, 'record_loan_letter_reprint', 'Recording loan letter reprint', {
      loanLetterId: req.params.id,
      ipAddress: req.ip
    });
    
    const data = await loanLetterService.recordReprint({
      id: req.params.id,
      actorId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
    
    logger.logUserAction(req.user.id, 'record_loan_letter_reprint_success', 'Loan letter reprint recorded successfully', {
      loanLetterId: req.params.id,
      reprintId: data.id
    });
    
    res.json({ success: true, message: 'Loan letter reprint recorded', data });
  } catch (error) {
    logger.logError('record_loan_letter_reprint', error, { 
      userId: req.user.id, 
      loanLetterId: req.params.id 
    });
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to record loan letter reprint' });
  }
};
