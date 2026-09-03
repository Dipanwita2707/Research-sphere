'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { profileService, UserSettings, AffiliationVariants, getProfileImageUrl } from '@/shared/services/profile.service';
import logger from '@/shared/utils/logger';
import { extractErrorMessage } from '@/shared/types/api.types';
import { 
  Bell,
  Lock,
  Eye,
  EyeOff,
  Shield,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
  Building2,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { ProfilePhotoUpload } from '@/shared/components/ProfilePhotoUpload';

export default function SettingsPage() {
  const { user, refreshUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    iprUpdates: true,
    taskReminders: true,
    systemAlerts: true,
    weeklyDigest: false
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [affiliation, setAffiliation] = useState<AffiliationVariants | null>(null);
  const [affiliationInput, setAffiliationInput] = useState('');
  const [isAffiliationLoading, setIsAffiliationLoading] = useState(true);
  const [isSavingAffiliation, setIsSavingAffiliation] = useState(false);
  const [showVariants, setShowVariants] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const settings = await profileService.getSettings();
        setNotifications({
          emailNotifications: settings.emailNotifications,
          pushNotifications: settings.pushNotifications,
          iprUpdates: settings.iprUpdates,
          taskReminders: settings.taskReminders,
          systemAlerts: settings.systemAlerts,
          weeklyDigest: settings.weeklyDigest
        });
      } catch (error) {
        logger.error('Error loading settings:', error);
        // Use defaults if settings fail to load
      } finally {
        setIsLoading(false);
      }
    };

    const loadAffiliation = async () => {
      try {
        setIsAffiliationLoading(true);
        const data = await profileService.getAffiliationVariants();
        setAffiliation(data);
        setAffiliationInput(data.current);
      } catch (error) {
        logger.error('Error loading affiliation:', error);
      } finally {
        setIsAffiliationLoading(false);
      }
    };

    if (user) {
      loadSettings();
      loadAffiliation();
    }
  }, [user]);

  const handleSaveAffiliation = async () => {
    try {
      setIsSavingAffiliation(true);
      setMessage(null);
      const trimmed = affiliationInput.trim();
      const isSuggested = affiliation && trimmed === affiliation.suggested;
      await profileService.updateSettings({
        affiliationOverride: isSuggested ? null : trimmed,
      });
      setAffiliation(prev => prev ? { ...prev, current: trimmed || prev.suggested, hasOverride: !isSuggested && Boolean(trimmed) } : prev);
      setMessage({ type: 'success', text: 'Affiliation updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: unknown) {
      logger.error('Error saving affiliation:', error);
      setMessage({ type: 'error', text: extractErrorMessage(error) });
    } finally {
      setIsSavingAffiliation(false);
    }
  };

  const handleResetAffiliation = async () => {
    if (!affiliation) return;
    setAffiliationInput(affiliation.suggested);
    try {
      setIsSavingAffiliation(true);
      await profileService.updateSettings({ affiliationOverride: null });
      setAffiliation(prev => prev ? { ...prev, current: prev.suggested, hasOverride: false } : prev);
      setMessage({ type: 'success', text: 'Affiliation reset to suggested value.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: unknown) {
      logger.error('Error resetting affiliation:', error);
      setMessage({ type: 'error', text: extractErrorMessage(error) });
    } finally {
      setIsSavingAffiliation(false);
    }
  };

  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveNotifications = async () => {
    try {
      setIsSaving(true);
      setMessage(null);
      
      await profileService.updateSettings(notifications);
      
      setMessage({ type: 'success', text: 'Notification settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: unknown) {
      logger.error('Error saving notifications:', error);
      setMessage({ 
        type: 'error', 
        text: extractErrorMessage(error)
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    // Validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    try {
      setIsSaving(true);
      setMessage(null);
      
      await profileService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: unknown) {
      logger.error('Error changing password:', error);
      setMessage({ 
        type: 'error', 
        text: extractErrorMessage(error)
      });
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Lock },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7d1a34]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Manage your account settings and preferences</p>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type ===
   'success' 
              ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}>
            {message.type ===
   'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${activeTab ===
   tab.id
                      ? 'border-[#7d1a34] text-[#7d1a34] dark:text-[#c8973f]'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <tab.icon className="w-5 h-5 mr-2" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#7d1a34]" />
              </div>
            ) : (
              <>
                {/* Profile Tab */}
                {activeTab ===
   'profile' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Photo</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Upload and manage your profile photo</p>
                    </div>

                    <ProfilePhotoUpload
                      currentPhotoUrl={user?.profileImageUrl ? getProfileImageUrl(user.profileImageUrl) : null}
                      userId={user?.id || ''}
                      onPhotoUpdated={async (url) => {
                        // Refresh user data from server to get new profile image URL
                        logger.info('Photo updated:', url);
                        await refreshUser();
                      }}
                      onPhotoDeleted={async () => {
                        // Refresh user data from server to clear profile image URL
                        logger.info('Photo deleted');
                        await refreshUser();
                      }}
                    />

                    {/* User Information */}
                    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Profile Information</h4>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                        {user?.uid && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Employee UID:</span>
                            <span className="text-sm text-gray-900 dark:text-white font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                              {user.uid}
                            </span>
                          </div>
                        )}
                        {(user?.student?.registrationNo || user?.employee?.empId || user?.employeeDetails?.employeeId) && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {user?.student?.registrationNo ? 'Registration Number:' : 'Employee ID:'}
                            </span>
                            <span className="text-sm text-gray-900 dark:text-white font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                              {user?.student?.registrationNo || user?.employee?.empId || user?.employeeDetails?.employeeId}
                            </span>
                          </div>
                        )}
                        {user?.email && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email:</span>
                            <span className="text-sm text-gray-900 dark:text-white">
                              {user.email}
                            </span>
                          </div>
                        )}
                        {user?.role?.name && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Role:</span>
                            <span className="text-sm text-gray-900 dark:text-white capitalize">
                              {user.role.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-[#7d1a34] dark:text-[#c8973f]" />
                        Research Affiliation
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        This is the affiliation shown on your research contributions and used when matching your publications during sync. It&apos;s auto-generated from your university&apos;s name — you can override it below.
                      </p>

                      {isAffiliationLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading affiliation...
                        </div>
                      ) : (
                        <div className="space-y-3 max-w-lg">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={affiliationInput}
                              onChange={(e) => setAffiliationInput(e.target.value)}
                              placeholder={affiliation?.suggested || 'Your affiliation'}
                              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#7d1a34] focus:border-[#7d1a34] bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                            <button
                              onClick={handleSaveAffiliation}
                              disabled={isSavingAffiliation || !affiliationInput.trim()}
                              className="flex items-center px-4 py-2 bg-[#7d1a34] text-white rounded-lg hover:bg-[#5e1024] transition-colors disabled:opacity-50 text-sm font-medium"
                            >
                              {isSavingAffiliation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            </button>
                          </div>

                          {affiliation?.hasOverride && (
                            <button
                              onClick={handleResetAffiliation}
                              disabled={isSavingAffiliation}
                              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-[#7d1a34] dark:hover:text-[#c8973f]"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Reset to suggested: &quot;{affiliation.suggested}&quot;
                            </button>
                          )}

                          {affiliation && affiliation.variants.length > 0 && (
                            <div>
                              <button
                                onClick={() => setShowVariants(!showVariants)}
                                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                              >
                                {showVariants ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                Recognized name variants ({affiliation.variants.length})
                              </button>
                              {showVariants && (
                                <div className="mt-2 flex flex-wrap gap-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                  {affiliation.variants.map((variant) => (
                                    <span
                                      key={variant}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                                    >
                                      {variant}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                                These are the name forms recognized as belonging to your university when your papers are automatically matched.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">About Profile Photos</h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="text-[#7d1a34] mt-1">•</span>
                          <span>Your profile photo is visible to other users in your groups and conversations</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#7d1a34] mt-1">•</span>
                          <span>The ability to upload a profile photo may be controlled by your group administrators</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#7d1a34] mt-1">•</span>
                          <span>Profile photos must be under 5MB and in JPEG, PNG, GIF, or WebP format</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Notifications Tab */}
                {activeTab ===
   'notifications' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notification Preferences</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Choose how you want to receive notifications</p>
                    </div>

                    <div className="space-y-4">
                      {[
                        { key: 'emailNotifications', label: 'Email Notifications', description: 'Receive notifications via email' },
                        { key: 'pushNotifications', label: 'Push Notifications', description: 'Receive browser push notifications' },
                        { key: 'iprUpdates', label: 'IPR Updates', description: 'Get notified about IPR application status changes' },
                        { key: 'taskReminders', label: 'Task Reminders', description: 'Receive reminders for pending tasks' },
                        { key: 'systemAlerts', label: 'System Alerts', description: 'Important system notifications and alerts' },
                        { key: 'weeklyDigest', label: 'Weekly Digest', description: 'Receive a weekly summary of activities' }
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{item.label}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
                          </div>
                          <button
                            onClick={() => handleNotificationChange(item.key as keyof typeof notifications)}
                            className={`
                              relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                              transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#7d1a34] focus:ring-offset-2 dark:focus:ring-offset-gray-800
                              ${notifications[item.key as keyof typeof notifications] ? 'bg-[#7d1a34]' : 'bg-gray-200 dark:bg-gray-600'}
                            `}
                          >
                            <span
                              className={`
                                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                                transition duration-200 ease-in-out
                                ${notifications[item.key as keyof typeof notifications] ? 'translate-x-5' : 'translate-x-0'}
                              `}
                            />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={handleSaveNotifications}
                        disabled={isSaving}
                        className="flex items-center px-6 py-2 bg-[#7d1a34] text-white rounded-lg hover:bg-[#5e1024] transition-colors disabled:opacity-50"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Security Tab */}
                {activeTab ===
   'security' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Change Password</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Update your password to keep your account secure</p>
                    </div>

                    <div className="max-w-md space-y-4">
                      {/* Current Password */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            name="currentPassword"
                            value={passwordData.currentPassword}
                            onChange={handlePasswordChange}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#7d1a34] focus:border-[#7d1a34] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* New Password */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            name="newPassword"
                            value={passwordData.newPassword}
                            onChange={handlePasswordChange}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#7d1a34] focus:border-[#7d1a34] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                            placeholder="Enter new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Must be at least 8 characters</p>
                      </div>

                      {/* Confirm Password */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            name="confirmPassword"
                            value={passwordData.confirmPassword}
                            onChange={handlePasswordChange}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#7d1a34] focus:border-[#7d1a34] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                            placeholder="Confirm new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-4">
                        <button
                          onClick={handleChangePassword}
                          disabled={!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword || isSaving}
                          className="flex items-center px-6 py-2 bg-[#7d1a34] text-white rounded-lg hover:bg-[#5e1024] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4 mr-2" />
                              Update Password
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Security Info */}
                    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-4">Security Information</h4>
                      <div className="bg-[#fdf5ec] dark:bg-[#7d1a34]/10 rounded-lg p-4">
                        <div className="flex items-start">
                          <Shield className="w-5 h-5 text-[#7d1a34] dark:text-[#c8973f] mt-0.5 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-[#7d1a34] dark:text-[#c8973f]">Your account is protected</p>
                            <p className="text-sm text-[#7d1a34] dark:text-[#c8973f] mt-1">
                              Last login: {new Date().toLocaleDateString('en-IN', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
