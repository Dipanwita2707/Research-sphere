'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, 
  Shield, 
  TrendingUp, 
  Award,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Check,
  X,
  Calendar,
  DollarSign,
  User,
  Building,
  Clock,
  RefreshCw,
  Send
} from 'lucide-react';
import api from '@/shared/api/api';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

interface IPRItem {
  id: string;
  title: string;
  type: 'patent' | 'copyright' | 'trademark';
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'granted' | 'rejected';
  applicant: string;
  department: string;
  submissionDate: string;
  applicationNumber?: string;
  estimatedValue: number;
  priority: 'high' | 'medium' | 'low';
  description: string;
}

interface IPRModuleProps {
  permissions: string[];
}

export default function IPRModule({ permissions }: IPRModuleProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [iprItems, setIprItems] = useState<IPRItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    patents: 0,
    copyrights: 0,
    trademarks: 0,
    pending: 0,
    approved: 0,
    totalValue: 0,
    highPriority: 0
  });

  // Permission checks - Updated for granular permissions
  const canView = permissions.includes('view_all_ipr') || 
                  permissions.includes('view_own_ipr') || 
                  permissions.includes('view_projects');
  const canFile = permissions.includes('file_ipr');
  const canEditOwn = permissions.includes('edit_own_ipr');
  const canEditAll = permissions.includes('edit_all_ipr');
  const canReview = permissions.includes('review_ipr');
  const canApprove = permissions.includes('approve_ipr');
  const canDelete = permissions.includes('delete_ipr');
  const canManagePatents = permissions.includes('manage_patents');
  const canManageCopyrights = permissions.includes('manage_copyrights');
  const canManageTrademarks = permissions.includes('manage_trademarks');
  const canViewAnalytics = permissions.includes('ipr_analytics');
  const isIPRAdmin = permissions.includes('ipr_admin');

  useEffect(() => {
    if (canView) {
      fetchIPRData();
    }
  }, [canView]);

  const fetchIPRData = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/ipr-management', {
        params: {
          type: selectedType !== 'all' ? selectedType : undefined,
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          search: searchTerm || undefined
        }
      });

      if (response.data.success) {
        const data = response.data.data;
        setIprItems(data.items || []);
        
        // Update stats from API response
        if (data.statistics) {
          setStats({
            total: data.statistics.total || 0,
            patents: data.statistics.patents || 0,
            copyrights: data.statistics.copyrights || 0,
            trademarks: data.statistics.trademarks || 0,
            pending: data.statistics.pending || 0,
            approved: data.statistics.approved || 0,
            totalValue: data.statistics.totalValue || 0,
            highPriority: data.statistics.highPriority || 0
          });
        }
      }
    } catch (error: unknown) {
      logger.error('Error fetching IPR data:', error);
      // Load sample data on error
      loadSampleData();
    } finally {
      setIsLoading(false);
    }
  };

  const loadSampleData = () => {
    // No sample data - show empty state
    setIprItems([]);
    setStats({
      total: 0,
      patents: 0,
      copyrights: 0,
      trademarks: 0,
      pending: 0,
      approved: 0,
      totalValue: 0,
      highPriority: 0
    });
  };

  const handleSearch = () => {
    fetchIPRData();
  };

  const handleSubmitItem = async (itemId: string) => {
    try {
      setIsSubmitting(true);
      const response = await api.post(`/ipr-management/${itemId}/submit`);
      
      if (response.data.success) {
        await fetchIPRData(); // Refresh data
        toast({ type: 'success', message: 'IPR item submitted successfully!' });
      }
    } catch (error: unknown) {
      logger.error('Error submitting IPR item:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewItem = async (itemId: string, action: 'approve' | 'reject', comments?: string) => {
    try {
      const response = await api.post(`/ipr-management/${itemId}/review`, {
        action,
        comments
      });
      
      if (response.data.success) {
        await fetchIPRData(); // Refresh data
        toast({ type: 'success', message: `IPR item ${action}d successfully!` });
      }
    } catch (error: unknown) {
      logger.error('Error reviewing IPR item:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  if (!canView) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600">You don't have permission to view IPR management.</p>
      </div>
    );
  }

  const filteredItems = iprItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.applicant.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType ===
   'all' || item.type ===
   selectedType;
    const matchesStatus = selectedStatus ===
   'all' || item.status ===
   selectedStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      pending_mentor_approval: 'bg-orange-100 text-orange-800',
      submitted: 'bg-blue-100 text-blue-800',
      under_review: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      granted: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'patent': return <FileText className="w-4 h-4" />;
      case 'copyright': return <Shield className="w-4 h-4" />;
      case 'trademark': return <Award className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: 'border-l-red-500 bg-red-50',
      medium: 'border-l-yellow-500 bg-yellow-50',
      low: 'border-l-green-500 bg-green-50'
    };
    return colors[priority as keyof typeof colors] || 'border-l-gray-500 bg-gray-50';
  };

  // Statistics
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">IPR Management</h2>
            <p className="text-gray-600">Manage Intellectual Property Rights, Patents, and Research Assets</p>
          </div>
          {canFile && (
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
              <Plus className="w-4 h-4" />
              New IPR Application
            </button>
          )}
        </div>

        {/* Stats Cards - Only show when there's actual data */}
        {stats.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total IPR</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Patents</p>
                <p className="text-2xl font-bold text-purple-900">{stats.patents}</p>
              </div>
              <FileText className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Copyrights</p>
                <p className="text-2xl font-bold text-green-900">{stats.copyrights}</p>
              </div>
              <Shield className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Trademarks</p>
                <p className="text-2xl font-bold text-orange-900">{stats.trademarks}</p>
              </div>
              <Award className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">Pending</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">Approved</p>
                <p className="text-2xl font-bold text-emerald-900">{stats.approved}</p>
              </div>
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
          </div>

          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-600 font-medium">High Priority</p>
                <p className="text-2xl font-bold text-indigo-900">{stats.highPriority}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-indigo-600" />
            </div>
          </div>

          <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-pink-600 font-medium">Est. Value</p>
                <p className="text-lg font-bold text-pink-900">₹{(stats.totalValue / 100000).toFixed(1)}L</p>
              </div>
              <DollarSign className="w-8 h-8 text-pink-600" />
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Filters and Search */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by title, applicant, or department..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key ===
   'Enter' && handleSearch()}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setTimeout(handleSearch, 100);
              }}
            >
              <option value="all">All Types</option>
              <option value="patent">Patents</option>
              <option value="copyright">Copyrights</option>
              <option value="trademark">Trademarks</option>
            </select>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setTimeout(handleSearch, 100);
              }}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="granted">Granted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <button 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              onClick={handleSearch}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* IPR List */}
      <div className="p-6">
        {filteredItems.length ===
   0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No IPR Items Found</h3>
            <p className="text-gray-600 mb-4">No intellectual property items match your current filters.</p>
            {canFile && (
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                Add First IPR Item
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <div key={item.id} className={`border-l-4 rounded-lg p-6 ${getPriorityColor(item.priority)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getTypeIcon(item.type)}
                      <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(item.status)}`}>
                        {item.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 mb-4">{item.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Applicant:</span>
                        <span className="font-medium">{item.applicant}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Department:</span>
                        <span className="font-medium">{item.department}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Submitted:</span>
                        <span className="font-medium">{new Date(item.submissionDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Est. Value:</span>
                        <span className="font-medium">₹{(item.estimatedValue / 100000).toFixed(1)}L</span>
                      </div>
                    </div>
                    
                    {item.applicationNumber && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-600">Application Number:</span>
                        <span className="font-medium ml-2 bg-gray-100 px-2 py-1 rounded">{item.applicationNumber}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 ml-4">
                    <button 
                      className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {(canEditOwn || canEditAll) && (
                      <button 
                        className="text-green-600 hover:text-green-800 p-2 rounded-lg hover:bg-green-50 transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {item.status ===
   'draft' && canFile && (
                      <button 
                        className="text-purple-600 hover:text-purple-800 p-2 rounded-lg hover:bg-purple-50 transition-colors"
                        title="Submit for Review"
                        onClick={() => handleSubmitItem(item.id)}
                        disabled={isSubmitting}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    {(canApprove || canReview) && ['submitted', 'under_review'].includes(item.status) && (
                      <>
                        <button 
                          className="text-emerald-600 hover:text-emerald-800 p-2 rounded-lg hover:bg-emerald-50 transition-colors"
                          title="Approve"
                          onClick={() => handleReviewItem(item.id, 'approve', 'Approved by DRD')}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Reject"
                          onClick={() => handleReviewItem(item.id, 'reject', 'Rejected by DRD')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <div className="flex flex-wrap gap-4">
          {canManagePatents && (
            <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
              <FileText className="w-4 h-4" />
              Manage Patents
            </button>
          )}
          {canManageCopyrights && (
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
              <Shield className="w-4 h-4" />
              Manage Copyrights
            </button>
          )}
          {canManageTrademarks && (
            <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
              <Award className="w-4 h-4" />
              Manage Trademarks
            </button>
          )}
          {canViewAnalytics && (
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
              <TrendingUp className="w-4 h-4" />
              IPR Analytics
            </button>
          )}
        </div>
      </div>
    </div>
  );
}