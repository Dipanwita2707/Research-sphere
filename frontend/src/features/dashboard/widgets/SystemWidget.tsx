'use client';

import { Settings, Shield, Users, Database, Building2, Briefcase, Lightbulb, ChevronRight, Cog } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SystemWidget() {
  const router = useRouter();

  return (
    <div className="bg-white rounded-2xl p-6 shadow-ResearchSphere border border-gray-100 card-hover">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-ResearchSphere-gradient rounded-xl flex items-center justify-center shadow-ResearchSphere">
            <Cog className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">System Administration</h3>
            <p className="text-xs text-gray-500">Settings & management</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-ResearchSphere-50 rounded-xl p-4 border border-ResearchSphere-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-ResearchSphere-600 uppercase tracking-wider">Total Users</p>
              <p className="text-2xl font-bold text-ResearchSphere-800 mt-1">0</p>
            </div>
            <div className="w-10 h-10 bg-ResearchSphere-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-ResearchSphere-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-purple-600 uppercase tracking-wider">Permissions</p>
              <p className="text-2xl font-bold text-purple-800 mt-1">0</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => router.push('/ipr/my-applications')}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-lg hover:shadow-amber-500/25 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Lightbulb className="w-4 h-4" />
            IPR Module
          </button>
          <button 
            onClick={() => router.push('/admin/employees')}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-lg hover:shadow-emerald-500/25 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4" />
            Employees
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => router.push('/admin/schools')}
            className="bg-ResearchSphere-gradient hover:shadow-lg hover:shadow-ResearchSphere-500/25 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Building2 className="w-4 h-4" />
            Schools
          </button>
          <button 
            onClick={() => router.push('/admin/central-departments')}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/25 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Briefcase className="w-4 h-4" />
            Departments
          </button>
        </div>
        <button 
          onClick={() => router.push('/admin/permissions')}
          className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:shadow-lg hover:shadow-purple-500/25 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <Shield className="w-4 h-4" />
          Permissions
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
