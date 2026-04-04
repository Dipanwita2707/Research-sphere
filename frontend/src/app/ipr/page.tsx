'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import Link from 'next/link';
import { 
  FileText, 
  Lightbulb, 
  Copyright, 
  Palette, 
  Briefcase, 
  Plus, 
  Search, 
  Filter,
  Eye,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { iprService } from '@/features/ipr-management/services/ipr.service';
import { logger } from '@/shared/utils/logger';

const IPR_TYPES = [
  { 
    type: 'patent', 
    label: 'Patent', 
    icon: Lightbulb, 
    color: 'bg-blue-500', 
    description: 'Protect your inventions and innovations',
    href: '/ipr/apply?type=patent'
  },
  { 
    type: 'copyright', 
    label: 'Copyright', 
    icon: Copyright, 
    color: 'bg-green-500', 
    description: 'Protect your creative works and content',
    href: '/ipr/apply?type=copyright'
  },
  { 
    type: 'design', 
    label: 'Design', 
    icon: Palette, 
    color: 'bg-purple-500', 
    description: 'Protect your visual designs and aesthetics',
    href: '/ipr/apply?type=design'
  },
  { 
    type: 'entrepreneurship', 
    label: 'Entrepreneurship', 
    icon: Briefcase, 
    color: 'bg-orange-500', 
    description: 'Business ideas and startup concepts',
    href: '/ipr/apply?type=entrepreneurship'
  },
];

const STATUS_CONFIG = {
  draft: { label: 'Draft', icon: Edit, color: 'text-gray-600 bg-gray-100' },
  pending_mentor_approval: { label: 'Pending Mentor Approval', icon: UserCheck, color: 'text-orange-600 bg-orange-100' },
  submitted: { label: 'Submitted', icon: Clock, color: 'text-blue-600 bg-blue-100' },
  under_drd_review: { label: 'DRD Review', icon: Eye, color: 'text-yellow-600 bg-yellow-100' },
  drd_approved: { label: 'DRD Approved', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  under_dean_review: { label: 'Dean Review', icon: Eye, color: 'text-purple-600 bg-purple-100' },
  dean_approved: { label: 'Dean Approved', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  published: { label: 'Published', icon: CheckCircle, color: 'text-indigo-600 bg-indigo-100' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600 bg-red-100' },
};

export default function IPRDashboard() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingMentorCount, setPendingMentorCount] = useState(0);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchApplications();
    fetchMentorPendingCount();
  }, []);

  const fetchMentorPendingCount = async () => {
    try {
      const data = await iprService.getPendingMentorApprovals();
      setPendingMentorCount(data?.length || 0);
    } catch (error) {
      // User might not be a mentor, ignore error
      logger.debug('Not a mentor or no pending approvals');
    }
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const data = await iprService.getMyApplications();
      logger.debug('IPR Applications Response:', data);
      logger.debug('Raw applications:', data.data);
      
      // Filter out applications with null or undefined IDs
      const validApplications = (data.data || data || []).filter(app => {
        if (!app || !app.id) {
          logger.warn('Filtering out application with null/undefined ID:', app);
          return false;
        }
        return true;
      });
      logger.debug('Valid applications after filtering:', validApplications);
      setApplications(validApplications);
    } catch (error) {
      logger.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredApplications = applications.filter(app => {
    const matchesFilter = filter ===
   'all' || app.iprType ===
   filter;
    const matchesSearch = app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         app.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusInfo = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">IPR Management System</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your Intellectual Property Rights</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Only show mentor approvals if user is faculty and has pending mentor approvals */}
              {user?.userType ===
   'faculty' && pendingMentorCount > 0 && (
                <Link
                  href="/ipr/mentor-approvals"
                  className="relative bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-lg font-medium transition-colors flex items-center"
                >
                  <UserCheck className="w-5 h-5 mr-2" />
                  Mentor Approvals
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {pendingMentorCount}
                  </span>
                </Link>
              )}
              <Link
                href="/ipr/filing"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                New IPR Request
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* IPR Types Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">IPR Types</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {IPR_TYPES.map((iprType) => {
              const Icon = iprType.icon;
              return (
                <Link
                  key={iprType.type}
                  href={iprType.href}
                  className="group bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600"
                >
                  <div className={`w-12 h-12 ${iprType.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{iprType.label}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{iprType.description}</p>
                  <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
                    Apply Now
                    <Plus className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Applications Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Applications</h2>
            
            {/* Search and Filter */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search applications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="patent">Patent</option>
                <option value="copyright">Copyright</option>
                <option value="design">Design</option>
                <option value="entrepreneurship">Entrepreneurship</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading applications...</p>
              </div>
            </div>
          ) : filteredApplications.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Application
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Submitted
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredApplications.map((app) => {
                      const statusInfo = getStatusInfo(app.status);
                      const StatusIcon = statusInfo.icon;
                      
                      return (
                        <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{app.title}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                {app.description}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                              {app.iprType}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {new Date(app.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {app.id ? (
                              <Link
                                href={`/ipr/applications/${app.id}`}
                                className="text-blue-600 hover:text-blue-900 flex items-center"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Link>
                            ) : (
                              <span className="text-gray-400 flex items-center">
                                <Eye className="w-4 h-4 mr-1" />
                                Invalid ID
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12">
              <div className="text-center">
                <FileText className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Applications Found</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {searchQuery || filter !== 'all' 
                    ? 'No applications match your current filters.' 
                    : 'You haven\'t submitted any IPR applications yet.'
                  }
                </p>
                <Link
                  href="/ipr/filing"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Submit Your First Application
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        {applications.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Stats</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Applications</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{applications.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Review</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {applications.filter(app => 
                        ['submitted', 'under_drd_review', 'under_dean_review'].includes(app.status)
                      ).length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Approved</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {applications.filter(app => 
                        ['drd_approved', 'dean_approved', 'completed'].includes(app.status)
                      ).length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <Edit className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Drafts</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {applications.filter(app => app.status ===
   'draft').length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}