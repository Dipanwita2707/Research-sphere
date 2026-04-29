'use client';

import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, Users, Award, BookOpen } from 'lucide-react';
import ProfileSearch from '@/features/research-profile/components/ProfileSearch';
import type { ProfileSearchResult } from '@/shared/types/research-profile.types';
import { mockResearchProfileAPI } from '@/mocks/research-profile-api';
import logger from '@/shared/utils/logger';

export default function ResearchSearchPage() {
  const [trendingResearchers, setTrendingResearchers] = useState<ProfileSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrendingResearchers();
  }, []);

  const loadTrendingResearchers = async () => {
    try {
      setLoading(true);
      const trending = await mockResearchProfileAPI.getTrendingResearchers(8);
      setTrendingResearchers(trending);
    } catch (error) {
      logger.error('Failed to load trending researchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSelect = (profile: ProfileSearchResult) => {
    // Navigate to the selected profile
    window.location.href = `/research/profile/${profile.userId}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Research Profile Discovery
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Discover researchers, explore their work, and find collaboration opportunities across SGT University
            </p>
          </div>

          {/* Search Component */}
          <div className="flex justify-center">
            <ProfileSearch 
              onProfileSelect={handleProfileSelect}
              placeholder="Search researchers by name, department, research interests..."
              showFilters={true}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {trendingResearchers.length > 0 ? '150+' : '—'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Active Researchers</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BookOpen className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {trendingResearchers.length > 0 ? '2,500+' : '—'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Publications</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Award className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {trendingResearchers.length > 0 ? '15,000+' : '—'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Citations</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {trendingResearchers.length > 0 ? '25' : '—'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Departments</div>
              </div>
            </div>
          </div>
        </div>

        {/* Trending Researchers */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Trending Researchers
            </h2>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Based on recent publications and citations
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-48"></div>
                </div>
              ))}
            </div>
          ) : trendingResearchers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {trendingResearchers.map((researcher) => (
                <ResearcherCard
                  key={researcher.userId}
                  researcher={researcher}
                  onClick={() => handleProfileSelect(researcher)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No trending researchers found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Check back later for trending researcher profiles.
              </p>
            </div>
          )}
        </div>

        {/* Quick Search Categories */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <QuickSearchCard
            title="By Department"
            description="Browse researchers by their academic department"
            icon={<BookOpen className="w-6 h-6" />}
            categories={[
              'Computer Science',
              'Mechanical Engineering',
              'Electronics',
              'Business Administration',
              'Physics',
              'Chemistry'
            ]}
          />

          <QuickSearchCard
            title="By Research Area"
            description="Find experts in specific research domains"
            icon={<Search className="w-6 h-6" />}
            categories={[
              'Machine Learning',
              'Renewable Energy',
              'Biotechnology',
              'Data Science',
              'Robotics',
              'Nanotechnology'
            ]}
          />

          <QuickSearchCard
            title="By Impact"
            description="Discover highly cited and influential researchers"
            icon={<TrendingUp className="w-6 h-6" />}
            categories={[
              'High h-index (>20)',
              'Recent Publications',
              'International Collaborations',
              'Patent Holders',
              'Grant Recipients',
              'Award Winners'
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function ResearcherCard({ 
  researcher, 
  onClick 
}: { 
  researcher: ProfileSearchResult; 
  onClick: () => void; 
}) {
  return (
    <button
      onClick={onClick}
      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
    >
      <div className="flex items-center mb-3">
        {researcher.photo ? (
          <img
            src={researcher.photo}
            alt={researcher.name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <span className="text-lg font-semibold text-white">
              {researcher.name.charAt(0)}
            </span>
          </div>
        )}
        <div className="ml-3 min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {researcher.name}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
            {researcher.designation}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
          {researcher.department}
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-500">h-index: {researcher.hIndex}</span>
          <span className="text-gray-500 dark:text-gray-500">{researcher.totalCitations} citations</span>
        </div>
        
        <div className="text-xs text-blue-600 dark:text-blue-400">
          {researcher.recentPublications} recent publications
        </div>
      </div>
    </button>
  );
}

function QuickSearchCard({ 
  title, 
  description, 
  icon, 
  categories 
}: { 
  title: string; 
  description: string; 
  icon: React.ReactNode; 
  categories: string[]; 
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center mb-4">
        <div className="flex-shrink-0 text-blue-600 dark:text-blue-400">
          {icon}
        </div>
        <div className="ml-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {categories.map((category, index) => (
          <button
            key={index}
            className="block w-full text-left text-sm text-blue-600 dark:text-blue-400 hover:underline"
            onClick={() => {
              // Could implement category-specific search
              console.log('Search by category:', category);
            }}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}