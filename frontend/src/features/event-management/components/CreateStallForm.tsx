'use client';

import React, { useState } from 'react';
import {
  Store, ChevronRight, ChevronLeft, Plus, Trash2, Zap, Droplets, FileText, X,
} from 'lucide-react';
import type { StallType } from '../types/event.types';

const STALL_TYPES: { value: StallType; label: string; desc: string }[] = [
  { value: 'food', label: 'Food & Beverage', desc: 'Snacks, beverages, meals' },
  { value: 'non_food', label: 'Non-Food Products', desc: 'Clothing, accessories, gadgets' },
  { value: 'service', label: 'Service / Activity', desc: 'Games, workshops, services' },
  { value: 'other', label: 'Other', desc: 'Anything that doesn\'t fit above' },
];

const STEPS = [
  { id: 1, label: 'Stall Info' },
  { id: 2, label: 'Business Details' },
  { id: 3, label: 'Infrastructure' },
  { id: 4, label: 'Review & Create' },
];

export interface CreateStallFormData {
  stallName: string;
  stallType: StallType;
  category?: string;
  businessName?: string;
  businessDescription?: string;
  products: string[];
  spaceRequired?: number;
  electricityRequired?: boolean;
  waterRequired?: boolean;
  specialRequirements?: string;
}

const defaultForm: CreateStallFormData = {
  stallName: '',
  stallType: 'non_food',
  category: '',
  businessName: '',
  businessDescription: '',
  products: [''],
  spaceRequired: undefined,
  electricityRequired: false,
  waterRequired: false,
  specialRequirements: '',
};

interface CreateStallFormProps {
  onClose: () => void;
  onSubmit: (data: CreateStallFormData) => Promise<void>;
  /** When provided, form is in edit mode with pre-filled values */
  initialData?: Partial<CreateStallFormData> & { stallId?: string };
}

export default function CreateStallForm({ onClose, onSubmit, initialData }: CreateStallFormProps) {
  const isEdit = !!initialData;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CreateStallFormData>({
    ...defaultForm,
    ...(initialData && {
      stallName: initialData.stallName ?? '',
      stallType: (initialData.stallType as StallType) ?? 'non_food',
      category: initialData.category ?? '',
      businessName: initialData.businessName ?? '',
      businessDescription: initialData.businessDescription ?? '',
      products: initialData.products?.length ? initialData.products : [''],
      spaceRequired: initialData.spaceRequired,
      electricityRequired: initialData.electricityRequired ?? false,
      waterRequired: initialData.waterRequired ?? false,
      specialRequirements: initialData.specialRequirements ?? '',
    }),
  });
  const [submitting, setSubmitting] = useState(false);

  const update = (fields: Partial<CreateStallFormData>) => setForm((f) => ({ ...f, ...fields }));
  const addProduct = () => update({ products: [...form.products, ''] });
  const removeProduct = (i: number) => update({ products: form.products.filter((_, idx) => idx !== i) });
  const updateProduct = (i: number, v: string) => {
    const p = [...form.products]; p[i] = v; update({ products: p });
  };

  const handleSubmit = async () => {
    if (!form.stallName.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-[#b3cde0] dark:border-gray-700 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-semibold text-ev-900 dark:text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-ev-700" />
            {isEdit ? 'Edit Stall' : 'Create Custom Stall'}
          </h3>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-[#b3cde0]/30 dark:border-gray-700 flex gap-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <button
                type="button"
                onClick={() => setStep(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  step === s.id ? 'bg-ev-50 dark:bg-ev-900/30 text-ev-800 dark:text-ev-200' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {s.label}
              </button>
              {i < STEPS.length - 1 && <div className="w-3 h-px bg-gray-200 dark:bg-gray-600 shrink-0 self-center" />}
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {step === 1 && (
            <>
              <h2 className="font-semibold text-ev-900 dark:text-white">Stall Information</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Stall Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.stallName}
                  onChange={(e) => update({ stallName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white"
                  placeholder="e.g. Spicy Bites, Artisan Crafts"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stall Type <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {STALL_TYPES.map((t) => (
                    <label
                      key={t.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        form.stallType === t.value ? 'border-ev-400 bg-ev-50/50 dark:bg-ev-900/10' : 'border-[#b3cde0] dark:border-gray-600'
                      }`}
                    >
                      <input type="radio" name="stallType" value={t.value} checked={form.stallType === t.value} onChange={() => update({ stallType: t.value })} className="mt-0.5 w-4 h-4 text-ev-700" />
                      <div>
                        <p className="text-sm font-medium text-ev-900 dark:text-white">{t.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category (optional)</label>
                <input
                  type="text"
                  value={form.category || ''}
                  onChange={(e) => update({ category: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white"
                  placeholder="e.g. Fast food, Electronics"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-semibold text-ev-900 dark:text-white">Business Details</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Business / Brand Name</label>
                <input
                  type="text"
                  value={form.businessName || ''}
                  onChange={(e) => update({ businessName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white"
                  placeholder="Your business or brand name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Business Description</label>
                <textarea
                  value={form.businessDescription || ''}
                  onChange={(e) => update({ businessDescription: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white resize-none"
                  placeholder="Describe what your stall will offer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Products / Services (optional)</label>
                <div className="space-y-2">
                  {form.products.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={p}
                        onChange={(e) => updateProduct(i, e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white"
                        placeholder={`Product / service ${i + 1}`}
                      />
                      {form.products.length > 1 && (
                        <button type="button" onClick={() => removeProduct(i)} className="p-2 text-gray-300 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addProduct} className="mt-2 inline-flex items-center gap-1 text-sm text-ev-700 hover:text-ev-800 font-medium">
                  <Plus className="w-4 h-4" /> Add product / service
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-semibold text-ev-900 dark:text-white">Infrastructure Requirements</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Space Required (sq ft)</label>
                <input
                  type="number"
                  min={1}
                  value={form.spaceRequired ?? ''}
                  onChange={(e) => update({ spaceRequired: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white"
                  placeholder="e.g. 100"
                />
              </div>
              <div className="flex gap-4">
                <label className={`flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer ${form.electricityRequired ? 'border-ev-400 bg-ev-50/50' : 'border-[#b3cde0] dark:border-gray-600'}`}>
                  <input type="checkbox" checked={form.electricityRequired || false} onChange={(e) => update({ electricityRequired: e.target.checked })} className="w-4 h-4 text-ev-700" />
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium text-ev-900 dark:text-white">Electricity Required</span>
                </label>
                <label className={`flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer ${form.waterRequired ? 'border-ev-400 bg-ev-50/50' : 'border-[#b3cde0] dark:border-gray-600'}`}>
                  <input type="checkbox" checked={form.waterRequired || false} onChange={(e) => update({ waterRequired: e.target.checked })} className="w-4 h-4 text-ev-700" />
                  <Droplets className="w-4 h-4 text-ev-700" />
                  <span className="text-sm font-medium text-ev-900 dark:text-white">Water Required</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Special Requirements</label>
                <textarea
                  value={form.specialRequirements || ''}
                  onChange={(e) => update({ specialRequirements: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white resize-none"
                  placeholder="Any other setup requirements..."
                />
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="font-semibold text-ev-900 dark:text-white">{isEdit ? 'Review & Update' : 'Review & Create'}</h2>
              {!isEdit && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  No approval needed — stall will be created directly
                </p>
              )}
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Stall Name', value: form.stallName },
                  { label: 'Stall Type', value: STALL_TYPES.find(t => t.value === form.stallType)?.label },
                  { label: 'Category', value: form.category || '—' },
                  { label: 'Business Name', value: form.businessName || '—' },
                  { label: 'Space Required', value: form.spaceRequired ? `${form.spaceRequired} sq ft` : '—' },
                  { label: 'Electricity', value: form.electricityRequired ? 'Yes' : 'No' },
                  { label: 'Water', value: form.waterRequired ? 'Yes' : 'No' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-2 border-b border-[#b3cde0]/30 dark:border-gray-700">
                    <span className="text-gray-500 dark:text-gray-400">{label}</span>
                    <span className="font-medium text-ev-900 dark:text-white">{value || '—'}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#b3cde0] dark:border-gray-700 flex justify-between shrink-0">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#b3cde0] dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          {step < STEPS.length ? (
            <button
              type="button"
              onClick={() => { if (step === 1 && !form.stallName.trim()) return; setStep((s) => s + 1); }}
              disabled={step === 1 && !form.stallName.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-ev-700 text-white text-sm font-medium rounded-lg hover:bg-ev-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !form.stallName.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Stall' : 'Create Stall')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
