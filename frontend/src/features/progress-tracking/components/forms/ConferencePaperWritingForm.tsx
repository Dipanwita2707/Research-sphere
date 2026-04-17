'use client';

import AuthorManager from '../AuthorManager';

const SDG_GOALS = [
  { value: '1', label: 'No Poverty' },
  { value: '2', label: 'Zero Hunger' },
  { value: '3', label: 'Good Health and Well-being' },
  { value: '4', label: 'Quality Education' },
  { value: '5', label: 'Gender Equality' },
  { value: '6', label: 'Clean Water and Sanitation' },
  { value: '7', label: 'Affordable and Clean Energy' },
  { value: '8', label: 'Decent Work and Economic Growth' },
  { value: '9', label: 'Industry, Innovation and Infrastructure' },
  { value: '10', label: 'Reduced Inequalities' },
  { value: '11', label: 'Sustainable Cities and Communities' },
  { value: '12', label: 'Responsible Consumption and Production' },
  { value: '13', label: 'Climate Action' },
  { value: '14', label: 'Life Below Water' },
  { value: '15', label: 'Life on Land' },
  { value: '16', label: 'Peace, Justice and Strong Institutions' },
  { value: '17', label: 'Partnerships for the Goals' }
];

interface ConferencePaperWritingFormProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export default function ConferencePaperWritingForm({ data, onChange }: ConferencePaperWritingFormProps) {
  const handleChange = (field: string, value: unknown) => {
    onChange({ ...data, [field]: value });
  };

  const sdgGoals = (data.sdgGoals as string[]) || [];

  const toggleSDG = (value: string) => {
    const updated = sdgGoals.includes(value)
      ? sdgGoals.filter(v => v !== value)
      : [...sdgGoals, value];
    handleChange('sdgGoals', updated);
  };

  return (
    <div className="space-y-6">
      {/* Conference Type Selection */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Conference Type</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Please Select Conference Type <span className="text-red-500">*</span>
          </label>
          <select
            value={(data.conferenceSubType as string) || ''}
            onChange={(e) => handleChange('conferenceSubType', e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
          >
            <option value="">-- Please Select --</option>
            <option value="paper_not_indexed">Papers in Conferences (not Indexed) / Seminars / Workshops</option>
            <option value="paper_indexed_scopus">Paper in conference proceeding indexed in Scopus</option>
            <option value="keynote_speaker_invited_talks">Keynote Speaker / Session chair / Invited Talks (Outside SGT)</option>
            <option value="organizer_coordinator_member">Organizer / Coordinator / Member of conference held at SGT</option>
          </select>
        </div>
      </div>

      {/* Paper Presentation Fields (Type 1 & 2) */}
      {((data.conferenceSubType as string) ===
   'paper_not_indexed' || 
        (data.conferenceSubType as string) ===
   'paper_indexed_scopus') && (
        <>
          {/* Conference Details */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Conference Details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name of Conference <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={(data.conferenceName as string) || ''}
                    onChange={(e) => handleChange('conferenceName', e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    placeholder="Enter conference name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title of the Proceedings of Conference</label>
                  <input
                    type="text"
                    value={(data.proceedingsTitle as string) || ''}
                    onChange={(e) => handleChange('proceedingsTitle', e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    placeholder="Enter proceedings title"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority Areas of Funding</label>
                  <input
                    type="text"
                    value={(data.priorityFundingArea as string) || ''}
                    onChange={(e) => handleChange('priorityFundingArea', e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    placeholder="Enter priority funding area"
                  />
                </div>
                {data.conferenceSubType ===
   'paper_indexed_scopus' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Please Mention the Proceedings Quartile <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={(data.proceedingsQuartile as string) || ''}
                      onChange={(e) => handleChange('proceedingsQuartile', e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    >
                      <option value="na">NA</option>
                      <option value="q1">Q1</option>
                      <option value="q2">Q2</option>
                      <option value="q3">Q3</option>
                      <option value="q4">Q4</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Presenters & Conference Details */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Presentation Details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total No. of Presenter's</label>
                  <input
                    type="number"
                    value={(data.totalPresenters as number) || ''}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (value > 2) return;
                      if (value ===
   1) {
                        onChange({ ...data, totalPresenters: value, isPresenter: 'yes' });
                      } else {
                        handleChange('totalPresenters', value);
                      }
                    }}
                    min="1"
                    max="2"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum 2 presenters allowed</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Whether you are a Presenter?</label>
                  <div className="flex gap-4 mt-2">
                    {['yes', 'no'].map(v => (
                      <label key={v} className={`inline-flex items-center ${(data.totalPresenters as number) ===
   1 ? 'opacity-60 cursor-not-allowed' : ''}`}>
                        <input
                          type="radio"
                          value={v}
                          checked={(data.isPresenter as string) ===
   v}
                          onChange={(e) => handleChange('isPresenter', e.target.value)}
                          disabled={(data.totalPresenters as number) ===
   1}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="ml-2 text-sm capitalize">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Virtual Conference?</label>
                  <div className="flex gap-4 mt-2">
                    {['yes', 'no'].map(v => (
                      <label key={v} className="inline-flex items-center">
                        <input
                          type="radio"
                          value={v}
                          checked={(data.virtualConference as string) ===
   v}
                          onChange={(e) => handleChange('virtualConference', e.target.value)}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="ml-2 text-sm capitalize">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Paper</label>
                  <div className="flex gap-4 mt-2">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="yes"
                        checked={(data.fullPaper as string) ===
   'yes'}
                        onChange={(e) => handleChange('fullPaper', e.target.value)}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="ml-2 text-sm">Full Paper</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    National / International <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4 mt-2">
                    {['national', 'international'].map(v => (
                      <label key={v} className="inline-flex items-center">
                        <input
                          type="radio"
                          value={v}
                          checked={(data.conferenceType as string) ===
   v}
                          onChange={(e) => handleChange('conferenceType', e.target.value)}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="ml-2 text-sm capitalize">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Whether conference held at SGT?</label>
                  <div className="flex gap-4 mt-2">
                    {['yes', 'no'].map(v => (
                      <label key={v} className="inline-flex items-center">
                        <input
                          type="radio"
                          value={v}
                          checked={(data.conferenceHeldAtSgt as string) ===
   v}
                          onChange={(e) => handleChange('conferenceHeldAtSgt', e.target.value)}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="ml-2 text-sm capitalize">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conference best paper Award?</label>
                  <div className="flex gap-4 mt-2">
                    {['yes', 'no'].map(v => (
                      <label key={v} className="inline-flex items-center">
                        <input
                          type="radio"
                          value={v}
                          checked={(data.conferenceBestPaperAward as string) ===
   v}
                          onChange={(e) => handleChange('conferenceBestPaperAward', e.target.value)}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="ml-2 text-sm capitalize">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Collaboration Fields */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Collaboration Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interdisciplinary (from SGT)?</label>
                <div className="flex gap-4 mt-2">
                  {['yes', 'no'].map(v => (
                    <label key={v} className="inline-flex items-center">
                      <input
                        type="radio"
                        value={v}
                        checked={(data.isInterdisciplinary as string) ===
   v}
                        onChange={(e) => handleChange('isInterdisciplinary', e.target.value)}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="ml-2 text-sm capitalize">{v}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student(s) (from SGT)?</label>
                <div className="flex gap-4 mt-2">
                  {['yes', 'no'].map(v => (
                    <label key={v} className="inline-flex items-center">
                      <input
                        type="radio"
                        value={v}
                        checked={(data.hasLpuStudents as string) ===
   v}
                        onChange={(e) => handleChange('hasLpuStudents', e.target.value)}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="ml-2 text-sm capitalize">{v}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry?</label>
                <div className="flex gap-4 mt-2">
                  {['yes', 'no'].map(v => (
                    <label key={v} className="inline-flex items-center">
                      <input
                        type="radio"
                        value={v}
                        checked={(data.industryCollaboration as string) ===
   v}
                        onChange={(e) => handleChange('industryCollaboration', e.target.value)}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="ml-2 text-sm capitalize">{v}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Communication & Facility */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Communication Details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Have you communicated the publication with official ID? <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4 mt-2">
                    {['yes', 'no'].map(v => (
                      <label key={v} className="inline-flex items-center">
                        <input
                          type="radio"
                          value={v}
                          checked={(data.communicatedWithOfficialId as string) ===
   v}
                          onChange={(e) => handleChange('communicatedWithOfficialId', e.target.value)}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="ml-2 text-sm capitalize">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Have you used the facility of Central Instrumentation Facility of SGT?
                  </label>
                  <div className="flex gap-4 mt-2">
                    {['yes', 'no'].map(v => (
                      <label key={v} className="inline-flex items-center">
                        <input
                          type="radio"
                          value={v}
                          checked={(data.centralFacilityUsed as string) ===
   v}
                          onChange={(e) => handleChange('centralFacilityUsed', e.target.value)}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="ml-2 text-sm capitalize">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {data.communicatedWithOfficialId ===
   'no' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Personal Email ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={(data.personalEmail as string) || ''}
                    onChange={(e) => handleChange('personalEmail', e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    placeholder="Enter your personal email address"
                  />
                  <p className="text-xs text-orange-600 mt-1">Since you haven't communicated with official ID, please provide your personal email.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* SDG Goals */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Sustainable Development Goals (SDG)
        </label>
        <details className="group">
          <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 list-none flex items-center gap-2">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            Click to select relevant SDGs ({sdgGoals.length} selected)
          </summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 bg-white rounded border border-gray-200">
            {SDG_GOALS.map(sdg => (
              <label key={sdg.value} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={sdgGoals.includes(sdg.value)}
                  onChange={() => toggleSDG(sdg.value)}
                  className="mt-0.5 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-medium">{sdg.value}.</span> {sdg.label}
                </span>
              </label>
            ))}
          </div>
        </details>
        {sdgGoals.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {sdgGoals.map(goal => {
              const sdg = SDG_GOALS.find(s => s.value ===
   goal);
              return sdg ? (
                <span key={goal} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                  {sdg.value}. {sdg.label}
                  <button
                    type="button"
                    onClick={() => toggleSDG(goal)}
                    className="hover:text-purple-900"
                  >
                    ×
                  </button>
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* Authors Section - Available for all conference types */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Author Information</h3>
        <AuthorManager
          authors={(data.coAuthors as any[]) || []}
          onChange={(authors) => handleChange('coAuthors', authors)}
          label="Co-Authors"
          publicationType="conference_paper"
        />
      </div>

      {/* Faculty Remarks */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Faculty Remarks</label>
        <textarea
          value={(data.facultyRemarks as string) || ''}
          onChange={(e) => handleChange('facultyRemarks', e.target.value)}
          rows={3}
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 resize-none"
          placeholder="Please mention the date and venue of conference..."
        />
      </div>

      {/* Document Submission */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Document Submission</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Documents (ZIP files accepted)
            </label>
            <input
              type="file"
              multiple
              accept=".zip,.pdf,.doc,.docx"
              onChange={(e) => {
                if (e.target.files) {
                  handleChange('uploadedDocuments', Array.from(e.target.files));
                }
              }}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-indigo-50 file:text-indigo-700
                hover:file:bg-indigo-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              Upload ZIP files or individual documents. Maximum 50MB per file.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Notes</label>
            <textarea
              value={(data.documentNotes as string) || ''}
              onChange={(e) => handleChange('documentNotes', e.target.value)}
              rows={2}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 resize-none"
              placeholder="Add any notes about the uploaded documents..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
