'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Store, ChevronRight, ChevronLeft, CheckCircle,
  Upload, Trash2, AlertCircle, Zap, Droplets, Plus, FileText
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { StallApplication, StallApplicationFormData, StallType } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { getErrorMessage } from '@/shared/utils/errorHandler';

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
  { id: 4, label: 'Documents' },
  { id: 5, label: 'Review & Submit' },
];

interface FormState extends StallApplicationFormData {
  products: string[];
}

const defaultForm: FormState = {
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
  gstNumber: '',
  foodLicenseNumber: '',
  documentUrls: [],
  termsAccepted: false,
};

export default function ApplyStallPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingApplication, setExistingApplication] = useState<StallApplication | null>(null);
  const [eventName, setEventName] = useState('');

  useEffect(() => {
    Promise.all([
      eventService.getEvent(eventId),
      eventService.getMyStallApplication(eventId).catch(() => null),
    ]).then(([event, app]) => {
      setEventName(event.name);
      if (app) setExistingApplication(app);
    }).catch(() => {
      toast({ type: 'error', message: 'Failed to load event details' });
    }).finally(() => setLoading(false));
  }, [eventId, toast]);

  const update = (fields: Partial<FormState>) => setForm((f) => ({ ...f, ...fields }));

  const addProduct = () => update({ products: [...form.products, ''] });
  const removeProduct = (i: number) => update({ products: form.products.filter((_, idx) => idx !== i) });
  const updateProduct = (i: number, v: string) => {
    const p = [...form.products]; p[i] = v; update({ products: p });
  };

  const handleSubmit = async () => {
    if (!form.termsAccepted) {
      toast({ type: 'error', message: 'You must accept the terms and conditions' });
      return;
    }
    setSubmitting(true);
    try {
      const payload: StallApplicationFormData = {
        ...form,
        products: form.products.filter(Boolean),
      };
      await eventService.submitStallApplication(eventId, payload);
      toast({ type: 'success', message: 'Application submitted successfully!' });
      router.push('/events/stall-opportunities');
    } catch (err) {
      toast({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <CardSkeleton className="max-w-sm w-full" />
      </div>
    );
  }

  // Already applied – show status
  if (existingApplication) {
    const statusConfig = {
      pending: { label: 'Under Review', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
      approved: { label: 'Approved', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
      rejected: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
      withdrawn: { label: 'Withdrawn', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
    };
    const s = statusConfig[existingApplication.status] ?? statusConfig.pending;

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
        <div className="max-w-2xl mx-auto">
          <Link href="/events/stall-opportunities" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-sgt-600 mb-5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to opportunities
          </Link>
          <div className={`rounded-xl border p-8 text-center ${s.bg}`}>
            <CheckCircle className={`w-12 h-12 mx-auto mb-3 ${s.color}`} />
            <h2 className={`text-xl font-bold ${s.color} mb-1`}>Application {s.label}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Your stall application for <strong>{eventName}</strong> is {s.label.toLowerCase()}.
            </p>

            <div className="text-left bg-white dark:bg-gray-800 rounded-lg p-4 space-y-2 text-sm max-w-sm mx-auto">
              <div className="flex justify-between">
                <span className="text-gray-500">Stall Name</span>
                <span className="font-medium text-gray-900 dark:text-white">{existingApplication.stallName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-medium text-gray-900 dark:text-white capitalize">{existingApplication.stallType?.replace('_', ' ')}</span>
              </div>
              {existingApplication.reviewNote && (
                <div className="pt-2 border-t border-gray-200">
                  <span className="text-gray-500 block mb-1">Review Note</span>
                  <p className="text-gray-700 dark:text-gray-300 italic">{existingApplication.reviewNote}</p>
                </div>
              )}
            </div>

            {existingApplication.qrCode && existingApplication.status === 'approved' && (
              <div className="mt-6">
                <p className="text-sm font-medium text-green-700 mb-2">Your Stall QR Code</p>
                <img src={existingApplication.qrCode} alt="Stall QR" className="w-40 h-40 mx-auto rounded-lg border-2 border-green-300" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-2xl mx-auto">

        <Link href="/events/stall-opportunities" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-sgt-600 mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to opportunities
        </Link>

        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Store className="w-6 h-6 text-sgt-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Apply for Stall</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{eventName}</p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <button
                type="button"
                onClick={() => s.id < step && setStep(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${step === s.id
                    ? 'bg-sgt-600 text-white'
                    : s.id < step
                      ? 'bg-sgt-100 text-sgt-700 dark:bg-sgt-900/20 dark:text-sgt-300 cursor-pointer'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-default'
                  }`}
              >
                {s.id < step ? <CheckCircle className="w-3.5 h-3.5" /> : <span>{s.id}</span>}
                {s.label}
              </button>
              {i < STEPS.length - 1 && <div className="w-3 h-px bg-gray-200 dark:bg-gray-600 shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">

          {/* ─── Step 1: Stall Info ─── */}
          {step === 1 && (
            <>
              <h2 className="font-semibold text-gray-900 dark:text-white">Stall Information</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Stall Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.stallName}
                  onChange={(e) => update({ stallName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 outline-none"
                  placeholder="e.g. Spicy Bites, Artisan Crafts"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stall Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STALL_TYPES.map((t) => (
                    <label
                      key={t.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.stallType === t.value
                          ? 'border-sgt-400 bg-sgt-50/50 dark:bg-sgt-900/10'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                    >
                      <input
                        type="radio"
                        name="stallType"
                        value={t.value}
                        checked={form.stallType === t.value}
                        onChange={() => update({ stallType: t.value })}
                        className="mt-0.5 w-4 h-4 text-sgt-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{t.label}</p>
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
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 outline-none"
                  placeholder="e.g. Fast food, Electronics, Jewellery"
                />
              </div>
            </>
          )}

          {/* ─── Step 2: Business Details ─── */}
          {step === 2 && (
            <>
              <h2 className="font-semibold text-gray-900 dark:text-white">Business Details</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Business / Brand Name</label>
                <input
                  type="text"
                  value={form.businessName || ''}
                  onChange={(e) => update({ businessName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 outline-none"
                  placeholder="Your business or brand name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Business Description</label>
                <textarea
                  value={form.businessDescription || ''}
                  onChange={(e) => update({ businessDescription: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 outline-none resize-none"
                  placeholder="Describe what your business does, what you'll sell, etc."
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
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 outline-none"
                        placeholder={`Product / service ${i + 1}`}
                      />
                      {form.products.length > 1 && (
                        <button type="button" onClick={() => removeProduct(i)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addProduct}
                  className="mt-2 inline-flex items-center gap-1 text-sm text-sgt-600 hover:text-sgt-700 font-medium"
                >
                  <Plus className="w-4 h-4" /> Add product / service
                </button>
              </div>
            </>
          )}

          {/* ─── Step 3: Infrastructure ─── */}
          {step === 3 && (
            <>
              <h2 className="font-semibold text-gray-900 dark:text-white">Infrastructure Requirements</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Space Required (sq ft)</label>
                <input
                  type="number"
                  min={1}
                  value={form.spaceRequired ?? ''}
                  onChange={(e) => update({ spaceRequired: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 outline-none"
                  placeholder="e.g. 100"
                />
              </div>

              <div className="flex gap-4">
                <label className={`flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${form.electricityRequired ? 'border-sgt-400 bg-sgt-50/50' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}>
                  <input
                    type="checkbox"
                    checked={form.electricityRequired || false}
                    onChange={(e) => update({ electricityRequired: e.target.checked })}
                    className="w-4 h-4 text-sgt-600"
                  />
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Electricity Required</span>
                  </div>
                </label>

                <label className={`flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${form.waterRequired ? 'border-sgt-400 bg-sgt-50/50' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}>
                  <input
                    type="checkbox"
                    checked={form.waterRequired || false}
                    onChange={(e) => update({ waterRequired: e.target.checked })}
                    className="w-4 h-4 text-sgt-600"
                  />
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Water Required</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Special Requirements</label>
                <textarea
                  value={form.specialRequirements || ''}
                  onChange={(e) => update({ specialRequirements: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 outline-none resize-none"
                  placeholder="Any other setup or infrastructure requirements..."
                />
              </div>
            </>
          )}

          {/* ─── Step 4: Documents ─── */}
          {step === 4 && (
            <>
              <h2 className="font-semibold text-gray-900 dark:text-white">Documents & Compliance</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                These are optional but may be required depending on event organizer requirements.
              </p>

              {form.stallType === 'food' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    FSSAI / Food License Number
                  </label>
                  <input
                    type="text"
                    value={form.foodLicenseNumber || ''}
                    onChange={(e) => update({ foodLicenseNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 outline-none"
                    placeholder="FSSAI license number"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">GST Number (if applicable)</label>
                <input
                  type="text"
                  value={form.gstNumber || ''}
                  onChange={(e) => update({ gstNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 outline-none"
                  placeholder="15-digit GST number"
                />
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Document uploads</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      Physical documents may be required on the event day. The organizer will contact you if additional documents are needed.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ─── Step 5: Review & Submit ─── */}
          {step === 5 && (
            <>
              <h2 className="font-semibold text-gray-900 dark:text-white">Review & Submit</h2>

              <div className="space-y-3">
                {/* Summary Cards */}
                {[
                  { label: 'Stall Name', value: form.stallName },
                  { label: 'Stall Type', value: STALL_TYPES.find(t => t.value === form.stallType)?.label },
                  { label: 'Category', value: form.category || '—' },
                  { label: 'Business Name', value: form.businessName || '—' },
                  { label: 'Space Required', value: form.spaceRequired ? `${form.spaceRequired} sq ft` : '—' },
                  { label: 'Electricity', value: form.electricityRequired ? 'Yes' : 'No' },
                  { label: 'Water', value: form.waterRequired ? 'Yes' : 'No' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{label}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{value || '—'}</span>
                  </div>
                ))}
              </div>

              {/* Terms */}
              <div className={`p-4 rounded-lg border ${form.termsAccepted ? 'border-sgt-200 bg-sgt-50/30 dark:bg-sgt-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.termsAccepted}
                    onChange={(e) => update({ termsAccepted: e.target.checked })}
                    className="mt-0.5 w-4 h-4 text-sgt-600"
                  />
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    I confirm that all information provided is accurate. I agree to abide by the event organizer's stall guidelines, pay any applicable stall fees, and maintain my stall responsibly during the event.
                  </div>
                </label>
              </div>

              {!form.termsAccepted && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Please accept the terms to submit your application
                </div>
              )}
            </>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {step < STEPS.length ? (
            <button
              type="button"
              onClick={() => {
                // Basic validation per step
                if (step === 1 && !form.stallName.trim()) {
                  toast({ type: 'error', message: 'Please enter a stall name' });
                  return;
                }
                setStep((s) => s + 1);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-sgt-600 text-white text-sm font-medium rounded-lg hover:bg-sgt-700 transition-colors"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !form.termsAccepted}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-sgt-600 text-white text-sm font-medium rounded-lg hover:bg-sgt-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting && <Skeleton className="w-4 h-4 rounded-full" />}
              Submit Application
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
