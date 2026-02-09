'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, Phone, Mail, CreditCard, Calendar, Clock, Car, 
  FileText, Users, ArrowLeft, Send, QrCode, CheckCircle, Loader2, AlertCircle 
} from 'lucide-react';
import { gateEntryService, type GatePass, type Employee, type Department } from '@/shared/services/gateEntry.service';
import { useAuthStore } from '@/shared/auth/authStore';

// LocalStorage key for draft form data
const DRAFT_STORAGE_KEY = 'gate-entry-draft-form';

interface PassFormData {
  // Visitor Personal Details
  fullName: string;
  mobileNumber: string;
  email: string;
  idProofType: string;
  idProofNumber: string;
  photo: File | null;
  gender: string;
  age: string;
  
  // Visit Details
  purposeOfVisit: string;
  purposeOther: string;
  departmentToVisit: string;
  personToMeetId: string; // Employee's user login ID
  personToMeetName: string; // For display purposes
  visitDate: string;
  expectedEntryTime: string;
  expectedExitTime: string;
  
  // Vehicle Details
  bringingVehicle: boolean;
  vehicleType: string;
  vehicleNumber: string;
  vehicleModel: string;
  
  // Additional Information
  numberOfPersons: string;
  specialInstructions: string;
  itemsCarrying: string;
}

// Dummy data for dropdowns
const ID_PROOF_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'passport', label: 'Passport' },
];

const PURPOSE_OPTIONS = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'event', label: 'Event' },
  { value: 'interview', label: 'Interview' },
  { value: 'other', label: 'Other' },
];

// Removed hardcoded DEPARTMENTS - will be fetched from database

const VEHICLE_TYPES = [
  { value: 'two_wheeler', label: 'Two Wheeler' },
  { value: 'four_wheeler', label: 'Four Wheeler' },
  { value: 'other', label: 'Other' },
];

// Helper function to convert 24-hour time to 12-hour AM/PM format
const formatTime12Hour = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export default function CreatePassPage() {
  const router = useRouter();
  const { logout } = useAuthStore();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPass, setCreatedPass] = useState<GatePass | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [justMovedToStep4, setJustMovedToStep4] = useState(false);
  const [formData, setFormData] = useState<PassFormData>(() => {
    // Try to load saved draft from localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Check if there's actual data (not just empty form)
          const hasData = parsed.fullName || parsed.mobileNumber || parsed.email;
          if (hasData) {
            setDraftLoaded(true);
          }
          // Don't restore photo field (File object can't be serialized)
          return { ...parsed, photo: null };
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
    
    // Default empty form
    return {
      fullName: '',
      mobileNumber: '',
      email: '',
      idProofType: '',
      idProofNumber: '',
      photo: null,
      gender: '',
      age: '',
      purposeOfVisit: '',
      purposeOther: '',
      departmentToVisit: '',
      personToMeetId: '',
      personToMeetName: '',
      visitDate: '',
      expectedEntryTime: '',
      expectedExitTime: '',
      bringingVehicle: false,
      vehicleType: '',
      vehicleNumber: '',
      vehicleModel: '',
      numberOfPersons: '1',
      specialInstructions: '',
      itemsCarrying: '',
    };
  });

  // Auto-save form data to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && !createdPass) {
      try {
        // Don't save photo field (File object can't be serialized)
        const { photo, ...dataToSave } = formData;
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(dataToSave));
        setLastSaved(new Date());
      } catch (error) {
        console.error('Error saving draft:', error);
      }
    }
  }, [formData, createdPass]);

  // Fetch active employees on component mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const response = await gateEntryService.getActiveEmployees();
        console.log('=== EMPLOYEES API RESPONSE ===', response);
        if (response.success && response.data) {
          console.log('Employees data:', response.data.employees);
          console.log('Employees count:', response.data.employees?.length);
          setEmployees(response.data.employees);
        } else {
          console.log('Response not successful or no data');
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
      } finally {
        setLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, []);

  // Fetch active departments on component mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setLoadingDepartments(true);
        const response = await gateEntryService.getActiveDepartments();
        console.log('=== DEPARTMENTS API RESPONSE ===', response);
        if (response.success && response.data) {
          console.log('Departments data:', response.data.departments);
          console.log('Departments count:', response.data.departments?.length);
          setDepartments(response.data.departments);
        } else {
          console.log('Response not successful or no data');
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
      } finally {
        setLoadingDepartments(false);
      }
    };

    fetchDepartments();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'departmentToVisit') {
      // When department changes, clear person to meet
      setFormData(prev => ({ 
        ...prev, 
        departmentToVisit: value,
        personToMeetId: '',
        personToMeetName: ''
      }));
    } else if (name === 'personToMeetId') {
      // Special handling for employee selection
      const selectedEmployee = employees.find(emp => emp.id === value);
      setFormData(prev => ({ 
        ...prev, 
        personToMeetId: value,
        personToMeetName: selectedEmployee?.name || ''
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Filter employees based on selected department
  const filteredEmployees = formData.departmentToVisit
    ? employees.filter(emp => {
        // Match department name (case-insensitive)
        return emp.department.toLowerCase().includes(formData.departmentToVisit.toLowerCase()) ||
               formData.departmentToVisit.toLowerCase().includes(emp.department.toLowerCase());
      })
    : employees;

  // Check if time is during lunch hours (13:00-14:00)
  const isLunchTime = (time: string): boolean => {
    if (!time) return false;
    const [hour] = time.split(':').map(Number);
    return hour >= 13 && hour < 14;
  };

  // Get lunch time warning
  const getLunchTimeWarning = (): boolean => {
    return isLunchTime(formData.expectedEntryTime) || isLunchTime(formData.expectedExitTime);
  };

  // Validation functions
  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 3) {
      errors.fullName = 'Name must be at least 3 characters';
    }

    if (!formData.mobileNumber.trim()) {
      errors.mobileNumber = 'Mobile number is required';
    } else if (!/^[0-9]{10}$/.test(formData.mobileNumber.trim())) {
      errors.mobileNumber = 'Mobile number must be exactly 10 digits';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    if (!formData.idProofType) {
      errors.idProofType = 'ID proof type is required';
    }

    if (!formData.idProofNumber.trim()) {
      errors.idProofNumber = 'ID proof number is required';
    } else {
      const idNumber = formData.idProofNumber.trim();
      
      // ID Proof Type-specific validation
      switch (formData.idProofType) {
        case 'aadhaar':
          if (!/^[0-9]{12}$/.test(idNumber)) {
            errors.idProofNumber = 'Aadhaar number must be exactly 12 digits';
          }
          break;
        
        case 'pan':
          if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(idNumber.toUpperCase())) {
            errors.idProofNumber = 'PAN card format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)';
          }
          break;
        
        case 'driving_license':
          if (!/^[A-Z0-9-]{8,20}$/i.test(idNumber)) {
            errors.idProofNumber = 'Driving license must be 8-20 alphanumeric characters';
          }
          break;
        
        case 'voter_id':
          if (!/^[A-Z]{3}[0-9]{7}$/i.test(idNumber)) {
            errors.idProofNumber = 'Voter ID format: 3 letters + 7 digits (e.g., ABC1234567)';
          }
          break;
        
        case 'passport':
          if (!/^[A-Z][0-9]{7}$/i.test(idNumber)) {
            errors.idProofNumber = 'Passport format: 1 letter + 7 digits (e.g., A1234567)';
          }
          break;
        
        default:
          if (idNumber.length < 4) {
            errors.idProofNumber = 'ID proof number must be at least 4 characters';
          }
      }
    }

    if (!formData.gender) {
      errors.gender = 'Gender is required';
    }

    if (!formData.age) {
      errors.age = 'Age is required';
    } else {
      const ageNum = parseInt(formData.age);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
        errors.age = 'Age must be between 1 and 120';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.purposeOfVisit) {
      errors.purposeOfVisit = 'Purpose of visit is required';
    }

    if (formData.purposeOfVisit === 'other' && !formData.purposeOther?.trim()) {
      errors.purposeOther = 'Please specify the purpose';
    }

    if (!formData.departmentToVisit) {
      errors.departmentToVisit = 'Department is required';
    }

    if (!formData.personToMeetId || !formData.personToMeetId.trim()) {
      errors.personToMeetId = 'Person to meet is required';
    }

    if (!formData.visitDate) {
      errors.visitDate = 'Visit date is required';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(formData.visitDate);
      if (selectedDate < today) {
        errors.visitDate = 'Visit date cannot be in the past';
      }
    }

    if (!formData.expectedEntryTime) {
      errors.expectedEntryTime = 'Entry time is required';
    }

    if (!formData.expectedExitTime) {
      errors.expectedExitTime = 'Exit time is required';
    }

    if (formData.expectedEntryTime && formData.expectedExitTime) {
      const entry = new Date(`2000-01-01T${formData.expectedEntryTime}`);
      const exit = new Date(`2000-01-01T${formData.expectedExitTime}`);
      if (exit <= entry) {
        errors.expectedExitTime = 'Exit time must be after entry time';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errors: Record<string, string> = {};

    if (formData.bringingVehicle) {
      if (!formData.vehicleType) {
        errors.vehicleType = 'Vehicle type is required';
      }

      if (!formData.vehicleNumber?.trim()) {
        errors.vehicleNumber = 'Vehicle number is required';
      } else if (formData.vehicleNumber.trim().length < 4) {
        errors.vehicleNumber = 'Vehicle number must be at least 4 characters';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep4 = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.numberOfPersons || parseInt(formData.numberOfPersons) < 1) {
      errors.numberOfPersons = 'Number of persons must be at least 1';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = validateStep1();
        break;
      case 2:
        isValid = validateStep2();
        break;
      case 3:
        isValid = validateStep3();
        break;
      case 4:
        isValid = validateStep4();
        break;
      default:
        isValid = true;
    }

    if (isValid && currentStep < 4) {
      // Set flag before moving to step 4 to prevent auto-submit
      if (currentStep === 3) {
        setJustMovedToStep4(true);
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setValidationErrors({});
    }
  };

  // Get ID Proof placeholder text based on type
  const getIdProofPlaceholder = () => {
    switch (formData.idProofType) {
      case 'aadhaar':
        return '123456789012 (12 digits)';
      case 'pan':
        return 'ABCDE1234F (5 letters + 4 digits + 1 letter)';
      case 'driving_license':
        return 'DL-1420110012345';
      case 'voter_id':
        return 'ABC1234567 (3 letters + 7 digits)';
      case 'passport':
        return 'A1234567 (1 letter + 7 digits)';
      default:
        return 'Enter ID number';
    }
  };

  const getIdProofHelperText = () => {
    switch (formData.idProofType) {
      case 'aadhaar':
        return '📝 Aadhaar must be exactly 12 digits';
      case 'pan':
        return '📝 PAN format: ABCDE1234F (uppercase)';
      case 'driving_license':
        return '📝 Driving License: 8-20 alphanumeric characters';
      case 'voter_id':
        return '📝 Voter ID: 3 letters followed by 7 digits';
      case 'passport':
        return '📝 Passport: 1 letter followed by 7 digits';
      default:
        return '';
    }
  };

  const calculateDuration = () => {
    if (formData.expectedEntryTime && formData.expectedExitTime) {
      const entry = new Date(`2000-01-01T${formData.expectedEntryTime}`);
      const exit = new Date(`2000-01-01T${formData.expectedExitTime}`);
      const diffMs = exit.getTime() - entry.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${diffHrs}h ${diffMins}m`;
    }
    return 'N/A';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent auto-submit when just moved to step 4
    if (justMovedToStep4) {
      setJustMovedToStep4(false);
      return;
    }
    
    // Only show preview if we're on step 4 and user clicked submit button
    if (currentStep === 4 && validateStep4()) {
      setShowPreview(true);
    }
  };

  const confirmSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Prepare data for API
      const apiData = {
        fullName: formData.fullName,
        mobileNumber: formData.mobileNumber,
        email: formData.email,
        idProofType: formData.idProofType,
        idProofNumber: formData.idProofNumber,
        photo: formData.photo,
        gender: formData.gender,
        age: parseInt(formData.age),
        purposeOfVisit: formData.purposeOfVisit,
        purposeOther: formData.purposeOther,
        departmentToVisit: formData.departmentToVisit,
        personToMeetId: formData.personToMeetId,
        visitDate: formData.visitDate,
        expectedEntryTime: formData.expectedEntryTime,
        expectedExitTime: formData.expectedExitTime,
        bringingVehicle: formData.bringingVehicle,
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber,
        vehicleModel: formData.vehicleModel,
        numberOfPersons: parseInt(formData.numberOfPersons),
        specialInstructions: formData.specialInstructions,
        itemsCarrying: formData.itemsCarrying,
      };

      // Call API
      const response = await gateEntryService.createPass(apiData);
      
      if (response.success) {
        setCreatedPass(response.data.pass);
        setShowPreview(false);
        // Clear draft from localStorage on successful submission
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } else {
        setError('Failed to create pass. Please try again.');
      }
    } catch (err: any) {
      console.error('Error creating pass:', err);
      
      // Handle authentication errors
      if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
        // Clear auth state and redirect to login after 2 seconds
        setTimeout(() => {
          logout();
          router.push('/login');
        }, 2000);
      } else {
        setError(err.response?.data?.message || 'Failed to create pass. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      mobileNumber: '',
      email: '',
      idProofType: '',
      idProofNumber: '',
      photo: null,
      gender: '',
      age: '',
      purposeOfVisit: '',
      purposeOther: '',
      departmentToVisit: '',
      personToMeetId: '',
      personToMeetName: '',
      visitDate: '',
      expectedEntryTime: '',
      expectedExitTime: '',
      bringingVehicle: false,
      vehicleType: '',
      vehicleNumber: '',
      vehicleModel: '',
      numberOfPersons: '1',
      specialInstructions: '',
      itemsCarrying: '',
    });
    setShowPreview(false);
    setCreatedPass(null);
    setCurrentStep(1);
    setError(null);
    setCurrentStep(1);
    setDraftLoaded(false);
    setLastSaved(null);
    // Clear draft from localStorage
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  const clearDraft = () => {
    if (confirm('Are you sure you want to clear all saved data?')) {
      resetForm();
    }
  };

  if (showPreview) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Preview Card */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <QrCode className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Pass Preview</h2>
              <p className="text-gray-600 mt-2">Review details before confirming</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-200 pt-6">
              {/* Visitor Details */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Visitor Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-600">Name:</span> <span className="font-medium">{formData.fullName}</span></div>
                  <div><span className="text-gray-600">Mobile:</span> <span className="font-medium">{formData.mobileNumber}</span></div>
                  <div><span className="text-gray-600">Email:</span> <span className="font-medium">{formData.email}</span></div>
                  <div><span className="text-gray-600">ID Proof:</span> <span className="font-medium">{formData.idProofType} - {formData.idProofNumber}</span></div>
                  <div><span className="text-gray-600">Gender:</span> <span className="font-medium">{formData.gender}</span></div>
                  <div><span className="text-gray-600">Age:</span> <span className="font-medium">{formData.age}</span></div>
                </div>
              </div>

              {/* Visit Details */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Visit Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-600">Purpose:</span> <span className="font-medium">{formData.purposeOfVisit}</span></div>
                  <div><span className="text-gray-600">Department:</span> <span className="font-medium">{formData.departmentToVisit}</span></div>
                  <div><span className="text-gray-600">Person to Meet:</span> <span className="font-medium">{formData.personToMeetName}</span></div>
                  <div><span className="text-gray-600">Visit Date:</span> <span className="font-medium">{formData.visitDate}</span></div>
                  <div><span className="text-gray-600">Entry Time:</span> <span className="font-medium">{formData.expectedEntryTime}</span></div>
                  <div><span className="text-gray-600">Exit Time:</span> <span className="font-medium">{formData.expectedExitTime}</span></div>
                  <div><span className="text-gray-600">Duration:</span> <span className="font-medium">{calculateDuration()}</span></div>
                </div>
              </div>

              {/* Vehicle Details */}
              {formData.bringingVehicle && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Car className="w-5 h-5 text-blue-600" />
                    Vehicle Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-600">Type:</span> <span className="font-medium">{formData.vehicleType}</span></div>
                    <div><span className="text-gray-600">Number:</span> <span className="font-medium">{formData.vehicleNumber}</span></div>
                    <div><span className="text-gray-600">Model:</span> <span className="font-medium">{formData.vehicleModel}</span></div>
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Additional Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-600">No. of Persons:</span> <span className="font-medium">{formData.numberOfPersons}</span></div>
                  <div><span className="text-gray-600">Items Carrying:</span> <span className="font-medium">{formData.itemsCarrying || 'None'}</span></div>
                  {formData.specialInstructions && (
                    <div><span className="text-gray-600">Special Instructions:</span> <span className="font-medium">{formData.specialInstructions}</span></div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ← Edit Details
              </button>
              <button
                onClick={confirmSubmit}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Pass...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Confirm & Generate Pass
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
                error.includes('lunch time') || error.includes('not available')
                  ? 'bg-amber-50 border border-amber-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  error.includes('lunch time') || error.includes('not available')
                    ? 'text-amber-600'
                    : 'text-red-600'
                }`} />
                <div>
                  <p className={`font-medium ${
                    error.includes('lunch time') || error.includes('not available')
                      ? 'text-amber-900'
                      : 'text-red-900'
                  }`}>
                    {error.includes('lunch time') 
                      ? '⏰ Lunch Time Conflict' 
                      : error.includes('not available')
                      ? '📅 Scheduling Conflict'
                      : 'Error Creating Pass'
                    }
                  </p>
                  <p className={`text-sm mt-1 ${
                    error.includes('lunch time') || error.includes('not available')
                      ? 'text-amber-700'
                      : 'text-red-700'
                  }`}>{error}</p>
                  {(error.includes('lunch time') || error.includes('not available')) && (
                    <button
                      onClick={() => setShowPreview(false)}
                      className="mt-3 text-sm text-amber-700 hover:text-amber-800 font-medium underline"
                    >
                      ← Go back and change timing
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Success Screen - Show created pass
  if (createdPass) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            {/* Success Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Gate Pass Created Successfully!</h2>
              <p className="text-gray-600 mt-2">Pass has been generated and notifications have been sent</p>
            </div>

            {/* Pass Details Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-200">
              <div className="text-center mb-4">
                <div className="inline-block bg-white rounded-lg p-4 shadow-md">
                  <div className="text-sm text-gray-600 mb-2">Pass ID</div>
                  <div className="text-2xl font-bold text-blue-600">{createdPass.passId}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
                <div>
                  <span className="text-gray-600">Visitor:</span>
                  <p className="font-semibold text-gray-900">{createdPass.visitorName}</p>
                </div>
                <div>
                  <span className="text-gray-600">Mobile:</span>
                  <p className="font-semibold text-gray-900">{createdPass.mobileNumber}</p>
                </div>
                <div>
                  <span className="text-gray-600">Visit Date:</span>
                  <p className="font-semibold text-gray-900">{new Date(createdPass.visitDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <p className="font-semibold text-green-600 uppercase">{createdPass.status}</p>
                </div>
              </div>
            </div>

            {/* Notifications Sent */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-3">📬 Notifications Sent</h3>
              <div className="space-y-2 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>Email sent to visitor: {createdPass.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>SMS sent to: {createdPass.mobileNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Host notification sent to: {createdPass.personToMeetName}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => window.print()}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                🖨️ Print Pass
              </button>
              <button
                onClick={resetForm}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                ➕ Create Another Pass
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Gate Entry
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create Visitor Pass</h1>
              <p className="text-gray-600 mt-2">Fill in the visitor details to generate an entry pass</p>
            </div>
            {/* Show clear draft button if there's saved data */}
            {(formData.fullName || formData.mobileNumber || formData.email) && (
              <button
                onClick={clearDraft}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
              >
                Clear Saved Data
              </button>
            )}
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                  currentStep >= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {step}
                </div>
                {step < 4 && (
                  <div className={`flex-1 h-1 mx-2 ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm">
            <span className={currentStep >= 1 ? 'text-blue-600 font-medium' : 'text-gray-600'}>Personal Details</span>
            <span className={currentStep >= 2 ? 'text-blue-600 font-medium' : 'text-gray-600'}>Visit Details</span>
            <span className={currentStep >= 3 ? 'text-blue-600 font-medium' : 'text-gray-600'}>Vehicle Info</span>
            <span className={currentStep >= 4 ? 'text-blue-600 font-medium' : 'text-gray-600'}>Additional Info</span>
          </div>
        </div>

        {/* Draft Loaded Notification */}
        {draftLoaded && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">Draft Restored</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Your previously saved information has been loaded. You can continue from where you left off.
                </p>
              </div>
            </div>
            <button
              onClick={() => setDraftLoaded(false)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Form */}
        <form 
          onSubmit={handleSubmit} 
          onKeyDown={(e) => {
            // Prevent Enter key from submitting form on steps 1-3
            if (e.key === 'Enter' && currentStep < 4) {
              e.preventDefault();
            }
          }}
          className="bg-white rounded-lg shadow p-6"
        >
          {/* Auto-save info */}
          <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2 text-sm text-gray-600">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p>
              Your progress is automatically saved. You can safely exit and return later to continue filling the form.
            </p>
          </div>

          {/* Step 1: Personal Details */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-6 h-6 text-blue-600" />
                Visitor Personal Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.fullName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter full name"
                  />
                  {validationErrors.fullName && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={handleInputChange}
                    required
                    maxLength={10}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.mobileNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="10-digit mobile number"
                  />
                  {validationErrors.mobileNumber && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.mobileNumber}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="visitor@example.com"
                  />
                  {validationErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID Proof Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="idProofType"
                    value={formData.idProofType}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.idProofType ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select ID Proof</option>
                    {ID_PROOF_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  {validationErrors.idProofType && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.idProofType}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID Proof Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="idProofNumber"
                    value={formData.idProofNumber}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.idProofNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder={getIdProofPlaceholder()}
                  />
                  {!validationErrors.idProofNumber && formData.idProofType && (
                    <p className="mt-1 text-xs text-gray-500">{getIdProofHelperText()}</p>
                  )}
                  {validationErrors.idProofNumber && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.idProofNumber}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.gender ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {validationErrors.gender && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.gender}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    required
                    min="1"
                    max="120"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.age ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter age"
                  />
                  {validationErrors.age && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.age}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Photo Upload (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Visit Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                Visit Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Purpose of Visit <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="purposeOfVisit"
                    value={formData.purposeOfVisit}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.purposeOfVisit ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Purpose</option>
                    {PURPOSE_OPTIONS.map(purpose => (
                      <option key={purpose.value} value={purpose.value}>{purpose.label}</option>
                    ))}
                  </select>
                  {validationErrors.purposeOfVisit && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.purposeOfVisit}</p>
                  )}
                </div>

                {formData.purposeOfVisit === 'other' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Specify Purpose <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="purposeOther"
                      value={formData.purposeOther}
                      onChange={handleInputChange}
                      required
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        validationErrors.purposeOther ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Please specify"
                    />
                    {validationErrors.purposeOther && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.purposeOther}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department to Visit <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="departmentToVisit"
                    value={formData.departmentToVisit}
                    onChange={handleInputChange}
                    required
                    disabled={loadingDepartments}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.departmentToVisit ? 'border-red-500' : 'border-gray-300'
                    } ${loadingDepartments ? 'bg-gray-100' : ''}`}
                  >
                    <option value="">{loadingDepartments ? 'Loading departments...' : 'Select Department'}</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name} {dept.shortName ? `(${dept.shortName})` : ''}
                      </option>
                    ))}
                  </select>
                  {validationErrors.departmentToVisit && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.departmentToVisit}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Person to Meet <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="personToMeetId"
                    value={formData.personToMeetId}
                    onChange={handleInputChange}
                    required
                    disabled={loadingEmployees || !formData.departmentToVisit}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.personToMeetId ? 'border-red-500' : 'border-gray-300'
                    } ${(loadingEmployees || !formData.departmentToVisit) ? 'bg-gray-100' : ''}`}
                  >
                    <option value="">
                      {loadingEmployees 
                        ? 'Loading employees...' 
                        : !formData.departmentToVisit 
                        ? 'First select a department' 
                        : filteredEmployees.length === 0
                        ? 'No employees in this department'
                        : 'Select Employee'}
                    </option>
                    {filteredEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} - {emp.designation} ({emp.department})
                      </option>
                    ))}
                  </select>
                  {validationErrors.personToMeetId && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.personToMeetId}</p>
                  )}
                  {!validationErrors.personToMeetId && formData.departmentToVisit && (
                    <p className="mt-1 text-xs text-gray-600">
                      {filteredEmployees.length === 0 
                        ? '⚠️ No employees found in this department. Try selecting a different department.'
                        : `✓ ${filteredEmployees.length} employee${filteredEmployees.length > 1 ? 's' : ''} available in this department`}
                    </p>
                  )}
                  {!validationErrors.personToMeetId && !formData.departmentToVisit && (
                    <p className="mt-1 text-xs text-blue-600">
                      💡 Please select a department first to see available employees
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Visit Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="visitDate"
                    value={formData.visitDate}
                    onChange={handleInputChange}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.visitDate ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {validationErrors.visitDate && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.visitDate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expected Entry Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    name="expectedEntryTime"
                    value={formData.expectedEntryTime}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.expectedEntryTime ? 'border-red-500' : 
                      isLunchTime(formData.expectedEntryTime) ? 'border-amber-500' :
                      'border-gray-300'
                    }`}
                  />
                  {formData.expectedEntryTime && (
                    <p className="mt-1 text-xs text-blue-600 font-medium">
                      📅 {formatTime12Hour(formData.expectedEntryTime)} ({formData.expectedEntryTime} - 24hr format)
                    </p>
                  )}
                  {validationErrors.expectedEntryTime && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.expectedEntryTime}</p>
                  )}
                  {!validationErrors.expectedEntryTime && isLunchTime(formData.expectedEntryTime) && (
                    <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      This is lunch time (1:00 PM - 2:00 PM). Meeting may not be possible.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expected Exit Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    name="expectedExitTime"
                    value={formData.expectedExitTime}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.expectedExitTime ? 'border-red-500' : 
                      isLunchTime(formData.expectedExitTime) ? 'border-amber-500' :
                      'border-gray-300'
                    }`}
                  />
                  {formData.expectedExitTime && (
                    <p className="mt-1 text-xs text-blue-600 font-medium">
                      📅 {formatTime12Hour(formData.expectedExitTime)} ({formData.expectedExitTime} - 24hr format)
                    </p>
                  )}
                  {validationErrors.expectedExitTime && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.expectedExitTime}</p>
                  )}
                  {!validationErrors.expectedExitTime && isLunchTime(formData.expectedExitTime) && (
                    <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      This is lunch time (1:00 PM - 2:00 PM). Meeting may not be possible.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration of Stay
                  </label>
                  <div className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
                    {calculateDuration()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Vehicle Details */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Car className="w-6 h-6 text-blue-600" />
                Vehicle Details
              </h2>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="bringingVehicle"
                    checked={formData.bringingVehicle}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Visitor is bringing a vehicle
                  </span>
                </label>
              </div>

              {formData.bringingVehicle && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-200 pt-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="vehicleType"
                      value={formData.vehicleType}
                      onChange={handleInputChange}
                      required={formData.bringingVehicle}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        validationErrors.vehicleType ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select Type</option>
                      {VEHICLE_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    {validationErrors.vehicleType && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.vehicleType}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="vehicleNumber"
                      value={formData.vehicleNumber}
                      onChange={handleInputChange}
                      required={formData.bringingVehicle}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase ${
                        validationErrors.vehicleNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="DL01AB1234"
                    />
                    {validationErrors.vehicleNumber && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.vehicleNumber}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Model/Make
                    </label>
                    <input
                      type="text"
                      name="vehicleModel"
                      value={formData.vehicleModel}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Honda City, Hero Splendor"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Additional Information */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-600" />
                Additional Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Accompanying Persons <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="numberOfPersons"
                    value={formData.numberOfPersons}
                    onChange={handleInputChange}
                    required
                    min="1"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.numberOfPersons ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="1"
                  />
                  {validationErrors.numberOfPersons && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.numberOfPersons}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Items Carrying
                  </label>
                  <input
                    type="text"
                    name="itemsCarrying"
                    value={formData.itemsCarrying}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Laptop, Bag, Equipment"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special Instructions/Notes
                  </label>
                  <textarea
                    name="specialInstructions"
                    value={formData.specialInstructions}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Any special instructions or notes for security..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                currentStep === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ← Previous
            </button>

            {/* Auto-save indicator */}
            {lastSaved && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle className="w-3 h-3 text-green-600" />
                <span>
                  Auto-saved at {lastSaved.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            )}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Next →
              </button>
            ) : (
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Preview & Submit
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
