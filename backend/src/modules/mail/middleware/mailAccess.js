/**
 * Mail Access Middleware
 * Controls access to mail features and enforces permissions
 */
const prisma = require('../../../shared/config/database');

/**
 * Verify user is a participant in a thread before allowing access
 */
const requireThreadAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const threadId = req.params.threadId || req.body.threadId;

    if (!threadId) {
      return res.status(400).json({
        success: false,
        message: 'Thread ID is required',
      });
    }

    const participant = await prisma.mailParticipant.findUnique({
      where: {
        unique_participant_per_thread: {
          threadId,
          userId,
        },
      },
    });

    if (!participant) {
      // Also check if user is sender of any message in the thread
      const isSender = await prisma.mailMessage.findFirst({
        where: { threadId, senderId: userId },
      });

      if (!isSender) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this thread',
          code: 'MAIL_ACCESS_DENIED',
        });
      }
    }

    next();
  } catch (error) {
    console.error('Thread access check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify mail access',
    });
  }
};

/**
 * Verify user is a recipient of a message before allowing access
 */
const requireMessageAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.messageId || req.body.messageId;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: 'Message ID is required',
      });
    }

    const message = await prisma.mailMessage.findUnique({
      where: { id: messageId },
      select: { senderId: true },
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Sender always has access
    if (message.senderId === userId) {
      return next();
    }

    // Check if user is a recipient
    const recipient = await prisma.mailRecipient.findFirst({
      where: { messageId, userId },
    });

    if (!recipient) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this message',
        code: 'MAIL_ACCESS_DENIED',
      });
    }

    next();
  } catch (error) {
    console.error('Message access check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify mail access',
    });
  }
};

/**
 * Validate student sending restrictions
 * Students cannot send to departments, schools, or central departments
 */
const validateStudentSend = async (req, res, next) => {
  try {
    if (req.user.role !== 'student') {
      return next();
    }

    const { to = [], cc = [], bcc = [] } = req.body;
    const allRecipients = [...to, ...cc, ...bcc];

    // Check for group identifiers
    const hasGroupRecipient = allRecipients.some(
      (uid) =>
        uid.startsWith('cdept:') ||
        uid.startsWith('school:') ||
        uid.startsWith('dept:')
    );

    if (hasGroupRecipient) {
      return res.status(403).json({
        success: false,
        message: 'Students cannot send to departments or schools. Please select individual recipients.',
        code: 'STUDENT_GROUP_SEND_DENIED',
      });
    }

    next();
  } catch (error) {
    console.error('Student send validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate sending permissions',
    });
  }
};

module.exports = {
  requireThreadAccess,
  requireMessageAccess,
  validateStudentSend,
};
