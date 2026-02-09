-- AlterTable: Add policy_compliant (Yes/No) to note
ALTER TABLE "note" ADD COLUMN "policy_compliant" BOOLEAN;

-- AlterTable: Add file_description (annexure purpose) to note_attachment
ALTER TABLE "note_attachment" ADD COLUMN "file_description" TEXT;
