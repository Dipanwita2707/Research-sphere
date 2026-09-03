'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Edit3, 
  Check, 
  X, 
  MessageSquare, 
  Save,
  Eye,
  EyeOff,
  User,
  Clock
} from 'lucide-react';
import { SUGGESTION_STATUS } from '@/shared/constants';

interface Change {
  id: string;
  type: 'insert' | 'delete' | 'replace';
  originalText: string;
  newText: string;
  position: number;
  reviewer: string;
  timestamp: string;
  status: 'pending' | 'accepted' | 'rejected';
  comment?: string;
}

interface GoogleDocsEditorProps {
  iprApplicationId: string;
  fieldName: string;
  initialValue: string;
  isReviewer?: boolean;
  isApplicant?: boolean;
  label: string;
  multiline?: boolean;
  onSave?: (value: string, changes: Change[]) => void;
}

export default function GoogleDocsEditor({
  iprApplicationId,
  fieldName,
  initialValue,
  isReviewer = false,
  isApplicant = false,
  label,
  multiline = false,
  onSave
}: GoogleDocsEditorProps) {
  const [originalText, setOriginalText] = useState(initialValue);
  const [currentText, setCurrentText] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [changes, setChanges] = useState<Change[]>([]);
  const [showChanges, setShowChanges] = useState(true);
  const [comment, setComment] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Generate unique change ID
  const generateChangeId = () => `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Detect changes between original and current text
  const detectChanges = (original: string, current: string): Change[] => {
    if (original ===
   current) return [];
    
    // Simple change detection - in real implementation, use a diff algorithm
    const newChange: Change = {
      id: generateChangeId(),
      type: 'replace',
      originalText: original,
      newText: current,
      position: 0,
      reviewer: isReviewer ? 'DRD Reviewer' : 'Applicant',
      timestamp: new Date().toISOString(),
      status: 'pending',
      comment: comment
    };

    return [newChange];
  };

  // Render text with change highlights
  const renderTextWithChanges = (text: string, changes: Change[]) => {
    if (!showChanges || changes.length ===
   0) {
      return text;
    }

    return changes.map((change, index) => {
      if (change.type ===
   'replace') {
        return (
          <div key={change.id} className="relative inline">
            {/* Original text (struck through) */}
            <span className="bg-red-100 text-red-800 line-through px-1 rounded">
              {change.originalText}
            </span>
            {/* New text (highlighted) */}
            <span className="bg-green-100 text-green-800 px-1 rounded ml-1">
              {change.newText}
            </span>
            {/* Change indicator */}
            <span className="inline-flex items-center ml-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                change.status ===
   SUGGESTION_STATUS.PENDING ? 'bg-yellow-100 text-yellow-800' :
                change.status ===
   SUGGESTION_STATUS.ACCEPTED ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                <User className="w-3 h-3" />
                {change.reviewer}
                {change.status ===
   SUGGESTION_STATUS.PENDING && <Clock className="w-3 h-3" />}
                {change.status ===
   SUGGESTION_STATUS.ACCEPTED && <Check className="w-3 h-3" />}
                {change.status ===
   SUGGESTION_STATUS.REJECTED && <X className="w-3 h-3" />}
              </span>
            </span>
          </div>
        );
      }
      return null;
    });
  };

  // Handle text change
  const handleTextChange = (newText: string) => {
    setCurrentText(newText);
  };

  // Save changes
  const handleSaveChanges = () => {
    const detectedChanges = detectChanges(originalText, currentText);
    setChanges(detectedChanges);
    setIsEditing(false);
    
    if (onSave) {
      onSave(currentText, detectedChanges);
    }
  };

  // Accept a change (for applicants)
  const handleAcceptChange = (changeId: string) => {
    setChanges(prev => prev.map(change => 
      change.id ===
   changeId 
        ? { ...change, status: 'accepted' as const }
        : change
    ));
    
    // Apply the change to original text
    const change = changes.find(c => c.id ===
   changeId);
    if (change && change.type ===
   'replace') {
      setOriginalText(change.newText);
      setCurrentText(change.newText);
    }
  };

  // Reject a change (for applicants)
  const handleRejectChange = (changeId: string) => {
    setChanges(prev => prev.map(change => 
      change.id ===
   changeId 
        ? { ...change, status: 'rejected' as const }
        : change
    ));
    
    // Revert to original text
    const change = changes.find(c => c.id ===
   changeId);
    if (change && change.type ===
   'replace') {
      setCurrentText(originalText);
    }
  };

  // Check if there are pending changes from reviewer
  const hasPendingReviewerChanges = changes.some(c => c.status ===
   SUGGESTION_STATUS.PENDING && c.reviewer !== 'Applicant');
  
  // Check if there are pending changes from applicant
  const hasPendingApplicantChanges = changes.some(c => c.status ===
   SUGGESTION_STATUS.PENDING && c.reviewer ===
   'Applicant');

  return (
    <div className="space-y-3">
      {/* Field Label with Change Indicators */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          {label}
          {hasPendingReviewerChanges && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
              <Clock className="w-3 h-3" />
              {changes.filter(c => c.status ===
   SUGGESTION_STATUS.PENDING).length} pending
            </span>
          )}
        </label>

        <div className="flex items-center gap-2">
          {/* Toggle change visibility */}
          <button
            onClick={() => setShowChanges(!showChanges)}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
          >
            {showChanges ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showChanges ? 'Hide Changes' : 'Show Changes'}
          </button>

          {/* Edit button for reviewers */}
          {isReviewer && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1 px-3 py-1 bg-[#fdf5ec] text-[#7d1a34] rounded-md hover:bg-[#fbe2e8] text-sm"
            >
              <Edit3 className="w-4 h-4" />
              Edit & Suggest
            </button>
          )}
        </div>
      </div>

      {/* Editing Mode (for reviewers) */}
      {isEditing && isReviewer ? (
        <div className="space-y-3">
          <div className="relative">
            {multiline ? (
              <textarea
                ref={textareaRef}
                value={currentText}
                onChange={(e) => handleTextChange(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-[#f0e2d2] rounded-lg focus:ring-2 focus:ring-[#7d1a34] focus:border-[#7d1a34] resize-vertical"
                placeholder="Make your changes..."
              />
            ) : (
              <input
                type="text"
                value={currentText}
                onChange={(e) => handleTextChange(e.target.value)}
                className="w-full px-3 py-2 border border-[#f0e2d2] rounded-lg focus:ring-2 focus:ring-[#7d1a34] focus:border-[#7d1a34]"
                placeholder="Make your changes..."
              />
            )}
          </div>

          {/* Comment for the change */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Comment (optional)</label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Explain your suggested change..."
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#7d1a34]"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSaveChanges}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setCurrentText(originalText);
                setComment('');
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* View Mode with Change Tracking */
        <div className="space-y-3">
          {/* Display field with changes highlighted */}
          <div className="min-h-[100px] p-3 border border-gray-300 rounded-lg bg-gray-50">
            {changes.length ===
   0 ? (
              <div className="text-gray-700 whitespace-pre-wrap">
                {originalText || `No ${label.toLowerCase()} provided`}
              </div>
            ) : (
              <div className="space-y-2">
                {showChanges ? (
                  <div className="text-gray-700">
                    {renderTextWithChanges(currentText, changes)}
                  </div>
                ) : (
                  <div className="text-gray-700 whitespace-pre-wrap">
                    {currentText}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Change Actions for Applicants */}
          {isApplicant && hasPendingReviewerChanges && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Pending Changes from Reviewer:</h4>
              {changes
                .filter(c => c.status ===
   'pending' && c.reviewer !== 'Applicant')
                .map(change => (
                <div key={change.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="text-sm">
                        <span className="font-medium">Suggested change:</span>
                        <div className="mt-1">
                          <span className="bg-red-100 text-red-800 line-through px-1 rounded">
                            {change.originalText}
                          </span>
                          <span className="mx-2">→</span>
                          <span className="bg-green-100 text-green-800 px-1 rounded">
                            {change.newText}
                          </span>
                        </div>
                      </div>
                      {change.comment && (
                        <div className="text-xs text-gray-600">
                          <strong>Comment:</strong> {change.comment}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        By {change.reviewer} • {new Date(change.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptChange(change.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        <Check className="w-3 h-3" />
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectChange(change.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                      >
                        <X className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Change History */}
      {changes.length > 0 && (
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-700">
            Change History ({changes.length})
          </summary>
          <div className="mt-2 space-y-1 pl-4">
            {changes.map(change => (
              <div key={change.id} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  change.status ===
   'accepted' ? 'bg-green-500' :
                  change.status ===
   'rejected' ? 'bg-red-500' :
                  'bg-yellow-500'
                }`} />
                <span>{change.reviewer}</span>
                <span>{change.status}</span>
                <span>{new Date(change.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}