/**
 * Approval Flow Service - Reporting Structure Based Workflow
 * 
 * All noting approvals work through the Reporting Structure system:
 * 1. User creates noting → System finds user's manager from ReportingStructure
 * 2. If manager has required permission → Auto-forward to manager
 * 3. If not → User manually selects approver from reporting chain
 * 4. Manager can Approve/Reject/Forward up the chain
 * 5. DEAN role can override and forward anywhere
 */
const prisma = require('../../../shared/config/database');
const reportingService = require('../../core/services/reportingStructure.service');
const { hasPermission, hasPermissionAsync } = require('../../../shared/config/permissions.config');

/**
 * Determine next approver based on reporting hierarchy + permissions
 * 
 * @param {Object} note - The note object
 * @param {string} modulePermissionKey - e.g., 'event_approve', 'dsw_approve_noting'
 * @returns {Promise<Object>} { canAutoForward, nextApproverId, reason, managerInfo }
 */
async function determineNextApproverByReporting(note, modulePermissionKey) {
  try {
    const creator = await prisma.userLogin.findUnique({
      where: { id: note.createdById },
      include: {
        employeeDetails: true
      }
    });
    
    if (!creator) {
      return {
        canAutoForward: false,
        nextApproverId: null,
        reason: 'Creator not found'
      };
    }
    
    // Get immediate manager
    const manager = await reportingService.getDirectManager(creator.id);
    
    if (!manager) {
      return {
        canAutoForward: false,
        nextApproverId: null,
        reason: 'No reporting manager assigned. Please contact admin to configure reporting structure.'
      };
    }
    
    // Check if manager has permission for this module (async to resolve role-based permissions)
    const managerHasPermission = await hasPermissionAsync(manager, modulePermissionKey);
    
    if (!managerHasPermission) {
      return {
        canAutoForward: false,
        nextApproverId: manager.id,
        reason: `Manager ${manager.name || manager.email} does not have ${modulePermissionKey} permission. Manual forwarding required.`,
        managerInfo: {
          id: manager.id,
          name: manager.name,
          email: manager.email
        }
      };
    }
    
    // Auto-forward allowed
    return {
      canAutoForward: true,
      nextApproverId: manager.id,
      reason: 'Auto-forwarded to direct reporting manager',
      managerInfo: {
        id: manager.id,
        name: manager.name,
        email: manager.email,
        roleCode: manager.roleCode
      }
    };
  } catch (error) {
    console.error('Error in determineNextApproverByReporting:', error);
    return {
      canAutoForward: false,
      nextApproverId: null,
      reason: 'Error determining next approver: ' + error.message
    };
  }
}

/**
 * Check if user can override workflow routing based on role code
 * DEAN role code has override authority
 * 
 * @param {Object} user - User object with role
 * @returns {boolean}
 */
function canOverrideWorkflowRouting(user) {
  // DEAN role code has override authority
  if (user.role?.roleCode === 'DEAN') {
    return true;
  }
  
  // Future: Add more override roles here if needed
  // if (user.role?.roleCode === 'REGISTRAR') return true;
  // if (user.role?.roleCode === 'VC') return true;
  
  return false;
}

/**
 * Get eligible forward targets for a user
 * Regular users can only forward up reporting chain
 * DEAN and override roles can forward to anyone with permission
 * 
 * @param {string} userId - Current holder of note
 * @param {Object} note - Note object
 * @param {string} modulePermissionKey - Required permission key
 * @returns {Promise<Array>} List of users who can receive forward
 */
async function getEligibleForwardTargets(userId, note, modulePermissionKey) {
  const currentUser = await prisma.userLogin.findUnique({
    where: { id: userId },
    include: { 
      role: true,
      employeeDetails: true
    }
  });
  
  if (!currentUser) {
    return [];
  }
  
  // If user has override authority (DEAN), they can forward to anyone with permission
  if (canOverrideWorkflowRouting(currentUser)) {
    // Return all users with appropriate permission
    const allEligible = await prisma.userLogin.findMany({
      where: {
        status: 'active',
        id: { not: userId }, // Exclude self
      },
      include: {
        employeeDetails: true,
        role: true,
        schoolDeptPermissions: true,
        centralDeptPermissions: true
      }
    });
    
    // Filter by permission (async to resolve role-based permissions)
    const results = await Promise.all(
      allEligible.map(async (user) => ({
        user,
        hasPerm: await hasPermissionAsync(user, modulePermissionKey)
      }))
    );
    return results.filter(r => r.hasPerm).map(r => r.user);
  }
  
  // Regular users can only forward up reporting chain
  const reportingChain = await reportingService.getReportingChain(userId);
  
  // Filter chain by permission (async to resolve role-based permissions)
  const chainResults = await Promise.all(
    reportingChain.map(async (manager) => ({
      manager,
      hasPerm: await hasPermissionAsync(manager, modulePermissionKey)
    }))
  );
  return chainResults.filter(r => r.hasPerm).map(r => r.manager);
}

/**
 * Get module permission key based on note category/subcategory
 * Maps note types to their corresponding permission keys
 * 
 * @param {Object} note - Note object with category/subcategory
 * @returns {string} Permission key
 */
function getModulePermissionKey(note) {
  // Map note categories to permission keys
  const permissionMap = {
    'dsw_club_creation': 'dsw_approve_noting',
    'dsw_club_change': 'dsw_approve_noting',
    'events': 'event_approve',
    'curriculum': 'noting_approve',
    'exam': 'noting_approve',
    'infrastructure': 'noting_approve',
    'accounts_purchase': 'noting_approve',
    'student_related': 'noting_approve',
    'miscellaneous': 'noting_approve',
    'non_academic_resources': 'noting_approve',
  };
  
  return permissionMap[note.subcategory] || 'noting_approve';
}

/**
 * Validate if user can forward to specified target
 * Checks reporting chain or override authority
 * 
 * @param {string} userId - Current holder
 * @param {string} targetUserId - Proposed forward target
 * @param {Object} note - Note object
 * @returns {Promise<Object>} { allowed, reason }
 */
async function validateForwardTarget(userId, targetUserId, note) {
  const currentUser = await prisma.userLogin.findUnique({
    where: { id: userId },
    include: { role: true }
  });
  
  if (!currentUser) {
    return { allowed: false, reason: 'Your user account was not found. Please log out and log back in.' };
  }
  
  // Check override authority
  if (canOverrideWorkflowRouting(currentUser)) {
    return { 
      allowed: true, 
      reason: 'Forward allowed with override authority (' + currentUser.role.roleCode + ')' 
    };
  }
  
  // Check if target is in reporting chain
  const modulePermissionKey = getModulePermissionKey(note);
  const eligibleTargets = await getEligibleForwardTargets(userId, note, modulePermissionKey);
  
  const isEligible = eligibleTargets.some(t => t.id === targetUserId);
  
  if (isEligible) {
    return { allowed: true, reason: 'Forward target is in reporting chain with required permission' };
  }
  
  return { 
    allowed: false, 
    reason: `You can only forward to people above you in your reporting hierarchy who have approval permission. The selected person is either not in your reporting chain or does not have the required "${modulePermissionKey}" permission. Contact Admin if you need to forward to someone outside your hierarchy.`
  };
}

module.exports = {
  determineNextApproverByReporting,
  canOverrideWorkflowRouting,
  getEligibleForwardTargets,
  getModulePermissionKey,
  validateForwardTarget,
};