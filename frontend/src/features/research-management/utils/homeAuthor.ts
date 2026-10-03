/**
 * Whether an author on a publication belongs to the signed-in user's own university.
 *
 * Uses the backend's classification (`isInternal`), which is made against the tenant's
 * configured affiliation names, aliases and Scopus affiliation ids. Never match on a
 * hard-coded institution name here: the product serves many universities.
 */
export function isHomeInstitutionAuthor(author: { isInternal?: boolean | null } | null | undefined): boolean {
  return author?.isInternal === true;
}
