'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Phone, Clock, Car, FileText, CheckCircle, Loader2, AlertCircle, Hotel } from 'lucide-react';
import { gateEntryService } from '@/shared/services/gateEntry.service';
import { useToast } from '@/shared/ui-components/Toast';

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
  expectedEntryTime: string;
  expectedExitTime: string;
  hasVehicle: boolean;
  vehicleType: string;
  vehicleNumber: string;
  hostelName: string;
  roomNumber: string;
}

const PURPOSE_OPTIONS = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'personal', label: 'Personal Visit' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'event', label: 'Event' },
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
    expectedEntryTime: '',
    expectedExitTime: '',
    hasVehicle: false,
    vehicleType: '',
    vehicleNumber: '',
    hostelName: '',
    roomNumber: '',
  });

  // Auto-detect multi-day visit
  const isMultiDay = formData.visitDate && formData.visitEndDate && formData.visitDate !== formData.visitEndDate;

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
    
    if (!formData.expectedEntryTime || !formData.expectedExitTime) {
      setError('Entry and exit times are required');
      return false;
    }
    
    if (formData.hasVehicle && !formData.vehicleNumber.trim()) {
      setError('Vehicle number is required when bringing vehicle');
      return false;
    }
    
    if (isMultiDay && !formData.hostelName.trim()) {
      setError('Hostel/Apartment name is required for multi-day stays');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
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
        expectedEntryTime: formData.expectedEntryTime,
        expectedExitTime: formData.expectedExitTime,
        bringingVehicle: formData.hasVehicle,
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber,
        stayRequired: isMultiDay,
        checkInDate: isMultiDay ? formData.visitDate : undefined,
        checkOutDate: isMultiDay ? formData.visitEndDate : undefined,
        hostelName: isMultiDay ? formData.hostelName : undefined,
        roomNumber: isMultiDay ? formData.roomNumber : undefined,
      };
      
      const response = await gateEntryService.createPass(passData);
      const pass = response.data.pass;
      
      // Show beautiful success modal
      showSuccessModal({
        title: 'Pass Created Successfully!',
        message: 'Share this code with your visitor for entry verification.',
        passId: pass.passId,
        verificationCode: pass.verificationCode,
        mobile: formData.mobileNumber,
        email: formData.email || undefined,
      });
      
      // Reset form
      setFormData({
        visitorName: '',
        mobileNumber: '',
        email: '',
        visitorRelation: '',
        numberOfPersons: 1,
        purposeOfVisit: '',
        purposeOther: '',
        visitDate: new Date().toISOString().split('T')[0],
        visitEndDate: new Date().toISOString().split('T')[0],
        expectedEntryTime: '',
        expectedExitTime: '',
        hasVehicle: false,
        vehicleType: '',
        vehicleNumber: '',
        hostelName: '',
        roomNumber: '',
      });
      
    } catch (err: any) {
      console.error('Create pass error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to create pass');
    } finally {
      setLoading(false);
    }
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
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
                />
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
                />
                <p className="text-xs text-gray-500 mt-1">📱 Visitor will receive WhatsApp notification</p>
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
                />
                <p className="text-xs text-gray-500 mt-1">📧 QR code & pass details will be sent via email</p>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                  Relation
                </label>
                <input
                  type="text"
                  name="visitorRelation"
                  value={formData.visitorRelation}
                  onChange={handleChange}
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Friend, Family, Vendor"
                />
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
                  {PURPOSE_OPTIONS.map(opt => (
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
                {isMultiDay && (
                  <p className="text-xs text-blue-600 font-medium mt-1">
                    🏨 Multi-day stay - accommodation details required below
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Entry Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="expectedEntryTime"
                  value={formData.expectedEntryTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {formData.expectedEntryTime && (
                  <p className="text-xs text-gray-600 mt-1">
                    🕐 {(() => {
                      const [hours, minutes] = formData.expectedEntryTime.split(':');
                      const hour = parseInt(hours);
                      const period = hour >= 12 ? 'PM' : 'AM';
                      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                      return `${displayHour}:${minutes} ${period}`;
                    })()}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Exit Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="expectedExitTime"
                  value={formData.expectedExitTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {formData.expectedExitTime && (
                  <p className="text-xs text-gray-600 mt-1">
                    🕐 {(() => {
                      const [hours, minutes] = formData.expectedExitTime.split(':');
                      const hour = parseInt(hours);
                      const period = hour >= 12 ? 'PM' : 'AM';
                      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                      return `${displayHour}:${minutes} ${period}`;
                    })()}
                  </p>
                )}
              </div>

              {formData.expectedEntryTime && formData.expectedExitTime && (
                <div className="md:col-span-2">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-blue-900 mb-2">
                      ⏱️ Total Duration
                    </label>
                    <p className="text-2xl font-bold text-blue-600">
                      {(() => {
                        const [entryHours, entryMinutes] = formData.expectedEntryTime.split(':').map(Number);
                        const [exitHours, exitMinutes] = formData.expectedExitTime.split(':').map(Number);
                        
                        const entryTotalMinutes = entryHours * 60 + entryMinutes;
                        const exitTotalMinutes = exitHours * 60 + exitMinutes;
                        
                        let diffMinutes = exitTotalMinutes - entryTotalMinutes;
                        
                        // Handle overnight stays (exit time is next day)
                        if (diffMinutes < 0) {
                          diffMinutes += 24 * 60; // Add 24 hours
                        }
                        
                        const hours = Math.floor(diffMinutes / 60);
                        const minutes = diffMinutes % 60;
                        
                        return `${hours}h ${minutes}m`;
                      })()}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Time between entry and exit
                    </p>
                  </div>
                </div>
              )}
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
              </div>
            )}
          </div>

          {/* Stay Details Card - LPU Style - Only shows for multi-day visits */}
          {isMultiDay && (
            <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3 md:mb-4 flex items-center gap-2">
                <Hotel className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                Accommodation Details
              </h2>
              
              <div className="mb-4 bg-blue-50 border-l-4 border-blue-500 p-3 md:p-4 rounded">
                <p className="text-xs md:text-sm text-blue-900">
                  <strong>ℹ️ Multi-day visit detected:</strong> {formData.visitDate} to {formData.visitEndDate}
                  <br />
                  Accommodation details are required.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                    Hostel Name / Apartment Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="hostelName"
                    value={formData.hostelName}
                    onChange={handleChange}
                    className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter hostel/apartment name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">
                    Room Number (optional)
                  </label>
                  <input
                    type="text"
                    name="roomNumber"
                    value={formData.roomNumber}
                    onChange={handleChange}
                    className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., A-101"
                  />
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
      </div>
    </div>
  );
}
