'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical, Settings, Users,
  FileText, Calendar, Clock, AlignLeft, Hash, Mail, Phone, Link as LinkIcon,
  List, CheckSquare, Radio, Image as ImageIcon, Upload, ToggleLeft, ToggleRight,
  AlertCircle, Loader2, ChevronDown, ChevronUp, Eye, EyeOff, Info
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { EventCustomField, EventFieldType } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';

const FIELD_TYPES: { value: EventFieldType; label: string; icon: React.ReactNode }[] = [
  { value: 'text', label: 'Text', icon: <AlignLeft className="w-4 h-4" /> },
  { value: 'textarea', label: 'Long Text', icon: <FileText className="w-4 h-4" /> },
  { value: 'number', label: 'Number', icon: <Hash className="w-4 h-4" /> },
  { value: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
  { value: 'phone', label: 'Phone', icon: <Phone className="w-4 h-4" /> },
  { value: 'url', label: 'URL', icon: <LinkIcon className="w-4 h-4" /> },
  { value: 'date', label: 'Date', icon: <Calendar className="w-4 h-4" /> },
  { value: 'time', label: 'Time', icon: <Clock className="w-4 h-4" /> },
  { value: 'datetime', label: 'Date & Time', icon: <Calendar className="w-4 h-4" /> },
  { value: 'dropdown', label: 'Dropdown', icon: <List className="w-4 h-4" /> },
  { value: 'checkbox', label: 'Checkboxes', icon: <CheckSquare className="w-4 h-4" /> },
  { value: 'radio', label: 'Radio Buttons', icon: <Radio className="w-4 h-4" /> },
  { value: 'file', label: 'File Upload', icon: <Upload className="w-4 h-4" /> },
  { value: 'image', label: 'Image Upload', icon: <ImageIcon className="w-4 h-4" /> },
];

interface CustomFieldEditorProps {
  field: Partial<EventCustomField>;
  onSave: (field: Partial<EventCustomField>) => void;
  onDelete?: () => void;
  isNew?: boolean;
}

const CustomFieldEditor: React.FC<CustomFieldEditorProps> = ({
  field,
  onSave,
  onDelete,
  isNew = false
}) => {
  const [localField, setLocalField] = useState<Partial<EventCustomField>>(field);
  const [expanded, setExpanded] = useState(isNew);
  const [optionsText, setOptionsText] = useState(
    Array.isArray(field.options) ? field.options.join('\n') : ''
  );

  const handleSave = () => {
    // Parse options for dropdown/checkbox/radio
    const needsOptions = ['dropdown', 'checkbox', 'radio'].includes(localField.fieldType || '');
    const options = needsOptions
      ? optionsText.split('\n').filter(o => o.trim()).map(o => o.trim())
      : undefined;

    onSave({
      ...localField,
      options,
    });
    if (isNew) {
      setLocalField({});
      setOptionsText('');
    }
  };

  const selectedFieldType = FIELD_TYPES.find(t => t.value === localField.fieldType);
  const needsOptions = ['dropdown', 'checkbox', 'radio'].includes(localField.fieldType || '');

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => !isNew && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {!isNew && (
            <button className="cursor-grab text-gray-400 hover:text-gray-600">
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            {selectedFieldType?.icon || <AlignLeft className="w-4 h-4 text-gray-400" />}
            <span className="font-medium text-gray-900 dark:text-white">
              {localField.fieldLabel || (isNew ? 'New Field' : 'Untitled Field')}
            </span>
          </div>
          {localField.isRequired && (
            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
              Required
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {!isNew && (expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
        </div>
      </div>

      {(expanded || isNew) && (
        <div className="p-4 pt-0 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Field Label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Field Label <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={localField.fieldLabel || ''}
                onChange={(e) => setLocalField({ ...localField, fieldLabel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                placeholder="e.g., Company Name"
              />
            </div>

            {/* Field Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Field Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={localField.fieldName || ''}
                onChange={(e) => setLocalField({ ...localField, fieldName: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                placeholder="e.g., company_name"
              />
              <p className="text-xs text-gray-500 mt-1">Used as field identifier (no spaces)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Field Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Field Type <span className="text-red-500">*</span>
              </label>
              <select
                value={localField.fieldType || 'text'}
                onChange={(e) => setLocalField({ ...localField, fieldType: e.target.value as EventFieldType })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              >
                {FIELD_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Required Toggle */}
            <div className="flex items-center gap-3 pt-6">
              <button
                type="button"
                onClick={() => setLocalField({ ...localField, isRequired: !localField.isRequired })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  localField.isRequired ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    localField.isRequired ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">Required field</span>
            </div>
          </div>

          {/* Options for dropdown/checkbox/radio */}
          {needsOptions && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Options <span className="text-red-500">*</span>
              </label>
              <textarea
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                placeholder="Enter each option on a new line"
              />
              <p className="text-xs text-gray-500 mt-1">One option per line</p>
            </div>
          )}

          {/* Placeholder */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Placeholder
            </label>
            <input
              type="text"
              value={localField.placeholder || ''}
              onChange={(e) => setLocalField({ ...localField, placeholder: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              placeholder="e.g., Enter your company name"
            />
          </div>

          {/* Help Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Help Text
            </label>
            <input
              type="text"
              value={localField.helpText || ''}
              onChange={(e) => setLocalField({ ...localField, helpText: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              placeholder="Additional instructions for this field"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {!isNew && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!localField.fieldLabel || !localField.fieldName}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isNew ? 'Add Field' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function RegistrationSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const eventId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customFields, setCustomFields] = useState<EventCustomField[]>([]);
  const [settings, setSettings] = useState({
    autoApproveRegistration: true,
    requireFormSubmission: true,
    allowEditAfterSubmission: true,
    lookingForTeammatesEnabled: true,
    minTeamSize: 2,
    maxTeamSize: 4,
    maxTeamLimit: null as number | null,
    teamRegistrationDeadline: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [fieldsData, settingsData] = await Promise.all([
          eventService.getCustomFields(eventId),
          eventService.getRegistrationSettings(eventId),
        ]);
        
        setCustomFields(fieldsData);
        if (settingsData) {
          setSettings(prev => ({ ...prev, ...settingsData }));
        }
      } catch (error: any) {
        toast({ type: 'error', message: getErrorMessage(error) });
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      loadData();
    }
  }, [eventId, toast]);

  const handleAddField = async (field: Partial<EventCustomField>) => {
    try {
      const newField = await eventService.createCustomField(eventId, {
        ...field,
        displayOrder: customFields.length,
      });
      setCustomFields([...customFields, newField]);
      toast({ type: 'success', message: 'Field added successfully' });
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    }
  };

  const handleUpdateField = async (field: Partial<EventCustomField>) => {
    if (!field.id) return;
    
    try {
      const updated = await eventService.updateCustomField(eventId, field.id, field);
      setCustomFields(customFields.map(f => f.id === field.id ? updated : f));
      toast({ type: 'success', message: 'Field updated successfully' });
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this field?')) return;
    
    try {
      await eventService.deleteCustomField(eventId, fieldId);
      setCustomFields(customFields.filter(f => f.id !== fieldId));
      toast({ type: 'success', message: 'Field deleted successfully' });
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await eventService.updateRegistrationSettings(eventId, settings);
      toast({ type: 'success', message: 'Settings saved successfully' });
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <CardSkeleton className="w-full max-w-sm mx-auto mb-4" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/events/${eventId}/manage`} className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Event Management
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Registration Settings</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Configure registration form and team settings
              </p>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Skeleton className="w-4 h-4 rounded-full" /> : <Save className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* General Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5" />
                General Settings
              </h2>
            </div>
            <div className="p-4 space-y-4">
              {/* Auto Approve */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Auto-approve registrations</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Automatically approve new registrations</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, autoApproveRegistration: !settings.autoApproveRegistration })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.autoApproveRegistration ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.autoApproveRegistration ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Require Form */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Require form submission</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Users must fill out the registration form</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, requireFormSubmission: !settings.requireFormSubmission })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.requireFormSubmission ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.requireFormSubmission ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Allow Edit */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Allow editing after submission</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Users can edit their registration after submitting</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, allowEditAfterSubmission: !settings.allowEditAfterSubmission })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.allowEditAfterSubmission ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.allowEditAfterSubmission ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Team Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Settings
              </h2>
            </div>
            <div className="p-4 space-y-4">
              {/* Looking for Teammates */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Enable &ldquo;Looking for Teammates&rdquo;</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Allow users to indicate they&apos;re looking for teammates</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, lookingForTeammatesEnabled: !settings.lookingForTeammatesEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.lookingForTeammatesEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.lookingForTeammatesEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Team Size */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Min Team Size
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={settings.minTeamSize}
                    onChange={(e) => setSettings({ ...settings, minTeamSize: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Team Size
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={settings.maxTeamSize}
                    onChange={(e) => setSettings({ ...settings, maxTeamSize: parseInt(e.target.value) || 4 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  />
                </div>
              </div>

              {/* Max Team Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Number of Teams (leave empty for unlimited)
                </label>
                <input
                  type="number"
                  min={1}
                  value={settings.maxTeamLimit || ''}
                  onChange={(e) => setSettings({ ...settings, maxTeamLimit: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  placeholder="Unlimited"
                />
              </div>

              {/* Team Registration Deadline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Team Registration Deadline
                </label>
                <input
                  type="datetime-local"
                  value={settings.teamRegistrationDeadline || ''}
                  onChange={(e) => setSettings({ ...settings, teamRegistrationDeadline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to use event registration deadline</p>
              </div>
            </div>
          </div>

          {/* Custom Fields */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Custom Form Fields
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Add custom fields to collect additional information from participants
              </p>
            </div>
            <div className="p-4 space-y-4">
              {/* Existing Fields */}
              {customFields.map((field) => (
                <CustomFieldEditor
                  key={field.id}
                  field={field}
                  onSave={handleUpdateField}
                  onDelete={() => handleDeleteField(field.id)}
                />
              ))}

              {/* Add New Field */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add New Field
                </h3>
                <CustomFieldEditor
                  field={{ fieldType: 'text', isRequired: false }}
                  onSave={handleAddField}
                  isNew={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
