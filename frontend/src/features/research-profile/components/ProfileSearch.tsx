import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, X, User, GraduationCap, Award, TrendingUp, ChevronDown } from 'lucide-react';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { ProfileSearchResult, ProfileSearchRequest } from '@/shared/types/research-profile.types';
import { mockResearchProfileAPI } from '@/mocks/research-profile-api';
import logger from '@/shared/utils/logger';

interface ProfileSearchProps {
  onProfileSelect?: (profile: ProfileSearchResult) => void;
  placeholder?: string;
  showFilters?: boolean;
}

interface SearchFilters {
  department: string;
  school: string;
  minCitations: number;
  yearRange: { start: number; end: number } | null;
}

export default function ProfileSearch({ 
  onProfileSelect, 
  placeholder = "Search researchers by name, department, or research interests...",
  showFilters = true 
}: ProfileSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  
  const [filters, setFilters] = useState<SearchFilters>({
    department: '',
    school: '',
    minCitations: 0,
    yearRange: null,
  });

  const debouncedQuery = useDebounce(query, 300);

  const searchProfiles = useCallback(async (searchQuery: string, searchPage: number = 1, resetResults: boolean = true) => {
    if (!searchQuery.trim() && !hasActiveFilters()) return;

    setLoading(true);
    try {
      const searchRequest: ProfileSearchRequest = {
        query: searchQuery.trim(),
        page: searchPage,
        limit: 10,
        filters: {
          ...(filters.department && { department: filters.department }),
          ...(filters.school && { school: filters.school }),
          ...(filters.minCitations > 0 && { minCitations: filters.minCitations }),
          ...(filters.yearRange && { yearRange: filters.yearRange }),
        },
      };

      const response = await mockResearchProfileAPI.searchProfiles(searchRequest);
      
      if (resetResults) {
        setResults(response.results);
      } else {
        setResults(prev => [...prev, ...response.results]);
      }
      
      setHasMore(response.hasMore);
      setTotal(response.total);
      setShowResults(true);
    } catch (error) {
      logger.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const hasActiveFilters = () => {
    return filters.department || filters.school || filters.minCitations > 0 || filters.yearRange;
  };

  useEffect(() => {
    if (debouncedQuery || hasActiveFilters()) {
      setPage(1);
      searchProfiles(debouncedQuery, 1, true);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [debouncedQuery, searchProfiles]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    searchProfiles(debouncedQuery, nextPage, false);
  };

  const clearFilters = () => {
    setFilters({
      department: '',
      school: '',
      minCitations: 0,
      yearRange: null,
    });
  };

  const handleProfileClick = (profile: ProfileSearchResult) => {
    if (onProfileSelect) {
      onProfileSelect(profile);
    } else {
      // Default behavior: navigate to profile
      window.open(`/research/profile/${profile.userId}`, '_blank');
    }
    setShowResults(false);
    setQuery('');
  };

  return (
    <div className="relative w-full max-w-2xl">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(results.length > 0)}
          placeholder={placeholder}
          className="block w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        {/* Filter Toggle */}
        {showFilters && (
          <button
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors ${
              hasActiveFilters() 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <Filter className="h-5 w-5" />
          </button>
        )}
        
        {/* Loading indicator */}
        {loading && (
          <div className="absolute inset-y-0 right-8 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Filters Panel */}
      {showFiltersPanel && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Search Filters</h3>
            <div className="flex items-center gap-2">
              {hasActiveFilters() && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setShowFiltersPanel(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                School
              </label>
              <select
                value={filters.school}
                onChange={(e) => setFilters(prev => ({ ...prev, school: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Schools</option>
                <option value="School of Engineering">School of Engineering</option>
                <option value="School of Management">School of Management</option>
                <option value="School of Sciences">School of Sciences</option>
                <option value="School of Law">School of Law</option>
                <option value="School of Medicine">School of Medicine</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Department
              </label>
              <select
                value={filters.department}
                onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Departments</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Mechanical Engineering">Mechanical Engineering</option>
                <option value="Electronics">Electronics</option>
                <option value="Civil Engineering">Civil Engineering</option>
                <option value="Business Administration">Business Administration</option>
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Mathematics">Mathematics</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Minimum Citations
              </label>
              <input
                type="number"
                min="0"
                value={filters.minCitations}
                onChange={(e) => setFilters(prev => ({ ...prev, minCitations: parseInt(e.target.value) || 0 }))}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Publication Year Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1990"
                  max={new Date().getFullYear()}
                  value={filters.yearRange?.start || ''}
                  onChange={(e) => {
                    const start = parseInt(e.target.value);
                    setFilters(prev => ({
                      ...prev,
                      yearRange: start ? { start, end: prev.yearRange?.end || new Date().getFullYear() } : null
                    }));
                  }}
                  className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="From"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  min="1990"
                  max={new Date().getFullYear()}
                  value={filters.yearRange?.end || ''}
                  onChange={(e) => {
                    const end = parseInt(e.target.value);
                    setFilters(prev => ({
                      ...prev,
                      yearRange: end ? { start: prev.yearRange?.start || 1990, end } : null
                    }));
                  }}
                  className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="To"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto z-40">
          {results.length === 0 && !loading ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No researchers found</p>
              <p className="text-xs mt-1">Try adjusting your search terms or filters</p>
            </div>
          ) : (
            <>
              {/* Results Header */}
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {total} researcher{total !== 1 ? 's' : ''} found
                  </span>
                  <button
                    onClick={() => setShowResults(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Results List */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {results.map((profile) => (
                  <ProfileSearchItem
                    key={profile.userId}
                    profile={profile}
                    onClick={() => handleProfileClick(profile)}
                  />
                ))}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load more results'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Backdrop */}
      {(showResults || showFiltersPanel) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowResults(false);
            setShowFiltersPanel(false);
          }}
        />
      )}
    </div>
  );
}

function ProfileSearchItem({ 
  profile, 
  onClick 
}: { 
  profile: ProfileSearchResult; 
  onClick: () => void; 
}) {
  return (
    <button
      onClick={onClick}
      className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {profile.photo ? (
            <img
              src={profile.photo}
              alt={profile.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <span className="text-sm font-semibold text-white">
                {profile.name.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* Profile Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {profile.name}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                {profile.designation} • {profile.department}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                {profile.school}
              </p>
            </div>
            
            {/* Metrics */}
            <div className="flex-shrink-0 text-right ml-4">
              <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  <span>h-index: {profile.hIndex}</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>{profile.totalCitations} citations</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {profile.recentPublications} recent publications
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}