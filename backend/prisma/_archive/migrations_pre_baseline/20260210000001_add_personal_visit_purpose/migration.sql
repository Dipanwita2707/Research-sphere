-- Add 'personal' to visit_purpose_enum
ALTER TYPE "visit_purpose_enum" ADD VALUE IF NOT EXISTS 'personal';
