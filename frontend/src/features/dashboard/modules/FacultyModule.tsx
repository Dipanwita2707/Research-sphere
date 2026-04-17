'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, Search, Filter, Award, BookOpen } from 'lucide-react';

interface FacultyModuleProps {
  permissions: string[];
}

interface Faculty {
  id: number;
  name: string;
  empId: string;
  designation: string;
  department: string;
  specialization: string;
  experience: string;
  status: string;
  courses: number;
  workload: number;
}

export default function FacultyModule({ permissions }: FacultyModuleProps) {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const hasPermission = (permission: string) => permissions.includes(permission);

  const canView = hasPermission('view_faculty');
  const canAdd = hasPermission('add_faculty');
  const canEdit = hasPermission('edit_faculty');
  const canDelete = hasPermission('delete_faculty');
  const canAssignCourses = hasPermission('assign_courses');
  const canViewWorkload = hasPermission('view_workload');

  useEffect(() => {
    if (canView) {
      fetchFaculty();
    }
  }, [canView]);

  const fetchFaculty = async () => {
    setLoading(true);
    setTimeout(() => {
      setFaculty([
        { 
          id: 1, 
          name: 'Dr. John Smith', 
          empId: 'EMP001', 
          designation: 'Professor', 
          department: 'Computer Science',
          specialization: 'AI & Machine Learning',
          experience: '15 years',
          status: 'Active',
          courses: 3,
          workload: 18
        },
        { 
          id: 2, 
          name: 'Dr. Sarah Wilson', 
          empId: 'EMP002', 
          designation: 'Associate Professor', 
          department: 'Computer Science',
          specialization: 'Data Science',
          experience: '10 years',
          status: 'Active',
          courses: 2,
          workload: 12
        },
      ]);
      setLoading(false);
    }, 1000);
  };

  if (!canView) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="text-center py-8">
          <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Access to Faculty Module</h3>
          <p className="text-gray-600">You don't have permission to view faculty information.</p>
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
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Faculty Management</h2>
              <p className="text-sm text-gray-600">Manage faculty members and their workload</p>
            </div>
          </div>
          {canAdd && (
            <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors">
              <UserPlus className="w-4 h-4" />
              <span>Add Faculty</span>
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
              placeholder="Search faculty by name, employee ID, designation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Total Faculty</span>
            </div>
            <p className="text-2xl font-bold text-purple-900 mt-1">147</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Active Courses</span>
            </div>
            <p className="text-2xl font-bold text-blue-900 mt-1">89</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">Available</span>
            </div>
            <p className="text-2xl font-bold text-green-900 mt-1">142</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-900">On Leave</span>
            </div>
            <p className="text-2xl font-bold text-yellow-900 mt-1">5</p>
          </div>
        </div>
      </div>

      {/* Faculty List */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading faculty...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Faculty</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Employee ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Designation</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Specialization</th>
                  {canViewWorkload && (
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Workload</th>
                  )}
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  {(canEdit || canDelete || canAssignCourses) && (
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {faculty.map((member: any) => (
                  <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-purple-700">
                            {member.name.split(' ').map((n: string) => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">{member.name}</span>
                          <p className="text-xs text-gray-500">{member.experience}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900">{member.empId}</td>
                    <td className="py-3 px-4 text-gray-600">{member.designation}</td>
                    <td className="py-3 px-4 text-gray-600">{member.specialization}</td>
                    {canViewWorkload && (
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-900">{member.courses} courses</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-600">{member.workload}h/week</span>
                        </div>
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        member.status ===
   'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {member.status}
                      </span>
                    </td>
                    {(canEdit || canDelete || canAssignCourses) && (
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          {canEdit && (
                            <button className="text-purple-600 hover:text-purple-800 text-sm">Edit</button>
                          )}
                          {canAssignCourses && (
                            <button className="text-blue-600 hover:text-blue-800 text-sm">Assign</button>
                          )}
                          {canDelete && (
                            <button className="text-red-600 hover:text-red-800 text-sm">Remove</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}