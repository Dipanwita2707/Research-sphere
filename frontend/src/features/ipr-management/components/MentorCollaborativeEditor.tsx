'use client';

import { useState, useEffect } from 'react';
import { 
  Edit3, 
  MessageSquare, 
  Check, 
  X, 
  Save, 
  Eye, 
  AlertCircle,
  Clock,
  User
} from 'lucide-react';
import collaborativeEditingService, { EditSuggestion } from '@/features/ipr-management/services/collaborativeEditing.service';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

// Enum options for dropdown fields
const ENUM_OPTIONS: Record<string, { value: string; label: string }[]> = {
  iprType: [
    { value: 'patent', label: 'Patent' },
    { value: 'copyright', label: 'Copyright' },
    { value: 'trademark', label: 'Trademark' },
    { value: 'design', label: 'Design' },
  ],
  projectType: [
    { value: 'phd', label: 'PhD Research' },
    { value: 'pg_project', label: 'PG Project' },
    { value: 'ug_project', label: 'UG Project' },
    { value: 'faculty_research', label: 'Faculty Research' },
    { value: 'industry_collaboration', label: 'Industry Collaboration' },
    { value: 'any_other', label: 'Any Other' },
  ],
  filingType: [
    { value: 'provisional', label: 'Provisional' },
    { value: 'complete', label: 'Complete' },
  ],
};

// Helper to get display label for enum value
const getEnumLabel = (fieldName: string, value: string): string => {
  const options = ENUM_OPTIONS[fieldName];
  if (options) {
    const option = options.find(opt => opt.value ===
   value);
    return option?.label || value;
  }
  return value;
};

interface MentorCollaborativeEditorProps {
  iprApplicationId: string;
  fieldName: string;
  fieldPath?: string;
  currentValue: string;
  isReviewer?: boolean;
  isApplicant?: boolean;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
  onSuggestionCreated?: () => void;
}

export default function MentorCollaborativeEditor({
  iprApplicationId,
  fieldName,
  fieldPath,
  currentValue,
  isReviewer = false,
  isApplicant = false,
  label,
  placeholder,
  multiline = false,
  disabled = false,
  onChange,
  onSuggestionCreated
}: MentorCollaborativeEditorProps) {
  const { toast } = useToast();
  const [value, setValue] = useState(currentValue);
  const [suggestions, setSuggestions] = useState<EditSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [suggestedValue, setSuggestedValue] = useState('');
  const [suggestionNote, setSuggestionNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setValue(currentValue);
    loadSuggestions();
  }, [currentValue, iprApplicationId, fieldName]);

  const loadSuggestions = async () => {
    try {
      // Use mentor-specific endpoint to get suggestions
      const result = await collaborativeEditingService.getMentorEditSuggestions(iprApplicationId);
      const allSuggestions = result.data?.data?.suggestions || result.data?.suggestions || [];
      const fieldSuggestions = allSuggestions.filter((s: EditSuggestion) => 
        s.fieldName ===
   fieldName || s.fieldPath ===
   fieldPath
      );
      setSuggestions(fieldSuggestions);
    } catch (error: unknown) {
      logger.error('Failed to load mentor suggestions:', error);
    }
  };

  const handleCreateSuggestion = async () => {
    if (!suggestedValue.trim()) return;

    setLoading(true);
    try {
      // Use mentor-specific endpoint to create suggestion
      await collaborativeEditingService.mentorCreateEditSuggestion(iprApplicationId, {
        fieldName,
        fieldPath,
        originalValue: value,
        suggestedValue: suggestedValue.trim(),
        suggestionNote: suggestionNote.trim() || undefined
      });

      setSuggestedValue('');
      setSuggestionNote('');
      setShowSuggestionForm(false);
      await loadSuggestions();
      onSuggestionCreated?.();
    } catch (error: unknown) {
      logger.error('Failed to create mentor suggestion:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleRespondToSuggestion = async (suggestionId: string, action: 'accept' | 'reject', response?: string) => {
    setLoading(true);
    try {
      await collaborativeEditingService.respondToSuggestion(suggestionId, action, response);
      await loadSuggestions();
      
      // If accepted, update the field value
      if (action ===
   'accept') {
        const acceptedSuggestion = suggestions.find(s => s.id ===
   suggestionId);
        if (acceptedSuggestion && acceptedSuggestion.suggestedValue) {
          setValue(acceptedSuggestion.suggestedValue);
          onChange?.(acceptedSuggestion.suggestedValue);
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to respond to suggestion:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const pendingSuggestions = suggestions.filter(s => s.status ===
   'pending');
  const hasPendingSuggestions = pendingSuggestions.length > 0;
  const hasAnySuggestions = suggestions.length > 0;
  
  // Check if this field is an enum field
  const isEnumField = fieldName in ENUM_OPTIONS;
  const enumOptions = ENUM_OPTIONS[fieldName] || [];

  return (
    <div className="space-y-3">
      {/* Field Label with Suggestion Indicator */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          {label}
          {hasPendingSuggestions && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
              <Clock className="w-3 h-3" />
              {pendingSuggestions.length} pending
            </span>
          )}
          {hasAnySuggestions && (
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="text-[#7d1a34] hover:text-[#7d1a34] text-xs"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
        </label>

        {/* Reviewer Actions */}
        {isReviewer && !disabled && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowSuggestionForm(!showSuggestionForm)}
              className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 text-sm"
            >
              <Edit3 className="w-4 h-4" />
              Suggest Edit
            </button>
          </div>
        )}
      </div>

      {/* Input Field */}
      <div className="relative">
        {isEnumField ? (
          // Dropdown for enum fields
          <select
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onChange?.(e.target.value);
            }}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
              hasPendingSuggestions ? 'border-orange-300 bg-orange-50' : 'border-gray-300'
            } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
          >
            <option value="">Select {label}</option>
            {enumOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : multiline ? (
          <textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onChange?.(e.target.value);
            }}
            placeholder={placeholder}
            disabled={disabled}
            rows={4}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-vertical ${
              hasPendingSuggestions ? 'border-orange-300 bg-orange-50' : 'border-gray-300'
            } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onChange?.(e.target.value);
            }}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
              hasPendingSuggestions ? 'border-orange-300 bg-orange-50' : 'border-gray-300'
            } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
          />
        )}
        
        {hasPendingSuggestions && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <AlertCircle className="h-5 w-5 text-orange-500" />
          </div>
        )}
      </div>

      {/* Suggestion Form (Mentor) */}
      {showSuggestionForm && isReviewer && (
        <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
          <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-purple-600" />
            Suggest Edit for "{label}"
          </h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Suggested Value *
              </label>
              {isEnumField ? (
                <select
                  value={suggestedValue}
                  onChange={(e) => setSuggestedValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                >
                  <option value="">Select suggested {label.toLowerCase()}</option>
                  {enumOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : multiline ? (
                <textarea
                  value={suggestedValue}
                  onChange={(e) => setSuggestedValue(e.target.value)}
                  placeholder="Enter your suggested changes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
              ) : (
                <input
                  type="text"
                  value={suggestedValue}
                  onChange={(e) => setSuggestedValue(e.target.value)}
                  placeholder="Enter your suggested changes..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Note/Explanation (Optional)
              </label>
              <textarea
                value={suggestionNote}
                onChange={(e) => setSuggestionNote(e.target.value)}
                placeholder="Explain why you suggest this change..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSuggestionForm(false)}
                disabled={loading}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSuggestion}
                disabled={loading || !suggestedValue.trim()}
                className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
              >
                {loading ? <Clock className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {loading ? 'Creating...' : 'Create Suggestion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions List */}
      {showSuggestions && hasAnySuggestions && (
        <div className="border border-gray-200 rounded-lg bg-gray-50">
          <div className="px-4 py-2 border-b border-gray-200 bg-purple-100 rounded-t-lg">
            <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-600" />
              Mentor Edit Suggestions ({suggestions.length})
            </h4>
          </div>

          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <div 
                key={suggestion.id} 
                className={`border rounded-lg p-3 ${
                  suggestion.status ===
   'pending' ? 'border-orange-200 bg-orange-50' : 
                  suggestion.status ===
   'accepted' ? 'border-green-200 bg-green-50' :
                  'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {suggestion.reviewer?.employeeDetails?.displayName || suggestion.reviewer?.uid || 'Mentor'}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                      Mentor
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      suggestion.status ===
   'pending' ? 'bg-orange-100 text-orange-800' :
                      suggestion.status ===
   'accepted' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {suggestion.status}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(suggestion.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-1">Suggested Change:</div>
                    <div className="text-sm bg-white p-2 rounded border border-gray-200">
                      {isEnumField && suggestion.suggestedValue
                        ? getEnumLabel(fieldName, suggestion.suggestedValue)
                        : suggestion.suggestedValue}
                    </div>
                  </div>

                  {suggestion.suggestionNote && (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Note:</div>
                      <div className="text-sm text-gray-600 italic">
                        {suggestion.suggestionNote}
                      </div>
                    </div>
                  )}

                  {suggestion.applicantResponse && (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Student Response:</div>
                      <div className="text-sm text-gray-600">
                        {suggestion.applicantResponse}
                      </div>
                    </div>
                  )}
                </div>

                {/* Applicant Action Buttons */}
                {isApplicant && suggestion.status ===
   'pending' && (
                  <div className="flex gap-2 mt-3 pt-2 border-t border-gray-200">
                    <button
                      onClick={() => handleRespondToSuggestion(suggestion.id, 'accept')}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" />
                      Accept
                    </button>
                    <button
                      onClick={() => {
                        const response = prompt('Reason for rejection (optional):');
                        if (response !== null) {
                          handleRespondToSuggestion(suggestion.id, 'reject', response);
                        }
                      }}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      <X className="w-3 h-3" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
