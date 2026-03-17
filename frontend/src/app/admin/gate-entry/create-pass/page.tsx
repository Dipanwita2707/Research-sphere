'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Phone, Clock, Car, FileText, CheckCircle, Loader2, AlertCircle, Hotel, Mail, Users, Calendar, Hash } from 'lucide-react';
import { gateEntryService } from '@/shared/services/gateEntry.service';
import { useToast } from '@/shared/ui-components/Toast';
import { useAuthStore } from '@/shared/auth/authStore';
import HostelBookingFlow from '../components/HostelBookingFlow';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from '../components/LanguageSelector';
import '../styles/animations.css';

interface SimplePassFormData {
  visitorName: string;
  mobileNumber: string;
  email: string;
  visitorRelation: string;
  numberOfPersons: number;
  purposeOfVisit: string;
  purposeOther: string;
  visitDate: string;
  visitEndDate: string;
  entryTime: string;
  hasVehicle: boolean;
  vehicleType: string;
  vehicleNumber: string;
  vehicleModel: string;
}

type AccommodationType = 'university' | 'external' | 'none' | null;

// Purpose options for students inviting parents/guardians
const STUDENT_PURPOSE_OPTIONS = [
  { value: 'personal', label: 'Family Visit' },
  { value: 'meeting', label: 'Meeting with Student' },
  { value: 'event', label: 'University Event' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'other', label: 'Other' },
];

// Purpose options for general users (admin, staff, faculty)
const GENERAL_PURPOSE_OPTIONS = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'personal', label: 'Personal Visit' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'event', label: 'Event' },
  { value: 'vendor', label: 'Vendor/Service' },
  { value: 'other', label: 'Other' },
];

const VEHICLE_TYPES = [
  { value: 'two_wheeler', label: 'Two Wheeler' },
  { value: 'four_wheeler', label: 'Four Wheeler' },
  { value: 'other', label: 'Other' },
];

function CreatePassPageContent() {
  const router = useRouter();
  const { showSuccessModal } = useToast();
  const { user } = useAuthStore(); // Get user from Zustand auth store
  const { t } = useLanguage(); // Get translation function
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryTimeError, setEntryTimeError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isStudentLocked, setIsStudentLocked] = useState(false);
  const [showHostelBooking, setShowHostelBooking] = useState(false);
  const [createdPassId, setCreatedPassId] = useState<string | null>(null);
  const [accommodationType, setAccommodationType] = useState<AccommodationType>(null);
  
  // Student guardians state
  const [guardians, setGuardians] = useState<Array<{
    id: string;
    name: string;
    relationship: string;
    phone: string;
    email: string;
  }>>([]);
  const [selectedGuardianId, setSelectedGuardianId] = useState<string>('');
  const [loadingGuardians, setLoadingGuardians] = useState(false);
  
  // Duplicate pass checking state
  const [duplicateWarning, setDuplicateWarning] = useState<{
    show: boolean;
    message: string;
    conflictingPasses: any[];
  }>({ show: false, message: '', conflictingPasses: [] });
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  
  // Accommodation flow state
  const [wantToBook, setWantToBook] = useState<boolean | null>(null);
  
  // Dynamic purpose options based on user role
  const purposeOptions = isStudentLocked ? STUDENT_PURPOSE_OPTIONS : GENERAL_PURPOSE_OPTIONS;
  
  const [formData, setFormData] = useState<SimplePassFormData>({
    visitorName: '',
    mobileNumber: '',
    email: '',
    visitorRelation: '',
    numberOfPersons: 1,
    purposeOfVisit: '',
    purposeOther: '',
    visitDate: new Date().toISOString().split('T')[0],
    visitEndDate: new Date().toISOString().split('T')[0],
    entryTime: '',
    hasVehicle: false,
    vehicleType: '',
    vehicleNumber: '',
    vehicleModel: '',
  });

  // Auto-detect multi-day visit (overnight stay - end date is different from start date)
  const isMultiDay = (() => {
    if (!formData.visitDate || !formData.visitEndDate) return false;
    const start = new Date(formData.visitDate);
    const end = new Date(formData.visitEndDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 1; // 1+ nights stay requires accommodation
  })();

  // Hostel booking ONLY for Students creating passes for Parents/Guardians (multi-day)
  const canBookHostel = (() => {
    if (userRole?.toLowerCase() !== 'student') return false;
    if (!isMultiDay) return false;
    
    // Check if relation is parent/guardian (handle both dropdown values and manual input)
    const relation = formData.visitorRelation?.toLowerCase();
    const validRelations = ['parent', 'father', 'mother', 'guardian'];
    
    return validRelations.includes(relation);
  })();

  // Debug log
  useEffect(() => {
    if (userRole?.toLowerCase() === 'student') {
      console.log('[HOSTEL DEBUG] canBookHostel:', canBookHostel);
      console.log('[HOSTEL DEBUG] userRole:', userRole);
      console.log('[HOSTEL DEBUG] visitorRelation:', formData.visitorRelation);
      console.log('[HOSTEL DEBUG] isMultiDay:', isMultiDay);
      console.log('[HOSTEL DEBUG] visitDate:', formData.visitDate);
      console.log('[HOSTEL DEBUG] visitEndDate:', formData.visitEndDate);
    }
  }, [canBookHostel, userRole, formData.visitorRelation, isMultiDay, formData.visitDate, formData.visitEndDate]);

  // Debug guardian state changes
  useEffect(() => {
    console.log('[STATE DEBUG] isStudentLocked:', isStudentLocked);
    console.log('[STATE DEBUG] guardians.length:', guardians.length);
    console.log('[STATE DEBUG] loadingGuardians:', loadingGuardians);
    console.log('[STATE DEBUG] selectedGuardianId:', selectedGuardianId);
  }, [isStudentLocked, guardians, loadingGuardians, selectedGuardianId]);

  // Real-time duplicate pass checking
  useEffect(() => {
    // Only check if we have required fields
    if (!formData.visitorName || !formData.mobileNumber || !formData.visitDate) {
      setDuplicateWarning({ show: false, message: '', conflictingPasses: [] });
      return;
    }

    // Debounce the check
    const timeoutId = setTimeout(async () => {
      try {
        setCheckingDuplicate(true);
        const result = await gateEntryService.checkDuplicate(
          formData.mobileNumber,
          formData.visitorName,
          formData.visitDate,
          isMultiDay ? formData.visitEndDate : undefined
        );

        if (result.isDuplicate) {
          const passes = result.conflictingPasses || [];
          const firstPass = passes[0];
          const dateRange = firstPass?.visitEndDate
            ? `${new Date(firstPass.visitDate).toLocaleDateString()} to ${new Date(firstPass.visitEndDate).toLocaleDateString()}`
            : new Date(firstPass.visitDate).toLocaleDateString();
          
          setDuplicateWarning({
            show: true,
            message: `⚠️ ${formData.visitorName} already has an active pass (${firstPass?.passId}) for ${dateRange}. Status: ${firstPass?.status}`,
            conflictingPasses: passes
          });
        } else {
          setDuplicateWarning({ show: false, message: '', conflictingPasses: [] });
        }
      } catch (error) {
        console.error('[DUPLICATE CHECK] Error:', error);
        // Don't show error to user for now, backend will catch it
      } finally {
        setCheckingDuplicate(false);
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timeoutId);
  }, [formData.visitorName, formData.mobileNumber, formData.visitDate, formData.visitEndDate, isMultiDay]);

  // Check user role on mount - students can only create passes for parents
  useEffect(() => {
    console.log('[CREATE PASS] Component mounted');
    console.log('[CREATE PASS] User from authStore:', user);
    
    const role = user?.userType || null;
    const userId = user?.id || null;
    
    console.log('[CREATE PASS] User Type:', role);
    console.log('[CREATE PASS] User ID:', userId);
    
    setUserRole(role);
    if (role?.toLowerCase() === 'student') {
      console.log('[CREATE PASS] ✅ Student detected, setting up...');
      setIsStudentLocked(true);
      // Don't auto-fill visitorRelation - let student select from dropdown
      
      // Fetch guardians for student
      console.log('[CREATE PASS] 🔄 Calling fetchGuardians()...');
      fetchGuardians();
    } else {
      console.log('[CREATE PASS] ⚠️ Not a student, role:', role);
    }
  }, [user]); // Re-run when user changes

  // Fetch guardians from API
  const fetchGuardians = async () => {
    console.log('[GUARDIAN API] 📞 Fetching guardians...');
    try {
      setLoadingGuardians(true);
      console.log('[GUARDIAN API] Loading state set to true');
      
      const response = await gateEntryService.getGuardians();
      console.log('[GUARDIAN API] ✅ Response received:', response);
      
      const guardiansData = response.data.guardians || [];
      console.log('[GUARDIAN API] 📋 Guardians count:', guardiansData.length);
      
      if (guardiansData.length > 0) {
        console.log('[GUARDIAN API] Guardian list:');
        guardiansData.forEach((g: any, idx: number) => {
          console.log(`  ${idx + 1}. ${g.name} (${g.relationship}) - ${g.phone}`);
        });
      } else {
        console.log('[GUARDIAN API] ⚠️ No guardians found in database');
      }
      
      setGuardians(guardiansData);
      console.log('[GUARDIAN API] State updated with guardians');
    } catch (err: any) {
      console.error('[GUARDIAN API] ❌ Error fetching guardians:', err);
      console.error('[GUARDIAN API] Error details:', err.response?.data || err.message);
      // Don't show error to user, just continue with manual entry as fallback
    } finally {
      setLoadingGuardians(false);
      console.log('[GUARDIAN API] Loading state set to false');
    }
  };

  // Handle guardian selection
  const handleGuardianSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const guardianId = e.target.value;
    setSelectedGuardianId(guardianId);
    
    if (guardianId) {
      const guardian = guardians.find(g => g.id === guardianId);
      if (guardian) {
        setFormData(prev => ({
          ...prev,
          visitorName: guardian.name,
          mobileNumber: guardian.phone || '',
          email: guardian.email || '',
          visitorRelation: guardian.relationship
        }));
      }
    } else {
      // Clear if deselected
      setFormData(prev => ({
        ...prev,
        visitorName: '',
        mobileNumber: '',
        email: '',
        visitorRelation: '' // Let student select from dropdown
      }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      // Entry time validation - Gate Entry allows 5 hours before entry time
      // So we don't need strict past time validation
      if (name === 'entryTime' && value) {
        // Clear any existing error - we allow flexible entry times
        setEntryTimeError(null);
      }
      
      // Visit date validation - Gate Entry allows flexible entry times
      if (name === 'visitDate' && value && formData.entryTime) {
        // Clear any existing error - we allow flexible entry times for outsider passes
        setEntryTimeError(null);
      }
      
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = (): boolean => {
    setError(null);
    
    if (!formData.visitorName.trim()) {
      setError(t('createPass.err.visitorNameRequired'));
      return false;
    }
    
    if (!formData.mobileNumber.trim() || !/^[0-9]{10}$/.test(formData.mobileNumber)) {
      setError(t('createPass.err.invalidMobile'));
      return false;
    }
    
    // Email validation - optional but must be valid format if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError(t('createPass.err.invalidEmail'));
      return false;
    }
    
    if (!formData.numberOfPersons || formData.numberOfPersons < 1) {
      setError(t('createPass.err.personsMin'));
      return false;
    }
    
    if (formData.numberOfPersons > 50) {
      setError(t('createPass.err.personsMax'));
      return false;
    }
    
    if (!formData.purposeOfVisit) {
      setError(t('createPass.err.purposeRequired'));
      return false;
    }
    
    if (formData.purposeOfVisit === 'other' && !formData.purposeOther.trim()) {
      setError(t('createPass.err.specifyOther'));
      return false;
    }
    
    if (!formData.visitDate || !formData.visitEndDate) {
      setError(t('createPass.err.datesRequired'));
      return false;
    }
    
    if (new Date(formData.visitEndDate) < new Date(formData.visitDate)) {
      setError(t('createPass.err.endDateBeforeStart'));
      return false;
    }
    
    if (!formData.entryTime) {
      setError(t('createPass.err.entryTimeRequired'));
      return false;
    }
    
    if (formData.hasVehicle && !formData.vehicleNumber.trim()) {
      setError(t('createPass.err.vehicleNumberRequired'));
      return false;
    }
    
    if (formData.hasVehicle && !formData.vehicleModel.trim()) {
      setError(t('createPass.err.vehicleModelRequired'));
      return false;
    }
    
    // Multi-day accommodation validation - only for students creating Parent/Guardian passes
    if (canBookHostel) {
      if (wantToBook === null) {
        setError(t('createPass.err.accommodationRequired'));
        return false;
      }
      // Set accommodationType based on user choice
      if (wantToBook === false) {
        // Skip booking - no university booking needed
      } else if (wantToBook === true) {
        // Want to book - will show booking flow
      }
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // Submit pass directly (hostel booking is created separately after pass creation)
    await submitPass();
  };

  const submitPass = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const passData = {
        fullName: formData.visitorName,
        mobileNumber: formData.mobileNumber,
        email: formData.email || undefined,
        visitorRelation: formData.visitorRelation,
        numberOfPersons: formData.numberOfPersons,
        purposeOfVisit: formData.purposeOfVisit,
        purposeOther: formData.purposeOther,
        visitDate: formData.visitDate,
        visitEndDate: isMultiDay ? formData.visitEndDate : undefined,
        entryTime: formData.entryTime,
        bringingVehicle: formData.hasVehicle,
        vehicleType: formData.hasVehicle ? formData.vehicleType : undefined,
        vehicleNumber: formData.hasVehicle ? formData.vehicleNumber : undefined,
        vehicleModel: formData.hasVehicle ? formData.vehicleModel : undefined,
        stayRequired: canBookHostel && wantToBook === true,
        checkInDate: canBookHostel && wantToBook === true ? formData.visitDate : undefined,
        checkOutDate: canBookHostel && wantToBook === true ? formData.visitEndDate : undefined,
      };
      
      const response = await gateEntryService.createPass(passData);
      const pass = response.data.pass;
      
      // If multi-day with university hostel, show booking flow
      if (isMultiDay && accommodationType === 'university') {
        setCreatedPassId(pass.passId);
        setShowHostelBooking(true);
      }
      
      // Show beautiful success modal
      showSuccessModal({
        title: t('createPass.successTitle'),
        message: isMultiDay && accommodationType === 'university'
          ? t('createPass.successMessageHostel')
          : t('createPass.successMessage'),
        passId: pass.passId,
        verificationCode: pass.verificationCode,
        mobile: formData.mobileNumber,
        email: formData.email || undefined,
        passIdLabel: t('createPass.successPassId'),
        verificationCodeLabel: t('createPass.successVerifCode'),
        okButtonText: t('createPass.successOk'),
        shareNote: t('createPass.successShareNote'),
        whatsappSentText: t('createPass.successWhatsappSent'),
        emailSentText: t('createPass.successEmailSent'),
      });
      
      // Reset form only if NOT showing hostel booking (so user sees the flow)
      if (!(isMultiDay && accommodationType === 'university')) {
        resetForm();
      }
      
    } catch (err: any) {
      console.error('Create pass error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to create pass');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      visitorName: '',
      mobileNumber: '',
      email: '',
      visitorRelation: '', // Clear relation - let user select
      numberOfPersons: 1,
      purposeOfVisit: '',
      purposeOther: '',
      visitDate: new Date().toISOString().split('T')[0],
      visitEndDate: new Date().toISOString().split('T')[0],
      entryTime: '',
      hasVehicle: false,
      vehicleType: '',
      vehicleNumber: '',
      vehicleModel: '',
    });
    setAccommodationType(null);
    setWantToBook(null);
    setCreatedPassId(null);
    setSelectedGuardianId(''); // Reset guardian selection
    setDuplicateWarning({ show: false, message: '', conflictingPasses: [] }); // Reset duplicate warning
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-3 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Hero Header with Gradient Background - Master Dashboard Style */}
        <div className="relative bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl shadow-[0_8px_30px_rgba(37,99,235,0.25)] p-6 md:p-8 mb-6 overflow-visible animate-fade-in">
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-10 overflow-hidden rounded-2xl">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse-glow"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-300 rounded-full blur-3xl animate-pulse-glow" style={{animationDelay: '1s'}}></div>
          </div>
          
          {/* Content */}
          <div className="relative z-10">
            {/* Header with Language Selector */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                  <User className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl md:text-4xl font-bold text-white">{t('createPass.title')}</h1>
                  <p className="text-blue-100 text-sm md:text-base mt-1">{t('createPass.subtitle')}</p>
                </div>
              </div>
              {/* Language Selector */}
              <div className="flex-shrink-0">
                <LanguageSelector />
              </div>
            </div>
            
            {/* Quick Stats */}
            {userRole && (
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/30">
                  <span className="text-white/90 text-xs font-medium">{t('createPass.creatingAs')}</span>
                  <span className="text-white font-bold ml-2 text-sm">{userRole}</span>
                </div>
                {isStudentLocked && (
                  <div className="bg-yellow-400/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-yellow-300">
                    <span className="text-yellow-900 text-xs font-bold">🔒 {t('createPass.parentGuardianOnly')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Alert with Animation */}
          {error && (
            <div className="animate-shake bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 p-4 rounded-xl shadow-lg">
              <div className="flex items-center gap-3">
                <div className="bg-red-500 p-2 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-red-800 font-bold">{t('createPass.error')}</p>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Visitor Information Card - Animated with Gradient Border */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 md:p-8 hover-lift animate-slide-up stagger-item-1">
            {/* Section Header with Gradient */}
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-xl shadow-lg">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">{t('createPass.visitorInfo')}</h2>
                <p className="text-gray-600 text-sm">{t('createPass.visitorInfoDesc')}</p>
              </div>
            </div>
            
            <div className="space-y-5">
              {/* Guardian Dropdown - Only for Students */}
              {isStudentLocked && guardians.length > 0 && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    {t('createPass.selectGuardian')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedGuardianId}
                      onChange={handleGuardianSelect}
                      className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white hover:border-blue-400"
                      disabled={loadingGuardians}
                    >
                      <option value="">{t('createPass.selectGuardianOption')}</option>
                      {guardians.map(guardian => (
                        <option key={guardian.id} value={guardian.id}>
                          {guardian.name} ({guardian.relationship}) - {guardian.phone}
                        </option>
                      ))}
                    </select>
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {t('createPass.selectFromGuardians')}
                  </p>
                </div>
              )}

              {/* Loading guardians */}
              {isStudentLocked && loadingGuardians && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl animate-pulse">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <span className="text-sm font-medium text-blue-800">{t('createPass.loadingGuardians')}</span>
                </div>
              )}

              {/* No guardians found */}
              {isStudentLocked && !loadingGuardians && guardians.length === 0 && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl animate-fade-in">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <p className="text-sm font-medium text-amber-800">
                      {t('createPass.noGuardiansFound')}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Visitor Name */}
                <div className="animate-fade-in stagger-item-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    {t('createPass.visitorName')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="visitorName"
                      value={formData.visitorName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400"
                      placeholder={t('common.enterFullName')}
                      required
                      readOnly={isStudentLocked && selectedGuardianId !== ''}
                    />
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                  {isStudentLocked && selectedGuardianId && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {t('createPass.autoFilled')}
                    </p>
                  )}
                </div>

                {/* Mobile Number */}
                <div className="animate-fade-in stagger-item-3">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    {t('createPass.mobileNumber')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      name="mobileNumber"
                      value={formData.mobileNumber}
                      onChange={handleChange}
                      className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400"
                      placeholder={t('common.tenDigitNumber')}
                      maxLength={10}
                      pattern="[0-9]{10}"
                      required
                      readOnly={isStudentLocked && selectedGuardianId !== ''}
                    />
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                  {isStudentLocked && selectedGuardianId && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {t('createPass.autoFilled')}
                    </p>
                  )}
                  {!(isStudentLocked && selectedGuardianId) && (
                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {t('createPass.whatsappNotification')}
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div className="animate-fade-in stagger-item-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    {t('createPass.emailAddress')}
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400"
                      placeholder={t('common.visitorExample')}
                      readOnly={isStudentLocked && selectedGuardianId !== ''}
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                  {isStudentLocked && selectedGuardianId && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {t('createPass.autoFilled')}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {t('createPass.emailNotification')}
                  </p>
                </div>

                {/* Relation */}
                <div className="animate-fade-in stagger-item-5">
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    {t('createPass.relation')}
                    {isStudentLocked && (
                      <span className="text-xs bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-1 rounded-full font-bold">
                        🔒 {t('createPass.parentGuardianBadge')}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    {isStudentLocked ? (
                      <select
                        name="visitorRelation"
                        value={formData.visitorRelation}
                        onChange={handleChange}
                        className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white hover:border-blue-400"
                        required
                        disabled={selectedGuardianId !== ''}
                      >
                        <option value="">{t('createPass.selectRelation')}</option>
                        <option value="Father">{t('createPass.father')}</option>
                        <option value="Mother">{t('createPass.mother')}</option>
                        <option value="Guardian">{t('createPass.guardian')}</option>
                        <option value="Parent">{t('createPass.parentOther')}</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        name="visitorRelation"
                        value={formData.visitorRelation}
                        onChange={handleChange}
                        className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400"
                        placeholder={t('common.relationExample')}
                      />
                    )}
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                  {isStudentLocked && selectedGuardianId && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {t('createPass.autoFilled')}
                    </p>
                  )}
                </div>

                {/* Number of Persons */}
                <div className="animate-fade-in stagger-item-6">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    {t('createPass.numberOfPersons')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="numberOfPersons"
                      value={formData.numberOfPersons}
                      onChange={handleChange}
                      min="1"
                      max="50"
                      className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400"
                      placeholder={t('createPass.howManyPeople')}
                      required
                    />
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{t('createPass.totalVisitors')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Visit Details Card - Animated with Green Gradient */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 md:p-8 hover-lift animate-slide-up stagger-item-2">
            {/* Section Header with Gradient */}
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-3 rounded-xl shadow-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">{t('createPass.visitDetails')}</h2>
                <p className="text-gray-600 text-sm">{t('createPass.visitDetailsDesc')}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Purpose of Visit */}
              <div className="animate-fade-in">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {t('createPass.purposeOfVisit')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    name="purposeOfVisit"
                    value={formData.purposeOfVisit}
                    onChange={handleChange}
                    className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-white hover:border-green-400"
                    required
                  >
                    <option value="">{t('common.selectPurpose')}</option>
                    {purposeOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {t(`createPass.${isStudentLocked ? 'studentPurpose' : 'generalPurpose'}.${opt.value}`)}
                      </option>
                    ))}
                  </select>
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Other Purpose */}
              {formData.purposeOfVisit === 'other' && (
                <div className="animate-slide-in-right">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    {t('createPass.specifyPurpose')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="purposeOther"
                    value={formData.purposeOther}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all hover:border-green-400"
                    placeholder={t('createPass.enterPurpose')}
                    required
                  />
                </div>
              )}

              {/* Visit Start Date */}
              <div className="animate-fade-in">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {t('createPass.visitStartDate')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    name="visitDate"
                    value={formData.visitDate}
                    onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all hover:border-green-400"
                    required
                  />
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Visit End Date */}
              <div className="animate-fade-in">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {t('createPass.visitEndDate')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    name="visitEndDate"
                    value={formData.visitEndDate}
                    onChange={handleChange}
                    min={formData.visitDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all hover:border-green-400"
                    required
                  />
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
                {canBookHostel && (
                  <p className="text-xs text-blue-600 font-bold mt-2 flex items-center gap-1 animate-pulse-glow">
                    <Hotel className="w-4 h-4" />
                    {t('createPass.multiDayStayDetected')}
                  </p>
                )}
              </div>

              {/* Entry Time */}
              <div className="md:col-span-2 animate-fade-in">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {t('createPass.entryTime')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="time"
                    name="entryTime"
                    value={formData.entryTime}
                    onChange={handleChange}
                    className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all hover:border-green-400"
                    required
                  />
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
                
                {/* Entry Time Validation Error */}
                {entryTimeError && (
                  <div className="mt-2 animate-shake bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-red-800 font-bold text-sm">{entryTimeError}</p>
                    </div>
                  </div>
                )}
                
                {formData.entryTime && !entryTimeError && (() => {
                  const [hours, minutes] = formData.entryTime.split(':');
                  const hour = parseInt(hours, 10);
                  const ampm = hour >= 12 ? 'PM' : 'AM';
                  const hour12 = hour % 12 || 12;
                  return (
                    <div className="mt-2 flex flex-wrap gap-3">
                      <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {t('createPass.entry')} {hour12}:{minutes} {ampm}
                      </div>
                      <div className="bg-blue-50 border border-blue-300 text-blue-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {t('createPass.qrActivates')}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Vehicle Details Card - Animated with Purple Gradient */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 md:p-8 hover-lift animate-slide-up stagger-item-3">
            {/* Section Header with Gradient */}
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-3 rounded-xl shadow-lg">
                <Car className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">{t('createPass.vehicleInfo')}</h2>
                <p className="text-gray-600 text-sm">{t('createPass.vehicleInfoDesc')}</p>
              </div>
            </div>
            
            {/* Vehicle Checkbox */}
            <div className="mb-5">
              <label className="flex items-center gap-3 cursor-pointer group p-4 rounded-xl border-2 border-gray-300 hover:border-purple-400 hover:bg-purple-50 transition-all">
                <input
                  type="checkbox"
                  name="hasVehicle"
                  checked={formData.hasVehicle}
                  onChange={handleChange}
                  className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <div className="flex items-center gap-2">
                  <Car className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-bold text-gray-700">{t('createPass.visitorWillBringVehicle')}</span>
                </div>
              </label>
            </div>

            {/* Vehicle Form Fields */}
            {formData.hasVehicle && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-slide-down">
                {/* Vehicle Type */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    {t('createPass.vehicleType')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      name="vehicleType"
                      value={formData.vehicleType}
                      onChange={handleChange}
                      className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all bg-white hover:border-purple-400"
                      required
                    >
                      <option value="">{t('createPass.selectVehicleType')}</option>
                      {VEHICLE_TYPES.map(vt => (
                        <option key={vt.value} value={vt.value}>{t(`createPass.vehicleType.${vt.value}`)}</option>
                      ))}
                    </select>
                    <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                </div>

                {/* Vehicle Number */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    {t('createPass.vehicleNumber')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="vehicleNumber"
                      value={formData.vehicleNumber}
                      onChange={handleChange}
                      className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all hover:border-purple-400 uppercase font-mono"
                      placeholder={t('createPass.vehicleNumberExample')}
                      required
                    />
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                </div>

                {/* Vehicle Model */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    {t('createPass.vehicleModel')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="vehicleModel"
                      value={formData.vehicleModel}
                      onChange={handleChange}
                      className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all hover:border-purple-400"
                      placeholder={t('createPass.vehicleModelExample')}
                      required
                    />
                    <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            )}

            {/* No Vehicle Info Message */}
            {!formData.hasVehicle && (
              <div className="text-center py-8 text-gray-500 animate-fade-in">
                <Car className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">{t('createPass.noVehicleRequired')}</p>
              </div>
            )}
          </div>

          {/* Stay Details Card - Orange Gradient Theme - ONLY for Students creating passes for Parents */}
          {canBookHostel && (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 md:p-8 hover-lift animate-slide-up stagger-item-4">
              {/* Section Header with Gradient */}
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-br from-orange-500 to-red-500 p-3 rounded-xl shadow-lg">
                  <Hotel className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">{t('createPass.accommodation')}</h2>
                  <p className="text-gray-600 text-sm">{t('createPass.accommodationDesc')}</p>
                </div>
              </div>
              
              {/* Info Banner */}
              <div className="mb-6 bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-500 p-4 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-blue-900 mb-1">
                      {t('createPass.multiDayVisitDetected')}
                    </p>
                    <div className="text-xs text-blue-700 space-y-1">
                      <p><strong>{t('createPass.visitPeriod')}</strong> {formData.visitDate} to {formData.visitEndDate}</p>
                      <p><strong>{t('createPass.qrActivation')}</strong> 5 hours before entry time on {formData.visitDate}</p>
                      <p><strong>{t('createPass.qrExpiry')}</strong> {formData.visitEndDate} at 23:59</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Booking Options */}
              <div className="mt-6">
                <p className="text-sm font-bold text-gray-700 mb-4">
                  {t('createPass.bookHostelQuestion')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Yes - Book */}
                  <button
                    type="button"
                    onClick={() => {
                      setWantToBook(true);
                      setAccommodationType('university');
                    }}
                    className={`group p-5 border-2 rounded-2xl text-left transition-all transform hover:scale-105 ${
                      wantToBook === true 
                        ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-red-50 ring-4 ring-orange-200 scale-105' 
                        : 'border-gray-300 hover:border-orange-400 hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${wantToBook === true ? 'bg-orange-500' : 'bg-gray-200'}`}>
                        <Hotel className={`w-6 h-6 ${wantToBook === true ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      <span className="font-bold text-gray-800 text-base">{t('createPass.yesBooking')}</span>
                    </div>
                    <p className="text-xs text-gray-600 ml-11">{t('createPass.browseRooms')}</p>
                    {wantToBook === true && (
                      <div className="mt-3 ml-11 bg-white border-2 border-orange-400 text-orange-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 animate-pulse-glow">
                        <CheckCircle className="w-4 h-4" />
                        {t('createPass.bookingFlowOpens')}
                      </div>
                    )}
                  </button>

                  {/* No - Skip */}
                  <button
                    type="button"
                    onClick={() => {
                      setWantToBook(false);
                      setAccommodationType('none');
                    }}
                    className={`group p-5 border-2 rounded-2xl text-left transition-all transform hover:scale-105 ${
                      wantToBook === false 
                        ? 'border-gray-600 bg-gradient-to-br from-gray-50 to-gray-100 ring-4 ring-gray-200 scale-105' 
                        : 'border-gray-300 hover:border-gray-400 hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${wantToBook === false ? 'bg-gray-600' : 'bg-gray-200'}`}>
                        <Clock className={`w-6 h-6 ${wantToBook === false ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      <span className="font-bold text-gray-800 text-base">{t('createPass.noSkipBooking')}</span>
                    </div>
                    <p className="text-xs text-gray-600 ml-11">{t('createPass.continueWithoutBooking')}</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Submit Buttons Card - Gradient Theme */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 md:p-8 animate-slide-up stagger-item-5">
            
            {/* Duplicate Pass Warning - Enhanced with Animation */}
            {duplicateWarning.show && (
              <div className="mb-6 bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 p-5 rounded-xl shadow-xl animate-shake">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="bg-red-500 p-2 rounded-lg">
                      <AlertCircle className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-800 mb-2 flex items-center gap-2">
                      {t('createPass.duplicateFound')}
                    </h3>
                    <div className="text-sm text-red-700 space-y-2">
                      <p className="font-bold bg-white/70 p-2 rounded">{duplicateWarning.message}</p>
                      <p>
                        {t('createPass.cancelExisting')}
                      </p>
                    </div>
                    {duplicateWarning.conflictingPasses.length > 0 && (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => router.push('/admin/gate-entry')}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-bold rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                          <FileText className="w-4 h-4" />
                          {t('createPass.viewExistingPasses')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Checking Duplicate Spinner */}
            {checkingDuplicate && (
              <div className="mb-6 bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-xl p-4 flex items-center gap-3 animate-pulse">
                <div className="bg-blue-500 p-2 rounded-lg">
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                </div>
                <span className="font-bold text-blue-800">{t('createPass.checkingDuplicate')}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all transform hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {t('createPass.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || duplicateWarning.show}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('createPass.creating')}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    {t('createPass.createPass')}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Hostel Booking Modal - shown after pass creation for multi-day university hostel */}
        {showHostelBooking && createdPassId && (
          <HostelBookingFlow
            passId={createdPassId}
            checkInDate={formData.visitDate}
            checkOutDate={formData.visitEndDate}
            guestCount={formData.numberOfPersons}
            onClose={() => {
              setShowHostelBooking(false);
              resetForm();
            }}
            onSuccess={() => {
              setShowHostelBooking(false);
              resetForm();
            }}
          />
        )}
      </div>
    </div>
  );
}

// Wrap with LanguageProvider
export default function CreatePassPage() {
  return (
    <LanguageProvider>
      <CreatePassPageContent />
    </LanguageProvider>
  );
}
