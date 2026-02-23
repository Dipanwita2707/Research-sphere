'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Phone, Clock, Car, FileText, CheckCircle, Loader2, AlertCircle, Hotel } from 'lucide-react';
import { gateEntryService } from '@/shared/services/gateEntry.service';
import { useToast } from '@/shared/ui-components/Toast';
import { useAuthStore } from '@/shared/auth/authStore';
import HostelBookingFlow from '../components/HostelBookingFlow';

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

export default function CreatePassPage() {
  const router = useRouter();
  const { showSuccessModal } = useToast();
  const { user } = useAuthStore(); // Get user from Zustand auth store
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = (): boolean => {
    setError(null);
    
    if (!formData.visitorName.trim()) {
      setError('Visitor name is required');
      return false;
    }
    
    if (!formData.mobileNumber.trim() || !/^[0-9]{10}$/.test(formData.mobileNumber)) {
      setError('Valid 10-digit mobile number is required');
      return false;
    }
    
    // Email validation - optional but must be valid format if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    if (!formData.numberOfPersons || formData.numberOfPersons < 1) {
      setError('Number of persons must be at least 1');
      return false;
    }
    
    if (formData.numberOfPersons > 50) {
      setError('Number of persons cannot exceed 50');
      return false;
    }
    
    if (!formData.purposeOfVisit) {
      setError('Purpose of visit is required');
      return false;
    }
    
    if (formData.purposeOfVisit === 'other' && !formData.purposeOther.trim()) {
      setError('Please specify other purpose');
      return false;
    }
    
    if (!formData.visitDate || !formData.visitEndDate) {
      setError('Visit dates are required');
      return false;
    }
    
    if (new Date(formData.visitEndDate) < new Date(formData.visitDate)) {
      setError('End date cannot be before start date');
      return false;
    }
    
    if (!formData.entryTime) {
      setError('Entry time is required');
      return false;
    }
    
    if (formData.hasVehicle && !formData.vehicleNumber.trim()) {
      setError('Vehicle number is required when bringing vehicle');
      return false;
    }
    
    if (formData.hasVehicle && !formData.vehicleModel.trim()) {
      setError('Vehicle model is required when bringing vehicle');
      return false;
    }
    
    // Multi-day accommodation validation
    if (isMultiDay) {
      if (wantToBook === null) {
        setError('Please indicate if you want to book accommodation');
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
        stayRequired: isMultiDay ? true : false,
        checkInDate: isMultiDay ? formData.visitDate : undefined,
        checkOutDate: isMultiDay ? formData.visitEndDate : undefined,
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
        title: 'Pass Created Successfully!',
        message: isMultiDay && accommodationType === 'university' 
          ? 'Now book accommodation for the visitor.' 
          : 'Share this code with your visitor for entry verification.',
        passId: pass.passId,
        verificationCode: pass.verificationCode,
        mobile: formData.mobileNumber,
        email: formData.email || undefined,
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Card - LPU Style */}
        <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] p-4 md:p-6 mb-4">
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
            <User className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
            Create Visitor Pass
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">Fill in visitor details to generate entry pass</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Visitor Information Card - LPU Style */}
          <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3 md:mb-4 flex items-center gap-2">
              <User className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              Visitor Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">              {/* Guardian Dropdown - Only for Students */}
              {isStudentLocked && guardians.length > 0 && (
                <div className="md:col-span-2">
                  <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                    Select Guardian/Parent <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedGuardianId}
                    onChange={handleGuardianSelect}
                    className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={loadingGuardians}
                  >
                    <option value="">-- Select Guardian --</option>
                    {guardians.map(guardian => (
                      <option key={guardian.id} value={guardian.id}>
                        {guardian.name} ({guardian.relationship}) - {guardian.phone}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    📋 Select from your registered guardians or enter manually below
                  </p>
                </div>
              )}

              {/* Loading guardians */}
              {isStudentLocked && loadingGuardians && (
                <div className="md:col-span-2 text-sm text-gray-600">
                  <Loader2 className="inline-block w-4 h-4 mr-2 animate-spin" />
                  Loading your guardians...
                </div>
              )}

              {/* No guardians found */}
              {isStudentLocked && !loadingGuardians && guardians.length === 0 && (
                <div className="md:col-span-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  ⚠️ No guardians found in database. Please enter details manually below.
                </div>
              )}
              <div>
                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                  Visitor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="visitorName"
                  value={formData.visitorName}
                  onChange={handleChange}
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter full name"
                  required
                  readOnly={isStudentLocked && selectedGuardianId !== ''}
                />
                {isStudentLocked && selectedGuardianId && (
                  <p className="text-xs text-green-600 mt-1">✅ Auto-filled from guardian selection</p>
                )}
              </div>

              <div>
                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="mobileNumber"
                  value={formData.mobileNumber}
                  onChange={handleChange}
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="10-digit number"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  required
                  readOnly={isStudentLocked && selectedGuardianId !== ''}
                />
                {isStudentLocked && selectedGuardianId && (
                  <p className="text-xs text-green-600 mt-1">✅ Auto-filled from guardian selection</p>
                )}
                {!(isStudentLocked && selectedGuardianId) && (
                  <p className="text-xs text-gray-500 mt-1">📱 Visitor will receive WhatsApp notification</p>
                )}
              </div>

              <div>
                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="visitor@example.com"
                  readOnly={isStudentLocked && selectedGuardianId !== ''}
                />
                {isStudentLocked && selectedGuardianId && (
                  <p className="text-xs text-green-600 mt-1">✅ Auto-filled from guardian selection</p>
                )}
                <p className="text-xs text-gray-500 mt-1">📧 QR code & pass details will be sent via email</p>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2 flex items-center gap-2">
                  Relation
                  {isStudentLocked && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      🔒 Parent/Guardian Only
                    </span>
                  )}
                </label>
                {isStudentLocked ? (
                  // Students: Dropdown with Parent/Guardian options
                  <select
                    name="visitorRelation"
                    value={formData.visitorRelation}
                    onChange={handleChange}
                    className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={selectedGuardianId !== ''} // Lock if guardian selected
                  >
                    <option value="">Select Relation</option>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Parent">Parent (Other)</option>
                  </select>
                ) : (
                  // General users: Text input
                  <input
                    type="text"
                    name="visitorRelation"
                    value={formData.visitorRelation}
                    onChange={handleChange}
                    className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Friend, Family, Vendor"
                  />
                )}
                {isStudentLocked && selectedGuardianId && (
                  <p className="text-xs text-green-600 mt-1">✅ Auto-filled from guardian selection</p>
                )}
              </div>

              <div>
                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                  Number of Persons <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="numberOfPersons"
                  value={formData.numberOfPersons}
                  onChange={handleChange}
                  min="1"
                  max="50"
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="How many people"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Total number of visitors (including you)</p>
              </div>
            </div>
          </div>

          {/* Visit Details Card - LPU Style */}
          <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3 md:mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              Visit Details
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                  Purpose of Visit <span className="text-red-500">*</span>
                </label>
                <select
                  name="purposeOfVisit"
                  value={formData.purposeOfVisit}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Purpose</option>
                  {purposeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {formData.purposeOfVisit === 'other' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Specify Purpose <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="purposeOther"
                    value={formData.purposeOther}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter purpose"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Visit Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="visitDate"
                  value={formData.visitDate}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Visit End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="visitEndDate"
                  value={formData.visitEndDate}
                  onChange={handleChange}
                  min={formData.visitDate || new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {canBookHostel && (
                  <p className="text-xs text-blue-600 font-medium mt-1">
                    🏨 Multi-day stay detected - hostel/apartment booking available below
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Entry Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="entryTime"
                  value={formData.entryTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {formData.entryTime && (() => {
                  // Convert 24-hour to 12-hour format with AM/PM
                  const [hours, minutes] = formData.entryTime.split(':');
                  const hour = parseInt(hours, 10);
                  const ampm = hour >= 12 ? 'PM' : 'AM';
                  const hour12 = hour % 12 || 12; // Convert to 12-hour (0 becomes 12)
                  return (
                    <p className="text-sm font-semibold text-green-700 mt-1">
                      🕒 {hour12}:{minutes} {ampm}
                    </p>
                  );
                })()}
                <p className="text-xs text-blue-600 mt-1">
                  ⏰ QR code will activate 5 hours before this time
                </p>
              </div>
            </div>
          </div>

          {/* Vehicle Details Card - LPU Style */}
          <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3 md:mb-4 flex items-center gap-2">
              <Car className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              Vehicle Information (Optional)
            </h2>
            
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="hasVehicle"
                  checked={formData.hasVehicle}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-xs md:text-sm font-medium text-gray-700">Visitor will bring a vehicle</span>
              </label>
            </div>

            {formData.hasVehicle && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                    Vehicle Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="vehicleType"
                    value={formData.vehicleType}
                    onChange={handleChange}
                    className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select Type</option>
                    {VEHICLE_TYPES.map(vt => (
                      <option key={vt.value} value={vt.value}>{vt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                    Vehicle Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="vehicleNumber"
                    value={formData.vehicleNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                    placeholder="e.g., DL01AB1234"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                    Vehicle Model <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="vehicleModel"
                    value={formData.vehicleModel}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Honda City, Yamaha R15"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {/* Stay Details Card - LPU Style - ONLY for Students creating passes for Parents */}
          {canBookHostel && (
            <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3 md:mb-4 flex items-center gap-2">
                <Hotel className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                🏨 Accommodation Section
              </h2>
              
              <div className="mb-4 bg-blue-50 border-l-4 border-blue-500 p-3 md:p-4 rounded">
                <p className="text-xs md:text-sm text-blue-900">
                  <strong>ℹ️ Multi-day visit detected:</strong> {formData.visitDate} to {formData.visitEndDate}
                  <br />
                  <span className="text-xs text-blue-700">
                    QR Code activates: 5 hours before entry time on {formData.visitDate}
                    <br />
                    QR Code expires: {formData.visitEndDate} at 23:59
                  </span>
                </p>
              </div>

              {/* Hostel/Apartment Booking Options */}
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Do you want to book Hostel/Apartment?
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setWantToBook(true);
                      setAccommodationType('university');
                    }}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      wantToBook === true 
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200' 
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Hotel className={`w-5 h-5 ${wantToBook === true ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className="font-semibold text-gray-800 text-sm md:text-base">✅ Yes, I want to book</span>
                    </div>
                    <p className="text-xs text-gray-600">Browse & book from available rooms</p>
                    {wantToBook === true && (
                      <p className="text-xs text-blue-600 font-medium mt-2">
                        ✓ Booking flow opens after pass creation
                      </p>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWantToBook(false);
                      setAccommodationType('none');
                    }}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      wantToBook === false 
                        ? 'border-gray-600 bg-gray-50 ring-2 ring-gray-200' 
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className={`w-5 h-5 ${wantToBook === false ? 'text-gray-600' : 'text-gray-400'}`} />
                      <span className="font-semibold text-gray-800 text-sm md:text-base">❌ No, skip booking</span>
                    </div>
                    <p className="text-xs text-gray-600">Continue without accommodation</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Submit Buttons Card */}
          <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-end gap-3 md:gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 md:px-6 py-2 md:py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition text-sm md:text-base"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 md:px-8 py-2 md:py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm md:text-base"
              >
                {loading ? (
                  <>
                  <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                  Creating Pass...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                  Create Pass
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
