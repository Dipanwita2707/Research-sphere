# SGT UMS - Research & IPR Module Feature Specifications List

This document lists the granular end-to-end features for the SGT UMS Research & IPR Module.

---

## 📝 1.0 Contribution Drafting & Filing Channels
1. **Manual Entry Workspace**: Faculty and students submit publications manually via input forms.
2. **DOI Validation Field**: Validates DOI formats and calls DOI resolvers to auto-fill metadata.
3. **Indexing Checkboxes**: Tracks indexing sources (Scopus, Web of Science, UGC Care, Google Scholar).
4. **Journal Registry Selector**: Connects to dynamic databases containing active ISSNs and publisher details.
5. **ISBN Metadata Capturer**: Collects specific ISBN registries, publishing houses, and editions for book submissions.
6. **Co-author Selection Matrix**: Supports selecting multiple co-authors from internal employee directories.
7. **Document Drag-and-Drop**: Uploads publication drafts or verification emails to AWS S3.
8. **File Size Enforcement**: Restricts PDF uploads to 10MB, returning size limit validation alerts.
9. **Draft Auto-Save Engine**: Periodically caches form state in the database while user is inputting content.
10. **Contribution Category Filter**: Allows switching between Journal, Book, Chapter, Conference, and Grant forms.

---

## 🤖 2.0 Automated Scraper & Sync Engine
11. **Elsevier Scopus API Sync**: Scrapes Elsevier directories for publications matching registered author Scopus IDs.
12. **ORCID v3.0 API Sync**: Queries ORCID profiles to retrieve newly updated ORCID contribution items.
13. **OpenAlex API Sync**: Fetches open metadata databases to discover missing publications.
14. **Auto-Sync Frequency Scheduler**: Admins configure crawler triggers (daily, weekly, monthly intervals).
15. **Auto-Deduplication Engine**: Uses DOI and Scopus IDs to prevent duplicate record insertion.
16. **Auto-Draft Record Spawning**: Creates database entries for missing items, setting status to `draft`.
17. **In-App Claim Prompter**: Dispatches dashboard flags when crawled records match employee profiles.
18. **Sync History Tracker**: Logs crawler runs, query counts, fetch results, and error logs.
19. **API Error Tolerant Queue**: Re-queues queries if Elsevier or ORCID APIs throttle connections.
20. **Conflict Resolver Override**: Allows manual overrides if authors reject auto-linked publications.

---

## 🔍 3.0 SGT Affiliation Resolver
21. **Affiliation String Parsing**: Scans author affiliation arrays for SGT University keywords.
22. **Affiliation Variant Mapper**: Maps variant spellings (e.g. *"SGT Univ"*, *"S.G.T. University"*).
23. **Employee ID Auto-Matcher**: Links internal co-authors using name lists and matching email IDs.
24. **External Co-author Flagging**: Categorizes missing co-authors as external contributors.
25. **Department Metric Aggregator**: Automatically logs contributions to corresponding departments.
26. **Affiliation Verification Emails**: Sends co-authors email queries to confirm their contributions.
27. **Co-author Claim Dashboard**: Renders lists of pending co-author confirmation requests.
28. **Co-author Order Sorting**: Allows sorting co-authors (First, Second, Corresponding, etc.) to set splits.
29. **School Affiliation Statistics**: Compiles publication metrics by school.
30. **Manual Co-Author Matching override**: DRD admins can manually map authors if text parsing fails.

---

## 🕵️ 4.0 Review & Collaborative Revisions Workflows
31. **Student-to-Mentor Router**: Student submissions route to their assigned mentor's validation queue.
32. **Mentor Review Dashboard**: Mentors review, suggest edits, or recommend student submissions.
33. **Workflow Change Logs**: Tracks status history (e.g. `pending_mentor_approval` $\rightarrow$ `under_drd_review`).
34. **Revision Comment Matrix**: Allows reviewers to link text comments to specific input fields.
35. **Revision Form Lock**: Locks edit options for applicants while reviews are in progress.
36. **Student Resubmission Trigger**: Returns drafts to students with change logs to prompt resubmission.
37. **DRD Scoped Reviewer Queue**: Scopes review items to DRD staff based on school department codes.
38. **DRD Suggestion Logger**: Captures and saves all DRD reviewer suggestions.
39. **Workflow Approval Emails**: Notifies applicants of status transitions via SendGrid.
40. **Final Approval Locking**: Moving items to `completed` locks records against further edits.

---

## ⚖️ 5.0 Patent & IPR Filing Lifecycle
41. **IPR Subtype Classifications**: Supports Patent, Copyright, Trademark, and Design entries.
42. **Provisional Specification Form**: Captures title, abstracts, and provisional application details.
43. **Provisional-to-Complete Conversion**: Links complete filings to their source provisional records.
44. **12-Month Limit Tracker**: Warns inventors as provisionals approach the 12-month complete filing limit.
45. **Copyright Code Store**: Supports uploading code snippets or literary scripts for copyright submissions.
46. **Trademark Logo Previews**: Renders graphic previews of trademark logo submissions.
47. **Design Image Previews**: Renders CAD files or technical drawings for designs.
48. **Patent Application Number Fields**: Stores unique filing numbers, dates, and country codes.
49. **Grant Status Field**: Logs patent grant statuses, dates, and cert download links.
50. **Patent Renewal Alerts**: Schedules notification triggers 90 days before patent renewal deadlines.

---

## 💰 6.0 Dynamic Policy Split Calculator & Reports
51. **Policy Schedule Configurator**: Allows admins to define policies based on active financial years.
52. **Incentive Base Calculations**: Matches index categories to base reward sums.
53. **Journal Quality Bonuses**: Adjusts rewards based on Impact Factor metrics or Scopus quartiles (Q1, Q2, Q3, Q4).
54. **First Author Credit Splitting**: Allocates 40% of calculations to the designated first author.
55. **Corresponding Author Credit Splitting**: Allocates 30% of calculations to the designated corresponding author.
56. **Co-author Shared Split**: Divides the remaining 30% equally among internal co-authors.
57. **Dual-Role Allocations**: Assigns 70% of calculations if a user is both first and corresponding author.
58. **Incentive Credit Log**: Writes finalized incentive payouts to ledger tables.
59. **Monthly Tracker Cron**: Monthly scheduler (`0 0 1 * *`) compiles progress trackers.
60. **Deans Reports Dispatcher**: Compiles department progress metrics into Excel attachments and emails them to Deans.

---

## 🔬 7.0 Advanced Crawlers & Policy Controls
61. **Bulk Journal Import Manager**: Allows importing index journal lists from Excel to check UGC/Scopus listings.
62. **ORCID Webhook Listeners**: Automatically triggers sync crawlers when users change their ORCID profiles.
63. **Publication DOI Match Overrides**: Faculty can resolve matching mistakes manually if crawled DOIs overlap.
64. **Research Incentive Statement Exporter**: Exports spreadsheet summary calculators showing split incentives for tax reporting.
65. **Collaborative Suggestion Versioning Trails**: Logs comments and suggested edits during review revisions.
66. **IPR Filing Date Extension Alert Notifications**: Auto-warns inventors 30 days before patent provisional spec deadlines.
67. **Patent Application History Timeline Tracks**: Renders patent lifecycle transitions visually (filed $\rightarrow$ published $\rightarrow$ examined $\rightarrow$ granted).
68. **External Reviewer Assignment Engine**: Allows DRD heads to assign peer reviewers from other school departments.
69. **Government Grant Milestone Tracker**: Logs funding installment payouts and checks against project progression dates.
70. **Dynamic Policy Simulation Sandbox**: Let admins adjust base reward amounts to preview final cost impacts before saving changes.
71. **Co-author Split Agreement Panel**: Digital confirmation signatures from internal co-authors accepting incentive splits.
72. **Scholar Citation Count Sync**: Crawls citation metrics periodically, showing H-index metrics in faculty profiles.
73. **Research Project Abstract Search**: Searches paper abstracts using text matches to locate related works.
74. **Reviewer Workload Analytics**: Displays active paper counts per DRD reviewer to balance assignments.
75. **IPR Application Certificate Vault**: PDF repository storing government-issued certificates.
76. **UGC Care List Sync Scheduler**: Automatically imports UGC Care list updates.
77. **Co-author Affiliation Verification Flags**: Shows indicators confirming if all SGT co-authors have claimed papers.
78. **Draft Paper Expiration Checks**: Automatically moves inactive drafts to `abandoned` status after 180 days.
79. **Incentive Payment Approval Chain**: Routes credit payouts through finance approvals before disbursement.
80. **Research Module Activity Summary Feed**: Renders live updates of published publications and patents on the campus homepage.
