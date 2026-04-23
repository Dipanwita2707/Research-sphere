import type { LoanLetter } from '../services/loanLetter.service';
import type { LoanLetterTemplate } from '../services/loanLetterTemplate.service';

// ── Constants ──────────────────────────────────────────────────────────────────

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const YEAR_ORDINALS = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH'];
const YEAR_ORDINALS_SHORT = ['1st', '2nd', '3rd', '4th', '5th'];

function getYearIdx(sem: number) {
  return Math.floor((sem - 1) / 2);
}

function fmt(n: number) {
  return n === 0 ? '—' : n.toLocaleString('en-IN');
}

// ── HTML table generators ──────────────────────────────────────────────────────

const BORDER = 'border: 1px solid #374151; padding: 4px 8px;';
const HEADER_CELL = BORDER + ' background: #e5e7eb; font-weight: 700; text-align: center;';

function generateFeeTableHtml(letter: LoanLetter): string {
  const fb = letter.feeBreakdown;
  if (!fb) return '<p style="color:#6b7280;font-style:italic;">No fee data available.</p>';

  const semesters = fb.selectedSemesters ?? letter.selectedSemesters ?? [];
  const heads = [...(fb.academic ?? []), ...(fb.specialization ?? [])];

  if (heads.length === 0 || semesters.length === 0)
    return '<p style="color:#6b7280;font-style:italic;">No fee data available.</p>';

  const yearMap: Record<number, number[]> = {};
  semesters.forEach(s => {
    const y = getYearIdx(s);
    (yearMap[y] ??= []).push(s);
  });
  const yearGroups = Object.entries(yearMap)
    .sort(([a], [b]) => +a - +b)
    .map(([yIdx, sems]) => ({ yearIdx: +yIdx, sems }));

  const semTotals: Record<number, number> = {};
  semesters.forEach(s => (semTotals[s] = heads.reduce((acc, h) => acc + (h.semesterAmounts?.[s] ?? 0), 0)));
  const grandRow = semesters.reduce((acc, s) => acc + (semTotals[s] ?? 0), 0);

  let html = `<table style="border-collapse:collapse;width:100%;font-size:10px;margin:8px 0;">`;
  html += '<thead>';

  // Header row 1: PARTICULARS | YEAR groups | TOTAL
  html += '<tr>';
  html += `<th rowspan="2" style="${HEADER_CELL}">PARTICULARS</th>`;
  yearGroups.forEach(({ yearIdx, sems }) => {
    html += `<th colspan="${sems.length}" style="${HEADER_CELL}">${YEAR_ORDINALS[yearIdx] ?? `YEAR ${yearIdx + 1}`} YEAR</th>`;
  });
  html += `<th rowspan="2" style="${HEADER_CELL}">TOTAL</th>`;
  html += '</tr>';

  // Header row 2: semester columns
  html += '<tr>';
  semesters.forEach(s => { html += `<th style="${HEADER_CELL}">${ROMAN[s - 1] ?? s}</th>`; });
  html += '</tr>';

  html += '</thead><tbody>';

  heads.forEach((h, i) => {
    const bg = i % 2 === 1 ? 'background:#f9fafb;' : '';
    html += `<tr style="${bg}">`;
    html += `<td style="${BORDER}">${h.headName}</td>`;
    semesters.forEach(s => { html += `<td style="${BORDER} text-align:right;">${fmt(h.semesterAmounts?.[s] ?? 0)}</td>`; });
    html += `<td style="${BORDER} text-align:right;font-weight:600;">${fmt(h.total)}</td>`;
    html += '</tr>';
  });

  // TOTAL row
  html += `<tr style="background:#e5e7eb;font-weight:700;">`;
  html += `<td style="${BORDER} text-align:center;">TOTAL</td>`;
  semesters.forEach(s => { html += `<td style="${BORDER} text-align:right;">${fmt(semTotals[s] ?? 0)}</td>`; });
  html += `<td style="${BORDER} text-align:right;">${fmt(grandRow)}</td>`;
  html += '</tr>';
  html += '</tbody></table>';

  return html;
}

function generateBankTableHtml(template: LoanLetterTemplate): string {
  const b = template.bankDetails ?? {};
  const rows: [string, string, string][] = [
    ['1', 'Name of the Account', b.accountName ?? ''],
    ['2', 'Bank Name', b.bankName ?? ''],
    ['3', 'Branch Name & Address', b.branchName ?? ''],
    ['4', 'Account Number', b.accountNumber ?? ''],
    ['5', 'IFSC Code', b.ifscCode ?? ''],
    ['6', 'MICR Code', b.micrCode ?? ''],
  ];

  let html = `<table style="border-collapse:collapse;width:100%;font-size:10px;margin:8px 0;">`;
  html += `<thead><tr>`;
  html += `<th style="${HEADER_CELL} width:30px;">S.No.</th>`;
  html += `<th style="${HEADER_CELL}">Particulars</th>`;
  html += `<th style="${HEADER_CELL}">Details</th>`;
  html += '</tr></thead><tbody>';
  rows.forEach(([no, label, val]) => {
    html += `<tr><td style="${BORDER}">${no}</td><td style="${BORDER}">${label}</td><td style="${BORDER} color:#6b7280;">${val || '——'}</td></tr>`;
  });
  html += '</tbody></table>';
  return html;
}

function generateFooterNotesHtml(template: LoanLetterTemplate, letter: LoanLetter): string {
  const notes = [...(template.footerNotes ?? [])];
  const fb = letter.feeBreakdown;
  const semesters = fb?.selectedSemesters ?? letter.selectedSemesters ?? [];

  const yearMap: Record<number, number[]> = {};
  semesters.forEach(s => { const y = getYearIdx(s); (yearMap[y] ??= []).push(s); });
  const yearCount = Object.keys(yearMap).length || fb?.selectedYears || 1;

  if (letter.transportIncluded && fb?.transport?.length) {
    const total = fb.transport.reduce((acc, h) => acc + (h.yearlyTotal ?? h.amount * yearCount), 0);
    notes.push(`Transport fee per year: ₹${total.toLocaleString('en-IN')} (${yearCount} year${yearCount > 1 ? 's' : ''})`);
  }
  if (letter.hostelIncluded && fb?.hostel?.length) {
    const total = fb.hostel.reduce((acc, h) => acc + (h.yearlyTotal ?? h.amount * yearCount), 0);
    notes.push(`Hostel fee per year: ₹${total.toLocaleString('en-IN')} (${yearCount} year${yearCount > 1 ? 's' : ''})`);
  }

  return notes.map(n => `<p style="font-size:10px;margin:2px 0;">* ${n}</p>`).join('');
}

// ── Substitution map builders ─────────────────────────────────────────────────

export function buildSubstitutionMap(
  letter: LoanLetter,
  template: LoanLetterTemplate,
): Record<string, string> {
  const issueDate = new Date(letter.issuedAt);
  const issueYear = issueDate.getFullYear();
  const academicYear = `${issueYear}-${issueYear + 1}`;
  const displayDate = issueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const fb = letter.feeBreakdown;
  const semesters = fb?.selectedSemesters ?? letter.selectedSemesters ?? [];

  const yearMap: Record<number, number[]> = {};
  semesters.forEach(s => { const y = getYearIdx(s); (yearMap[y] ??= []).push(s); });
  const yearCount = Object.keys(yearMap).length || fb?.selectedYears || 1;

  const semestersDisplay = semesters.map(s => ROMAN[s - 1] ?? s).join(', ');
  const academicYearsDisplay = Object.keys(yearMap)
    .sort((a, b) => +a - +b)
    .map(y => `${YEAR_ORDINALS_SHORT[+y] ?? `${+y + 1}th`} Year`)
    .join(', ');

  const specializationLine = letter.specialization
    ? ` (${letter.specialization.specializationName})`
    : '';

  const grandTotal = fb?.grandTotal ?? 0;
  const transportTotal = letter.transportIncluded && fb?.transport
    ? fb.transport.reduce((acc, h) => acc + (h.yearlyTotal ?? h.amount * yearCount), 0)
    : 0;
  const hostelTotal = letter.hostelIncluded && fb?.hostel
    ? fb.hostel.reduce((acc, h) => acc + (h.yearlyTotal ?? h.amount * yearCount), 0)
    : 0;

  const b = template.bankDetails ?? {};

  return {
    STUDENT_NAME: letter.studentName ?? '',
    RELATION: `${letter.relationPrefix ?? ''} ${letter.relationName ?? ''}`.trim(),
    APPLICATION_NO: letter.applicationNumber ?? '',
    STUDENT_EMAIL: letter.studentEmail ?? '',
    STUDENT_PHONE: letter.studentPhone ?? '',
    PROGRAM: letter.programName ?? '',
    PROGRAM_CODE: letter.programCode ?? '',
    SPECIALIZATION: letter.specialization?.specializationName ?? '',
    SPECIALIZATION_LINE: specializationLine,
    SEMESTERS: semestersDisplay,
    ACADEMIC_YEAR: academicYear,
    ACADEMIC_YEARS: academicYearsDisplay,
    GRAND_TOTAL: `₹${fmt(grandTotal)}`,
    TRANSPORT_TOTAL: `₹${fmt(transportTotal)}`,
    HOSTEL_TOTAL: `₹${fmt(hostelTotal)}`,
    LETTER_NUMBER: letter.uniqueNumber ?? '',
    DATE: displayDate,
    REF_NO: `${template.refPrefix ?? 'SGTU/Bank Loan'}/${academicYear}`,
    UNIVERSITY_NAME: template.universityName ?? '',
    UNIVERSITY_ADDR: template.universityAddr ?? '',
    UNIVERSITY_LEGAL: template.universityLegal ?? '',
    BRANCH_TITLE: template.branchTitle ?? '',
    BANK_NAME: b.bankName ?? '',
    BANK_ACCOUNT_NAME: b.accountName ?? '',
    BANK_ACCOUNT_NO: b.accountNumber ?? '',
    BANK_IFSC: b.ifscCode ?? '',
    BANK_BRANCH: b.branchName ?? '',
    BANK_MICR: b.micrCode ?? '',
    SIGNATORY_TITLE: template.signatoryTitle ?? '',
    SIGNATORY_DEPT: template.signatoryDept ?? '',
    SIGNATORY_ORG: template.signatoryOrg ?? '',
  };
}

export function buildSampleSubstitutionMap(template: LoanLetterTemplate): Record<string, string> {
  const b = template.bankDetails ?? {};
  return {
    STUDENT_NAME: 'Rajesh Kumar',
    RELATION: 'Son of Ramesh Kumar',
    APPLICATION_NO: 'APP-2025-001234',
    STUDENT_EMAIL: 'rajesh.kumar@example.com',
    STUDENT_PHONE: '+91 98765 43210',
    PROGRAM: 'Bachelor of Technology',
    PROGRAM_CODE: 'BTECH',
    SPECIALIZATION: 'Computer Science & Engineering',
    SPECIALIZATION_LINE: ' (Computer Science & Engineering)',
    SEMESTERS: 'I, II, III, IV',
    ACADEMIC_YEAR: '2025-26',
    ACADEMIC_YEARS: '1st Year, 2nd Year',
    GRAND_TOTAL: '₹5,00,000',
    TRANSPORT_TOTAL: '₹24,000',
    HOSTEL_TOTAL: '₹1,20,000',
    LETTER_NUMBER: 'SGTU/BL/2026/0001',
    DATE: '22 April 2026',
    REF_NO: `${template.refPrefix ?? 'SGTU/Bank Loan'}/2025-26`,
    UNIVERSITY_NAME: template.universityName ?? 'SGT University',
    UNIVERSITY_ADDR: template.universityAddr ?? 'Gurugram, Haryana',
    UNIVERSITY_LEGAL: template.universityLegal ?? '(Established by State Legislature Act 2013 & Recognized by UGC)',
    BRANCH_TITLE: template.branchTitle ?? 'Accounts Branch',
    BANK_NAME: b.bankName || 'State Bank of India',
    BANK_ACCOUNT_NAME: b.accountName || 'SGT University',
    BANK_ACCOUNT_NO: b.accountNumber || '1234567890',
    BANK_IFSC: b.ifscCode || 'SBIN0001234',
    BANK_BRANCH: b.branchName || 'Gurugram Main',
    BANK_MICR: b.micrCode || '110002123',
    SIGNATORY_TITLE: template.signatoryTitle ?? 'Authorized Signatory',
    SIGNATORY_DEPT: template.signatoryDept ?? '(Finance Department)',
    SIGNATORY_ORG: template.signatoryOrg ?? 'SGT University, Gurugram',
  };
}

// ── Private: sample generators for preview mode ───────────────────────────────

function sampleFeeTable(): string {
  const H = HEADER_CELL;
  const C = BORDER;
  return `<table style="border-collapse:collapse;width:100%;font-size:10px;margin:8px 0;">
  <thead>
    <tr>
      <th rowspan="2" style="${H}">PARTICULARS</th>
      <th colspan="2" style="${H}">FIRST YEAR</th>
      <th colspan="2" style="${H}">SECOND YEAR</th>
      <th rowspan="2" style="${H}">TOTAL</th>
    </tr>
    <tr><th style="${H}">I</th><th style="${H}">II</th><th style="${H}">III</th><th style="${H}">IV</th></tr>
  </thead>
  <tbody>
    <tr><td style="${C}">Tuition Fee</td><td style="${C} text-align:right;">45,000</td><td style="${C} text-align:right;">45,000</td><td style="${C} text-align:right;">45,000</td><td style="${C} text-align:right;">45,000</td><td style="${C} text-align:right;font-weight:600;">1,80,000</td></tr>
    <tr style="background:#f9fafb;"><td style="${C}">Development Fee</td><td style="${C} text-align:right;">10,000</td><td style="${C} text-align:right;">10,000</td><td style="${C} text-align:right;">10,000</td><td style="${C} text-align:right;">10,000</td><td style="${C} text-align:right;font-weight:600;">40,000</td></tr>
    <tr style="background:#e5e7eb;font-weight:700;"><td style="${C} text-align:center;">TOTAL</td><td style="${C} text-align:right;">55,000</td><td style="${C} text-align:right;">55,000</td><td style="${C} text-align:right;">55,000</td><td style="${C} text-align:right;">55,000</td><td style="${C} text-align:right;">2,20,000</td></tr>
  </tbody>
</table>`;
}

function sampleFooterNotes(template: LoanLetterTemplate): string {
  const notes = template.footerNotes ?? [];
  if (notes.length === 0) return '';
  return notes.map(n => `<p style="font-size:10px;margin:2px 0;">* ${n}</p>`).join('');
}

// ── Core render function ──────────────────────────────────────────────────────

/**
 * Unwrap block-level placeholders from surrounding <p> tags so tables render
 * as block elements rather than being nested inside a paragraph.
 */
function unwrapBlockPlaceholders(html: string): string {
  return html.replace(
    /<p[^>]*>\s*(\{\{(?:FEE_TABLE|BANK_TABLE|FOOTER_NOTES|PAGE_BREAK|LETTERHEAD|WATERMARK)\}\})\s*<\/p>/g,
    '$1',
  );
}

/**
 * Strip `class="ll-ph*"` visual-editor marker from spans after substitution.
 */
function stripEditorMarkers(html: string): string {
  return html.replace(/(<span)([^>]*)\bclass="ll-ph[^"]*"([^>]*)>/g, '$1$2$3>');
}

/**
 * Render the stored template body HTML with real letter data.
 * Used when generating the actual printed letter.
 */
export function renderTemplateBody(
  templateBody: string,
  letter: LoanLetter,
  template: LoanLetterTemplate,
): string {
  let html = unwrapBlockPlaceholders(templateBody);

  const subs = buildSubstitutionMap(letter, template);
  for (const [key, value] of Object.entries(subs)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }

  html = html.replace(/\{\{FEE_TABLE\}\}/g, generateFeeTableHtml(letter));
  html = html.replace(/\{\{BANK_TABLE\}\}/g, generateBankTableHtml(template));
  html = html.replace(/\{\{FOOTER_NOTES\}\}/g, generateFooterNotesHtml(template, letter));
  html = html.replace(/\{\{PAGE_BREAK\}\}/g, '<div style="break-before:page;page-break-before:always;"></div>');

  // LETTERHEAD — render header image with configured width
  if (template.headerImageUrl) {
    const w = template.headerImageWidth ?? 100;
    html = html.replace(
      /\{\{LETTERHEAD\}\}/g,
      `<div style="text-align:center;margin-bottom:8px;"><img src="${template.headerImageUrl}" alt="Letterhead" style="width:${w}%;max-height:160px;object-fit:contain;" /></div>`,
    );
  } else {
    html = html.replace(/\{\{LETTERHEAD\}\}/g, '');
  }

  // WATERMARK — absolute overlay centred in the document container (position:relative on parent keeps it in-bounds)
  if (template.watermarkImageUrl) {
    const w = template.watermarkWidth ?? 30;
    const op = (template.watermarkOpacity ?? 20) / 100;
    html = html.replace(
      /\{\{WATERMARK\}\}/g,
      `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${w}%;z-index:0;pointer-events:none;"><img src="${template.watermarkImageUrl}" alt="" style="width:100%;opacity:${op};object-fit:contain;" /></div>`,
    );
  } else {
    html = html.replace(/\{\{WATERMARK\}\}/g, '');
  }

  return stripEditorMarkers(html);
}

/**
 * Render the template body in preview mode with sample data.
 * Used in the template editor's preview pane.
 */
export function renderTemplatePreview(
  templateBody: string,
  template: LoanLetterTemplate,
): string {
  let html = unwrapBlockPlaceholders(templateBody);

  const subs = buildSampleSubstitutionMap(template);
  for (const [key, value] of Object.entries(subs)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }

  html = html.replace(/\{\{FEE_TABLE\}\}/g, sampleFeeTable());
  html = html.replace(/\{\{BANK_TABLE\}\}/g, generateBankTableHtml(template));
  html = html.replace(/\{\{FOOTER_NOTES\}\}/g, sampleFooterNotes(template));
  html = html.replace(/\{\{PAGE_BREAK\}\}/g, '<hr style="border-top:2px dashed #9ca3af;margin:16px 0;" />');

  // LETTERHEAD preview
  if (template.headerImageUrl) {
    const w = template.headerImageWidth ?? 100;
    html = html.replace(
      /\{\{LETTERHEAD\}\}/g,
      `<div style="text-align:center;margin-bottom:8px;"><img src="${template.headerImageUrl}" alt="Letterhead" style="width:${w}%;max-height:120px;object-fit:contain;" /></div>`,
    );
  } else {
    html = html.replace(/\{\{LETTERHEAD\}\}/g, '<div style="text-align:center;padding:12px;background:#f3f4f6;border-radius:4px;color:#9ca3af;font-style:italic;font-size:11px;">[Letterhead image — configure in Images tab]</div>');
  }

  // WATERMARK preview — absolute overlay centred within the document container
  if (template.watermarkImageUrl) {
    const w = template.watermarkWidth ?? 30;
    const op = (template.watermarkOpacity ?? 20) / 100;
    html = html.replace(
      /\{\{WATERMARK\}\}/g,
      `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${w}%;z-index:0;pointer-events:none;"><img src="${template.watermarkImageUrl}" alt="" style="width:100%;opacity:${op};object-fit:contain;" /></div>`,
    );
  } else {
    html = html.replace(/\{\{WATERMARK\}\}/g, '<div style="text-align:center;padding:8px;background:#fff7ed;border-radius:4px;color:#d97706;font-style:italic;font-size:11px;">[Watermark image — configure in Images tab]</div>');
  }

  return stripEditorMarkers(html);
}

// ── Default template ──────────────────────────────────────────────────────────

/**
 * Initial HTML body shown when the editor is first used,
 * matching the current hard-coded letter layout.
 */
export const DEFAULT_TEMPLATE_BODY = `<p style="text-align:right;"><strong>Ref No.:</strong> {{REF_NO}} &nbsp;&nbsp;&nbsp;&nbsp; <strong>Date:</strong> {{DATE}}</p>
<p>&nbsp;</p>
<p style="text-align:center;"><strong><u>TO WHOM SO EVER IT MAY CONCERN</u></strong></p>
<p>&nbsp;</p>
<p>This is to certify that <strong>{{STUDENT_NAME}}</strong>, {{RELATION}}, bearing Registration No./IDNO <strong>{{APPLICATION_NO}}</strong> is a bonafide student of <strong>{{PROGRAM}}</strong>{{SPECIALIZATION_LINE}} at <strong>{{UNIVERSITY_NAME}}</strong>, {{UNIVERSITY_ADDR}} {{UNIVERSITY_LEGAL}} and the tentative fee structure for the course is as under:</p>
<p>&nbsp;</p>
{{FEE_TABLE}}
<p>&nbsp;</p>
{{FOOTER_NOTES}}
<p>&nbsp;</p>
{{PAGE_BREAK}}
<p>&nbsp;</p>
<p><strong>Bank Account Details for Fee Remittance:</strong></p>
<p>&nbsp;</p>
{{BANK_TABLE}}
<p>&nbsp;</p>
<p>&nbsp;</p>
<p>&nbsp;</p>
<p style="text-align:right;"><strong>{{SIGNATORY_TITLE}}</strong><br>{{SIGNATORY_DEPT}}<br>{{SIGNATORY_ORG}}</p>`;

// ── Placeholder catalogue ─────────────────────────────────────────────────────

export interface PlaceholderItem {
  key: string;
  label: string;
  description?: string;
  special?: boolean; // block-level placeholders (tables, page breaks)
}

export interface PlaceholderGroup {
  category: string;
  color: string; // Tailwind colour prefix e.g. 'blue'
  items: PlaceholderItem[];
}

export const PLACEHOLDER_GROUPS: PlaceholderGroup[] = [
  {
    category: 'Student',
    color: 'blue',
    items: [
      { key: 'STUDENT_NAME', label: 'Student Full Name' },
      { key: 'RELATION', label: 'Relation (prefix + name)' },
      { key: 'APPLICATION_NO', label: 'Application Number' },
      { key: 'STUDENT_EMAIL', label: 'Student Email' },
      { key: 'STUDENT_PHONE', label: 'Student Phone' },
    ],
  },
  {
    category: 'Program & Academics',
    color: 'purple',
    items: [
      { key: 'PROGRAM', label: 'Program Name' },
      { key: 'PROGRAM_CODE', label: 'Program Code' },
      { key: 'SPECIALIZATION', label: 'Specialization Name' },
      { key: 'SPECIALIZATION_LINE', label: 'Specialization (with brackets)', description: 'e.g.  (Computer Science)' },
      { key: 'SEMESTERS', label: 'Selected Semesters', description: 'e.g. I, II, III, IV' },
      { key: 'ACADEMIC_YEAR', label: 'Academic Year', description: 'e.g. 2025-26' },
      { key: 'ACADEMIC_YEARS', label: 'Academic Years Range', description: 'e.g. 1st Year, 2nd Year' },
    ],
  },
  {
    category: 'Financial',
    color: 'green',
    items: [
      { key: 'FEE_TABLE', label: 'Fee Breakdown Table', description: 'Full fee table with semester columns', special: true },
      { key: 'GRAND_TOTAL', label: 'Grand Total Amount' },
      { key: 'TRANSPORT_TOTAL', label: 'Transport Fee Total' },
      { key: 'HOSTEL_TOTAL', label: 'Hostel Fee Total' },
    ],
  },
  {
    category: 'Letter',
    color: 'orange',
    items: [
      { key: 'LETTER_NUMBER', label: 'Unique Letter Number' },
      { key: 'DATE', label: 'Issue Date' },
      { key: 'REF_NO', label: 'Reference Number' },
    ],
  },
  {
    category: 'Institution',
    color: 'teal',
    items: [
      { key: 'UNIVERSITY_NAME', label: 'University Full Name' },
      { key: 'UNIVERSITY_ADDR', label: 'University Address' },
      { key: 'UNIVERSITY_LEGAL', label: 'Legal Recognition Line' },
      { key: 'BRANCH_TITLE', label: 'Branch / Department Title' },
    ],
  },
  {
    category: 'Bank',
    color: 'emerald',
    items: [
      { key: 'BANK_TABLE', label: 'Bank Details Table', description: 'Full bank account table', special: true },
      { key: 'BANK_NAME', label: 'Bank Name' },
      { key: 'BANK_ACCOUNT_NAME', label: 'Account Holder Name' },
      { key: 'BANK_ACCOUNT_NO', label: 'Account Number' },
      { key: 'BANK_IFSC', label: 'IFSC Code' },
      { key: 'BANK_BRANCH', label: 'Bank Branch' },
      { key: 'BANK_MICR', label: 'MICR Code' },
    ],
  },
  {
    category: 'Signatory',
    color: 'indigo',
    items: [
      { key: 'SIGNATORY_TITLE', label: 'Signatory Title' },
      { key: 'SIGNATORY_DEPT', label: 'Signatory Department' },
      { key: 'SIGNATORY_ORG', label: 'Signatory Organization' },
    ],
  },
  {
    category: 'Layout',
    color: 'slate',
    items: [
      { key: 'LETTERHEAD', label: 'Header / Letterhead Image', description: 'Renders the uploaded header image at this position', special: true },
      { key: 'WATERMARK', label: 'Watermark Image', description: 'Renders the watermark image inline at this position', special: true },
      { key: 'FOOTER_NOTES', label: 'Footer Notes', description: 'All configured footer note lines', special: true },
      { key: 'PAGE_BREAK', label: 'Page Break', description: 'Inserts a print page break', special: true },
    ],
  },
];
