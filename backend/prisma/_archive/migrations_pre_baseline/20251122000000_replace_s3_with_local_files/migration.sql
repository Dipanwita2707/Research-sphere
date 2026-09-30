-- Migration: Replace S3 keys with local file paths in IPR module
-- This migration updates the database schema to use local file paths instead of S3 keys

-- Update IprApplication table
ALTER TABLE ipr_application 
  RENAME COLUMN annexure_s3_key TO annexure_file_path;

ALTER TABLE ipr_application 
  RENAME COLUMN supporting_docs_s3_keys TO supporting_docs_file_paths;

-- Update ResearchPaper table  
ALTER TABLE research_paper 
  RENAME COLUMN manuscript_s3_key TO manuscript_file_path;

ALTER TABLE research_paper 
  RENAME COLUMN supporting_docs_s3_keys TO supporting_docs_file_paths;

-- Update other S3 references to file paths
ALTER TABLE user_login 
  RENAME COLUMN profile_image_s3_key TO profile_image_file_path;

ALTER TABLE employee_details 
  RENAME COLUMN photo_s3_key TO photo_file_path;

ALTER TABLE card 
  RENAME COLUMN latest_image_s3_key TO latest_image_file_path;

ALTER TABLE card 
  RENAME COLUMN photo_s3_key TO photo_file_path;

ALTER TABLE reissue_request 
  RENAME COLUMN proof_s3_key TO proof_file_path;

ALTER TABLE student_details 
  RENAME COLUMN photo_s3_key TO photo_file_path;