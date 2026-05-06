import api from '@/shared/api/api';

export type RoleDepartmentType = 'SCHOOL' | 'CENTRAL' | 'BOTH';

export interface RoleAnalyticsCategoryScope {
  schools: string[];
  departments: string[];
}

export interface RoleAnalyticsScope {
  ipr?: RoleAnalyticsCategoryScope;
  research?: RoleAnalyticsCategoryScope;
  book?: RoleAnalyticsCategoryScope;
  conference?: RoleAnalyticsCategoryScope;
  grants?: RoleAnalyticsCategoryScope;
}

export interface RolePermissions {
  schoolDeptPermissions?: Record<string, boolean>;
  centralDeptPermissions?: Record<string, boolean>;
  analyticsScope?: RoleAnalyticsScope;
  seminarHallBlockIds?: string[];
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  departmentType: RoleDepartmentType;
  permissions: RolePermissions;
  requiresDepartmentAssignment: boolean;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleData {
  name: string;
  description?: string;
  departmentType?: RoleDepartmentType;
  permissions?: RolePermissions;
  requiresDepartmentAssignment?: boolean;
}

export interface UpdateRoleData {
  name?: string;
  description?: string;
  departmentType?: RoleDepartmentType;
  permissions?: RolePermissions;
  requiresDepartmentAssignment?: boolean;
  isActive?: boolean;
}

export interface ApplyRoleData {
  userId: string;
  roleId: string;
  departmentId?: string;
  centralDeptId?: string;
  isPrimary?: boolean;
}

export interface Permission {
  key: string;
  label: string;
  category: string;
  description?: string;
  type?: string;
}

export interface PermissionDefinitions {
  schoolDepartments: Permission[];
  centralDepartments: Record<string, Permission[]>;
}

class RoleManagementService {
  private baseUrl = '/roles';

  /**
   * Get all roles
   */
  async getAllRoles(params?: { isActive?: boolean; departmentType?: RoleDepartmentType }) {
    const response = await api.get<{ success: boolean; data: Role[] }>(
      `${this.baseUrl}/list`,
      { params }
    );
    return response.data;
  }

  /**
   * Get a single role by ID
   */
  async getRoleById(id: string) {
    const response = await api.get<{ success: boolean; data: Role }>(
      `${this.baseUrl}/${id}`
    );
    return response.data;
  }

  /**
   * Get role permissions (preview)
   */
  async getRolePermissions(id: string) {
    const response = await api.get<{ success: boolean; data: Role }>(
      `${this.baseUrl}/${id}/permissions`
    );
    return response.data;
  }

  /**
   * Get permission definitions for role creation
   */
  async getPermissionDefinitions() {
    const response = await api.get<{ success: boolean; data: PermissionDefinitions }>(
      `${this.baseUrl}/definitions/all`
    );
    return response.data;
  }

  /**
   * Create a new role
   */
  async createRole(data: CreateRoleData) {
    const response = await api.post<{ success: boolean; message: string; data: Role }>(
      `${this.baseUrl}/create`,
      data
    );
    return response.data;
  }

  /**
   * Update an existing role
   */
  async updateRole(id: string, data: UpdateRoleData) {
    const response = await api.put<{ success: boolean; message: string; data: Role }>(
      `${this.baseUrl}/${id}`,
      data
    );
    return response.data;
  }

  /**
   * Delete a role
   */
  async deleteRole(id: string) {
    const response = await api.delete<{ success: boolean; message: string }>(
      `${this.baseUrl}/${id}`
    );
    return response.data;
  }

  /**
   * Duplicate a role
   */
  async duplicateRole(id: string, newName: string) {
    const response = await api.post<{ success: boolean; message: string; data: Role }>(
      `${this.baseUrl}/${id}/duplicate`,
      { newName }
    );
    return response.data;
  }

  /**
   * Apply role permissions to a user
   */
  async applyRoleToUser(data: ApplyRoleData) {
    const response = await api.post<{
      success: boolean;
      message: string;
      data: {
        schoolDept: any | null;
        centralDept: any | null;
      };
    }>(`${this.baseUrl}/apply-to-user`, data);
    return response.data;
  }
}

export const roleManagementService = new RoleManagementService();
