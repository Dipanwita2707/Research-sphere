'use client';

import React, { useState, useEffect, useRef } from 'react';
import { iprService, fileUploadService } from '@/features/ipr-management/services/ipr.service';
import { schoolService } from '@/features/admin-management/services/school.service';
import policyService from '@/shared/services/policyService';
import api from '@/shared/api/api';
import { useAuthStore } from '@/shared/auth/authStore';
import { FileText, Upload, X, Plus, AlertCircle, CheckCircle, Eye, Download, Coins, Award } from 'lucide-react';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

// Define field configurations for each IPR type
const IPR_FIELD_CONFIG = {
  patent: {
    title: 'Patent Idea Request',
    showType: true,
    showTypeOfFiling: true,
    showSDG: true,
    typeOptions: [
      { value: 'phd', label: 'PhD' },
      { value: 'pg_project', label: 'PG Project' },
      { value: 'ug_project', label: 'UG Project' },
      { value: 'faculty_research', label: 'Faculty Research' },
      { value: 'industry_collaboration', label: 'Industry Collaboration' },
      { value: 'any_other', label: 'Any other' },
    ],
    filingTypes: [
      { value: 'provisional', label: 'Provisional' },
      { value: 'complete', label: 'Complete' },
    ],
    uploadLabel: 'Upload Annexure 1',
    uploadNote: 'Upload MS Word File (.docx) or ZIP File *'
  },
  copyright: {
    title: 'Copyright Idea Request',
    showType: true,
    showTypeOfFiling: false,
    showSDG: false,
    typeOptions: [
      { value: 'literary_work', label: 'Literary Work' },
      { value: 'artistic_work', label: 'Artistic Work' },
      { value: 'musical_work', label: 'Musical Work' },
      { value: 'software', label: 'Computer Software' },
    ],
    filingTypes: [],
    uploadLabel: 'Upload Multiple Files in Zip',
    uploadNote: 'Upload Multiple Files in Zip like Annexures, Flag Report and Noc'
  },
  design: {
    title: 'Design Idea Request',
    showType: true,
    showTypeOfFiling: true,
    showSDG: false,
    typeOptions: [
      { value: 'product_design', label: 'Product Design' },
      { value: 'industrial_design', label: 'Industrial Design' },
      { value: 'ui_ux_design', label: 'UI/UX Design' },
      { value: 'architectural_design', label: 'Architectural Design' },
      { value: 'other', label: 'Other' },
    ],
    filingTypes: [
      { value: 'provisional', label: 'Provisional' },
      { value: 'complete', label: 'Complete' },
    ],
    uploadLabel: 'Upload Design Documents',
    uploadNote: 'Upload design drawings, images, or documentation'
  },
  trademark: {
    title: 'Trademark Idea Request',
    showType: true,
    showTypeOfFiling: false,
    showSDG: false,
    typeOptions: [
      { value: 'word_mark', label: 'Word Mark' },
      { value: 'logo_mark', label: 'Logo Mark' },
      { value: 'combined_mark', label: 'Combined Mark' },
      { value: 'service_mark', label: 'Service Mark' },
    ],
    filingTypes: [],
    uploadLabel: 'Upload Trademark Documents',
    uploadNote: 'Upload logo images and trademark documentation'
  },
};

const SDG_OPTIONS = [
  { value: 'sdg1', label: 'SDG1(No Poverty)' },
  { value: 'sdg2', label: 'SDG2(Zero Hunger)' },
  { value: 'sdg3', label: 'SDG3(Good Health and Well Being)' },
  { value: 'sdg4', label: 'SDG4(Quality Education)' },
  { value: 'sdg5', label: 'SDG5(Gender Equality)' },
  { value: 'sdg6', label: 'SDG6(Clean Water and Sanitation)' },
  { value: 'sdg7', label: 'SDG7(Affordable and Clean Energy)' },
  { value: 'sdg8', label: 'SDG8(Decent Work and Economic Growth)' },
  { value: 'sdg9', label: 'SDG9(Industry, Innovation and Infrastructure)' },
  { value: 'sdg10', label: 'SDG10(Reduced Inequalities)' },
  { value: 'sdg11', label: 'SDG11(Sustainable Cities and Communities)' },
  { value: 'sdg12', label: 'SDG12(Responsible Consumption and Production)' },
  { value: 'sdg13', label: 'SDG13(Climate Action)' },
  { value: 'sdg14', label: 'SDG14(Life Below Water)' },
  { value: 'sdg15', label: 'SDG15(Life on Land)' },
  { value: 'sdg16', label: 'SDG16(Peace, Justice and Strong Institutions)' },
  { value: 'sdg17', label: 'SDG17(Partnerships for the Goals)' },
];

const EMPLOYEE_TYPES = [
  { value: 'staff', label: 'Staff' },
  { value: 'student', label: 'Student' },
];

const EXTERNAL_OPTIONS = [
  { value: 'national', label: 'National' },
  { value: 'international', label: 'International' },
  { value: 'industry', label: 'Industry' },
];

const INSTITUTE_TYPES = [
  { value: 'academic', label: 'Academic' },
  { value: 'industry', label: 'Industry' },
  { value: 'government', label: 'Government' },
  { value: 'ngo', label: 'NGO' },
];

interface IPRIdeaRequestFormProps {
  initialType?: string;
}

export default function IPRIdeaRequestForm({ initialType = 'patent' }: IPRIdeaRequestFormProps) {
  const { toast } = useToast();
  logger.debug('🎬 IPRIdeaRequestForm component mounted/rendered');
  
  const [activeTab, setActiveTab] = useState<'entry' | 'process'>('entry');
  const [formData, setFormData] = useState({
    ideaFor: initialType,
    type: '',
    typeOfFiling: '',
    sdg: [] as string[],
    title: '',
    description: '',
    remarks: '',
    
    // Employee Category
    employeeCategory: 'internal',
    
    // Internal Employee Fields
    employeeType: 'staff',
    uid: '',
    name: '',
    email: '',
    phone: '',
    universityDeptName: '',
    
    // Mentor details (only for students)
    mentorName: '',
    mentorUid: '',
    
    // Complete Filing fields
    completeFilingSource: 'fresh' as 'fresh' | 'from_provisional', // fresh or convert from provisional
    sourceProvisionalId: '', // ID of published provisional to convert
    prototypeFile: null as File | null, // ZIP file for complete filing
    
    // External Employee Fields
    externalName: '',
    externalOption: 'national',
    instituteType: 'academic',
    companyName: '',
    externalEmail: '',
    externalPhone: '',
    
    // File
    annexureFile: null as File | null,
  });

  const [applications, setApplications] = useState<any[]>([]);
  const [contributedApplications, setContributedApplications] = useState<any[]>([]);
  const [publishedProvisionals, setPublishedProvisionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [prototypeUploading, setPrototypeUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [sdgDropdownOpen, setSdgDropdownOpen] = useState(false);
  const [contributors, setContributors] = useState<any[]>([]);
  const [uidSuggestions, setUidSuggestions] = useState<any[]>([]);
  const [mentorSuggestions, setMentorSuggestions] = useState<any[]>([]);
  const [currentPolicy, setCurrentPolicy] = useState<any>(null);
  const [showUidSuggestions, setShowUidSuggestions] = useState(false);
  const [showMentorSuggestions, setShowMentorSuggestions] = useState(false);
  const sdgDropdownRef = useRef<HTMLDivElement>(null);
  const uidSuggestionsRef = useRef<HTMLDivElement>(null);
  const mentorSuggestionsRef = useRef<HTMLDivElement>(null);

  // Get user from auth store
  const { user } = useAuthStore();
  logger.debug('🔐 User from auth store:', user);
  const isCurrentUserStudent = user?.userType === 'student';

  const config = IPR_FIELD_CONFIG[formData.ideaFor as keyof typeof IPR_FIELD_CONFIG] || IPR_FIELD_CONFIG.patent;

  // Auto-populate logged-in user's details as the main applicant
  useEffect(() => {
    if (user) {
      logger.debug('👤 Logged-in user object:', JSON.stringify(user, null, 2));
      logger.debug('👤 Auto-populating applicant details...');
      const displayName = user.employee?.displayName || user.student?.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const phone = user.employeeDetails?.phone || '';
      const departmentName = user.employeeDetails?.department?.name || '';
      setFormData(prev => ({
        ...prev,
        employeeCategory: 'internal',
        employeeType: user.userType === 'student' ? 'student' : 'staff',
        uid: user.uid || '',
        name: displayName,
        email: user.email || '',
        phone: phone,
        universityDeptName: departmentName,
      }));
      logger.debug('✅ Applicant auto-populated with:', {
        uid: user.uid,
        name: displayName,
        email: user.email,
        phone: phone,
      });
    } else {
      logger.warn('⚠️ No user found in auth store');
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'process') {
      fetchApplications();
    }
  }, [activeTab]);

  // Fetch policy when ideaFor changes
  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const policy = await policyService.getPolicyByType(formData.ideaFor);
        setCurrentPolicy(policy);
        console.log(`[IPR Policy] Loaded ${formData.ideaFor} policy:`, policy);
        console.log(`[IPR Policy] baseIncentiveAmount:`, policy?.baseIncentiveAmount, 'type:', typeof policy?.baseIncentiveAmount);
        console.log(`[IPR Policy] basePoints:`, policy?.basePoints, 'type:', typeof policy?.basePoints);
      } catch (err) {
        logger.error('Error fetching policy:', err);
        // Policy service already returns defaults on error
      }
    };
    fetchPolicy();
  }, [formData.ideaFor]);

  // Fetch published provisionals when complete filing is selected
  useEffect(() => {
    const fetchPublishedProvisionals = async () => {
      if (formData.typeOfFiling === 'complete') {
        try {
          const data = await iprService.getMyPublishedProvisionals();
          setPublishedProvisionals(data.available || []);
        } catch (err) {
          logger.error('Error fetching published provisionals:', err);
        }
      }
    };
    fetchPublishedProvisionals();
  }, [formData.typeOfFiling]);

  // Auto-fill form when a provisional application is selected for conversion
  useEffect(() => {
    if (formData.sourceProvisionalId && publishedProvisionals.length > 0) {
      const selectedProvisional = publishedProvisionals.find(
        prov => prov.id === formData.sourceProvisionalId
      );
      
      if (selectedProvisional) {
        // Auto-fill title, description, remarks, and SDGs from provisional
        setFormData(prev => ({
          ...prev,
          title: selectedProvisional.title || '',
          description: selectedProvisional.description || '',
          remarks: selectedProvisional.remarks || '',
          sdg: selectedProvisional.sdgs?.map((s: any) => s.sdgCode) || [],
        }));
      }
    }
  }, [formData.sourceProvisionalId, publishedProvisionals]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sdgDropdownRef.current && !sdgDropdownRef.current.contains(event.target as Node)) {
        setSdgDropdownOpen(false);
      }
      if (uidSuggestionsRef.current && !uidSuggestionsRef.current.contains(event.target as Node)) {
        setShowUidSuggestions(false);
      }
      if (mentorSuggestionsRef.current && !mentorSuggestionsRef.current.contains(event.target as Node)) {
        setShowMentorSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const data = await iprService.getMyApplications();
      setApplications(data.data || []);
      
      // Also fetch contributed applications for all users (not just students)
      try {
        const contributedData = await iprService.getContributedApplications();
        setContributedApplications(contributedData.data || []);
      } catch (err) {
        logger.error('Error fetching contributed applications:', err);
      }
    } catch (error) {
      logger.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };





  // Auto-fill user details when UID is entered
  const handleUidChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uid = e.target.value;
    setFormData(prev => ({ ...prev, uid }));

    // Show suggestions when typing 3+ characters
    if (uid.length >= 3) {
      try {
        const response = await api.get(`/users/suggestions/${uid}`);
        
        if (response.data.success) {
          setUidSuggestions(response.data.data);
          setShowUidSuggestions(true);
        }
      } catch (error) {
        logger.error('Error fetching suggestions:', error);
      }
    } else {
      setUidSuggestions([]);
      setShowUidSuggestions(false);
    }
  };

  // Select a user from suggestions
  const selectUserSuggestion = async (suggestion: any) => {
    setShowUidSuggestions(false);
    setFormData(prev => ({ ...prev, uid: suggestion.uid }));
    
    // Fetch full user details
    try {
      const response = await api.get(`/users/search/${suggestion.uid}`);
      
      if (response.data.success) {
        const userData = response.data.data;
        setFormData(prev => ({
          ...prev,
          uid: suggestion.uid,
          name: userData.name || '',
          email: userData.email || '',
          phone: userData.phone || '',
          employeeType: userData.role === 'faculty' ? 'staff' : userData.role,
          universityDeptName: userData.department || '',
        }));
      }
    } catch (error) {
      logger.error('Error fetching user details:', error);
    }
  };

  const handleMentorUidChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const mentorUid = e.target.value;
    setFormData(prev => ({ ...prev, mentorUid }));

    // Show suggestions when typing 3+ characters (only faculty for mentors)
    if (mentorUid.length >= 3) {
      try {
        const response = await api.get(`/users/suggestions/${mentorUid}?role=faculty`);
        
        if (response.data.success) {
          setMentorSuggestions(response.data.data);
          setShowMentorSuggestions(true);
        }
      } catch (error) {
        logger.error('Error fetching mentor suggestions:', error);
      }
    } else {
      setMentorSuggestions([]);
      setShowMentorSuggestions(false);
    }
  };

  // Select a mentor from suggestions
  const selectMentorSuggestion = async (suggestion: any) => {
    setShowMentorSuggestions(false);
    setFormData(prev => ({
      ...prev,
      mentorUid: suggestion.uid,
      mentorName: suggestion.name,
    }));
  };

  // Add contributor to the list and clear form fields
  const addContributor = () => {
    if (formData.employeeCategory === 'internal' && (!formData.uid || !formData.name)) {
      setError('Please fill UID and Name for internal contributors');
      return;
    }
    if (formData.employeeCategory === 'external' && (!formData.externalName || !formData.externalEmail)) {
      setError('Please fill Name and Email for external contributors');
      return;
    }

    // Check for duplicate contributors
    const isDuplicate = contributors.some(contributor => {
      if (formData.employeeCategory === 'internal') {
        // For internal contributors, check by UID
        return contributor.uid === formData.uid;
      } else {
        // For external contributors, check by email
        return contributor.email === formData.externalEmail;
      }
    });

    if (isDuplicate) {
      setError('This contributor has already been added');
      return;
    }

    const newContributor = {
      id: Date.now(),
      employeeCategory: formData.employeeCategory,
      employeeType: formData.employeeType,
      uid: formData.uid,
      name: formData.employeeCategory === 'internal' ? formData.name : formData.externalName,
      email: formData.employeeCategory === 'internal' ? formData.email : formData.externalEmail,
      phone: formData.employeeCategory === 'internal' ? formData.phone : formData.externalPhone,
      universityDeptName: formData.universityDeptName,
      externalOption: formData.externalOption,
      instituteType: formData.instituteType,
      companyName: formData.companyName,
    };

    setContributors(prev => [...prev, newContributor]);
    
    // Clear form fields for next contributor
    setFormData(prev => ({
      ...prev,
      uid: '',
      name: '',
      email: '',
      phone: '',
      universityDeptName: '',
      externalName: '',
      externalEmail: '',
      externalPhone: '',
      companyName: '',
    }));
    
    setError('');
  };

  // Remove contributor from list
  const removeContributor = (id: number) => {
    setContributors(prev => prev.filter(c => c.id !== id));
  };

  // Helper function to calculate incentive and points for IPR contributors
  // Employees get both incentive and points, students get only incentive, external get neither
  const calculateContributorIncentivePoints = (employeeCategory: string, employeeType: string) => {
    // Debug log current policy state
    console.log('[IPR Incentive Calc] currentPolicy:', currentPolicy);
    
    // Use policy if available, otherwise use defaults
    // Convert Decimal/string to number properly
    let totalBaseIncentive: number;
    if (currentPolicy?.baseIncentiveAmount !== undefined && currentPolicy?.baseIncentiveAmount !== null) {
      totalBaseIncentive = typeof currentPolicy.baseIncentiveAmount === 'string' 
        ? parseFloat(currentPolicy.baseIncentiveAmount) 
        : Number(currentPolicy.baseIncentiveAmount);
      console.log('[IPR Incentive Calc] Using policy totalBaseIncentive:', totalBaseIncentive);
    } else {
      totalBaseIncentive = formData.ideaFor === 'patent' ? 50000 : 
         formData.ideaFor === 'copyright' ? 15000 :
         formData.ideaFor === 'design' ? 20000 :
         formData.ideaFor === 'trademark' ? 10000 : 10000;
      console.log('[IPR Incentive Calc] Using DEFAULT totalBaseIncentive:', totalBaseIncentive);
    }
    
    let totalBasePoints: number;
    if (currentPolicy?.basePoints !== undefined && currentPolicy?.basePoints !== null) {
      totalBasePoints = Number(currentPolicy.basePoints);
      console.log('[IPR Incentive Calc] Using policy totalBasePoints:', totalBasePoints);
    } else {
      totalBasePoints = formData.ideaFor === 'patent' ? 50 : 
         formData.ideaFor === 'copyright' ? 20 :
         formData.ideaFor === 'design' ? 25 :
         formData.ideaFor === 'trademark' ? 15 : 20;
      console.log('[IPR Incentive Calc] Using DEFAULT totalBasePoints:', totalBasePoints);
    }
    
    // Count eligible contributors for INCENTIVE (all internal - staff, faculty, students)
    // Note: Applicant is NOT included in the count - only added contributors are counted
    const eligibleForIncentive = contributors.filter(c => c.employeeCategory === 'internal').length;
    const totalEligibleForIncentive = eligibleForIncentive > 0 ? eligibleForIncentive : 1; // At least 1 to avoid division by zero
    
    // Count eligible contributors for POINTS (only staff/faculty, NO students)
    // Note: Applicant is NOT included in the count - only added contributors are counted
    const eligibleForPoints = contributors.filter(c => c.employeeCategory === 'internal' && c.employeeType !== 'student').length;
    const totalEligibleForPoints = eligibleForPoints > 0 ? eligibleForPoints : 1; // At least 1 to avoid division by zero
    
    console.log('[IPR Incentive Calc] Total eligible for incentive:', totalEligibleForIncentive);
    console.log('[IPR Incentive Calc] Total eligible for points:', totalEligibleForPoints);
    
    // Divide the total amount by number of eligible contributors
    const baseIncentive = totalEligibleForIncentive > 0 ? totalBaseIncentive / totalEligibleForIncentive : 0;
    const basePoints = totalEligibleForPoints > 0 ? totalBasePoints / totalEligibleForPoints : 0;
    
    console.log('[IPR Incentive Calc] Per contributor - Incentive:', baseIncentive, 'Points:', basePoints);
    
    // External contributors get no incentive or points
    if (employeeCategory === 'external') {
      return { incentive: 0, points: 0 };
    }
    
    // Students get only incentives, no points
    if (employeeType === 'student') {
      return { incentive: baseIncentive, points: 0 };
    }
    
    // Staff/Faculty get both
    return { incentive: baseIncentive, points: basePoints };
  };



  const handleSDGChange = (sdgValue: string) => {
    setFormData(prev => ({
      ...prev,
      sdg: prev.sdg.includes(sdgValue)
        ? prev.sdg.filter(s => s !== sdgValue)
        : [...prev.sdg, sdgValue]
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, annexureFile: e.target.files![0] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    logger.debug('🚀 Form submission started');
    logger.debug('📋 Form Data:', JSON.stringify(formData, null, 2));
    logger.debug('✅ Consent Checked:', consentChecked);
    logger.debug('👥 Contributors:', contributors);
    
    // Comprehensive validation
    const errors: string[] = [];
    
    // Basic required fields
    if (!formData.title?.trim()) {
      errors.push('Title is required');
    }
    
    if (!formData.description?.trim()) {
      errors.push('Description is required');
    }
    
    // Type validation based on IPR type
    const config = IPR_FIELD_CONFIG[formData.ideaFor as keyof typeof IPR_FIELD_CONFIG] || IPR_FIELD_CONFIG.patent;
    
    if (config.showType && !formData.type) {
      errors.push('Type/Category is required');
    }
    
    if (config.showTypeOfFiling && !formData.typeOfFiling) {
      errors.push('Type of Filing is required');
    }
    
    // Annexure file validation
    if (!formData.annexureFile && formData.typeOfFiling !== 'complete') {
      errors.push('Annexure file is required');
    }
    
    // NOTE: Employee details validation is REMOVED because:
    // 1. The main applicant (logged-in user) is automatically captured from the session by the backend
    // 2. The "Add Other Inventor Details" section is for ADDITIONAL contributors only
    // 3. The backend uses req.user.id to identify the main applicant
    
    // Only validate if the user has started filling contributor details but left them incomplete
    // This allows submitting without any additional contributors
    const hasStartedFillingContributor = formData.uid?.trim() || formData.name?.trim() || 
                                          formData.email?.trim() || formData.phone?.trim() ||
                                          formData.externalName?.trim() || formData.externalEmail?.trim();
    
    if (hasStartedFillingContributor) {
      // Only validate contributor fields if user started filling them
      if (formData.employeeCategory === 'internal') {
        if (!formData.uid?.trim()) {
          errors.push('Contributor UID is required (or clear all fields to submit without additional contributors)');
        }
        if (!formData.name?.trim()) {
          errors.push('Contributor name is required');
        }
      } else {
        // External contributor validation
        if (!formData.externalName?.trim()) {
          errors.push('External contributor name is required');
        }
        if (!formData.externalEmail?.trim()) {
          errors.push('External contributor email is required');
        }
      }
    }
    
    // Complete filing validation
    if (formData.typeOfFiling === 'complete') {
      if (!formData.completeFilingSource) {
        errors.push('Please select whether this is converted from provisional or fresh application');
      }
      
      if (formData.completeFilingSource === 'from_provisional' && !formData.sourceProvisionalId) {
        errors.push('Please select the source provisional application');
      }
      
      if (!formData.prototypeFile) {
        errors.push('Prototype file is required for complete filing');
      }
    }
    
    // Consent validation
    if (!consentChecked) {
      errors.push('Please confirm that the work has been done at SGT University');
    }
    
    // Display all errors
    if (errors.length > 0) {
      logger.error('❌ Validation Errors:', errors);
      setError(errors.join('. ') + '.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    logger.debug('✅ All validations passed, proceeding with submission...');
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let annexureFilePath = '';
      if (formData.annexureFile) {
        setUploading(true);
        try {
          annexureFilePath = await fileUploadService.uploadFile(formData.annexureFile, 'ipr/annexures');
        } catch (uploadError) {
          logger.error('File upload failed:', uploadError);
          setUploading(false);
          setError('File upload failed. AWS S3 service is not configured. Your application will be saved without the file attachment.');
          // Continue without file upload
        }
        setUploading(false);
      }

      // Upload prototype file for complete filing
      let prototypeFilePath = '';
      if (formData.typeOfFiling === 'complete' && formData.prototypeFile) {
        setPrototypeUploading(true);
        try {
          prototypeFilePath = await fileUploadService.uploadPrototypeFile(formData.prototypeFile);
        } catch (uploadError) {
          logger.error('Prototype upload failed:', uploadError);
          setPrototypeUploading(false);
          setError('Prototype file upload failed. Please try again.');
          setLoading(false);
          return;
        }
        setPrototypeUploading(false);
      }

      const applicationData = {
        applicantType: 'internal_faculty',
        iprType: formData.ideaFor as 'patent' | 'copyright' | 'trademark',
        projectType: formData.type || 'faculty_research',
        filingType: formData.typeOfFiling || 'provisional',
        title: formData.title,
        description: formData.description,
        remarks: formData.remarks,
        
        sdgs: formData.sdg.map(code => ({
          code,
          title: SDG_OPTIONS.find(s => s.value === code)?.label || ''
        })),
        
        applicantDetails: formData.employeeCategory === 'internal' ? {
          employeeCategory: 'teaching',
          employeeType: formData.employeeType,
          uid: formData.uid,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          universityDeptName: formData.universityDeptName,
          mentorName: formData.mentorName,
          mentorUid: formData.mentorUid,
        } : {
          externalName: formData.externalName,
          externalOption: formData.externalOption,
          instituteType: formData.instituteType,
          companyUniversityName: formData.companyName,
          externalEmail: formData.externalEmail,
          externalPhone: formData.externalPhone,
        },
        
        contributors: contributors,
        
        annexureFilePath,
        supportingDocsFilePaths: [],
        
        // Complete filing specific fields
        ...(formData.typeOfFiling === 'complete' && {
          sourceProvisionalId: formData.completeFilingSource === 'from_provisional' ? formData.sourceProvisionalId : undefined,
          prototypeFilePath: prototypeFilePath || undefined,
        }),
      };

      logger.debug('📤 Sending application data to backend:', applicationData);
      
      const application = await iprService.createApplication(applicationData);
      
      logger.debug('✅ Application created successfully:', application);
      
      // Filing type logic - Both provisional and complete are now submitted:
      // - Students with mentor: submitted to mentor for approval
      // - Students without mentor / Faculty / Staff: submitted to DRD for review
      // The backend handles the routing based on user type and mentor assignment
      
      // Set appropriate success message based on status
      if (application.status === 'pending_mentor_approval') {
        setSuccess(`${config.title} submitted successfully! Awaiting mentor approval.`);
      } else if (application.status === 'submitted') {
        setSuccess(`${config.title} submitted successfully for DRD review!`);
      } else {
        setSuccess(`${config.title} submitted successfully!`);
      }
      
      // Reset form
      setFormData({
        ideaFor: initialType,
        type: '',
        typeOfFiling: '',
        sdg: [],
        title: '',
        description: '',
        remarks: '',
        employeeCategory: 'internal',
        employeeType: 'staff',
        uid: '',
        name: '',
        email: '',
        phone: '',
        universityDeptName: '',
        mentorName: '',
        mentorUid: '',
        completeFilingSource: 'fresh',
        sourceProvisionalId: '',
        prototypeFile: null,
        externalName: '',
        externalOption: 'national',
        instituteType: 'academic',
        companyName: '',
        externalEmail: '',
        externalPhone: '',
        annexureFile: null,
      });
      setConsentChecked(false);
      
    } catch (err: unknown) {
      logger.error('❌ Submission Error:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-[#005b96] rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">{config.title}</h1>
                <p className="text-gray-500 text-sm">SGT University</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <span className="bg-[#e6f2fa] text-[#005b96] px-3 py-1.5 rounded-lg font-medium">🏠 UMS</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'entry'
                  ? 'border-[#005b96] text-[#005b96]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('entry')}
            >
              Idea Request Entry
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'process'
                  ? 'border-[#005b96] text-[#005b96]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('process')}
            >
              Already in Process
            </button>
          </nav>
        </div>

        {activeTab === 'entry' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* First Row - 4 columns */}
            <div className="grid grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Idea For<span className="text-red-500">*</span>
                </label>
                <select
                  name="ideaFor"
                  value={formData.ideaFor}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                >
                  <option value="patent">Patent</option>
                  <option value="copyright">Copyright</option>
                  <option value="design">Design</option>
                  <option value="trademark">Trademark</option>
                </select>
              </div>

              {config.showType && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type<span className="text-red-500">*</span>
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select Type</option>
                    {config.typeOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {config.showTypeOfFiling && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type of Filing<span className="text-red-500">*</span>
                  </label>
                  <select
                    name="typeOfFiling"
                    value={formData.typeOfFiling}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select Filing Type</option>
                    {config.filingTypes.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Complete Filing Specific Options */}
              {formData.typeOfFiling === 'complete' && (
                <div className="col-span-2 space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Complete Filing Options
                  </h4>
                  
                  {/* Source Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filing Source<span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="completeFilingSource"
                          value="fresh"
                          checked={formData.completeFilingSource === 'fresh'}
                          onChange={handleInputChange}
                          className="text-blue-600"
                        />
                        <span className="text-sm">Fresh Application</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="completeFilingSource"
                          value="from_provisional"
                          checked={formData.completeFilingSource === 'from_provisional'}
                          onChange={handleInputChange}
                          className="text-blue-600"
                        />
                        <span className="text-sm">Convert from Published Provisional</span>
                      </label>
                    </div>
                  </div>

                  {/* Published Provisional Selection */}
                  {formData.completeFilingSource === 'from_provisional' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Published Provisional Application<span className="text-red-500">*</span>
                      </label>
                      {publishedProvisionals.length > 0 ? (
                        <select
                          name="sourceProvisionalId"
                          value={formData.sourceProvisionalId}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                        >
                          <option value="">Select a provisional application</option>
                          {publishedProvisionals.map(prov => (
                            <option key={prov.id} value={prov.id}>
                              {prov.applicationNumber} - {prov.title}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                          You don't have any published provisional applications yet. 
                          You can either file a provisional first or select "Fresh Application".
                        </div>
                      )}
                    </div>
                  )}

                  {/* Prototype ZIP Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Upload Prototype (ZIP file){formData.completeFilingSource === 'fresh' && <span className="text-red-500">*</span>}
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Upload your working prototype as a ZIP file (max 50MB). Include source code, documentation, and any relevant files.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".zip"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setFormData(prev => ({ ...prev, prototypeFile: e.target.files![0] }));
                          }
                        }}
                        className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      {formData.prototypeFile && (
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, prototypeFile: null }))}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {formData.prototypeFile && (
                      <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        {formData.prototypeFile.name} ({(formData.prototypeFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </p>
                    )}
                    {prototypeUploading && (
                      <p className="text-sm text-blue-600 mt-1 flex items-center gap-1">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Uploading prototype...
                      </p>
                    )}
                  </div>
                </div>
              )}

              {config.showSDG && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SDG<span className="text-red-500">*</span>
                  </label>
                  <div className="relative" ref={sdgDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setSdgDropdownOpen(!sdgDropdownOpen)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-left bg-white flex justify-between items-center"
                    >
                      <span>
                        {formData.sdg.length > 0 
                          ? `${formData.sdg.length} SDG${formData.sdg.length > 1 ? 's' : ''} selected`
                          : 'Select SDG*'
                        }
                      </span>
                      <svg 
                        className={`w-4 h-4 transition-transform ${sdgDropdownOpen ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {sdgDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                        {SDG_OPTIONS.map(sdg => (
                          <label key={sdg.value} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.sdg.includes(sdg.value)}
                              onChange={() => handleSDGChange(sdg.value)}
                              className="mr-2"
                            />
                            <span className="text-sm">{sdg.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Second Row - Title, Description, Remarks, Upload */}
            <div className="grid grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title<span className="text-red-500">*</span></label>
                <textarea
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  rows={3}
                  required
                  placeholder="Enter a descriptive title for your IPR idea"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description<span className="text-red-500">*</span></label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  required
                  placeholder="Provide a detailed description of your idea"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks<span className="text-red-500">*</span></label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {config.uploadLabel}
                  {formData.typeOfFiling !== 'complete' && <span className="text-red-500">*</span>}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center">
                  <button type="button" className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm mb-2">
                    Download Annexure 1 Sample
                  </button>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="w-full text-sm"
                    accept={formData.ideaFor === 'patent' ? '.doc,.docx,.zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed' : '.zip,.pdf,.doc,.docx'}
                    required={formData.typeOfFiling !== 'complete'}
                  />
                  <p className="text-xs text-red-600 mt-1">{config.uploadNote}</p>
                  {formData.annexureFile && (
                    <p className="text-xs text-green-600 mt-2 flex items-center justify-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      File selected: {formData.annexureFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Employee Details Section - Add Other Inventor Details */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Other Inventor Details</h3>
              <div className="grid grid-cols-4 gap-6 mb-4">
                {/* Employee Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee Category<span className="text-red-500">*</span></label>
                  <select
                    name="employeeCategory"
                    value={formData.employeeCategory}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                  >
                    <option value="internal">INTERNAL</option>
                    <option value="external">EXTERNAL</option>
                  </select>
                </div>

                {/* Conditional Fields based on Employee Category */}
                {formData.employeeCategory === 'internal' ? (
                  <>
                    {/* Internal Employee Fields */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee Type<span className="text-red-500">*</span></label>
                      <select
                        name="employeeType"
                        value={formData.employeeType}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        {EMPLOYEE_TYPES.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="relative" ref={uidSuggestionsRef}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {formData.employeeType === 'student' ? 'Registration Number' : 'UID/VID'}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="uid"
                        value={formData.uid}
                        onChange={handleUidChange}
                        onFocus={() => formData.uid.length >= 3 && setShowUidSuggestions(true)}
                        placeholder={formData.employeeType === 'student' ? 'Enter Registration Number' : 'Enter UID/VID'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        autoComplete="off"
                      />
                      {/* UID Suggestions Dropdown */}
                      {showUidSuggestions && uidSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-20 max-h-48 overflow-y-auto">
                          {uidSuggestions.map((suggestion, index) => (
                            <div
                              key={index}
                              onClick={() => selectUserSuggestion(suggestion)}
                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-sm">{suggestion.uid}</div>
                              <div className="text-xs text-gray-600">{suggestion.name} - {suggestion.department}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name<span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Auto-filled from UID"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                        readOnly
                      />
                    </div>

                  </>
                ) : (
                  <>
                    {/* External Employee Fields */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name<span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="externalName"
                        value={formData.externalName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Option<span className="text-red-500">*</span></label>
                      <select
                        name="externalOption"
                        value={formData.externalOption}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        {EXTERNAL_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Institute Name<span className="text-red-500">*</span></label>
                      <select
                        name="instituteType"
                        value={formData.instituteType}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        {INSTITUTE_TYPES.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>


                  </>
                )}
              </div>

              {/* Second row of fields */}
              <div className="grid grid-cols-3 gap-6">
                {formData.employeeCategory === 'internal' ? (
                  <>
                    {/* Internal Employee Fields Row 2 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">E-mail<span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone<span className="text-red-500">*</span></label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">University/Department Name<span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="universityDeptName"
                        value={formData.universityDeptName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* External Employee Fields Row 2 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">E-mail<span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        name="externalEmail"
                        value={formData.externalEmail}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone<span className="text-red-500">*</span></label>
                      <input
                        type="tel"
                        name="externalPhone"
                        value={formData.externalPhone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Name/University<span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Mentor section - only for logged-in students */}
              {isCurrentUserStudent && (
                <div className="mt-6 border-t pt-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">Mentor Details (Optional for Students)</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="relative" ref={mentorSuggestionsRef}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mentor UID (Faculty Only)</label>
                      <input
                        type="text"
                        name="mentorUid"
                        value={formData.mentorUid}
                        onChange={handleMentorUidChange}
                        onFocus={() => formData.mentorUid.length >= 3 && setShowMentorSuggestions(true)}
                        placeholder="Enter Mentor's UID (Faculty)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        autoComplete="off"
                      />
                      {/* Mentor Suggestions Dropdown - Only Faculty */}
                      {showMentorSuggestions && mentorSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-20 max-h-48 overflow-y-auto">
                          {mentorSuggestions.map((suggestion, index) => (
                            <div
                              key={index}
                              onClick={() => selectMentorSuggestion(suggestion)}
                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-sm">{suggestion.uid}</div>
                              <div className="text-xs text-gray-600">{suggestion.name} - {suggestion.department}</div>
                              <div className="text-xs text-green-600">{suggestion.designation}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mentor Name</label>
                      <input
                        type="text"
                        name="mentorName"
                        value={formData.mentorName}
                        onChange={handleInputChange}
                        placeholder="Auto-filled from UID"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Add Other Details Button */}
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={addContributor}
                  className="bg-[#005b96] text-white px-6 py-2 rounded-xl hover:bg-[#03396c] transition-colors font-medium"
                >
                  Add Other Details
                </button>
              </div>

              {/* Contributors Table */}
              {contributors.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">Added Contributors</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-300 bg-white rounded-md">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 border text-sm font-medium text-gray-700">Category</th>
                          <th className="px-4 py-2 border text-sm font-medium text-gray-700">Type</th>
                          <th className="px-4 py-2 border text-sm font-medium text-gray-700">UID/Name</th>
                          <th className="px-4 py-2 border text-sm font-medium text-gray-700">Email</th>
                          <th className="px-4 py-2 border text-sm font-medium text-gray-700">Phone</th>
                          <th className="px-4 py-2 border text-sm font-medium text-gray-700">
                            <div className="flex items-center justify-center gap-1">
                              <Coins className="w-3.5 h-3.5 text-green-600" />
                              Incentive
                            </div>
                          </th>
                          <th className="px-4 py-2 border text-sm font-medium text-gray-700">
                            <div className="flex items-center justify-center gap-1">
                              <Award className="w-3.5 h-3.5 text-blue-600" />
                              Points
                            </div>
                          </th>
                          <th className="px-4 py-2 border text-sm font-medium text-gray-700">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contributors.map((contributor) => {
                          const { incentive, points } = calculateContributorIncentivePoints(
                            contributor.employeeCategory,
                            contributor.employeeType
                          );
                          return (
                            <tr key={contributor.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 border text-sm">{contributor.employeeCategory.toUpperCase()}</td>
                              <td className="px-4 py-2 border text-sm">{contributor.employeeType || contributor.externalOption}</td>
                              <td className="px-4 py-2 border text-sm">
                                {contributor.uid ? `${contributor.uid} - ${contributor.name}` : contributor.name}
                              </td>
                              <td className="px-4 py-2 border text-sm">{contributor.email}</td>
                              <td className="px-4 py-2 border text-sm">{contributor.phone}</td>
                              <td className="px-4 py-2 border text-sm text-center">
                                {contributor.employeeCategory === 'internal' ? (
                                  <span className="text-green-600 font-medium">₹{incentive.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </td>
                              <td className="px-4 py-2 border text-sm text-center">
                                {contributor.employeeCategory === 'internal' && contributor.employeeType !== 'student' ? (
                                  <span className="text-blue-600 font-medium">{points.toFixed(2)}</span>
                                ) : contributor.employeeCategory === 'internal' && contributor.employeeType === 'student' ? (
                                  <span className="text-gray-400 text-xs">No Points</span>
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </td>
                              <td className="px-4 py-2 border text-sm">
                                <button
                                  type="button"
                                  onClick={() => removeContributor(contributor.id)}
                                  className="bg-[#e74c3c] text-white px-3 py-1 rounded-lg hover:bg-[#c0392b] text-xs transition-colors"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    <span className="font-medium">Note:</span> Internal Staff/Faculty receive both Incentives and Points. 
                    Internal Students receive only Incentives (no Points). External contributors receive neither.
                  </p>
                </div>
              )}
            </div>

            {/* Filing Type Info */}
            <div className="border-t pt-4 mb-4">
              <div className={`p-4 rounded-md ${formData.typeOfFiling === 'complete' ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
                {formData.typeOfFiling === 'complete' ? (
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Complete Filing Selected</p>
                      <p className="text-xs text-blue-600 mt-1">
                        {isCurrentUserStudent 
                          ? 'Your application will be submitted to your mentor for approval.'
                          : 'Your application will be submitted directly to DRD for review.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Provisional Filing Selected</p>
                      <p className="text-xs text-green-600 mt-1">
                        {isCurrentUserStudent 
                          ? 'Your application will be submitted to your mentor for approval.'
                          : 'Your application will be submitted directly to DRD for review.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Section */}
            <div className="border-t pt-6">
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mr-3 mt-1"
                  />
                  <span className="text-sm text-gray-700">
                    I here by confirm that the work has been done in SGT University and I give my full consent for the filing of Intellectual Property Rights from SGT University.
                  </span>
                </label>
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  type="submit"
                  disabled={loading || uploading || prototypeUploading || !consentChecked}
                  className={`text-white px-8 py-2.5 rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium ${
                    formData.typeOfFiling === 'complete' 
                      ? 'bg-[#005b96] hover:bg-[#03396c]' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {uploading ? 'Uploading Files...' : prototypeUploading ? 'Uploading Prototype...' : loading ? 'Submitting...' : 
                    (isCurrentUserStudent && formData.mentorUid ? 'Submit for Mentor Approval' : 'Submit to DRD')}
                </button>
                <button
                  type="button"
                  className="bg-gray-100 text-gray-700 px-8 py-2.5 rounded-xl hover:bg-gray-200 border border-gray-200 transition-colors font-medium"
                >
                  Reset
                </button>
              </div>
            </div>
          </form>
        )}

        {activeTab === 'process' && (
          <div className="bg-white">
            {/* Summary section showing total incentives and points */}
            {(() => {
              const ownApps = applications.filter(app => app && app.id);
              const contributedApps = contributedApplications.filter(app => app && app.id && !applications.some(ownApp => ownApp.id === app.id));
              
              // Calculate totals for published/completed applications only
              const publishedStatuses = ['published', 'completed', 'drd_head_approved'];
              
              const ownTotalPoints = ownApps
                .filter(app => publishedStatuses.includes(app.status))
                .reduce((sum, app) => sum + (parseInt(app.pointsAwarded) || 0), 0);
              const ownTotalIncentive = ownApps
                .filter(app => publishedStatuses.includes(app.status))
                .reduce((sum, app) => sum + (parseInt(app.incentiveAmount) || 0), 0);
              
              const contributedTotalPoints = contributedApps
                .filter(app => publishedStatuses.includes(app.status))
                .reduce((sum, app) => sum + (parseInt(app.pointsAwarded) || 0), 0);
              const contributedTotalIncentive = contributedApps
                .filter(app => publishedStatuses.includes(app.status))
                .reduce((sum, app) => sum + (parseInt(app.incentiveAmount) || 0), 0);
              
              const grandTotalPoints = ownTotalPoints + contributedTotalPoints;
              const grandTotalIncentive = ownTotalIncentive + contributedTotalIncentive;
              
              return (
                <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Own IPR Stats */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-800 mb-2">My IPR Applications</h3>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total: {ownApps.length}</span>
                      <span className="text-blue-600">Published: {ownApps.filter(a => publishedStatuses.includes(a.status)).length}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <div className="text-xs text-gray-600">Points Earned: <span className="font-bold text-blue-700">{ownTotalPoints}</span></div>
                      <div className="text-xs text-gray-600">Incentive: <span className="font-bold text-green-700">₹{ownTotalIncentive.toLocaleString()}</span></div>
                    </div>
                  </div>
                  
                  {/* Contributed IPR Stats */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-purple-800 mb-2">Contributed IPRs</h3>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total: {contributedApps.length}</span>
                      <span className="text-purple-600">Published: {contributedApps.filter(a => publishedStatuses.includes(a.status)).length}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-purple-200">
                      <div className="text-xs text-gray-600">Points Earned: <span className="font-bold text-purple-700">{contributedTotalPoints}</span></div>
                      <div className="text-xs text-gray-600">Incentive: <span className="font-bold text-green-700">₹{contributedTotalIncentive.toLocaleString()}</span></div>
                    </div>
                  </div>
                  
                  {/* Grand Total */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-green-800 mb-2">Total Rewards</h3>
                    <div className="mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Total Points:</span>
                        <span className="text-lg font-bold text-green-700">{grandTotalPoints}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-gray-600">Total Incentive:</span>
                        <span className="text-lg font-bold text-green-700">₹{grandTotalIncentive.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 border text-xs font-medium text-gray-500 uppercase">Serial No</th>
                    <th className="px-4 py-2 border text-xs font-medium text-gray-500 uppercase">Id</th>
                    <th className="px-4 py-2 border text-xs font-medium text-gray-500 uppercase">Entry Date</th>
                    <th className="px-4 py-2 border text-xs font-medium text-gray-500 uppercase">IdeaForType</th>
                    <th className="px-4 py-2 border text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 border text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-2 border text-xs font-medium text-gray-500 uppercase">Incentives</th>
                    <th className="px-4 py-2 border text-xs font-medium text-gray-500 uppercase">View Details</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Merge own applications and contributed applications (only for students)
                    const ownApps = applications.filter(app => app && app.id).map(app => ({ ...app, isContributor: false }));
                    
                    // Add contributed applications that aren't already in their own applications (for all users)
                    const contributedApps = contributedApplications
                      .filter(app => app && app.id && !applications.some(ownApp => ownApp.id === app.id))
                      .map(app => ({ ...app, isContributor: true }));
                    
                    const allApplications = [...ownApps, ...contributedApps];
                    
                    if (allApplications.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                            No applications found
                          </td>
                        </tr>
                      );
                    }
                    
                    return allApplications.map((app, index) => (
                      <tr key={app.id} className={`hover:bg-gray-50 ${app.isContributor ? 'bg-purple-50' : ''}`}>
                        <td className="px-4 py-2 border text-sm text-center">
                          {index + 1}
                        </td>
                        <td className="px-4 py-2 border text-sm font-mono">
                          {app.applicationNumber || (app.id ? app.id.slice(-8) : 'N/A')}
                        </td>
                        <td className="px-4 py-2 border text-sm">
                          {app.createdAt ? new Date(app.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                        </td>
                        <td className="px-4 py-2 border text-sm">
                          <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded uppercase font-medium">
                            {app.iprType}
                          </span>
                          <div className="text-xs text-gray-500 mt-1">
                            {app.filingType} • {app.projectType?.replace(/_/g, ' ')}
                          </div>
                          <div className="text-xs text-gray-700 font-medium mt-1 truncate" title={app.title}>
                            {app.title}
                          </div>
                        </td>
                        <td className="px-4 py-2 border text-sm">
                          <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full font-medium ${
                            app.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                            app.status === 'pending_mentor_approval' ? 'bg-indigo-100 text-indigo-800' :
                            app.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                            app.status === 'under_drd_review' ? 'bg-yellow-100 text-yellow-800' :
                            app.status === 'drd_approved' ? 'bg-green-100 text-green-800' :
                            app.status === 'under_dean_review' ? 'bg-purple-100 text-purple-800' :
                            app.status === 'dean_approved' ? 'bg-green-100 text-green-800' :
                            app.status === 'completed' ? 'bg-green-100 text-green-800' :
                            app.status === 'published' ? 'bg-green-100 text-green-800' :
                            app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            app.status === 'changes_required' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {app.status?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </span>
                          {app.submittedAt && (
                            <div className="text-xs text-gray-500 mt-1">
                              Submitted: {new Date(app.submittedAt).toLocaleDateString('en-IN')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 border text-sm text-center">
                          {app.isContributor ? (
                            <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                              👥 Contributor
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                              👤 Applicant
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 border text-sm">
                          {/* Show incentives only for published applications */}
                          {(app.status === 'published' || app.status === 'completed' || app.status === 'drd_head_approved') ? (
                            app.pointsAwarded || app.incentiveAmount ? (
                              <div className="space-y-1">
                                <div className="flex items-center text-green-700">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  <span className="font-medium text-xs">
                                    {app.pointsAwarded || 0} Points
                                  </span>
                                </div>
                                <div className="text-xs text-green-600 font-medium">
                                  ₹{app.incentiveAmount || 0}
                                </div>
                                {app.creditedAt && (
                                  <div className="text-xs text-gray-500">
                                    Credited: {new Date(app.creditedAt).toLocaleDateString('en-IN')}
                                  </div>
                                )}
                                {app.isContributor && (
                                  <div className="text-xs text-purple-600 mt-1">
                                    (As Contributor)
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-yellow-600 italic">
                                Processing...
                              </div>
                            )
                          ) : (
                            <div className="text-xs text-gray-400 italic">
                              Pending approval
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 border text-sm text-center">
                          <div className="flex flex-col gap-1 items-center">
                            <button
                              onClick={() => window.location.href = `/ipr/applications/${app.id}`}
                              className="bg-[#005b96] text-white px-3 py-1 rounded-lg text-xs hover:bg-[#03396c] transition-colors w-full"
                            >
                              View Details
                            </button>
                            {/* Show Edit button only for owner's draft or changes_required applications (NOT during pending_mentor_approval) */}
                            {!app.isContributor && (app.status === 'draft' || app.status === 'changes_required') && (
                              <button
                                onClick={() => window.location.href = `/ipr/applications/${app.id}/edit`}
                                className="bg-orange-500 text-white px-3 py-1 rounded-lg text-xs hover:bg-orange-600 transition-colors w-full"
                              >
                                Edit
                              </button>
                            )}
                            {/* Show Submit button for draft (provisional) applications */}
                            {!app.isContributor && app.status === 'draft' && (
                              <button
                                onClick={async () => {
                                  try {
                                    await iprService.submitApplication(app.id);
                                    window.location.reload();
                                  } catch (err: unknown) {
                                    logger.error('Submit failed:', err);
                                    toast({ type: 'error', message: extractErrorMessage(err) });
                                  }
                                }}
                                className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-blue-700 transition-colors w-full"
                              >
                                {isCurrentUserStudent ? 'Submit to Mentor' : 'Submit to DRD'}
                              </button>
                            )}
                            {/* Show Resubmit button for changes_required status */}
                            {!app.isContributor && app.status === 'changes_required' && (
                              <button
                                onClick={async () => {
                                  try {
                                    await iprService.resubmitApplication(app.id);
                                    window.location.reload();
                                  } catch (err: unknown) {
                                    logger.error('Resubmit failed:', err);
                                    toast({ type: 'error', message: extractErrorMessage(err) });
                                  }
                                }}
                                className="bg-green-500 text-white px-3 py-1 rounded-lg text-xs hover:bg-green-600 transition-colors w-full"
                              >
                                {app.changesRequestedByMentor ? 'Resubmit to Mentor' : 'Resubmit to DRD'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}