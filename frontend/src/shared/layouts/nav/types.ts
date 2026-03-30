export interface DepartmentPermission {
  category: string;
  permissions: string[];
}

export interface SubMenuItem {
  name: string;
  href?: string;
  description?: string;
  children?: SubMenuItem[];
}

export interface MenuItem {
  name: string;
  subItems?: SubMenuItem[];
}

export interface NavPermissions {
  userPermissions: DepartmentPermission[];
  isStudent: boolean;
  isFaculty: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  isGuard: boolean;
  hasFullGateEntryAccess: boolean;
  canFileIpr: boolean;
  canFileResearch: boolean;
  hasDrdAccess: boolean;
  hasFinanceAccess: boolean;
  hasReviewAccess: boolean;
  canReviewIpr: boolean;
  canApproveIpr: boolean;
  canReviewResearch: boolean;
  canApproveResearch: boolean;
  canReviewBook: boolean;
  canApproveBook: boolean;
  canReviewConference: boolean;
  canApproveConference: boolean;
  canReviewGrant: boolean;
  canApproveGrant: boolean;
  hasAnalyticsAccess: boolean;
  isClubChairperson: boolean;
  hasVolunteerAssignments: boolean;
}
