/**
 * File Upload Component
 * Button to trigger file selection
 */
'use client';

import React, { useRef } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  accept?: string;
  trigger?: React.ReactNode;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export function FileUpload({ onFileSelect, disabled = false, accept, trigger }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      alert(`File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      return;
    }

    onFileSelect(file);
    
    // Reset input so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        onChange={handleChange}
        accept={accept}
        className="hidden"
      />
      {trigger ? (
        <div onClick={handleClick} style={{ display: 'contents' }}>
          {trigger}
        </div>
      ) : (
        <button
          onClick={handleClick}
          disabled={disabled}
          className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-[#6497b1] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
          title="Attach file"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </>
  );
}
