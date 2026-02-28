'use client';

import React, { useEffect, useState } from 'react';
import { FolderOpen, Users, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { categoryAPI } from '@/features/dsw/services/api';
import { ClubCategory } from '@/features/dsw/types';
import { useAuthStore } from '@/shared/auth/authStore';

import { CardSkeleton, Skeleton } from '@/components/skeletons';

export default function CategoriesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [categories, setCategories] = useState<ClubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role?.name === 'admin' || user?.userType === 'admin';

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await categoryAPI.getCategories();
      if (response.success) {
        setCategories(response.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      // Set empty categories on error so page still shows
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedCategories = async () => {
    try {
      await categoryAPI.seedCategories();
      fetchCategories();
    } catch (err: any) {
      console.error('Error seeding categories:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Club Categories
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} available
          </p>
        </div>
        {isAdmin && categories.length === 0 && (
          <button
            onClick={handleSeedCategories}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Seed Default Categories
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
          <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Categories Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {isAdmin
              ? 'Click the button above to seed default categories.'
              : 'Categories will appear here once they are added by administrators.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/dsw/clubs?category=${category.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {category.name}
                  </h3>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                  {category._count?.clubs || 0} clubs
                </span>
              </div>

              {category.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {category.description}
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
                  View Clubs →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
