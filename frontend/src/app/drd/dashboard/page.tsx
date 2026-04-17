'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { 
  FileText, 
  Search, 
  Plus, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Eye,
  BarChart3,
  ChevronRight
} from 'lucide-react';
import api from '@/shared/api/api';
import Link from 'next/link';
import logger from '@/shared/utils/logger';

interface DRDPermissions {
  canViewAllIPR: boolean;
  canViewOwnIPR: boolean;
  canFileIPR: boolean;
  canEditOwnIPR: boolean;
  canEditAllIPR: boolean;
  canReviewIPR: boolean;
  canRecommendIPR: boolean;
  canApproveIPR: boolean;
  canDeleteIPR: boolean;
  canViewAnalytics: boolean;
  canGenerateReports: boolean;
  canSystemAdmin: boolean;
  canAssignSchools?: boolean;
}

interface IPRStats {
  total: number;
  pending: number;
  underReview: number;
  approved: number;
  rejected: number;
  myApplications: number;
}

interface RecentApplication {
  id: string;
  title: string;
  type: string;
  status: string;
  submittedBy: string;
  submittedAt: string;
  applicantId?: string;
}

export default function DRDDashboardPage() {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<DRDPermissions>({
    canViewAllIPR: false,
    canViewOwnIPR: false,
    canFileIPR: false,
    canEditOwnIPR: false,
    canEditAllIPR: false,
    canReviewIPR: false,
    canRecommendIPR: false,
    canApproveIPR: false,
    canDeleteIPR: false,
    canViewAnalytics: false,
    canGenerateReports: false,
    canSystemAdmin: false,
  });
  const [stats, setStats] = useState<IPRStats>({
    total: 0,
    pending: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
    myApplications: 0,
  });
  const [recentApplications, setRecentApplications] = useState<RecentApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDRDData();
  }, []);

  const fetchDRDData = async () => {
    try {
      const permResponse = await api.get('/dashboard/staff');
      if (permResponse.data.success) {
        const userPerms = permResponse.data.data.permissions || [];
        const drdPerms = userPerms.find((p: any) => 
          p.category.toLowerCase().includes('drd') || 
          p.category.toLowerCase().includes('development') ||
          p.category.toLowerCase().includes('research')
        );
        
        if (drdPerms && Array.isArray(drdPerms.permissions)) {
          setPermissions(extractDRDPermissions(drdPerms.permissions));
        }
      }

      const statsResponse = await api.get('/ipr/stats');
      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }

      const applicationsResponse = await api.get('/ipr/?limit=5');
      if (applicationsResponse.data.success) {
        setRecentApplications(applicationsResponse.data.data);
      }
    } catch (error) {
      logger.error('Error fetching DRD data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const extractDRDPermissions = (perms: string[]): DRDPermissions => {
    const isFacultyOrStudent = user?.role?.name ===
   'faculty' || user?.role?.name ===
   'student';
    
    const hasIprFile = perms.includes('ipr_file_new') || 
                       perms.some(p => p.toLowerCase().includes('ipr_file') || p.toLowerCase().includes('file') && p.toLowerCase().includes('ipr'));
    const hasIprReview = perms.includes('ipr_review') || 
                         perms.some(p => p.toLowerCase() ===
   'ipr_review');
    const hasIprApprove = perms.includes('ipr_approve') || 
                          perms.some(p => p.toLowerCase() ===
   'ipr_approve');
    const hasIprAssignSchool = perms.includes('ipr_assign_school') || 
                               perms.some(p => p.toLowerCase() ===
   'ipr_assign_school');
    
    return {
      canViewAllIPR: hasIprReview || hasIprApprove || hasIprAssignSchool,
      canViewOwnIPR: isFacultyOrStudent || hasIprFile,
      canFileIPR: isFacultyOrStudent || hasIprFile,
      canEditOwnIPR: isFacultyOrStudent || hasIprFile,
      canEditAllIPR: false,
      canReviewIPR: hasIprReview,
      canRecommendIPR: hasIprReview,
      canApproveIPR: hasIprApprove,
      canDeleteIPR: false,
      canViewAnalytics: hasIprApprove,
      canGenerateReports: hasIprApprove,
      canSystemAdmin: false,
      canAssignSchools: hasIprAssignSchool,
    };
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      under_review: 'bg-blue-100 text-blue-700',
      pending: 'bg-yellow-100 text-yellow-700',
      pending_mentor_approval: 'bg-orange-100 text-orange-700',
    };
    return styles[status.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return <CheckCircle className="w-3 h-3" />;
      case 'rejected': return <AlertCircle className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-2 border-gray-200 rounded-full animate-spin border-t-lms-primary-mid"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-lms-header rounded-lg p-4 text-white">
        <h1 className="text-base font-semibold">Development & Research Department</h1>
        <p className="text-xs text-lms-very-light">Manage IPR applications, research projects, and development initiatives</p>
      </div>

      {/* Stats Cards */}
      {(permissions.canViewAllIPR || permissions.canViewOwnIPR) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="stat-card stat-card-blue cursor-pointer" onClick={() => window.location.href = '/ipr/all-applications'}>
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Total Applications</p>
                <p className="stat-value">{stats.total}</p>
              </div>
              <FileText className="stat-icon opacity-60" />
            </div>
          </div>

          <div className="stat-card stat-card-cream cursor-pointer" onClick={() => window.location.href = '/drd/review'}>
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Pending Review</p>
                <p className="stat-value">{stats.pending}</p>
              </div>
              <Clock className="stat-icon opacity-60" />
            </div>
          </div>

          <div className="stat-card stat-card-purple">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Under Review</p>
                <p className="stat-value">{stats.underReview}</p>
              </div>
              <Search className="stat-icon opacity-60" />
            </div>
          </div>

          <div className="stat-card stat-card-green">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Approved</p>
                <p className="stat-value">{stats.approved}</p>
              </div>
              <CheckCircle className="stat-icon opacity-60" />
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* IPR Management */}
        <div className="section-card">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">IPR Management</h2>
          <div className="space-y-2">
            {permissions.canFileIPR && (
              <Link href="/ipr/apply" className="flex items-center justify-between p-2.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-xs font-medium text-blue-900">File New IPR</p>
                    <p className="text-[10px] text-blue-700">Submit patent, copyright, or trademark</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-400 group-hover:text-blue-600" />
              </Link>
            )}

            {(permissions.canViewAllIPR || permissions.canViewOwnIPR) && (
              <Link href={permissions.canViewAllIPR ? "/ipr/all-applications" : "/ipr/my-applications"} className="flex items-center justify-between p-2.5 bg-green-50 hover:bg-green-100 rounded-lg transition-colors group">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-xs font-medium text-green-900">{permissions.canViewAllIPR ? 'All Applications' : 'My Applications'}</p>
                    <p className="text-[10px] text-green-700">View and manage applications</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-green-400 group-hover:text-green-600" />
              </Link>
            )}

            {permissions.canReviewIPR && (
              <Link href="/drd/review" className="flex items-center justify-between p-2.5 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-purple-600" />
                  <div>
                    <p className="text-xs font-medium text-purple-900">Review Applications</p>
                    <p className="text-[10px] text-purple-700">Review and provide feedback</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-purple-400 group-hover:text-purple-600" />
              </Link>
            )}
          </div>
        </div>

        {/* Analytics & Reports */}
        {(permissions.canViewAnalytics || permissions.canGenerateReports) && (
          <div className="section-card">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Analytics & Reports</h2>
            <div className="space-y-2">
              {permissions.canViewAnalytics && (
                <Link href="/drd/analytics" className="flex items-center justify-between p-2.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors group">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <div>
                      <p className="text-xs font-medium text-indigo-900">IPR Analytics</p>
                      <p className="text-[10px] text-indigo-700">View trends and insights</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600" />
                </Link>
              )}

              {permissions.canGenerateReports && (
                <Link href="/drd/reports" className="flex items-center justify-between p-2.5 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors group">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-orange-600" />
                    <div>
                      <p className="text-xs font-medium text-orange-900">Generate Reports</p>
                      <p className="text-[10px] text-orange-700">Create detailed IPR reports</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-orange-400 group-hover:text-orange-600" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recent Applications */}
      {(permissions.canViewAllIPR || permissions.canViewOwnIPR) && recentApplications.length > 0 && (
        <div className="section-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">Recent Applications</h2>
            <Link href={permissions.canViewAllIPR ? "/ipr/all-applications" : "/ipr/my-applications"} className="text-xs text-lms-primary hover:text-lms-primary-dark font-medium">
              View All →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-compact">
                  <th className="text-left">Title</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Submitted By</th>
                  <th className="text-left">Date</th>
                  <th className="text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentApplications.map((app) => (
                  <tr key={app.id} className="table-compact hover:bg-gray-50">
                    <td className="font-medium text-gray-900 max-w-[200px] truncate">{app.title}</td>
                    <td className="text-gray-600">{app.type}</td>
                    <td className="text-gray-600">{app.submittedBy}</td>
                    <td className="text-gray-500">{new Date(app.submittedAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusBadge(app.status)}`}>
                        {getStatusIcon(app.status)}
                        {app.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Permissions State */}
      {!Object.values(permissions).some(Boolean) && (
        <div className="section-card text-center py-8">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-700 mb-1">No DRD Permissions</h3>
          <p className="text-xs text-gray-500 mb-3">Contact your administrator to request access to DRD features.</p>
          <Link href="/ipr/my-applications" className="text-xs text-lms-primary hover:text-lms-primary-dark font-medium">
            View My Applications →
          </Link>
        </div>
      )}
    </div>
  );
}
