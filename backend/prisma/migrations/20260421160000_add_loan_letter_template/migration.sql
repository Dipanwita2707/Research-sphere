-- CreateTable: loan_letter_template (singleton configuration for the printed loan letter)
CREATE TABLE "loan_letter_template" (
  "id"               VARCHAR(32)   NOT NULL DEFAULT 'default',
  "university_name"  TEXT          NOT NULL DEFAULT 'SHREE GURU GOBIND SINGH TRICENTENARY UNIVERSITY (SGT UNIVERSITY ®)',
  "university_short" VARCHAR(128)  NOT NULL DEFAULT 'SGT University ®',
  "university_addr"  VARCHAR(256)  NOT NULL DEFAULT 'Gurugram, Haryana',
  "university_legal" VARCHAR(512)  NOT NULL DEFAULT '(Established by State Legislature Act 2013 & Recognized by UGC)',
  "branch_title"     VARCHAR(128)  NOT NULL DEFAULT 'Accounts Branch',
  "ref_prefix"       VARCHAR(128)  NOT NULL DEFAULT 'SGTU/Bank Loan',
  "header_image_url" VARCHAR(1024),
  "footer_notes"     JSONB         NOT NULL DEFAULT '[]',
  "bank_details"     JSONB         NOT NULL DEFAULT '{}',
  "signatory_title"  VARCHAR(128)  NOT NULL DEFAULT 'Authorized Signatory',
  "signatory_dept"   VARCHAR(128)  NOT NULL DEFAULT '(Finance Department)',
  "signatory_org"    VARCHAR(256)  NOT NULL DEFAULT 'SGT University, Gurugram',
  "updated_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_by_id"    UUID,

  CONSTRAINT "loan_letter_template_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loan_letter_template_updated_by_fk"
    FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL
);

-- Seed the singleton row with defaults so GET always returns data
INSERT INTO "loan_letter_template" ("id") VALUES ('default') ON CONFLICT DO NOTHING;
