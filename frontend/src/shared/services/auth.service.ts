import api from '@/shared/api/api';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  userType: 'student' | 'staff' | 'admin' | 'faculty';
  firstName?: string;
  lastName?: string;
  uid?: string;
  profileImageUrl?: string;
  role?: {
    id: string;
    name: string;
    displayName?: string;
  };
  employee?: {
    empId: string;
    designation: string;
    displayName?: string;
  };
  employeeDetails?: {
    id: string;
    employeeId?: string;
    phone?: string;
    email?: string;
    joiningDate?: string;
    department?: {
      id: string;
      name: string;
      code?: string;
      school?: {
        id: string;
        name: string;
        code?: string;
      };
    };
    designation?: {
      id: string;
      name: string;
      code?: string;
    };
  };
  student?: {
    studentId: string;
    registrationNo: string;
    program?: string;
    semester?: number;
    displayName?: string;
  };
  permissions?: any[];
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    // Token is set as HTTP-only cookie by the server, no need to handle client-side
    return response.data;
  }

  async logout(): Promise<void> {
    await api.post('/auth/logout');
    // Cookie is cleared by the server
  }

  async getCurrentUser(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data.user;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.put('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  }

  async checkAuthentication(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const authService = new AuthService();
