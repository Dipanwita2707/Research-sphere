'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResearchTrackerStatus } from '@/features/research-management/services/progressTracker.service';
import { researchService } from '@/features/research-management/services/research.service';
import { X, Search, AlertCircle } from 'lucide-react';
import logger from '@/shared/utils/logger';

interface CoAuthor {
  uid?: string;
  name: string;
  authorType: 'Faculty' | 'Student' | 'Academic' | 'Industry' | 'International Author';
  authorCategory: 'Internal' | 'External';
  authorRole: string;
  email?: string;
  affiliation: string;
  designation?: string;
}

interface ResearchPaperStatusFormProps {
  status: ResearchTrackerStatus;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export default function ResearchPaperStatusForm({ status, data, onChange }: ResearchPaperStatusFormProps) {
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>((data.coAuthors as CoAuthor[]) || []);
  const [newAuthor, setNewAuthor] = useState<CoAuthor>({
    name: '',
    authorType: 'Faculty',
    authorCategory: 'Internal',
    authorRole: 'co_author',
    affiliation: 'SGT University',
    email: '',
    uid: '',
    designation: '',
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleChange = (field: string, value: unknown) => {
    onChange({ ...data, [field]: value });
  };

  // Update coAuthors in parent data when it changes
  useEffect(() => {
    if (JSON.stringify(coAuthors) !== JSON.stringify(data.coAuthors)) {
      handleChange('coAuthors', coAuthors);
    }
  }, [coAuthors]);

  // Get indexing categories from data (with backwards compatibility for old targetedResearchType)
  const getIndexingCategories = (): string[] => {
    if (data.indexingCategories && Array.isArray(data.indexingCategories)) {
      return data.indexingCategories as string[];
    }
    // Backwards compatibility: convert old targetedResearchType to indexingCategories
    const tr = data.targetedResearchType as string;
    if (tr === 'scopus') return ['scopus'];
    if (tr === 'sci_scie' || tr === 'wos') return ['scie_wos'];
    if (tr === 'both') return ['scopus', 'scie_wos'];
    return [];
  };

  const indexingCategories = getIndexingCategories();

  // Search for internal SGT users
  const handleSearch = useCallback(async (query: string) => {
    setSearchTerm(query);
    setNewAuthor(prev => ({ ...prev, name: query }));
    
    if (query.length < 2 || newAuthor.authorCategory === 'External') {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await researchService.searchUsers(query);
      setSearchSuggestions(response.data || []);
      setShowSuggestions(true);
    } catch (error) {
      logger.error('Error searching users:', error);
    }
  }, [newAuthor.authorCategory]);

  const selectUser = async (userData: any) => {
    try {
      const authorType = userData.type === 'employee' ? 'Faculty' : 'Student';
      const userName = userData.displayName || userData.name;
      
      const fullData = await researchService.lookupByRegistration(userData.uid);
      const fullUser = fullData.data || fullData;
      const userEmail = fullUser?.email || fullUser?.employeeDetails?.email || fullUser?.studentProfile?.email || '';

      setNewAuthor({
        ...newAuthor,
        uid: userData.uid,
        name: userName,
        authorType: authorType,
        email: userEmail,
        designation: userData.designation || '',
      });

      setSearchTerm(userName);
      setShowSuggestions(false);
      setSearchSuggestions([]);
    } catch (error) {
      logger.error('Error fetching author details:', error);
    }
  };

  const validateAuthor = (): string | null => {
    if (!newAuthor.name.trim()) {
      return 'Author name is required';
    }

    // Check for duplicate
    if (editingIndex === null && coAuthors.some(a => a.name.toLowerCase() === newAuthor.name.toLowerCase())) {
      return 'This author has already been added';
    }

    const totalAuthors = (data.totalAuthors as number) || 1;
    const sgtAuthors = (data.sgtAuthors as number) || 1;
    const internalCoAuthors = (data.internalCoAuthors as number) || 0;

    if (newAuthor.authorCategory === 'Internal') {
      const internalAdded = coAuthors.filter(a => a.authorCategory === 'Internal').length;
      const maxInternal = sgtAuthors - 1; // Exclude current user
      
      if (editingIndex === null && internalAdded >= maxInternal) {
        return `You can only add ${maxInternal} internal author(s). You've already added ${internalAdded}.`;
      }

      // Check internal co-author limit
      if (newAuthor.authorRole === 'co_author') {
        const internalCoAuthorsAdded = coAuthors.filter(a => a.authorCategory === 'Internal' && a.authorRole === 'co_author').length;
        if (editingIndex === null && internalCoAuthorsAdded >= internalCoAuthors) {
          return `You can only add ${internalCoAuthors} internal co-author(s). You've already added ${internalCoAuthorsAdded}.`;
        }
      }
    } else {
      const externalAdded = coAuthors.filter(a => a.authorCategory === 'External').length;
      const maxExternal = totalAuthors - sgtAuthors;
      
      if (editingIndex === null && externalAdded >= maxExternal) {
        return `You can only add ${maxExternal} external author(s). You've already added ${externalAdded}.`;
      }
    }

    if (newAuthor.authorCategory === 'Internal' && !newAuthor.uid) {
      return 'Please select an internal author from the search results';
    }

    if (newAuthor.authorCategory === 'External' && !newAuthor.email) {
      return 'Email is required for external authors';
    }

    return null;
  };

  const addOrUpdateAuthor = () => {
    setError('');
    const validationError = validateAuthor();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (editingIndex !== null) {
      const updated = [...coAuthors];
      updated[editingIndex] = newAuthor;
      setCoAuthors(updated);
      setEditingIndex(null);
    } else {
      setCoAuthors([...coAuthors, newAuthor]);
    }

    resetForm();
  };

  const resetForm = () => {
    setNewAuthor({
      name: '',
      authorType: 'Faculty',
      authorCategory: 'Internal',
      authorRole: 'co_author',
      affiliation: 'SGT University',
      email: '',
      uid: '',
      designation: '',
    });
    setSearchTerm('');
    setShowAddForm(false);
    setError('');
  };

  const removeAuthor = (index: number) => {
    setCoAuthors(coAuthors.filter((_, i) => i !== index));
  };

  const editAuthor = (index: number) => {
    setNewAuthor(coAuthors[index]);
    setSearchTerm(coAuthors[index].name);
    setEditingIndex(index);
    setShowAddForm(true);
  };

  const getAvailableRoles = () => {
    const totalAuthors = (data.totalAuthors as number) || 1;
    const sgtAuthors = (data.sgtAuthors as number) || 1;
    const internalCoAuthors = (data.internalCoAuthors as number) || 0;

    // Get roles already taken by existing co-authors
    const usedRoles: string[] = [];
    coAuthors.forEach((author, idx) => {
      if (author.name && idx !== editingIndex) {
        if (author.authorRole === 'first_author' || author.authorRole === 'first') {
          usedRoles.push('first_author');
        } else if (author.authorRole === 'corresponding_author' || author.authorRole === 'corresponding') {
          usedRoles.push('corresponding_author');
        } else if (author.authorRole === 'first_and_corresponding' || author.authorRole === 'first_and_corresponding_author') {
          usedRoles.push('first_author');
          usedRoles.push('corresponding_author');
        }
      }
    });

    // Check user's role from userRole field in data
    const userRole = (data.userRole as string) || '';
    if (userRole === 'first_and_corresponding' || userRole === 'first_and_corresponding_author') {
      usedRoles.push('first_author');
      usedRoles.push('corresponding_author');
    } else if (userRole === 'first' || userRole === 'first_author') {
      usedRoles.push('first_author');
    } else if (userRole === 'corresponding' || userRole === 'corresponding_author') {
      usedRoles.push('corresponding_author');
    }

    // RULE 1: Solo author (Total=1, Internal=1, Co-Authors=0) -> No other authors to add
    // This shouldn't show the add form at all, but if it does, return empty
    if (totalAuthors === 1 && sgtAuthors === 1 && internalCoAuthors === 0) {
      return [];
    }

    // RULE 2: All internal authors are co-authors (sgtAuthors = internalCoAuthors + 1)
    // This means the user is NOT a co-author, so all OTHER internal authors MUST be co-authors
    if (newAuthor.authorCategory === 'Internal' && sgtAuthors === internalCoAuthors + 1) {
      return [
        { value: 'co_author', label: 'Co-Author' },
      ];
    }

    // RULE 3: Internal Co-Authors = 0, meaning NO co-authors allowed among internal authors
    // The other internal author must be First or Corresponding (whichever isn't taken)
    if (newAuthor.authorCategory === 'Internal' && internalCoAuthors === 0 && sgtAuthors > 1) {
      const roles = [];
      
      // Check if First & Corresponding combined is available
      if (!usedRoles.includes('first_author') && !usedRoles.includes('corresponding_author')) {
        roles.push({ value: 'first_and_corresponding', label: 'First and Corresponding Author' });
      }
      
      // Check individual roles
      if (!usedRoles.includes('first_author')) {
        roles.push({ value: 'first', label: 'First Author' });
      }
      if (!usedRoles.includes('corresponding_author')) {
        roles.push({ value: 'corresponding', label: 'Corresponding Author' });
      }
      
      return roles.length > 0 ? roles : [{ value: 'co_author', label: 'Co-Author' }];
    }

    // RULE 4: Two total authors - special handling
    if (totalAuthors === 2) {
      // If user is co-author, other must be First & Corresponding
      if (userRole === 'co_author' || userRole === 'co') {
        return [
          { value: 'first_and_corresponding', label: 'First and Corresponding Author' },
        ];
      }
      // If user is First/Corresponding, other must be co-author
      if (userRole && userRole !== 'co_author' && userRole !== 'co') {
        return [
          { value: 'co_author', label: 'Co-Author' },
        ];
      }
    }

    // DEFAULT: Flexible scenarios - build available roles dynamically
    const allRoles = [
      { value: 'first_and_corresponding', label: 'First and Corresponding Author' },
      { value: 'first', label: 'First Author' },
      { value: 'corresponding', label: 'Corresponding Author' },
      { value: 'co_author', label: 'Co-Author' },
    ];

    // Filter out roles that are already used
    return allRoles.filter(role => {
      // Co-author can be used multiple times
      if (role.value === 'co_author') {
        return true;
      }
      // First and Corresponding Author - can use if neither role is taken
      if (role.value === 'first_and_corresponding') {
        return !usedRoles.includes('first_author') && !usedRoles.includes('corresponding_author');
      }
      // First author and corresponding author can only be used once
      return !usedRoles.includes(role.value === 'first' ? 'first_author' : 'corresponding_author');
    });
  };

  // Render Add Other Authors section
  const renderAddOtherAuthorsSection = () => {
    if (((data.totalAuthors as number) || 1) <= 1) return null;

    return (
      <div className="mt-4 border border-orange-300 bg-orange-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900">
            Add Other Authors {editingIndex !== null && <span className="text-xs text-blue-600">(Editing)</span>}
          </h4>
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 transition-colors"
            >
              + Add Author
            </button>
          )}
        </div>

        {/* Author Count Summary */}
        <p className="text-xs text-gray-600 mb-3">
          {(() => {
            const totalAuthors = (data.totalAuthors as number) || 1;
            const sgtAuthors = (data.sgtAuthors as number) || 1;
            const internalAdded = coAuthors.filter(a => a.authorCategory === 'Internal').length;
            const externalAdded = coAuthors.filter(a => a.authorCategory === 'External').length;
            const maxInternal = sgtAuthors - 1;
            const maxExternal = totalAuthors - sgtAuthors;

            const parts = [];
            if (maxInternal > 0) {
              parts.push(`${maxInternal} SGT author(s) [${internalAdded} added]`);
            }
            if (maxExternal > 0) {
              parts.push(`${maxExternal} external author(s) [${externalAdded} added]`);
            }

            if (parts.length === 0) {
              return 'You are the only author.';
            }

            return `You need to add ${parts.join(' and ')}.`;
          })()}
        </p>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Add Author Form */}
        {showAddForm && (
          <div className="space-y-3 mb-4 p-3 bg-white rounded-lg border border-gray-200">
            <div className="grid grid-cols-2 gap-3">
              {/* Author Category */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                <div className="flex gap-4">
                  {(() => {
                    const totalAuthors = (data.totalAuthors as number) || 1;
                    const sgtAuthors = (data.sgtAuthors as number) || 1;
                    const internalAdded = coAuthors.filter(a => a.authorCategory === 'Internal').length;
                    const externalAdded = coAuthors.filter(a => a.authorCategory === 'External').length;
                    const maxInternal = sgtAuthors - 1;
                    const maxExternal = totalAuthors - sgtAuthors;
                    const internalSlotsFull = internalAdded >= maxInternal;
                    const externalSlotsFull = externalAdded >= maxExternal;
                    const allInternal = totalAuthors === sgtAuthors;

                    return (
                      <>
                        {!allInternal && (maxInternal > 0 || !internalSlotsFull) && (
                          <label className="inline-flex items-center text-xs cursor-pointer">
                            <input
                              type="radio"
                              value="Internal"
                              checked={newAuthor.authorCategory === 'Internal'}
                              onChange={(e) => {
                                setNewAuthor({
                                  ...newAuthor,
                                  authorCategory: 'Internal',
                                  authorType: 'Faculty',
                                  affiliation: 'SGT University',
                                });
                                setSearchTerm('');
                              }}
                              disabled={internalSlotsFull}
                              className="w-3 h-3 text-emerald-600"
                            />
                            <span className="ml-1.5">Internal (SGT) {internalSlotsFull && <span className="text-red-600">(Full)</span>}</span>
                          </label>
                        )}
                        {!allInternal && maxExternal > 0 && (
                          <label className="inline-flex items-center text-xs cursor-pointer">
                            <input
                              type="radio"
                              value="External"
                              checked={newAuthor.authorCategory === 'External'}
                              onChange={(e) => {
                                setNewAuthor({
                                  ...newAuthor,
                                  authorCategory: 'External',
                                  authorType: 'Academic',
                                  affiliation: '',
                                  uid: '',
                                });
                                setSearchTerm('');
                              }}
                              disabled={externalSlotsFull}
                              className="w-3 h-3 text-emerald-600"
                            />
                            <span className="ml-1.5">External {internalSlotsFull && <span className="text-green-600">(Auto-selected)</span>}</span>
                          </label>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Author Type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                <select
                  value={newAuthor.authorType}
                  onChange={(e) => setNewAuthor(prev => ({ ...prev, authorType: e.target.value as any }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-emerald-500"
                >
                  {newAuthor.authorCategory === 'Internal' ? (
                    <>
                      <option value="Faculty">Faculty</option>
                      <option value="Student">Student</option>
                    </>
                  ) : (
                    <>
                      <option value="Academic">Academic</option>
                      <option value="Industry">Industry</option>
                      <option value="International Author">International Author</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Author Name/Search */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
                {newAuthor.authorCategory === 'Internal' && <span className="text-xs text-gray-500 ml-1">(Search by name or UID)</span>}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full px-2 py-1.5 pr-8 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-emerald-500"
                  placeholder={newAuthor.authorCategory === 'Internal' ? 'Type to search SGT users...' : 'Enter full name'}
                />
                {newAuthor.authorCategory === 'Internal' && <Search className="absolute right-2 top-2 w-4 h-4 text-gray-400" />}
              </div>
              
              {/* Search Suggestions */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchSuggestions.map((user, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectUser(user)}
                      className="w-full px-3 py-2 text-left hover:bg-emerald-50 text-xs border-b border-gray-100 last:border-0"
                    >
                      <div className="font-medium text-gray-900">{user.displayName || user.name}</div>
                      <div className="text-gray-500">
                        {user.uid} • {user.type === 'employee' ? 'Faculty' : 'Student'}
                        {user.department && ` • ${user.department}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email {newAuthor.authorCategory === 'External' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="email"
                  value={newAuthor.email || ''}
                  onChange={(e) => setNewAuthor(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-emerald-500"
                  placeholder="email@example.com"
                  readOnly={newAuthor.authorCategory === 'Internal' && !!newAuthor.uid}
                />
              </div>

              {/* Affiliation */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Affiliation <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newAuthor.affiliation}
                  onChange={(e) => setNewAuthor(prev => ({ ...prev, affiliation: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-emerald-500"
                  placeholder="University/Organization"
                  readOnly={newAuthor.authorCategory === 'Internal'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Role */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                <select
                  value={newAuthor.authorRole}
                  onChange={(e) => setNewAuthor(prev => ({ ...prev, authorRole: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-emerald-500"
                >
                  {getAvailableRoles().map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
                {/* Role validation helper text */}
                {(() => {
                  const totalAuthors = (data.totalAuthors as number) || 1;
                  const sgtAuthors = (data.sgtAuthors as number) || 1;
                  const internalCoAuthors = (data.internalCoAuthors as number) || 0;
                  const userRole = (data.userRole as string) || '';
                  const availableRoles = getAvailableRoles();
                  
                  // Show rule explanations
                  if (newAuthor.authorCategory === 'Internal') {
                    if (sgtAuthors === internalCoAuthors + 1) {
                      return <p className="text-xs text-blue-600 mt-1">Rule: All other SGT authors must be Co-Authors</p>;
                    }
                    if (internalCoAuthors === 0 && sgtAuthors > 1) {
                      return <p className="text-xs text-blue-600 mt-1">Rule: No Co-Authors allowed - must be First or Corresponding</p>;
                    }
                    if (totalAuthors === 2 && userRole === 'co_author') {
                      return <p className="text-xs text-blue-600 mt-1">Rule: Must be First & Corresponding (2 authors total)</p>;
                    }
                  }
                  
                  if (availableRoles.length < 4) {
                    return <p className="text-xs text-gray-500 mt-1">Some roles are already assigned</p>;
                  }
                  return null;
                })()}
              </div>

              {/* Designation (Internal only) */}
              {newAuthor.authorCategory === 'Internal' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={newAuthor.designation || ''}
                    onChange={(e) => setNewAuthor(prev => ({ ...prev, designation: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-emerald-500"
                    placeholder="Professor, Assistant Professor, etc."
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={addOrUpdateAuthor}
                className="px-4 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 transition-colors"
              >
                {editingIndex !== null ? 'Update Author' : 'Add Author'}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setEditingIndex(null);
                }}
                className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Added Authors List */}
        {coAuthors.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-gray-700">Added Authors ({coAuthors.length})</h5>
            {coAuthors.map((author, index) => (
              <div key={index} className="flex items-start justify-between p-2 bg-white border border-gray-200 rounded text-xs">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{author.name}</div>
                  <div className="text-gray-600 mt-0.5">
                    <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded mr-1">{author.authorCategory}</span>
                    <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 rounded mr-1">{author.authorType}</span>
                    <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded">{author.authorRole.replace('_', ' ')}</span>
                  </div>
                  <div className="text-gray-500 mt-1">
                    {author.affiliation} {author.email && `• ${author.email}`}
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    type="button"
                    onClick={() => editAuthor(index)}
                    className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAuthor(index)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  switch (status) {
    case 'writing':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Writing Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={(data.writingStartDate as string) || ''}
                onChange={(e) => handleChange('writingStartDate', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="mm/dd/yyyy"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Journal</label>
              <input
                type="text"
                value={(data.targetJournal as string) || ''}
                onChange={(e) => handleChange('targetJournal', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Journal you're planning to submit to"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Progress Notes</label>
            <textarea
              value={(data.progressNotes as string) || ''}
              onChange={(e) => handleChange('progressNotes', e.target.value)}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Details about your writing progress, draft status, etc."
            />
            <p className="text-xs text-gray-500 mt-1">💡 Use the "Attach Documents" section below to upload your draft</p>
          </div>

          {/* Author Information */}
          <div className="space-y-4 border-t pt-4 mt-4">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2 -mx-6 mb-4">
              <h3 className="text-base font-semibold text-white">Author Information</h3>
            </div>
            
            <div className="p-4 bg-gradient-to-r from-gray-50 to-emerald-50 rounded-xl border border-gray-100 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Total Authors <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={(data.totalAuthors as number) || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      if (value < 1) return;
                      handleChange('totalAuthors', value);
                      // Adjust sgtAuthors if it exceeds new totalAuthors
                      const currentSgt = (data.sgtAuthors as number) || 1;
                      if (currentSgt > value) {
                        handleChange('sgtAuthors', value);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    SGT Authors <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={(data.totalAuthors as number) || 1}
                    value={(data.sgtAuthors as number) || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      const maxAllowed = (data.totalAuthors as number) || 1;
                      if (value < 1 || value > maxAllowed) return;
                      handleChange('sgtAuthors', value);
                      // Adjust internalCoAuthors if it exceeds max allowed
                      const maxCoAuthors = value - 1;
                      const currentCoAuthors = (data.internalCoAuthors as number) || 0;
                      if (currentCoAuthors > maxCoAuthors) {
                        handleChange('internalCoAuthors', maxCoAuthors);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Internal Co-Authors <span className="text-red-500">*</span>
                    <span className="text-gray-400 ml-1 font-normal">(Max: {((data.sgtAuthors as number) || 1) - 1})</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={((data.sgtAuthors as number) || 1) - 1}
                    value={(data.internalCoAuthors as number) ?? 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 0) {
                        handleChange('internalCoAuthors', 0);
                        return;
                      }
                      const maxCoAuthors = ((data.sgtAuthors as number) || 1) - 1;
                      if (value > maxCoAuthors) {
                        handleChange('internalCoAuthors', maxCoAuthors);
                        return;
                      }
                      handleChange('internalCoAuthors', value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Your Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={(data.userRole as string) || 'first_and_corresponding'}
                    onChange={(e) => handleChange('userRole', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="first_and_corresponding">First & Corresponding</option>
                    <option value="first">First Author</option>
                    <option value="corresponding">Corresponding</option>
                    <option value="co_author">Co-Author</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {((data.totalAuthors as number) || 0) > ((data.sgtAuthors as number) || 0) && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">
                        International Author <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-4">
                        {['yes', 'no'].map((v) => (
                          <label key={v} className="inline-flex items-center text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="hasInternationalAuthor"
                              value={v}
                              checked={(data.hasInternationalAuthor as string) === v}
                              onChange={(e) => handleChange('hasInternationalAuthor', e.target.value)}
                              className="w-4 h-4 text-emerald-600"
                            />
                            <span className="ml-1.5 capitalize text-gray-700">{v}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">
                      Student(s) from SGT <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      {['yes', 'no'].map((v) => (
                        <label key={v} className="inline-flex items-center text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="hasLpuStudents"
                            value={v}
                            checked={(data.hasLpuStudents as string) === v}
                            onChange={(e) => handleChange('hasLpuStudents', e.target.value)}
                            className="w-4 h-4 text-emerald-600"
                          />
                          <span className="ml-1.5 capitalize text-gray-700">{v}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {(data.hasInternationalAuthor as string) === 'yes' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">
                        Foreign Universities Collaborated:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={((data.totalAuthors as number) || 0) - ((data.sgtAuthors as number) || 0)}
                        value={(data.numForeignUniversities as number) || 0}
                        onChange={(e) => handleChange('numForeignUniversities', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Add Other Authors Section */}
          {renderAddOtherAuthorsSection()}
        </div>
      );

    case 'communicated':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Communication Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={(data.communicationDate as string) || ''}
                onChange={(e) => handleChange('communicationDate', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="mm/dd/yyyy"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Journal Details</label>
              <input
                type="text"
                value={(data.journalDetails as string) || ''}
                onChange={(e) => handleChange('journalDetails', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Journal you have submitted"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Manuscript ID (Optional)</label>
            <input
              type="text"
              value={(data.manuscriptId as string) || ''}
              onChange={(e) => handleChange('manuscriptId', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Journal assigned manuscript ID (if available)"
            />
            <p className="text-xs text-gray-500 mt-1">Enter if you received a manuscript ID during communication. This will auto-populate in submitted/accepted stages.</p>
          </div>
          
          {/* Communicated with Official ID */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Communicated with Official ID? <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                {['yes', 'no'].map((v) => (
                  <label key={v} className="inline-flex items-center text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="communicatedWithOfficialId"
                      value={v}
                      checked={(data.communicatedWithOfficialId as string) === v}
                      onChange={(e) => handleChange('communicatedWithOfficialId', e.target.value)}
                      className="w-4 h-4 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="ml-1.5 capitalize text-gray-700">{v}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Show email field if not communicated with official ID */}
            {(data.communicatedWithOfficialId as string) === 'no' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Email Used <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={(data.personalEmailUsed as string) || ''}
                  onChange={(e) => handleChange('personalEmailUsed', e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="your.email@example.com"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Enter the personal email address used for communication</p>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Progress Notes</label>
            <textarea
              value={(data.progressNotes as string) || ''}
              onChange={(e) => handleChange('progressNotes', e.target.value)}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Details about communication, preliminary discussions, etc."
            />
            <p className="text-xs text-gray-500 mt-1">💡 Use the "Attach Documents" section below to upload communication proof or correspondence</p>
          </div>

          {/* Author Information */}
          <div className="space-y-4 border-t pt-4 mt-4">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2 -mx-6 mb-4">
              <h3 className="text-base font-semibold text-white">Author Information</h3>
            </div>
            
            <div className="p-4 bg-gradient-to-r from-gray-50 to-emerald-50 rounded-xl border border-gray-100 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Total Authors <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={(data.totalAuthors as number) || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      if (value < 1) return;
                      handleChange('totalAuthors', value);
                      // Adjust sgtAuthors if it exceeds new totalAuthors
                      const currentSgt = (data.sgtAuthors as number) || 1;
                      if (currentSgt > value) {
                        handleChange('sgtAuthors', value);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    SGT Authors <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={(data.totalAuthors as number) || 1}
                    value={(data.sgtAuthors as number) || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      const maxAllowed = (data.totalAuthors as number) || 1;
                      if (value < 1 || value > maxAllowed) return;
                      handleChange('sgtAuthors', value);
                      // Adjust internalCoAuthors if it exceeds max allowed
                      const maxCoAuthors = value - 1;
                      const currentCoAuthors = (data.internalCoAuthors as number) || 0;
                      if (currentCoAuthors > maxCoAuthors) {
                        handleChange('internalCoAuthors', maxCoAuthors);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Internal Co-Authors <span className="text-red-500">*</span>
                    <span className="text-gray-400 ml-1 font-normal">(Max: {((data.sgtAuthors as number) || 1) - 1})</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={((data.sgtAuthors as number) || 1) - 1}
                    value={(data.internalCoAuthors as number) ?? 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 0) {
                        handleChange('internalCoAuthors', 0);
                        return;
                      }
                      const maxCoAuthors = ((data.sgtAuthors as number) || 1) - 1;
                      if (value > maxCoAuthors) {
                        handleChange('internalCoAuthors', maxCoAuthors);
                        return;
                      }
                      handleChange('internalCoAuthors', value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Your Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={(data.userRole as string) || 'first_and_corresponding'}
                    onChange={(e) => handleChange('userRole', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="first_and_corresponding">First & Corresponding</option>
                    <option value="first">First Author</option>
                    <option value="corresponding">Corresponding</option>
                    <option value="co_author">Co-Author</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {((data.totalAuthors as number) || 0) > ((data.sgtAuthors as number) || 0) && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">
                        International Author <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-4">
                        {['yes', 'no'].map((v) => (
                          <label key={v} className="inline-flex items-center text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="hasInternationalAuthor"
                              value={v}
                              checked={(data.hasInternationalAuthor as string) === v}
                              onChange={(e) => handleChange('hasInternationalAuthor', e.target.value)}
                              className="w-4 h-4 text-emerald-600"
                            />
                            <span className="ml-1.5 capitalize text-gray-700">{v}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">
                      Student(s) from SGT <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      {['yes', 'no'].map((v) => (
                        <label key={v} className="inline-flex items-center text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="hasLpuStudents"
                            value={v}
                            checked={(data.hasLpuStudents as string) === v}
                            onChange={(e) => handleChange('hasLpuStudents', e.target.value)}
                            className="w-4 h-4 text-emerald-600"
                          />
                          <span className="ml-1.5 capitalize text-gray-700">{v}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {(data.hasInternationalAuthor as string) === 'yes' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">
                        Foreign Universities Collaborated:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={((data.totalAuthors as number) || 0) - ((data.sgtAuthors as number) || 0)}
                        value={(data.numForeignUniversities as number) || 0}
                        onChange={(e) => handleChange('numForeignUniversities', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Add Other Authors Section */}
          {renderAddOtherAuthorsSection()}
        </div>
      );

    case 'submitted':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Submission Date</label>
              <input
                type="date"
                value={(data.submissionDate as string) || ''}
                onChange={(e) => handleChange('submissionDate', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manuscript ID</label>
              <input
                type="text"
                value={(data.manuscriptId as string) || ''}
                onChange={(e) => handleChange('manuscriptId', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Journal assigned manuscript ID"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Submission Portal/Link</label>
            <input
              type="url"
              value={(data.submissionPortal as string) || ''}
              onChange={(e) => handleChange('submissionPortal', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Progress Notes</label>
            <textarea
              value={(data.progressNotes as string) || ''}
              onChange={(e) => handleChange('progressNotes', e.target.value)}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Brief update on submission status..."
            />
            <p className="text-xs text-gray-500 mt-1">💡 Use the "Attach Documents" section below to upload submission confirmation</p>
          </div>

          {/* Author Information */}
          <div className="space-y-4 border-t pt-4 mt-4">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2 -mx-6 mb-4">
              <h3 className="text-base font-semibold text-white">Author Information</h3>
            </div>
            
            <div className="p-4 bg-gradient-to-r from-gray-50 to-emerald-50 rounded-xl border border-gray-100 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Total Authors <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={(data.totalAuthors as number) || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      if (value < 1) return;
                      handleChange('totalAuthors', value);
                      // Adjust sgtAuthors if it exceeds new totalAuthors
                      const currentSgt = (data.sgtAuthors as number) || 1;
                      if (currentSgt > value) {
                        handleChange('sgtAuthors', value);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    SGT Authors <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={(data.totalAuthors as number) || 1}
                    value={(data.sgtAuthors as number) || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      const maxAllowed = (data.totalAuthors as number) || 1;
                      if (value < 1 || value > maxAllowed) return;
                      handleChange('sgtAuthors', value);
                      // Adjust internalCoAuthors if it exceeds max allowed
                      const maxCoAuthors = value - 1;
                      const currentCoAuthors = (data.internalCoAuthors as number) || 0;
                      if (currentCoAuthors > maxCoAuthors) {
                        handleChange('internalCoAuthors', maxCoAuthors);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Internal Co-Authors <span className="text-red-500">*</span>
                    <span className="text-gray-400 ml-1 font-normal">(Max: {((data.sgtAuthors as number) || 1) - 1})</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={((data.sgtAuthors as number) || 1) - 1}
                    value={(data.internalCoAuthors as number) ?? 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 0) {
                        handleChange('internalCoAuthors', 0);
                        return;
                      }
                      const maxCoAuthors = ((data.sgtAuthors as number) || 1) - 1;
                      if (value > maxCoAuthors) {
                        handleChange('internalCoAuthors', maxCoAuthors);
                        return;
                      }
                      handleChange('internalCoAuthors', value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Your Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={(data.userRole as string) || 'first_and_corresponding'}
                    onChange={(e) => handleChange('userRole', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="first_and_corresponding">First & Corresponding</option>
                    <option value="first">First Author</option>
                    <option value="corresponding">Corresponding</option>
                    <option value="co_author">Co-Author</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {((data.totalAuthors as number) || 0) > ((data.sgtAuthors as number) || 0) && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">
                        International Author <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-4">
                        {['yes', 'no'].map((v) => (
                          <label key={v} className="inline-flex items-center text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="hasInternationalAuthor"
                              value={v}
                              checked={(data.hasInternationalAuthor as string) === v}
                              onChange={(e) => handleChange('hasInternationalAuthor', e.target.value)}
                              className="w-4 h-4 text-emerald-600"
                            />
                            <span className="ml-1.5 capitalize text-gray-700">{v}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">
                      Student(s) from SGT <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      {['yes', 'no'].map((v) => (
                        <label key={v} className="inline-flex items-center text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="hasLpuStudents"
                            value={v}
                            checked={(data.hasLpuStudents as string) === v}
                            onChange={(e) => handleChange('hasLpuStudents', e.target.value)}
                            className="w-4 h-4 text-emerald-600"
                          />
                          <span className="ml-1.5 capitalize text-gray-700">{v}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {(data.hasInternationalAuthor as string) === 'yes' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">
                        Foreign Universities Collaborated:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={((data.totalAuthors as number) || 0) - ((data.sgtAuthors as number) || 0)}
                        value={(data.numForeignUniversities as number) || 0}
                        onChange={(e) => handleChange('numForeignUniversities', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Add Other Authors Section */}
          {renderAddOtherAuthorsSection()}
        </div>
      );

    case 'accepted':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manuscript ID</label>
              <input
                type="text"
                value={(data.manuscriptId as string) || ''}
                onChange={(e) => handleChange('manuscriptId', e.target.value)}
                className={`w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ${(data.manuscriptId as string) ? 'bg-gray-50' : ''}`}
                placeholder={(data.manuscriptId as string) ? "From communication stage" : "Enter manuscript ID"}
                readOnly={!!(data.manuscriptId as string)}
              />
              <p className="text-xs text-gray-500 mt-1">
                {(data.manuscriptId as string) ? 'Manuscript ID from communication stage' : 'Enter if not provided in communication stage'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Acceptance Date</label>
              <input
                type="date"
                value={(data.acceptanceDate as string) || ''}
                onChange={(e) => handleChange('acceptanceDate', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Publication Date</label>
            <input
              type="date"
              value={(data.expectedPublicationDate as string) || ''}
              onChange={(e) => handleChange('expectedPublicationDate', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acceptance Notes</label>
            <textarea
              value={(data.acceptanceNotes as string) || ''}
              onChange={(e) => handleChange('acceptanceNotes', e.target.value)}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Notes about the acceptance..."
            />
            <p className="text-xs text-gray-500 mt-1">💡 Use the "Attach Documents" section below to upload acceptance letter</p>
          </div>

          {/* Add Other Authors Section */}
          {renderAddOtherAuthorsSection()}
        </div>
      );

    case 'published':
      return (
        <div className="space-y-4">
          {/* Publication Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Publication Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={(data.publicationDate as string) || ''}
                onChange={(e) => handleChange('publicationDate', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                DOI <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(data.doi as string) || ''}
                onChange={(e) => handleChange('doi', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="10.xxxx/xxxxx"
                required
              />
            </div>
          </div>

          {/* Journal Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Journal Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={(data.journalName as string) || ''}
              onChange={(e) => handleChange('journalName', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter journal name"
              required
            />
          </div>

          {/* Author Information */}
          <div className="space-y-4 border-t pt-4">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2 -mx-6 mb-4">
              <h3 className="text-base font-semibold text-white">Author Information</h3>
            </div>
            
            {/* Author Counts Section */}
            <div className="p-4 bg-gradient-to-r from-gray-50 to-emerald-50 rounded-xl border border-gray-100 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Total Authors <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={(data.totalAuthors as number) || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      if (value < 1) return;
                      handleChange('totalAuthors', value);
                      // Adjust sgtAuthors if it exceeds new totalAuthors
                      const currentSgt = (data.sgtAuthors as number) || 1;
                      if (currentSgt > value) {
                        handleChange('sgtAuthors', value);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    SGT Authors <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={(data.totalAuthors as number) || 1}
                    value={(data.sgtAuthors as number) || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      const maxAllowed = (data.totalAuthors as number) || 1;
                      if (value < 1 || value > maxAllowed) return;
                      handleChange('sgtAuthors', value);
                      // Adjust internalCoAuthors if it exceeds max allowed
                      const maxCoAuthors = value - 1;
                      const currentCoAuthors = (data.internalCoAuthors as number) || 0;
                      if (currentCoAuthors > maxCoAuthors) {
                        handleChange('internalCoAuthors', maxCoAuthors);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Internal Co-Authors <span className="text-red-500">*</span>
                    <span className="text-gray-400 ml-1 font-normal">(Max: {((data.sgtAuthors as number) || 1) - 1})</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={((data.sgtAuthors as number) || 1) - 1}
                    value={(data.internalCoAuthors as number) ?? 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 0) {
                        handleChange('internalCoAuthors', 0);
                        return;
                      }
                      const maxCoAuthors = ((data.sgtAuthors as number) || 1) - 1;
                      if (value > maxCoAuthors) {
                        handleChange('internalCoAuthors', maxCoAuthors);
                        return;
                      }
                      handleChange('internalCoAuthors', value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Your Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={(data.userRole as string) || 'first_and_corresponding'}
                    onChange={(e) => handleChange('userRole', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="first_and_corresponding">First & Corresponding</option>
                    <option value="first">First Author</option>
                    <option value="corresponding">Corresponding</option>
                    <option value="co_author">Co-Author</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* International Author - Only show when there are external authors */}
                  {((data.totalAuthors as number) || 0) > ((data.sgtAuthors as number) || 0) && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">
                        International Author <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-4">
                        {['yes', 'no'].map((v) => (
                          <label key={v} className="inline-flex items-center text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="hasInternationalAuthor"
                              value={v}
                              checked={(data.hasInternationalAuthor as string) === v}
                              onChange={(e) => handleChange('hasInternationalAuthor', e.target.value)}
                              className="w-4 h-4 text-emerald-600"
                            />
                            <span className="ml-1.5 capitalize text-gray-700">{v}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">
                      Student(s) from SGT <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      {['yes', 'no'].map((v) => (
                        <label key={v} className="inline-flex items-center text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="hasLpuStudents"
                            value={v}
                            checked={(data.hasLpuStudents as string) === v}
                            onChange={(e) => handleChange('hasLpuStudents', e.target.value)}
                            className="w-4 h-4 text-emerald-600"
                          />
                          <span className="ml-1.5 capitalize text-gray-700">{v}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {/* Foreign Universities - Only show when International Author is Yes */}
                  {(data.hasInternationalAuthor as string) === 'yes' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">
                        Foreign Universities Collaborated:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={((data.totalAuthors as number) || 0) - ((data.sgtAuthors as number) || 0)}
                        value={(data.numForeignUniversities as number) || 0}
                        onChange={(e) => handleChange('numForeignUniversities', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Volume, Issue, Pages, DOI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Volume <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(data.volume as string) || ''}
                onChange={(e) => handleChange('volume', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="e.g., 12"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Issue <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(data.issue as string) || ''}
                onChange={(e) => handleChange('issue', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="e.g., 5"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pages <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(data.pageNumbers as string) || ''}
                onChange={(e) => handleChange('pageNumbers', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="e.g., 123-145"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                DOI
              </label>
              <input
                type="text"
                value={(data.doi as string) || ''}
                onChange={(e) => handleChange('doi', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="10.xxxx/..."
              />
            </div>
          </div>

          {/* ISSN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ISSN <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={(data.issn as string) || ''}
              onChange={(e) => handleChange('issn', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="xxxx-xxxx"
              required
            />
          </div>

          {/* Publication URL/Weblink */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Publication URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={(data.weblink as string) || ''}
              onChange={(e) => handleChange('weblink', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="https://..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">💡 Use the "Attach Documents" section below to upload the published paper</p>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> All fields marked with <span className="text-red-500">*</span> are required to submit the contribution for approval and incentive calculation.
            </p>
          </div>
        </div>
      );

    case 'rejected':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason</label>
            <select
              value={(data.rejectionReason as string) || ''}
              onChange={(e) => handleChange('rejectionReason', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">Select</option>
              <option value="out_of_scope">Out of Scope</option>
              <option value="methodology_issues">Methodology Issues</option>
              <option value="insufficient_novelty">Insufficient Novelty</option>
              <option value="poor_writing">Poor Writing Quality</option>
              <option value="incomplete_research">Incomplete Research</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Summary</label>
            <textarea
              value={(data.feedbackSummary as string) || ''}
              onChange={(e) => handleChange('feedbackSummary', e.target.value)}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Summary of rejection feedback..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan to Resubmit?</label>
            <select
              value={(data.planToResubmit as string) || ''}
              onChange={(e) => handleChange('planToResubmit', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">Select</option>
              <option value="same_journal">Yes, to same journal</option>
              <option value="different_journal">Yes, to different journal</option>
              <option value="no">No</option>
              <option value="undecided">Undecided</option>
            </select>
          </div>
        </div>
      );

    default:
      return (
        <p className="text-sm text-gray-500">No additional fields required for this status.</p>
      );
  }
}
