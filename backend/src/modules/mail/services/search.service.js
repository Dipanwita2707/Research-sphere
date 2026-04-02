/**
 * Search Service
 * Gmail-like smart search across subjects, bodies, senders, recipients,
 * attachment filenames, and group metadata.
 *
 * Supported operators:
 *   from:name          sender uid or name
 *   to:name            recipient uid or name
 *   subject:word       subject only
 *   has:attachment     has attachments
 *   filename:foo.pdf   attachment filename
 *   before:YYYY-MM-DD  sent before date (inclusive)
 *   after:YYYY-MM-DD   sent after date (inclusive)
 *   older_than:Nd      sent more than N days ago
 *   newer_than:Nd      sent within last N days
 *   is:unread          unread only
 *   is:starred         starred only
 *   is:read            read only
 *   in:sent            sent by me
 *   in:inbox           received by me
 *   "quoted phrase"    exact phrase match
 *   word1 word2        all words must appear (AND logic)
 */
const prisma = require('../../../shared/config/database');
const { USER_SELECT, getDisplayName } = require('./recipient.service');

// ── Helpers ──────────────────────────────────────────────────────────────────

const parseDaysAgo = (str) => {
  const m = str.match(/^(\d+)d$/i);
  if (!m) return null;
  const d = new Date();
  d.setDate(d.getDate() - parseInt(m[1], 10));
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (dateStr) => {
  try { const d = new Date(dateStr); d.setHours(23, 59, 59, 999); return isNaN(d) ? null : d; }
  catch { return null; }
};

const startOfDay = (dateStr) => {
  try { const d = new Date(dateStr); d.setHours(0, 0, 0, 0); return isNaN(d) ? null : d; }
  catch { return null; }
};

const wordConditions = (term) => [
  { subject: { contains: term, mode: 'insensitive' } },
  { bodyPlainText: { contains: term, mode: 'insensitive' } },
  { sender: { uid: { contains: term, mode: 'insensitive' } } },
  { sender: { employeeDetails: { firstName: { contains: term, mode: 'insensitive' } } } },
  { sender: { employeeDetails: { lastName: { contains: term, mode: 'insensitive' } } } },
  { sender: { employeeDetails: { designation: { contains: term, mode: 'insensitive' } } } },
  { sender: { studentLogin: { firstName: { contains: term, mode: 'insensitive' } } } },
  { sender: { studentLogin: { lastName: { contains: term, mode: 'insensitive' } } } },
  { recipients: { some: { user: { uid: { contains: term, mode: 'insensitive' } } } } },
  { recipients: { some: { user: { employeeDetails: { firstName: { contains: term, mode: 'insensitive' } } } } } },
  { recipients: { some: { user: { employeeDetails: { lastName: { contains: term, mode: 'insensitive' } } } } } },
  { recipients: { some: { user: { employeeDetails: { designation: { contains: term, mode: 'insensitive' } } } } } },
  { recipients: { some: { user: { studentLogin: { firstName: { contains: term, mode: 'insensitive' } } } } } },
  { recipients: { some: { user: { studentLogin: { lastName: { contains: term, mode: 'insensitive' } } } } } },
  { attachments: { some: { fileName: { contains: term, mode: 'insensitive' } } } },
  { metadata: { string_contains: term } },
];

const senderConditions = (term) => [
  { sender: { uid: { contains: term, mode: 'insensitive' } } },
  { sender: { employeeDetails: { firstName: { contains: term, mode: 'insensitive' } } } },
  { sender: { employeeDetails: { lastName: { contains: term, mode: 'insensitive' } } } },
  { sender: { studentLogin: { firstName: { contains: term, mode: 'insensitive' } } } },
  { sender: { studentLogin: { lastName: { contains: term, mode: 'insensitive' } } } },
];

const recipientConditions = (term) => ({
  recipients: {
    some: {
      OR: [
        { user: { uid: { contains: term, mode: 'insensitive' } } },
        { user: { employeeDetails: { firstName: { contains: term, mode: 'insensitive' } } } },
        { user: { employeeDetails: { lastName: { contains: term, mode: 'insensitive' } } } },
        { user: { studentLogin: { firstName: { contains: term, mode: 'insensitive' } } } },
        { user: { studentLogin: { lastName: { contains: term, mode: 'insensitive' } } } },
      ],
    },
  },
});

// ── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse Gmail-style operators from a raw query string.
 */
const parseSearchQuery = (rawQuery = '') => {
  const result = {
    text: '',
    phrases: [],
    from: null, to: null, subject: null, filename: null,
    hasAttachment: false,
    before: null, after: null, olderThan: null, newerThan: null,
    isUnread: false, isStarred: false, isRead: false,
    inSent: false, inInbox: false, inTrash: false,
  };

  let s = rawQuery;

  // Extract quoted phrases
  s = s.replace(/"([^"]+)"/g, (_, phrase) => { result.phrases.push(phrase.trim()); return ' '; });

  const extract = (regex) => {
    const m = s.match(regex);
    if (!m) return null;
    s = s.replace(m[0], ' ');
    return (m[1] || m[2] || '').trim();
  };

  result.from      = extract(/from:(?:"([^"]+)"|(\S+))/i);
  result.to        = extract(/to:(?:"([^"]+)"|(\S+))/i);
  result.subject   = extract(/subject:(?:"([^"]+)"|(\S+))/i);
  result.filename  = extract(/filename:(?:"([^"]+)"|(\S+))/i);

  const beforeVal  = extract(/before:(\S+)/i);
  if (beforeVal) result.before = endOfDay(beforeVal);
  const afterVal   = extract(/after:(\S+)/i);
  if (afterVal)  result.after  = startOfDay(afterVal);
  const olderVal   = extract(/older_than:(\S+)/i);
  if (olderVal)  result.olderThan = parseDaysAgo(olderVal);
  const newerVal   = extract(/newer_than:(\S+)/i);
  if (newerVal)  result.newerThan = parseDaysAgo(newerVal);

  if (/has:attachment/i.test(s))  { result.hasAttachment = true; s = s.replace(/has:attachment/gi,  ' '); }
  if (/is:unread/i.test(s))       { result.isUnread  = true;     s = s.replace(/is:unread/gi,       ' '); }
  if (/is:starred/i.test(s))      { result.isStarred = true;     s = s.replace(/is:starred/gi,      ' '); }
  if (/is:read/i.test(s))         { result.isRead    = true;     s = s.replace(/is:read/gi,         ' '); }
  if (/in:sent/i.test(s))         { result.inSent    = true;     s = s.replace(/in:sent/gi,         ' '); }
  if (/in:inbox/i.test(s))        { result.inInbox   = true;     s = s.replace(/in:inbox/gi,        ' '); }
  if (/in:trash/i.test(s))        { result.inTrash   = true;     s = s.replace(/in:trash/gi,        ' '); }

  result.text = s.replace(/\s+/g, ' ').trim();
  return result;
};

// ── Main search ──────────────────────────────────────────────────────────────

const searchMail = async (userId, {
  q, from, to, hasAttachments, dateFrom, dateTo, labelId, page = 1, limit = 20,
} = {}) => {
  const skip = (page - 1) * limit;
  const parsed = parseSearchQuery(q);

  const effectiveFrom     = from   || parsed.from;
  const effectiveTo       = to     || parsed.to;
  const effectiveSubject  = parsed.subject;
  const effectiveFilename = parsed.filename;
  const effectiveHasAtt   = hasAttachments === 'true' || hasAttachments === true || parsed.hasAttachment;

  // Merge date constraints (operator precedence: explicit params > parsed from query)
  const dateAfter  = parsed.after  || parsed.newerThan || (dateFrom ? startOfDay(dateFrom) : null);
  const dateBefore = parsed.before || parsed.olderThan || (dateTo   ? endOfDay(dateTo)     : null);

  // Participant scope: user must be in the thread
  const participantFilter = {
    participants: { some: { userId, isDeleted: false } },
  };

  const messageWhere = {
    thread: participantFilter,
    ...(parsed.inSent  ? { senderId: userId } : {}),
    ...(parsed.inInbox ? { senderId: { not: userId }, recipients: { some: { userId, isDeleted: false } } } : {}),
    ...(dateAfter || dateBefore ? {
      sentAt: {
        ...(dateAfter  ? { gte: dateAfter  } : {}),
        ...(dateBefore ? { lte: dateBefore } : {}),
      },
    } : {}),
  };

  const andClauses = [];

  // Plain text words — AND logic, each word searched across all fields
  if (parsed.text) {
    for (const w of parsed.text.split(/\s+/).filter(Boolean)) {
      andClauses.push({ OR: wordConditions(w) });
    }
  }

  // Exact quoted phrases
  for (const phrase of parsed.phrases) {
    andClauses.push({
      OR: [
        { subject:       { contains: phrase, mode: 'insensitive' } },
        { bodyPlainText: { contains: phrase, mode: 'insensitive' } },
        { metadata:      { string_contains: phrase } },
      ],
    });
  }

  if (effectiveSubject)  andClauses.push({ subject: { contains: effectiveSubject, mode: 'insensitive' } });
  if (effectiveFrom)     andClauses.push({ OR: senderConditions(effectiveFrom) });
  if (effectiveTo)       andClauses.push(recipientConditions(effectiveTo));
  if (effectiveFilename) andClauses.push({ attachments: { some: { fileName: { contains: effectiveFilename, mode: 'insensitive' } } } });
  if (effectiveHasAtt)   andClauses.push({ attachments: { some: {} } });
  if (labelId)           andClauses.push({ labels: { some: { labelId, userId } } });

  if (andClauses.length > 0) messageWhere.AND = andClauses;

  // Step 1 — get distinct thread IDs (accurate total for pagination)
  const allThreadIdRows = await prisma.mailMessage.findMany({
    where: messageWhere,
    select: { threadId: true },
    distinct: ['threadId'],
    orderBy: { sentAt: 'desc' },
  });

  const total = allThreadIdRows.length;
  const pagedThreadIds = allThreadIdRows.slice(skip, skip + limit).map((r) => r.threadId);

  if (pagedThreadIds.length === 0) {
    return { threads: [], total: 0, page, limit, totalPages: 0, pagination: { page, totalPages: 0, total: 0 } };
  }

  // Step 2 — fetch best matching message per paged thread
  const messages = await prisma.mailMessage.findMany({
    where: { ...messageWhere, threadId: { in: pagedThreadIds } },
    orderBy: { sentAt: 'desc' },
    include: {
      sender: { select: USER_SELECT },
      thread: { select: { id: true, subject: true, messageCount: true } },
      recipients: {
        where: { OR: [{ recipientType: { in: ['TO', 'CC'] } }, { recipientType: 'BCC', userId }] },
        take: 5,
        include: { user: { select: USER_SELECT } },
      },
      attachments: { select: { id: true, fileName: true } },
      _count: { select: { attachments: true } },
    },
  });

  // Step 3 — fetch unread counts and starred state per thread
  const [participantStates, unreadCounts] = await Promise.all([
    prisma.mailParticipant.findMany({
      where: { userId, threadId: { in: pagedThreadIds } },
      select: { threadId: true, isStarred: true },
    }),
    Promise.all(
      pagedThreadIds.map(async (tid) => ({
        threadId: tid,
        count: await prisma.mailRecipient.count({
          where: { userId, readAt: null, isDeleted: false, message: { threadId: tid } },
        }),
      }))
    ),
  ]);

  const participantMap = new Map(participantStates.map((p) => [p.threadId, p]));
  const unreadMap      = new Map(unreadCounts.map((u) => [u.threadId, u.count]));

  // Step 4 — build thread results (one per thread, first message = best match)
  const threadMap = new Map();
  for (const msg of messages) {
    const tid = msg.thread.id;
    if (threadMap.has(tid)) continue;

    const isStarred  = participantMap.get(tid)?.isStarred || false;
    const unreadCount = unreadMap.get(tid) || 0;

    // Apply post-filters for is:starred / is:unread / is:read
    if (parsed.isStarred && !isStarred)     continue;
    if (parsed.isUnread  && unreadCount === 0) continue;
    if (parsed.isRead    && unreadCount > 0)   continue;

    threadMap.set(tid, {
      id: tid,
      subject: msg.subject || msg.thread.subject,
      lastMessageAt: msg.sentAt,
      lastMessageSnippet: msg.bodyPlainText ? msg.bodyPlainText.substring(0, 150) : '',
      messageCount: msg.thread.messageCount,
      unreadCount,
      isStarred,
      isMuted: false,
      lastSender: { uid: msg.sender.uid, displayName: getDisplayName(msg.sender) },
      hasAttachments: msg._count.attachments > 0,
      createdAt: msg.sentAt,
    });
  }

  const threads = pagedThreadIds.map((tid) => threadMap.get(tid)).filter(Boolean);
  const totalPages = Math.ceil(total / limit);

  return {
    threads,
    total,
    page,
    limit,
    totalPages,
    pagination: { page, totalPages, total },
  };
};

module.exports = {
  searchMail,
  parseSearchQuery,
}