'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { profileService, UserSettings } from '@/shared/services/profile.service';
import { getProfileImageUrl } from '@/features/chat/services/chat.service';
import logger from '@/shared/utils/logger';
import { extractErrorMessage } from '@/shared/types/api.types';
import { 
  Settings,
  Bell,
  Lock,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Globe,
  Shield,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  User
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

  const [preferences, setPreferences] = useState({
    theme: 'light',
    language: 'en',
    compactView: false,
    showTips: true
  });

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
        setPreferences({
          theme: settings.theme,
          language: settings.language,
          compactView: settings.compactView,
          showTips: settings.showTips
        });
      } catch (error) {
        logger.error('Error loading settings:', error);
        // Use defaults if settings fail to load
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadSettings();
    }
  }, [user]);

  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePreferenceChange = (key: keyof typeof preferences, value: string | boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
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

  const handleSavePreferences = async () => {
    try {
      setIsSaving(true);
      setMessage(null);
      
      await profileService.updateSettings(preferences);
      
      setMessage({ type: 'success', text: 'Preferences saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: unknown) {
      logger.error('Error saving preferences:', error);
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
    { id: 'preferences', name: 'Preferences', icon: Settings }
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">Manage your account settings and preferences</p>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                {/* Profile Tab */}
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Photo</h3>
                      <p className="text-sm text-gray-500 mb-6">Upload and manage your profile photo</p>
                    </div>

                    <ProfilePhotoUpload
                      currentPhotoUrl={user?.profileImage ? getProfileImageUrl(user.profileImage) : null}
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

                    <div className="pt-6 border-t border-gray-200">
                      <h4 className="text-md font-semibold text-gray-900 mb-3">About Profile Photos</h4>
                      <ul className="text-sm text-gray-600 space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 mt-1">•</span>
                          <span>Your profile photo is visible to other users in your groups and conversations</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 mt-1">•</span>
                          <span>The ability to upload a profile photo may be controlled by your group administrators</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 mt-1">•</span>
                          <span>Profile photos must be under 5MB and in JPEG, PNG, GIF, or WebP format</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
                      <p className="text-sm text-gray-500 mb-6">Choose how you want to receive notifications</p>
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
                        <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                          <div>
                            <p className="font-medium text-gray-900">{item.label}</p>
                            <p className="text-sm text-gray-500">{item.description}</p>
                          </div>
                          <button
                            onClick={() => handleNotificationChange(item.key as keyof typeof notifications)}
                            className={`
                              relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                              transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                              ${notifications[item.key as keyof typeof notifications] ? 'bg-blue-600' : 'bg-gray-200'}
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
                        className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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
                {activeTab === 'security' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h3>
                      <p className="text-sm text-gray-500 mb-6">Update your password to keep your account secure</p>
                    </div>

                    <div className="max-w-md space-y-4">
                      {/* Current Password */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            name="currentPassword"
                            value={passwordData.currentPassword}
                            onChange={handlePasswordChange}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            name="newPassword"
                            value={passwordData.newPassword}
                            onChange={handlePasswordChange}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        <p className="mt-1 text-xs text-gray-500">Must be at least 8 characters</p>
                      </div>

                      {/* Confirm Password */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            name="confirmPassword"
                            value={passwordData.confirmPassword}
                            onChange={handlePasswordChange}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                          className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="mt-8 pt-6 border-t border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-4">Security Information</h4>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="flex items-start">
                          <Shield className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-blue-900">Your account is protected</p>
                            <p className="text-sm text-blue-700 mt-1">
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

                {/* Preferences Tab */}
                {activeTab === 'preferences' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Display Preferences</h3>
                      <p className="text-sm text-gray-500 mb-6">Customize your experience</p>
                    </div>

                    <div className="space-y-6">
                      {/* Theme */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">Theme</label>
                        <div className="flex space-x-4">
                          <button
                            onClick={() => handlePreferenceChange('theme', 'light')}
                            className={`
                              flex items-center px-4 py-3 rounded-lg border-2 transition-colors
                              ${preferences.theme === 'light' 
                                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                              }
                            `}
                          >
                            <Sun className="w-5 h-5 mr-2" />
                            Light
                          </button>
                          <button
                            onClick={() => handlePreferenceChange('theme', 'dark')}
                            className={`
                              flex items-center px-4 py-3 rounded-lg border-2 transition-colors
                              ${preferences.theme === 'dark' 
                                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                              }
                            `}
                          >
                            <Moon className="w-5 h-5 mr-2" />
                            Dark
                          </button>
                        </div>
                      </div>

                      {/* Language */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">Language</label>
                        <div className="relative max-w-xs">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <select
                            value={preferences.language}
                            onChange={(e) => handlePreferenceChange('language', e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                          >
                            <option value="en">English</option>
                            <option value="hi">हिंदी (Hindi)</option>
                          </select>
                        </div>
                      </div>

                      {/* Other Preferences */}
                      <div className="space-y-4 pt-4">
                        {[
                          { key: 'compactView', label: 'Compact View', description: 'Use a more condensed layout' },
                          { key: 'showTips', label: 'Show Tips', description: 'Display helpful tips and suggestions' }
                        ].map((item) => (
                          <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                            <div>
                              <p className="font-medium text-gray-900">{item.label}</p>
                              <p className="text-sm text-gray-500">{item.description}</p>
                            </div>
                            <button
                              onClick={() => handlePreferenceChange(item.key as keyof typeof preferences, !preferences[item.key as keyof typeof preferences])}
                              className={`
                                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                                transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                ${preferences[item.key as keyof typeof preferences] ? 'bg-blue-600' : 'bg-gray-200'}
                              `}
                            >
                              <span
                                className={`
                                  pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                                  transition duration-200 ease-in-out
                                  ${preferences[item.key as keyof typeof preferences] ? 'translate-x-5' : 'translate-x-0'}
                                `}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={handleSavePreferences}
                        disabled={isSaving}
                        className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Preferences
                          </>
                        )}
                      </button>
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
