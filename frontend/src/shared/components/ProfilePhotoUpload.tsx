/**
 * Profile Photo Upload Component
 * Allows users to upload their profile photo with permission checks
 * Includes WhatsApp-style image editor with drag and zoom
 */
'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Camera, Trash2, Upload, Loader2, X, AlertCircle, Check, ZoomIn, ZoomOut } from 'lucide-react';
import { profileService } from '@/shared/services/profile.service';
import * as chatService from '@/features/chat/services/chat.service';
import logger from '@/shared/utils/logger';

interface ProfilePhotoUploadProps {
  currentPhotoUrl?: string | null;
  userId: string;
  onPhotoUpdated?: (photoUrl: string) => void;
  onPhotoDeleted?: () => void;
}

export function ProfilePhotoUpload({
  currentPhotoUrl,
  userId,
  onPhotoUpdated,
  onPhotoDeleted,
}: ProfilePhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  
  // Image editor state
  const [showEditor, setShowEditor] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editorImageUrl, setEditorImageUrl] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [imageScale, setImageScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Check permission on mount
  React.useEffect(() => {
    checkUploadPermission();
  }, [userId]);

  const checkUploadPermission = async () => {
    try {
      setIsCheckingPermission(true);
      // Get user's global chat permissions
      const access = await chatService.getMyPermissions();
      
      // If access is denied completely, no upload
      if (access.hasAccess === false) {
        setHasPermission(false);
        return;
      }

      // Check specific permission (default to true if permissions object is missing but hasAccess is true)
      // This handles the case where existing users might not have a permission record yet
      const canUpload = access.permissions?.canUploadProfilePhoto ?? true;
      setHasPermission(canUpload);
    } catch (error) {
      logger.error('Error checking profile photo permission:', error);
      // Default to allowed on error to prevent blocking users if service is down,
      // unless it's a 403 which would be caught above usually.
      setHasPermission(true);
    } finally {
      setIsCheckingPermission(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 5MB');
      return;
    }

    // Open editor
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditorImageUrl(reader.result as string);
      setSelectedFile(file);
      setShowEditor(true);
      setImagePosition({ x: 0, y: 0 });
      setImageScale(1);
    };
    reader.readAsDataURL(file);
  };

  // Handle mouse/touch drag
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setImagePosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleZoomIn = () => {
    setImageScale((prev) => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setImageScale((prev) => Math.max(prev - 0.1, 0.5));
  };

  const handleCancelEdit = () => {
    setShowEditor(false);
    setSelectedFile(null);
    setEditorImageUrl(null);
    setImagePosition({ x: 0, y: 0 });
    setImageScale(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmEdit = async () => {
    if (!selectedFile || !canvasRef.current || !imageRef.current) return;

    try {
      setIsUploading(true);
      setError(null);

      // Create a cropped/positioned version
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = 500; // Output size
      canvas.width = size;
      canvas.height = size;

      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);

      // Draw the image with transformations
      const img = imageRef.current;
      const scale = imageScale;
      const imgWidth = img.naturalWidth * scale;
      const imgHeight = img.naturalHeight * scale;
      
      // Center the image and apply position offset
      const x = (size - imgWidth) / 2 + imagePosition.x;
      const y = (size - imgHeight) / 2 + imagePosition.y;

      ctx.drawImage(img, x, y, imgWidth, imgHeight);

      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        const file = new File([blob], selectedFile.name, { type: 'image/jpeg' });
        
        const result = await profileService.uploadProfilePhoto(file);
        
        setSuccess('Profile photo uploaded successfully!');
        setPreviewUrl(result.profileImageUrl);
        
        if (onPhotoUpdated) {
          onPhotoUpdated(result.profileImageUrl);
        }

        handleCancelEdit();
        setTimeout(() => setSuccess(null), 3000);
      }, 'image/jpeg', 0.95);
    } catch (err: any) {
      logger.error('Upload error:', err);
      const errorMessage = err.response?.data?.message || 'Failed to upload profile photo';
      setError(errorMessage);
    } finally {
      setIsUploading(false);
      setShowEditor(false);
      setEditorImageUrl(null);
      setSelectedFile(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete your profile photo?')) {
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      setSuccess(null);

      await profileService.deleteProfilePhoto();
      
      setSuccess('Profile photo deleted successfully!');
      setPreviewUrl(null);
      
      if (onPhotoDeleted) {
        onPhotoDeleted();
      }

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      logger.error('Delete error:', err);
      const errorMessage = err.response?.data?.message || 'Failed to delete profile photo';
      setError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const triggerFileInput = () => {
    if (hasPermission && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  if (isCheckingPermission) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (hasPermission === false) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
              Photo Upload Restricted
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              You don't have permission to upload a profile photo. Contact your group administrator to request access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Image Editor Modal */}
      {showEditor && editorImageUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <div className="relative w-full max-w-2xl mx-4">
            {/* Header */}
            <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-6 z-10">
              <button
                onClick={handleCancelEdit}
                disabled={isUploading}
                className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <span className="text-white text-sm font-medium">Drag the image to adjust</span>
              <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Image Container */}
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '500px' }}>
              <div 
                className="absolute inset-0 flex items-center justify-center cursor-move"
                onMouseDown={handleMouseDown}
                style={{ overflow: 'hidden' }}
              >
                <img
                  ref={imageRef}
                  src={editorImageUrl}
                  alt="Edit"
                  className="max-w-none select-none"
                  draggable={false}
                  style={{
                    transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale})`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  }}
                />
              </div>

              {/* Circular Overlay Guide */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-96 h-96 rounded-full border-4 border-white/50" />
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3">
              <button
                onClick={handleZoomIn}
                disabled={imageScale >= 3}
                className="p-3 bg-white/90 hover:bg-white rounded-full shadow-lg disabled:opacity-50 transition-all"
              >
                <ZoomIn className="w-5 h-5 text-gray-700" />
              </button>
              <button
                onClick={handleZoomOut}
                disabled={imageScale <= 0.5}
                className="p-3 bg-white/90 hover:bg-white rounded-full shadow-lg disabled:opacity-50 transition-all"
              >
                <ZoomOut className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Confirm Button */}
            <div className="absolute bottom-8 right-8">
              <button
                onClick={handleConfirmEdit}
                disabled={isUploading}
                className="p-4 bg-green-600 hover:bg-green-700 rounded-full shadow-lg text-white transition-all disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  <Check className="w-7 h-7" />
                )}
              </button>
            </div>
          </div>

          {/* Hidden canvas for cropping */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-green-800 dark:text-green-200">{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Photo Display & Controls */}
      <div className="flex items-center gap-6">
        {/* Photo Preview */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            {previewUrl ? (
              <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-10 h-10 text-white" />
            )}
          </div>
          
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading || !hasPermission}
          />
          
          <div className="flex items-center gap-3">
            <button
              onClick={triggerFileInput}
              disabled={isUploading || !hasPermission}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {previewUrl ? 'Change Photo' : 'Upload Photo'}
                </>
              )}
            </button>

            {previewUrl && (
              <button
                onClick={handleDelete}
                disabled={isDeleting || !hasPermission}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Photo
                  </>
                )}
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Max file size: 5MB. Supported: JPEG, PNG, GIF, WebP
          </p>
        </div>
      </div>
    </div>
  );
}
