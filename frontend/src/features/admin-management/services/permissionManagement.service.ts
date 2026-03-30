import api from '@/shared/api/api';

export interface Permission {
  key: string;
  label: string;
  category: string;
  description?: string;
}

export interface DepartmentPermission {
  id: string;
  userId: string;
  departmentId: string;
  permissions: Record<string, boolean>;
  isPrimary: boolean;
  isActive: boolean;
  assignedAt: string;
  department: {
    id: string;
    departmentCode: string;
    departmentName: string;
    shortName?: string;
    faculty: {
      facultyCode: string;
      facultyName: string;
    };
  };
  assignedByUser?: {
    uid: string;
    employeeDetails: {
      displayName: string;
    };
  };
}

export interface CentralDepartmentPermission {
  id: string;
  userId: string;
  centralDeptId: string;
  permissions: Record<string, boolean>;
  isPrimary: boolean;
  isActive: boolean;
  assignedAt: string;
  assignedSchoolIds?: string[];
  assignedResearchSchoolIds?: string[];
  assignedBookSchoolIds?: string[];
  assignedConferenceSchoolIds?: string[];
  assignedGrantSchoolIds?: string[];
  assignedIprAnalyticsSchoolIds?: string[];
  assignedResearchAnalyticsSchoolIds?: string[];
  assignedBookAnalyticsSchoolIds?: string[];
  assignedConferenceAnalyticsSchoolIds?: string[];
  assignedGrantAnalyticsSchoolIds?: string[];
  centralDept: {
    id: string;
    departmentCode: string;
    departmentName: string;
    shortName?: string;
    departmentType?: string;
  };
  assignedByUser?: {
    uid: string;
    employeeDetails: {
      displayName: string;
    };
  };
}

export interface UserPermissions {
  schoolDepartments: DepartmentPermission[];
  centralDepartments: CentralDepartmentPermission[];
  primaryDepartment: {
    departmentCode: string;
    departmentName: string;
  } | null;
  primaryCentralDepartment: {
    departmentCode: string;
    departmentName: string;
  } | null;
}

export interface PermissionDefinitions {
  schoolDepartments: Permission[];
  centralDepartments: Record<string, Permission[]>;
}

export interface UserWithPermissions {
  id: string;
  uid: string;
  email?: string;
  role: string;
  assignedRoleIds?: string[]; // Array of role IDs assigned to user
  employeeDetails?: {
    firstName: string;
    lastName?: string;
    displayName?: string;
    empId?: string;
    designation?: string;
    primaryDepartment?: {
      departmentCode: string;
      departmentName: string;
    };
    primaryCentralDept?: {
      departmentCode: string;
      departmentName: string;
    };
  };
  schoolDeptPermissions: Array<{
    id: string;
    departmentId: string;
    isPrimary: boolean;
    permissions: Record<string, boolean>;
    department: {
      departmentCode: string;
      departmentName: string;
    };
  }>;
  centralDeptPermissions: Array<{
    id: string;
    centralDeptId: string;
    isPrimary: boolean;
    permissions: Record<string, boolean>;
    assignedSchoolIds?: string[];
    assignedResearchSchoolIds?: string[];
    assignedBookSchoolIds?: string[];
    assignedConferenceSchoolIds?: string[];
    assignedGrantSchoolIds?: string[];
    assignedIprAnalyticsSchoolIds?: string[];
    assignedResearchAnalyticsSchoolIds?: string[];
    assignedBookAnalyticsSchoolIds?: string[];
    assignedConferenceAnalyticsSchoolIds?: string[];
    assignedGrantAnalyticsSchoolIds?: string[];
    assignedIprAnalyticsDepartmentIds?: string[];
    assignedResearchAnalyticsDepartmentIds?: string[];
    assignedBookAnalyticsDepartmentIds?: string[];
    assignedConferenceAnalyticsDepartmentIds?: string[];
    assignedGrantAnalyticsDepartmentIds?: string[];
    assignedDrdMemberAnalyticsSchoolIds?: string[];
    assignedDrdMemberAnalyticsDepartmentIds?: string[];
    centralDept: {
      departmentCode: string;
      departmentName: string;
    };
  }>;
}

class PermissionManagementService {
  private baseUrl = '/permission-management';

  async getPermissionDefinitions() {
    const response = await api.get<{ success: boolean; data: PermissionDefinitions }>(
      `${this.baseUrl}/definitions`
    );
    return response.data;
  }

  async getUserPermissions(userId: string) {
    const response = await api.get<{ success: boolean; data: UserPermissions }>(
      `${this.baseUrl}/user/${userId}`
    );
    return response.data;
  }

  async checkPermission(params: { departmentId?: string; centralDeptId?: string; permissionKey: string }) {
    const response = await api.get<{ success: boolean; hasPermission: boolean }>(
      `${this.baseUrl}/check`,
      { params }
    );
    return response.data;
  }

  async getAllUsersWithPermissions() {
    const response = await api.get<{ success: boolean; data: UserWithPermissions[] }>(
      `${this.baseUrl}/users/all`
    );
    return response.data;
  }

  async grantSchoolDeptPermissions(data: {
    userId: string;
    departmentId: string;
    permissions: Record<string, boolean>;
    isPrimary?: boolean;
  }) {
    const response = await api.post<{ success: boolean; message: string; data: DepartmentPermission }>(
      `${this.baseUrl}/school-department/grant`,
      data
    );
    return response.data;
  }

  async grantCentralDeptPermissions(data: {
    userId: string;
    centralDeptId: string;
    permissions: Record<string, boolean>;
    isPrimary?: boolean;
    assignedMonthlyReportSchoolIds?: string[];
    assignedMonthlyReportDepartmentIds?: string[];
    assignedIprAnalyticsSchoolIds?: string[];
    assignedResearchAnalyticsSchoolIds?: string[];
    assignedBookAnalyticsSchoolIds?: string[];
    assignedConferenceAnalyticsSchoolIds?: string[];
    assignedGrantAnalyticsSchoolIds?: string[];
    assignedIprAnalyticsDepartmentIds?: string[];
    assignedResearchAnalyticsDepartmentIds?: string[];
    assignedBookAnalyticsDepartmentIds?: string[];
    assignedConferenceAnalyticsDepartmentIds?: string[];
    assignedGrantAnalyticsDepartmentIds?: string[];
    assignedDrdMemberAnalyticsSchoolIds?: string[];
    assignedDrdMemberAnalyticsDepartmentIds?: string[];
  }) {
    const response = await api.post<{
      success: boolean;
      message: string;
      data: CentralDepartmentPermission;
    }>(`${this.baseUrl}/central-department/grant`, data);
    return response.data;
  }

  async revokeSchoolDeptPermissions(userId: string, departmentId: string) {
    const response = await api.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/school-department/revoke`,
      { userId, departmentId }
    );
    return response.data;
  }

  async revokeCentralDeptPermissions(userId: string, centralDeptId: string) {
    const response = await api.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/central-department/revoke`,
      { userId, centralDeptId }
    );
    return response.data;
  }

  async assignRolesToUser(userId: string, roleIds: string[]) {
    const response = await api.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/assign-roles`,
      { userId, roleIds }
    );
    return response.data;
  }

  async assignDrdMemberSchools(userId: string, schoolIds: string[]) {
    const response = await api.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/drd-member/assign-schools`,
      { userId, schoolIds }
    );
    return response.data;
  }
}

export const permissionManagementService = new PermissionManagementService();
