import React, { useState } from 'react';
import { 
  Settings, 
  Upload, 
  Download, 
  RefreshCw as Sync, 
  Eye, 
  EyeOff, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw
} from 'lucide-react';
import type { ProfileData, Publication } from '@/shared/types/research-profile.types';
import { mockResearchProfileAPI } from '@/mocks/research-profile-api';
import logger from '@/shared/utils/logger';

interface ProfileManagementProps {
  profileData: ProfileData;
  onProfileUpdate: (updatedProfile: ProfileData) => void;
  isOwner: boolean;
}

type ManagementTab = 'visibility' | 'publications' | 'sync' | 'export';

export default function ProfileManagement({ 
  profileData, 
  onProfileUpdate, 
  isOwner 
}: ProfileManagementProps) {
  const [activeTab, setActiveTab] = useState<ManagementTab>('visibility');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOwner) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Settings className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Access Restricted
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Only the profile owner can manage profile settings.
        </p>
      </div>
    );
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const tabs = [
    { id: 'visibility' as ManagementTab, label: 'Privacy & Visibility', icon: <Eye className="w-4 h-4" /> },
    { id: 'publications' as ManagementTab, label: 'Publications', icon: <FileText className="w-4 h-4" /> },
    { id: 'sync' as ManagementTab, label: 'Sync Settings', icon: <Sync className="w-4 h-4" /> },
    { id: 'export' as ManagementTab, label: 'Export Data', icon: <Download className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Profile Management
          </h2>
        </div>
        
        {message && (
          <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' 
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="text-sm">{message.text}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'visibility' && (
          <VisibilitySettings 
            profileData={profileData}
            onUpdate={onProfileUpdate}
            onMessage={showMessage}
            loading={loading}
            setLoading={setLoading}
          />
        )}
        
        {activeTab === 'publications' && (
          <PublicationManagement 
            profileData={profileData}
            onUpdate={onProfileUpdate}
            onMessage={showMessage}
            loading={loading}
            setLoading={setLoading}
          />
        )}
        
        {activeTab === 'sync' && (
          <SyncSettings 
            profileData={profileData}
            onUpdate={onProfileUpdate}
            onMessage={showMessage}
            loading={loading}
            setLoading={setLoading}
          />
        )}
        
        {activeTab === 'export' && (
          <ExportData 
            profileData={profileData}
            onMessage={showMessage}
            loading={loading}
            setLoading={setLoading}
          />
        )}
      </div>
    </div>
  );
}

// Visibility Settings Component
function VisibilitySettings({ 
  profileData, 
  onUpdate, 
  onMessage, 
  loading, 
  setLoading 
}: {
  profileData: ProfileData;
  onUpdate: (profile: ProfileData) => void;
  onMessage: (type: 'success' | 'error', text: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const [settings, setSettings] = useState(profileData.profile.visibility);

  const handleSave = async () => {
    try {
      setLoading(true);
      const updated = await mockResearchProfileAPI.updateVisibilitySettings(
        profileData.user.uid, 
        settings
      );
      onUpdate(updated);
      onMessage('success', 'Visibility settings updated successfully');
    } catch (error) {
      logger.error('Failed to update visibility settings:', error);
      onMessage('error', 'Failed to update visibility settings');
    } finally {
      setLoading(false);
    }
  };

  const visibilityOptions = [
    { value: 'public', label: 'Public', description: 'Visible to everyone' },
    { value: 'institution', label: 'Institution Only', description: 'Visible to SGT University members only' },
    { value: 'private', label: 'Private', description: 'Only visible to you' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Profile Visibility
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Overall Profile Visibility
            </label>
            <div className="space-y-2">
              {visibilityOptions.map((option) => (
                <label key={option.value} className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="profileVisibility"
                    value={option.value}
                    checked={settings.profile === option.value}
                    onChange={(e) => setSettings(prev => ({ ...prev, profile: e.target.value as any }))}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Section Visibility
            </h4>
            <div className="space-y-3">
              {[
                { key: 'showEmail', label: 'Email Address' },
                { key: 'showPhone', label: 'Phone Number' },
                { key: 'showResearchInterests', label: 'Research Interests' },
                { key: 'showPublications', label: 'Publications List' },
                { key: 'showCoAuthors', label: 'Co-Authors Network' },
                { key: 'showMetrics', label: 'Citation Metrics' },
              ].map((item) => (
                <label key={item.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {item.label}
                  </span>
                  <button
                    onClick={() => setSettings(prev => ({ 
                      ...prev, 
                      [item.key]: !prev[item.key as keyof typeof prev] 
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings[item.key as keyof typeof settings]
                        ? 'bg-blue-600'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings[item.key as keyof typeof settings]
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// Publication Management Component
function PublicationManagement({ 
  profileData, 
  onUpdate, 
  onMessage, 
  loading, 
  setLoading 
}: {
  profileData: ProfileData;
  onUpdate: (profile: ProfileData) => void;
  onMessage: (type: 'success' | 'error', text: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPub, setEditingPub] = useState<Publication | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Publication Management
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Publication
        </button>
      </div>

      {/* Publications List */}
      <div className="space-y-4">
        {profileData.publications.map((publication) => (
          <div key={publication.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {publication.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {publication.authors.map(a => a.name).join(', ')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  {publication.venue} • {publication.year} • {publication.citationCount} citations
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingPub(publication)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  className="p-2 text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk Import */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Bulk Import
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 transition-colors">
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <div className="text-sm font-medium text-gray-900 dark:text-white">BibTeX</div>
            <div className="text-xs text-gray-500 dark:text-gray-500">Upload .bib file</div>
          </button>
          <button className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 transition-colors">
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <div className="text-sm font-medium text-gray-900 dark:text-white">RIS</div>
            <div className="text-xs text-gray-500 dark:text-gray-500">Upload .ris file</div>
          </button>
          <button className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 transition-colors">
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <div className="text-sm font-medium text-gray-900 dark:text-white">CSV</div>
            <div className="text-xs text-gray-500 dark:text-gray-500">Upload .csv file</div>
          </button>
        </div>
      </div>
    </div>
  );
}

// Sync Settings Component
function SyncSettings({ 
  profileData, 
  onUpdate, 
  onMessage, 
  loading, 
  setLoading 
}: {
  profileData: ProfileData;
  onUpdate: (profile: ProfileData) => void;
  onMessage: (type: 'success' | 'error', text: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const handleManualSync = async (source: 'google_scholar' | 'scopus' | 'web_of_science') => {
    try {
      setLoading(true);
      const response = await mockResearchProfileAPI.syncProfile(profileData.user.uid, {
        source,
        profileId: profileData.profile.googleScholarId || '',
      });
      
      if (response.status === 'success') {
        onMessage('success', `Sync completed: ${response.newPublications} new publications, ${response.updatedCitations} citation updates`);
        // Refresh profile data
        const updated = await mockResearchProfileAPI.getProfile(profileData.user.uid);
        onUpdate(updated.profile);
      } else {
        onMessage('error', response.message || 'Sync failed');
      }
    } catch (error) {
      logger.error('Sync failed:', error);
      onMessage('error', 'Failed to sync profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Profile Synchronization
        </h3>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-blue-900 dark:text-blue-300">
                Last Sync: {profileData.profile.lastSyncedAt ? new Date(profileData.profile.lastSyncedAt).toLocaleString() : 'Never'}
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                Status: {profileData.profile.syncStatus}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Google Scholar</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {profileData.profile.googleScholarId ? 
                    `Connected: ${profileData.profile.googleScholarId}` : 
                    'Not connected'
                  }
                </p>
              </div>
              <button
                onClick={() => handleManualSync('google_scholar')}
                disabled={loading || !profileData.profile.googleScholarId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sync className="w-4 h-4" />
                )}
                Sync Now
              </button>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Scopus</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {profileData.profile.scopusAuthorId ? 
                    `Connected: ${profileData.profile.scopusAuthorId}` : 
                    'Not connected'
                  }
                </p>
              </div>
              <button
                onClick={() => handleManualSync('scopus')}
                disabled={loading || !profileData.profile.scopusAuthorId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sync className="w-4 h-4" />
                )}
                Sync Now
              </button>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Web of Science</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {profileData.profile.webOfScienceId ? 
                    `Connected: ${profileData.profile.webOfScienceId}` : 
                    'Not connected'
                  }
                </p>
              </div>
              <button
                onClick={() => handleManualSync('web_of_science')}
                disabled={loading || !profileData.profile.webOfScienceId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sync className="w-4 h-4" />
                )}
                Sync Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export Data Component
function ExportData({ 
  profileData, 
  onMessage, 
  loading, 
  setLoading 
}: {
  profileData: ProfileData;
  onMessage: (type: 'success' | 'error', text: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const handleExport = async (format: 'pdf' | 'csv' | 'bibtex') => {
    try {
      setLoading(true);
      // Mock export functionality
      await new Promise(resolve => setTimeout(resolve, 2000));
      onMessage('success', `Profile exported as ${format.toUpperCase()}`);
    } catch (error) {
      logger.error('Export failed:', error);
      onMessage('error', 'Failed to export profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Export Profile Data
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleExport('pdf')}
            disabled={loading}
            className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50"
          >
            <Download className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <div className="text-sm font-medium text-gray-900 dark:text-white">PDF Report</div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Complete profile with publications and metrics
            </div>
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={loading}
            className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50"
          >
            <Download className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <div className="text-sm font-medium text-gray-900 dark:text-white">CSV Data</div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Publications and citation data in spreadsheet format
            </div>
          </button>

          <button
            onClick={() => handleExport('bibtex')}
            disabled={loading}
            className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50"
          >
            <Download className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <div className="text-sm font-medium text-gray-900 dark:text-white">BibTeX</div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Bibliography format for LaTeX and reference managers
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}