'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScreenshotUploadProps {
  screenshots: File[];
  onScreenshotsChange: (files: File[]) => void;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  acceptedTypes?: string[];
  error?: string;
}

const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

export function ScreenshotUpload({
  screenshots,
  onScreenshotsChange,
  maxFiles = DEFAULT_MAX_FILES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  error,
}: ScreenshotUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file type
      if (!acceptedTypes.includes(file.type)) {
        return `Invalid file type. Please upload only: ${acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}`;
      }

      // Check file size
      if (file.size > maxFileSize) {
        const maxSizeMB = maxFileSize / (1024 * 1024);
        return `File size must not exceed ${maxSizeMB}MB. "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(2)}MB`;
      }

      return null;
    },
    [acceptedTypes, maxFileSize]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setValidationError('');

      const newFiles = Array.from(files);
      const totalFiles = screenshots.length + newFiles.length;

      // Check max file count
      if (totalFiles > maxFiles) {
        setValidationError(`You can upload a maximum of ${maxFiles} screenshots. Currently selected: ${screenshots.length}`);
        return;
      }

      // Validate each file
      for (const file of newFiles) {
        const error = validateFile(file);
        if (error) {
          setValidationError(error);
          return;
        }
      }

      // Add new files to existing screenshots
      onScreenshotsChange([...screenshots, ...newFiles]);
    },
    [screenshots, maxFiles, validateFile, onScreenshotsChange]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      handleFiles(files);
    },
    [handleFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFiles]
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const displayError = error || validationError;

  return (
    <div className="space-y-2">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30',
          displayError && 'border-destructive'
        )}
        role="button"
        aria-label="Upload screenshots - drag and drop or click to browse"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleBrowseClick();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
          aria-label="Upload screenshots"
          aria-describedby={displayError ? 'upload-error' : 'upload-instructions'}
        />

        <Upload className={cn('h-10 w-10 mb-3', isDragging ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />

        <div className="text-center" id="upload-instructions">
          <p className="text-sm font-medium text-foreground mb-1">
            {isDragging ? 'Drop screenshots here' : 'Drag and drop screenshots here'}
          </p>
          <p className="text-xs text-muted-foreground mb-2">or click to browse</p>
          <p className="text-xs text-muted-foreground">
            {acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')} • Max {maxFileSize / (1024 * 1024)}MB per file • Up to {maxFiles} files
          </p>
        </div>

        {screenshots.length > 0 && (
          <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full" aria-label={`${screenshots.length} of ${maxFiles} files selected`}>
            {screenshots.length} / {maxFiles}
          </div>
        )}
      </div>

      {displayError && (
        <p id="upload-error" className="text-xs text-destructive flex items-start gap-1" role="alert">
          <X className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{displayError}</span>
        </p>
      )}

      {screenshots.length > 0 && !displayError && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
}
