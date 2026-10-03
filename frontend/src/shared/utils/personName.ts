/**
 * One key per person across bibliographic name forms: "Vishu Madaan", "Madaan, V.",
 * "Dr. Vishu Madaan" → "madaan|v" (surname + first initial). Mirrors
 * backend/src/shared/utils/personNameKey.js. Meant for one researcher's own co-author list.
 */
export function personNameKey(name: string | null | undefined): string | null {
  const raw = String(name || '').replace(/\b(dr|prof|mr|mrs|ms)\.?\s+/gi, '').trim();
  if (!raw) return null;
  let surname: string;
  let given: string;
  if (raw.includes(',')) {
    [surname, given] = raw.split(',').map((x) => x.trim());
  } else {
    const parts = raw.split(/\s+/);
    surname = parts.pop() || '';
    given = parts.join(' ');
  }
  const initial = String(given || '').replace(/[^A-Za-z]/g, '').charAt(0).toLowerCase();
  const sur = String(surname || '').toLowerCase().replace(/[^a-zÀ-ɏ-]/g, '');
  return sur ? `${sur}|${initial}` : null;
}

interface AuthorLike { name?: string | null; userId?: string | null }

/** Distinct co-authors over a set of papers, excluding the user (by account id or name). */
export function countDistinctCoAuthors(papers: { authors?: AuthorLike[] | null }[], self: { id?: string | null; name?: string | null }): number {
  const selfKey = personNameKey(self.name);
  const seen = new Set<string>();
  for (const p of papers || []) {
    for (const a of p.authors || []) {
      if (self.id && a.userId === self.id) continue;
      const key = a.userId ? `id:${a.userId}` : personNameKey(a.name);
      if (!key || key === selfKey) continue;
      seen.add(key);
    }
  }
  return seen.size;
}
