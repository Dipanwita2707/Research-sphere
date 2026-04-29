-- Manual migration to add thumbnail fields to bug_report_screenshots table
-- This migration adds support for compressed thumbnail images

-- Add thumbnail fields to bug_report_screenshots table
ALTER TABLE bug_report_screenshots 
ADD COLUMN IF NOT EXISTS thumbnail_filename VARCHAR(255),
ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(512);

-- Add comments for documentation
COMMENT ON COLUMN bug_report_screenshots.thumbnail_filename IS 'Filename of the compressed thumbnail image';
COMMENT ON COLUMN bug_report_screenshots.thumbnail_path IS 'Storage path of the thumbnail relative to uploads directory';
