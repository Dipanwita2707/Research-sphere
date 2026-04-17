'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, Edit2, Check, User, Users, Building2 } from 'lucide-react';
import { researchService } from '@/features/research-management/services/research.service';
import { useAuthStore } from '@/shared/auth/authStore';
import logger from '@/shared/utils/logger';

type AuthorRole = 'First Author' | 'Co-Author' | 'Corresponding Author' | 'Author';

interface Author {
  uid?: string;
  name: string;
  authorType: 'Faculty' | 'Student';
  authorCategory: 'Internal' | 'External';
  authorRole: AuthorRole;
  email?: string;
  affiliation: string;
  designation?: string;
}

interface AuthorManagerProps {
  authors: Author[];
  onChange: (authors: Author[]) => void;
  disabled?: boolean;
  label?: string;
  publicationType?: 'research_paper' | 'book' | 'book_chapter' | 'conference_paper';
}

export default function AuthorManager({ authors, onChange, disabled = false, label = 'Co-Authors', publicationType = 'research_paper' }: AuthorManagerProps) {
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const isBook = publicationType ===
   'book' || publicationType ===
   'book_chapter';
  const [newAuthor, setNewAuthor] = useState<Author>({
    name: '',
    authorType: 'Faculty',
    authorCategory: 'Internal',
    authorRole: isBook ? 'Author' : 'Co-Author',
    affiliation: 'SGT University',
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

  const searchAuthors = async (term: string) => {
    if (term.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const role = newAuthor.authorType ===
   'Student' ? 'student' : newAuthor.authorType ===
   'Faculty' ? 'faculty' : 'all';
      const response = await researchService.searchUsers(term, role);
      
      let userData = [];
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
      
      let userEmail = fullUser?.email || fullUser?.employeeDetails?.email || fullUser?.studentProfile?.email || '';

      setNewAuthor({
        uid: userData.uid,
        name: userName,
        authorType: authorType,
        authorCategory: 'Internal',
        authorRole: newAuthor.authorRole,
        email: userEmail,
        affiliation: 'SGT University',
        designation: userData.designation || ''
      });

      setSearchTerm(userName);
      setShowSuggestions(false);
      setSearchSuggestions([]);
    } catch (error) {
      logger.error('Error fetching author details:', error);
    }
  };

  const addAuthor = () => {
    setError('');

    if (!newAuthor.name.trim()) {
      setError('Author name is required');
      return;
    }

    if (newAuthor.authorCategory ===
   'Internal' && !newAuthor.uid) {
      setError('Please select an internal author from search results');
      return;
    }

    if (newAuthor.authorCategory ===
   'External' && !newAuthor.affiliation.trim()) {
      setError('Affiliation is required for external authors');
      return;
    }

    // Check for duplicates
    if (authors.some(a => a.uid && a.uid ===
   newAuthor.uid)) {
      setError('This author has already been added');
      return;
    }

    // Validate no multiple First Authors (only for research papers)
    if (!isBook && newAuthor.authorRole ===
   'First Author' && authors.some(a => a.authorRole ===
   'First Author')) {
      setError('Only one First Author is allowed');
      return;
    }

    // Validate no multiple Corresponding Authors (only for research papers)
    if (!isBook && newAuthor.authorRole ===
   'Corresponding Author' && authors.some(a => a.authorRole ===
   'Corresponding Author')) {
      setError('Only one Corresponding Author is allowed');
      return;
    }

    onChange([...authors, { ...newAuthor }]);

    // Reset form
    setNewAuthor({
      name: '',
      authorType: 'Faculty',
      authorCategory: 'Internal',
      authorRole: isBook ? 'Author' : 'Co-Author',
      affiliation: 'SGT University',
      email: ''
    });
    setSearchTerm('');
    setSearchSuggestions([]);
    setShowSuggestions(false);
  };

  const removeAuthor = (index: number) => {
    onChange(authors.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {!isEditing && !disabled && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
          >
            <Edit2 className="w-4 h-4" />
            {authors.length > 0 ? 'Edit' : 'Add'} Authors
          </button>
        )}
      </div>

      {/* Display current authors */}
      {authors.length > 0 && (
        <div className="space-y-2">
          {authors.map((author, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  author.authorCategory ===
   'Internal' ? 'bg-green-100' : 'bg-blue-100'
                }`}>
                  {author.authorCategory ===
   'Internal' ? (
                    <User className={`w-5 h-5 ${author.authorCategory ===
   'Internal' ? 'text-green-600' : 'text-blue-600'}`} />
                  ) : (
                    <Building2 className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{author.name}</span>
                    {author.uid && (
                      <span className="text-xs text-gray-500">({author.uid})</span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      author.authorRole ===
   'First Author' ? 'bg-purple-100 text-purple-700' :
                      author.authorRole ===
   'Corresponding Author' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {author.authorRole}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      author.authorCategory ===
   'Internal' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {author.authorCategory}
                    </span>
                    <span>•</span>
                    <span>{author.authorType}</span>
                    {author.affiliation !== 'SGT University' && (
                      <>
                        <span>•</span>
                        <span>{author.affiliation}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => removeAuthor(index)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {authors.length ===
   0 && !isEditing && (
        <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No co-authors added yet</p>
        </div>
      )}

      {/* Add author form */}
      {isEditing && !disabled && (
        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {/* Role Selection - Only show dropdown for research papers, show readonly for books */}
            {isBook ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <input
                  type="text"
                  value="Author"
                  readOnly
                  className="w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-700 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  All contributors are authors
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={newAuthor.authorRole}
                  onChange={(e) => setNewAuthor({ ...newAuthor, authorRole: e.target.value as AuthorRole })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option 
                    value="First Author"
                    disabled={authors.some(a => a.authorRole ===
   'First Author')}
                  >
                    First Author {authors.some(a => a.authorRole ===
   'First Author') && '(Already assigned)'}
                  </option>
                  <option value="Co-Author">Co-Author</option>
                  <option 
                    value="Corresponding Author"
                    disabled={authors.some(a => a.authorRole ===
   'Corresponding Author')}
                  >
                    Corresponding Author {authors.some(a => a.authorRole ===
   'Corresponding Author') && '(Already assigned)'}
                  </option>
                </select>
                {(authors.some(a => a.authorRole ===
   'First Author') || authors.some(a => a.authorRole ===
   'Corresponding Author')) && (
                  <p className="text-xs text-gray-500 mt-1">
                    Some roles are already assigned
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={newAuthor.authorCategory}
                onChange={(e) => {
                  const category = e.target.value as 'Internal' | 'External';
                  setNewAuthor({
                    ...newAuthor,
                    authorCategory: category,
                    affiliation: category ===
   'Internal' ? 'SGT University' : '',
                    uid: category ===
   'External' ? undefined : newAuthor.uid
                  });
                  setSearchTerm('');
                }}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="Internal">Internal (SGT)</option>
                <option value="External">External</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={newAuthor.authorType}
                onChange={(e) => setNewAuthor({ ...newAuthor, authorType: e.target.value as 'Faculty' | 'Student' })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="Faculty">Faculty/Employee</option>
                <option value="Student">Student</option>
              </select>
            </div>
          </div>

          {newAuthor.authorCategory ===
   'Internal' ? (
            <div ref={searchRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search by UID/Name</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    searchAuthors(e.target.value);
                  }}
                  placeholder="Type to search..."
                  className="w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                  {searchSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectAuthorFromSuggestion(suggestion)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-b-0"
                    >
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newAuthor.name}
                  onChange={(e) => setNewAuthor({ ...newAuthor, name: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="External author name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Affiliation</label>
                <input
                  type="text"
                  value={newAuthor.affiliation}
                  onChange={(e) => setNewAuthor({ ...newAuthor, affiliation: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="University/Organization"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={newAuthor.email || ''}
                  onChange={(e) => setNewAuthor({ ...newAuthor, email: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="email@example.com"
                />
              </div>
            </>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={addAuthor}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Author
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setNewAuthor({
                  name: '',
                  authorType: 'Faculty',
                  authorCategory: 'Internal',
                  authorRole: 'Co-Author',
                  affiliation: 'SGT University',
                  email: ''
                });
                setSearchTerm('');
                setError('');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center justify-center gap-2"
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
