export function scopusAuthorProfileUrl(scopusAuthorId: string | null | undefined): string | null {
  const id = String(scopusAuthorId || '').trim();
  if (!id) return null;
  return `https://www.scopus.com/authid/detail.uri?authorId=${encodeURIComponent(id)}`;
}

export function orcidProfileUrl(orcid: string | null | undefined): string | null {
  const raw = String(orcid || '').trim();
  if (!raw) return null;
  const id = raw.replace(/^https?:\/\/orcid\.org\//i, '');
  if (!id) return null;
  return `https://orcid.org/${encodeURIComponent(id)}`;
}
