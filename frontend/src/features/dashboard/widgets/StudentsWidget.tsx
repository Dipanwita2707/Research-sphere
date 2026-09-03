'use client';

import { Users, UserPlus, UserCheck, ChevronRight, GraduationCap } from 'lucide-react';

export default function StudentsWidget() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-ResearchSphere border border-gray-100 card-hover">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-ResearchSphere-gradient rounded-xl flex items-center justify-center shadow-ResearchSphere">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Student Management</h3>
            <p className="text-xs text-gray-500">Enrollment & records</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-ResearchSphere-50 rounded-xl p-4 border border-ResearchSphere-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-ResearchSphere-600 uppercase tracking-wider">Total Students</p>
              <p className="text-2xl font-bold text-ResearchSphere-800 mt-1">0</p>
            </div>
            <div className="w-10 h-10 bg-ResearchSphere-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-ResearchSphere-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Active</p>
              <p className="text-2xl font-bold text-emerald-800 mt-1">0</p>
            </div>
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button className="flex-1 bg-ResearchSphere-gradient hover:shadow-lg hover:shadow-ResearchSphere-500/25 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2">
          <UserPlus className="w-4 h-4" />
          Add Student
        </button>
        <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2.5 px-4 rounded-xl transition-all">
          View All
        </button>
      </div>
    </div>
  );
}
