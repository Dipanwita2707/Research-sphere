-- Every university gets a Finance (Research Incentives) central department, like DRD, so the
-- research incentive payout and budget permissions (finance_view, finance_review,
-- finance_approve, finance_budget_manage) can be granted to staff. New universities get it
-- from provisionTenantDefaults (superadmin.controller.js). A university that already has a
-- department with code FINANCE keeps it unchanged.
INSERT INTO "central_department" ("university_id", "department_code", "department_name", "short_name", "department_type", "is_active")
SELECT u."id", 'FINANCE', 'Finance (Research Incentives)', 'Finance', 'finance', true
FROM "universities" u
ON CONFLICT ("university_id", "department_code") DO NOTHING;
