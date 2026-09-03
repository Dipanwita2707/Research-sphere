# SGT UMS - Master Dashboard Feature Specifications List

This document lists the granular end-to-end features for the SGT UMS Master Dashboard.

---

## 👤 1.0 User & Profile Management
1. **JWT User Authentication**: Encapsulates token generation utilizing HS256 algorithms for secure user credentials validation.
2. **Password Cryptography**: Implements bcrypt (salt round = 10) to store non-reversible password hashes.
3. **Login Attempt Interceptor**: Automatically locks accounts for 15 minutes after 5 consecutive failed authentication attempts.
4. **Access Key Rotation**: Rotates refresh tokens on user activity to mitigate cookie hijacking.
5. **Cross-Site Scripting (XSS) Filters**: Sanitizes user inputs on forms to filter script injections.
6. **MFA Verification Gate**: Handles Multi-Factor Authentication codes sent during admin access checks.
7. **Active Session Auditor**: Captures and lists current active browser sessions, IP addresses, and device models.
8. **Student Profile Directory**: Catalogs unique roll numbers, enrollment dates, academic statuses, and parent mappings.
9. **Employee Profile Directory**: Catalogs employee codes, departments, designation grades, and hiring dates.
10. **Account Status Toggle**: Provides master sliders to instantly switch accounts between active and inactive.

---

## 🏛️ 2.0 Academic Structure & Metadata Mappings
11. **Faculty/School Registry**: Stores SGT Schools (e.g., Faculty of Engineering, Faculty of Medicine).
12. **Department Registry**: Maps academic departments under parent faculties (e.g., Dept of Computer Science).
13. **Program Catalog**: Defines degree programs (e.g., B.Tech, MCA, MBA) linked to corresponding departments.
14. **Specialization Matrix**: Catalogs academic specializations (e.g., Artificial Intelligence, Cybersecurity).
15. **Batch Calendar**: Defines active batch years (e.g., 2023-2027) with start and end schedules.
16. **Section Code Registry**: Allocates specific section codes (e.g., Section A, Section B) to batches.
17. **Enrollment Capacity Limit**: Enforces numerical student ceilings per section during enrollment validations.
18. **Teacher-Section Mapping**: Links designated Class Advisors and Course Teachers to specific section records.
19. **Advisor Access Flag**: Grants class advisors specialized views of section performance metrics.
20. **Academic Term Tracker**: Manages semester boundaries and active term configuration flags.

---

## 🔐 3.0 Scope-Gated Permissions Engine
21. **Granular Permission Registry**: Defines system-wide permissions in a static `permissionDefinitions.js` schema.
22. **Central Role Configuration**: Permits assigning central permissions (e.g. `configure_erp`, `view_audit_logs`).
23. **Department Permissions Map**: Links operational flags to specific role categories (e.g., `drd_reviewer`, `finance_officer`).
24. **School Scope Bounds**: Restricts reviewer roles to validate data only from their assigned academic school departments.
25. **Redis Cache Engine**: Caches compiled user permission scopes in Redis key-value structures.
26. **Sub-Millisecond Authorization Check**: Middleware verifies permissions against the Redis cache in under 1ms.
27. **Permissions Revocation Hook**: Clearing permissions instantly invalidates the user's Redis cache block.
28. **Instant Token Severance**: Server disconnects socket channels when an account is disabled or permissions change.
29. **Role Audit logs**: Creates specific records in the audit logging store when permission scopes are modified.
30. **Security Scope Checks**: Middleware enforces permissions checks on all write API routes.

---

## 🔔 4.0 Notification & Email Dispatcher
31. **Real-time Socket Dispatches**: Pushes internal alerts to online clients using Socket.io namespaces.
32. **Alert Persistence Store**: Saves alerts with unique IDs and state tracking in the database notification table.
33. **In-App Notification Feed**: Renders dashboard menus containing system warnings, requests, and deadlines.
34. **Read/Unread Status Toggle**: Provides interactive buttons to mark notifications as read or unread.
35. **Bulk Purge Controls**: Allows clearing read alerts to keep inboxes organized.
36. **Email Template Compiler**: Generates transactional mail HTML layouts containing dynamic student/employee tokens.
37. **SendGrid Delivery Dispatch**: Leverages the SendGrid API to dispatch emails for workflow approval transitions.
38. **Email Status Tracking**: Logs SendGrid webhook response categories (Delivered, Bounced, Opened).
39. **System-Wide Announcements**: Permits admins to broadcast header banners to all active user dashboards.
40. **Custom Alert Configurations**: Let users toggle on/off email notifications for specific activity categories.

---

## 📝 5.0 System-Wide Audit Log & Change History
41. **API Write Hook**: Middleware intercepts POST, PUT, PATCH, and DELETE requests before db commits.
42. **User Identity Capturing**: Extracts and logs the active actor ID, designation, and roles.
43. **Network Log Tracker**: Records client IP addresses, browser headers, and OS metadata.
44. **Severity Level Allocator**: Tag logs with severity levels (INFO, WARNING, CRITICAL).
45. **ChangeHistory Diffs Generator**: Evaluates modified schemas to extract JSON diffs containing old and new values.
46. **Target Table Tracker**: Stores absolute target database tables and affected primary row keys.
47. **Log Database Partitioning**: Segregates audit tables by calendar month to sustain querying performance.
48. **Log Cleanup Scheduler**: Triggers monthly background cron jobs to archive audit logs older than 180 days to S3.
49. **Log Search Matrix**: Admin UI provides date, table, and actor filters to scan logs.
50. **CSV/Excel Export Utility**: Exposes restricted admin endpoints to export filtered audit records.

---

## 📈 6.0 Administrative Features & Security Audits
51. **User Login Geolocation Logger**: Captures city and country estimates based on incoming client IP ranges.
52. **Admin Impersonation Mode**: Allows authorized super-admins to view dashboards as a specific student or employee for testing.
53. **Password Expiry Policies**: Prompts users to rotate passwords every 90 days.
54. **System Maintenance Mode**: Lets admins lock the UMS dashboard during system upgrades, showing custom announcements.
55. **Automatic Log Purging Settings**: UI controls to select log retention terms.
56. **Active Cache Monitor**: Monitors Redis cache sizes and hits/misses directly on the ERP dashboard.
57. **Failed Login Alert System**: Triggers email alerts to admins when login failure rates climb past predefined ceilings.
58. **User Account Export Manager**: Bulk exports user accounts matching program filters into secure ZIP formats.
59. **ERP Database Health Tracker**: Tracks active database connection pool sizes.
60. **Central ERP Log Exporter**: Exports API status summaries for technical review.

---

## ⚙️ 7.0 System Expansion & Advanced Controls
61. **User Session Expiration Warnings**: Shows a modal 2 minutes before the user session expires, offering to extend the session.
62. **Profile Change Verification Loops**: Requires verification codes (SMS/Email) before saving changes to phone numbers or personal emails.
63. **Device Authorization History**: Logs new devices logging into the user account, sending alerts to existing authorized sessions.
64. **Academic Year Configuration Panels**: Admin tools to transition the platform into new academic years, automatically archiving past student section data.
65. **Bulk Section Registration Manager**: Enables registering students into class sections using CSV uploads.
66. **Active Queue Tracker**: UI tracker showing pending background notification mailer tasks.
67. **System Configuration Version Logs**: Tracks updates to global system environment configurations and setup changes.
68. **Export Task Scheduler**: Lets users request large student rosters export tasks in the background, notifying them when files are ready for download.
69. **User Search Indexing Engine**: Multi-column index searches (by email, phone, roll code, or registration index) to quickly query accounts.
70. **Administrative IP Address Restrictions**: Locks super-admin logins to specified campus office IP subnet ranges.
71. **Theme Variables Configurator**: Dashboard theme adjustments (light, dark, custom layouts) stored in user preferences.
72. **System API Rate Limiting Guards**: Protects dashboard entry endpoints against brute-force DDoS query limits.
73. **Failed Authentication Email Alerts**: Auto-dispatches email notifications to accounts experiencing repeated failed logins.
74. **Data Backups Scheduler UI**: Triggers backups of academic structures and user tables, saving copies to S3 buckets.
75. **Database Transaction Monitor**: Logs database queries exceeding 500ms for optimization reviews.
76. **Bulk Password Reset Trigger**: Enables admins to prompt password resets for selected batches.
77. **External ERP Syncer API**: REST endpoints to sync UMS catalog lists with other campus directory applications.
78. **System Health Status Board**: Renders server CPU load, RAM allocation, and active DB pool connections on admin menus.
79. **SSL Certificate Expiration Monitor**: Warns admins when dashboard HTTPS certificates are within 30 days of expiry.
80. **Data Anonymization Engine**: Obfuscates sensitive student IDs when exporting rosters for academic analytics reviews.
