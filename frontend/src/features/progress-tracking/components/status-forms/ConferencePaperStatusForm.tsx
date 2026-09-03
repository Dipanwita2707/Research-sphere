'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResearchTrackerStatus } from '@/features/research-management/services/progressTracker.service';
import { researchService } from '@/features/research-management/services/research.service';
import { X, Search, AlertCircle, Plus } from 'lucide-react';
import { useAuthStore } from '@/shared/auth/authStore';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
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

interface ConferencePaperStatusFormProps {
  status: ResearchTrackerStatus;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  conferenceSubType?: string;
}

export default function ConferencePaperStatusForm({ status, data, onChange, conferenceSubType }: ConferencePaperStatusFormProps) {
  const { user } = useAuthStore();
  const { confirmDelete, confirmAction } = useConfirm();
  
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>((data.coAuthors as CoAuthor[]) || []);
  const [newAuthor, setNewAuthor] = useState<CoAuthor>({
    name: '',
    authorType: 'Faculty',
    authorCategory: 'Internal',
    authorRole: 'co_author',
    affiliation: 'ResearchSphere',
    email: '',
    uid: '',
    designation: '',
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAuthorForm, setShowAuthorForm] = useState(false);
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

  // Search for internal ResearchSphere users
  const handleSearch = useCallback(async (query: string) => {
    setSearchTerm(query);
    setNewAuthor(prev => ({ ...prev, name: query }));
    
    if (query.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Skip API call for external authors
    if (newAuthor.authorCategory ===
   'External') {
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
      const authorType = userData.type ===
   'employee' ? 'Faculty' : 'Student';
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
    if (editingIndex ===
   null && coAuthors.some(a => a.name.toLowerCase() ===
   newAuthor.name.toLowerCase())) {
      return 'This author has already been added';
    }

    const totalAuthors = (data.totalAuthors as number) || 1;
    const sgtAuthors = (data.sgtAuthors as number) || 1;
    const internalCoAuthors = (data.internalCoAuthors as number) || 0;

    if (newAuthor.authorCategory ===
   'Internal') {
      const internalAdded = coAuthors.filter(a => a.authorCategory ===
   'Internal').length;
      const maxInternal = sgtAuthors - 1; // Exclude current user
      
      if (editingIndex ===
   null && internalAdded >= maxInternal) {
        return `You can only add ${maxInternal} internal author(s). You've already added ${internalAdded}.`;
      }

      // Check internal co-author limit
      if (newAuthor.authorRole ===
   'co_author') {
        const internalCoAuthorsAdded = coAuthors.filter(a => a.authorCategory ===
   'Internal' && a.authorRole ===
   'co_author').length;
        if (editingIndex ===
   null && internalCoAuthorsAdded >= internalCoAuthors) {
          return `You can only add ${internalCoAuthors} internal co-author(s). You've already added ${internalCoAuthorsAdded}.`;
        }
      }
    } else {
      const externalAdded = coAuthors.filter(a => a.authorCategory ===
   'External').length;
      const maxExternal = totalAuthors - sgtAuthors;
      
      if (editingIndex ===
   null && externalAdded >= maxExternal) {
        return `You can only add ${maxExternal} external author(s). You've already added ${externalAdded}.`;
      }
    }

    if (newAuthor.authorCategory ===
   'Internal' && !newAuthor.uid) {
      return 'Please select an internal author from the search results';
    }

    if (newAuthor.authorCategory ===
   'External' && !newAuthor.email) {
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
      affiliation: 'ResearchSphere',
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

    const roles = [
      { value: 'co_author', label: 'Co-Author' },
    ];

    // For Internal authors, check if they can be first or corresponding
    if (newAuthor.authorCategory ===
   'Internal' && internalCoAuthors ===
   0 && sgtAuthors > 1) {
      roles.unshift(
        { value: 'first', label: 'First Author' },
        { value: 'corresponding', label: 'Corresponding Author' }
      );
    }

    return roles;
  };

  // Authors Summary Component - shown in all stages except writing/communicated with edit/delete
  const AuthorsSummary = () => {
    const totalAuthors = (data.totalAuthors as number) || 1;
    const sgtAuthors = (data.sgtAuthors as number) || 1;
    if (totalAuthors ===
   0 && coAuthors.length ===
   0) return null;
    
    const handleEditAuthor = (realIndex: number) => {
      const author = coAuthors[realIndex];
      setEditingIndex(realIndex);
      setNewAuthor({
        uid: author.uid || '',
        name: author.name || '',
        authorType: author.authorType || 'Faculty',
        authorCategory: author.authorCategory || 'Internal',
        email: author.email || '',
        affiliation: author.affiliation || 'ResearchSphere',
        authorRole: author.authorRole || 'co_author',
        designation: author.designation || '',
      });
      setShowAuthorForm(true);
      setShowAddForm(true);
    };

    const handleDeleteAuthor = async (realIndex: number) => {
      const confirmed = await confirmDelete('Remove Author', 'Are you sure you want to remove this author?');
      if (confirmed) {
        const updatedAuthors = coAuthors.filter((_, i) => i !== realIndex);
        onChange({ ...data, internalCoAuthors: updatedAuthors });
      }
    };
    
    const validAuthors = coAuthors
      .map((author, index) => ({ author, realIndex: index }))
      .filter(item => item.author && item.author.name);
    
    return (
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold text-purple-900 mb-3">Authors Summary</h4>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <span className="text-xs text-gray-600">Total Authors:</span>
            <span className="ml-2 font-medium text-gray-900">{totalAuthors}</span>
          </div>
          <div>
            <span className="text-xs text-gray-600">ResearchSphere Authors:</span>
            <span className="ml-2 font-medium text-gray-900">{sgtAuthors}</span>
          </div>
        </div>
        
        {validAuthors.length > 0 && (
          <div className="mt-3">
            <h5 className="text-xs font-semibold text-gray-700 mb-2">Co-Authors ({validAuthors.length}):</h5>
            <div className="space-y-2">
              {validAuthors.map(({ author, realIndex }) => (
                <div key={realIndex} className="bg-white border border-gray-200 rounded p-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">{author.name}</div>
                      <div className="text-xs text-gray-600">
                        {author.authorCategory} • {author.authorType} • {author.authorRole ===
   'first' ? 'First' : author.authorRole ===
   'corresponding' ? 'Corresponding' : 'Co-Author'}
                        {author.uid && ` • ${author.uid}`}
                      </div>
                      <div className="text-xs text-gray-500">{author.affiliation}</div>
                    </div>
                    <div className="flex gap-2 ml-3">
                      <button
                        type="button"
                        onClick={() => handleEditAuthor(realIndex)}
                        className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAuthor(realIndex)}
                        className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Add Other Authors section
  const renderAddOtherAuthorsSection = () => {
    if (((data.totalAuthors as number) || 1) <= 1) return null;

    return (
      <div className="mt-4 border border-purple-300 bg-purple-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900">
            Add Other Authors {editingIndex !== null && <span className="text-xs text-blue-600">(Editing)</span>}
          </h4>
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs hover:bg-purple-700 transition-colors"
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
            const internalAdded = coAuthors.filter(a => a.authorCategory ===
   'Internal').length;
            const externalAdded = coAuthors.filter(a => a.authorCategory ===
   'External').length;
            const maxInternal = sgtAuthors - 1;
            const maxExternal = totalAuthors - sgtAuthors;

            const parts = [];
            if (maxInternal > 0) {
              parts.push(`${maxInternal} ResearchSphere author(s) [${internalAdded} added]`);
            }
            if (maxExternal > 0) {
              parts.push(`${maxExternal} external author(s) [${externalAdded} added]`);
            }

            if (parts.length ===
   0) {
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
                    const internalAdded = coAuthors.filter(a => a.authorCategory ===
   'Internal').length;
                    const externalAdded = coAuthors.filter(a => a.authorCategory ===
   'External').length;
                    const maxInternal = sgtAuthors - 1;
                    const maxExternal = totalAuthors - sgtAuthors;
                    const internalSlotsFull = internalAdded >= maxInternal;
                    const externalSlotsFull = externalAdded >= maxExternal;
                    const allInternal = totalAuthors ===
   sgtAuthors;

                    return (
                      <>
                        {!allInternal && (maxInternal > 0 || !internalSlotsFull) && (
                          <label className="inline-flex items-center text-xs cursor-pointer">
                            <input
                              type="radio"
                              value="Internal"
                              checked={newAuthor.authorCategory ===
   'Internal'}
                              onChange={(e) => {
                                setNewAuthor({
                                  ...newAuthor,
                                  authorCategory: 'Internal',
                                  authorType: 'Faculty',
                                  affiliation: 'ResearchSphere',
                                });
                                setSearchTerm('');
                              }}
                              disabled={internalSlotsFull}
                              className="w-3 h-3 text-purple-600"
                            />
                            <span className="ml-1.5">Internal (ResearchSphere) {internalSlotsFull && <span className="text-red-600">(Full)</span>}</span>
                          </label>
                        )}
                        {!allInternal && maxExternal > 0 && (
                          <label className="inline-flex items-center text-xs cursor-pointer">
                            <input
                              type="radio"
                              value="External"
                              checked={newAuthor.authorCategory ===
   'External'}
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
                              className="w-3 h-3 text-purple-600"
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
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-purple-500"
                >
                  {newAuthor.authorCategory ===
   'Internal' ? (
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
                {newAuthor.authorCategory ===
   'Internal' && <span className="text-xs text-gray-500 ml-1">(Search by name or UID)</span>}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full px-2 py-1.5 pr-8 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500"
                  placeholder={newAuthor.authorCategory ===
   'Internal' ? 'Type to search ResearchSphere users...' : 'Enter full name'}
                />
                {newAuthor.authorCategory ===
   'Internal' && <Search className="absolute right-2 top-2 w-4 h-4 text-gray-400" />}
              </div>
              
              {/* Search Suggestions */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchSuggestions.map((user, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectUser(user)}
                      className="w-full px-3 py-2 text-left hover:bg-purple-50 text-xs border-b border-gray-100 last:border-0"
                    >
                      <div className="font-medium text-gray-900">{user.displayName || user.name}</div>
                      <div className="text-gray-600">{user.uid} • {user.designation || user.role || 'User'}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Email - For External Authors */}
            {newAuthor.authorCategory ===
   'External' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={newAuthor.email || ''}
                  onChange={(e) => setNewAuthor(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-purple-500"
                  placeholder="email@example.com"
                />
              </div>
            )}

            {/* Affiliation */}
            {newAuthor.authorCategory ===
   'External' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Organization/Institute <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newAuthor.affiliation || ''}
                  onChange={(e) => setNewAuthor(prev => ({ ...prev, affiliation: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter organization name"
                />
              </div>
            )}

            {/* Designation - For External Authors */}
            {newAuthor.authorCategory ===
   'External' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={newAuthor.designation || ''}
                  onChange={(e) => setNewAuthor(prev => ({ ...prev, designation: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Professor, Researcher"
                />
              </div>
            )}

            {/* Author Role */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Author Role <span className="text-red-500">*</span></label>
              <select
                value={newAuthor.authorRole}
                onChange={(e) => setNewAuthor(prev => ({ ...prev, authorRole: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-purple-500"
              >
                {getAvailableRoles().map(role => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addOrUpdateAuthor}
                className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
              >
                {editingIndex !== null ? 'Update' : 'Add'} Author
              </button>
            </div>
          </div>
        )}

        {/* Added Authors List */}
        {coAuthors.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-gray-900">Added Authors:</h5>
            {coAuthors.map((author, index) => (
              <div key={index} className="flex items-start justify-between bg-white rounded-lg p-2 border border-gray-200">
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">{author.name}</div>
                  <div className="text-xs text-gray-600">
                    {author.authorCategory} • {author.authorType} • {author.authorRole ===
   'first' ? 'First Author' : author.authorRole ===
   'corresponding' ? 'Corresponding' : 'Co-Author'}
                    {author.uid && ` • ${author.uid}`}
                  </div>
                  <div className="text-xs text-gray-500">{author.affiliation}</div>
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    type="button"
                    onClick={() => editAuthor(index)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAuthor(index)}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Remove
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
    case 'communicated':
      return (
        <div className="space-y-4">
          {/* Conference Information Section */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-purple-900 mb-3">Conference Information</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conference Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(data.conferenceName as string) || ''}
                onChange={(e) => handleChange('conferenceName', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                placeholder="Enter conference name"
              />
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conference Type <span className="text-red-500">*</span>
              </label>
              <select
                value={(data.conferenceType as string) || 'national'}
                onChange={(e) => handleChange('conferenceType', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              >
                <option value="national">National</option>
                <option value="international">International</option>
              </select>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Conference Date</label>
              <input
                type="date"
                value={(data.conferenceDate as string) || ''}
                onChange={(e) => handleChange('conferenceDate', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Author Information */}
          {renderAddOtherAuthorsSection()}

          {/* Paper Details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paper Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={(data.paperTitle as string) || ''}
              onChange={(e) => handleChange('paperTitle', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              placeholder="Enter paper title"
            />
          </div>

          <div>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={(data.virtualConference as boolean) || false}
                onChange={(e) => handleChange('virtualConference', e.target.checked)}
                className="rounded border-gray-300 text-purple-600 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">Virtual Conference</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Interdisciplinary (ResearchSphere) <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              {['yes', 'no'].map(v => (
                <label key={v} className="inline-flex items-center text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="isInterdisciplinary"
                    value={v}
                    checked={(data.isInterdisciplinary as string) ===
   v}
                    onChange={(e) => handleChange('isInterdisciplinary', e.target.value)}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="ml-1.5 capitalize">{v}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Have you communicated the publication with official ID? <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              {['yes', 'no'].map(v => (
                <label key={v} className="inline-flex items-center text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="communicatedWithOfficialId"
                    value={v}
                    checked={(data.communicatedWithOfficialId as string) ===
   v}
                    onChange={(e) => handleChange('communicatedWithOfficialId', e.target.value)}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="ml-1.5 capitalize">{v}</span>
                </label>
              ))}
            </div>
          </div>

          {(data.communicatedWithOfficialId as string) ===
   'no' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Personal Email Used <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={(data.personalEmail as string) || ''}
                onChange={(e) => handleChange('personalEmail', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                placeholder="your.email@example.com"
              />
            </div>
          )}
        </div>
      );

    case 'submitted':
      return (
        <div className="space-y-4">
          {/* Authors Summary - Read Only */}
          <AuthorsSummary />
          
          {!showAuthorForm && (
            <button
              type="button"
              onClick={() => setShowAuthorForm(true)}
              className="mb-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add New Author
            </button>
          )}
          
          {showAuthorForm && renderAddOtherAuthorsSection()}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Submission Date</label>
            <input
              type="date"
              value={(data.submissionDate as string) || ''}
              onChange={(e) => handleChange('submissionDate', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Manuscript ID</label>
            <input
              type="text"
              value={(data.manuscriptId as string) || ''}
              onChange={(e) => handleChange('manuscriptId', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              placeholder="e.g., CONF-2024-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Progress Notes</label>
            <textarea
              value={(data.progressNotes as string) || ''}
              onChange={(e) => handleChange('progressNotes', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              rows={3}
              placeholder="Add any notes about the submission..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Submission Document</label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleChange('submissionDocument', file);
              }}
              className="w-full"
            />
          </div>
        </div>
      );

    case 'accepted':
      return (
        <div className="space-y-4">
          {/* Authors Summary - Read Only */}
          <AuthorsSummary />
          
          {!showAuthorForm && (
            <button
              type="button"
              onClick={() => setShowAuthorForm(true)}
              className="mb-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add New Author
            </button>
          )}
          
          {showAuthorForm && renderAddOtherAuthorsSection()}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acceptance Date</label>
            <input
              type="date"
              value={(data.acceptanceDate as string) || ''}
              onChange={(e) => handleChange('acceptanceDate', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Presentation Date</label>
            <input
              type="date"
              value={(data.presentationDate as string) || ''}
              onChange={(e) => handleChange('presentationDate', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acceptance Letter</label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleChange('acceptanceLetter', file);
              }}
              className="w-full"
            />
          </div>
        </div>
      );

    case 'published':
      return (
        <div className="space-y-4">
          {/* Authors Summary - Read Only */}
          <AuthorsSummary />
          
          {!showAuthorForm && (
            <button
              type="button"
              onClick={() => setShowAuthorForm(true)}
              className="mb-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add New Author
            </button>
          )}
          
          {showAuthorForm && renderAddOtherAuthorsSection()}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Publication Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={(data.publicationDate as string) || ''}
              onChange={(e) => handleChange('publicationDate', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proceedings Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={(data.proceedingsTitle as string) || ''}
              onChange={(e) => handleChange('proceedingsTitle', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              placeholder="Enter proceedings title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DOI</label>
            <input
              type="text"
              value={(data.doi as string) || ''}
              onChange={(e) => handleChange('doi', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              placeholder="e.g., 10.1234/example.doi"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Page Numbers</label>
            <input
              type="text"
              value={(data.pageNumbers as string) || ''}
              onChange={(e) => handleChange('pageNumbers', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              placeholder="e.g., 101-110"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conference Paper Document</label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleChange('paperDocument', file);
              }}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Faculty Remarks</label>
            <textarea
              value={(data.facultyRemarks as string) || ''}
              onChange={(e) => handleChange('facultyRemarks', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              rows={3}
              placeholder="Any additional remarks..."
            />
          </div>
        </div>
      );

    case 'rejected':
      return (
        <div className="space-y-4">
          {/* Authors Summary - Read Only */}
          <AuthorsSummary />
          
          {!showAuthorForm && (
            <button
              type="button"
              onClick={() => setShowAuthorForm(true)}
              className="mb-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add New Author
            </button>
          )}
          
          {showAuthorForm && renderAddOtherAuthorsSection()}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason</label>
            <textarea
              value={(data.rejectionReason as string) || ''}
              onChange={(e) => handleChange('rejectionReason', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              rows={3}
              placeholder="Describe the reason for rejection..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Summary</label>
            <textarea
              value={(data.feedbackSummary as string) || ''}
              onChange={(e) => handleChange('feedbackSummary', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              rows={3}
              placeholder="Summarize the feedback received..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan to Resubmit?</label>
            <div className="flex gap-4">
              {['yes', 'no'].map(v => (
                <label key={v} className="inline-flex items-center text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="planToResubmit"
                    value={v}
                    checked={(data.planToResubmit as string) ===
   v}
                    onChange={(e) => handleChange('planToResubmit', e.target.value)}
                    className="w-4 h-4 text-red-600"
                  />
                  <span className="ml-1.5 capitalize">{v}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      );

    default:
      return <div>Please select a valid status</div>;
  }
}
