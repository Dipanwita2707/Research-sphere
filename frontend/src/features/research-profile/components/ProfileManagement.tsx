import React, { useRef, useState } from 'react';
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
import {
  researchProfileService,
  type ManualProfileImportPublication,
  type PublicationImportRun,
  type ResearchProfileIdentity,
} from '@/features/research-profile/services/researchProfile.service';
import logger from '@/shared/utils/logger';

interface ProfileManagementProps {
  profileData: ProfileData;
  onProfileUpdate: (updatedProfile: ProfileData) => void;
  onProfileRefresh?: () => Promise<void> | void;
  isOwner: boolean;
  currentUserId: string;
  /** Admin/superadmin may edit ORCID, Scopus, WoS IDs */
  canEditResearchIdentityIds?: boolean;
}

type ManagementTab = 'visibility' | 'publications' | 'sync' | 'export';

export default function ProfileManagement({ 
  profileData, 
  onProfileUpdate, 
  onProfileRefresh,
  isOwner,
  currentUserId,
  canEditResearchIdentityIds = false,
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
                  ? 'border-[#7d1a34] text-[#7d1a34] dark:text-[#c8973f]'
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
            onRefresh={onProfileRefresh}
            onMessage={showMessage}
            loading={loading}
            setLoading={setLoading}
            currentUserId={currentUserId}
          />
        )}
        
        {activeTab === 'sync' && (
          <SyncSettings 
            profileData={profileData}
            onUpdate={onProfileUpdate}
            onMessage={showMessage}
            loading={loading}
            setLoading={setLoading}
            currentUserId={currentUserId}
            canEditResearchIdentityIds={canEditResearchIdentityIds}
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
    { value: 'institution', label: 'Institution Only', description: 'Visible to ResearchSphere members only' },
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
                    className="mt-1 text-[#7d1a34] focus:ring-[#7d1a34]"
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
                        ? 'bg-[#7d1a34]'
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
          className="px-4 py-2 bg-[#7d1a34] text-white rounded-lg hover:bg-[#5e1024] disabled:opacity-50 flex items-center gap-2"
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
  onRefresh,
  onMessage, 
  loading, 
  setLoading,
  currentUserId,
}: {
  profileData: ProfileData;
  onUpdate: (profile: ProfileData) => void;
  onRefresh?: () => Promise<void> | void;
  onMessage: (type: 'success' | 'error', text: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  currentUserId: string;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPub, setEditingPub] = useState<Publication | null>(null);
  const bibInputRef = useRef<HTMLInputElement | null>(null);
  const risInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const importPublications = async (file: File, format: 'bibtex' | 'ris' | 'csv') => {
    try {
      setLoading(true);
      const content = await file.text();
      const parsedPublications = format === 'bibtex'
        ? parseBibTex(content)
        : format === 'ris'
        ? parseRis(content)
        : parseCsvPublications(content);

      if (parsedPublications.length === 0) {
        onMessage('error', `No valid publications were found in ${file.name}`);
        return;
      }

      const importedPublications = parsedPublications.map((publication, index) =>
        buildPublicationFromParsed(profileData, publication, index)
      );
      const importPayload: ManualProfileImportPublication[] = parsedPublications.map((publication) => ({
        title: publication.title,
        authors: publication.authors,
        venue: publication.venue,
        year: publication.year,
        doi: publication.doi,
        citationCount: publication.citationCount,
        publicationType: publication.publicationType,
      }));

      const result = await researchProfileService.importPublications(currentUserId, importPayload, format);

      const updatedProfile = mergeImportedPublications(profileData, importedPublications);
      const importedCount = updatedProfile.publications.length - profileData.publications.length;

      onUpdate(updatedProfile);
      if (onRefresh) {
        await onRefresh();
      }
      onMessage(
        result.failedCount > 0 ? 'error' : 'success',
        result.failedCount > 0
          ? `Imported with ${result.failedCount} failure(s). ${result.createdCount} created, ${result.updatedCount} updated.`
          : importedCount > 0
          ? `${result.createdCount} publication(s) imported from ${file.name}`
          : `${result.updatedCount} publication(s) updated from ${file.name}`
      );
    } catch (error) {
      logger.error(`Failed to import ${format} publications:`, error);
      onMessage('error', `Failed to import ${file.name}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileImport = async (
    event: React.ChangeEvent<HTMLInputElement>,
    format: 'bibtex' | 'ris' | 'csv'
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    await importPublications(file, format);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Publication Management
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-[#7d1a34] text-white rounded-lg hover:bg-[#5e1024] flex items-center gap-2"
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
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex flex-wrap gap-x-1">
                  {publication.authors.map((a, idx) => {
                    const isLast = idx === publication.authors.length - 1;
                    return (
                      <span
                        key={idx}
                        className="hover:text-[#7d1a34] dark:hover:text-[#c8973f] cursor-help transition-colors text-sm"
                        title={a.affiliation || 'No affiliation data'}
                      >
                        {a.name}{!isLast && ','}
                      </span>
                    );
                  })}
                </div>
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
        <input
          ref={bibInputRef}
          type="file"
          accept=".bib,text/plain"
          className="hidden"
          onChange={(event) => void handleFileImport(event, 'bibtex')}
        />
        <input
          ref={risInputRef}
          type="file"
          accept=".ris,text/plain"
          className="hidden"
          onChange={(event) => void handleFileImport(event, 'ris')}
        />
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => void handleFileImport(event, 'csv')}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            disabled={loading}
            onClick={() => bibInputRef.current?.click()}
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-[#7d1a34] transition-colors disabled:opacity-50"
          >
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <div className="text-sm font-medium text-gray-900 dark:text-white">BibTeX</div>
            <div className="text-xs text-gray-500 dark:text-gray-500">Upload .bib file</div>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => risInputRef.current?.click()}
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-[#7d1a34] transition-colors disabled:opacity-50"
          >
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <div className="text-sm font-medium text-gray-900 dark:text-white">RIS</div>
            <div className="text-xs text-gray-500 dark:text-gray-500">Upload .ris file</div>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => csvInputRef.current?.click()}
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-[#7d1a34] transition-colors disabled:opacity-50"
          >
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
  setLoading,
  currentUserId,
  canEditResearchIdentityIds,
}: {
  profileData: ProfileData;
  onUpdate: (profile: ProfileData) => void;
  onMessage: (type: 'success' | 'error', text: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  currentUserId: string;
  canEditResearchIdentityIds: boolean;
}) {
  const [formState, setFormState] = useState({
    orcid: profileData.profile.orcid || '',
    scopusAuthorId: profileData.profile.scopusAuthorId || '',
    webOfScienceId: profileData.profile.webOfScienceId || '',
    autoSyncEnabled: profileData.profile.autoSyncEnabled,
    filterSgtOnly: profileData.profile.filterSgtOnly || false,
    syncFrequencyDays: profileData.profile.syncFrequencyDays || 1,
  });

  React.useEffect(() => {
    if (profileData?.profile) {
      setFormState({
        orcid: profileData.profile.orcid || '',
        scopusAuthorId: profileData.profile.scopusAuthorId || '',
        webOfScienceId: profileData.profile.webOfScienceId || '',
        autoSyncEnabled: profileData.profile.autoSyncEnabled,
        filterSgtOnly: profileData.profile.filterSgtOnly || false,
        syncFrequencyDays: profileData.profile.syncFrequencyDays || 1,
      });
    }
  }, [
    profileData?.profile?.orcid,
    profileData?.profile?.scopusAuthorId,
    profileData?.profile?.webOfScienceId,
    profileData?.profile?.autoSyncEnabled,
    profileData?.profile?.filterSgtOnly,
    profileData?.profile?.syncFrequencyDays,
  ]);
  const [recentRuns, setRecentRuns] = useState<PublicationImportRun[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);

  const applyIdentityUpdate = (
    identity: Partial<ResearchProfileIdentity>,
    message?: string
  ) => {
    onUpdate({
      ...profileData,
      profile: {
        ...profileData.profile,
        orcid: identity.orcid ?? profileData.profile.orcid,
        scopusAuthorId: identity.scopusAuthorId ?? profileData.profile.scopusAuthorId,
        webOfScienceId: identity.webOfScienceId ?? profileData.profile.webOfScienceId,
        lastSyncedAt: identity.lastSyncedAt ?? profileData.profile.lastSyncedAt,
        syncStatus: (identity.syncStatus as any) ?? profileData.profile.syncStatus,
        syncError: identity.syncError ?? profileData.profile.syncError,
        autoSyncEnabled: identity.autoSyncEnabled ?? profileData.profile.autoSyncEnabled,
        filterSgtOnly: identity.filterSgtOnly ?? profileData.profile.filterSgtOnly,
        syncFrequencyDays: identity.syncFrequencyDays ?? profileData.profile.syncFrequencyDays,
      },
    });
    if (message) {
      onMessage('success', message);
    }
  };

  const loadImportRuns = async () => {
    try {
      setRunsLoading(true);
      const runs = await researchProfileService.getImportRuns(currentUserId);
      setRecentRuns(runs);
      setRunsLoaded(true);
    } catch (error) {
      logger.error('Failed to load import runs:', error);
      onMessage('error', 'Failed to load recent sync runs');
    } finally {
      setRunsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      const payload = canEditResearchIdentityIds
        ? formState
        : {
            autoSyncEnabled: formState.autoSyncEnabled,
            filterSgtOnly: formState.filterSgtOnly,
            syncFrequencyDays: formState.syncFrequencyDays,
          };
      const identity = await researchProfileService.updateIdentity(currentUserId, payload);
      applyIdentityUpdate(identity, 'Research identity settings saved');
    } catch (error) {
      logger.error('Failed to save identity settings:', error);
      onMessage('error', 'Failed to save research identity settings');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async (source: 'orcid' | 'scopus' | 'openalex' | 'all') => {
    try {
      setLoading(true);
      // Persist filter/sync toggles before sync so a checked "SGT only" box
      // is applied even if the user did not click Save Settings first.
      const settingsPayload = canEditResearchIdentityIds
        ? formState
        : {
            autoSyncEnabled: formState.autoSyncEnabled,
            filterSgtOnly: formState.filterSgtOnly,
            syncFrequencyDays: formState.syncFrequencyDays,
          };
      try {
        const identity = await researchProfileService.updateIdentity(currentUserId, settingsPayload);
        applyIdentityUpdate(identity);
      } catch (saveError) {
        logger.warn('Could not persist identity settings before sync:', saveError);
      }

      const result = await researchProfileService.syncProfile(currentUserId, source);
      applyIdentityUpdate({
        lastSyncedAt: new Date().toISOString(),
        syncStatus: result.failedCount > 0 ? 'failed' : 'success',
        syncError: result.failedCount > 0 ? `${result.failedCount} publication(s) failed during sync` : null,
      });
      await loadImportRuns();
      onMessage(
        'success',
        `Sync completed: ${result.createdCount} created, ${result.updatedCount} updated, ${result.skippedCount || 0} skipped (non-SGT), ${result.specialReviewCount} flagged for special review`
      );
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
          Publication Automation
        </h3>
        
        <div className="bg-[#fdf5ec] dark:bg-[#7d1a34]/10 border border-[#f0e2d2] dark:border-[#5e1024] rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-[#7d1a34] dark:text-[#c8973f] mt-0.5" />
            <div>
              <div className="text-sm font-medium text-[#7d1a34] dark:text-[#c8973f]">
                Last Sync: {profileData.profile.lastSyncedAt ? new Date(profileData.profile.lastSyncedAt).toLocaleString() : 'Never'}
              </div>
              <div className="text-xs text-[#7d1a34] dark:text-[#c8973f] mt-1">
                Status: {profileData.profile.syncStatus}
              </div>
            </div>
          </div>
        </div>

        {!canEditResearchIdentityIds && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            ORCID, Scopus, and Web of Science IDs are set by your institution. Contact an administrator if they need to be updated.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ORCID ID
            </label>
            <input
              type="text"
              readOnly={!canEditResearchIdentityIds}
              value={formState.orcid}
              onChange={(e) => setFormState((prev) => ({ ...prev, orcid: e.target.value }))}
              placeholder="0000-0000-0000-0000"
              className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#7d1a34] focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                !canEditResearchIdentityIds ? 'bg-gray-50 text-gray-600 cursor-not-allowed dark:bg-gray-900/40' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Scopus Author ID
            </label>
            <input
              type="text"
              readOnly={!canEditResearchIdentityIds}
              value={formState.scopusAuthorId}
              onChange={(e) => setFormState((prev) => ({ ...prev, scopusAuthorId: e.target.value }))}
              placeholder="Scopus author identifier"
              className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#7d1a34] focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                !canEditResearchIdentityIds ? 'bg-gray-50 text-gray-600 cursor-not-allowed dark:bg-gray-900/40' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Web Of Science ID
            </label>
            <input
              type="text"
              readOnly={!canEditResearchIdentityIds}
              value={formState.webOfScienceId}
              onChange={(e) => setFormState((prev) => ({ ...prev, webOfScienceId: e.target.value }))}
              placeholder="Optional reviewer reference"
              className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#7d1a34] focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                !canEditResearchIdentityIds ? 'bg-gray-50 text-gray-600 cursor-not-allowed dark:bg-gray-900/40' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Auto Sync Frequency
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={formState.syncFrequencyDays}
                onChange={(e) => setFormState((prev) => ({ ...prev, syncFrequencyDays: Number(e.target.value) || 1 }))}
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#7d1a34] focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={formState.autoSyncEnabled}
                  onChange={(e) => setFormState((prev) => ({ ...prev, autoSyncEnabled: e.target.checked }))}
                  className="rounded border-gray-300 text-[#7d1a34] focus:ring-[#7d1a34]"
                />
                Enable auto sync
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                <input
                  type="checkbox"
                  checked={formState.filterSgtOnly}
                  onChange={(e) => setFormState((prev) => ({ ...prev, filterSgtOnly: e.target.checked }))}
                  className="rounded border-gray-300 text-[#7d1a34] focus:ring-[#7d1a34]"
                />
                Filter SGT affiliated publications only
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={handleSaveSettings}
            disabled={loading}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
          <button
            onClick={() => loadImportRuns()}
            disabled={runsLoading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            {runsLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
            Load Recent Runs
          </button>
        </div>

        <div className="space-y-4">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">ORCID</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formState.orcid ? 
                    `Connected: ${formState.orcid}` : 
                    'Not connected'
                  }
                </p>
              </div>
              <button
                onClick={() => handleManualSync('orcid')}
                disabled={loading || !formState.orcid}
                className="px-4 py-2 bg-[#7d1a34] text-white rounded-lg hover:bg-[#5e1024] disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sync className="w-4 h-4" />
                )}
                Sync ORCID
              </button>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Scopus</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formState.scopusAuthorId ? 
                    `Connected: ${formState.scopusAuthorId}` : 
                    'Not connected'
                  }
                </p>
              </div>
              <button
                onClick={() => handleManualSync('scopus')}
                disabled={loading || !formState.scopusAuthorId}
                className="px-4 py-2 bg-[#7d1a34] text-white rounded-lg hover:bg-[#5e1024] disabled:opacity-50 flex items-center gap-2"
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
                <h4 className="font-medium text-gray-900 dark:text-white">OpenAlex</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Searches publications by faculty name and university affiliation.
                </p>
              </div>
              <button
                onClick={() => handleManualSync('openalex')}
                disabled={loading}
                className="px-4 py-2 bg-[#7d1a34] text-white rounded-lg hover:bg-[#5e1024] disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sync className="w-4 h-4" />
                )}
                Sync OpenAlex
              </button>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Combined Import</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Runs ORCID and Scopus when configured, then enriches with OpenAlex when available.
                </p>
              </div>
              <button
                onClick={() => handleManualSync('all')}
                disabled={loading}
                className="px-4 py-2 bg-[#7d1a34] text-white rounded-lg hover:bg-[#5e1024] disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sync className="w-4 h-4" />
                )}
                Sync All Sources
              </button>
            </div>
          </div>
        </div>

        {(runsLoaded || recentRuns.length > 0) && (
          <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Recent Import Runs</h4>
              {runsLoading && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
            {recentRuns.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No import runs recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {recentRuns.map((run) => (
                  <div key={run.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{run.triggerType}</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#fdf5ec] text-[#7d1a34] text-xs">
                        {run.sourceSystems.join(', ') || 'manual'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        run.status === 'success'
                          ? 'bg-green-50 text-green-700'
                          : run.status === 'partial_success'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {run.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {run.createdCount} created, {run.updatedCount} updated, {run.specialReviewCount} special review, {run.failedCount} failed
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Started {new Date(run.startedAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {profileData.profile.syncError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-medium text-red-800">Last sync error</div>
            <p className="mt-1 text-sm text-red-700">{profileData.profile.syncError}</p>
          </div>
        )}
      </div>
    </div>
  );
}

type ParsedPublicationInput = {
  title: string;
  authors: string[];
  venue?: string;
  year?: number;
  doi?: string | null;
  citationCount?: number;
  publicationType?: string;
};

function escapeCsv(value: string | number | null | undefined) {
  const stringValue = value == null ? '' : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function triggerTextDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeAuthorName(name: string, authorOrder: number) {
  return {
    name: name.trim(),
    affiliation: null,
    email: null,
    isCorresponding: authorOrder === 0,
    authorOrder,
  };
}

function buildPublicationFromParsed(
  profileData: ProfileData,
  publication: ParsedPublicationInput,
  index: number
): Publication {
  const now = new Date().toISOString();
  const fallbackYear = new Date().getFullYear();
  return {
    id: `imported_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
    profileId: profileData.profile.id,
    researchContributionId: null,
    title: publication.title.trim(),
    authors: (publication.authors.length > 0 ? publication.authors : [profileData.user.name])
      .map((author, authorOrder) => normalizeAuthorName(author, authorOrder)),
    venue: publication.venue?.trim() || 'Imported publication',
    publicationType: publication.publicationType?.trim() || 'journal',
    year: publication.year || fallbackYear,
    volume: null,
    issue: null,
    pages: null,
    doi: publication.doi?.trim() || null,
    isbn: null,
    issn: null,
    arxivId: null,
    pubmedId: null,
    citationCount: publication.citationCount || 0,
    citationsPerYear: {},
    source: 'manual',
    externalId: null,
    pdfUrl: null,
    publicationUrl: null,
    abstract: null,
    keywords: [],
    isVerified: false,
    createdAt: now,
    updatedAt: now,
  };
}

function mergeImportedPublications(profileData: ProfileData, imports: Publication[]): ProfileData {
  const existingKeys = new Set(
    profileData.publications.map((publication) => `${publication.title.toLowerCase()}::${publication.year}`)
  );

  const uniqueImports = imports.filter((publication) => {
    const key = `${publication.title.toLowerCase()}::${publication.year}`;
    if (existingKeys.has(key)) {
      return false;
    }
    existingKeys.add(key);
    return true;
  });

  const publications = [...uniqueImports, ...profileData.publications];
  const totalCitations = publications.reduce((sum, publication) => sum + publication.citationCount, 0);
  const avgCitationsPerPaper = publications.length > 0
    ? parseFloat((totalCitations / publications.length).toFixed(2))
    : 0;

  return {
    ...profileData,
    publications,
    profile: {
      ...profileData.profile,
      metrics: {
        ...profileData.profile.metrics,
        totalCitations,
        avgCitationsPerPaper,
      },
    },
  };
}

function parseBibTex(content: string): ParsedPublicationInput[] {
  const entryMatches = content.match(/@\w+\s*\{[\s\S]*?\n\}/g) || [];
  const publications: ParsedPublicationInput[] = [];

  entryMatches.forEach((entry) => {
      const readField = (field: string) => {
        const match = entry.match(new RegExp(`${field}\\s*=\\s*[{\"]([\\s\\S]*?)[}\"]\\s*,?`, 'i'));
        return match?.[1]?.replace(/\s+/g, ' ').trim();
      };

      const title = readField('title');
      if (!title) return;

      const authors = (readField('author') || '')
        .split(/\s+and\s+/i)
        .map((author) => author.trim())
        .filter(Boolean);

      const yearValue = readField('year');
      const citationValue = readField('citations');
      publications.push({
        title,
        authors,
        venue: readField('journal') || readField('booktitle') || readField('publisher'),
        year: yearValue ? Number.parseInt(yearValue, 10) : undefined,
        doi: readField('doi') || null,
        citationCount: citationValue ? Number.parseInt(citationValue, 10) || 0 : 0,
        publicationType: readField('entrytype') || 'journal',
      });
    });

  return publications;
}

function parseRis(content: string): ParsedPublicationInput[] {
  const publications: ParsedPublicationInput[] = [];

  content
    .split(/\nER\s*-\s*/i)
    .map((block) => block.trim())
    .filter(Boolean)
    .forEach((block) => {
      const lines = block.split(/\r?\n/);
      const values: Record<string, string[]> = {};

      lines.forEach((line) => {
        const match = line.match(/^([A-Z0-9]{2})\s*-\s*(.*)$/);
        if (!match) return;
        const [, key, value] = match;
        values[key] = values[key] || [];
        values[key].push(value.trim());
      });

      const title = values.TI?.[0] || values.T1?.[0];
      if (!title) return;

      const yearValue = values.PY?.[0] || values.Y1?.[0];
      const yearMatch = yearValue?.match(/\d{4}/);

      publications.push({
        title,
        authors: values.AU || values.A1 || [],
        venue: values.JO?.[0] || values.JF?.[0] || values.T2?.[0],
        year: yearMatch ? Number.parseInt(yearMatch[0], 10) : undefined,
        doi: values.DO?.[0] || null,
        citationCount: 0,
        publicationType: 'journal',
      });
    });

  return publications;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function parseCsvPublications(content: string): ParsedPublicationInput[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());

  const publications: ParsedPublicationInput[] = [];

  lines.slice(1).forEach((line) => {
      const columns = parseCsvLine(line);
      const getValue = (...keys: string[]) => {
        const index = headers.findIndex((header) => keys.includes(header));
        return index >= 0 ? columns[index] : '';
      };

      const title = getValue('title', 'paper title', 'publication title');
      if (!title) return;

      const authors = getValue('authors', 'author')
        .split(/[;,]/)
        .map((author) => author.trim())
        .filter(Boolean);

      const yearValue = getValue('year', 'publication year');
      const citationValue = getValue('citations', 'citationcount', 'citation count');

      publications.push({
        title,
        authors,
        venue: getValue('venue', 'journal', 'conference', 'publisher'),
        year: yearValue ? Number.parseInt(yearValue, 10) : undefined,
        doi: getValue('doi') || null,
        citationCount: citationValue ? Number.parseInt(citationValue, 10) || 0 : 0,
        publicationType: getValue('publicationtype', 'publication type', 'type') || 'journal',
      });
    });

  return publications;
}

function buildCsvExport(profileData: ProfileData) {
  const header = [
    'Title',
    'Authors',
    'Venue',
    'Year',
    'Publication Type',
    'DOI',
    'Citations',
    'Source',
  ];

  const rows = profileData.publications.map((publication) => [
    escapeCsv(publication.title),
    escapeCsv(publication.authors.map((author) => author.name).join('; ')),
    escapeCsv(publication.venue),
    escapeCsv(publication.year),
    escapeCsv(publication.publicationType),
    escapeCsv(publication.doi),
    escapeCsv(publication.citationCount),
    escapeCsv(publication.source),
  ]);

  return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

function buildBibTexExport(profileData: ProfileData) {
  return profileData.publications
    .map((publication, index) => {
      const citationKey = `${profileData.user.name.split(' ')[0] || 'author'}${publication.year}${index + 1}`
        .replace(/[^a-zA-Z0-9]/g, '');
      return [
        `@article{${citationKey},`,
        `  title = {${publication.title}},`,
        `  author = {${publication.authors.map((author) => author.name).join(' and ')}},`,
        `  journal = {${publication.venue}},`,
        `  year = {${publication.year}},`,
        publication.doi ? `  doi = {${publication.doi}},` : null,
        '}',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

function buildPrintableHtml(profileData: ProfileData) {
  const publicationItems = profileData.publications
    .map((publication) => `
      <li>
        <strong>${publication.title}</strong><br />
        ${publication.authors.map((author) => author.name).join(', ')}<br />
        ${publication.venue} | ${publication.year} | Citations: ${publication.citationCount}
      </li>
    `)
    .join('');

  return `
    <!doctype html>
    <html>
      <head>
        <title>${profileData.user.name} Research Profile</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
          h1, h2 { margin-bottom: 8px; }
          p { margin: 4px 0; }
          ul { padding-left: 20px; }
          li { margin-bottom: 14px; }
        </style>
      </head>
      <body>
        <h1>${profileData.user.name}</h1>
        <p>${profileData.user.designation} | ${profileData.user.department} | ${profileData.user.school}</p>
        <p>Email: ${profileData.user.email}</p>
        <h2>Profile Summary</h2>
        <p>Total Publications: ${profileData.publications.length}</p>
        <p>Total Citations: ${profileData.profile.metrics.totalCitations}</p>
        <p>h-index: ${profileData.profile.metrics.hIndex}</p>
        <h2>Publications</h2>
        <ul>${publicationItems}</ul>
      </body>
    </html>
  `;
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
      const safeName = profileData.user.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'research-profile';

      if (format === 'csv') {
        triggerTextDownload(
          `${safeName}-publications.csv`,
          buildCsvExport(profileData),
          'text/csv;charset=utf-8;'
        );
        onMessage('success', 'CSV export downloaded');
        return;
      }

      if (format === 'bibtex') {
        triggerTextDownload(
          `${safeName}-publications.bib`,
          buildBibTexExport(profileData),
          'text/plain;charset=utf-8;'
        );
        onMessage('success', 'BibTeX export downloaded');
        return;
      }

      const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
      if (!printWindow) {
        onMessage('error', 'Popup blocked. Please allow popups to export PDF.');
        return;
      }

      printWindow.document.open();
      printWindow.document.write(buildPrintableHtml(profileData));
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      onMessage('success', 'Print dialog opened. Choose "Save as PDF" to download the report.');
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
