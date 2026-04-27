'use client';

import { useState, useCallback } from 'react';

interface UploadProgress {
  fileIndex: number;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  retryCount: number;
}

interface UseScreenshotUploadReturn {
  uploadProgress: UploadProgress[];
  isUploading: boolean;
  uploadScreenshots: (files: File[]) => Promise<boolean>;
  retryFailedUploads: () => Promise<void>;
  clearProgress: () => void;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Start with 1 second
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

/**
 * Hook for handling screenshot uploads with retry logic
 */
export function useScreenshotUpload(): UseScreenshotUploadReturn {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  /**
   * Validate a single file
   */
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: 'Please upload only image files (PNG, JPEG, GIF, WebP).',
      };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: 'File size must not exceed 5MB.',
      };
    }

    return { valid: true };
  }, []);

  /**
   * Sleep for exponential backoff
   */
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Upload a single file with retry logic
   */
  const uploadSingleFile = useCallback(
    async (
      file: File,
      fileIndex: number,
      retryCount: number = 0
    ): Promise<{ success: boolean; error?: string }> => {
      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      try {
        // Update progress to uploading
        setUploadProgress(prev =>
          prev.map((p, i) =>
            i === fileIndex
              ? { ...p, status: 'uploading', progress: 0, retryCount }
              : p
          )
        );

        // Simulate upload progress (in real implementation, use XMLHttpRequest or axios with onUploadProgress)
        // For now, we'll just mark as success since the actual upload happens in submitBugReport
        await sleep(500); // Simulate network delay

        // Update progress to success
        setUploadProgress(prev =>
          prev.map((p, i) =>
            i === fileIndex
              ? { ...p, status: 'success', progress: 100 }
              : p
          )
        );

        return { success: true };
      } catch (error: any) {
        console.error(`Error uploading file ${file.name}:`, error);

        // Retry logic with exponential backoff
        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, retryCount); // Exponential backoff
          
          await sleep(delay);
          return uploadSingleFile(file, fileIndex, retryCount + 1);
        }

        // Max retries reached
        const errorMessage = error.response?.data?.message || 'Failed to upload screenshot. Please try again.';
        
        setUploadProgress(prev =>
          prev.map((p, i) =>
            i === fileIndex
              ? { ...p, status: 'error', error: errorMessage, retryCount }
              : p
          )
        );

        return { success: false, error: errorMessage };
      }
    },
    [validateFile]
  );

  /**
   * Upload multiple screenshots
   */
  const uploadScreenshots = useCallback(
    async (files: File[]): Promise<boolean> => {
      if (files.length === 0) {
        return true;
      }

      setIsUploading(true);

      // Initialize progress for all files
      const initialProgress: UploadProgress[] = files.map((file, index) => ({
        fileIndex: index,
        fileName: file.name,
        progress: 0,
        status: 'pending',
        retryCount: 0,
      }));
      setUploadProgress(initialProgress);

      try {
        // Upload all files (in parallel for better performance)
        const results = await Promise.all(
          files.map((file, index) => uploadSingleFile(file, index))
        );

        // Check if all uploads succeeded
        const allSuccess = results.every(r => r.success);
        return allSuccess;
      } catch (error) {
        console.error('Error uploading screenshots:', error);
        return false;
      } finally {
        setIsUploading(false);
      }
    },
    [uploadSingleFile]
  );

  /**
   * Retry failed uploads
   */
  const retryFailedUploads = useCallback(async () => {
    const failedUploads = uploadProgress.filter(p => p.status === 'error');
    
    if (failedUploads.length === 0) {
      return;
    }

    setIsUploading(true);

    try {
      // Note: In a real implementation, you'd need to keep references to the original File objects
      // For now, this is a placeholder that shows the pattern
      
      // Reset failed uploads to pending
      setUploadProgress(prev =>
        prev.map(p =>
          p.status === 'error'
            ? { ...p, status: 'pending', error: undefined, retryCount: 0 }
            : p
        )
      );
    } finally {
      setIsUploading(false);
    }
  }, [uploadProgress]);

  /**
   * Clear upload progress
   */
  const clearProgress = useCallback(() => {
    setUploadProgress([]);
    setIsUploading(false);
  }, []);

  return {
    uploadProgress,
    isUploading,
    uploadScreenshots,
    retryFailedUploads,
    clearProgress,
  };
}
