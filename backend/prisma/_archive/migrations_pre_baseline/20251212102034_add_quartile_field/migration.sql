-- CreateEnum for Quartile
CREATE TYPE "quartile_enum" AS ENUM ('q1', 'q2', 'q3', 'q4', 'na');

-- AlterTable: Add quartile field to research_contribution
ALTER TABLE "research_contribution" ADD COLUMN "quartile" "quartile_enum";
