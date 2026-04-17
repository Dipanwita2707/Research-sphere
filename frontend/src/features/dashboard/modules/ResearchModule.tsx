'use client';

import { useState, useEffect } from 'react';
import { FileText, Plus, Search, Filter, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';

interface ResearchModuleProps {
  permissions: string[];
}

interface ResearchProject {
  id: number;
  title: string;
  pi: string;
  department: string;
  startDate: string;
  endDate: string;
  budget: number;
  status: string;
  progress: number;
  type: string;
}

export default function ResearchModule({ permissions }: ResearchModuleProps) {
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const hasPermission = (permission: string) => permissions.includes(permission);

  const canView = hasPermission('view_research') || hasPermission('view_projects');
  const canAdd = hasPermission('add_research') || hasPermission('add_projects');
  const canEdit = hasPermission('edit_research') || hasPermission('edit_projects');
  const canApprove = hasPermission('approve_research') || hasPermission('approve_projects');

  useEffect(() => {
    if (canView) {
      fetchProjects();
    }
  }, [canView]);

  const fetchProjects = async () => {
    setLoading(true);
    setTimeout(() => {
      setProjects([
        { 
          id: 1, 
          title: 'AI-Based Learning Management System', 
          pi: 'Dr. John Smith',
          department: 'Computer Science',
          startDate: '2024-01-15',
          endDate: '2025-01-14',
          budget: 500000,
          status: 'Active',
          progress: 65,
          type: 'Research'
        },
        { 
          id: 2, 
          title: 'Smart Campus IoT Infrastructure', 
          pi: 'Dr. Sarah Wilson',
          department: 'ECE',
          startDate: '2024-03-01',
          endDate: '2025-02-28',
          budget: 750000,
          status: 'Pending Approval',
          progress: 25,
          type: 'Development'
        },
      ]);
      setLoading(false);
    }, 1000);
  };

  if (!canView) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Access to Research Module</h3>
          <p className="text-gray-600">You don't have permission to view research projects.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Research & Development</h2>
              <p className="text-sm text-gray-600">Manage research projects and publications</p>
            </div>
          </div>
          {canAdd && (
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors">
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search projects by title, PI, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <button className="bg-white border border-gray-300 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-50 transition-colors">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-6 border-b border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">Active Projects</span>
            </div>
            <p className="text-2xl font-bold text-green-900 mt-1">24</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Completed</span>
            </div>
            <p className="text-2xl font-bold text-blue-900 mt-1">18</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-900">Pending</span>
            </div>
            <p className="text-2xl font-bold text-yellow-900 mt-1">7</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Publications</span>
            </div>
            <p className="text-2xl font-bold text-purple-900 mt-1">156</p>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading projects...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project: any) => (
              <div key={project.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        project.status ===
   'Active' 
                          ? 'bg-green-100 text-green-800'
                          : project.status ===
   'Pending Approval'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {project.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <span className="text-xs text-gray-500">Principal Investigator</span>
                        <p className="text-sm font-medium text-gray-900">{project.pi}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Department</span>
                        <p className="text-sm font-medium text-gray-900">{project.department}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Budget</span>
                        <p className="text-sm font-medium text-gray-900">₹{project.budget.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Duration</span>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-500">Progress</span>
                        <span className="text-xs text-gray-700">{project.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${project.progress}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {canEdit && (
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit Details</button>
                      )}
                      {canApprove && project.status ===
   'Pending Approval' && (
                        <button className="text-green-600 hover:text-green-800 text-sm font-medium">Approve</button>
                      )}
                      <button className="text-gray-600 hover:text-gray-800 text-sm font-medium">View Details</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}