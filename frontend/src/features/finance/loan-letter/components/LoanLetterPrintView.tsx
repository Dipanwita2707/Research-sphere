'use client';

import { useRef, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { loanLetterService, LoanLetter } from '../services/loanLetter.service';
import { LoanLetterTemplate, TEMPLATE_DEFAULTS } from '../services/loanLetterTemplate.service';
import { renderTemplateBody } from '../utils/templateRenderer';
import { getFileUrl } from '@/shared/api/api';

interface Props {
  letter: LoanLetter;
  onClose: () => void;
  recordReprint?: boolean;
  onReprintRecorded?: (letter: LoanLetter) => void;
  showPrintButton?: boolean;
  showCloseButton?: boolean;
  /** Optional saved template — falls back to hardcoded defaults when omitted */
  template?: LoanLetterTemplate;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const YEAR_ORDINALS = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH'];

function getYearIdx(sem: number) {
  return Math.floor((sem - 1) / 2);
}

function formatCurrency(n: number) {
  return n === 0 ? 'u2014' : n.toLocaleString('en-IN');
}

export default function LoanLetterPrintView({
  letter,
  onClose,
  recordReprint = false,
  onReprintRecorded,
  showPrintButton = true,
  showCloseButton = true,
  template,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [recordingReprint, setRecordingReprint] = useState(false);

  // Resolved template — always falls back to embed defaults
  const tmpl: LoanLetterTemplate = { ...TEMPLATE_DEFAULTS, ...template };

  const handlePrint = async () => {
    if (recordReprint) {
      setRecordingReprint(true);
      try {
        const res = await loanLetterService.recordReprint(letter.id);
        onReprintRecorded?.(res.data);
      } catch {}
      finally {
        setRecordingReprint(false);
      }
    }

    window.print();
  };

  const feeBreakdown = letter.feeBreakdown;
  const selectedSemesters: number[] = feeBreakdown?.selectedSemesters ?? letter.selectedSemesters ?? [];

  const tableHeads = [
    ...(feeBreakdown?.academic ?? []),
    ...(feeBreakdown?.specialization ?? []),
  ];

  const yearMap: Record<number, number[]> = {};
  selectedSemesters.forEach(sem => {
    const y = getYearIdx(sem);
    if (!yearMap[y]) yearMap[y] = [];
    yearMap[y].push(sem);
  });
  const yearGroups = Object.entries(yearMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([yIdx, sems]) => ({ yearIdx: Number(yIdx), sems }));
  const selectedYearCount = yearGroups.length || feeBreakdown?.selectedYears || 1;
  const selectedAccommodationMonths =
    feeBreakdown?.selectedAccommodationMonths
    || yearGroups.reduce((sum, group) => sum + (group.sems.length >= 2 ? 11 : 6), 0)
    || (selectedYearCount * 11);

  const semTotals: Record<number, number> = {};
  selectedSemesters.forEach(sem => {
    semTotals[sem] = tableHeads.reduce((s, h) => s + (h.semesterAmounts?.[sem] ?? 0), 0);
  });
  const tableTotal = selectedSemesters.reduce((s, sem) => s + (semTotals[sem] ?? 0), 0);

  const issueDate = new Date(letter.issuedAt);
  const issueYear = issueDate.getFullYear();
  const academicYear = `${issueYear}-${issueYear + 1}`;
  const displayDate = issueDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const pb = letter.printedBy;
  const pbName = pb?.employeeDetails?.displayName
    || (pb?.employeeDetails ? `${pb.employeeDetails.firstName} ${pb.employeeDetails.lastName ?? ''}`.trim() : pb?.uid ?? 'Finance Dept.');

  const contactBits = [letter.studentEmail, letter.studentPhone].filter(Boolean);

  const programmeDesc = letter.specialization
    ? `${letter.programName} (${letter.programCode}) u2014 ${letter.specialization.specializationName}`
    : `${letter.programName} (${letter.programCode})`;

  // ── Template-body render mode (HTML template with substituted placeholders) ──
  if (tmpl.templateBody) {
    // Resolve image URLs to absolute (backend host) before passing to renderer
    const resolvedTmpl = {
      ...tmpl,
      headerImageUrl: tmpl.headerImageUrl ? getFileUrl(tmpl.headerImageUrl) : null,
      watermarkImageUrl: tmpl.watermarkImageUrl ? getFileUrl(tmpl.watermarkImageUrl) : null,
    };
    const renderedBody = renderTemplateBody(tmpl.templateBody, letter, resolvedTmpl);
    // Only auto-show header at top if {{LETTERHEAD}} is NOT already placed in the body
    const letterheadInBody = tmpl.templateBody.includes('{{LETTERHEAD}}');
    // Only use overlay watermark if {{WATERMARK}} is NOT already placed in the body
    const watermarkInBody = tmpl.templateBody.includes('{{WATERMARK}}');
    return (
      <>
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 0; }
            body * { visibility: hidden !important; }
            #loan-letter-print, #loan-letter-print * { visibility: visible !important; }
            #loan-letter-print {
              position: fixed !important;
              inset: 0 !important;
              width: 210mm !important;
              height: 297mm !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 1.5cm !important;
              border: none !important;
              border-radius: 0 !important;
              background: white !important;
              box-shadow: none !important;
            }
            .ll-ph, .ll-ph-special { all: unset; }
            .no-print { display: none !important; }
          }
          @media print {
            #loan-letter-print [data-watermark] {
              position: fixed !important;
              z-index: 0 !important;
            }
          }
        `}</style>
        <div className="no-print flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Loan Letter Preview</h3>
          <div className="flex items-center gap-2">
            {showPrintButton && (
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
                <Printer className="w-4 h-4" /> {recordingReprint ? 'Recording...' : 'Print'}
              </button>
            )}
            {showCloseButton && (
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            )}
          </div>
        </div>
        <div id="loan-letter-print" ref={printRef} className="bg-white border border-gray-200 rounded-lg shadow-lg max-w-[210mm] mx-auto">
          {/* Watermark overlay — only when {{WATERMARK}} not placed inline in body */}
          {resolvedTmpl.watermarkImageUrl && !watermarkInBody && (
            <div data-watermark style={{
              position: 'absolute',
              top: `${resolvedTmpl.watermarkY ?? 50}%`,
              left: `${resolvedTmpl.watermarkX ?? 50}%`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvedTmpl.watermarkImageUrl}
                alt=""
                style={{
                  width: `${resolvedTmpl.watermarkWidth ?? 30}%`,
                  opacity: (resolvedTmpl.watermarkOpacity ?? 20) / 100,
                  objectFit: 'contain',
                }}
              />
            </div>
          )}
          <div className="p-8" style={{ position: 'relative', zIndex: 1, minHeight: '297mm' }}>
            {/* Auto-show header only if {{LETTERHEAD}} is NOT used in the template body */}
            {resolvedTmpl.headerImageUrl && !letterheadInBody && (
              <div className="mb-4" style={{ position: 'relative', height: 180, overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolvedTmpl.headerImageUrl} alt="Letterhead"
                  style={{
                    position: 'absolute',
                    left: `${resolvedTmpl.headerImageX ?? 50}%`,
                    top: `${resolvedTmpl.headerImageY ?? 50}%`,
                    transform: 'translate(-50%, -50%)',
                    width: `${resolvedTmpl.headerImageWidth ?? 100}%`,
                    maxHeight: 160,
                    objectFit: 'contain',
                  }} />
              </div>
            )}
            {/* Rendered template body — placeholders already substituted */}
            <div
              style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 14, lineHeight: 1.7, whiteSpace: 'break-spaces', tabSize: 8 }}
              dangerouslySetInnerHTML={{ __html: renderedBody }}
            />
            <div className="flex justify-between text-[9px] text-gray-500 border-t border-gray-300 pt-2 mt-4 no-print">
              <span>Print Date: {displayDate}</span>
              <span>Printed by: {pbName}{pb?.uid ? ` (${pb.uid})` : ''}</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body * { visibility: hidden !important; }
          #loan-letter-print, #loan-letter-print * { visibility: visible !important; }
          #loan-letter-print { 
            position: absolute; 
            top: 0; 
            left: 0; 
            width: 210mm; 
            height: 297mm;
            padding: 1.5cm;
            margin: 0;
          }
          .loan-letter-page-break { break-before: page; page-break-before: always; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Loan Letter Preview</h3>
        <div className="flex items-center gap-2">
          {showPrintButton && (
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
              <Printer className="w-4 h-4" /> {recordingReprint ? 'Recording...' : 'Print'}
            </button>
          )}
          {showCloseButton && (
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div id="loan-letter-print" ref={printRef} className="bg-white border border-gray-200 rounded-lg shadow-lg max-w-[210mm] mx-auto">
        <div className="p-8" style={{ minHeight: '297mm' }}>
          {/* Header — use uploaded letterhead image if available, otherwise text header */}
          {tmpl.headerImageUrl ? (
            <div className="text-center mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getFileUrl(tmpl.headerImageUrl)} alt="Letterhead" className="mx-auto max-h-24 object-contain" />
            </div>
          ) : (
            <div className="text-center mb-1">
              <p className="text-[10px] font-bold tracking-widest text-gray-700 uppercase">{tmpl.universityShort}</p>
              <h1 className="text-sm font-extrabold uppercase leading-tight">{tmpl.universityName}</h1>
              <p className="text-xs text-gray-700 mt-0.5">{tmpl.universityAddr}</p>
              <p className="text-[10px] text-gray-600">{tmpl.universityLegal}</p>
              <div className="border-t-2 border-b border-gray-800 mt-2 mb-1 py-0.5">
                <p className="text-xs font-bold tracking-widest uppercase">{tmpl.branchTitle}</p>
              </div>
            </div>
          )}
          <div className="text-center my-3">
            <p className="font-bold text-sm uppercase tracking-widest underline">TO WHOM SO EVER IT MAY CONCERN</p>
          </div>
          <div className="flex justify-between text-xs mb-3">
            <div><span className="font-semibold">Ref No.:</span> {tmpl.refPrefix}/{academicYear}</div>
            <div><span className="font-semibold">Date:</span> {displayDate}</div>
          </div>
          <p className="text-[11px] leading-relaxed mb-3">
            This is to certify that <strong>{letter.studentName}</strong> {letter.relationPrefix}{' '}
            <strong>{letter.relationName}</strong> Registration No./IDNO{' '}
            <strong>{letter.applicationNumber}</strong> is a bonafide student of{' '}
            <strong>{programmeDesc}</strong> at {tmpl.universityName},{' '}
            {tmpl.universityAddr} {tmpl.universityLegal} and the tentative fee structure for the course is as under:
          </p>
          {contactBits.length > 0 && (
            <div className="text-[10px] text-gray-600 mb-3">
              Contact: {contactBits.join(' · ')}
            </div>
          )}
          {tableHeads.length > 0 && selectedSemesters.length > 0 ? (
            <div className="mb-3 overflow-x-auto">
              <table className="w-full text-[10px] border-collapse border border-gray-700">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-700 px-2 py-1 text-center font-bold" rowSpan={2}>PARTICULARS</th>
                    {yearGroups.map(({ yearIdx, sems }) => (
                      <th key={yearIdx} colSpan={sems.length} className="border border-gray-700 px-2 py-1 text-center font-bold uppercase">
                        {YEAR_ORDINALS[yearIdx] ?? `YEAR ${yearIdx + 1}`} YEAR
                      </th>
                    ))}
                    <th className="border border-gray-700 px-2 py-1 text-center font-bold" rowSpan={2}>TOTAL</th>
                  </tr>
                  <tr className="bg-gray-100">
                    {selectedSemesters.map(sem => (
                      <th key={sem} className="border border-gray-700 px-2 py-1 text-center font-bold">
                        {ROMAN[sem - 1] ?? sem}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableHeads.map((h, i) => (
                    <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                      <td className="border border-gray-700 px-2 py-1">{h.headName}</td>
                      {selectedSemesters.map(sem => (
                        <td key={sem} className="border border-gray-700 px-2 py-1 text-right">
                          {formatCurrency(h.semesterAmounts?.[sem] ?? 0)}
                        </td>
                      ))}
                      <td className="border border-gray-700 px-2 py-1 text-right font-semibold">{formatCurrency(h.total)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-200 font-bold">
                    <td className="border border-gray-700 px-2 py-1 text-center">TOTAL</td>
                    {selectedSemesters.map(sem => (
                      <td key={sem} className="border border-gray-700 px-2 py-1 text-right">{formatCurrency(semTotals[sem] ?? 0)}</td>
                    ))}
                    <td className="border border-gray-700 px-2 py-1 text-right">{formatCurrency(tableTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic mb-3">No fee data available for this letter.</p>
          )}
          <div className="text-[10px] leading-relaxed space-y-1 mb-4">
            {tmpl.footerNotes.map((n, i) => <p key={i}>* {n}</p>)}
            {letter.transportIncluded && feeBreakdown && feeBreakdown.transport.length > 0 && (
              <p>* Transport fee for selected duration: ₹{feeBreakdown.transport.reduce((s, h) => s + (h.yearlyTotal ?? (h.amount * selectedAccommodationMonths)), 0).toLocaleString('en-IN')} ({selectedAccommodationMonths} month{selectedAccommodationMonths > 1 ? 's' : ''})</p>
            )}
            {letter.hostelIncluded && feeBreakdown && feeBreakdown.hostel.length > 0 && (
              <p>* Hostel fee for selected duration: ₹{feeBreakdown.hostel.reduce((s, h) => s + (h.yearlyTotal ?? (h.amount * selectedAccommodationMonths)), 0).toLocaleString('en-IN')} ({selectedAccommodationMonths} month{selectedAccommodationMonths > 1 ? 's' : ''})</p>
            )}
            {(letter.transportIncluded || letter.hostelIncluded) && (
              <p>* Billing basis: configured amount is monthly. Per academic year block, one selected semester is billed for 6 months; both semesters selected are billed for 11 months.</p>
            )}
          </div>
          <div className="no-print h-12 border border-dashed border-gray-300 rounded mb-4 flex items-center justify-center text-[10px] text-gray-400">
            [For official use / stamp]
          </div>
          <div className="flex justify-between text-[9px] text-gray-500 border-t border-gray-300 pt-2 mt-4">
            <span>Print Date: {displayDate}</span>
            <span>Printed by: {pbName}{pb?.uid ? ` (${pb.uid})` : ''}</span>
          </div>
        </div>

        <div className="loan-letter-page-break p-8 border-t-4 border-double border-gray-300">
          <div className="text-center mb-4">
            <p className="text-xs font-bold uppercase">{tmpl.universityShort} — {tmpl.branchTitle}</p>
            <p className="text-[10px] text-gray-600">Ref No.: {tmpl.refPrefix}/{academicYear} &nbsp;|&nbsp; Date: {displayDate}</p>
          </div>
          <p className="text-[11px] font-semibold mb-2">Bank Account Details for Fee Remittance:</p>
          <table className="w-full text-[10px] border-collapse border border-gray-700 mb-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-700 px-3 py-1 text-left w-10">S.No.</th>
                <th className="border border-gray-700 px-3 py-1 text-left">Particulars</th>
                <th className="border border-gray-700 px-3 py-1 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {([
                ['1', 'Name of the Account', tmpl.bankDetails.accountName],
                ['2', 'Bank Name', tmpl.bankDetails.bankName],
                ['3', 'Branch Name & Address', tmpl.bankDetails.branchName],
                ['4', 'Account Number', tmpl.bankDetails.accountNumber],
                ['5', 'IFSC Code', tmpl.bankDetails.ifscCode],
                ['6', 'MICR Code', tmpl.bankDetails.micrCode],
              ] as [string, string, string][]).map(([no, label, val]) => (
                <tr key={no}>
                  <td className="border border-gray-700 px-3 py-1">{no}</td>
                  <td className="border border-gray-700 px-3 py-1">{label}</td>
                  <td className="border border-gray-700 px-3 py-1 text-gray-600">{val || <span className="text-gray-300">——</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-16 flex justify-between items-end text-[11px]">
            <div><p>Dated: ____________________</p></div>
            <div className="text-center">
              <div className="border-t border-gray-500 pt-2 w-52">
                <p className="font-semibold">{tmpl.signatoryTitle}</p>
                <p className="text-gray-600 text-[10px]">{tmpl.signatoryDept}</p>
                <p className="text-gray-600 text-[10px]">{tmpl.signatoryOrg}</p>
              </div>
            </div>
          </div>
          <div className="flex justify-between text-[9px] text-gray-500 border-t border-gray-300 mt-8 pt-2">
            <span>Print Date: {displayDate}</span>
            <span>Printed by: {pbName}{pb?.uid ? ` (${pb.uid})` : ''}</span>
          </div>
        </div>
      </div>
    </>
  );
}
