'use client';

import { useEffect, useState } from 'react';
import { Search, Eye, Printer, ChevronDown, ChevronUp, Mail, X, FileText } from 'lucide-react';
import { useLoanLetter } from '../hooks/useLoanLetter';
import { useLoanLetterTemplate } from '../hooks/useLoanLetterTemplate';
import LoanLetterPrintView from './LoanLetterPrintView';
import { LoanLetter, loanLetterService } from '../services/loanLetter.service';

function resolvePrintedByName(letter: LoanLetter) {
  return letter.printedBy?.employeeDetails?.displayName
    || (letter.printedBy?.employeeDetails
      ? `${letter.printedBy.employeeDetails.firstName} ${letter.printedBy.employeeDetails.lastName || ''}`.trim()
      : letter.printedBy?.uid || 'N/A');
}

export default function LoanLetterList() {
  const { list, total, loading, fetchList } = useLoanLetter();
  const { template } = useLoanLetterTemplate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [viewLetter, setViewLetter] = useState<LoanLetter | null>(null);
  const [viewLetterLoading, setViewLetterLoading] = useState(false);
  const [expandedLetterId, setExpandedLetterId] = useState<string | null>(null);
  const limit = 15;

  useEffect(() => {
    fetchList({ page, limit, search: search || undefined, ownOnly: true });
  }, [page, fetchList]);

  const handleSearch = () => {
    setPage(1);
    fetchList({ page: 1, limit, search: search || undefined, ownOnly: true });
  };

  const handleView = async (id: string) => {
    setViewLetterLoading(true);
    try {
      const res = await loanLetterService.getById(id);
      setViewLetter(res.data);
    } catch {}
    finally {
      setViewLetterLoading(false);
    }
  };

  const refreshHistory = () => fetchList({ page, limit, search: search || undefined, ownOnly: true });

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Loan Letter History</h3>
          <p className="text-sm text-gray-500 mt-1">Only your own generated letters and reprints are shown here.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <div className="relative w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search by application, student, email, or letter no..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm sm:w-72"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <button onClick={handleSearch} className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200">
            Search
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No loan letters found.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
                  <th className="px-4 py-3 font-medium">Letter No.</th>
                  <th className="px-4 py-3 font-medium">Student Name</th>
                  <th className="px-4 py-3 font-medium">Application No.</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Programme</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-center">Reprints</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map(letter => {
                  const isExpanded = expandedLetterId === letter.id;
                  const printedByName = resolvePrintedByName(letter);

                  return (
                    <>
                      <tr key={letter.id} className="hover:bg-gray-50 align-top">
                        <td className="px-4 py-3 font-mono text-xs font-medium">
                          <button onClick={() => handleView(letter.id)} className="text-primary-600 hover:underline">
                            {letter.uniqueNumber}
                          </button>
                        </td>
                        <td className="px-4 py-3">{letter.studentName}</td>
                        <td className="px-4 py-3 font-mono text-xs">{letter.applicationNumber}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{letter.studentEmail || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{letter.studentPhone || '—'}</td>
                        <td className="px-4 py-3">{letter.programCode}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(letter.issuedAt).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                            {letter.reprintCount || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setExpandedLetterId(isExpanded ? null : letter.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Details
                            </button>
                            <button
                              onClick={() => handleView(letter.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded"
                            >
                              <Printer className="w-3.5 h-3.5" /> Re-print
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/70">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                              <div className="rounded-xl border border-gray-200 bg-white p-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Application Details</h4>
                                <div className="space-y-2 text-sm text-gray-600">
                                  <div><span className="font-medium text-gray-800">Application No.:</span> <span className="font-mono">{letter.applicationNumber}</span></div>
                                  <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-400" /><span>{letter.studentEmail || 'No email recorded'}</span></div>
                                  <div><span className="font-medium text-gray-800">Phone:</span> {letter.studentPhone || 'No phone recorded'}</div>
                                  <div><span className="font-medium text-gray-800">Relation:</span> {letter.relationPrefix} {letter.relationName}</div>
                                  <div><span className="font-medium text-gray-800">Programme:</span> {letter.programName} ({letter.programCode})</div>
                                  <div><span className="font-medium text-gray-800">Semesters:</span> {letter.selectedSemesters.join(', ')}</div>
                                  <div><span className="font-medium text-gray-800">Printed By:</span> {printedByName}{letter.printedBy?.uid ? ` (${letter.printedBy.uid})` : ''}</div>
                                </div>
                                <div className="mt-4 flex items-center gap-2">
                                  <button
                                    onClick={() => handleView(letter.id)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> Open Preview
                                  </button>
                                  <button
                                    onClick={() => handleView(letter.id)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-primary-200 px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-50"
                                  >
                                    <Printer className="w-3.5 h-3.5" /> Re-print
                                  </button>
                                </div>
                              </div>

                              <div className="rounded-xl border border-gray-200 bg-white p-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Reprint History</h4>
                                {letter.reprints && letter.reprints.length > 0 ? (
                                  <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                                    {letter.reprints.map(reprint => (
                                      <div key={reprint.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                                        <div className="font-medium text-gray-800">{reprint.printedBy.name} ({reprint.printedBy.uid})</div>
                                        <div className="text-xs text-gray-500 mt-1">{new Date(reprint.printedAt).toLocaleString('en-IN')}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400">No reprints recorded yet.</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-gray-600">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {(viewLetter || viewLetterLoading) && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setViewLetter(null)} />
          <div className="fixed top-0 right-0 z-50 flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-indigo-600" />
                <div>
                  <p className="text-sm font-bold text-gray-900">{viewLetter ? viewLetter.uniqueNumber : 'Loading...'}</p>
                  {viewLetter && <p className="text-xs text-gray-500 font-mono">App: {viewLetter.applicationNumber}</p>}
                </div>
              </div>
              <button onClick={() => setViewLetter(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {viewLetterLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
              </div>
            ) : viewLetter ? (
              <div className="flex-1 overflow-y-auto">
                <LoanLetterPrintView
                  letter={viewLetter}
                  template={template}
                  onClose={() => setViewLetter(null)}
                  recordReprint
                  onReprintRecorded={refreshHistory}
                />
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
