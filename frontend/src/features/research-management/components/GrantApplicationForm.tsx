'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Save, 
  Send, 
  Plus, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  DollarSign,
  Globe,
  Building2,
  Users,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Award,
  Coins,
  Info
} from 'lucide-react';
import { useAuthStore } from '@/shared/auth/authStore';
import api, { getFileUrl } from '@/shared/api/api';
import InvestigatorManager from './InvestigatorManager';
import grantPolicyService, { GrantIncentivePolicy } from '@/features/research-management/services/grantPolicy.service';
import { logger } from '@/shared/utils/logger';
import { extractErrorMessage } from '@/shared/types/api.types';

// SDG Goals - Same as research contribution form
const SDG_GOALS = [
  { value: 'sdg1', label: 'SDG 1: No Poverty' },
  { value: 'sdg2', label: 'SDG 2: Zero Hunger' },
  { value: 'sdg3', label: 'SDG 3: Good Health and Well-being' },
  { value: 'sdg4', label: 'SDG 4: Quality Education' },
  { value: 'sdg5', label: 'SDG 5: Gender Equality' },
  { value: 'sdg6', label: 'SDG 6: Clean Water and Sanitation' },
  { value: 'sdg7', label: 'SDG 7: Affordable and Clean Energy' },
  { value: 'sdg8', label: 'SDG 8: Decent Work and Economic Growth' },
  { value: 'sdg9', label: 'SDG 9: Industry, Innovation and Infrastructure' },
  { value: 'sdg10', label: 'SDG 10: Reduced Inequalities' },
  { value: 'sdg11', label: 'SDG 11: Sustainable Cities and Communities' },
  { value: 'sdg12', label: 'SDG 12: Responsible Consumption and Production' },
  { value: 'sdg13', label: 'SDG 13: Climate Action' },
  { value: 'sdg14', label: 'SDG 14: Life Below Water' },
  { value: 'sdg15', label: 'SDG 15: Life on Land' },
  { value: 'sdg16', label: 'SDG 16: Peace, Justice and Strong Institutions' },
  { value: 'sdg17', label: 'SDG 17: Partnerships for the Goals' },
];

const COUNTRY_LIST = [
  'United States', 'United Kingdom', 'Germany', 'France', 'Canada', 'Australia',
  'Japan', 'China', 'South Korea', 'Singapore', 'Netherlands', 'Switzerland',
  'Sweden', 'Norway', 'Denmark', 'Finland', 'Belgium', 'Austria', 'Italy', 'Spain',
  'Brazil', 'Mexico', 'South Africa', 'UAE', 'Saudi Arabia', 'Israel', 'New Zealand',
  'Ireland', 'Poland', 'Czech Republic', 'Hungary', 'Russia', 'Ukraine', 'Turkey',
  'Thailand', 'Vietnam', 'Indonesia', 'Malaysia', 'Philippines', 'Bangladesh',
  'Pakistan', 'Sri Lanka', 'Nepal', 'Other'
];

const FUNDING_AGENCY_OPTIONS = [
  { value: 'dst', label: 'DST (Department of Science & Technology)' },
  { value: 'dbt', label: 'DBT (Department of Biotechnology)' },
  { value: 'anrf', label: 'ANRF (Anusandhan National Research Foundation)' },
  { value: 'csir', label: 'CSIR (Council of Scientific & Industrial Research)' },
  { value: 'icssr', label: 'ICSSR (Indian Council of Social Science Research)' },
  { value: 'other', label: 'Other' },
];

interface ConsortiumOrganization {
  id: string;
  organizationName: string;
  country: string;
  numberOfMembers: number;
}

interface Investigator {
  uid?: string;
  name: string;
  investigatorType: 'Faculty' | 'Student';
  investigatorCategory: 'Internal' | 'External';
  roleType: 'pi' | 'co_pi';
  email?: string;
  affiliation: string;
  designation?: string;
  department?: string;
  consortiumOrgId?: string;
  consortiumOrgName?: string;
  isTeamCoordinator?: boolean;
}

interface Props {
  grantId?: string;
  onSuccess?: () => void;
}

interface EditSuggestion {
  id: string;
  fieldName: string;
  originalValue: string;
  suggestedValue: string;
  suggestionNote?: string;
  status: 'pending' | 'accepted' | 'rejected';
  reviewer?: { employeeDetails?: { displayName?: string } };
}

export default function GrantApplicationForm({ grantId, onSuccess }: Props) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editSuggestions, setEditSuggestions] = useState<EditSuggestion[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState<string | null>(null);
  
  // Schools and departments for selection
  const [schools, setSchools] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  
  // Form data
  const [formData, setFormData] = useState({
    // Basic Info
    title: '',
    submittedAmount: '',
    sdgGoals: [] as string[],
    
    // Project Type
    projectType: 'indian' as 'indian' | 'international',
    numberOfConsortiumOrgs: 0,
    
    // Project Status & Category
    projectStatus: 'submitted' as 'submitted' | 'approved',
    projectCategory: 'govt' as 'govt' | 'non_govt' | 'industry',
    
    // Funding Agency
    fundingAgencyType: '' as '' | 'dst' | 'dbt' | 'anrf' | 'csir' | 'icssr' | 'other',
    fundingAgencyName: '',
    
    // Investigator Configuration
    totalInvestigators: 1,
    numberOfInternalPIs: 1,
    numberOfInternalCoPIs: 0,
    isPIExternal: false,
    myRole: 'pi' as 'pi' | 'co_pi',
    
    // Dates
    dateOfSubmission: '',
    projectStartDate: '',
    projectEndDate: '',
    projectDurationMonths: '',
    
    // School & Department
    schoolId: '',
    departmentId: '',
  });
  
  // Consortium Organizations
  const [consortiumOrganizations, setConsortiumOrganizations] = useState<ConsortiumOrganization[]>([]);
  
  // Investigators
  const [investigators, setInvestigators] = useState<Investigator[]>([]);
  
  // Grant Policy and Incentive Calculation
  const [activePolicy, setActivePolicy] = useState<GrantIncentivePolicy | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  
  // File upload
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [existingProposalPath, setExistingProposalPath] = useState<string>('');
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  
  // Calculate minimum total investigators dynamically
  const calculateMinimumInvestigators = (): number => {
    let minRequired = 1; // At minimum, just the user
    
    if (formData.projectType === 'international' && consortiumOrganizations.length > 0) {
      // For international projects, count consortium members
      const totalConsortiumMembers = consortiumOrganizations.reduce((sum, org) => sum + org.numberOfMembers, 0);
      minRequired = totalConsortiumMembers + 1; // +1 for user
      
      // If user is Co-PI and PI is internal, add 1 for internal PI slot
      if (formData.myRole === 'co_pi' && !formData.isPIExternal) {
        const hasPIInTeam = investigators.some(inv => inv.roleType === 'pi');
        if (!hasPIInTeam) {
          minRequired = totalConsortiumMembers + 2; // +1 for user (Co-PI) + 1 for internal PI slot
        }
      }
    } else {
      // For non-international projects
      const teamMemberCount = investigators.length;
      minRequired = teamMemberCount + 1; // +1 for user
      
      // If user is Co-PI and PI is internal, add 1 for internal PI slot
      if (formData.myRole === 'co_pi' && !formData.isPIExternal) {
        const hasPIInTeam = investigators.some(inv => inv.roleType === 'pi');
        if (!hasPIInTeam) {
          minRequired = teamMemberCount + 2; // +1 for user (Co-PI) + 1 for internal PI slot
        }
      }
    }
    
    return minRequired;
  };
  
  // Fetch schools on mount
  useEffect(() => {
    fetchSchools();
    
    // Auto-populate school and department from user profile
    if (user?.employeeDetails?.department?.school?.id) {
      setFormData(prev => ({
        ...prev,
        schoolId: user.employeeDetails!.department!.school!.id,
        departmentId: user.employeeDetails!.department!.id || ''
      }));
    }
    
    if (grantId) {
      loadGrant(grantId);
    }
  }, [grantId, user]);
  
  // Fetch departments when school changes
  useEffect(() => {
    if (formData.schoolId) {
      fetchDepartments(formData.schoolId);
    } else {
      setDepartments([]);
      setFormData(prev => ({ ...prev, departmentId: '' }));
    }
  }, [formData.schoolId]);
  
  // Update consortium organizations when count changes
  useEffect(() => {
    const count = formData.numberOfConsortiumOrgs;
    if (count > consortiumOrganizations.length) {
      // Add new organizations
      const newOrgs = [...consortiumOrganizations];
      for (let i = consortiumOrganizations.length; i < count; i++) {
        newOrgs.push({
          id: `org-${Date.now()}-${i}`,
          organizationName: '',
          country: '',
          numberOfMembers: 1
        });
      }
      setConsortiumOrganizations(newOrgs);
    } else if (count < consortiumOrganizations.length) {
      // Remove excess organizations
      setConsortiumOrganizations(consortiumOrganizations.slice(0, count));
      // Also remove investigators from removed orgs
      const remainingOrgIds = consortiumOrganizations.slice(0, count).map(o => o.id);
      setInvestigators(investigators.filter(inv => 
        !inv.consortiumOrgId || remainingOrgIds.includes(inv.consortiumOrgId)
      ));
    }
  }, [formData.numberOfConsortiumOrgs]);
  
  // Auto-update totalInvestigators based on consortium members (for international projects)
  useEffect(() => {
    if (formData.projectType === 'international' && consortiumOrganizations.length > 0) {
      const totalConsortiumMembers = consortiumOrganizations.reduce((sum, org) => sum + org.numberOfMembers, 0);
      let minRequired = totalConsortiumMembers + 1; // +1 for the user
      
      // If user is Co-PI and PI is internal, add 1 for the internal PI slot
      if (formData.myRole === 'co_pi' && !formData.isPIExternal) {
        const hasPIInTeam = investigators.some(inv => inv.roleType === 'pi');
        if (!hasPIInTeam) {
          minRequired = totalConsortiumMembers + 2; // +1 for user (Co-PI) + 1 for internal PI slot
        }
      }
      
      // Update if current value is less than minimum required
      if (formData.totalInvestigators < minRequired) {
        setFormData(prev => ({
          ...prev,
          totalInvestigators: minRequired
        }));
      }
    }
  }, [consortiumOrganizations, formData.projectType, formData.myRole, formData.isPIExternal, investigators]);
  
  // Auto-update totalInvestigators when team members are added/removed
  useEffect(() => {
    const teamMemberCount = investigators.length;
    
    // Calculate required total based on user role and PI configuration
    // If user is Co-PI and PI is internal (not external), we need:
    // - team members + 1 (user as Co-PI) + 1 (another person as internal PI)
    // Otherwise: team members + 1 (user)
    let requiredTotal = teamMemberCount + 1; // +1 for the user (PI/Co-PI)
    
    if (formData.myRole === 'co_pi' && !formData.isPIExternal) {
      // User is Co-PI and PI is internal, so we need another person as PI
      const hasPIInTeam = investigators.some(inv => inv.roleType === 'pi');
      if (!hasPIInTeam) {
        requiredTotal = teamMemberCount + 2; // +1 for user (Co-PI) + 1 for PI slot
      }
    }
    
    // Only update if current totalInvestigators is less than required
    if (formData.totalInvestigators < requiredTotal) {
      setFormData(prev => ({
        ...prev,
        totalInvestigators: requiredTotal
      }));
    }
  }, [investigators.length, formData.myRole, formData.isPIExternal]);
  
  // Auto-calculate project duration based on start and end dates
  useEffect(() => {
    if (formData.projectStartDate && formData.projectEndDate) {
      const startDate = new Date(formData.projectStartDate);
      const endDate = new Date(formData.projectEndDate);
      
      // Calculate months difference
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (endDate.getMonth() - startDate.getMonth());
      
      // Only update if the calculated duration is different and positive
      if (monthsDiff > 0 && monthsDiff !== Number(formData.projectDurationMonths)) {
        setFormData(prev => ({
          ...prev,
          projectDurationMonths: monthsDiff.toString()
        }));
      }
    }
  }, [formData.projectStartDate, formData.projectEndDate]);
  
  // Fetch active grant policy when project category, type, or date of submission changes
  useEffect(() => {
    const fetchPolicy = async () => {
      if (!formData.projectCategory || !formData.projectType) {
        setActivePolicy(null);
        return;
      }

      try {
        setPolicyLoading(true);
        const policy = await grantPolicyService.getActivePolicy(
          formData.projectCategory,
          formData.projectType
        );
        setActivePolicy(policy);
        logger.debug('Fetched active grant policy:', policy);
      } catch (error) {
        logger.error('Error fetching grant policy:', error);
        setActivePolicy(null);
      } finally {
        setPolicyLoading(false);
      }
    };

    fetchPolicy();
  }, [formData.projectCategory, formData.projectType, formData.dateOfSubmission]);
  
  /**
   * Calculate incentive and points for a specific investigator based on active policy
   * Grants: Students are NOT involved, only internal faculty/employees
   * Split policies: equal OR percentage_based (PI vs Co-PI split)
   */
  const calculateInvestigatorIncentive = (
    roleType: 'pi' | 'co_pi',
    investigatorCategory: 'Internal' | 'External'
  ): { incentive: number; points: number } => {
    // External investigators get ZERO
    if (investigatorCategory === 'External') {
      return { incentive: 0, points: 0 };
    }

    // No policy loaded yet
    if (!activePolicy) {
      return { incentive: 0, points: 0 };
    }

    // Calculate total base amount with bonuses
    let totalIncentive = Number(activePolicy.baseIncentiveAmount);
    const totalPoints = Number(activePolicy.basePoints);

    // Add international bonus
    if (formData.projectType === 'international' && activePolicy.internationalBonus) {
      totalIncentive += Number(activePolicy.internationalBonus);
    }

    // Add consortium bonus
    if (formData.numberOfConsortiumOrgs > 0 && activePolicy.consortiumBonus) {
      totalIncentive += Number(activePolicy.consortiumBonus) * formData.numberOfConsortiumOrgs;
    }

    // Count internal investigators
    const internalInvestigators = [
      { roleType: formData.myRole, isInternal: true }, // Applicant (always internal)
      ...investigators.filter(inv => inv.investigatorCategory === 'Internal')
    ];

    const totalInternalCount = internalInvestigators.length;
    
    if (totalInternalCount === 0) {
      return { incentive: 0, points: 0 };
    }

    // Calculate based on split policy
    if (activePolicy.splitPolicy === 'equal') {
      // Equal split among all internal investigators (use floor to prevent exceeding total)
      const perPersonIncentive = Math.floor(totalIncentive / totalInternalCount);
      const perPersonPoints = Math.floor(totalPoints / totalInternalCount);
      return { incentive: perPersonIncentive, points: perPersonPoints };
    } else {
      // Percentage-based split using role percentages
      const rolePercentages = activePolicy.rolePercentages || [
        { role: 'pi', percentage: 45 },
        { role: 'co_pi', percentage: 55 }
      ];

      const piPercentage = rolePercentages.find(r => r.role === 'pi')?.percentage || 45;
      const coPiTotalPercentage = rolePercentages.find(r => r.role === 'co_pi')?.percentage || 55;

      // Count PIs and Co-PIs
      const piCount = internalInvestigators.filter(inv => inv.roleType === 'pi').length;
      const coPiCount = internalInvestigators.filter(inv => inv.roleType === 'co_pi').length;

      if (roleType === 'pi') {
        if (piCount === 0) return { incentive: 0, points: 0 };
        // PIs share the PI percentage equally (use floor to prevent exceeding total)
        const piIncentive = Math.floor((totalIncentive * piPercentage) / 100 / piCount);
        const piPoints = Math.floor((totalPoints * piPercentage) / 100 / piCount);
        return { incentive: piIncentive, points: piPoints };
      } else {
        if (coPiCount === 0) return { incentive: 0, points: 0 };
        // Co-PIs share the Co-PI percentage equally (use floor to prevent exceeding total)
        const coPiIncentive = Math.floor((totalIncentive * coPiTotalPercentage) / 100 / coPiCount);
        const coPiPoints = Math.floor((totalPoints * coPiTotalPercentage) / 100 / coPiCount);
        return { incentive: coPiIncentive, points: coPiPoints };
      }
    }
  };
  
  const fetchSchools = async () => {
    try {
      const response = await api.get('/schools');
      const schoolsData = response.data.data || response.data || [];
      logger.debug('Fetched schools:', schoolsData);
      setSchools(schoolsData);
    } catch (error) {
      logger.error('Error fetching schools:', error);
      setSchools([]);
    }
  };
  
  const fetchDepartments = async (schoolId: string) => {
    try {
      const response = await api.get(`/departments/by-school/${schoolId}`);
      const depts = response.data.data || response.data || [];
      logger.debug('Fetched departments for school', schoolId, ':', depts);
      setDepartments(depts);
    } catch (error) {
      logger.error('Error fetching departments:', error);
      setDepartments([]);
    }
  };
  
  const loadGrant = async (id: string) => {
    setLoading(true);
    try {
      const response = await api.get(`/grants/${id}`);
      const grant = response.data.data;
      
      // Load edit suggestions if any
      if (grant.editSuggestions && grant.editSuggestions.length > 0) {
        setEditSuggestions(grant.editSuggestions.filter((s: EditSuggestion) => s.status === 'pending'));
      }
      
      setFormData({
        title: grant.title || '',
        submittedAmount: grant.submittedAmount?.toString() || '',
        sdgGoals: grant.sdgGoals || [],
        projectType: grant.projectType || 'indian',
        numberOfConsortiumOrgs: grant.numberOfConsortiumOrgs || 0,
        projectStatus: grant.projectStatus || 'submitted',
        projectCategory: grant.projectCategory || 'govt',
        fundingAgencyType: grant.fundingAgencyType || '',
        fundingAgencyName: grant.fundingAgencyName || '',
        totalInvestigators: grant.totalInvestigators || 1,
        numberOfInternalPIs: grant.numberOfInternalPIs || 1,
        numberOfInternalCoPIs: grant.numberOfInternalCoPIs || 0,
        isPIExternal: grant.isPIExternal || false,
        myRole: grant.myRole || 'pi',
        dateOfSubmission: grant.dateOfSubmission?.split('T')[0] || '',
        projectStartDate: grant.projectStartDate?.split('T')[0] || '',
        projectEndDate: grant.projectEndDate?.split('T')[0] || '',
        projectDurationMonths: grant.projectDurationMonths?.toString() || '',
        schoolId: grant.schoolId || '',
        departmentId: grant.departmentId || '',
      });
      
      if (grant.consortiumOrganizations) {
        setConsortiumOrganizations(grant.consortiumOrganizations);
      }
      
      if (grant.investigators) {
        setInvestigators(grant.investigators.map((inv: any) => ({
          uid: inv.uid,
          name: inv.name,
          investigatorType: inv.investigatorType || 'Faculty',
          investigatorCategory: inv.isInternal ? 'Internal' : 'External',
          roleType: inv.roleType,
          email: inv.email,
          affiliation: inv.affiliation,
          designation: inv.designation,
          department: inv.department,
          consortiumOrgId: inv.consortiumOrgId,
          consortiumOrgName: inv.consortiumOrg?.organizationName,
          isTeamCoordinator: inv.isTeamCoordinator
        })));
      }
    } catch (error) {
      logger.error('Error loading grant:', error);
      setError('Failed to load grant application');
    } finally {
      setLoading(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? '' : Number(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSDGChange = (sdgValue: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      sdgGoals: checked 
        ? [...prev.sdgGoals, sdgValue]
        : prev.sdgGoals.filter(s => s !== sdgValue)
    }));
  };
  
  const updateConsortiumOrg = (index: number, field: keyof ConsortiumOrganization, value: string | number) => {
    const updated = [...consortiumOrganizations];
    updated[index] = { ...updated[index], [field]: value };
    setConsortiumOrganizations(updated);
  };
  
  const handleAcceptSuggestion = async (suggestion: EditSuggestion) => {
    try {
      setSuggestionLoading(suggestion.id);
      await api.post(`/grants/suggestions/${suggestion.id}/respond`, { accept: true });
      
      // Reload grant data to get updated suggestions
      if (grantId) {
        await loadGrant(grantId);
      }
      
      setSuccess('Suggestion accepted and applied');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: unknown) {
      logger.error('Error accepting suggestion:', error);
      setError(extractErrorMessage(error));
      setTimeout(() => setError(null), 5000);
    } finally {
      setSuggestionLoading(null);
    }
  };
  
  const handleRejectSuggestion = async (suggestion: EditSuggestion) => {
    try {
      setSuggestionLoading(suggestion.id);
      await api.post(`/grants/suggestions/${suggestion.id}/respond`, { accept: false });
      
      // Reload grant data to get updated suggestions
      if (grantId) {
        await loadGrant(grantId);
      }
      
      setSuccess('Suggestion rejected');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: unknown) {
      logger.error('Error rejecting suggestion:', error);
      setError(extractErrorMessage(error));
      setTimeout(() => setError(null), 5000);
    } finally {
      setSuggestionLoading(null);
    }
  };
  
  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setError('Project title is required');
      return false;
    }
    
    if (!formData.submittedAmount) {
      setError('Submitted amount is required');
      return false;
    }
    
    // Validate minimum total investigators
    const consortiumMembers = formData.projectType === 'international' 
      ? consortiumOrganizations.reduce((sum, org) => sum + org.numberOfMembers, 0)
      : 0;
    const minInvestigators = formData.projectType === 'international' ? consortiumMembers + 1 : 1;
    if (formData.totalInvestigators < minInvestigators) {
      setError(`For ${formData.projectType === 'international' ? 'international' : 'Indian'} projects, minimum ${minInvestigators} investigator(s) required (${consortiumMembers} consortium members + 1 you)`);
      return false;
    }
    
    if (formData.projectCategory === 'govt' && !formData.fundingAgencyType) {
      setError('Please select a funding agency');
      return false;
    }
    
    if (formData.fundingAgencyType === 'other' && !formData.fundingAgencyName.trim()) {
      setError('Please enter the funding agency name');
      return false;
    }
    
    if ((formData.projectCategory === 'non_govt' || formData.projectCategory === 'industry') && !formData.fundingAgencyName.trim()) {
      setError('Please enter the funding agency name');
      return false;
    }
    
    if (formData.projectType === 'international') {
      if (formData.numberOfConsortiumOrgs < 1) {
        setError('At least one consortium organization is required for international projects');
        return false;
      }
      
      for (const org of consortiumOrganizations) {
        if (!org.organizationName.trim() || !org.country) {
          setError('All consortium organizations must have a name and country');
          return false;
        }
      }
    }
    
    if (!formData.schoolId) {
      setError('Please select a school');
      return false;
    }
    
    // Validate only one PI in total (user's role + team members)
    const teamPIs = investigators.filter(inv => inv.roleType === 'pi').length;
    const userIsPI = formData.myRole === 'pi' ? 1 : 0;
    const totalPIs = teamPIs + userIsPI;
    
    if (totalPIs === 0) {
      setError('At least one Principal Investigator (PI) is required');
      return false;
    }
    
    if (totalPIs > 1) {
      setError('Only one Principal Investigator (PI) is allowed in total. Please check your role and team members.');
      return false;
    }
    
    // If user is Co-PI and PI is internal, ensure PI is in team
    if (formData.myRole === 'co_pi' && !formData.isPIExternal && teamPIs === 0) {
      setError('Since you are a Co-PI and the PI is internal, you must add an internal team member with the PI role');
      return false;
    }
    
    // Validate total investigators count
    let actualTotal = investigators.length + 1; // +1 for user
    
    // If user is Co-PI and PI is internal, ensure space for internal PI
    if (formData.myRole === 'co_pi' && !formData.isPIExternal) {
      const hasPIInTeam = investigators.some(inv => inv.roleType === 'pi');
      if (!hasPIInTeam) {
        actualTotal = investigators.length + 2; // +1 for user (Co-PI) + 1 for PI slot
      }
    }
    
    if (formData.totalInvestigators < actualTotal) {
      const explanation = formData.myRole === 'co_pi' && !formData.isPIExternal && !investigators.some(inv => inv.roleType === 'pi')
        ? `you (Co-PI) + ${investigators.length} team members + 1 internal PI slot`
        : `you + ${investigators.length} team members`;
      setError(`Total investigators (${formData.totalInvestigators}) must be at least ${actualTotal} (${explanation})`);
      return false;
    }
    
    return true;
  };
  
  const prepareSubmissionData = () => {
    const data = {
      ...formData,
      submittedAmount: formData.submittedAmount ? parseFloat(formData.submittedAmount) : null,
      projectDurationMonths: formData.projectDurationMonths ? parseInt(formData.projectDurationMonths) : null,
      consortiumOrganizations: formData.projectType === 'international' ? consortiumOrganizations : [],
      investigators: investigators.map((inv, index) => ({
        ...inv,
        isInternal: inv.investigatorCategory === 'Internal',
        displayOrder: index
      }))
    };

    // If there's a file to upload, return FormData
    if (proposalFile) {
      const formDataObj = new FormData();
      formDataObj.append('data', JSON.stringify(data));
      formDataObj.append('proposalFile', proposalFile);
      return formDataObj;
    }

    return data;
  };
  
  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const data = prepareSubmissionData();
      const isFormData = data instanceof FormData;
      
      if (grantId) {
        await api.put(`/grants/${grantId}`, data, {
          headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined
        });
      } else {
        const payload = isFormData ? data : { ...data, status: 'draft' };
        if (!isFormData) {
          (payload as any).status = 'draft';
        } else {
          const jsonData = JSON.parse((data as FormData).get('data') as string);
          (data as FormData).set('data', JSON.stringify({ ...jsonData, status: 'draft' }));
        }
        const response = await api.post('/grants', payload, {
          headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined
        });
        // Redirect to edit mode with new ID
        if (response.data.data?.id && onSuccess) {
          onSuccess();
        }
      }
      
      setSuccess('Draft saved successfully');
      if (proposalFile) {
        setProposalFile(null);
      }
    } catch (error: unknown) {
      logger.error('Error saving draft:', error);
      setError(extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const data = prepareSubmissionData();
      const isFormData = data instanceof FormData;
      
      if (grantId) {
        // Update existing grant and submit
        await api.put(`/grants/${grantId}`, data, {
          headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined
        });
        await api.post(`/grants/${grantId}/submit`);
      } else {
        // Create new grant with status 'submitted' - backend will auto-submit
        const payload = isFormData ? data : { ...data, status: 'submitted' };
        if (!isFormData) {
          (payload as any).status = 'submitted';
        } else {
          const jsonData = JSON.parse((data as FormData).get('data') as string);
          (data as FormData).set('data', JSON.stringify({ ...jsonData, status: 'submitted' }));
        }
        await api.post('/grants', payload, {
          headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined
        });
      }
      
      setSuccess('Grant application submitted successfully!');
      
      if (onSuccess) {
        setTimeout(onSuccess, 1500);
      }
    } catch (error: unknown) {
      logger.error('Error submitting grant:', error);
      setError(extractErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-white">Grant / Funding Application</h1>
            <p className="text-orange-100 text-sm">Submit your research grant proposal</p>
          </div>
        </div>
        
        {/* Form Content */}
        <div className="p-6 space-y-8">
          {/* Error/Success Messages */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-700">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto">
                <X className="w-4 h-4 text-red-600" />
              </button>
            </div>
          )}
          
          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-700">{success}</p>
            </div>
          )}
          
          {/* Edit Suggestions */}
          {editSuggestions.length > 0 && (
            <div className="space-y-3">
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h3 className="font-semibold text-orange-900 mb-2">Reviewer Suggestions ({editSuggestions.length})</h3>
                <p className="text-sm text-orange-700">The reviewer has suggested changes to your application. Review and accept or reject each suggestion below.</p>
              </div>
              
              {editSuggestions.map((suggestion) => {
                const sdgLabel = suggestion.fieldName === 'sdgGoals' 
                  ? 'SDG Goals'
                  : suggestion.fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                
                return (
                  <div key={suggestion.id} className="p-4 bg-white border-2 border-orange-200 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{sdgLabel}</h4>
                        {suggestion.reviewer?.employeeDetails?.displayName && (
                          <p className="text-xs text-gray-500">Suggested by {suggestion.reviewer.employeeDetails.displayName}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Current Value</div>
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                          {suggestion.fieldName === 'sdgGoals' 
                            ? suggestion.originalValue.split(',').map(sdg => SDG_GOALS.find(s => s.value === sdg)?.label || sdg).join(', ')
                            : suggestion.originalValue || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Suggested Value</div>
                        <div className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                          {suggestion.fieldName === 'sdgGoals'
                            ? suggestion.suggestedValue.split(',').map(sdg => SDG_GOALS.find(s => s.value === sdg)?.label || sdg).join(', ')
                            : suggestion.suggestedValue}
                        </div>
                      </div>
                    </div>
                    
                    {suggestion.suggestionNote && (
                      <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
                        <div className="text-xs text-blue-600 mb-1">Reviewer Note</div>
                        <div className="text-sm text-blue-900">{suggestion.suggestionNote}</div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptSuggestion(suggestion)}
                        disabled={suggestionLoading === suggestion.id}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {suggestionLoading === suggestion.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Accept & Apply
                      </button>
                      <button
                        onClick={() => handleRejectSuggestion(suggestion)}
                        disabled={suggestionLoading === suggestion.id}
                        className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {suggestionLoading === suggestion.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {editSuggestions.length === 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                  <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <p className="text-green-700 font-medium">All suggestions have been resolved!</p>
                  <p className="text-sm text-green-600 mt-1">You can now resubmit your application.</p>
                </div>
              )}
            </div>
          )}
          
          {/* Section 1: Project Status & Category - MOVED TO TOP */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Project Status & Category
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Research Project Status *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="projectStatus"
                      value="submitted"
                      checked={formData.projectStatus === 'submitted'}
                      onChange={handleInputChange}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span>Submitted</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="projectStatus"
                      value="approved"
                      checked={formData.projectStatus === 'approved'}
                      onChange={handleInputChange}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span>Approved</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Category *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="projectCategory"
                      value="govt"
                      checked={formData.projectCategory === 'govt'}
                      onChange={(e) => {
                        handleInputChange(e);
                        setFormData(prev => ({ ...prev, fundingAgencyType: '', fundingAgencyName: '' }));
                      }}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span>Government</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="projectCategory"
                      value="non_govt"
                      checked={formData.projectCategory === 'non_govt'}
                      onChange={(e) => {
                        handleInputChange(e);
                        setFormData(prev => ({ ...prev, fundingAgencyType: '', fundingAgencyName: '' }));
                      }}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span>Non-Govt</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="projectCategory"
                      value="industry"
                      checked={formData.projectCategory === 'industry'}
                      onChange={(e) => {
                        handleInputChange(e);
                        setFormData(prev => ({ ...prev, fundingAgencyType: '', fundingAgencyName: '' }));
                      }}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span>Industry</span>
                  </label>
                </div>
              </div>
            </div>
            
            {/* Funding Agency - Conditional */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formData.projectCategory === 'govt' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Funding Agency *
                  </label>
                  <select
                    name="fundingAgencyType"
                    value={formData.fundingAgencyType}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  >
                    <option value="">Select Funding Agency</option>
                    {FUNDING_AGENCY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {(formData.fundingAgencyType === 'other' || 
                formData.projectCategory === 'non_govt' || 
                formData.projectCategory === 'industry') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Funding Agency Name *
                  </label>
                  <input
                    type="text"
                    name="fundingAgencyName"
                    value={formData.fundingAgencyName}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                    placeholder="Enter funding agency name"
                  />
                </div>
              )}
            </div>
          </section>
          
          {/* Section 2: Basic Project Information */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-600" />
              Project Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title of Research Project *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  placeholder="Enter full project title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Submitted Amount (₹) *
                </label>
                <input
                  type="number"
                  name="submittedAmount"
                  value={formData.submittedAmount}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  placeholder="Enter amount in INR"
                  min="0"
                />
              </div>
            </div>
            
            {/* SDG Goals */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sustainable Development Goals (SDGs)
              </label>
              <details className="group">
                <summary className="cursor-pointer px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 hover:bg-white flex justify-between items-center transition-colors">
                  <span className="text-gray-600">
                    {formData.sdgGoals.length > 0 
                      ? `${formData.sdgGoals.length} SDG${formData.sdgGoals.length !== 1 ? 's' : ''} selected`
                      : 'Click to select relevant SDGs'}
                  </span>
                  <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="mt-2 p-4 border border-gray-200 rounded-xl bg-white shadow-lg max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {SDG_GOALS.map((sdg) => (
                      <label key={sdg.value} className="flex items-center space-x-2 px-3 py-2 hover:bg-orange-50 rounded-lg cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.sdgGoals.includes(sdg.value)}
                          onChange={(e) => handleSDGChange(sdg.value, e.target.checked)}
                          className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                        />
                        <span className="text-sm">{sdg.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </details>
              
              {/* Selected SDGs Display */}
              {formData.sdgGoals.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.sdgGoals.map((sdgValue) => {
                    const sdg = SDG_GOALS.find(s => s.value === sdgValue);
                    return (
                      <span key={sdgValue} className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                        {sdg?.label.split(':')[0]}
                        <button 
                          type="button"
                          onClick={() => handleSDGChange(sdgValue, false)}
                          className="hover:text-orange-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
          
          {/* Section 2: Project Type */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Globe className="w-5 h-5 text-orange-600" />
              Project Type & Consortium
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Type *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="projectType"
                      value="indian"
                      checked={formData.projectType === 'indian'}
                      onChange={handleInputChange}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span>Indian</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="projectType"
                      value="international"
                      checked={formData.projectType === 'international'}
                      onChange={handleInputChange}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span>International</span>
                  </label>
                </div>
              </div>
              
              {formData.projectType === 'international' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    No. of Representative Country Organizations in Consortium *
                  </label>
                  <input
                    type="number"
                    name="numberOfConsortiumOrgs"
                    value={formData.numberOfConsortiumOrgs}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                    min="1"
                    max="10"
                  />
                </div>
              )}
            </div>
            
            {/* Consortium Organizations */}
            {formData.projectType === 'international' && formData.numberOfConsortiumOrgs > 0 && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-900">Consortium Organizations</h3>
                {consortiumOrganizations.map((org, index) => (
                  <div key={org.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-white rounded-lg border">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Organization Name *
                      </label>
                      <input
                        type="text"
                        value={org.organizationName}
                        onChange={(e) => updateConsortiumOrg(index, 'organizationName', e.target.value)}
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        placeholder="Organization name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Country *
                      </label>
                      <select
                        value={org.country}
                        onChange={(e) => updateConsortiumOrg(index, 'country', e.target.value)}
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      >
                        <option value="">Select Country</option>
                        {COUNTRY_LIST.map(country => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        No. of Team Members *
                      </label>
                      <input
                        type="number"
                        value={org.numberOfMembers}
                        onChange={(e) => updateConsortiumOrg(index, 'numberOfMembers', parseInt(e.target.value) || 1)}
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                        min="1"
                        max="20"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          
          {/* Section 3: Investigator Configuration */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              Project Team Configuration
            </h2>
            
            {/* Is PI External Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Is PI External? *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="isPIExternal"
                    value="no"
                    checked={!formData.isPIExternal}
                    onChange={() => {
                      setFormData(prev => ({
                        ...prev,
                        isPIExternal: false,
                        numberOfInternalCoPIs: Math.max(0, prev.numberOfInternalPIs - 1)
                      }));
                    }}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <span>No</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="isPIExternal"
                    value="yes"
                    checked={formData.isPIExternal}
                    onChange={() => {
                      setFormData(prev => ({
                        ...prev,
                        isPIExternal: true,
                        myRole: 'co_pi',
                        numberOfInternalCoPIs: prev.numberOfInternalPIs
                      }));
                    }}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <span>Yes</span>
                </label>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {formData.isPIExternal 
                  ? 'You will be a Co-PI. PI is from an external organization.' 
                  : 'Select your role as PI or Co-PI below.'}
              </p>
            </div>
            
            {/* My Role Selection - Only when PI is not external */}
            {!formData.isPIExternal && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  My Role *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="myRole"
                      value="pi"
                      checked={formData.myRole === 'pi'}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          myRole: e.target.value as 'pi' | 'co_pi',
                          numberOfInternalCoPIs: Math.max(0, prev.numberOfInternalPIs - 1)
                        }));
                      }}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span>Principal Investigator (PI)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="myRole"
                      value="co_pi"
                      checked={formData.myRole === 'co_pi'}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          myRole: e.target.value as 'pi' | 'co_pi',
                          // When you're Co-PI, there's still 1 PI among internal members, so Co-PIs = internal - 1
                          numberOfInternalCoPIs: Math.max(0, prev.numberOfInternalPIs - 1)
                        }));
                      }}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span>Co-Principal Investigator (Co-PI)</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.myRole === 'pi' 
                    ? 'You are the PI. Only one PI is allowed per project.' 
                    : 'You are a Co-PI. The PI role will be assigned to another team member.'}
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total No. of Investigators *
                </label>
                <input
                  type="number"
                  name="totalInvestigators"
                  value={formData.totalInvestigators}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  min={calculateMinimumInvestigators()}
                  max="20"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Includes you + all team members (min: {calculateMinimumInvestigators()})
                </p>
              </div>
              
              {formData.totalInvestigators > 1 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      No. of Internal Investigators
                    </label>
                    <input
                      type="number"
                      name="numberOfInternalPIs"
                      value={formData.numberOfInternalPIs}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setFormData(prev => ({
                          ...prev,
                          numberOfInternalPIs: value,
                          // If PI is external: all internal are Co-PIs
                          // If PI is internal: one internal person is PI, rest are Co-PIs (regardless of whether it's you or another team member)
                          numberOfInternalCoPIs: Math.max(0, value - (prev.isPIExternal ? 0 : 1))
                        }));
                      }}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      min="1"
                      max={formData.projectType === 'international' 
                        ? formData.totalInvestigators - consortiumOrganizations.reduce((sum, org) => sum + org.numberOfMembers, 0)
                        : formData.totalInvestigators}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.projectType === 'international' 
                        ? `Max: ${formData.totalInvestigators - consortiumOrganizations.reduce((sum, org) => sum + org.numberOfMembers, 0)} (Total - External members)` 
                        : 'Including you'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      No. of Internal Co-PIs (Auto-calculated)
                    </label>
                    <input
                      type="number"
                      name="numberOfInternalCoPIs"
                      value={formData.numberOfInternalCoPIs}
                      className="w-full rounded-lg border-gray-300 shadow-sm bg-gray-50"
                      disabled
                      readOnly
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.isPIExternal 
                        ? 'All Internal Investigators are Co-PIs (PI is external)' 
                        : 'Internal Investigators - 1 (1 PI + remaining Co-PIs)'}
                    </p>
                  </div>
                </>
              )}
            </div>
            
            {/* Investigator Manager */}
            {formData.totalInvestigators > 1 && (
              <InvestigatorManager
                investigators={investigators}
                onChange={setInvestigators}
                consortiumOrganizations={formData.projectType === 'international' ? consortiumOrganizations : []}
                totalInvestigators={formData.totalInvestigators}
                numberOfInternalPIs={formData.numberOfInternalPIs}
                numberOfInternalCoPIs={formData.numberOfInternalCoPIs}
                isPIExternal={formData.isPIExternal}
                currentUserRole={formData.myRole}
                label="Add Team Members (PI, Co-PIs, Investigators)"
              />
            )}
            
            {/* Investigator Summary Table */}
            {(investigators.length > 0 || formData.totalInvestigators === 1) && (
              <div className="mt-4 overflow-x-auto">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Team Summary (Total: {investigators.length + 1})</h4>
                
                {/* Policy Info Banner */}
                {activePolicy ? (
                  <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-green-800">
                        <p className="font-semibold mb-1">Active Grant Policy: {activePolicy.policyName}</p>
                        <div className="flex flex-wrap gap-4 text-xs">
                          <span>Base: ₹{Number(activePolicy.baseIncentiveAmount).toLocaleString()} / {activePolicy.basePoints} pts</span>
                          {activePolicy.internationalBonus && formData.projectType === 'international' && (
                            <span>International Bonus: ₹{Number(activePolicy.internationalBonus).toLocaleString()}</span>
                          )}
                          {activePolicy.consortiumBonus && formData.numberOfConsortiumOrgs > 0 && (
                            <span>Consortium Bonus: ₹{Number(activePolicy.consortiumBonus).toLocaleString()} × {formData.numberOfConsortiumOrgs}</span>
                          )}
                          <span className="font-medium">
                            Split: {activePolicy.splitPolicy === 'equal' ? 'Equal among all' : 'Role-based (PI/Co-PI)'}
                          </span>
                        </div>
                        <p className="text-xs mt-1 text-green-700">
                          * Only <strong>Internal</strong> investigators receive incentives and points
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-semibold">No active grant policy found</p>
                        <p className="text-xs mt-1">
                          Please ensure an active policy exists for <strong>{formData.projectCategory}</strong> category and <strong>{formData.projectType}</strong> type. Contact admin if needed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <table className="min-w-full divide-y divide-gray-200 border rounded-lg overflow-hidden">
                  <thead className="bg-orange-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Designation</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Est. Incentive</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Est. Points</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Current User Row */}
                    <tr className="bg-orange-25">
                      <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                        {user?.firstName && user?.lastName 
                          ? `${user.firstName} ${user.lastName}` 
                          : user?.employee?.displayName || user?.username || 'You'} (Applicant)
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{user?.email || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{user?.employee?.designation || user?.employeeDetails?.designation?.name || '-'}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          {formData.myRole === 'pi' ? 'PI' : 'Co-PI'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Internal</span>
                      </td>
                      <td className="px-4 py-2 text-sm text-right">
                        {(() => {
                          const calc = calculateInvestigatorIncentive(formData.myRole, 'Internal');
                          return (
                            <span className="text-green-600 font-semibold flex items-center justify-end gap-1">
                              <Coins className="w-3.5 h-3.5" />
                              ₹{calc.incentive.toLocaleString()}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-2 text-sm text-right">
                        {(() => {
                          const calc = calculateInvestigatorIncentive(formData.myRole, 'Internal');
                          return (
                            <span className="text-blue-600 font-semibold flex items-center justify-end gap-1">
                              <Award className="w-3.5 h-3.5" />
                              {calc.points}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                    
                    {/* Other Investigators */}
                    {investigators.map((inv, index) => {
                      const calc = calculateInvestigatorIncentive(inv.roleType, inv.investigatorCategory);
                      return (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {inv.name}
                            {inv.isTeamCoordinator && (
                              <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">Coordinator</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">{inv.email || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{inv.designation || '-'}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              inv.roleType === 'pi' ? 'bg-purple-100 text-purple-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {inv.roleType === 'pi' ? 'PI' : 'Co-PI'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              inv.investigatorCategory === 'Internal' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {inv.investigatorCategory}
                              {inv.consortiumOrgName && ` - ${inv.consortiumOrgName}`}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-right">
                            <span className={`font-semibold flex items-center justify-end gap-1 ${
                              calc.incentive > 0 ? 'text-green-600' : 'text-gray-400'
                            }`}>
                              <Coins className="w-3.5 h-3.5" />
                              ₹{calc.incentive.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-right">
                            <span className={`font-semibold flex items-center justify-end gap-1 ${
                              calc.points > 0 ? 'text-blue-600' : 'text-gray-400'
                            }`}>
                              <Award className="w-3.5 h-3.5" />
                              {calc.points}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    
                    {/* Totals Row */}
                    {activePolicy && (
                      <tr className="bg-gray-100 font-bold">
                        <td colSpan={5} className="px-4 py-3 text-sm text-right text-gray-700">
                          TOTAL (Internal Investigators Only)
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {(() => {
                            const applicantCalc = calculateInvestigatorIncentive(formData.myRole, 'Internal');
                            const teamTotal = investigators
                              .filter(inv => inv.investigatorCategory === 'Internal')
                              .reduce((sum, inv) => {
                                const calc = calculateInvestigatorIncentive(inv.roleType, inv.investigatorCategory);
                                return sum + calc.incentive;
                              }, 0);
                            const total = applicantCalc.incentive + teamTotal;
                            return (
                              <span className="text-green-700 font-bold flex items-center justify-end gap-1">
                                <Coins className="w-4 h-4" />
                                ₹{total.toLocaleString()}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {(() => {
                            const applicantCalc = calculateInvestigatorIncentive(formData.myRole, 'Internal');
                            const teamTotal = investigators
                              .filter(inv => inv.investigatorCategory === 'Internal')
                              .reduce((sum, inv) => {
                                const calc = calculateInvestigatorIncentive(inv.roleType, inv.investigatorCategory);
                                return sum + calc.points;
                              }, 0);
                            const total = applicantCalc.points + teamTotal;
                            return (
                              <span className="text-blue-700 font-bold flex items-center justify-end gap-1">
                                <Award className="w-4 h-4" />
                                {total}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                
                {!activePolicy && !policyLoading && (
                  <p className="mt-2 text-xs text-amber-600">
                    * No active policy found for this project category and type. Incentive calculation will be done upon approval.
                  </p>
                )}
              </div>
            )}
          </section>
          
          {/* Section 5: Dates */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              Project Timeline
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Submission
                </label>
                <input
                  type="date"
                  name="dateOfSubmission"
                  value={formData.dateOfSubmission}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Start Date
                </label>
                <input
                  type="date"
                  name="projectStartDate"
                  value={formData.projectStartDate}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project End Date
                </label>
                <input
                  type="date"
                  name="projectEndDate"
                  value={formData.projectEndDate}
                  onChange={handleInputChange}
                  min={formData.projectStartDate || undefined}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                />
                {formData.projectStartDate && formData.projectEndDate && 
                 new Date(formData.projectEndDate) < new Date(formData.projectStartDate) && (
                  <p className="mt-1 text-xs text-red-600">
                    End date cannot be before start date
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (Months)
                </label>
                <input
                  type="number"
                  name="projectDurationMonths"
                  value={formData.projectDurationMonths}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 bg-gray-50"
                  min="1"
                  placeholder="e.g., 24"
                  readOnly
                  title="Auto-calculated from start and end dates"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Auto-calculated from start and end dates
                </p>
              </div>
            </div>
          </section>
          
          {/* Section 6: Document Upload */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Document Upload
            </h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proposal Document (ZIP file) *
              </label>
              
              {/* Existing file display */}
              {existingProposalPath && !proposalFile && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Current Document</p>
                      <p className="text-xs text-gray-500">{existingProposalPath.split('/').pop()}</p>
                    </div>
                  </div>
                  <a
                    href={getFileUrl(existingProposalPath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    View
                  </a>
                </div>
              )}
              
              {/* File upload input */}
              <div className="mt-2">
                <input
                  type="file"
                  accept=".zip"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 50 * 1024 * 1024) { // 50MB limit
                        setError('File size must be less than 50MB');
                        e.target.value = '';
                        return;
                      }
                      setProposalFile(file);
                      setError(null);
                    }
                  }}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-orange-50 file:text-orange-700
                    hover:file:bg-orange-100
                    cursor-pointer"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Upload a ZIP file containing all project documents (Max 50MB)
                  {existingProposalPath && '. Uploading a new file will replace the existing one.'}
                </p>
              </div>
              
              {/* Selected file display */}
              {proposalFile && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{proposalFile.name}</p>
                      <p className="text-xs text-gray-500">{(proposalFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProposalFile(null)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </section>
          
          {/* Section 7: School & Department - Auto-filled from user profile */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Institutional Information
            </h2>
            <p className="text-sm text-gray-600 italic">
              Auto-filled from your profile
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  School/Faculty *
                </label>
                <input
                  type="text"
                  value={schools.find(s => s.id === formData.schoolId)?.facultyName || 'Not set'}
                  readOnly
                  className="w-full rounded-lg border-gray-300 bg-gray-50 shadow-sm cursor-not-allowed text-gray-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={departments.find(d => d.id === formData.departmentId)?.departmentName || 'Not set'}
                  readOnly
                  className="w-full rounded-lg border-gray-300 bg-gray-50 shadow-sm cursor-not-allowed text-gray-600"
                />
              </div>
            </div>
          </section>
          
          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-6 border-t">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>
            
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Application
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
