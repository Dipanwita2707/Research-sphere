/**
 * Builds an interleaved list of messages + date-divider items for an inverted FlatList.
 *
 * The input `messages` array is assumed to be sorted **newest-first** (as stored in
 * the chat store and rendered by the inverted FlatList).
 *
 * Algorithm:
 *   For each message, push it into the result.  If the *next* message in the
 *   array belongs to a different calendar day (or we are at the last message),
 *   insert a divider stub for that day immediately after.
 *
 * Because the FlatList is inverted (index 0 = bottom), a divider at index N
 * renders *above* the message at index N-1.  This places each date label at the
 * TOP boundary of its day-group — matching the standard WhatsApp / Telegram UX.
 */

export type DividerItem = {
  type: 'divider';
  id: string;
  date: string; // full ISO string of the representative message for that day
};

export type MessageItem<T> = {
  type: 'message';
  id: string;
  message: T;
};

export type ChatListItem<T> = DividerItem | MessageItem<T>;

/** Returns a locale-independent day key so two messages can be compared */
function getDayKey(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function buildChatData<T extends { id: string; createdAt: string }>(
  messages: T[],
): ChatListItem<T>[] {
  const result: ChatListItem<T>[] = [];

  for (let i = 0; i < messages.length; i++) {
    result.push({ type: 'message', id: messages[i].id, message: messages[i] });

    const currDay = getDayKey(messages[i].createdAt);
    const nextDay =
      i + 1 < messages.length ? getDayKey(messages[i + 1].createdAt) : null;

    // Insert divider when the next message is from a different day, or we've
    // reached the oldest message (end of array).
    if (nextDay !== currDay) {
      result.push({
        type: 'divider',
        id: `divider-${currDay}-${i}`,
        date: messages[i].createdAt,
      });
    }
  }

  return result;
}
