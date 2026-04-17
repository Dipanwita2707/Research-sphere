/**
 * Compose Controller
 * Handles sending new mail, reply, reply-all, forward
 */
const { sendMail, replyToMessage, replyAllToMessage, forwardMessage } = require('../services/mail.service');

/**
 * POST /api/v1/mail/compose/send
 * Send a new mail
 */
exports.send = async (req, res) => {
  try {
    const { to, cc, bcc, subject, body, attachments, groupRecipients } = req.body;

    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one recipient (to) is required',
      });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subject is required',
      });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message body is required',
      });
    }

    const result = await sendMail(req.user.id, {
      to,
      cc: cc || [],
      bcc: bcc || [],
      subject: subject.trim(),
      body,
      attachments: attachments || [],
      groupRecipients: groupRecipients || null,
    });

    res.status(201).json({
      success: true,
      message: 'Mail sent successfully',
      data: result,
    });
  } catch (error) {
    console.error('Send mail error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send mail',
    });
  }
};

/**
 * POST /api/v1/mail/compose/reply/:messageId
 * Reply to a single sender
 */
exports.reply = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { body, cc, bcc, attachments } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reply body is required',
      });
    }

    const result = await replyToMessage(req.user.id, messageId, {
      body,
      cc: cc || [],
      bcc: bcc || [],
      attachments: attachments || [],
    });

    res.status(201).json({
      success: true,
      message: 'Reply sent successfully',
      data: result,
    });
  } catch (error) {
    console.error('Reply error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send reply',
    });
  }
};

/**
 * POST /api/v1/mail/compose/reply-all/:messageId
 * Reply to all TO + CC recipients
 */
exports.replyAll = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { body, cc, bcc, attachments } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reply body is required',
      });
    }

    const result = await replyAllToMessage(req.user.id, messageId, {
      body,
      cc: cc || [],
      bcc: bcc || [],
      attachments: attachments || [],
    });

    res.status(201).json({
      success: true,
      message: 'Reply-all sent successfully',
      data: result,
    });
  } catch (error) {
    console.error('Reply-all error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send reply-all',
    });
  }
};

/**
 * POST /api/v1/mail/compose/forward/:messageId
 * Forward a message (creates new thread)
 */
exports.forward = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { to, cc, bcc, body, attachments } = req.body;

    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one recipient (to) is required for forwarding',
      });
    }

    const result = await forwardMessage(req.user.id, messageId, {
      to,
      cc: cc || [],
      bcc: bcc || [],
      body: body || '',
      attachments: attachments || [],
    });

    res.status(201).json({
      success: true,
      message: 'Mail forwarded successfully',
      data: result,
    });
  } catch (error) {
    console.error('Forward error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to forward mail',
    });
  }
};
