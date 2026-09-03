'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, Edit2, Check, User, Users, Building2 } from 'lucide-react';
import { researchService } from '@/features/research-management/services/research.service';
import { useAuthStore } from '@/shared/auth/authStore';
import { useAffiliation } from '@/shared/hooks/useAffiliation';
import { logger } from '@/shared/utils/logger';

type InvestigatorRole = 'pi' | 'co_pi';

interface Investigator {
  uid?: string;
  name: string;
  investigatorType: 'Faculty' | 'Student';
  investigatorCategory: 'Internal' | 'External';
  roleType: InvestigatorRole;
  email?: string;
  affiliation: string;
  designation?: string;
  department?: string;
  consortiumOrgId?: string;
  consortiumOrgName?: string;
  isTeamCoordinator?: boolean;
}

interface ConsortiumOrganization {
  id: string;
  organizationName: string;
  country: string;
  numberOfMembers: number;
  addedMembers?: number;
}

interface InvestigatorManagerProps {
  investigators: Investigator[];
  onChange: (investigators: Investigator[]) => void;
  disabled?: boolean;
  label?: string;
  consortiumOrganizations?: ConsortiumOrganization[];
  totalInvestigators: number;
  numberOfInternalPIs: number;
  numberOfInternalCoPIs: number;
  isPIExternal: boolean;
  currentUserRole: InvestigatorRole;
}

const ROLE_LABELS: Record<InvestigatorRole, string> = {
  pi: 'Principal Investigator (PI)',
  co_pi: 'Co-Principal Investigator (Co-PI)',
};

export default function InvestigatorManager({ 
  investigators, 
  onChange, 
  disabled = false, 
  label = 'Team Members',
  consortiumOrganizations = [],
  totalInvestigators,
  numberOfInternalPIs,
  numberOfInternalCoPIs,
  isPIExternal,
  currentUserRole
}: InvestigatorManagerProps) {
  const { user } = useAuthStore();
  const { canonicalName: universityName } = useAffiliation();
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newInvestigator, setNewInvestigator] = useState<Investigator>({
    name: '',
    investigatorType: 'Faculty',
    investigatorCategory: 'Internal',
    roleType: 'co_pi',
    affiliation: universityName,
    email: ''
  });
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keep the "Internal" default affiliation in sync once the dynamically
  // generated university name has loaded.
  useEffect(() => {
    setNewInvestigator((prev) =>
      prev.investigatorCategory === 'Internal' ? { ...prev, affiliation: universityName } : prev
    );
  }, [universityName]);

  // Auto-switch to External category when internal limit is reached
  // And set role to PI if external investigator must be PI
  useEffect(() => {
    if (isInternalLimitReached() && newInvestigator.investigatorCategory ===
   'Internal') {
      const mustBePI = mustExternalBePI();
      setNewInvestigator(prev => ({
        ...prev,
        investigatorCategory: 'External',
        affiliation: '',
        uid: undefined,
        roleType: mustBePI ? 'pi' : 'co_pi'
      }));
    }
  }, [investigators.length, numberOfInternalPIs]);

  // Calculate how many members have been added to each consortium org
  const getConsortiumMemberCount = (orgId: string) => {
    return investigators.filter(inv => inv.consortiumOrgId ===
   orgId).length;
  };

  // Calculate how many internal investigators have been added (including the user)
  const getInternalInvestigatorCount = () => {
    const teamInternalCount = investigators.filter(inv => inv.investigatorCategory ===
   'Internal').length;
    return teamInternalCount + 1; // +1 for the user (applicant)
  };

  // Check if internal investigators limit has been reached
  const isInternalLimitReached = () => {
    return getInternalInvestigatorCount() >= numberOfInternalPIs;
  };

  // Calculate if external investigator must be PI (only 1 external slot and PI is external)
  const mustExternalBePI = () => {
    if (!isPIExternal) return false;
    const totalExternal = totalInvestigators - numberOfInternalPIs;
    const addedExternal = investigators.filter(inv => inv.investigatorCategory ===
   'External').length;
    // If there's only 1 external slot total and no external PI has been added yet
    return totalExternal ===
   1 && addedExternal ===
   0;
  };

  // Get available roles based on current configuration
  const getAvailableRoles = (category: 'Internal' | 'External'): InvestigatorRole[] => {
    const roles: InvestigatorRole[] = [];
    
    // Check if PI slot is available
    const hasPIAdded = investigators.some(inv => inv.roleType ===
   'pi');
    const userIsPI = currentUserRole ===
   'pi';
    
    // PI role availability:
    // 1. If PI is external: Only external members can be PI
    // 2. If PI is not external: Only internal members can be PI (unless user is already PI)
    // 3. Only ONE PI allowed total
    if (!hasPIAdded && !userIsPI) {
      if (isPIExternal && category ===
   'External') {
        roles.push('pi');
      } else if (!isPIExternal && category ===
   'Internal') {
        roles.push('pi');
      }
    }
    
    // Co-PI is always available for both internal and external members
    roles.push('co_pi');
    
    return roles;
  };

  const searchInvestigators = async (term: string) => {
    if (term.length < 3) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      let userData = [];
      
      // Check if input is numeric (UID search)
      const isNumeric = /^\d+$/.test(term);
      logger.debug('Searching for term:', term, 'isNumeric:', isNumeric);
      
      // Use searchUsers API for both numeric and text searches
      // It handles both UID and name searches
      const role = newInvestigator.investigatorType ===
   'Student' ? 'student' : 'faculty';
      logger.debug('Searching with role:', role);
      
      const response = await researchService.searchUsers(term, role);
      logger.debug('Search response:', response);
      
      if (response?.data && Array.isArray(response.data)) {
        userData = response.data;
      } else if (response?.users && Array.isArray(response.users)) {
        userData = response.users;
      } else if (Array.isArray(response)) {
        userData = response;
      }

      logger.debug('Final userData:', userData);
      if (userData.length > 0) {
        setSearchSuggestions(userData);
        setShowSuggestions(true);
      } else {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      logger.error('Search error:', error);
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectInvestigatorFromSuggestion = async (userData: any) => {
    if (userData.uid ===
   user?.uid) {
      setError('Cannot add yourself as a team member');
      return;
    }

    const userName = userData.name || userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
    const roleName = typeof userData.role ===
   'object' ? userData.role?.name : userData.role;
    const investigatorType = roleName ===
   'student' ? 'Student' : 'Faculty';

    try {
      const fullData = await researchService.lookupByRegistration(userData.uid);
      const fullUser = fullData.data || fullData;
      
      let userEmail = fullUser?.email || fullUser?.employeeDetails?.email || fullUser?.studentProfile?.email || '';

      setNewInvestigator({
        uid: userData.uid,
        name: userName,
        investigatorType: investigatorType,
        investigatorCategory: 'Internal',
        roleType: newInvestigator.roleType,
        email: userEmail,
        affiliation: universityName,
        designation: userData.designation || '',
        department: userData.department || ''
      });

      setSearchTerm(userName);
      setShowSuggestions(false);
      setSearchSuggestions([]);
    } catch (error) {
      logger.error('Error fetching investigator details:', error);
    }
  };

  const addInvestigator = () => {
    setError('');

    if (!newInvestigator.name.trim()) {
      setError('Name is required');
      return;
    }

    if (newInvestigator.investigatorCategory ===
   'Internal' && !newInvestigator.uid) {
      setError('Please select an internal member from search results');
      return;
    }

    if (newInvestigator.investigatorCategory ===
   'External') {
      if (!newInvestigator.affiliation.trim()) {
        setError('Affiliation is required for external members');
        return;
      }
      
      // For external investigators, consortium org is required for international projects
      if (consortiumOrganizations.length > 0 && !newInvestigator.consortiumOrgId) {
        setError('Please select the consortium organization for this external member');
        return;
      }
      
      // Check member limit for consortium org
      if (newInvestigator.consortiumOrgId) {
        const org = consortiumOrganizations.find(o => o.id ===
   newInvestigator.consortiumOrgId);
        if (org) {
          const currentCount = getConsortiumMemberCount(org.id);
          if (currentCount >= org.numberOfMembers) {
            setError(`Maximum ${org.numberOfMembers} members allowed for ${org.organizationName}`);
            return;
          }
        }
      }
    }

    // Check for duplicates
    if (investigators.some(inv => inv.uid && inv.uid ===
   newInvestigator.uid)) {
      setError('This member has already been added');
      return;
    }

    // Validate PI uniqueness (check both team members and current user)
    const userIsPI = currentUserRole ===
   'pi';
    const teamHasPI = investigators.some(inv => inv.roleType ===
   'pi');
    
    if (newInvestigator.roleType ===
   'pi') {
      if (userIsPI) {
        setError('Only one Principal Investigator is allowed. You are already the PI.');
        return;
      }
      if (teamHasPI) {
        setError('Only one Principal Investigator is allowed');
        return;
      }
    }

    // Add consortium org name for display
    if (newInvestigator.consortiumOrgId) {
      const org = consortiumOrganizations.find(o => o.id ===
   newInvestigator.consortiumOrgId);
      newInvestigator.consortiumOrgName = org?.organizationName;
    }

    onChange([...investigators, { ...newInvestigator }]);

    // Reset form
    setNewInvestigator({
      name: '',
      investigatorType: 'Faculty',
      investigatorCategory: 'Internal',
      roleType: 'co_pi',
      affiliation: universityName,
      email: ''
    });
    setSearchTerm('');
    setSearchSuggestions([]);
    setShowSuggestions(false);
  };

  const removeInvestigator = (index: number) => {
    onChange(investigators.filter((_, i) => i !== index));
  };

  const toggleTeamCoordinator = (index: number) => {
    const updated = [...investigators];
    const inv = updated[index];
    
    // Only one coordinator per organization
    if (!inv.isTeamCoordinator && inv.consortiumOrgId) {
      updated.forEach((i, idx) => {
        if (i.consortiumOrgId ===
   inv.consortiumOrgId) {
          updated[idx] = { ...i, isTeamCoordinator: idx ===
   index };
        }
      });
    } else {
      updated[index] = { ...inv, isTeamCoordinator: !inv.isTeamCoordinator };
    }
    
    onChange(updated);
  };

  // Get available roles based on currently selected category
  const availableRoles = getAvailableRoles(newInvestigator.investigatorCategory);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        {!isEditing && !disabled && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-sm text-[#7d1a34] hover:text-[#5e1024] font-medium flex items-center gap-1"
          >
            <Edit2 className="w-4 h-4" />
            {investigators.length > 0 ? 'Edit' : 'Add'} Team Members
          </button>
        )}
      </div>

      {/* Display current investigators */}
      {investigators.length > 0 && (
        <div className="space-y-2">
          {investigators.map((investigator, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  investigator.investigatorCategory ===
   'Internal' ? 'bg-green-100' : 'bg-[#fbe2e8]'
                }`}>
                  {investigator.investigatorCategory ===
   'Internal' ? (
                    <User className="w-5 h-5 text-green-600" />
                  ) : (
                    <Building2 className="w-5 h-5 text-[#7d1a34]" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{investigator.name}</span>
                    {investigator.uid && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">({investigator.uid})</span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      investigator.roleType ===
   'pi' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                      investigator.roleType ===
   'co_pi' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                      'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                    }`}>
                      {ROLE_LABELS[investigator.roleType]}
                    </span>
                    {investigator.isTeamCoordinator && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                        Coordinator
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      investigator.investigatorCategory ===
   'Internal' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-[#fbe2e8] dark:bg-[#7d1a34]/20 text-[#7d1a34] dark:text-[#c8973f]'
                    }`}>
                      {investigator.investigatorCategory}
                    </span>
                    <span>•</span>
                    <span>{investigator.investigatorType}</span>
                    {investigator.consortiumOrgName && (
                      <>
                        <span>•</span>
                        <span className="text-[#7d1a34]">{investigator.consortiumOrgName}</span>
                      </>
                    )}
                    {investigator.affiliation !== universityName && !investigator.consortiumOrgName && (
                      <>
                        <span>•</span>
                        <span>{investigator.affiliation}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {isEditing && (
                <div className="flex items-center gap-2">
                  {investigator.investigatorCategory ===
   'External' && investigator.consortiumOrgId && (
                    <button
                      type="button"
                      onClick={() => toggleTeamCoordinator(index)}
                      className={`px-2 py-1 text-xs rounded ${
                        investigator.isTeamCoordinator 
                          ? 'bg-yellow-100 text-yellow-700' 
                          : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white0'
                      }`}
                    >
                      {investigator.isTeamCoordinator ? 'Coordinator ✓' : 'Set Coordinator'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeInvestigator(index)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {investigators.length ===
   0 && !isEditing && (
        <div className="text-center py-6 bg-white dark:bg-gray-700/50 rounded-lg border border-dashed border-[#f0e2d2] dark:border-gray-600">
          <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No team members added yet</p>
        </div>
      )}

      {/* Add investigator form */}
      {isEditing && !disabled && (
        <div className="p-4 bg-[#fdf5ec]/40 dark:bg-indigo-900/20 rounded-lg border border-[#f0e2d2] dark:border-indigo-800 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role *</label>
              <select
                value={newInvestigator.roleType}
                onChange={(e) => setNewInvestigator({ ...newInvestigator, roleType: e.target.value as InvestigatorRole })}
                className="w-full rounded-md border-[#f0e2d2] dark:border-gray-600 shadow-sm focus:border-[#7d1a34] focus:ring-[#7d1a34] focus:border-[#7d1a34] dark:bg-gray-700 dark:text-gray-100"
                disabled={newInvestigator.investigatorCategory ===
   'External' && mustExternalBePI()}
              >
                {availableRoles.map(role => (
                  <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                ))}
              </select>
              {newInvestigator.investigatorCategory ===
   'External' && mustExternalBePI() && (
                <p className="mt-1 text-xs text-[#7d1a34]">
                  Only 1 external investigator - must be PI
                </p>
              )}
            </div>

            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
              <select
                value={newInvestigator.investigatorCategory}
                onChange={(e) => {
                  const category = e.target.value as 'Internal' | 'External';
                  const rolesForCategory = getAvailableRoles(category);
                  
                  // If external and must be PI, set to PI; otherwise preserve or pick first available
                  let newRoleType: InvestigatorRole;
                  if (category ===
   'External' && mustExternalBePI()) {
                    newRoleType = 'pi';
                  } else if (rolesForCategory.includes(newInvestigator.roleType)) {
                    newRoleType = newInvestigator.roleType;
                  } else {
                    newRoleType = rolesForCategory.length > 0 ? rolesForCategory[0] : 'co_pi';
                  }
                  
                  setNewInvestigator({
                    ...newInvestigator,
                    investigatorCategory: category,
                    affiliation: category ===
   'Internal' ? universityName : '',
                    uid: category ===
   'External' ? undefined : newInvestigator.uid,
                    consortiumOrgId: undefined,
                    consortiumOrgName: undefined,
                    roleType: newRoleType
                  });
                  setSearchTerm('');
                }}
                className="w-full rounded-md border-[#f0e2d2] dark:border-gray-600 shadow-sm focus:border-[#7d1a34] focus:ring-[#7d1a34] focus:border-[#7d1a34] dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="Internal" disabled={isInternalLimitReached()}>
                  Internal ({universityName}) {isInternalLimitReached() ? '(Limit Reached)' : ''}
                </option>
                <option value="External">External</option>
              </select>
              {isInternalLimitReached() && (
                <p className="mt-1 text-xs text-red-600">
                  Maximum {numberOfInternalPIs} internal investigators reached
                </p>
              )}
            </div>

            {/* Type Selection - Faculty/Employee only for grants */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
              <select
                value={newInvestigator.investigatorType}
                onChange={(e) => setNewInvestigator({ ...newInvestigator, investigatorType: e.target.value as 'Faculty' })}
                className="w-full rounded-md border-[#f0e2d2] dark:border-gray-600 shadow-sm focus:border-[#7d1a34] focus:ring-[#7d1a34] focus:border-[#7d1a34] dark:bg-gray-700 dark:text-gray-100"
                disabled
              >
                <option value="Faculty">Faculty/Employee</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Grant applications are for Faculty/Employees only</p>
            </div>
          </div>

          {newInvestigator.investigatorCategory ===
   'Internal' ? (
            <div ref={searchRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search by UID/Name *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    searchInvestigators(e.target.value);
                  }}
                  placeholder="Type to search..."
                  className="w-full pl-10 rounded-md border-[#f0e2d2] dark:border-gray-600 shadow-sm focus:border-[#7d1a34] focus:ring-[#7d1a34] focus:border-[#7d1a34] dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
              
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 max-h-60 overflow-y-auto">
                  {searchSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectInvestigatorFromSuggestion(suggestion)}
                      className="w-full px-4 py-2 text-left hover:bg-white dark:hover:bg-gray-700 flex items-center gap-3 border-b dark:border-gray-700 last:border-b-0"
                    >
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {suggestion.name || suggestion.displayName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {suggestion.uid} • {suggestion.designation || suggestion.role}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Consortium Organization Selection (for international projects) */}
              {consortiumOrganizations.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Consortium Organization *</label>
                  <select
                    value={newInvestigator.consortiumOrgId || ''}
                    onChange={(e) => {
                      const orgId = e.target.value;
                      const org = consortiumOrganizations.find(o => o.id ===
   orgId);
                      setNewInvestigator({
                        ...newInvestigator,
                        consortiumOrgId: orgId,
                        consortiumOrgName: org?.organizationName,
                        affiliation: org?.organizationName || ''
                      });
                    }}
                    className="w-full rounded-md border-[#f0e2d2] dark:border-gray-600 shadow-sm focus:border-[#7d1a34] focus:ring-[#7d1a34] focus:border-[#7d1a34] dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="">Select Organization</option>
                    {consortiumOrganizations.map(org => {
                      const currentCount = getConsortiumMemberCount(org.id);
                      const isFull = currentCount >= org.numberOfMembers;
                      return (
                        <option key={org.id} value={org.id} disabled={isFull}>
                          {org.organizationName} ({org.country}) - {currentCount}/{org.numberOfMembers} members
                          {isFull && ' (Full)'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newInvestigator.name}
                    onChange={(e) => setNewInvestigator({ ...newInvestigator, name: e.target.value })}
                    className="w-full rounded-md border-[#f0e2d2] dark:border-gray-600 shadow-sm focus:border-[#7d1a34] focus:ring-[#7d1a34] focus:border-[#7d1a34] dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={newInvestigator.email || ''}
                    onChange={(e) => setNewInvestigator({ ...newInvestigator, email: e.target.value })}
                    className="w-full rounded-md border-[#f0e2d2] dark:border-gray-600 shadow-sm focus:border-[#7d1a34] focus:ring-[#7d1a34] focus:border-[#7d1a34] dark:bg-gray-700 dark:text-gray-100"
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Designation</label>
                  <input
                    type="text"
                    value={newInvestigator.designation || ''}
                    onChange={(e) => setNewInvestigator({ ...newInvestigator, designation: e.target.value })}
                    className="w-full rounded-md border-[#f0e2d2] dark:border-gray-600 shadow-sm focus:border-[#7d1a34] focus:ring-[#7d1a34] focus:border-[#7d1a34] dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Professor, Researcher, etc."
                  />
                </div>
                {!consortiumOrganizations.length && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Affiliation *</label>
                    <input
                      type="text"
                      value={newInvestigator.affiliation}
                      onChange={(e) => setNewInvestigator({ ...newInvestigator, affiliation: e.target.value })}
                      className="w-full rounded-md border-[#f0e2d2] dark:border-gray-600 shadow-sm focus:border-[#7d1a34] focus:ring-[#7d1a34] focus:border-[#7d1a34] dark:bg-gray-700 dark:text-gray-100"
                      placeholder="University/Organization"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={addInvestigator}
              className="flex-1 px-4 py-2 bg-[#7d1a34] text-white rounded-lg hover:bg-[#5e1024] flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Team Member
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setNewInvestigator({
                  name: '',
                  investigatorType: 'Faculty',
                  investigatorCategory: 'Internal',
                  roleType: 'co_pi',
                  affiliation: universityName,
                  email: ''
                });
                setSearchTerm('');
                setError('');
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-white0 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
