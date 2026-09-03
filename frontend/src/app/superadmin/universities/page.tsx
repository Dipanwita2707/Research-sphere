'use client';

import React, { useEffect, useState } from 'react';
import { superadminService, University } from '@/shared/services/superadmin.service';
import { 
  Plus, 
  Search, 
  Building2, 
  MoreVertical, 
  Power, 
  ExternalLink, 
  Loader2, 
  AlertTriangle 
} from 'lucide-react';
import Link from 'next/link';

export default function UniversitiesManagement() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const fetchUniversities = async () => {
    try {
      const data = await superadminService.getAllUniversities();
      setUniversities(data);
    } catch (err) {
      setError('Failed to load universities.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUniversities();
  }, []);

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      setIsLoading(true);
      await superadminService.suspendUniversity(id, currentStatus); // suspend = currentStatus (if currently active, suspend = true)
      await fetchUniversities();
      setOpenDropdown(null);
    } catch (err) {
      setError('Failed to change university status.');
      setIsLoading(false);
    }
  };

  const handleImpersonate = (uniId: string) => {
    // Set context switching parameter in local storage
    localStorage.setItem('superadmin-impersonate-university-id', uniId);
    // Redirect to main admin dashboard
    window.location.href = '/dashboard';
  };

  const filteredUnis = universities.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
                          u.code.toLowerCase().includes(search.toLowerCase());
    
    if (filter === 'active') return matchesSearch && u.isActive;
    if (filter === 'suspended') return matchesSearch && !u.isActive;
    return matchesSearch;
  });

  if (isLoading && universities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-10 w-10 text-red-600 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400">Loading university directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Universities</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and provision individual tenant instances.</p>
        </div>
        <Link
          href="/superadmin/universities/create"
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors text-center justify-center"
        >
          <Plus className="h-4 w-4" />
          Provision University
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 rounded-xl text-red-700 dark:text-red-400 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-950 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search university by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm transition-colors focus:border-red-600"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 border-b md:border-b-0 border-gray-100 pb-2 md:pb-0 overflow-x-auto">
          {(['all', 'active', 'suspended'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all whitespace-nowrap ${
                filter === type
                  ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* University Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredUnis.map((uni) => (
          <div 
            key={uni.id} 
            className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-brand-sm p-6 relative flex flex-col justify-between group hover:shadow-brand-md transition-all"
          >
            {/* Top header */}
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                  {uni.logoUrl ? (
                    <img src={uni.logoUrl} alt={uni.name} className="h-full w-full object-cover rounded-xl" />
                  ) : (
                    <Building2 className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-950 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    {uni.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">{uni.code} &bull; {uni.slug}.sgt-ums.com</p>
                </div>
              </div>

              {/* Options menu */}
              <div className="relative">
                <button
                  onClick={() => setOpenDropdown(openDropdown === uni.id ? null : uni.id)}
                  className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>

                {openDropdown === uni.id && (
                  <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg z-20 py-1">
                    <button
                      onClick={() => handleToggleStatus(uni.id, uni.isActive)}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                    >
                      <Power className="h-3.5 w-3.5" />
                      {uni.isActive ? 'Suspend License' : 'Activate License'}
                    </button>
                    <button
                      onClick={() => handleImpersonate(uni.id)}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Login as Admin
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-4 border-t border-b border-gray-100 dark:border-gray-800 my-5 py-4">
              <div>
                <span className="text-xs text-gray-400">Total Users</span>
                <div className="font-semibold text-sm mt-0.5 text-gray-900 dark:text-white">
                  {uni.counts?.users || 0} active
                </div>
              </div>
              <div>
                <span className="text-xs text-gray-400">Monthly Usage</span>
                <div className="font-semibold text-sm mt-0.5 text-gray-900 dark:text-white">
                  {uni.apiUsageMtd || 0} / {uni.subscription?.maxApiCalls === -1 ? 'unlimited' : uni.subscription?.maxApiCalls || 0}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-between items-center mt-auto">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                uni.isActive 
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' 
                  : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
              }`}>
                {uni.isActive ? 'Active' : 'Suspended'}
              </span>

              <Link
                href={`/superadmin/universities/${uni.id}`}
                className="text-xs font-bold text-wine hover:underline"
              >
                Configure Details &rarr;
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
