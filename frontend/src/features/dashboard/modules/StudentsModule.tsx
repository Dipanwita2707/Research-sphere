'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, Search, Filter, GraduationCap, BookOpen } from 'lucide-react';

interface StudentsModuleProps {
  permissions: string[];
}

interface Student {
  id: number;
  name: string;
  regNo: string;
  program: string;
  semester: number;
  status: string;
}

export default function StudentsModule({ permissions }: StudentsModuleProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const hasPermission = (permission: string) => permissions.includes(permission);

  const canView = hasPermission('view_students');
  const canAdd = hasPermission('add_students');
  const canEdit = hasPermission('edit_students');
  const canDelete = hasPermission('delete_students');
  const canApprove = hasPermission('approve_students');

  useEffect(() => {
    if (canView) {
      fetchStudents();
    }
  }, [canView]);

  const fetchStudents = async () => {
    // TODO: Implement API call
    setLoading(true);
    setTimeout(() => {
      setStudents([
        { id: 1, name: 'John Doe', regNo: '2023001', program: 'B.Tech CSE', semester: 3, status: 'Active' },
        { id: 2, name: 'Jane Smith', regNo: '2023002', program: 'B.Tech ECE', semester: 3, status: 'Active' },
      ]);
      setLoading(false);
    }, 1000);
  };

  if (!canView) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Access to Students Module</h3>
          <p className="text-gray-600">You don't have permission to view student information.</p>
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
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Students Management</h2>
              <p className="text-sm text-gray-600">Manage student records and information</p>
            </div>
          </div>
          {canAdd && (
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors">
              <UserPlus className="w-4 h-4" />
              <span>Add Student</span>
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
              placeholder="Search students by name, registration number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total Students</span>
            </div>
            <p className="text-2xl font-bold text-blue-900 mt-1">1,247</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <GraduationCap className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">Active</span>
            </div>
            <p className="text-2xl font-bold text-green-900 mt-1">1,195</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-900">On Leave</span>
            </div>
            <p className="text-2xl font-bold text-yellow-900 mt-1">32</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-red-900">Inactive</span>
            </div>
            <p className="text-2xl font-bold text-red-900 mt-1">20</p>
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading students...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Student</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Registration No.</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Program</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Semester</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  {(canEdit || canDelete) && (
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {students.map((student: any) => (
                  <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {student.name.split(' ').map((n: string) => n[0]).join('')}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">{student.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900">{student.regNo}</td>
                    <td className="py-3 px-4 text-gray-600">{student.program}</td>
                    <td className="py-3 px-4 text-gray-600">{student.semester}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        student.status ===
   'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {student.status}
                      </span>
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          {canEdit && (
                            <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                          )}
                          {canDelete && (
                            <button className="text-red-600 hover:text-red-800 text-sm">Delete</button>
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