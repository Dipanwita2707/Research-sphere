/**
 * File Preview Component
 * Displays file attachment in messages
 */
'use client';

import React from 'react';

interface FilePreviewProps {
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
}

export function FilePreview({ fileName, fileSize, mimeType, fileUrl }: FilePreviewProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    if (mimeType.startsWith('image/')) {
      return (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
        </svg>
      );
    }
    if (mimeType.startsWith('video/')) {
      return (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
        </svg>
      );
    }
    if (mimeType ===
   'application/pdf') {
      return (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" />
        </svg>
      );
    }
    // Default file icon
    return (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
      </svg>
    );
  };

  const getFileExtension = () => {
    const ext = fileName.split('.').pop()?.toUpperCase() || '';
    return ext.slice(0, 4);
  };

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={fileName}
      className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors min-w-[200px]"
    >
      {/* File Icon */}
      <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center relative">
        {getFileIcon()}
        <span className="absolute -bottom-1 -right-1 text-[8px] bg-blue-600 text-white px-1 rounded font-bold">
          {getFileExtension()}
        </span>
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName}</p>
        <p className="text-xs opacity-70">{formatFileSize(fileSize)}</p>
      </div>

      {/* Download Icon */}
      <svg className="w-5 h-5 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </a>
  );
}
