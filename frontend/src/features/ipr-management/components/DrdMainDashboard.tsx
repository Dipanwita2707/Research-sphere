'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/auth/authStore';
import { permissionManagementService } from '@/features/admin-management/services/permissionManagement.service';
import { logger } from '@/shared/utils/logger';
import { drdReviewService, iprService } from '@/features/ipr-management/services/ipr.service';
import { 
  Beaker, 
  FolderOpen, 
  BookOpen, 
  FileText, 
  Award, 
  BarChart3,
  Settings,
  ChevronRight,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Plus,
  UserCheck
} from 'lucide-react';
import Link from 'next/link';

interface DrdPermission {
  key: string;
  label: string;
  category: string;
  type: 'view' | 'action';
  description?: string;
}

interface PermissionCategory {
  category: string;
  icon: React.ReactNode;
  color: string;
  permissions: DrdPermission[];
  route?: string;
}

export default function DrdMainDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingReviews: 0,
    pendingApprovals: 0,
    activeProjects: 0,
    totalPublications: 0
  });
  const [pendingMentorApprovals, setPendingMentorApprovals] = useState<any[]>([]);
  const [mentorLoading, setMentorLoading] = useState(false);

  // Simplified permission categories - focused on IPR and Research workflow
  const permissionCategories: PermissionCategory[] = [
    {
      category: 'IPR Review & Management',
      icon: <FileText className="w-6 h-6" />,
      color: 'blue',
      route: '/drd/review',
      permissions: []
    },
    {
      category: 'Research Review & Management',
      icon: <BookOpen className="w-6 h-6" />,
      color: 'purple',
      route: '/drd/research',
      permissions: []
    },
    {
      category: 'IPR School Assignment',
      icon: <Users className="w-6 h-6" />,
      color: 'amber',
      route: '/admin/drd-school-assignment',
      permissions: []
    },
    {
      category: 'Research School Assignment',
      icon: <Users className="w-6 h-6" />,
      color: 'pink',
      route: '/admin/research-school-assignment',
      permissions: []
    },
    {
      category: 'Analytics & Reports',
      icon: <BarChart3 className="w-6 h-6" />,
      color: 'green',
      route: '/drd/analytics',
      permissions: []
    }
  ];

  useEffect(() => {
    if (user?.id) {
      fetchUserPermissions();
      fetchStats();
      // Fetch mentor approvals for faculty
      if (user?.userType ===
   'faculty') {
        fetchMentorApprovals();
      }
    }
  }, [user]);

  const fetchMentorApprovals = async () => {
    try {
      setMentorLoading(true);
      const data = await iprService.getPendingMentorApprovals();
      setPendingMentorApprovals(data || []);
    } catch (error) {
      logger.debug('Not a mentor or no pending approvals');
      setPendingMentorApprovals([]);
    } finally {
      setMentorLoading(false);
    }
  };

  const fetchUserPermissions = async () => {
    try {
      setLoading(true);
      const response = await permissionManagementService.getUserPermissions(user!.id);
      
      // Extract ALL permissions from centralDepartments (includes both direct and role-based)
      const drdPermissions: Record<string, boolean> = {};
      response.data.centralDepartments.forEach(dept => {
        const perms = dept.permissions || {};
        // Merge all permissions - the backend already includes role-based permissions
        if (typeof perms ===
   'object') {
          Object.keys(perms).forEach(key => {
            if (perms[key] ===
   true) {
              drdPermissions[key] = true;
            }
          });
        }
      });
      
      setUserPermissions(drdPermissions);
    } catch (error) {
      logger.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Fetch real statistics from the API
      const statistics = await drdReviewService.getStatistics();
      setStats({
        pendingReviews: statistics.pendingApplications || 0,
        pendingApprovals: statistics.pendingHeadApproval || 0,
        activeProjects: statistics.activeApplications || 0,
        totalPublications: statistics.completedApplications || 0
      });
    } catch (error) {
      logger.error('Error fetching stats:', error);
      // Keep default values of 0 on error
    }
  };

  // Simplified 4-permission system for IPR, Research, and Books
  const hasViewPermission = (category: string) => {
    // Based on permissions: ipr_file_new, ipr_review, ipr_approve, ipr_assign_school
    // and research_file_new, research_review, research_approve, research_assign_school
    // and book_file_new, book_review, book_approve, book_assign_school
    const viewPermissionKeys: Record<string, string[]> = {
      'IPR Review & Management': ['ipr_review', 'ipr_approve'],
      'Research Review & Management': ['research_review', 'research_approve'],
      'Book Review & Management': ['book_review', 'book_approve'],
      'IPR School Assignment': ['ipr_assign_school'],
      'Research School Assignment': ['research_assign_school'],
      'Book School Assignment': ['book_assign_school'],
      'Analytics & Reports': [
        'applicant_analytics',
        'drd_member_analytics',
        'ipr_applicant_analytics',
        'research_applicant_analytics',
        'book_applicant_analytics',
        'conference_applicant_analytics',
        'grant_applicant_analytics',
        'ipr_approve',
        'research_approve',
        'book_approve',
      ],
    };
    
    const requiredPerms = viewPermissionKeys[category] || [];
    return requiredPerms.some(perm => userPermissions[perm]);
  };

  const getActionPermissions = (category: string) => {
    // Permission action map for IPR, Research, and Books
    const actionPermissionMap: Record<string, string[]> = {
      'IPR Review & Management': ['ipr_review', 'ipr_approve'],
      'Research Review & Management': ['research_review', 'research_approve'],
      'Book Review & Management': ['book_review', 'book_approve'],
      'IPR School Assignment': ['ipr_assign_school'],
      'Research School Assignment': ['research_assign_school'],
      'Book School Assignment': ['book_assign_school'],
      'Analytics & Reports': [
        'applicant_analytics',
        'drd_member_analytics',
        'ipr_applicant_analytics',
        'research_applicant_analytics',
        'book_applicant_analytics',
        'conference_applicant_analytics',
        'grant_applicant_analytics',
        'ipr_approve',
        'research_approve',
        'book_approve',
      ],
    };

    return (actionPermissionMap[category] || []).filter(
      key => userPermissions[key]
    );
  };

  const navigateToSection = (route: string) => {
    router.push(route);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading DRD Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#005b96] dark:bg-blue-600 flex items-center justify-center">
            <Beaker className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            DRD Dashboard
          </h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Research management, IPR applications, grants, and publications
        </p>
      </div>

      {/* Quick Stats - LMS Style Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border-l-4 border-[#e74c3c] shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Pending Reviews</p>
              <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{stats.pendingReviews}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Awaiting review</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#fdeaea] dark:bg-red-900/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-[#e74c3c]" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border-l-4 border-[#f39c12] shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Pending Approvals</p>
              <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{stats.pendingApprovals}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Awaiting approval</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#fef5e7] dark:bg-yellow-900/30 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-[#f39c12]" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border-l-4 border-[#005b96] shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Active Applications</p>
              <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{stats.activeProjects}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">In pipeline</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#e6f2fa] dark:bg-blue-900/30 flex items-center justify-center">
              <Beaker className="w-6 h-6 text-[#005b96] dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border-l-4 border-[#27ae60] shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Approved</p>
              <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{stats.totalPublications}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Completed applications</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#e8f8ef] dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-[#27ae60]" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions - Based on Permissions or user type */}
      {(userPermissions.ipr_file_new || userPermissions.research_file_new || userPermissions.book_file_new || userPermissions.grant_file_new || userPermissions.ipr_review || userPermissions.research_review || userPermissions.book_review || userPermissions.grant_review || userPermissions.conference_review || userPermissions.ipr_assign_school || userPermissions.research_assign_school || userPermissions.book_assign_school || userPermissions.grant_assign_school || userPermissions.conference_assign_school || user?.userType ===
   'faculty' || user?.userType ===
   'student') && (
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#005b96] dark:text-blue-400" />
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            {(userPermissions.ipr_file_new || user?.userType ===
   'faculty' || user?.userType ===
   'student') && (
              <Link
                href="/ipr/apply"
                className="flex items-center gap-2 px-5 py-3 bg-[#005b96] dark:bg-blue-600 text-white rounded-xl hover:bg-[#03396c] dark:hover:bg-blue-700 hover:shadow-lg transition-all font-medium"
              >
                <Plus className="w-4 h-4" />
                File New IPR Application
              </Link>
            )}
            {(userPermissions.ipr_file_new || user?.userType ===
   'faculty' || user?.userType ===
   'student') && (
              <Link
                href="/ipr/my-applications"
                className="flex items-center gap-2 px-5 py-3 bg-[#e6f2fa] dark:bg-blue-900/30 text-[#005b96] dark:text-blue-400 border border-[#b3d4fc] dark:border-blue-800 rounded-xl hover:bg-[#d4e9f7] dark:hover:bg-blue-900/50 transition-all font-medium"
              >
                <FolderOpen className="w-4 h-4" />
                My Applications
              </Link>
            )}
            {userPermissions.ipr_review && (
              <Link
                href="/drd/review"
                className="flex items-center gap-2 px-5 py-3 bg-[#e6f2fa] dark:bg-blue-900/30 text-[#005b96] dark:text-blue-400 border border-[#b3d4fc] dark:border-blue-800 rounded-xl hover:bg-[#d4e9f7] dark:hover:bg-blue-900/50 transition-all font-medium"
              >
                <FileText className="w-4 h-4" />
                Review Applications
              </Link>
            )}
            {userPermissions.ipr_assign_school && (
              <Link
                href="/admin/drd-school-assignment"
                className="flex items-center gap-2 px-5 py-3 bg-[#e6f2fa] dark:bg-blue-900/30 text-[#005b96] dark:text-blue-400 border border-[#b3d4fc] dark:border-blue-800 rounded-xl hover:bg-[#d4e9f7] dark:hover:bg-blue-900/50 transition-all font-medium"
              >
                <Users className="w-4 h-4" />
                Assign Schools
              </Link>
            )}
            {(userPermissions.research_file_new || user?.userType ===
   'faculty' || user?.userType ===
   'student') && (
              <Link
                href="/research/apply"
                className="flex items-center gap-2 px-5 py-3 bg-purple-600 dark:bg-purple-700 text-white rounded-xl hover:bg-purple-700 dark:hover:bg-purple-800 hover:shadow-lg transition-all font-medium"
              >
                <Plus className="w-4 h-4" />
                File New Research Contribution
              </Link>
            )}
            {(userPermissions.research_file_new || user?.userType ===
   'faculty' || user?.userType ===
   'student') && (
              <Link
                href="/research/my-contributions"
                className="flex items-center gap-2 px-5 py-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all font-medium"
              >
                <FolderOpen className="w-4 h-4" />
                My Research Contributions
              </Link>
            )}
            {userPermissions.research_review && (
              <Link
                href="/drd/research"
                className="flex items-center gap-2 px-5 py-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all font-medium"
              >
                <BookOpen className="w-4 h-4" />
                Review Research Contributions
              </Link>
            )}
            {userPermissions.research_assign_school && (
              <Link
                href="/admin/research-school-assignment"
                className="flex items-center gap-2 px-5 py-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all font-medium"
              >
                <Users className="w-4 h-4" />
                Assign Research Schools
              </Link>
            )}
            {/* Book/Book Chapter Section */}
            {userPermissions.book_review && (
              <Link
                href="/drd/book"
                className="flex items-center gap-2 px-5 py-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/50 transition-all font-medium"
              >
                <BookOpen className="w-4 h-4" />
                Review Book/Chapter Contributions
              </Link>
            )}
            {userPermissions.book_assign_school && (
              <Link
                href="/admin/book-school-assignment"
                className="flex items-center gap-2 px-5 py-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/50 transition-all font-medium"
              >
                <Users className="w-4 h-4" />
                Assign Book Schools
              </Link>
            )}
            {/* Grant Section */}
            {userPermissions.grant_review && (
              <Link
                href="/drd/research"
                className="flex items-center gap-2 px-5 py-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all font-medium"
              >
                <Award className="w-4 h-4" />
                Review Grant Applications
              </Link>
            )}
            {userPermissions.grant_assign_school && (
              <Link
                href="/admin/grant-school-assignment"
                className="flex items-center gap-2 px-5 py-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all font-medium"
              >
                <Users className="w-4 h-4" />
                Assign Grant Schools
              </Link>
            )}
            {/* Conference Section */}
            {userPermissions.conference_review && (
              <Link
                href="/drd/research"
                className="flex items-center gap-2 px-5 py-3 bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800 rounded-xl hover:bg-pink-100 dark:hover:bg-pink-900/50 transition-all font-medium"
              >
                <FileText className="w-4 h-4" />
                Review Conference Papers
              </Link>
            )}
            {userPermissions.conference_assign_school && (
              <Link
                href="/admin/conference-school-assignment"
                className="flex items-center gap-2 px-5 py-3 bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800 rounded-xl hover:bg-pink-100 dark:hover:bg-pink-900/50 transition-all font-medium"
              >
                <Users className="w-4 h-4" />
                Assign Conference Schools
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Mentor Approvals Section - For all faculty users */}
      {user?.userType ===
   'faculty' && (
        <div className={`mb-8 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border ${pendingMentorApprovals.length > 0 ? 'border-orange-200 dark:border-orange-800' : 'border-gray-100 dark:border-gray-700'}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <UserCheck className={`w-5 h-5 ${pendingMentorApprovals.length > 0 ? 'text-orange-500' : 'text-blue-500'}`} />
              Mentor Approvals
              {pendingMentorApprovals.length > 0 && (
                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full ml-2">
                  {pendingMentorApprovals.length}
                </span>
              )}
            </h2>
            <Link
              href="/ipr/mentor-approvals"
              className={`${pendingMentorApprovals.length > 0 ? 'text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300' : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'} text-sm font-medium flex items-center gap-1`}
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {pendingMentorApprovals.length > 0 
              ? 'Students have selected you as their mentor for the following IPR applications. Please review and approve or request changes.'
              : 'Review and track IPR applications where you are assigned as the mentor.'}
          </p>
          {pendingMentorApprovals.length > 0 ? (
            <div className="space-y-3">
              {pendingMentorApprovals.slice(0, 5).map((app: any) => (
                <div key={app.id} className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800 dark:text-white">{app.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {app.iprType?.toUpperCase()} • {app.applicationNumber || 'Pending Number'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Submitted by: {app.applicantUser?.studentLogin?.displayName || app.applicantUser?.studentLogin?.firstName || 'Student'}
                    </p>
                  </div>
                  <Link
                    href={`/ipr/mentor-approvals?id=${app.id}`}
                    className="px-4 py-2 bg-orange-500 dark:bg-orange-600 text-white rounded-lg hover:bg-orange-600 dark:hover:bg-orange-700 transition-colors text-sm font-medium"
                  >
                    Review
                  </Link>
                </div>
              ))}
              {pendingMentorApprovals.length > 5 && (
                <div className="mt-4 text-center">
                  <Link
                    href="/ipr/mentor-approvals"
                    className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 text-sm font-medium"
                  >
                    View all {pendingMentorApprovals.length} pending approvals →
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="text-gray-600 dark:text-gray-300 font-medium">No pending approvals</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Click "View All" to see your mentee application history</p>
            </div>
          )}
        </div>
      )}

      {/* Permission-based Navigation Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {permissionCategories.map((categoryInfo) => {
          const hasView = hasViewPermission(categoryInfo.category);
          const actionPermissions = getActionPermissions(categoryInfo.category);
          
          if (!hasView && actionPermissions.length ===
   0) {
            return null; // Hide section if no permissions
          }

          const colorMap: Record<string, { bg: string; border: string; iconBg: string; text: string }> = {
            'blue': { bg: '#e6f2fa', border: '#005b96', iconBg: '#005b96', text: '#005b96' },
            'purple': { bg: '#f3e8ff', border: '#9333ea', iconBg: '#9333ea', text: '#9333ea' },
            'amber': { bg: '#fef5e7', border: '#f39c12', iconBg: '#f39c12', text: '#f39c12' },
            'pink': { bg: '#fce7f3', border: '#ec4899', iconBg: '#ec4899', text: '#ec4899' },
            'green': { bg: '#e8f8ef', border: '#27ae60', iconBg: '#27ae60', text: '#27ae60' },
          };
          const colors = colorMap[categoryInfo.color] || colorMap['blue'];

          return (
            <div
              key={categoryInfo.category}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 overflow-hidden"
            >
              <div className="h-1" style={{ backgroundColor: colors.border }}></div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: colors.iconBg }}>
                      <div className="text-white">{categoryInfo.icon}</div>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                        {categoryInfo.category}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {hasView ? 'Full access' : 'Limited access'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Access Level Indicator */}
                <div className="mb-4">
                  {hasView ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#e8f8ef] dark:bg-green-900/30 text-[#27ae60] dark:text-green-400">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Dashboard Access
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      <XCircle className="w-3 h-3 mr-1" />
                      No Dashboard Access
                    </span>
                  )}
                </div>

                {/* Available Actions */}
                {actionPermissions.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Available Actions:</p>
                    <div className="space-y-1">
                      {actionPermissions.map((permission) => (
                        <div key={permission} className="text-xs text-gray-600 dark:text-gray-300 flex items-center">
                          <CheckCircle className="w-3 h-3 mr-2 text-[#27ae60]" />
                          {getPermissionLabel(permission)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Navigation Button */}
                {hasView && (
                  <button
                    onClick={() => navigateToSection(categoryInfo.route!)}
                    className="mt-2 w-full px-4 py-2.5 text-white rounded-xl transition-colors flex items-center justify-center text-sm font-medium"
                    style={{ backgroundColor: colors.border }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                    onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    Access {categoryInfo.category.split(' ')[0]}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* No DRD Permissions Message - Show when user only has filing permission or no permissions */}
      {!userPermissions.ipr_review && !userPermissions.research_review && !userPermissions.ipr_approve && !userPermissions.research_approve && !userPermissions.ipr_assign_school && !userPermissions.research_assign_school && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="w-16 h-16 rounded-full bg-[#e6f2fa] dark:bg-blue-900/30 mx-auto flex items-center justify-center">
            <Shield className="h-8 w-8 text-[#005b96] dark:text-blue-400" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-800 dark:text-white">No DRD Review Permissions</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            {(userPermissions.ipr_file_new || userPermissions.research_file_new)
              ? 'You can file applications but do not have DRD review permissions. Use the dashboards for filing and tracking your applications.'
              : "You don't have any DRD permissions assigned. Contact your administrator to request access."
            }
          </p>
          <div className="flex gap-3 justify-center mt-4">
            {userPermissions.ipr_file_new && (
              <Link
                href="/ipr"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#005b96] dark:bg-blue-600 text-white rounded-xl hover:bg-[#03396c] dark:hover:bg-blue-700 transition-all font-medium"
              >
                <FileText className="w-4 h-4" />
                Go to IPR Dashboard
              </Link>
            )}
            {userPermissions.research_file_new && (
              <Link
                href="/research/my-contributions"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 dark:bg-purple-700 text-white rounded-xl hover:bg-purple-700 dark:hover:bg-purple-800 transition-all font-medium"
              >
                <BookOpen className="w-4 h-4" />
                Go to Research Dashboard
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to get readable permission labels - Simplified 4 permissions for IPR, Research, Books, Grants, Conferences
function getPermissionLabel(permissionKey: string): string {
  const labels: Record<string, string> = {
    'ipr_file_new': 'File New IPR Applications',
    'ipr_review': 'Review IPR Applications',
    'ipr_approve': 'Final Approve/Reject IPR',
    'ipr_assign_school': 'Assign Schools to DRD Members (IPR)',
    'research_file_new': 'File New Research Contributions',
    'research_review': 'Review Research Contributions',
    'research_approve': 'Final Approve/Reject Research',
    'research_assign_school': 'Assign Schools to Research Reviewers',
    'book_file_new': 'File New Book/Chapter Contributions',
    'book_review': 'Review Book/Chapter Contributions',
    'book_approve': 'Final Approve/Reject Books',
    'book_assign_school': 'Assign Schools to Book Reviewers',
    'grant_file_new': 'File New Grant Applications',
    'grant_review': 'Review Grant Applications',
    'grant_approve': 'Final Approve/Reject Grants',
    'grant_assign_school': 'Assign Schools to Grant Reviewers',
    'conference_file_new': 'File New Conference Papers',
    'conference_review': 'Review Conference Papers',
    'conference_approve': 'Final Approve/Reject Conferences',
    'conference_assign_school': 'Assign Schools to Conference Reviewers',
    'applicant_analytics': 'View Applicant Analytics',
    'drd_member_analytics': 'View DRD Member Analytics',
    'ipr_applicant_analytics': 'View IPR Applicant Analytics',
    'research_applicant_analytics': 'View Research Applicant Analytics',
    'book_applicant_analytics': 'View Book Applicant Analytics',
    'conference_applicant_analytics': 'View Conference Applicant Analytics',
    'grant_applicant_analytics': 'View Grant Applicant Analytics',
  };
  
  return labels[permissionKey] || permissionKey;
}
