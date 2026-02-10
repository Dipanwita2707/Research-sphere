'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Target,
  Shield,
  Calendar,
  Eye,
  Mail,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Search,
} from 'lucide-react';

// 6-Step Club Creation Form Types
interface ClubFormData {
  // Step 1: Core Club Identity
  clubName: string;
  clubCategoryId: string;
  purpose: string;
  academicSession: string;

  // Step 2: Authority & Membership
  facultyFacilitatorId: string;
  viceChairpersonId: string;
  initialMembers: string[]; // Student IDs

  // Step 3: Governance & Compliance
  targetStudentGroup: 'all' | 'ug' | 'pg' | 'phd';
  expectedActivityTypes: string[];
  codeOfConductAccepted: boolean;
  antiDiscriminationAccepted: boolean;

  // Step 4: Operational Planning
  meetingFrequency: 'weekly' | 'monthly' | 'event_based';
  estimatedAnnualActivityCount: number;
  infrastructureRequirements: string[];
  fundingRequired: boolean;
  estimatedFundingAmount: number | null;

  // Step 5: Visibility & Collaboration
  visibility: 'public' | 'restricted';
  allowInternalCollaboration: boolean;
  allowExternalCollaboration: boolean;

  // Step 6: Optional Metadata
  proposedEmail: string;
  socialMediaHandles: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  expectedStudentStrength: number | null;
}

interface ClubCategory {
  id: string;
  name: string;
  description: string | null;
  icon?: string;
  children?: ClubCategory[]; // For hierarchical structure
}

interface StudentSuggestion {
  uid: string;
  name: string;
  role: string;
  department: string;
  designation: string;
}

interface Props {
  value: Partial<ClubFormData>;
  onChangeAction: (data: Partial<ClubFormData>) => void;
  disabled?: boolean;
}

const ACTIVITY_TYPES = [
  'Events',
  'Workshops',
  'Competitions',
  'Awareness Drives',
  'Collaborations',
  'Cultural Programs',
  'Technical Talks',
  'Community Service',
];

const INFRASTRUCTURE_OPTIONS = [
  'Auditorium',
  'Classroom',
  'Laboratory',
  'Open Ground',
  'Sports Complex',
  'Seminar Hall',
  'None Required',
];

export default function ClubCreationForm({ value, onChangeAction, disabled }: Props) {
  const [currentStep, setCurrentStep] = useState(1);
  const [categories, setCategories] = useState<ClubCategory[]>([]);
  const [searchingStudent, setSearchingStudent] = useState('');
  const [vcSearchResults, setVcSearchResults] = useState<StudentSuggestion[]>([]);
  const [memberSearchResults, setMemberSearchResults] = useState<StudentSuggestion[]>([]);
  const [searchingVc, setSearchingVc] = useState(false);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mainCategories, setMainCategories] = useState<ClubCategory[]>([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('');
  const [subCategories, setSubCategories] = useState<ClubCategory[]>([]);

  useEffect(() => {
    // Load club categories hierarchically
    console.log('🔄 Fetching categories...');
    fetch('/api/v1/dsw/categories?hierarchical=true')
      .then((res) => {
        console.log('📡 Response status:', res.status);
        return res.json();
      })
      .then((data) => {
        console.log('📦 Response data:', data);
        if (data.success) {
          const hierarchical = data.data;
          console.log('✅ Categories loaded:', hierarchical);
          setCategories(hierarchical);
          // Extract main categories (those without parentId or with children)
          const mains = hierarchical.filter((cat: ClubCategory) => 
            !cat.parentId || (cat.children && cat.children.length > 0)
          );
          console.log('🏆 Main categories:', mains);
          setMainCategories(mains);
        } else {
          console.error('❌ API returned success=false:', data);
        }
      })
      .catch((err) => {
        console.error('❌ Failed to load categories:', err);
      });
  }, []);

  // When main category changes, update sub-categories
  useEffect(() => {
    if (selectedMainCategory) {
      const mainCat = mainCategories.find(cat => cat.id === selectedMainCategory);
      if (mainCat && mainCat.children) {
        setSubCategories(mainCat.children);
      }
    } else {
      setSubCategories([]);
      // Clear sub-category selection if main category is cleared
      if (value.clubCategoryId) {
        updateField('clubCategoryId', '');
      }
    }
  }, [selectedMainCategory]);

  const updateField = <K extends keyof ClubFormData>(
    field: K,
    val: ClubFormData[K]
  ) => {
    onChangeAction({ ...value, [field]: val });
    // Clear error for this field
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!value.clubName) newErrors.clubName = 'Club name is required';
        if (!value.clubCategoryId) newErrors.clubCategoryId = 'Category is required';
        if (!value.purpose || value.purpose.length < 50)
          newErrors.purpose = 'Purpose must be at least 50 characters';
        if (!value.academicSession)
          newErrors.academicSession = 'Academic session is required';
        break;

      case 2:
        if (!value.viceChairpersonId)
          newErrors.viceChairpersonId = 'Vice Chairperson is required';
        if (!value.initialMembers || value.initialMembers.length === 0)
          newErrors.initialMembers = 'At least one initial member is required';
        break;

      case 3:
        if (!value.targetStudentGroup)
          newErrors.targetStudentGroup = 'Target group is required';
        if (!value.expectedActivityTypes || value.expectedActivityTypes.length === 0)
          newErrors.expectedActivityTypes = 'Select at least one activity type';
        if (!value.codeOfConductAccepted)
          newErrors.codeOfConductAccepted = 'Code of Conduct must be accepted';
        if (!value.antiDiscriminationAccepted)
          newErrors.antiDiscriminationAccepted =
            'Anti-Discrimination declaration must be accepted';
        break;

      case 4:
        if (!value.meetingFrequency)
          newErrors.meetingFrequency = 'Meeting frequency is required';
        if (!value.estimatedAnnualActivityCount || value.estimatedAnnualActivityCount < 1)
          newErrors.estimatedAnnualActivityCount = 'Must be at least 1';
        if (!value.infrastructureRequirements ||
            value.infrastructureRequirements.length === 0)
          newErrors.infrastructureRequirements = 'Select at least one option';
        if (value.fundingRequired && !value.estimatedFundingAmount)
          newErrors.estimatedFundingAmount = 'Funding amount is required';
        break;

      case 5:
        if (!value.visibility) newErrors.visibility = 'Visibility setting is required';
        break;

      case 6:
        // Optional step - no validation
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(6, prev + 1));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const toggleArrayItem = (arr: string[] | undefined, item: string) => {
    const current = arr || [];
    if (current.includes(item)) {
      return current.filter((i) => i !== item);
    }
    return [...current, item];
  };

  const searchStudents = async (query: string, type: 'vc' | 'member') => {
    if (query.length < 2) {
      if (type === 'vc') setVcSearchResults([]);
      else setMemberSearchResults([]);
      return;
    }

    try {
      if (type === 'vc') setSearchingVc(true);
      else setSearchingMembers(true);

      const response = await fetch(`/api/v1/users/suggestions/${query}?role=student`);
      const data = await response.json();

      if (data.success) {
        if (type === 'vc') setVcSearchResults(data.data || []);
        else setMemberSearchResults(data.data || []);
      }
    } catch (error) {
      console.error('Error searching students:', error);
    } finally {
      if (type === 'vc') setSearchingVc(false);
      else setSearchingMembers(false);
    }
  };

  const selectViceChairperson = (student: StudentSuggestion) => {
    updateField('viceChairpersonId', student.uid);
    setSearchingStudent('');
    setVcSearchResults([]);
  };

  const addMember = (student: StudentSuggestion) => {
    const current = value.initialMembers || [];
    if (!current.includes(student.uid)) {
      updateField('initialMembers', [...current, student.uid]);
    }
    setMemberSearchResults([]);
  };

  const steps = [
    { num: 1, title: 'Core Identity', icon: Target },
    { num: 2, title: 'Authority & Membership', icon: Users },
    { num: 3, title: 'Governance', icon: Shield },
    { num: 4, title: 'Operations', icon: Calendar },
    { num: 5, title: 'Visibility', icon: Eye },
    { num: 6, title: 'Optional Info', icon: Mail },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Step Progress */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center justify-between">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.num;
            const isCompleted = currentStep > step.num;

            return (
              <div key={step.num} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    isCompleted
                      ? 'bg-green-500 border-green-500'
                      : isActive
                      ? 'bg-white border-white text-blue-600'
                      : 'bg-blue-500 border-blue-400 text-white opacity-50'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 text-white" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                {step.num < 6 && (
                  <div
                    className={`w-8 h-0.5 mx-2 ${
                      isCompleted ? 'bg-green-500' : 'bg-blue-400 opacity-30'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <h3 className="text-xl font-semibold text-white">
            Step {currentStep}: {steps[currentStep - 1].title}
          </h3>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6">
        {/* Step 1: Core Club Identity */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Club Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={value.clubName || ''}
                onChange={(e) => updateField('clubName', e.target.value)}
                disabled={disabled}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="Enter club name (must be unique)"
              />
              {errors.clubName && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.clubName}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Club Category <span className="text-red-500">*</span>
              </label>
              
              {/* Main Category Selection */}
              <div className="mb-3">
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  1. Select Main Category
                </label>
                <select
                  value={selectedMainCategory}
                  onChange={(e) => {
                    console.log('Main category selected:', e.target.value);
                    setSelectedMainCategory(e.target.value);
                    // Clear sub-category when main category changes
                    updateField('clubCategoryId', '');
                  }}
                  disabled={disabled}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select main category</option>
                  {mainCategories.length === 0 && (
                    <option disabled>Loading categories...</option>
                  )}
                  {mainCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                    </option>
                  ))}
                </select>
                {mainCategories.length === 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    No categories found. Please seed categories first or check API connection.
                  </p>
                )}
              </div>

              {/* Sub-Category Selection */}
              {selectedMainCategory && (
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    2. Select Specific Club Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={value.clubCategoryId || ''}
                    onChange={(e) => updateField('clubCategoryId', e.target.value)}
                    disabled={disabled}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select specific club type</option>
                    {subCategories.map((subCat) => (
                      <option key={subCat.id} value={subCat.id}>
                        {subCat.icon ? `${subCat.icon} ` : ''}{subCat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {errors.clubCategoryId && (
                <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.clubCategoryId}
                </p>
              )}
              
              {!selectedMainCategory && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Please select a main category first, then choose a specific club type
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Purpose / Objective <span className="text-red-500">*</span>
              </label>
              <textarea
                value={value.purpose || ''}
                onChange={(e) => updateField('purpose', e.target.value)}
                disabled={disabled}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="Describe the club's purpose and objectives (minimum 50 characters)..."
              />
              <p className="text-sm text-gray-500 mt-1">
                {value.purpose?.length || 0} / 50 characters minimum
              </p>
              {errors.purpose && (
                <p className="text-sm text-red-600 mt-1">{errors.purpose}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Academic Session <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={value.academicSession || ''}
                onChange={(e) => updateField('academicSession', e.target.value)}
                disabled={disabled}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="e.g., 2025-2026"
              />
              {errors.academicSession && (
                <p className="text-sm text-red-600 mt-1">{errors.academicSession}</p>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> These fields are <strong>immutable after approval</strong>. Any
                changes will require a new noting request through the change management workflow.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Authority & Membership */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Faculty Facilitator:</strong> Auto-assigned to you (logged-in user)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Vice Chairperson (Student) <span className="text-red-500">*</span>
              </label>
              
              {/* Display selected VC */}
              {value.viceChairpersonId && (
                <div className="mb-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {value.viceChairpersonId}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Vice Chairperson</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateField('viceChairpersonId', '')}
                    disabled={disabled}
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1 rounded"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Search input */}
              {!value.viceChairpersonId && (
                <div className="relative">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search by Student ID or Name (min 3 characters)"
                      value={searchingStudent}
                      onChange={(e) => {
                        setSearchingStudent(e.target.value);
                        searchStudents(e.target.value, 'vc');
                      }}
                      disabled={disabled}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    />
                    {searchingVc && (
                      <div className="px-4 py-2 flex items-center">
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Search results dropdown */}
                  {vcSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {vcSearchResults.map((student) => (
                        <button
                          key={student.uid}
                          type="button"
                          onClick={() => selectViceChairperson(student)}
                          disabled={disabled}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700 last:border-0"
                        >
                          <p className="font-medium text-gray-900 dark:text-white">
                            {student.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {student.uid} • {student.department}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {errors.viceChairpersonId && (
                <p className="text-sm text-red-600 mt-1">{errors.viceChairpersonId}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Initial Club Members <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Add founding members (Students only)
              </p>

              {/* Display selected members */}
              <div className="space-y-2 mb-3">
                {(value.initialMembers || []).map((memberId, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{memberId}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Member</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateField(
                          'initialMembers',
                          (value.initialMembers || []).filter((_, i) => i !== idx)
                        )
                      }
                      disabled={disabled}
                      className="px-3 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {/* Member search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search students to add as members (min 3 characters)"
                  onChange={(e) => searchStudents(e.target.value, 'member')}
                  disabled={disabled}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />

                {/* Member search results */}
                {memberSearchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {memberSearchResults.map((student) => {
                      const alreadyAdded = (value.initialMembers || []).includes(student.uid);
                      return (
                        <button
                          key={student.uid}
                          type="button"
                          onClick={() => !alreadyAdded && addMember(student)}
                          disabled={disabled || alreadyAdded}
                          className={`w-full text-left px-4 py-3 border-b border-gray-200 dark:border-gray-700 last:border-0 ${
                            alreadyAdded
                              ? 'bg-gray-100 dark:bg-gray-700/50 cursor-not-allowed opacity-50'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <p className="font-medium text-gray-900 dark:text-white">
                            {student.name} {alreadyAdded && '(Already added)'}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {student.uid} • {student.department}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {errors.initialMembers && (
                <p className="text-sm text-red-600 mt-1">{errors.initialMembers}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Governance & Compliance */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Student Group <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[ { value: 'all', label: 'All' },
                  { value: 'ug', label: 'UG' },
                  { value: 'pg', label: 'PG' },
                  { value: 'phd', label: 'PhD' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`cursor-pointer border-2 rounded-lg p-3 text-center ${
                      value.targetStudentGroup === opt.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetGroup"
                      value={opt.value}
                      checked={value.targetStudentGroup === opt.value}
                      onChange={(e) =>
                        updateField('targetStudentGroup', e.target.value as any)
                      }
                      disabled={disabled}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
              {errors.targetStudentGroup && (
                <p className="text-sm text-red-600 mt-1">{errors.targetStudentGroup}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Expected Activity Types <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ACTIVITY_TYPES.map((activity) => (
                  <label
                    key={activity}
                    className="flex items-center gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={(value.expectedActivityTypes || []).includes(activity)}
                      onChange={() =>
                        updateField(
                          'expectedActivityTypes',
                          toggleArrayItem(value.expectedActivityTypes, activity)
                        )
                      }
                      disabled={disabled}
                      className="rounded"
                    />
                    <span className="text-sm">{activity}</span>
                  </label>
                ))}
              </div>
              {errors.expectedActivityTypes && (
                <p className="text-sm text-red-600 mt-1">{errors.expectedActivityTypes}</p>
              )}
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.codeOfConductAccepted || false}
                  onChange={(e) => updateField('codeOfConductAccepted', e.target.checked)}
                  disabled={disabled}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Code of Conduct <span className="text-red-500">*</span>
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    I declare that all club activities will adhere to the university&apos;s code of
                    conduct and disciplinary guidelines.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.antiDiscriminationAccepted || false}
                  onChange={(e) =>
                    updateField('antiDiscriminationAccepted', e.target.checked)
                  }
                  disabled={disabled}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Anti-Discrimination Declaration <span className="text-red-500">*</span>
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    I declare that the club will not discriminate based on race, religion, gender,
                    caste, or any other protected characteristic.
                  </p>
                </div>
              </label>

              {(errors.codeOfConductAccepted || errors.antiDiscriminationAccepted) && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Both declarations must be accepted to proceed
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Operational Planning */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Meeting Frequency <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'event_based', label: 'Event-based' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`cursor-pointer border-2 rounded-lg p-3 text-center ${
                      value.meetingFrequency === opt.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="meetingFrequency"
                      value={opt.value}
                      checked={value.meetingFrequency === opt.value}
                      onChange={(e) => updateField('meetingFrequency', e.target.value as any)}
                      disabled={disabled}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
              {errors.meetingFrequency && (
                <p className="text-sm text-red-600 mt-1">{errors.meetingFrequency}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Estimated Annual Activity Count <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={value.estimatedAnnualActivityCount || ''}
                onChange={(e) =>
                  updateField('estimatedAnnualActivityCount', parseInt(e.target.value) || 0)
                }
                disabled={disabled}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="Number of activities per year"
              />
              {errors.estimatedAnnualActivityCount && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.estimatedAnnualActivityCount}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Infrastructure Requirements <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {INFRASTRUCTURE_OPTIONS.map((infra) => (
                  <label
                    key={infra}
                    className="flex items-center gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={(value.infrastructureRequirements || []).includes(infra)}
                      onChange={() =>
                        updateField(
                          'infrastructureRequirements',
                          toggleArrayItem(value.infrastructureRequirements, infra)
                        )
                      }
                      disabled={disabled}
                      className="rounded"
                    />
                    <span className="text-sm">{infra}</span>
                  </label>
                ))}
              </div>
              {errors.infrastructureRequirements && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.infrastructureRequirements}
                </p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={value.fundingRequired || false}
                  onChange={(e) => updateField('fundingRequired', e.target.checked)}
                  disabled={disabled}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Funding Required
                </span>
              </label>

              {value.fundingRequired && (
                <input
                  type="number"
                  min="0"
                  value={value.estimatedFundingAmount || ''}
                  onChange={(e) =>
                    updateField('estimatedFundingAmount', parseFloat(e.target.value) || null)
                  }
                  disabled={disabled}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Estimated amount (₹)"
                />
              )}
              {errors.estimatedFundingAmount && (
                <p className="text-sm text-red-600 mt-1">{errors.estimatedFundingAmount}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Visibility & Collaboration */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Club Visibility <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    value: 'public',
                    label: 'Public',
                    desc: 'Discoverable by all students',
                  },
                  {
                    value: 'restricted',
                    label: 'Restricted',
                    desc: 'Invite/approval based',
                  },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`cursor-pointer border-2 rounded-lg p-4 ${
                      value.visibility === opt.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={opt.value}
                      checked={value.visibility === opt.value}
                      onChange={(e) => updateField('visibility', e.target.value as any)}
                      disabled={disabled}
                      className="sr-only"
                    />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{opt.label}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {opt.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              {errors.visibility && (
                <p className="text-sm text-red-600 mt-1">{errors.visibility}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Collaboration Permissions
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value.allowInternalCollaboration ?? true}
                    onChange={(e) =>
                      updateField('allowInternalCollaboration', e.target.checked)
                    }
                    disabled={disabled}
                    className="rounded"
                  />
                  <div>
                    <p className="text-sm font-medium">Internal Clubs</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Allow collaboration with other university clubs
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value.allowExternalCollaboration || false}
                    onChange={(e) =>
                      updateField('allowExternalCollaboration', e.target.checked)
                    }
                    disabled={disabled}
                    className="rounded"
                  />
                  <div>
                    <p className="text-sm font-medium">External Organizations</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Allow partnerships with external organizations
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Optional Metadata */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                This step is optional but recommended for better club visibility and communication.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Proposed Club Email ID
              </label>
              <input
                type="email"
                value={value.proposedEmail || ''}
                onChange={(e) => updateField('proposedEmail', e.target.value)}
                disabled={disabled}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="club@sgtuniversity.org"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Social Media Handles
              </label>
              <div className="space-y-3">
                {['facebook', 'instagram', 'twitter', 'linkedin'].map((platform) => (
                  <div key={platform}>
                    <label className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                      {platform}
                    </label>
                    <input
                      type="text"
                      value={value.socialMediaHandles?.[platform as keyof typeof value.socialMediaHandles] || ''}
                      onChange={(e) =>
                        updateField('socialMediaHandles', {
                          ...value.socialMediaHandles,
                          [platform]: e.target.value,
                        })
                      }
                      disabled={disabled}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      placeholder={`@clubname`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Expected Student Strength
              </label>
              <input
                type="number"
                min="1"
                value={value.expectedStudentStrength || ''}
                onChange={(e) =>
                  updateField('expectedStudentStrength', parseInt(e.target.value) || null)
                }
                disabled={disabled}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                placeholder="Approximate number of members"
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={currentStep === 1 || disabled}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          Step {currentStep} of 6
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={currentStep === 6 || disabled}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
