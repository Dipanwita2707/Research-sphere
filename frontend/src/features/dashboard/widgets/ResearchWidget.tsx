'use client';

import { Microscope, FileText, Award, TrendingUp, ChevronRight, Lightbulb } from 'lucide-react';
import Link from 'next/link';

export default function ResearchWidget() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-ResearchSphere border border-gray-100 card-hover">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Microscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Research & Patents</h3>
            <p className="text-xs text-gray-500">Innovation hub</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-cyan-600 uppercase tracking-wider">Papers</p>
              <p className="text-2xl font-bold text-cyan-800 mt-1">0</p>
            </div>
            <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-cyan-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-teal-600 uppercase tracking-wider">Patents</p>
              <p className="text-2xl font-bold text-teal-800 mt-1">0</p>
            </div>
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-teal-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/research/progress-tracker/new" className="flex-1 bg-gradient-to-r from-cyan-600 to-teal-600 hover:shadow-lg hover:shadow-cyan-500/25 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2">
          Track Research
          <ChevronRight className="w-4 h-4" />
        </Link>
        <Link href="/research/progress-tracker" className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center">
          View All
        </Link>
      </div>
    </div>
  );
}
