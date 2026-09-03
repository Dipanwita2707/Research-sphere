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

interface BookChapterWritingFormProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export default function BookChapterWritingForm({ data, onChange }: BookChapterWritingFormProps) {
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
      {/* Book Chapter Specific Fields */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Chapter Details</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Book Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={(data.bookTitle as string) || ''}
              onChange={(e) => handleChange('bookTitle', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
              placeholder="Enter the title of the book containing your chapter"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chapter Number</label>
              <input
                type="text"
                value={(data.chapterNumber as string) || ''}
                onChange={(e) => handleChange('chapterNumber', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                placeholder="e.g. Chapter 5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Page Numbers</label>
              <input
                type="text"
                value={(data.pageNumbers as string) || ''}
                onChange={(e) => handleChange('pageNumbers', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                placeholder="e.g. 100-125"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Editors</label>
            <input
              type="text"
              value={(data.editors as string) || ''}
              onChange={(e) => handleChange('editors', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
              placeholder="Enter editor names (comma separated)"
            />
          </div>
        </div>
      </div>

      {/* Publication Type Section */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Publication Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Publication Type <span className="text-red-500">*</span>
            </label>
            <select
              value={(data.bookIndexingType as string) || ''}
              onChange={(e) => handleChange('bookIndexingType', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">-- Select --</option>
              <option value="scopus_indexed">Scopus Indexed</option>
              <option value="non_indexed">Non-Indexed</option>
              <option value="sgt_publication_house">ResearchSphere Publication House</option>
            </select>
          </div>

          {data.bookIndexingType ===
   'non_indexed' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Our Authorized Publications <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4 mt-2">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="yes"
                    checked={(data.bookLetter as string) ===
   'yes'}
                    onChange={(e) => handleChange('bookLetter', e.target.value)}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="ml-2 text-sm">Yes</span>
                </label>
                <label className="inline-flex items-center opacity-50 cursor-not-allowed">
                  <input type="radio" disabled className="w-4 h-4" />
                  <span className="ml-2 text-sm">No</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Interdisciplinary(ResearchSphere) <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4 mt-2">
              {['yes', 'no'].map(v => (
                <label key={v} className="inline-flex items-center">
                  <input
                    type="radio"
                    value={v}
                    checked={(data.isInterdisciplinary as string) ===
   v}
                    onChange={(e) => handleChange('isInterdisciplinary', e.target.value)}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="ml-2 text-sm capitalize">{v}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Communication & Publisher Section */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Communication & Publisher Details</h3>
        <div className="space-y-4">
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
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="ml-2 text-sm capitalize">{v}</span>
                </label>
              ))}
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
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                placeholder="Enter your personal email address"
              />
              <p className="text-xs text-orange-600 mt-1">Since you haven't communicated with official ID, please provide your personal email.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Publisher <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(data.publisherName as string) || ''}
                onChange={(e) => handleChange('publisherName', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                placeholder="Enter publisher name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                National / International <span className="text-red-500">*</span>
              </label>
              <select
                value={(data.nationalInternational as string) || ''}
                onChange={(e) => handleChange('nationalInternational', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
              >
                <option value="">-- Select --</option>
                <option value="national">National</option>
                <option value="international">International</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ISBN and Publication Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ISBN <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={(data.isbn as string) || ''}
            onChange={(e) => handleChange('isbn', e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            placeholder="978-xxx-xxx-xxxx-x"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Publication Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={(data.publicationDate as string) || ''}
            onChange={(e) => handleChange('publicationDate', e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
          />
        </div>
      </div>

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
                  className="mt-0.5 w-4 h-4 text-green-600 rounded focus:ring-green-500"
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
                <span key={goal} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  {sdg.value}. {sdg.label}
                  <button
                    type="button"
                    onClick={() => toggleSDG(goal)}
                    className="hover:text-green-900"
                  >
                    ×
                  </button>
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* Authors Section */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Author Information</h3>
        <AuthorManager
          authors={(data.coAuthors as any[]) || []}
          onChange={(authors) => handleChange('coAuthors', authors)}
          label="Co-Authors"
          publicationType="book_chapter"
        />
      </div>

      {/* Faculty Remarks */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Faculty Remarks</label>
        <textarea
          value={(data.facultyRemarks as string) || ''}
          onChange={(e) => handleChange('facultyRemarks', e.target.value)}
          rows={3}
          className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 resize-none"
          placeholder="Any additional remarks or comments about the publication..."
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
