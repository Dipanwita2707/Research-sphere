/**
 * Raw SQL fragments shared by Research Intelligence services.
 *
 * tenantExtension does not scope $queryRaw, so every fragment here takes the tenant id
 * and filters university_id explicitly. Always build queries with Prisma.sql so values
 * are parameterised.
 */

'use strict';

const { Prisma } = require('@prisma/client');
const { COUNTED_STATUSES_SQL } = require('./researchData');

const STATUSES = Prisma.raw(COUNTED_STATUSES_SQL);

/** Publication year of research_contribution aliased `rc`. */
const YEAR = Prisma.raw(`EXTRACT(YEAR FROM COALESCE(rc.publication_date::timestamptz, rc.submitted_at, rc.created_at))::int`);

/** Imported citation count of research_contribution aliased `rc`. */
const CITES = Prisma.raw(
  `(CASE WHEN (rc.indexing_details->>'citationCount') ~ '^[0-9]+$' THEN (rc.indexing_details->>'citationCount')::int ELSE 0 END)`
);

/** Full-text document of research_contribution aliased `rc`. */
const DOC = Prisma.raw(
  `to_tsvector('english', coalesce(rc.title,'') || ' ' || coalesce(rc.keywords,'') || ' ' || coalesce(rc.abstract,''))`
);

/** Counted contributions of the tenant (alias rc). */
const countedRc = (tenantId) => Prisma.sql`rc.university_id = ${tenantId}::uuid AND rc.status::text IN (${STATUSES})`;

/**
 * CTE `authorship(user_id, contribution_id)`: every internal researcher linked to a counted
 * contribution, as applicant or as an internal co-author. UNION de-duplicates.
 */
const authorshipCte = (tenantId) => Prisma.sql`
  authorship AS (
    SELECT rc.applicant_user_id AS user_id, rc.id AS contribution_id
      FROM research_contribution rc
     WHERE ${countedRc(tenantId)} AND rc.applicant_user_id IS NOT NULL
    UNION
    SELECT a.user_id, a.research_contribution_id
      FROM research_contribution_author a
      JOIN research_contribution rc ON rc.id = a.research_contribution_id
     WHERE a.university_id = ${tenantId}::uuid AND a.user_id IS NOT NULL AND ${countedRc(tenantId)}
  )`;

/** Escape LIKE wildcards in user input. */
const likeEscape = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);

module.exports = { STATUSES, YEAR, CITES, DOC, countedRc, authorshipCte, likeEscape, Prisma };
