'use client';

import React, { useEffect, useState } from 'react';
import { FolderOpen, Plus, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { categoryAPI } from '@/features/dsw/services/api';
import { ClubCategory } from '@/features/dsw/types';
import { useAuthStore } from '@/shared/auth/authStore';
import { DSWCategoriesShimmer } from '@/components/shimmer';

export default function CategoriesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [categories, setCategories] = useState<ClubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    sortOrder: '0',
  });

  const role = String((user as any)?.userType || (user as any)?.role?.name || (user as any)?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'superadmin';

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

  const handleCreateCategory = async () => {
    if (!form.name.trim()) {
      setCreateError('Category name is required');
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      const response = await categoryAPI.createCategory({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        sortOrder: Number(form.sortOrder) || 0,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to create category');
      }

      setShowCreateModal(false);
      setForm({ name: '', description: '', sortOrder: '0' });
      await fetchCategories();
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || err?.message || 'Failed to create category');
    } finally {
      setCreating(false);
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
    return <DSWCategoriesShimmer />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ev-900">Club Categories</h1>
          <p className="mt-2 text-ev-400">
            {categories.length} categor{categories.length ===
   1 ? 'y' : 'ies'} available
          </p>
        </div>
        {isAdmin && (
          <div className="flex w-full sm:w-auto gap-2">
            {categories.length === 0 && (
              <button onClick={handleSeedCategories} className="ev-btn-outline w-full sm:w-auto">
                Seed Default Categories
              </button>
            )}
            <button
              onClick={() => {
                setCreateError(null);
                setShowCreateModal(true);
              }}
              className="ev-btn w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              Add Category
            </button>
          </div>
        )}
      </div>

      {categories.length ===
   0 ? (
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
              onClick={() => router.push(`/dsw/clubs?categoryId=${category.id}`)}
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

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !creating) {
              setShowCreateModal(false);
            }
          }}
        >
          <div className="w-full max-w-md ev-modal p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ev-900">Create Category</h2>
              <button
                type="button"
                onClick={() => !creating && setShowCreateModal(false)}
                className="ev-btn-ghost"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-ev-800 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g. Innovation & Entrepreneurship"
                  className="ev-input"
                  maxLength={128}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ev-800 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Short description for this category"
                  className="ev-input min-h-20"
                  maxLength={500}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ev-800 mb-1">Sort Order</label>
                <input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                  className="ev-input"
                />
              </div>

              {createError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {createError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="ev-btn-outline"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={creating}
                className="ev-btn disabled:opacity-60"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
