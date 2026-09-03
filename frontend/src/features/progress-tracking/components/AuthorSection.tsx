'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Users, Plus, X, Search, User, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { researchService } from '@/features/research-management/services/research.service';
import { useAuthStore } from '@/shared/auth/authStore';
import logger from '@/shared/utils/logger';

type AuthorRole = 'First Author' | 'Co-Author' | 'Corresponding Author' | 'Author';

interface CoAuthor {
  uid?: string;
  name: string;
  authorType: 'Faculty' | 'Student';
  authorCategory: 'Internal' | 'External';
  authorRole: AuthorRole;
  email?: string;
  affiliation: string;
  designation?: string;
}

interface AuthorSectionProps {
  publicationType: 'research_paper' | 'book' | 'book_chapter' | 'conference_paper';
  conferenceSubType?: string;
  onAuthorDataChange: (data: AuthorData) => void;
}

export interface AuthorData {
  totalAuthors: number;
  totalInternalAuthors: number;
  totalInternalCoAuthors?: number;
  userAuthorRole?: string;
  hasInternationalAuthor?: 'yes' | 'no';
  hasLpuStudents?: 'yes' | 'no';
  numForeignUniversities?: number;
  coAuthors?: CoAuthor[];
}

export default function AuthorSection({ publicationType, conferenceSubType, onAuthorDataChange }: AuthorSectionProps) {
  const { user } = useAuthStore();
  
  // For conferences, only show author section for paper types
  const shouldShowAuthors = publicationType !== 'conference_paper' || 
    conferenceSubType ===
   'paper_not_indexed' || 
    conferenceSubType ===
   'paper_indexed_scopus';

  const [totalAuthors, setTotalAuthors] = useState(1);
  const [totalInternalAuthors, setTotalInternalAuthors] = useState(1);
  const [totalInternalCoAuthors, setTotalInternalCoAuthors] = useState(0);
  const [userAuthorRole, setUserAuthorRole] = useState('first_and_corresponding');
  const [hasInternationalAuthor, setHasInternationalAuthor] = useState<'yes' | 'no'>('yes');
  const [hasLpuStudents, setHasLpuStudents] = useState<'yes' | 'no'>('yes');
  const [numForeignUniversities, setNumForeignUniversities] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Co-author management state
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([]);
  const [showCoAuthorForm, setShowCoAuthorForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const isBook = publicationType ===
   'book' || publicationType ===
   'book_chapter';
  const [newCoAuthor, setNewCoAuthor] = useState<CoAuthor>({
    name: '',
    authorType: 'Faculty',
    authorCategory: 'Internal',
    authorRole: isBook ? 'Author' : 'Co-Author',
    affiliation: 'ResearchSphere',
    email: ''
  });

  // Show detailed fields for research papers AND conference papers with author requirements
  const isResearchOrScopusConference = 
    publicationType ===
   'research_paper' || 
    (publicationType ===
   'conference_paper' && (conferenceSubType ===
   'paper_not_indexed' || conferenceSubType ===
   'paper_indexed_scopus'));
  const isBookOrChapter = publicationType ===
   'book' || publicationType ===
   'book_chapter';
  const hasExternalAuthors = totalAuthors > totalInternalAuthors;

  const updateData = (updates: Partial<AuthorData>) => {
    const data: AuthorData = {
      totalAuthors,
      totalInternalAuthors,
      coAuthors,
      ...(isResearchOrScopusConference && { 
        totalInternalCoAuthors,
        userAuthorRole 
      }),
      ...(isResearchOrScopusConference && hasExternalAuthors && { 
        hasInternationalAuthor,
        numForeignUniversities: hasInternationalAuthor ===
   'yes' ? numForeignUniversities : 0
      }),
      ...(isResearchOrScopusConference && { hasLpuStudents }),
      ...updates
    };
    onAuthorDataChange(data);
  };
  
  // Search for internal authors
  const searchAuthors = async (term: string) => {
    if (term.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const role = newCoAuthor.authorType ===
   'Student' ? 'student' : newCoAuthor.authorType ===
   'Faculty' ? 'faculty' : 'all';
      const response = await researchService.searchUsers(term, role);
      
      let userData: any[] = [];
      if (response?.data && Array.isArray(response.data)) {
        userData = response.data;
      } else if (response?.users && Array.isArray(response.users)) {
        userData = response.users;
      } else if (Array.isArray(response)) {
        userData = response;
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
  
  // Select author from suggestions
  const selectAuthorFromSuggestion = async (userData: any) => {
    if (userData.uid ===
   user?.uid) {
      setError('Cannot add yourself as a co-author');
      return;
    }

    const userName = userData.name || userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
    const roleName = typeof userData.role ===
   'object' ? userData.role?.name : userData.role;
    const authorType = roleName ===
   'student' ? 'Student' : 'Faculty';

    try {
      const fullData = await researchService.lookupByRegistration(userData.uid);
      const fullUser = fullData.data || fullData;
      
      const userEmail = fullUser?.email || fullUser?.employeeDetails?.email || fullUser?.studentProfile?.email || '';

      setNewCoAuthor({
        uid: userData.uid,
        name: userName,
        authorType: authorType as 'Faculty' | 'Student',
        authorCategory: 'Internal',
        authorRole: newCoAuthor.authorRole,
        email: userEmail,
        affiliation: 'ResearchSphere',
        designation: userData.designation || ''
      });

      setSearchTerm(userName);
      setShowSuggestions(false);
      setSearchSuggestions([]);
    } catch (error) {
      logger.error('Error fetching user details:', error);
    }
  };
  
  // Add co-author to list
  const addCoAuthor = () => {
    if (!newCoAuthor.name.trim()) {
      setError('Please enter co-author name');
      return;
    }
    
    // Check for duplicate
    if (coAuthors.some(a => a.name.toLowerCase() ===
   newCoAuthor.name.toLowerCase())) {
      setError('This co-author is already added');
      return;
    }
    
    const updatedCoAuthors = [...coAuthors, newCoAuthor];
    setCoAuthors(updatedCoAuthors);
    setNewCoAuthor({
      name: '',
      authorType: 'Faculty',
      authorCategory: 'Internal',
      authorRole: isBook ? 'Author' : 'Co-Author',
      affiliation: 'ResearchSphere',
      email: ''
    });
    setSearchTerm('');
    setError(null);
    setShowCoAuthorForm(false);
    updateData({ coAuthors: updatedCoAuthors });
  };
  
  // Remove co-author from list
  const removeCoAuthor = (index: number) => {
    const updatedCoAuthors = coAuthors.filter((_, i) => i !== index);
    setCoAuthors(updatedCoAuthors);
    updateData({ coAuthors: updatedCoAuthors });
  };

  const handleTotalAuthorsChange = (value: number) => {
    if (value < 1) {
      setError('Total authors must be at least 1');
      return;
    }
    setTotalAuthors(value);
    if (totalInternalAuthors > value) {
      setTotalInternalAuthors(value);
    }
    setError(null);
    updateData({ totalAuthors: value });
  };

  const handleInternalAuthorsChange = (value: number) => {
    if (value < 1) {
      setError('ResearchSphere authors must be at least 1 (you)');
      return;
    }
    if (value > totalAuthors) {
      setError('ResearchSphere authors cannot exceed total authors');
      return;
    }
    setTotalInternalAuthors(value);
    const maxCoAuthors = value - 1;
    if (totalInternalCoAuthors > maxCoAuthors) {
      setTotalInternalCoAuthors(maxCoAuthors);
    }
    setError(null);
    updateData({ totalInternalAuthors: value });
  };

  const handleInternalCoAuthorsChange = (value: number) => {
    const maxCoAuthors = totalInternalAuthors - 1;
    if (value < 0) {
      setError('Internal co-authors cannot be negative');
      return;
    }
    if (value > maxCoAuthors) {
      setError(`Internal co-authors cannot exceed ${maxCoAuthors}`);
      return;
    }
    setTotalInternalCoAuthors(value);
    setError(null);
    updateData({ totalInternalCoAuthors: value });
  };

  const handleForeignUniversitiesChange = (value: number) => {
    const maxExternal = totalAuthors - totalInternalAuthors;
    if (value < 0) {
      setError('Foreign universities cannot be negative');
      return;
    }
    if (value > maxExternal) {
      setError(`Foreign universities cannot exceed ${maxExternal} (external authors)`);
      return;
    }
    setNumForeignUniversities(value);
    setError(null);
    updateData({ numForeignUniversities: value });
  };

  // If conference type doesn't need authors, show message
  if (!shouldShowAuthors) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          Author information is not required for this conference type.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Basic Author Counts */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Authors <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={totalAuthors}
            onChange={(e) => handleTotalAuthorsChange(Number(e.target.value))}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ResearchSphere Authors <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            max={totalAuthors}
            value={totalInternalAuthors}
            onChange={(e) => handleInternalAuthorsChange(Number(e.target.value))}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="1"
          />
        </div>

        {/* Internal Co-Authors - Only for Research Papers */}
        {isResearchOrScopusConference && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Internal Co-Authors <span className="text-red-500">*</span>
              <span className="text-gray-400 text-xs ml-1">(Max: {totalInternalAuthors - 1})</span>
            </label>
            <input
              type="number"
              min="0"
              max={totalInternalAuthors - 1}
              value={totalInternalCoAuthors}
              onChange={(e) => handleInternalCoAuthorsChange(Number(e.target.value))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="0"
            />
          </div>
        )}
      </div>

      {/* Your Role - Only for Research Papers */}
      {isResearchOrScopusConference && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Role <span className="text-red-500">*</span>
          </label>
          <select
            value={userAuthorRole}
            onChange={(e) => {
              setUserAuthorRole(e.target.value);
              updateData({ userAuthorRole: e.target.value });
            }}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="first_and_corresponding">First & Corresponding Author</option>
            <option value="corresponding">Corresponding Author</option>
            <option value="first">First Author</option>
            <option value="co_author">Co-Author</option>
          </select>
        </div>
      )}

      {/* Additional Info for Books/Chapters */}
      {isBookOrChapter && (
        <div className="flex items-center text-sm text-teal-700 bg-teal-50 px-4 py-3 rounded-lg border border-teal-200">
          <Users className="w-5 h-5 mr-2 flex-shrink-0" />
          Incentive will be distributed equally among all ResearchSphere authors
        </div>
      )}

      {/* Additional Author Information - Only for Research Papers and when there are external authors */}
      {isResearchOrScopusConference && (
        <>
          <div className="border-t border-gray-200 pt-4"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* International Author - Only show when there are external authors */}
            {hasExternalAuthors && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  International Author <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  {['yes', 'no'].map((v) => (
                    <label key={v} className="inline-flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="hasInternationalAuthor"
                        value={v}
                        checked={hasInternationalAuthor ===
   v}
                        onChange={(e) => {
                          const value = e.target.value as 'yes' | 'no';
                          setHasInternationalAuthor(value);
                          if (value ===
   'no') {
                            setNumForeignUniversities(0);
                          }
                          updateData({ hasInternationalAuthor: value, numForeignUniversities: value ===
   'no' ? 0 : numForeignUniversities });
                        }}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span className="ml-2 capitalize text-gray-700">{v}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student(s) from ResearchSphere <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                {['yes', 'no'].map((v) => (
                  <label key={v} className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="hasLpuStudents"
                      value={v}
                      checked={hasLpuStudents ===
   v}
                      onChange={(e) => {
                        const value = e.target.value as 'yes' | 'no';
                        setHasLpuStudents(value);
                        updateData({ hasLpuStudents: value });
                      }}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="ml-2 capitalize text-gray-700">{v}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Foreign Universities - Only show when International Author is Yes */}
            {hasInternationalAuthor ===
   'yes' && hasExternalAuthors && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Foreign Universities Collaborated
                  {numForeignUniversities > 0 && (
                    <span className="text-orange-600 text-xs ml-1">
                      (Requires {numForeignUniversities} external author{numForeignUniversities > 1 ? 's' : ''})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  max={totalAuthors - totalInternalAuthors}
                  value={numForeignUniversities}
                  onChange={(e) => handleForeignUniversitiesChange(Number(e.target.value))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="0"
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Co-Author Details Section */}
      {totalAuthors > 1 && (
        <div className="border-t border-gray-200 pt-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                Co-Author Details
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                Add details for each co-author (you can add up to {totalAuthors - 1} co-author{totalAuthors > 2 ? 's' : ''})
              </p>
            </div>
            {coAuthors.length < totalAuthors - 1 && !showCoAuthorForm && (
              <button
                type="button"
                onClick={() => setShowCoAuthorForm(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Co-Author
              </button>
            )}
          </div>

          {/* Existing Co-Authors List */}
          {coAuthors.length > 0 && (
            <div className="space-y-3 mb-4">
              {coAuthors.map((author, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      author.authorCategory ===
   'Internal' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {author.authorType ===
   'Student' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{author.name}</p>
                      <p className="text-xs text-gray-500">
                        {author.authorRole} • {author.authorType} • {author.authorCategory} • {author.affiliation}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCoAuthor(index)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                    title="Remove co-author"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Co-Author Form */}
          {showCoAuthorForm && (
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-medium text-purple-800">Add New Co-Author</h5>
                <button
                  type="button"
                  onClick={() => {
                    setShowCoAuthorForm(false);
                    setNewCoAuthor({
                      name: '',
                      authorType: 'Faculty',
                      authorCategory: 'Internal',
                      authorRole: isBook ? 'Author' : 'Co-Author',
                      affiliation: 'ResearchSphere',
                      email: ''
                    });
                    setSearchTerm('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Author Category Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Author Category</label>
                  <select
                    value={newCoAuthor.authorCategory}
                    onChange={(e) => {
                      const category = e.target.value as 'Internal' | 'External';
                      setNewCoAuthor({
                        ...newCoAuthor,
                        authorCategory: category,
                        affiliation: category ===
   'Internal' ? 'ResearchSphere' : ''
                      });
                      setSearchTerm('');
                    }}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
                  >
                    <option value="Internal">Internal (ResearchSphere)</option>
                    <option value="External">External</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Author Type</label>
                  <select
                    value={newCoAuthor.authorType}
                    onChange={(e) => {
                      setNewCoAuthor({ ...newCoAuthor, authorType: e.target.value as 'Faculty' | 'Student' });
                      setSearchTerm('');
                    }}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
                  >
                    <option value="Faculty">Faculty</option>
                    <option value="Student">Student</option>
                  </select>
                </div>
              </div>

              {/* Search/Name Input */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {newCoAuthor.authorCategory ===
   'Internal' ? 'Search by Name/ID' : 'Author Name'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm || newCoAuthor.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchTerm(value);
                      if (newCoAuthor.authorCategory ===
   'Internal') {
                        searchAuthors(value);
                      } else {
                        setNewCoAuthor({ ...newCoAuthor, name: value });
                      }
                    }}
                    placeholder={newCoAuthor.authorCategory ===
   'Internal' ? 'Type to search faculty/student...' : 'Enter author name'}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm pl-8"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>

                {/* Search Suggestions */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                    {searchSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectAuthorFromSuggestion(suggestion)}
                        className="w-full px-3 py-2 text-left hover:bg-purple-50 flex items-center gap-2"
                      >
                        <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                          <User className="w-3 h-3 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {suggestion.name || suggestion.displayName || `${suggestion.firstName || ''} ${suggestion.lastName || ''}`}
                          </p>
                          <p className="text-xs text-gray-500">{suggestion.uid} • {suggestion.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Role & Affiliation */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={newCoAuthor.authorRole}
                    onChange={(e) => setNewCoAuthor({ ...newCoAuthor, authorRole: e.target.value as AuthorRole })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
                  >
                    {isBook ? (
                      <option value="Author">Author</option>
                    ) : (
                      <>
                        <option value="Co-Author">Co-Author</option>
                        <option value="First Author">First Author</option>
                        <option value="Corresponding Author">Corresponding Author</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Affiliation</label>
                  <input
                    type="text"
                    value={newCoAuthor.affiliation}
                    onChange={(e) => setNewCoAuthor({ ...newCoAuthor, affiliation: e.target.value })}
                    placeholder="University/Organization"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
                    disabled={newCoAuthor.authorCategory ===
   'Internal'}
                  />
                </div>
              </div>

              {/* Email (Optional for external) */}
              {newCoAuthor.authorCategory ===
   'External' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={newCoAuthor.email || ''}
                    onChange={(e) => setNewCoAuthor({ ...newCoAuthor, email: e.target.value })}
                    placeholder="author@example.com"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
                  />
                </div>
              )}

              {/* Add Button */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCoAuthorForm(false);
                    setNewCoAuthor({
                      name: '',
                      authorType: 'Faculty',
                      authorCategory: 'Internal',
                      authorRole: isBook ? 'Author' : 'Co-Author',
                      affiliation: 'ResearchSphere',
                      email: ''
                    });
                    setSearchTerm('');
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addCoAuthor}
                  className="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Co-Author
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {coAuthors.length ===
   0 && !showCoAuthorForm && (
            <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No co-authors added yet</p>
              <button
                type="button"
                onClick={() => setShowCoAuthorForm(true)}
                className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                + Add your first co-author
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
