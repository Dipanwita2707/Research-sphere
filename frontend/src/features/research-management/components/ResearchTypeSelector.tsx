'use client';

import React from 'react';
import Link from 'next/link';
import { 
  FileText, 
  BookOpen, 
  BookMarked,
  Presentation, 
  DollarSign,
  ChevronRight 
} from 'lucide-react';

const PUBLICATION_TYPES = [
  {
    type: 'research_paper',
    label: 'Research Paper Publication',
    icon: FileText,
    color: 'bg-blue-500',
    hoverColor: 'group-hover:bg-blue-600',
    description: 'Journal articles published in indexed publications (Scopus, WoS)',
    features: ['Impact factor consideration', 'Indexing-based incentives', 'International author bonus'],
    href: '/research/apply?type=research_paper'
  },
  {
    type: 'book',
    label: 'Book Publication',
    icon: BookOpen,
    color: 'bg-green-500',
    hoverColor: 'group-hover:bg-green-600',
    description: 'Full authored books with ISBN',
    features: ['Full book authorship', 'Publisher recognition', 'National & International'],
    href: '/research/apply?type=book'
  },
  {
    type: 'book_chapter',
    label: 'Book Chapter',
    icon: BookMarked,
    color: 'bg-teal-500',
    hoverColor: 'group-hover:bg-teal-600',
    description: 'Chapter contributions in edited books with ISBN',
    features: ['Chapter contributions', 'Edited volume recognition', 'Publisher recognition'],
    href: '/research/apply?type=book_chapter'
  },
  {
    type: 'conference_paper',
    label: 'Conference Paper',
    icon: Presentation,
    color: 'bg-purple-500',
    hoverColor: 'group-hover:bg-purple-600',
    description: 'Conference proceedings and paper presentations',
    features: ['National & International', 'Indexed proceedings', 'Invited presentations'],
    href: '/research/apply?type=conference_paper'
  },
  {
    type: 'grant_proposal',
    label: 'Grant / Funding',
    icon: DollarSign,
    color: 'bg-orange-500',
    hoverColor: 'group-hover:bg-orange-600',
    description: 'Research grants and externally funded projects',
    features: ['Government funding', 'Industry collaboration', 'Project completion incentives'],
    href: '/research/apply-grant'
  },
];

export default function ResearchTypeSelector() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">New Research Contribution</h1>
          <p className="text-gray-600">Select the type of publication you want to submit</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PUBLICATION_TYPES.map((pubType) => {
            const Icon = pubType.icon;
            return (
              <Link
                key={pubType.type}
                href={pubType.href}
                className="group bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all duration-200"
              >
                <div className="flex items-start space-x-4">
                  <div className={`w-14 h-14 ${pubType.color} ${pubType.hoverColor} rounded-xl flex items-center justify-center flex-shrink-0 transition-colors`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                      {pubType.label}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3">{pubType.description}</p>
                    <div className="space-y-1">
                      {pubType.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center text-xs text-gray-500">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mr-2" />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">📋 How it works</h3>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Select the type of publication above</li>
            <li>2. Fill in the Journal Details and add co-authors</li>
            <li>3. Submit for DRD review</li>
            <li>4. Upon approval, incentives are automatically credited to all authors</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
