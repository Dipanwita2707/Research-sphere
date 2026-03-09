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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
          <h1 className="text-2xl sm:text-3xl font-bold text-ev-900">Club Categories</h1>
          <p className="mt-2 text-ev-400">
            {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} available
          </p>
        </div>
        {isAdmin && categories.length === 0 && (
          <button onClick={handleSeedCategories} className="ev-btn w-full sm:w-auto">
            <Plus className="w-5 h-5" />
            Seed Default Categories
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="ev-card p-12 text-center">
          <FolderOpen className="w-14 h-14 text-ev-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ev-900 mb-2">No Categories Found</h3>
          <p className="text-ev-400 text-sm">
            {isAdmin
              ? 'Click the button above to seed default categories.'
              : 'Categories will appear here once they are added by administrators.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {categories.map((category) => (
            <div
              key={category.id}
              className="ev-card ev-card-hover p-6 cursor-pointer"
              onClick={() => router.push(`/dsw/clubs?category=${category.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-semibold text-ev-900">{category.name}</h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-ev-50 text-ev-700 border border-[#b3cde0]">
                  {category._count?.clubs || 0} clubs
                </span>
              </div>

              {category.description && (
                <p className="text-sm text-ev-400 line-clamp-2">{category.description}</p>
              )}

              <div className="mt-4 pt-3 border-t border-[#b3cde0]/40">
                <span className="text-sm text-ev-700 font-medium">View Clubs →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
