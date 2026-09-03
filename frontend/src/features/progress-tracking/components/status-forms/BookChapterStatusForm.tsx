'use client';

import { useState } from 'react';
import { ResearchTrackerStatus } from '@/features/research-management/services/progressTracker.service';
import { Plus, X, AlertCircle } from 'lucide-react';
import { researchService } from '@/features/research-management/services/research.service';
import { useAuthStore } from '@/shared/auth/authStore';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import logger from '@/shared/utils/logger';

interface BookChapterStatusFormProps {
  status: ResearchTrackerStatus;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

interface CoAuthor {
  uid: string;
  name: string;
  authorType: string;
  authorCategory: string;
  email: string;
  affiliation: string;
  designation?: string;
}

export default function BookChapterStatusForm({ status, data, onChange }: BookChapterStatusFormProps) {
  const { user } = useAuthStore();
  const { confirmDelete, confirmAction } = useConfirm();
  
  // State for author management
  const [totalAuthors, setTotalAuthors] = useState<number>((data.totalAuthors as number) || 1);
  const [totalInternalAuthors, setTotalInternalAuthors] = useState<number>((data.sgtAffiliatedAuthors as number) || 1);
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>((data.coAuthors as CoAuthor[]) || []);
  const [editingAuthorIndex, setEditingAuthorIndex] = useState<number | null>(null);
  const [newAuthor, setNewAuthor] = useState<CoAuthor>({
    uid: '',
    name: '',
    authorType: 'Author',
    authorCategory: 'Internal',
    email: '',
    affiliation: 'ResearchSphere',
    designation: '',
  });
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAuthorForm, setShowAuthorForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleChange = (field: string, value: unknown) => {
    onChange({ ...data, [field]: value });
  };
  
  // Update totalAuthors and sgtAffiliatedAuthors when they change
  const handleAuthorCountChange = (field: 'totalAuthors' | 'sgtAffiliatedAuthors', value: number) => {
    if (field ===
   'totalAuthors') {
      setTotalAuthors(value);
      handleChange('totalAuthors', value);
      if (totalInternalAuthors > value) {
        setTotalInternalAuthors(value);
        handleChange('sgtAffiliatedAuthors', value);
      }
    } else {
      setTotalInternalAuthors(value);
      handleChange('sgtAffiliatedAuthors', value);
    }
  };
  
  // Update coAuthors when they change
  const updateCoAuthors = (newCoAuthors: CoAuthor[]) => {
    setCoAuthors(newCoAuthors);
    handleChange('coAuthors', newCoAuthors);
  };
  
  // Search for internal authors
  const searchAuthors = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 3) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    try {
      const response = await researchService.searchUsers(searchTerm, 'all');
      let userData = [];
      if (response && typeof response ===
   'object') {
        if (response.data && Array.isArray(response.data)) {
          userData = response.data;
        } else if (response.users && Array.isArray(response.users)) {
          userData = response.users;
        } else if (Array.isArray(response)) {
          userData = response;
        }
      }
      
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
  
  // Select author from suggestion
  const selectAuthorFromSuggestion = async (userData: any) => {
    if (userData.uid ===
   user?.uid) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      setError('You cannot add yourself as a co-author.');
      setNewAuthor({
        uid: '',
        name: '',
        authorType: 'Author',
        authorCategory: 'Internal',
        email: '',
        affiliation: 'ResearchSphere',
        designation: '',
      });
      return;
    }
    
    const userName = userData.name || userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
    
    try {
      const fullData = await researchService.lookupByRegistration(userData.uid);
      const fullUser = fullData.data || fullData;
      
      let userEmail = '';
      if (fullUser) {
        userEmail = fullUser.email || '';
        if (!userEmail && fullUser.employeeDetails) {
          userEmail = fullUser.employeeDetails.email || '';
        }
        if (!userEmail && fullUser.studentProfile) {
          userEmail = fullUser.studentProfile.email || '';
        }
      }
      
      setNewAuthor({
        uid: userData.uid,
        name: userName || fullUser?.displayName || '',
        authorType: 'Author',
        authorCategory: 'Internal',
        email: userEmail,
        affiliation: 'ResearchSphere',
        designation: userData.designation || '',
      });
    } catch (error) {
      logger.error('Error fetching full details:', error);
      setNewAuthor({
        uid: userData.uid,
        name: userName,
        authorType: 'Author',
        authorCategory: 'Internal',
        email: userData.email || '',
        affiliation: 'ResearchSphere',
        designation: '',
      });
    }
    
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setError(null);
  };
  
  // Lookup author by UID
  const lookupAuthor = async (uid: string) => {
    if (!uid) return;
    
    if (uid ===
   user?.uid) {
      setNewAuthor({
        uid: '',
        name: '',
        authorType: 'Author',
        authorCategory: 'Internal',
        email: '',
        affiliation: 'ResearchSphere',
        designation: '',
      });
      setError('You cannot add yourself as a co-author.');
      return;
    }
    
    try {
      const response = await researchService.lookupByRegistration(uid);
      if (response.data) {
        const userData = response.data;
        let userEmail = userData.email || '';
        
        if (!userEmail && userData.employeeDetails) {
          userEmail = userData.employeeDetails.email || '';
        }
        if (!userEmail && userData.studentProfile) {
          userEmail = userData.studentProfile.email || '';
        }
        
        setNewAuthor({
          uid: uid,
          name: userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
          authorType: 'Author',
          authorCategory: 'Internal',
          email: userEmail,
          affiliation: 'ResearchSphere',
          designation: '',
        });
        
        setSearchSuggestions([]);
        setShowSuggestions(false);
        setError(null);
      }
    } catch (error) {
      setNewAuthor({
        uid: uid,
        name: '',
        authorType: 'Author',
        authorCategory: 'Internal',
        email: '',
        affiliation: 'ResearchSphere',
        designation: '',
      });
      setError('User not found with that UID/Registration Number');
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  };
  
  // Add or update author
  const addOrUpdateAuthor = () => {
    if (!newAuthor.name) {
      setError('Author name is required');
      return;
    }
    
    if (newAuthor.authorCategory ===
   'Internal' && !newAuthor.uid) {
      setError('UID/Registration Number is required for ResearchSphere authors');
      return;
    }
    
    if (newAuthor.authorCategory ===
   'External') {
      if (!newAuthor.email) {
        setError('Email is required for external authors');
        return;
      }
      if (!newAuthor.affiliation) {
        setError('Organization/Institute is required for external authors');
        return;
      }
      if (!newAuthor.designation) {
        setError('Designation is required for external authors');
        return;
      }
    }
    
    if (newAuthor.authorCategory ===
   'Internal' && newAuthor.uid ===
   user?.uid) {
      setError('You cannot add yourself as a co-author.');
      return;
    }
    
    if (editingAuthorIndex !== null) {
      const updated = [...coAuthors];
      updated[editingAuthorIndex] = { ...newAuthor };
      updateCoAuthors(updated);
      setEditingAuthorIndex(null);
    } else {
      const currentCount = coAuthors.filter(a => a.name).length;
      const maxCoAuthors = totalAuthors - 1;
      
      if (currentCount >= maxCoAuthors) {
        setError(`You can only add ${maxCoAuthors} co-author(s) based on your total author count of ${totalAuthors}`);
        return;
      }
      
      const internalAdded = coAuthors.filter(a => a.name && a.authorCategory ===
   'Internal').length;
      const externalAdded = coAuthors.filter(a => a.name && a.authorCategory ===
   'External').length;
      const maxInternalAuthors = totalInternalAuthors - 1;
      const maxExternalAuthors = totalAuthors - totalInternalAuthors;
      
      if (newAuthor.authorCategory ===
   'Internal' && internalAdded >= maxInternalAuthors) {
        setError(`You can only add ${maxInternalAuthors} ResearchSphere author(s). You've already added ${internalAdded}.`);
        return;
      }
      
      if (newAuthor.authorCategory ===
   'External' && externalAdded >= maxExternalAuthors) {
        setError(`You can only add ${maxExternalAuthors} external author(s). You've already added ${externalAdded}.`);
        return;
      }
      
      updateCoAuthors([...coAuthors, { ...newAuthor }]);
    }
    
    setNewAuthor({
      uid: '',
      name: '',
      authorType: 'Author',
      authorCategory: 'Internal',
      email: '',
      affiliation: 'ResearchSphere',
      designation: '',
    });
    setError(null);
  };
  
  const editAuthor = (index: number) => {
    setNewAuthor({ ...coAuthors[index] });
    setEditingAuthorIndex(index);
  };
  
  const removeAuthor = (index: number) => {
    updateCoAuthors(coAuthors.filter((_, i) => i !== index));
  };
  
  const hasAuthorsAdded = coAuthors.filter(a => a.name).length > 0;
  
  // Authors Summary Component - shown in all stages with edit/delete
  const AuthorsSummary = () => {
    if (totalAuthors ===
   0 && coAuthors.length ===
   0) return null;
    
    const handleEditAuthor = (realIndex: number) => {
      const author = coAuthors[realIndex];
      setEditingAuthorIndex(realIndex);
      setNewAuthor({
        uid: author.uid || '',
        name: author.name || '',
        authorType: author.authorType || 'Author',
        authorCategory: author.authorCategory || 'Internal',
        email: author.email || '',
        affiliation: author.affiliation || 'ResearchSphere',
        designation: author.designation || '',
      });
      setShowAuthorForm(true);
    };

    const handleDeleteAuthor = async (realIndex: number) => {
      const confirmed = await confirmDelete('Remove Author', 'Are you sure you want to remove this author?');
      if (confirmed) {
        const updatedAuthors = coAuthors.filter((_, i) => i !== realIndex);
        updateCoAuthors(updatedAuthors);
      }
    };
    
    const validAuthors = coAuthors
      .map((author, index) => ({ author, realIndex: index }))
      .filter(item => item.author.name);
    
    return (
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold text-teal-900 mb-3">Authors Summary</h4>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <span className="text-xs text-gray-600">Total Authors:</span>
            <span className="ml-2 font-medium text-gray-900">{totalAuthors || 1}</span>
          </div>
          <div>
            <span className="text-xs text-gray-600">ResearchSphere Authors:</span>
            <span className="ml-2 font-medium text-gray-900">{totalInternalAuthors || 1}</span>
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
                        {author.authorCategory} • {author.affiliation}
                        {author.uid && ` • ${author.uid}`}
                      </div>
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
  
  switch (status) {
    case 'writing':
    case 'communicated':
      return (
        <div className="space-y-4">
          {/* Author Information */}
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-teal-900 mb-3">Author Information</h4>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Authors <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={totalAuthors}
                  onChange={(e) => handleAuthorCountChange('totalAuthors', parseInt(e.target.value) || 1)}
                  disabled={hasAuthorsAdded}
                  className={`w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 ${hasAuthorsAdded ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ResearchSphere Authors <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={totalAuthors}
                  value={totalInternalAuthors}
                  onChange={(e) => handleAuthorCountChange('sgtAffiliatedAuthors', parseInt(e.target.value) || 1)}
                  disabled={hasAuthorsAdded}
                  className={`w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 ${hasAuthorsAdded ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="1"
                />
              </div>
            </div>
            <p className="text-xs text-teal-700">
              💡 Incentive will be distributed equally among all ResearchSphere authors
            </p>
            {hasAuthorsAdded && (
              <p className="text-xs text-amber-600 mt-2 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1" />
                Remove all added authors to modify these fields
              </p>
            )}
          </div>
          
          {/* Add Other Authors - Same as Book */}
          {totalAuthors > 1 && (
            <div className="border border-teal-300 bg-teal-50 rounded p-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Add Other Authors {editingAuthorIndex !== null && <span className="text-xs text-blue-600">(Editing)</span>}
              </h3>
              <p className="text-xs text-gray-600 mb-2">
                {(() => {
                  const maxCoAuthors = totalAuthors - 1;
                  const currentAdded = coAuthors.filter(a => a.name).length;
                  const internalAdded = coAuthors.filter(a => a.name && a.authorCategory ===
   'Internal').length;
                  const externalAdded = coAuthors.filter(a => a.name && a.authorCategory ===
   'External').length;
                  const maxInternalToAdd = totalInternalAuthors - 1;
                  const maxExternalToAdd = totalAuthors - totalInternalAuthors;
                  
                  const parts = [];
                  if (maxInternalToAdd > 0) {
                    parts.push(`${maxInternalToAdd} ResearchSphere author(s) [${internalAdded} added]`);
                  }
                  if (maxExternalToAdd > 0) {
                    parts.push(`${maxExternalToAdd} external author(s) [${externalAdded} added]`);
                  }
                  
                  return parts.length > 0 ? `You need to add ${parts.join(' and ')}. Total: ${currentAdded}/${maxCoAuthors} author(s) added.` : 'You are the only author.';
                })()}
              </p>
              
              {error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {error}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Author Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Author From: <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-6">
                    {totalInternalAuthors - 1 > coAuthors.filter(a => a.name && a.authorCategory ===
   'Internal').length && (
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="Internal"
                          checked={newAuthor.authorCategory ===
   'Internal'}
                          onChange={(e) => {
                            setNewAuthor(prev => ({ 
                              ...prev, 
                              authorCategory: e.target.value,
                              authorType: 'Author',
                              affiliation: 'ResearchSphere',
                              uid: '',
                              name: '',
                              email: '',
                            }));
                            setSearchSuggestions([]);
                            setShowSuggestions(false);
                          }}
                          className="w-4 h-4 text-teal-600"
                        />
                        <span className="ml-2">ResearchSphere</span>
                      </label>
                    )}
                    {totalAuthors > totalInternalAuthors && (
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="External"
                          checked={newAuthor.authorCategory ===
   'External'}
                          onChange={(e) => {
                            setNewAuthor(prev => ({ 
                              ...prev, 
                              authorCategory: e.target.value,
                              authorType: 'Author',
                              affiliation: '',
                              uid: '',
                              name: '',
                              email: '',
                            }));
                            setSearchSuggestions([]);
                            setShowSuggestions(false);
                          }}
                          className="w-4 h-4 text-teal-600"
                        />
                        <span className="ml-2">External</span>
                      </label>
                    )}
                  </div>
                </div>
                
                {/* UID - Only for Internal */}
                {newAuthor.authorCategory ===
   'Internal' && (
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      UID/Reg No: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newAuthor.uid}
                      onChange={(e) => {
                        const newUid = e.target.value;
                        setSearchSuggestions([]);
                        setShowSuggestions(false);
                        setNewAuthor({
                          uid: newUid,
                          name: '',
                          authorType: 'Author',
                          authorCategory: 'Internal',
                          email: '',
                          affiliation: 'ResearchSphere',
                          designation: '',
                        });
                        if (newUid.length >= 3) {
                          searchAuthors(newUid);
                        }
                      }}
                      onBlur={(e) => {
                        setTimeout(() => {
                          const uid = e.target.value;
                          if (uid && uid.length >= 5 && !showSuggestions) {
                            lookupAuthor(uid);
                          }
                        }, 200);
                      }}
                      onFocus={() => {
                        if (newAuthor.uid.length >= 3 && searchSuggestions.length > 0) {
                          setShowSuggestions(true);
                        }
                      }}
                      placeholder="e.g., STF12345 or 12345678"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                    
                    {showSuggestions && searchSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {searchSuggestions.map((suggestion, idx) => {
                          const displayName = suggestion.name || suggestion.displayName || `${suggestion.firstName || ''} ${suggestion.lastName || ''}`.trim();
                          const displayRole = suggestion.designation || suggestion.role || 'User';
                          const displayDept = suggestion.department || suggestion.departmentName || '';
                          
                          return (
                            <div
                              key={idx}
                              onClick={() => selectAuthorFromSuggestion(suggestion)}
                              className="px-4 py-3 hover:bg-teal-50 cursor-pointer border-b border-gray-200 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">
                                {suggestion.uid} - {displayName}
                              </div>
                              <div className="text-sm text-gray-600">
                                {displayRole} {displayDept && `• ${displayDept}`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Name */}
                <div className={newAuthor.authorCategory ===
   'External' ? '' : 'md:col-span-2'}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newAuthor.name}
                    onChange={(e) => setNewAuthor(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={newAuthor.authorCategory ===
   'Internal' ? 'Auto-filled after entering UID' : 'Enter full name'}
                    readOnly={newAuthor.authorCategory ===
   'Internal' && !!newAuthor.uid}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${newAuthor.authorCategory ===
   'Internal' && !!newAuthor.uid ? 'bg-gray-50' : ''}`}
                  />
                </div>
                
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={newAuthor.email}
                    onChange={(e) => setNewAuthor(prev => ({ ...prev, email: e.target.value }))}
                    placeholder={newAuthor.authorCategory ===
   'Internal' ? 'Auto-filled after entering UID' : 'email@example.com'}
                    readOnly={newAuthor.authorCategory ===
   'Internal' && !!newAuthor.uid}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${newAuthor.authorCategory ===
   'Internal' && !!newAuthor.uid ? 'bg-gray-50' : ''}`}
                  />
                </div>
                
                {/* Affiliation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {newAuthor.authorCategory ===
   'Internal' ? 'Institute:' : 'Organization/Institute:'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newAuthor.affiliation}
                    onChange={(e) => setNewAuthor(prev => ({ ...prev, affiliation: e.target.value }))}
                    placeholder={newAuthor.authorCategory ===
   'Internal' ? 'ResearchSphere' : 'Enter organization/institute name'}
                    readOnly={newAuthor.authorCategory ===
   'Internal'}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${newAuthor.authorCategory ===
   'Internal' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  />
                </div>
                
                {/* Designation - Only for External */}
                {newAuthor.authorCategory ===
   'External' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Designation: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newAuthor.designation}
                      onChange={(e) => setNewAuthor(prev => ({ ...prev, designation: e.target.value }))}
                      placeholder="e.g. Professor, Researcher, etc."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                )}
              </div>
              
              {/* Add/Update Button */}
              <div className="mt-4 flex justify-end gap-3">
                {editingAuthorIndex !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAuthorIndex(null);
                      setNewAuthor({
                        uid: '',
                        name: '',
                        authorType: 'Author',
                        authorCategory: 'Internal',
                        email: '',
                        affiliation: 'ResearchSphere',
                        designation: '',
                      });
                    }}
                    className="inline-flex items-center px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors"
                  >
                    <X className="w-5 h-5 mr-2" />
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={addOrUpdateAuthor}
                  className="inline-flex items-center px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  {editingAuthorIndex !== null ? 'Update Author' : 'Add Author'}
                </button>
              </div>
              
              {/* Added Authors List */}
              {coAuthors.filter(a => a.name).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Added Authors:</h4>
                  <div className="space-y-2">
                    {coAuthors.map((author, index) => author.name && (
                      <div key={index} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                        <div>
                          <div className="font-medium text-gray-900">{author.name}</div>
                          <div className="text-sm text-gray-600">
                            {author.authorCategory} • {author.affiliation}
                            {author.uid && ` • ${author.uid}`}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => editAuthor(index)}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAuthor(index)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Book Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Book Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={(data.bookTitle as string) || ''}
              onChange={(e) => handleChange('bookTitle', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              placeholder="Enter the title of the book"
            />
          </div>

          {/* Chapter Number and Page Numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chapter Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(data.chapterNumber as string) || ''}
                onChange={(e) => handleChange('chapterNumber', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
                placeholder="e.g., Chapter 5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Page Numbers <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(data.pageNumbers as string) || ''}
                onChange={(e) => handleChange('pageNumbers', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
                placeholder="e.g., 101-125"
              />
            </div>
          </div>

          {/* Editors */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Editor(s) Name(s) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={(data.editors as string) || ''}
              onChange={(e) => handleChange('editors', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              placeholder="e.g., Dr. John Smith, Dr. Jane Doe"
            />
          </div>

          {/* Publication Type (Indexing) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Publication Type <span className="text-red-500">*</span>
            </label>
            <select
              value={(data.bookIndexingType as string) || 'scopus_indexed'}
              onChange={(e) => handleChange('bookIndexingType', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            >
              <option value="scopus_indexed">Scopus Indexed</option>
              <option value="non_indexed">Non-Indexed</option>
              <option value="sgt_publication_house">ResearchSphere Publication House</option>
            </select>
          </div>

          {/* Our Authorized Publications - Only for non_indexed */}
          {(data.bookIndexingType as string) ===
   'non_indexed' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Our Authorized Publications <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="inline-flex items-center text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="bookLetter"
                    value="yes"
                    checked={(data.bookLetter as string) ===
   'yes'}
                    onChange={(e) => handleChange('bookLetter', e.target.value)}
                    className="w-4 h-4 text-teal-600"
                  />
                  <span className="ml-1.5 capitalize">Yes</span>
                </label>
                <label className="inline-flex items-center text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="bookLetter"
                    value="no"
                    checked={(data.bookLetter as string) ===
   'no'}
                    onChange={(e) => handleChange('bookLetter', e.target.value)}
                    className="w-4 h-4 text-teal-600"
                  />
                  <span className="ml-1.5 capitalize">No</span>
                </label>
              </div>
            </div>
          )}

          {/* Publisher Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Publisher Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={(data.publisherName as string) || ''}
              onChange={(e) => handleChange('publisherName', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              placeholder="e.g., Springer, Elsevier"
            />
          </div>

          {/* Communication Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Communication Date</label>
            <input
              type="date"
              value={(data.communicationDate as string) || ''}
              onChange={(e) => handleChange('communicationDate', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            />
          </div>

          {/* National/International */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              National / International <span className="text-red-500">*</span>
            </label>
            <select
              value={(data.nationalInternational as string) || 'national'}
              onChange={(e) => handleChange('nationalInternational', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            >
              <option value="national">National</option>
              <option value="international">International</option>
            </select>
          </div>

          {/* Interdisciplinary */}
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
                    className="w-4 h-4 text-teal-600"
                  />
                  <span className="ml-1.5 capitalize">{v}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Communicated with Official ID */}
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
                    className="w-4 h-4 text-teal-600"
                  />
                  <span className="ml-1.5 capitalize">{v}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Personal Email - Only if communicated with personal ID */}
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
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Submission Date</label>
            <input
              type="date"
              value={(data.submissionDate as string) || ''}
              onChange={(e) => handleChange('submissionDate', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Manuscript ID</label>
            <input
              type="text"
              value={(data.manuscriptId as string) || ''}
              onChange={(e) => handleChange('manuscriptId', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              placeholder="e.g., MS-2024-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Submission Portal</label>
            <input
              type="text"
              value={(data.submissionPortal as string) || ''}
              onChange={(e) => handleChange('submissionPortal', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              placeholder="e.g., ScholarOne, Editorial Manager"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Progress Notes</label>
            <textarea
              value={(data.progressNotes as string) || ''}
              onChange={(e) => handleChange('progressNotes', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acceptance Date</label>
            <input
              type="date"
              value={(data.acceptanceDate as string) || ''}
              onChange={(e) => handleChange('acceptanceDate', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={(data.contractSigned as boolean) || false}
                onChange={(e) => handleChange('contractSigned', e.target.checked)}
                className="rounded border-gray-300 text-teal-600 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">Contract Signed</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Publication Date</label>
            <input
              type="date"
              value={(data.expectedPublicationDate as string) || ''}
              onChange={(e) => handleChange('expectedPublicationDate', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Publication Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={(data.publicationDate as string) || ''}
              onChange={(e) => handleChange('publicationDate', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ISBN <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={(data.isbn as string) || ''}
              onChange={(e) => handleChange('isbn', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              placeholder="e.g., 978-3-16-148410-0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Book Title</label>
            <input
              type="text"
              value={(data.bookTitle as string) || ''}
              onChange={(e) => handleChange('bookTitle', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chapter Number</label>
              <input
                type="text"
                value={(data.chapterNumber as string) || ''}
                onChange={(e) => handleChange('chapterNumber', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Page Numbers</label>
              <input
                type="text"
                value={(data.pageNumbers as string) || ''}
                onChange={(e) => handleChange('pageNumbers', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Editor(s)</label>
            <input
              type="text"
              value={(data.editors as string) || ''}
              onChange={(e) => handleChange('editors', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Publication Type</label>
            <select
              value={(data.bookIndexingType as string) || 'scopus_indexed'}
              onChange={(e) => handleChange('bookIndexingType', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            >
              <option value="scopus_indexed">Scopus Indexed</option>
              <option value="non_indexed">Non-Indexed</option>
              <option value="sgt_publication_house">ResearchSphere Publication House</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Publisher Name</label>
            <input
              type="text"
              value={(data.publisherName as string) || ''}
              onChange={(e) => handleChange('publisherName', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">National / International</label>
            <select
              value={(data.nationalInternational as string) || 'national'}
              onChange={(e) => handleChange('nationalInternational', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
            >
              <option value="national">National</option>
              <option value="international">International</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Book Chapter Document</label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleChange('bookDocument', file);
              }}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Faculty Remarks</label>
            <textarea
              value={(data.facultyRemarks as string) || ''}
              onChange={(e) => handleChange('facultyRemarks', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500"
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
