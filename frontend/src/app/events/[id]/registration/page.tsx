'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Loader2, CheckCircle2,
  AlertCircle, Info, MapPin, Phone, Mail, Building2
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type {
  EventCustomField,
  RegistrationFormData
} from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';

interface DynamicFieldProps {
  field: EventCustomField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

const DynamicField: React.FC<DynamicFieldProps> = ({ field, value, onChange, error }) => {
  const baseClasses = `w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white
    focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 outline-none
    ${error
      ? 'border-red-300 focus:border-red-500 focus:ring-red-100 bg-red-50/10'
      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'}`;

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
                <option key={idx} value={typeof opt === 'string' ? opt : (opt as { value: string; label: string }).value}>
                  {typeof opt === 'string' ? opt : (opt as { value: string; label: string }).label}
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
              <label key={idx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${value === (typeof opt === 'string' ? opt : (opt as { value: string; label: string }).value)
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${value === (typeof opt === 'string' ? opt : (opt as { value: string; label: string }).value)
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300 dark:border-gray-600'
                  }`}>
                  {value === (typeof opt === 'string' ? opt : (opt as { value: string; label: string }).value) && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <input
                  type="radio"
                  name={field.fieldName}
                  value={typeof opt === 'string' ? opt : (opt as { value: string; label: string }).value}
                  checked={value === (typeof opt === 'string' ? opt : (opt as { value: string; label: string }).value)}
                  onChange={(e) => onChange(e.target.value)}
                  className="sr-only"
                />
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {typeof opt === 'string' ? opt : (opt as { value: string; label: string }).label}
                </span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-3 pt-1">
            {((field.options || []) as Array<string | { value: string; label: string }>).map((opt, idx) => {
              const val = typeof opt === 'string' ? opt : (opt as { value: string; label: string }).value;
              const isChecked = Array.isArray(value) && value.includes(val);

              return (
                <label key={idx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isChecked
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isChecked
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300 dark:border-gray-600'
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
                    {typeof opt === 'string' ? opt : (opt as { value: string; label: string }).label}
                  </span>
                </label>
              );
            })}
          </div>
        );

      default:
        return (
          <input
            type={field.fieldType === 'number' ? 'number' : field.fieldType === 'phone' ? 'tel' : field.fieldType}
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
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
        {field.fieldLabel}
        {field.isRequired && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderField()}
      {field.helpText && (
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-1.5 ml-1">
          <Info className="w-3.5 h-3.5 text-blue-500" />
          {field.helpText}
        </p>
      )}
      {error && (
        <div className="flex items-center gap-2 mt-2 text-sm text-red-500 animate-in slide-in-from-top-1 fade-in">
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
  const eventId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<RegistrationFormData | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step] = useState<'form' | 'team'>('form');

  useEffect(() => {
    const loadForm = async () => {
      try {
        const data = await eventService.getRegistrationForm(eventId);
        setFormData(data);

        const initialValues: Record<string, any> = {};
        if (data.userProfile) {
          initialValues.firstName = data.userProfile.firstName;
          initialValues.lastName = data.userProfile.lastName;
          initialValues.email = data.userProfile.email;
          initialValues.phone = data.userProfile.phone;
          initialValues.location = data.userProfile.location;
          initialValues.institute = data.userProfile.institute;
        }

        if (data.existingRegistration?.formData) {
          Object.assign(initialValues, data.existingRegistration.formData);
        }

        setValues(initialValues);
      } catch (error: any) {
        toast({ type: 'error', message: error.response?.data?.message || 'Failed to load registration form' });
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      loadForm();
    }
  }, [eventId, toast]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!values.firstName?.trim()) newErrors.firstName = 'First name is required';
    if (!values.email?.trim()) newErrors.email = 'Email is required';

    formData?.customFields.forEach(field => {
      if (field.isRequired && !values[field.fieldName]) {
        newErrors[field.fieldName] = `${field.fieldLabel} is required`;
      }
      if (field.fieldType === 'email' && values[field.fieldName] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[field.fieldName])) {
        newErrors[field.fieldName] = 'Please enter a valid email';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast({ type: 'error', message: 'Please fix the errors before submitting' });
      // Scroll to first error
      const firstError = document.querySelector('.text-red-500');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await eventService.submitRegistrationForm(eventId, values);
      if (result.nextStep === 'team_management') {
        toast({ type: 'success', message: 'Profile saved! Proceeding to Team Setup.' });
        router.push(`/events/${eventId}/registration/team`);
      } else {
        toast({ type: 'success', message: 'Registration successful!' });
        router.push(`/events/${eventId}`);
      }
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !formData) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse">Loading registration...</p>
      </div>
    );
  }

  const isTeamEvent = formData.event.participationType === 'team';

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-950 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <Link
              href={`/events/${eventId}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors mb-3 group"
            >
              <div className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 group-hover:border-blue-200 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
              </div>
              Back to Event Details
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              {isTeamEvent ? 'Participant Registration' : 'Event Registration'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-2xl text-lg">
              Complete your profile details to register for <span className="font-semibold text-gray-900 dark:text-white">{formData.event.name}</span>.
            </p>
          </div>

          {/* Progress Steps for Team Events */}
          {isTeamEvent && (
            <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-2 pr-6 rounded-2xl border border-gray-200/60 dark:border-gray-700 shadow-sm">
              <div className={`flex items-center gap-3 pl-2 pr-4 py-2 rounded-xl transition-all ${step === 'form'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200 shadow-sm ring-1 ring-blue-100 dark:ring-blue-800'
                  : 'text-gray-500 dark:text-gray-400'
                }`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 'form' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
                  }`}>1</span>
                <span className="font-semibold text-sm">Personal Info</span>
              </div>
              <div className="w-8 h-[2px] bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center text-xs font-bold text-gray-400">2</span>
                <span className="font-medium text-sm text-gray-400 dark:text-gray-500">Team Setup</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Sidebar - Key Info or Summary */}
          <div className="hidden lg:block lg:col-span-4 sticky top-8 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-blue-100 dark:border-blue-900/30 p-6 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Registration Info</h3>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /></div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    Please ensure all details are accurate as they will be used for certificates and communication.
                  </p>
                </div>
                {isTeamEvent && (
                  <div className="flex gap-3">
                    <div className="mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /></div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
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
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="w-1 h-5 bg-blue-500 rounded-full" />
                    Basic Details
                  </h2>
                </div>

                <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                  {/* Name Fields */}
                  <div className="space-y-2 group">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 transition-colors">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={values.firstName || ''}
                      onChange={(e) => setValues({ ...values, firstName: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all ${errors.firstName ? 'border-red-300 bg-red-50/10' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                        }`}
                      placeholder="Ex. John"
                    />
                    {errors.firstName && <p className="text-xs text-red-500 font-medium pl-1">{errors.firstName}</p>}
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 transition-colors">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={values.lastName || ''}
                      onChange={(e) => setValues({ ...values, lastName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 hover:border-blue-300 transition-all"
                      placeholder="Ex. Doe"
                    />
                  </div>

                  {/* Contact Fields */}
                  <div className="space-y-2 group md:col-span-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 transition-colors">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        value={values.email || ''}
                        onChange={(e) => setValues({ ...values, email: e.target.value })}
                        className={`w-full pl-11 pr-4 py-3 border rounded-xl bg-gray-50/50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 outline-none cursor-not-allowed ${errors.email ? 'border-red-300' : 'border-gray-200 dark:border-gray-700'
                          }`}
                        readOnly
                      />
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 pl-1">Email is locked to your account.</p>
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 transition-colors">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        value={values.phone || ''}
                        onChange={(e) => setValues({ ...values, phone: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 hover:border-blue-300 transition-all font-mono"
                        placeholder="+91 99999 99999"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 transition-colors">
                      City / Location <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MapPin className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={values.location || ''}
                        onChange={(e) => setValues({ ...values, location: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 hover:border-blue-300 transition-all"
                        placeholder="City, State"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 group md:col-span-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 transition-colors">
                      Institute / College <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Building2 className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={values.institute || ''}
                        onChange={(e) => setValues({ ...values, institute: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 hover:border-blue-300 transition-all"
                        placeholder="Full Name of Institute"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Additional Fields Card (if any) */}
              {formData.customFields.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="w-1 h-5 bg-purple-500 rounded-full" />
                      Additional Information
                    </h2>
                  </div>

                  <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                    {formData.customFields.map(field => (
                      <div key={field.id} className={field.fieldType === 'textarea' ? 'md:col-span-2' : ''}>
                        <DynamicField
                          field={field}
                          value={values[field.fieldName]}
                          onChange={(val) => setValues({ ...values, [field.fieldName]: val })}
                          error={errors[field.fieldName]}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="sticky bottom-4 z-20">
                <div className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-black/20 flex items-center justify-between gap-4">

                  <p className="text-sm text-gray-500 dark:text-gray-400 hidden md:block">
                    <span className="text-red-500">*</span> Indicates required fields
                  </p>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <Link
                      href={`/events/${eventId}`}
                      className="flex-1 md:flex-none px-6 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                    >
                      Cancel
                    </Link>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 md:flex-none px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold shadow-lg shadow-gray-200 dark:shadow-none hover:shadow-xl hover:translate-y-[-1px] active:translate-y-[0px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
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
