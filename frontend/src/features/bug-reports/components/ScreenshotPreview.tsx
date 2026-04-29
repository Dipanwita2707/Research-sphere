'use client';

import React, { useMemo } from 'react';
import { X, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScreenshotPreviewProps {
  screenshots: File[];
  onRemove: (index: number) => void;
  className?: string;
}

export function ScreenshotPreview({ screenshots, onRemove, className }: ScreenshotPreviewProps) {
  // Generate preview URLs for images
  const previewUrls = useMemo(() => {
    return screenshots.map(file => URL.createObjectURL(file));
  }, [screenshots]);

  // Cleanup URLs when component unmounts or screenshots change
  React.useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (screenshots.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm font-medium text-foreground">Selected Screenshots</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="list" aria-label="Selected screenshots">
        {screenshots.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className="relative group flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
            role="listitem"
          >
            {/* Thumbnail */}
            <div className="relative shrink-0 w-16 h-16 rounded-md overflow-hidden bg-muted border border-border">
              <img
                src={previewUrls[index]}
                alt={`Screenshot: ${file.name}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const icon = document.createElement('div');
                    icon.className = 'flex items-center justify-center w-full h-full';
                    icon.setAttribute('aria-label', 'Image preview unavailable');
                    icon.innerHTML = '<svg class="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                    parent.appendChild(icon);
                  }
                }}
              />
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatFileSize(file.size)}
              </p>
              <p className="text-xs text-muted-foreground">
                {file.type.split('/')[1].toUpperCase()}
              </p>
            </div>

            {/* Remove Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onRemove(index)}
              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove screenshot ${file.name}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
