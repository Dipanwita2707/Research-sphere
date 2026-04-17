'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { profileService, UpdateProfileData } from '@/shared/services/profile.service';
import logger from '@/shared/utils/logger';
import { extractErrorMessage } from '@/shared/types/api.types';
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  Briefcase, 
  Calendar,
  Shield,
  Edit2,
  Save,
  X,
  Camera,
  GraduationCap,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

export default function ProfilePage() {
  const { user, checkAuth } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: ''
  });

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await checkAuth();
      setMessage({ type: 'success', text: 'Profile refreshed successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to refresh profile' });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.employeeDetails?.phone || '',
        email: user.email || ''
      });
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setMessage(null);

      const updateData: UpdateProfileData = {};
      
      // Only include changed fields
      if (formData.firstName !== (user?.firstName || '')) {
        updateData.firstName = formData.firstName;
      }
      if (formData.lastName !== (user?.lastName || '')) {
        updateData.lastName = formData.lastName;
      }
      if (formData.phone !== (user?.employeeDetails?.phone || '')) {
        updateData.phone = formData.phone;
      }
      if (formData.email !== (user?.email || '')) {
        updateData.email = formData.email;
      }

      if (Object.keys(updateData).length ===
   0) {
        setMessage({ type: 'error', text: 'No changes to save' });
        setIsEditing(false);
        return;
      }

      await profileService.updateProfile(updateData);
      
      // Refresh user data
      await checkAuth();
      
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error: unknown) {
      logger.error('Error updating profile:', error);
      setMessage({ 
        type: 'error', 
        text: extractErrorMessage(error)
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.employeeDetails?.phone || '',
        email: user.email || ''
      });
    }
    setIsEditing(false);
    setMessage(null);
  };

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
              <p className="mt-2 text-gray-600">View and manage your personal information</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {isRefreshing ? 'Refreshing...' : 'Refresh Profile'}
            </button>
          </div>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type ===
   'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
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

        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Profile Header with Avatar */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-8">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-3xl font-bold text-blue-600">
                    {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                  </span>
                </div>
                <button className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md hover:bg-gray-50 transition-colors">
                  <Camera className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              <div className="text-white">
                <h2 className="text-2xl font-bold">{user.firstName} {user.lastName}</h2>
                <p className="text-blue-100 flex items-center mt-1">
                  <Briefcase className="w-4 h-4 mr-2" />
                  {user.employeeDetails?.designation?.name || user.role?.name || 'Staff'}
                </p>
                <p className="text-blue-100 flex items-center mt-1">
                  <Building2 className="w-4 h-4 mr-2" />
                  {user.employeeDetails?.department?.name || 'Not Assigned'}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Content */}
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Profile
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Name */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">First Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 font-medium flex items-center">
                    <User className="w-4 h-4 mr-2 text-gray-400" />
                    {user.firstName || 'Not set'}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Last Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 font-medium flex items-center">
                    <User className="w-4 h-4 mr-2 text-gray-400" />
                    {user.lastName || 'Not set'}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                {isEditing ? (
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 font-medium flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-gray-400" />
                    {user.email || 'Not set'}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter phone number"
                  />
                ) : (
                  <p className="text-gray-900 font-medium flex items-center">
                    <Phone className="w-4 h-4 mr-2 text-gray-400" />
                    {user.employeeDetails?.phone || 'Not provided'}
                  </p>
                )}
              </div>

              {/* Employee ID */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Employee ID</label>
                <p className="text-gray-900 font-medium flex items-center">
                  <Shield className="w-4 h-4 mr-2 text-gray-400" />
                  {user.employeeDetails?.employeeId || user.uid || 'N/A'}
                </p>
              </div>

              {/* Join Date */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Join Date</label>
                <p className="text-gray-900 font-medium flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                  {user.employeeDetails?.joiningDate 
                    ? new Date(user.employeeDetails.joiningDate).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    : 'Not available'}
                </p>
              </div>
            </div>

            {/* Department & Role Section */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Work Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Department */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Department</label>
                  <p className="text-gray-900 font-medium flex items-center">
                    <Building2 className="w-5 h-5 mr-2 text-blue-500" />
                    {user.employeeDetails?.department?.name || 'Not Assigned'}
                  </p>
                </div>

                {/* Designation */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Designation</label>
                  <p className="text-gray-900 font-medium flex items-center">
                    <Briefcase className="w-5 h-5 mr-2 text-green-500" />
                    {user.employeeDetails?.designation?.name || 'Not Assigned'}
                  </p>
                </div>

                {/* Faculty/School */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Faculty/School</label>
                  <p className="text-gray-900 font-medium flex items-center">
                    <GraduationCap className="w-5 h-5 mr-2 text-purple-500" />
                    {user.employeeDetails?.department?.school?.name || 'Central Department'}
                  </p>
                </div>

                {/* Role */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-500 mb-1">System Role</label>
                  <p className="text-gray-900 font-medium flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-orange-500" />
                    {user.role?.name || user.role?.displayName || 'User'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
