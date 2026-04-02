import api from '@/shared/api/api';

export interface ReportingRelationship {
  id: string;
  userId: string;
  managerId: string;
  hierarchyDepth: number;
  hierarchyPath: string[];
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    uid: string;
    email: string;
    employeeDetails?: {
      displayName: string;
      empId: string;
      primaryDepartment?: {
        departmentName: string;
      };
      primarySchool?: {
        facultyName: string;
      };
    };
  };
  manager?: {
    id: string;
    uid: string;
    email: string;
    employeeDetails?: {
      displayName: string;
      empId: string;
    };
  };
}

export interface HierarchyNode {
  id: string;
  userId: string;
  uid?: string;
  name: string;
  email: string;
  empId?: string;
  department?: string;
  departmentId?: string | null;
  departmentScope?: 'school' | 'central' | null;
  departmentCode?: string | null;
  departmentType?: string | null;
  school?: string;
  managerId?: string;
  hierarchyDepth: number;
  children?: HierarchyNode[];
}

export interface ReportingDepartmentOption {
  id: string;
  scope: 'school' | 'central';
  name: string;
  code?: string | null;
  shortName?: string | null;
  facultyId?: string | null;
  facultyName?: string | null;
  departmentType?: string | null;
  displayLabel: string;
}

export interface ReportingChainUser {
  id: string;
  uid: string;
  email: string;
  displayName?: string;
  empId?: string;
  level: number;
}

export interface ReportingDepartmentContext {
  departmentScope: 'school' | 'central';
  departmentId: string;
}

export interface AssignManagerRequest {
  userId: string;
  managerId: string;
  departmentScope: 'school' | 'central';
  departmentId: string;
}

export interface AssignManagerChainRequest {
  userId: string;
  managerChain: string[]; // Array of manager IDs from Level 1 to Level N
  departmentScope: 'school' | 'central';
  departmentId: string;
}

export interface BulkImportRequest {
  relationships: Array<{
    userId: string;
    managerId: string;
  }>;
}

export interface MoveUserRequest {
  userId: string;
  newManagerId: string;
  departmentScope: 'school' | 'central';
  departmentId: string;
}

export interface UserHierarchyInfo {
  isInHierarchy: boolean;
  currentLevel: number;
  parentId: string | null;
  parentName: string | null;
  subordinateCount: number;
  hierarchyPath: string;
}

export type BulkHierarchyInfoMap = Record<string, UserHierarchyInfo | null>;

export const reportingStructureService = {
  /**
   * Get full reporting hierarchy tree
   */
  async getHierarchyTree(context?: ReportingDepartmentContext) {
    const response = await api.get<{ success: boolean; data: HierarchyNode[] }>(
      '/reporting-structure/tree',
      {
        params: context,
      },
    );
    return response.data;
  },

  /**
   * Get all active department options (school + central)
   */
  async getDepartmentOptions(options?: { withHierarchyOnly?: boolean }) {
    const response = await api.get<{ success: boolean; data: ReportingDepartmentOption[] }>(
      '/reporting-structure/departments',
      {
        params: options?.withHierarchyOnly ? { withHierarchyOnly: true } : undefined,
      }
    );
    return response.data;
  },

  /**
   * Get reporting chain for a specific user
   */
  async getReportingChain(userId: string, context?: ReportingDepartmentContext) {
    const response = await api.get<{ success: boolean; data: ReportingChainUser[] }>(
      `/reporting-structure/chain/${userId}`,
      {
        params: context,
      },
    );
    return response.data;
  },

  /**
   * Get direct manager for a user
   */
  async getDirectManager(userId: string, context?: ReportingDepartmentContext) {
    const response = await api.get<{ success: boolean; data: ReportingRelationship | null }>(
      `/reporting-structure/manager/${userId}`,
      {
        params: context,
      },
    );
    return response.data;
  },

  /**
   * Get subordinates of a user
   */
  async getSubordinates(userId: string, directOnly: boolean = false, context?: ReportingDepartmentContext) {
    const response = await api.get<{ success: boolean; data: ReportingRelationship[] }>(
      `/reporting-structure/subordinates/${userId}`,
      {
        params: {
          direct: directOnly,
          ...context,
        },
      }
    );
    return response.data;
  },

  /**
   * Assign reporting manager to a user
   */
  async assignReportingManager(request: AssignManagerRequest) {
    const response = await api.post<{ success: boolean; data: ReportingRelationship; message: string }>(
      '/reporting-structure/assign',
      request
    );
    return response.data;
  },

  /**   * Assign multi-level manager chain
   */
  async assignManagerChain(request: AssignManagerChainRequest) {
    const response = await api.post<{ 
      success: boolean; 
      data: { 
        created: number; 
        relationships: ReportingRelationship[] 
      }; 
      message: string 
    }>(
      '/reporting-structure/assign-chain',
      request
    );
    return response.data;
  },

  /**   * Remove reporting relationship
   */
  async removeReportingRelationship(userId: string, context: ReportingDepartmentContext) {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/reporting-structure/${userId}`,
      {
        params: context,
      },
    );
    return response.data;
  },

  /**
   * Bulk import reporting structure
   */
  async bulkImportReportingStructure(request: BulkImportRequest) {
    const response = await api.post<{
      success: boolean;
      data: {
        success: Array<{ userId: string; managerId: string }>;
        failed: Array<{ userId: string; managerId: string; reason: string }>;
      };
      message: string;
    }>('/reporting-structure/bulk-import', request);
    return response.data;
  },

  /**
   * Move a user to a new position in the hierarchy
   * Atomically removes from current position and inserts under new manager
   */
  async moveUser(request: MoveUserRequest) {
    const response = await api.post<{
      success: boolean;
      data: ReportingRelationship;
      message: string;
    }>('/reporting-structure/move', request);
    return response.data;
  },

  /**
   * Get hierarchy info for multiple users (batch)
   * Returns level, parent, subordinate count for users already in hierarchy
   */
  async getBulkHierarchyInfo(userIds: string[], context?: ReportingDepartmentContext) {
    const response = await api.post<{
      success: boolean;
      data: BulkHierarchyInfoMap;
    }>('/reporting-structure/hierarchy-info', {
      userIds,
      ...context,
    });
    return response.data;
  },

  /**
   * Get all users (for manager selection)
   */
  async getAllUsers() {
    const response = await api.get<{
      success: boolean;
      data: Array<{
        id: string;
        uid: string;
        email: string;
        role: string;
        employeeDetails?: {
          firstName?: string;
          lastName?: string;
          displayName?: string;
          empId?: string;
          designation?: string | { designationName: string; roleCode?: string };
          primaryDepartment?: {
            id: string;
            departmentName: string;
            departmentCode?: string;
          };
          primaryCentralDept?: {
            id: string;
            departmentName: string;
            departmentCode?: string;
            departmentType?: string | null;
          };
          primarySchool?: { facultyName: string };
        };
      }>;
    }>('/users');
    return response.data;
  },
};
