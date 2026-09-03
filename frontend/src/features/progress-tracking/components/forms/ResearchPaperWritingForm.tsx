'use client';

import AuthorManager from '../AuthorManager';

interface ResearchPaperWritingFormProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

const SDG_GOALS = [
  { value: 'sdg1', label: 'SDG 1: No Poverty' },
  { value: 'sdg2', label: 'SDG 2: Zero Hunger' },
  { value: 'sdg3', label: 'SDG 3: Good Health and Well-being' },
  { value: 'sdg4', label: 'SDG 4: Quality Education' },
  { value: 'sdg5', label: 'SDG 5: Gender Equality' },
  { value: 'sdg6', label: 'SDG 6: Clean Water and Sanitation' },
  { value: 'sdg7', label: 'SDG 7: Affordable and Clean Energy' },
  { value: 'sdg8', label: 'SDG 8: Decent Work and Economic Growth' },
  { value: 'sdg9', label: 'SDG 9: Industry, Innovation and Infrastructure' },
  { value: 'sdg10', label: 'SDG 10: Reduced Inequalities' },
  { value: 'sdg11', label: 'SDG 11: Sustainable Cities and Communities' },
  { value: 'sdg12', label: 'SDG 12: Responsible Consumption and Production' },
  { value: 'sdg13', label: 'SDG 13: Climate Action' },
  { value: 'sdg14', label: 'SDG 14: Life Below Water' },
  { value: 'sdg15', label: 'SDG 15: Life on Land' },
  { value: 'sdg16', label: 'SDG 16: Peace, Justice and Strong Institutions' },
  { value: 'sdg17', label: 'SDG 17: Partnerships for the Goals' },
];

export default function ResearchPaperWritingForm({ data, onChange }: ResearchPaperWritingFormProps) {
  const handleChange = (field: string, value: unknown) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Basic Publication Info */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-900 border-b pb-2">Publication Details</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Journal Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={(data.journalName as string) || ''}
              onChange={(e) => handleChange('journalName', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="e.g., Nature, IEEE Transactions"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Targeted Research <span className="text-red-500">*</span>
            </label>
            <select
              value={(data.targetedResearchType as string) || ''}
              onChange={(e) => handleChange('targetedResearchType', e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">Select Type</option>
              <option value="scopus">Scopus</option>
              <option value="sci_scie">SCI/SCIE</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Quartile - Show only for Scopus and Both */}
          {(data.targetedResearchType ===
   'scopus' || data.targetedResearchType ===
   'both') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quartile <span className="text-red-500">*</span>
              </label>
              <select
                value={(data.quartile as string) || ''}
                onChange={(e) => handleChange('quartile', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">Select Quartile</option>
                <option value="Top 1%">Top 1%</option>
                <option value="Top 5%">Top 5%</option>
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>
            </div>
          )}

          {/* Impact Factor - Show only for SCI/SCIE and Both */}
          {(data.targetedResearchType ===
   'sci_scie' || data.targetedResearchType ===
   'both') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Impact Factor <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.001"
                value={(data.impactFactor as number) || ''}
                onChange={(e) => handleChange('impactFactor', parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="e.g., 2.5"
              />
            </div>
          )}

          {/* SJR - Show only for Scopus and Both */}
          {(data.targetedResearchType ===
   'scopus' || data.targetedResearchType ===
   'both') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SJR</label>
              <input
                type="number"
                step="0.01"
                value={(data.sjr as number) || ''}
                onChange={(e) => handleChange('sjr', parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="e.g., 0.5"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Interdisciplinary(ResearchSphere) <span className="text-red-500">*</span>
            </label>
            <select
              value={(data.isInterdisciplinary as boolean) ? 'yes' : 'no'}
              onChange={(e) => handleChange('isInterdisciplinary', e.target.value ===
   'yes')}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
      </div>

      {/* SDGs */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          UN Sustainable Development Goals (SDGs)
        </label>
        <details className="group">
          <summary className="cursor-pointer px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 hover:bg-white flex justify-between items-center transition-colors">
            <span className="text-gray-600">
              {((data.sdgGoals as string[]) || []).length > 0 
                ? `${((data.sdgGoals as string[]) || []).length} SDG${((data.sdgGoals as string[]) || []).length !== 1 ? 's' : ''} selected`
                : 'Click to select relevant SDGs'}
            </span>
            <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="mt-2 p-4 border border-gray-200 rounded-xl bg-white shadow-lg max-h-64 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SDG_GOALS.map((sdg) => (
                <label key={sdg.value} className="flex items-center space-x-2 px-3 py-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={((data.sdgGoals as string[]) || []).includes(sdg.value)}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      const currentSdgs = (data.sdgGoals as string[]) || [];
                      handleChange('sdgGoals', isChecked
                        ? [...currentSdgs, sdg.value]
                        : currentSdgs.filter(g => g !== sdg.value)
                      );
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm">{sdg.label}</span>
                </label>
              ))}
            </div>
          </div>
        </details>
        {((data.sdgGoals as string[]) || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {((data.sdgGoals as string[]) || []).map(sdgValue => {
              const sdg = SDG_GOALS.find(s => s.value ===
   sdgValue);
              return sdg ? (
                <span key={sdgValue} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  {sdg.label.replace('SDG ', '')}
                  <button
                    type="button"
                    onClick={() => {
                      const currentSdgs = (data.sdgGoals as string[]) || [];
                      handleChange('sdgGoals', currentSdgs.filter(g => g !== sdgValue));
                    }}
                    className="hover:text-blue-900 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* Co-Authors */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-900 border-b pb-2">Author Information</h4>
        <AuthorManager
          authors={(data.coAuthors as any[]) || []}
          onChange={(authors) => handleChange('coAuthors', authors)}
          label="Co-Authors"
          publicationType="research_paper"
        />
      </div>

      {/* Additional Fields */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-900 border-b pb-2">Additional Information</h4>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Research Keywords</label>
          <input
            type="text"
            value={(data.keywords as string) || ''}
            onChange={(e) => handleChange('keywords', e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="e.g., Machine Learning, Healthcare, AI"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Abstract/Summary</label>
          <textarea
            value={(data.abstract as string) || ''}
            onChange={(e) => handleChange('abstract', e.target.value)}
            rows={4}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="Brief summary of your research..."
          />
        </div>

        <div className="flex flex-wrap gap-4 pt-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(data.hasInternationalCollaboration as boolean) || false}
              onChange={(e) => handleChange('hasInternationalCollaboration', e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">International Collaboration</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(data.hasStudentInvolvement as boolean) || false}
              onChange={(e) => handleChange('hasStudentInvolvement', e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Student Involvement</span>
          </label>
        </div>
      </div>
    </div>
  );
}
