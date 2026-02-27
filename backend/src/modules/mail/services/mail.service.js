/**
 * Mail Service
 * Core business logic for sending mail, replying, forwarding
 * Handles auto-CC admin for students, group expansion, threading
 */
const prisma = require('../../../shared/config/database');
const {
  expandRecipientList,
  getAdminForAutoCC,
  resolveUser,
  getDisplayName,
  USER_SELECT,
} = require('./recipient.service');
const {
  generateSnippet,
  htmlToPlainText,
  deduplicateRecipients,
  buildQuotedReply,
  buildForwardedBody,
  formatUidAsEmail,
} = require('../utils/helpers');

/**
 * Send a new mail
 * @param {string} senderId - UserLogin.id of the sender
 * @param {object} params - { to: string[], cc: string[], bcc: string[], subject: string, body: string, attachments: object[] }
 * @returns {Promise<object>} Created thread and message
 */
const sendMail = async (senderId, { to, cc = [], bcc = [], subject, body, attachments = [], groupRecipients = null }) => {
  // Get sender details
  const sender = await prisma.userLogin.findUnique({
    where: { id: senderId },
    select: { ...USER_SELECT, role: true },
  });

  if (!sender) throw new Error('Sender not found');

  // Auto-CC admin for student mails
  let finalCc = [...cc];
  if (sender.role === 'student') {
    const adminUser = await getAdminForAutoCC();
    if (adminUser && !finalCc.includes(adminUser.uid) && !to.includes(adminUser.uid)) {
      finalCc.push(adminUser.uid);
    }
  }

  // Expand group recipients to individual user IDs
  const toUserIds = await expandRecipientList(to);
  const ccUserIds = await expandRecipientList(finalCc);
  const bccUserIds = await expandRecipientList(bcc);

  // Deduplicate (TO > CC > BCC, exclude sender)
  const deduplicated = deduplicateRecipients(toUserIds, ccUserIds, bccUserIds, senderId);

  if (deduplicated.to.length === 0 && deduplicated.cc.length === 0 && deduplicated.bcc.length === 0) {
    throw new Error('No valid recipients found');
  }

  // All participant IDs (sender + all recipients)
  const allParticipantIds = new Set([
    senderId,
    ...deduplicated.to,
    ...deduplicated.cc,
    ...deduplicated.bcc,
  ]);

  const snippet = generateSnippet(body);
  const plainText = htmlToPlainText(body);

  // Create thread, message, recipients, participants in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create thread
    const thread = await tx.mailThread.create({
      data: {
        subject,
        createdById: senderId,
        lastMessageAt: new Date(),
        lastMessageSnippet: snippet,
        messageCount: 1,
      },
    });

    // 2. Create message
    const message = await tx.mailMessage.create({
      data: {
        threadId: thread.id,
        senderId,
        subject,
        body,
        bodyPlainText: plainText,
        sentAt: new Date(),
        ...(groupRecipients ? { metadata: { groupRecipients } } : {}),
      },
    });

    // 3. Create recipients
    const recipientRecords = [];

    for (const userId of deduplicated.to) {
      recipientRecords.push({
        messageId: message.id,
        userId,
        recipientType: 'TO',
      });
    }
    for (const userId of deduplicated.cc) {
      recipientRecords.push({
        messageId: message.id,
        userId,
        recipientType: 'CC',
      });
    }
    for (const userId of deduplicated.bcc) {
      recipientRecords.push({
        messageId: message.id,
        userId,
        recipientType: 'BCC',
      });
    }

    if (recipientRecords.length > 0) {
      await tx.mailRecipient.createMany({ data: recipientRecords });
    }

    // 4. Create participants
    const participantRecords = [];
    for (const userId of allParticipantIds) {
      participantRecords.push({
        threadId: thread.id,
        userId,
        lastReadAt: userId === senderId ? new Date() : null,
      });
    }

    await tx.mailParticipant.createMany({
      data: participantRecords,
      skipDuplicates: true,
    });

    // 5. Create attachments
    if (attachments && attachments.length > 0) {
      const attachmentRecords = attachments
        .filter(att => att && att.fileName) // Filter out null/invalid attachments
        .map((att) => ({
          messageId: message.id,
          uploadedById: senderId,
          fileName: att.fileName,
          filePath: att.filePath,
          fileSize: att.fileSize || 0,
          mimeType: att.mimeType || 'application/octet-stream',
        }));

      if (attachmentRecords.length > 0) {
        await tx.mailAttachment.createMany({ data: attachmentRecords });
      }
    }

    return { thread, message };
  });

  // Fetch complete message with relations
  const fullMessage = await prisma.mailMessage.findUnique({
    where: { id: result.message.id },
    include: {
      sender: { select: USER_SELECT },
      recipients: {
        include: { user: { select: USER_SELECT } },
      },
      attachments: true,
    },
  });

  return {
    thread: result.thread,
    message: fullMessage,
  };
};

/**
 * Reply to a message (single sender reply)
 * @param {string} senderId
 * @param {string} messageId - ID of the message being replied to
 * @param {object} params - { body, attachments }
 * @returns {Promise<object>}
 */
const replyToMessage = async (senderId, messageId, { body, cc = [], bcc = [], attachments = [] }) => {
  const originalMessage = await prisma.mailMessage.findUnique({
    where: { id: messageId },
    include: {
      thread: true,
      sender: { select: USER_SELECT },
      recipients: { include: { user: { select: { id: true, uid: true } } } },
    },
  });

  if (!originalMessage) throw new Error('Original message not found');

  const sender = await prisma.userLogin.findUnique({
    where: { id: senderId },
    select: { ...USER_SELECT, role: true },
  });

  // Reply TO = original sender only
  const toUserIds = [originalMessage.senderId];

  // Auto-CC admin for students
  let ccUserIds = await expandRecipientList(cc);
  if (sender.role === 'student') {
    const adminUser = await getAdminForAutoCC();
    if (adminUser && !ccUserIds.includes(adminUser.id) && !toUserIds.includes(adminUser.id)) {
      ccUserIds.push(adminUser.id);
    }
  }

  const bccUserIds = await expandRecipientList(bcc);

  // Deduplicate
  const deduplicated = deduplicateRecipients(toUserIds, ccUserIds, bccUserIds, senderId);

  // Build reply body with quoted original
  const senderDisplayName = getDisplayName(originalMessage.sender);
  const quotedBody = body + buildQuotedReply(
    {
      sentAt: originalMessage.sentAt,
      body: originalMessage.body,
      senderUid: originalMessage.sender.uid,
    },
    senderDisplayName
  );

  const snippet = generateSnippet(body);
  const plainText = htmlToPlainText(body);
  const replySubject = originalMessage.subject.startsWith('Re: ')
    ? originalMessage.subject
    : `Re: ${originalMessage.subject}`;

  const allParticipantIds = new Set([
    senderId,
    ...deduplicated.to,
    ...deduplicated.cc,
    ...deduplicated.bcc,
  ]);

  const result = await prisma.$transaction(async (tx) => {
    // Create message in same thread
    const message = await tx.mailMessage.create({
      data: {
        threadId: originalMessage.threadId,
        senderId,
        subject: replySubject,
        body: quotedBody,
        bodyPlainText: plainText,
        replyToId: messageId,
        sentAt: new Date(),
      },
    });

    // Create recipients
    const recipientRecords = [];
    for (const userId of deduplicated.to) {
      recipientRecords.push({ messageId: message.id, userId, recipientType: 'TO' });
    }
    for (const userId of deduplicated.cc) {
      recipientRecords.push({ messageId: message.id, userId, recipientType: 'CC' });
    }
    for (const userId of deduplicated.bcc) {
      recipientRecords.push({ messageId: message.id, userId, recipientType: 'BCC' });
    }

    if (recipientRecords.length > 0) {
      await tx.mailRecipient.createMany({ data: recipientRecords });
    }

    // Update thread
    await tx.mailThread.update({
      where: { id: originalMessage.threadId },
      data: {
        lastMessageAt: new Date(),
        lastMessageSnippet: snippet,
        messageCount: { increment: 1 },
      },
    });

    // Add new participants
    for (const userId of allParticipantIds) {
      await tx.mailParticipant.upsert({
        where: {
          unique_participant_per_thread: {
            threadId: originalMessage.threadId,
            userId,
          },
        },
        update: {
          lastReadAt: userId === senderId ? new Date() : undefined,
        },
        create: {
          threadId: originalMessage.threadId,
          userId,
          lastReadAt: userId === senderId ? new Date() : null,
        },
      });
    }

    // Attachments
    if (attachments.length > 0) {
      await tx.mailAttachment.createMany({
        data: attachments.map((att) => ({
          messageId: message.id,
          uploadedById: senderId,
          fileName: att.fileName,
          filePath: att.filePath,
          fileSize: att.fileSize || 0,
          mimeType: att.mimeType || 'application/octet-stream',
        })),
      });
    }

    return message;
  });

  return result;
};

/**
 * Reply-All to a message
 * Recipients = all TO + CC from original (excluding self), never BCC
 * @param {string} senderId
 * @param {string} messageId
 * @param {object} params - { body, attachments }
 * @returns {Promise<object>}
 */
const replyAllToMessage = async (senderId, messageId, { body, cc = [], bcc = [], attachments = [] }) => {
  const originalMessage = await prisma.mailMessage.findUnique({
    where: { id: messageId },
    include: {
      thread: true,
      sender: { select: USER_SELECT },
      recipients: {
        where: { recipientType: { in: ['TO', 'CC'] } },
        include: { user: { select: { id: true, uid: true } } },
      },
    },
  });

  if (!originalMessage) throw new Error('Original message not found');

  const sender = await prisma.userLogin.findUnique({
    where: { id: senderId },
    select: { ...USER_SELECT, role: true },
  });

  // Reply-All: TO = original sender
  // CC = original TO + CC recipients (excluding current sender and original sender)
  const toUserIds = [originalMessage.senderId];
  let ccUserIds = originalMessage.recipients
    .filter((r) => r.userId !== senderId && r.userId !== originalMessage.senderId)
    .map((r) => r.userId);

  // Add any additional CC
  const additionalCc = await expandRecipientList(cc);
  ccUserIds = [...new Set([...ccUserIds, ...additionalCc])];

  // Auto-CC admin for students
  if (sender.role === 'student') {
    const adminUser = await getAdminForAutoCC();
    if (adminUser && !ccUserIds.includes(adminUser.id) && !toUserIds.includes(adminUser.id)) {
      ccUserIds.push(adminUser.id);
    }
  }

  const bccUserIds = await expandRecipientList(bcc);

  // Deduplicate
  const deduplicated = deduplicateRecipients(toUserIds, ccUserIds, bccUserIds, senderId);

  const senderDisplayName = getDisplayName(originalMessage.sender);
  const quotedBody = body + buildQuotedReply(
    {
      sentAt: originalMessage.sentAt,
      body: originalMessage.body,
      senderUid: originalMessage.sender.uid,
    },
    senderDisplayName
  );

  const snippet = generateSnippet(body);
  const plainText = htmlToPlainText(body);
  const replySubject = originalMessage.subject.startsWith('Re: ')
    ? originalMessage.subject
    : `Re: ${originalMessage.subject}`;

  const allParticipantIds = new Set([
    senderId,
    ...deduplicated.to,
    ...deduplicated.cc,
    ...deduplicated.bcc,
  ]);

  const result = await prisma.$transaction(async (tx) => {
    const message = await tx.mailMessage.create({
      data: {
        threadId: originalMessage.threadId,
        senderId,
        subject: replySubject,
        body: quotedBody,
        bodyPlainText: plainText,
        replyToId: messageId,
        sentAt: new Date(),
      },
    });

    const recipientRecords = [];
    for (const userId of deduplicated.to) {
      recipientRecords.push({ messageId: message.id, userId, recipientType: 'TO' });
    }
    for (const userId of deduplicated.cc) {
      recipientRecords.push({ messageId: message.id, userId, recipientType: 'CC' });
    }
    for (const userId of deduplicated.bcc) {
      recipientRecords.push({ messageId: message.id, userId, recipientType: 'BCC' });
    }

    if (recipientRecords.length > 0) {
      await tx.mailRecipient.createMany({ data: recipientRecords });
    }

    await tx.mailThread.update({
      where: { id: originalMessage.threadId },
      data: {
        lastMessageAt: new Date(),
        lastMessageSnippet: snippet,
        messageCount: { increment: 1 },
      },
    });

    for (const userId of allParticipantIds) {
      await tx.mailParticipant.upsert({
        where: {
          unique_participant_per_thread: {
            threadId: originalMessage.threadId,
            userId,
          },
        },
        update: {
          lastReadAt: userId === senderId ? new Date() : undefined,
        },
        create: {
          threadId: originalMessage.threadId,
          userId,
          lastReadAt: userId === senderId ? new Date() : null,
        },
      });
    }

    if (attachments.length > 0) {
      await tx.mailAttachment.createMany({
        data: attachments.map((att) => ({
          messageId: message.id,
          uploadedById: senderId,
          fileName: att.fileName,
          filePath: att.filePath,
          fileSize: att.fileSize || 0,
          mimeType: att.mimeType || 'application/octet-stream',
        })),
      });
    }

    return message;
  });

  return result;
};

/**
 * Forward a message (creates new thread)
 * @param {string} senderId
 * @param {string} messageId
 * @param {object} params - { to: string[], cc: string[], bcc: string[], body, attachments }
 * @returns {Promise<object>}
 */
const forwardMessage = async (senderId, messageId, { to, cc = [], bcc = [], body = '', attachments = [] }) => {
  const originalMessage = await prisma.mailMessage.findUnique({
    where: { id: messageId },
    include: {
      sender: { select: USER_SELECT },
      attachments: true,
    },
  });

  if (!originalMessage) throw new Error('Original message not found');

  const sender = await prisma.userLogin.findUnique({
    where: { id: senderId },
    select: { ...USER_SELECT, role: true },
  });

  // Build forwarded body
  const senderDisplayName = getDisplayName(originalMessage.sender);
  const forwardedBody = (body || '') + buildForwardedBody(
    {
      sentAt: originalMessage.sentAt,
      body: originalMessage.body,
      subject: originalMessage.subject,
      senderUid: originalMessage.sender.uid,
    },
    senderDisplayName
  );

  const forwardSubject = originalMessage.subject.startsWith('Fwd: ')
    ? originalMessage.subject
    : `Fwd: ${originalMessage.subject}`;

  // Forward = create new thread via sendMail
  // Merge original attachments with new ones
  const allAttachments = [
    ...attachments,
    ...originalMessage.attachments.map((att) => ({
      fileName: att.fileName,
      filePath: att.filePath,
      fileSize: att.fileSize,
      mimeType: att.mimeType,
    })),
  ];

  return sendMail(senderId, {
    to,
    cc,
    bcc,
    subject: forwardSubject,
    body: forwardedBody,
    attachments: allAttachments,
  });
};

module.exports = {
  sendMail,
  replyToMessage,
  replyAllToMessage,
  forwardMessage,
};
