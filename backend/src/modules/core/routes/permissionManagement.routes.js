const express = require('express');
const router = express.Router();
const permissionMgmt = require('../controllers/permissionManagement.controller');
const { protect, restrictTo, requirePermission } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

// Get permission definitions (what permissions are available)
router.get('/definitions', permissionMgmt.getPermissionDefinitions);

// Get all permissions for a user
router.get('/user/:userId', permissionMgmt.getUserAllPermissions);

// Check specific permission
router.get('/check', permissionMgmt.checkUserPermission);

// Get my assigned schools (for DRD members - available to any authenticated user)
router.get('/my-assigned-schools', permissionMgmt.getMyAssignedSchools);
router.get('/my-assigned-research-schools', permissionMgmt.getMyAssignedResearchSchools);

// DRD Head can also manage school assignments (requires ipr_approve permission)
router.get('/drd-members/with-schools', permissionMgmt.getDrdMembersWithSchools);
router.get('/schools/with-members', permissionMgmt.getSchoolsWithAssignedMembers);
router.post('/drd-member/assign-schools', permissionMgmt.assignDrdMemberSchools);

// Research school assignments (requires research_approve/research_assign_school permission)
router.get('/drd-members/with-research-schools', permissionMgmt.getDrdMembersWithResearchSchools);
router.get('/schools/with-research-members', permissionMgmt.getSchoolsWithResearchMembers);
router.post('/research-member/assign-schools', permissionMgmt.assignResearchMemberSchools);

// Book school assignments (requires book_approve/book_assign_school permission)
router.get('/drd-members/with-book-schools', permissionMgmt.getDrdMembersWithBookSchools);
router.get('/schools/with-book-members', permissionMgmt.getSchoolsWithBookMembers);
router.post('/book-member/assign-schools', permissionMgmt.assignBookMemberSchools);
router.get('/my-assigned-book-schools', permissionMgmt.getMyAssignedBookSchools);

// Conference school assignments (requires conference_approve/conference_assign_school permission)
router.get('/drd-members/with-conference-schools', permissionMgmt.getDrdMembersWithConferenceSchools);
router.get('/schools/with-conference-members', permissionMgmt.getSchoolsWithConferenceMembers);
router.post('/conference-member/assign-schools', permissionMgmt.assignConferenceMemberSchools);
router.get('/my-assigned-conference-schools', permissionMgmt.getMyAssignedConferenceSchools);

// Grant school assignments (requires grant_approve/grant_assign_school permission)
router.get('/drd-members/with-grant-schools', permissionMgmt.getDrdMembersWithGrantSchools);
router.get('/schools/with-grant-members', permissionMgmt.getSchoolsWithGrantMembers);
router.post('/grant-member/assign-schools', permissionMgmt.assignGrantMemberSchools);
router.get('/my-assigned-grant-schools', permissionMgmt.getMyAssignedGrantSchools);

// Admin only routes
router.use(restrictTo('admin'));

// Get all users with their permissions (admin panel)
router.get('/users/all', permissionMgmt.getAllUsersWithPermissions);

// Assign roles to user
router.post('/assign-roles', permissionMgmt.assignRolesToUser);

// Grant permissions
router.post('/school-department/grant', permissionMgmt.grantSchoolDeptPermissions);
router.post('/central-department/grant', permissionMgmt.grantCentralDeptPermissions);

// Revoke permissions
router.post('/school-department/revoke', permissionMgmt.revokeSchoolDeptPermissions);
router.post('/central-department/revoke', permissionMgmt.revokeCentralDeptPermissions);

module.exports = router;
