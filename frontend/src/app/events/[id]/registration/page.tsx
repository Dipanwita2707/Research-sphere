'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, CheckCircle2,
  AlertCircle, Info, MapPin, Phone, Mail, Building2,
  QrCode, CreditCard, Users, Lock,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type {
  EventCustomField,
  RegistrationFormData,
} from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { extractFieldErrors } from '@/shared/types/api.types';
import { PageSkeleton } from '@/shared/components/PageSkeleton';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { useAuthStore } from '@/shared/auth/authStore';

interface DynamicFieldProps {
  field: EventCustomField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

const DynamicField: React.FC<DynamicFieldProps> = ({ field, value, onChange, error }) => {
  const baseClasses = `w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 text-ev-900 dark:text-white
    focus:ring-2 focus:ring-ev-200/40 focus:border-ev-700 transition-all duration-200 outline-none
    ${error
      ? 'border-red-300 focus:border-red-500 focus:ring-red-100 bg-red-50/10'
      : 'border-[#b3cde0] dark:border-gray-700 hover:border-ev-400 dark:hover:border-ev-400'}`;

  const renderField = () => {
    switch (field.fieldType) {
      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={`${baseClasses} resize-y min-h-[120px]`}
          />
        );

      case 'dropdown':
        return (
          <div className="relative">
            <select
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className={`${baseClasses} appearance-none cursor-pointer`}
            >
              <option value="">Select {field.fieldLabel}</option>
              {((field.options || []) as Array<string | { value: string; label: string }>).map((opt, idx) => (
                <option key={idx} value={typeof opt ===
   'string' ? opt : (opt as { value: string; label: string }).value}>
                  {typeof opt ===
   'string' ? opt : (opt as { value: string; label: string }).label}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-3 pt-1">
            {((field.options || []) as Array<string | { value: string; label: string }>).map((opt, idx) => (
              <label key={idx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${value ===
   (typeof opt ===
   'string' ? opt : (opt as { value: string; label: string }).value)
                  ? 'border-ev-700 bg-ev-50/50 dark:bg-ev-900/20 ring-1 ring-ev-700'
                  : 'border-[#b3cde0] dark:border-gray-700 hover:bg-ev-50/30 dark:hover:bg-gray-800'
                }`}>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${value ===
   (typeof opt ===
   'string' ? opt : (opt as { value: string; label: string }).value)
                    ? 'border-ev-700 bg-ev-700'
                    : 'border-[#b3cde0] dark:border-gray-600'
                  }`}>
                  {value ===
   (typeof opt ===
   'string' ? opt : (opt as { value: string; label: string }).value) && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <input
                  type="radio"
                  name={field.fieldName}
                  value={typeof opt ===
   'string' ? opt : (opt as { value: string; label: string }).value}
                  checked={value ===
   (typeof opt ===
   'string' ? opt : (opt as { value: string; label: string }).value)}
                  onChange={(e) => onChange(e.target.value)}
                  className="sr-only"
                />
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {typeof opt ===
   'string' ? opt : (opt as { value: string; label: string }).label}
                </span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-3 pt-1">
            {((field.options || []) as Array<string | { value: string; label: string }>).map((opt, idx) => {
              const val = typeof opt ===
   'string' ? opt : (opt as { value: string; label: string }).value;
              const isChecked = Array.isArray(value) && value.includes(val);

              return (
                <label key={idx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isChecked
                    ? 'border-ev-700 bg-ev-50/50 dark:bg-ev-900/20 ring-1 ring-ev-700'
                    : 'border-[#b3cde0] dark:border-gray-700 hover:bg-ev-50/30 dark:hover:bg-gray-800'
                  }`}>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isChecked
                      ? 'border-ev-700 bg-ev-700'
                      : 'border-[#b3cde0] dark:border-gray-600'
                    }`}>
                    {isChecked && (
                      <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    value={val}
                    checked={isChecked}
                    onChange={(e) => {
                      const currentValues = Array.isArray(value) ? value : [];
                      if (e.target.checked) {
                        onChange([...currentValues, val]);
                      } else {
                        onChange(currentValues.filter((v: string) => v !== val));
                      }
                    }}
                    className="sr-only"
                  />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {typeof opt ===
   'string' ? opt : (opt as { value: string; label: string }).label}
                  </span>
                </label>
              );
            })}
          </div>
        );

      default:
        return (
          <input
            type={field.fieldType ===
   'number' ? 'number' : field.fieldType ===
   'phone' ? 'tel' : field.fieldType}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={baseClasses}
          />
        );
    }
  };

  return (
    <div className="space-y-2 group">
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors group-hover:text-ev-700 dark:group-hover:text-ev-400">
        {field.fieldLabel}
        {field.isRequired && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderField()}
      {field.helpText && (
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-1.5 ml-1">
          <Info className="w-3.5 h-3.5 text-ev-700" />
          {field.helpText}
        </p>
      )}
      {error && (
        <div data-validation-error className="flex items-center gap-2 mt-2 text-sm text-red-500 animate-in slide-in-from-top-1 fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default function EventRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const eventId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<RegistrationFormData | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step] = useState<'form' | 'team'>('form');
  const [profileFields, setProfileFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadForm = async () => {
      try {
        const data = await eventService.getRegistrationForm(eventId);
        setFormData(data);

        // Store profile field availability from backend
        const pf = data.profileFields || {};
        setProfileFields(pf);

        const initialValues: Record<string, any> = {};
        const profile = data.userProfile || {};
        const displayName = user?.employee?.displayName || user?.student?.displayName || '';
        const nameParts = displayName.trim().split(/\s+/);
        initialValues.firstName = profile.firstName || user?.firstName || nameParts[0] || '';
        initialValues.lastName = profile.lastName || user?.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
        initialValues.email = profile.email || user?.email || '';
        initialValues.phone = profile.phone || user?.employeeDetails?.phone || '';
        initialValues.location = profile.location || '';
        initialValues.institute = profile.institute || user?.employeeDetails?.department?.school?.name || 'SGT University';

        // Initialize new academic/identity fields only if NOT available from profile
        // (if available, backend will merge them silently on submission)
        if (!pf.registrationNo && !pf.studentId) initialValues.registrationNo = '';
        if (!pf.employeeId) initialValues.employeeId = '';
        if (!pf.gender) initialValues.gender = '';
        if (!pf.school) initialValues.school = '';
        if (!pf.department) initialValues.department = '';
        if (!pf.program) initialValues.program = '';
        if (!pf.passOutYear) initialValues.passOutYear = '';

        if (data.existingRegistration?.formData) {
          Object.assign(initialValues, data.existingRegistration.formData);
        }

        setValues(initialValues);
      } catch (error: any) {
        toast({ type: 'error', message: getErrorMessage(error) });
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      loadForm();
    }
  }, [eventId, toast, user]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneDigits = (v: string) => String(v || '').replace(/\D/g, '');

    // Basic Details - all required
    if (!values.firstName?.trim()) newErrors.firstName = 'First name is required';
    if (!values.lastName?.trim()) newErrors.lastName = 'Last name is required';
    if (!values.email?.trim()) newErrors.email = 'Email is required';
    else if (!emailRegex.test(values.email.trim())) newErrors.email = 'Please enter a valid email address';
    if (!values.phone?.trim()) newErrors.phone = 'Mobile number is required';
    else if (phoneDigits(values.phone).length !== 10) newErrors.phone = 'Please enter a valid 10-digit mobile number';
    if (!values.location?.trim()) newErrors.location = 'City / Location is required';
    if (!values.institute?.trim()) newErrors.institute = 'Institute is required';

    // Academic/Identity fields — only validate if visible (i.e. NOT filled from profile)
    const isStudent = formData?.userProfile?.userType ===
   'student';
    if (isStudent && !profileFields.registrationNo && !profileFields.studentId) {
      if (!values.registrationNo?.trim()) newErrors.registrationNo = 'Registration No / UID is required';
    }
    if (!isStudent && !profileFields.employeeId) {
      if (!values.employeeId?.trim()) newErrors.employeeId = 'Employee ID is required';
    }
    if (!profileFields.gender) {
      if (!values.gender?.trim()) newErrors.gender = 'Gender is required';
    }
    if (!profileFields.school) {
      if (!values.school?.trim()) newErrors.school = 'School / Faculty is required';
    }
    if (!profileFields.department) {
      if (!values.department?.trim()) newErrors.department = 'Department is required';
    }
    if (isStudent && !profileFields.program) {
      if (!values.program?.trim()) newErrors.program = 'Program is required';
    }
    if (isStudent && !profileFields.passOutYear) {
      if (!values.passOutYear?.trim()) newErrors.passOutYear = 'Pass Out Year is required';
    }

    // Custom fields
    formData?.customFields.forEach(field => {
      const val = values[field.fieldName];
      const isEmpty = val ===
   undefined || val ===
   null || (typeof val ===
   'string' && !val.trim()) || (Array.isArray(val) && val.length ===
   0);
      if (field.isRequired && isEmpty) {
        newErrors[field.fieldName] = `${field.fieldLabel} is required`;
      } else if (field.fieldType ===
   'email' && val && !emailRegex.test(String(val).trim())) {
        newErrors[field.fieldName] = 'Please enter a valid email';
      } else if (field.fieldType ===
   'phone' && val && phoneDigits(String(val)).length !== 10) {
        newErrors[field.fieldName] = 'Please enter a valid 10-digit mobile number';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length ===
   0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast({ type: 'error', message: 'Please fix the errors before submitting' });
      // Scroll to first error after state updates
      setTimeout(() => {
        const firstError = document.querySelector('[data-validation-error]');
        firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }

    setSubmitting(true);
    try {
      const result = await eventService.submitRegistrationForm(eventId, values);
      if (result.nextStep ===
   'team_management') {
        toast({ type: 'success', message: 'Profile saved! Proceeding to Team Setup.' });
        router.push(`/events/${eventId}/registration/team`);
      } else if (result.couponFullyFree) {
        // Coupon covered 100% — registration auto-confirmed, no payment needed
        toast({ type: 'success', message: 'Registration complete! Coupon covered the full amount.' });
        router.push(`/events/${eventId}`);
      } else if (formData?.event.paymentType ===
   'paid') {
        // Individual paid event → redirect to payment step
        toast({ type: 'success', message: 'Profile saved! Proceeding to Payment.' });
        router.push(`/events/${eventId}/registration/payment`);
      } else {
        toast({ type: 'success', message: 'Registration successful!' });
        router.push(`/events/${eventId}`);
      }
    } catch (error: any) {
      const backendFieldErrors = extractFieldErrors(error);
      if (backendFieldErrors) {
        setErrors(backendFieldErrors);
        setTimeout(() => {
          const firstError = document.querySelector('[data-validation-error]');
          firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      }

      toast({
        type: 'error',
        message: backendFieldErrors
          ? Object.values(backendFieldErrors)[0]
          : getErrorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !formData) {
    return (
      <div className="ev-page flex flex-col items-center justify-center gap-4">
        <PageSkeleton message="Loading registration..." />
      </div>
    );
  }

  const isTeamEvent = formData.event.participationType ===
   'team';
  const existingReg = formData.existingRegistration;
  // Statuses that mean personal info is already locked in
  const isAlreadySubmitted = !!existingReg && existingReg.status !== 'draft';
  const isFullyConfirmed = existingReg?.status ===
   'confirmed';
  const isPendingPayment = existingReg?.status ===
   'pending' && formData.event.paymentType ===
   'paid';
  const isIncompleteTeam = existingReg?.status ===
   'incomplete_team';

  // Show read-only registered view
  if (isAlreadySubmitted) {
    const statusConfig = isFullyConfirmed
      ? { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', icon: <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />, title: 'Registration Complete', titleColor: 'text-emerald-800 dark:text-emerald-200', desc: 'Your registration has been confirmed. Your details are locked.' }
      : isPendingPayment
        ? { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', icon: <CreditCard className="w-6 h-6 text-amber-600 dark:text-amber-400" />, title: 'Payment Pending', titleColor: 'text-amber-800 dark:text-amber-200', desc: 'Your details are saved. Complete payment to confirm registration.' }
        : isIncompleteTeam
          ? { bg: 'bg-ev-50 dark:bg-ev-900/20', border: 'border-ev-200 dark:border-ev-800', icon: <Users className="w-6 h-6 text-ev-700 dark:text-ev-400" />, title: 'Personal Info Saved', titleColor: 'text-ev-800 dark:text-ev-200', desc: 'Your details are saved. Now set up your team to complete registration.' }
          : { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-[#b3cde0] dark:border-gray-700', icon: <Lock className="w-6 h-6 text-gray-500" />, title: 'Already Registered', titleColor: 'text-gray-800 dark:text-gray-200', desc: 'Your registration details are locked.' };

    const savedData = existingReg?.formData || {};

    return (
      <div className="ev-page py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <Link
              href={`/events/${eventId}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-ev-400 hover:text-ev-700 transition-colors mb-3 group"
            >
              <div className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-[#b3cde0] dark:border-gray-700 group-hover:border-ev-400 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
              </div>
              Back to Event
            </Link>
            <h1 className="text-2xl font-bold text-ev-900 dark:text-white">{formData.event.name}</h1>
          </div>

          {/* Status Banner */}
          <div className={`rounded-2xl border p-5 flex items-start gap-4 ${statusConfig.bg} ${statusConfig.border}`}>
            <div className="mt-0.5 flex-shrink-0">{statusConfig.icon}</div>
            <div className="flex-1">
              <h2 className={`text-lg font-bold ${statusConfig.titleColor}`}>{statusConfig.title}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{statusConfig.desc}</p>
              {existingReg?.registrationId && (
                <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">ID: {existingReg.registrationId}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              {isIncompleteTeam && (
                <Link
                  href={`/events/${eventId}/registration/team`}
                  className="ev-btn px-4 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Team Setup
                </Link>
              )}
              {isPendingPayment && (
                <Link
                  href={isTeamEvent ? `/events/${eventId}/registration/team` : `/events/${eventId}/registration/payment`}
                  className="px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-all flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Pay Now
                </Link>
              )}
              {isFullyConfirmed && (
                <Link
                  href={`/events/${eventId}`}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  View Event
                </Link>
              )}
            </div>
          </div>

          {/* QR Code — shown only when confirmed */}
          {isFullyConfirmed && existingReg?.qrCode && (
            <div className="ev-card rounded-2xl p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <QrCode className="w-5 h-5 text-ev-700 dark:text-gray-300" />
                <h3 className="text-base font-bold text-ev-900 dark:text-white">Your Entry QR Code</h3>
              </div>
              <div className="inline-block bg-ev-50 dark:bg-gray-900 border border-[#b3cde0] dark:border-gray-700 rounded-xl px-6 py-5">
                <p className="font-mono text-sm text-gray-800 dark:text-gray-200 break-all leading-relaxed tracking-wide">
                  {existingReg.qrCode}
                </p>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                Show this at the event gate for entry
              </p>
            </div>
          )}

          {/* Read-only form data summary */}
          <div className="ev-card rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#b3cde0]/30 dark:border-gray-700 bg-ev-50/50 dark:bg-gray-800/50 flex items-center gap-2">
              <Lock className="w-4 h-4 text-ev-400" />
              <h2 className="text-base font-bold text-ev-900 dark:text-white">Submitted Details</h2>
              <span className="ml-auto text-xs text-ev-400 bg-ev-50 dark:bg-gray-700 px-2 py-0.5 rounded-full">Read-only</span>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { label: 'First Name', key: 'firstName' },
                { label: 'Last Name', key: 'lastName' },
                { label: 'Email', key: 'email' },
                { label: 'Phone', key: 'phone' },
                { label: 'Location', key: 'location' },
                { label: 'Institute', key: 'institute' },
                { label: 'Gender', key: 'gender' },
                { label: 'Department', key: 'department' },
                { label: 'Program', key: 'program' },
                { label: 'Registration No', key: 'registrationNo' },
                { label: 'Employee ID', key: 'employeeId' },
                { label: 'Pass Out Year', key: 'passOutYear' },
              ] as { label: string; key: string }[])
                .filter(f => values[f.key])
                .map(f => (
                  <div key={f.key} className="space-y-1">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{f.label}</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-[#b3cde0] dark:border-gray-700">
                      {values[f.key] || '—'}
                    </p>
                  </div>
                ))
              }
              {/* Custom fields */}
              {formData.customFields.map(field => {
                const val = savedData[field.fieldName] ?? values[field.fieldName];
                if (!val) return null;
                return (
                  <div key={field.id} className="space-y-1">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{field.fieldLabel}</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-[#b3cde0] dark:border-gray-700">
                      {Array.isArray(val) ? val.join(', ') : String(val)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ev-page py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <Link
              href={`/events/${eventId}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-ev-400 hover:text-ev-700 transition-colors mb-3 group"
            >
              <div className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-[#b3cde0] dark:border-gray-700 group-hover:border-ev-400 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
              </div>
              Back to Event Details
            </Link>
            <h1 className="text-3xl font-bold text-ev-900 dark:text-white tracking-tight">
              {isTeamEvent ? 'Participant Registration' : 'Event Registration'}
            </h1>
            <p className="text-ev-400 dark:text-gray-400 mt-2 max-w-2xl text-lg">
              Complete your profile details to register for <span className="font-semibold text-ev-900 dark:text-white">{formData.event.name}</span>.
            </p>
          </div>

          {/* Progress Steps for Team Events */}
          {isTeamEvent && (
            <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-2 pr-4 sm:pr-6 rounded-2xl border border-[#b3cde0]/60 dark:border-gray-700 shadow-ev overflow-x-auto scrollbar-hide">
              <div className={`flex items-center gap-3 pl-2 pr-4 py-2 rounded-xl transition-all ${step ===
   'form'
                  ? 'bg-ev-50 text-ev-800 dark:bg-ev-900/20 dark:text-ev-200 shadow-ev ring-1 ring-ev-200 dark:ring-ev-800'
                  : 'text-ev-400 dark:text-gray-400'
                }`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step ===
   'form' ? 'bg-ev-700 text-white' : 'bg-gray-200 dark:bg-gray-700'
                  }`}>1</span>
                <span className="font-semibold text-sm">Personal Info</span>
              </div>
              <div className="w-8 h-[2px] bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-ev-50 dark:bg-gray-800 border-2 border-[#b3cde0] dark:border-gray-700 flex items-center justify-center text-xs font-bold text-ev-400">2</span>
                <span className="font-medium text-sm text-gray-400 dark:text-gray-500">Team Setup</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Sidebar - Key Info or Summary */}
          <div className="hidden lg:block lg:col-span-4 sticky top-8 space-y-6">
            <div className="ev-card rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-ev-50 dark:bg-ev-900/20 rounded-xl">
                  <Building2 className="w-5 h-5 text-ev-700 dark:text-ev-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ev-900 dark:text-white uppercase tracking-wider">Registration Info</h3>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-ev-700" /></div>
                  <p className="text-sm text-ev-400 dark:text-gray-300 leading-relaxed">
                    Please ensure all details are accurate as they will be used for certificates and communication.
                  </p>
                </div>
                {isTeamEvent && (
                  <div className="flex gap-3">
                    <div className="mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-ev-700" /></div>
                    <p className="text-sm text-ev-400 dark:text-gray-300 leading-relaxed">
                      After submitting your personal details, you will be redirected to create or join a team.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Form Area */}
          <div className="lg:col-span-8">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* 1. Personal Information Card */}
              <div className="ev-card rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-[#b3cde0]/30 dark:border-gray-700 bg-ev-50/50 dark:bg-gray-800/50">
                  <h2 className="text-lg font-bold text-ev-900 dark:text-white flex items-center gap-2">
                    <span className="w-1 h-5 bg-ev-700 rounded-full" />
                    Basic Details
                  </h2>
                </div>

                <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                  {/* Name Fields - locked from account */}
                  <div className="space-y-2 group">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-ev-700 transition-colors">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={values.firstName || ''}
                      readOnly
                      className={`w-full px-4 py-3 border rounded-xl bg-gray-50 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 outline-none cursor-not-allowed ${errors.firstName ? 'border-red-300 bg-red-50/10' : 'border-[#b3cde0] dark:border-gray-700'
                        }`}
                      placeholder="Ex. John"
                    />
                    {errors.firstName && <p data-validation-error className="text-xs text-red-500 font-medium pl-1">{errors.firstName}</p>}
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-ev-700 transition-colors">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={values.lastName || ''}
                      readOnly
                      className={`w-full px-4 py-3 border rounded-xl bg-gray-50 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 outline-none cursor-not-allowed ${errors.lastName ? 'border-red-300 bg-red-50/10' : 'border-[#b3cde0] dark:border-gray-700'}`}
                      placeholder="Ex. Doe"
                    />
                    {errors.lastName && <p data-validation-error className="text-xs text-red-500 font-medium pl-1">{errors.lastName}</p>}
                  </div>

                  {/* Contact Fields */}
                  <div className="space-y-2 group md:col-span-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-ev-700 transition-colors">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-ev-400" />
                      </div>
                      <input
                        type="email"
                        value={values.email || ''}
                        readOnly
                        className={`w-full pl-11 pr-4 py-3 border rounded-xl bg-gray-50/50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 outline-none cursor-not-allowed ${errors.email ? 'border-red-300 bg-red-50/10' : 'border-[#b3cde0] dark:border-gray-700'}`}
                      />
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                    </div>
                    {errors.email ? <p data-validation-error className="text-xs text-red-500 font-medium pl-1">{errors.email}</p> : <p className="text-xs text-gray-500 pl-1">Email is locked to your account.</p>}
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-ev-700 transition-colors">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-ev-400" />
                      </div>
                      <input
                        type="tel"
                        value={values.phone || ''}
                        onChange={(e) => { setValues({ ...values, phone: e.target.value }); if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' })); }}
                        className={`w-full pl-11 pr-4 py-3 border rounded-xl bg-white dark:bg-gray-800 text-ev-900 dark:text-white outline-none font-mono transition-all ${errors.phone ? 'border-red-300 bg-red-50/10 focus:ring-2 focus:ring-red-100 focus:border-red-500' : 'border-[#b3cde0] dark:border-gray-700 focus:ring-2 focus:ring-ev-200/40 focus:border-ev-700 hover:border-ev-400'}`}
                        placeholder="+91 99999 99999"
                      />
                    </div>
                    {errors.phone && <p data-validation-error className="text-xs text-red-500 font-medium pl-1">{errors.phone}</p>}
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-ev-700 transition-colors">
                      City / Location <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MapPin className="h-4 w-4 text-ev-400" />
                      </div>
                      <input
                        type="text"
                        value={values.location || ''}
                        onChange={(e) => { setValues({ ...values, location: e.target.value }); if (errors.location) setErrors((prev) => ({ ...prev, location: '' })); }}
                        className={`w-full pl-11 pr-4 py-3 border rounded-xl bg-white dark:bg-gray-800 text-ev-900 dark:text-white outline-none transition-all ${errors.location ? 'border-red-300 bg-red-50/10 focus:ring-2 focus:ring-red-100 focus:border-red-500' : 'border-[#b3cde0] dark:border-gray-700 focus:ring-2 focus:ring-ev-200/40 focus:border-ev-700 hover:border-ev-400'}`}
                        placeholder="City, State"
                      />
                    </div>
                    {errors.location && <p data-validation-error className="text-xs text-red-500 font-medium pl-1">{errors.location}</p>}
                  </div>

                  <div className="space-y-2 group md:col-span-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-ev-700 transition-colors">
                      Institute / College <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Building2 className="h-4 w-4 text-ev-400" />
                      </div>
                      <input
                        type="text"
                        value={values.institute || ''}
                        readOnly
                        className={`w-full pl-11 pr-4 py-3 border rounded-xl bg-gray-50 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 outline-none cursor-not-allowed ${errors.institute ? 'border-red-300 bg-red-50/10' : 'border-[#b3cde0] dark:border-gray-700'}`}
                        placeholder="Full Name of Institute"
                      />
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                    </div>
                    {errors.institute ? <p data-validation-error className="text-xs text-red-500 font-medium pl-1">{errors.institute}</p> : <p className="text-xs text-gray-500 pl-1">Institute is locked to your account.</p>}
                  </div>
                </div>
              </div>

              {/* 1b. Academic / Identity Details - Only show fields NOT available from profile */}
              {(() => {
                const isStudent = formData.userProfile?.userType ===
   'student';
                const showRegNo = isStudent && !profileFields.registrationNo && !profileFields.studentId;
                const showEmpId = !isStudent && !profileFields.employeeId;
                const showGender = !profileFields.gender;
                const showSchool = !profileFields.school;
                const showDept = !profileFields.department;
                const showProgram = isStudent && !profileFields.program;
                const showPassOutYear = isStudent && !profileFields.passOutYear;
                const hasAnyVisible = showRegNo || showEmpId || showGender || showSchool || showDept || showProgram || showPassOutYear;

                if (!hasAnyVisible) return null;

                return (
                  <div className="ev-card rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#b3cde0]/30 dark:border-gray-700 bg-ev-50/50 dark:bg-gray-800/50">
                      <h2 className="text-lg font-bold text-ev-900 dark:text-white flex items-center gap-2">
                        <span className="w-1 h-5 bg-ev-800 rounded-full" />
                        Academic Details
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Please fill in the details not found in your profile.</p>
                    </div>

                    <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                      {/* Registration No / UID (students) */}
                      {showRegNo && (
                        <div className="space-y-2 group">
                          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-ev-700 transition-colors">
                            Registration No / UID <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={values.registrationNo || ''}
                            onChange={(e) => { setValues({ ...values, registrationNo: e.target.value }); if (errors.registrationNo) setErrors((prev) => ({ ...prev, registrationNo: '' })); }}
                            className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 text-ev-900 dark:text-white outline-none transition-all ${errors.registrationNo ? 'border-red-300 bg-red-50/10 focus:ring-2 focus:ring-red-100 focus:border-red-500' : 'border-[#b3cde0] dark:border-gray-700 focus:ring-2 focus:ring-ev-200/40 focus:border-ev-700 hover:border-ev-400'}`}
                            placeholder="e.g., 2021-ABC-1234"
                          />
                          {errors.registrationNo && <p data-validation-error className="text-xs text-red-500 font-medium pl-1">{errors.registrationNo}</p>}
                        </div>
                      )}

                      {/* Employee ID (employees) */}
                      {showEmpId && (
                        <div className="space-y-2 group">
                          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-ev-700 transition-colors">
                            Employee ID <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={values.employeeId || ''}
                            onChange={(e) => { setValues({ ...values, employeeId: e.target.value }); if (errors.employeeId) setErrors((prev) => ({ ...prev, employeeId: '' })); }}
                            className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 text-ev-900 dark:text-white outline-none transition-all ${errors.employeeId ? 'border-red-300 bg-red-50/10 focus:ring-2 focus:ring-red-100 focus:border-red-500' : 'border-[#b3cde0] dark:border-gray-700 focus:ring-2 focus:ring-ev-200/40 focus:border-ev-700 hover:border-ev-400'}`}
                            placeholder="e.g., EMP-001"
                          />
                          {errors.employeeId && <p data-validation-error className="text-xs text-red-500 font-medium pl-1">{errors.employeeId}</p>}
                        </div>
                      )}

                      {/* Gender */}
                      {showGender && (
                        <div className="space-y-2 group">
                          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-ev-700 transition-colors">
                            Gender <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <select
                              value={values.gender || ''}
                              onChange={(e) => { setValues({ ...values, gender: e.target.value }); if (errors.gender) setErrors((prev) => ({ ...prev, gender: '' })); }}
                              className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 text-ev-900 dark:text-white outline-none appearance-none cursor-pointer transition-all ${errors.gender ? 'border-red-300 bg-red-50/10 focus:ring-2 focus:ring-red-100 focus:border-red-500' : 'border-[#b3cde0] dark:border-gray-700 focus:ring-2 focus:ring-ev-200/40 focus:border-ev-700 hover:border-ev-400'}`}
                            >
                              <option value="">Select Gender</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                              <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                          </div>
                          {errors.gender && <p data-validation-error className="text-xs text-red-500 font-medium pl-1">{errors.gender}</p>}
                        </div>
                      )}

                      {/* School / Faculty */}
                      {showSchool && (
                        <div className="space-y-2 group">
                          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-ev-700 transition-colors">
                            School / Faculty <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={values.school || ''}
                            onChange={(e) => { setValues({ ...values, school: e.target.value }); if (errors.school) setErrors((prev) => ({ ...prev, school: '' })); }}
                            className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 text-ev-900 dark:text-white outline-none transition-all ${errors.school ? 'border-red-300 bg-red-50/10 focus:ring-2 focus:ring-red-100 focus:border-red-500' : 'border-[#b3cde0] dark:border-gray-700 focus:ring-2 focus:ring-ev-200/40 focus:border-ev-700 hover:border-ev-400'}`}
                            placeholder="e.g., Faculty of Engineering"
                          />
                          {errors.school && <p data-validation-error className="text-xs text-red-500 font-medium pl-1">{errors.school}</p>}
                        </div>
                      )}

                      {/* Department */}
                      {showDept && (
                        <div className="space-y-2 group">
                          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-ev-700 transition-colors">
                            Department <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={values.department || ''}
                            onChange={(e) => { setValues({ ...values, department: e.target.value }); if (errors.department) setErrors((prev) => ({ ...prev, department: '' })); }}
                            className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 text-ev-900 dark:text-white outline-none transition-all ${errors.department ? 'border-red-300 bg-red-50/10 focus:ring-2 focus:ring-red-100 focus:border-red-500' : 'border-[#b3cde0] dark:border-gray-700 focus:ring-2 focus:ring-ev-200/40 focus:border-ev-700 hover:border-ev-400'}`}
                            placeholder="e.g., Computer Science & Engineering"
                          />
                          {errors.department && <p data-validation-error className="text-xs text-red-500 font-medium pl-1">{errors.department}</p>}
                        </div>
                      )}

                      {/* Program (students only) */}
                      {showProgram && (
                        <div className="space-y-2 group">
                          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-ev-700 transition-colors">
                            Program <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={values.program || ''}
                            onChange={(e) => { setValues({ ...values, program: e.target.value }); if (errors.program) setErrors((prev) => ({ ...prev, program: '' })); }}
                            className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 text-ev-900 dark:text-white outline-none transition-all ${errors.program ? 'border-red-300 bg-red-50/10 focus:ring-2 focus:ring-red-100 focus:border-red-500' : 'border-[#b3cde0] dark:border-gray-700 focus:ring-2 focus:ring-ev-200/40 focus:border-ev-700 hover:border-ev-400'}`}
                            placeholder="e.g., B.Tech Computer Science"
                          />
                          {errors.program && <p data-validation-error className="text-xs text-red-500 font-medium pl-1">{errors.program}</p>}
                        </div>
                      )}

                      {/* Pass Out Year (students only) */}
                      {showPassOutYear && (
                        <div className="space-y-2 group">
                          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-ev-700 transition-colors">
                            Pass Out Year <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={values.passOutYear || ''}
                            onChange={(e) => { setValues({ ...values, passOutYear: e.target.value }); if (errors.passOutYear) setErrors((prev) => ({ ...prev, passOutYear: '' })); }}
                            className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 text-ev-900 dark:text-white outline-none transition-all ${errors.passOutYear ? 'border-red-300 bg-red-50/10 focus:ring-2 focus:ring-red-100 focus:border-red-500' : 'border-[#b3cde0] dark:border-gray-700 focus:ring-2 focus:ring-ev-200/40 focus:border-ev-700 hover:border-ev-400'}`}
                            placeholder="e.g., 2025"
                          />
                          {errors.passOutYear && <p data-validation-error className="text-xs text-red-500 font-medium pl-1">{errors.passOutYear}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 2. Additional Fields Card (if any) */}
              {formData.customFields.length > 0 && (
                <div className="ev-card rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#b3cde0]/30 dark:border-gray-700 bg-ev-50/50 dark:bg-gray-800/50">
                    <h2 className="text-lg font-bold text-ev-900 dark:text-white flex items-center gap-2">
                      <span className="w-1 h-5 bg-ev-400 rounded-full" />
                      Additional Information
                    </h2>
                  </div>

                  <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                    {formData.customFields.map(field => (
                      <div key={field.id} className={field.fieldType ===
   'textarea' ? 'md:col-span-2' : ''}>
                        <DynamicField
                          field={field}
                          value={values[field.fieldName]}
                          onChange={(val) => { setValues({ ...values, [field.fieldName]: val }); if (errors[field.fieldName]) setErrors((prev) => ({ ...prev, [field.fieldName]: '' })); }}
                          error={errors[field.fieldName]}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="sticky bottom-4 z-20">
                <div className="ev-card p-4 md:p-5 rounded-2xl shadow-xl shadow-ev-200/30 dark:shadow-black/20 flex items-center justify-between gap-4">

                  <p className="text-sm text-ev-400 dark:text-gray-400 hidden md:block">
                    <span className="text-red-500">*</span> Indicates required fields
                  </p>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <Link
                      href={`/events/${eventId}`}
                      className="flex-1 md:flex-none px-6 py-3 text-center text-sm font-semibold text-ev-800 dark:text-gray-300 hover:bg-ev-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors border border-transparent hover:border-[#b3cde0] dark:hover:border-gray-700"
                    >
                      Cancel
                    </Link>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 md:flex-none px-8 py-3 bg-ev-700 dark:bg-ev-700 text-white dark:text-white rounded-xl text-sm font-bold shadow-lg shadow-ev-200 dark:shadow-none hover:bg-ev-800 hover:shadow-xl hover:translate-y-[-1px] active:translate-y-[0px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <LoadingSpinner size="sm" />
                          Processing...
                        </>
                      ) : isTeamEvent ? (
                        <>
                          Next Step
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </>
                      ) : (
                        <>
                          Complete Registration
                          <CheckCircle2 className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
