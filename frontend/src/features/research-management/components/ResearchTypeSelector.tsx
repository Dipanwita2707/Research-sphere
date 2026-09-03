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
    color: 'bg-[#7d1a34]',
    hoverColor: 'group-hover:bg-[#5e1024]',
    description: 'Journal articles published in indexed publications (Scopus, WoS)',
    features: ['Impact factor consideration', 'Indexing-based incentives', 'International author bonus'],
    href: '/research/apply?type=research_paper'
  },
  {
    type: 'book',
    label: 'Book Publication',
    icon: BookOpen,
    color: 'bg-[#c8973f]',
    hoverColor: 'group-hover:bg-[#b9822c]',
    description: 'Full authored books with ISBN',
    features: ['Full book authorship', 'Publisher recognition', 'National & International'],
    href: '/research/apply?type=book'
  },
  {
    type: 'book_chapter',
    label: 'Book Chapter',
    icon: BookMarked,
    color: 'bg-[#8c6239]',
    hoverColor: 'group-hover:bg-[#704d2b]',
    description: 'Chapter contributions in edited books with ISBN',
    features: ['Chapter contributions', 'Edited volume recognition', 'Publisher recognition'],
    href: '/research/apply?type=book_chapter'
  },
  {
    type: 'conference_paper',
    label: 'Conference Paper',
    icon: Presentation,
    color: 'bg-[#5e1024]',
    hoverColor: 'group-hover:bg-[#400b18]',
    description: 'Conference proceedings and paper presentations',
    features: ['National & International', 'Indexed proceedings', 'Invited presentations'],
    href: '/research/apply?type=conference_paper'
  },
  {
    type: 'grant_proposal',
    label: 'Grant / Funding',
    icon: DollarSign,
    color: 'bg-[#b9822c]',
    hoverColor: 'group-hover:bg-[#966820]',
    description: 'Research grants and externally funded projects',
    features: ['Government funding', 'Industry collaboration', 'Project completion incentives'],
    href: '/research/apply-grant'
  },
];

export default function ResearchTypeSelector() {
  return (
    <div className="min-h-screen bg-[#fdf5ec] dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#2b1d22] dark:text-white mb-2 font-serif">New Research Contribution</h1>
          <div className="w-16 h-1 bg-gradient-to-r from-[#7d1a34] to-[#c8973f] mx-auto mb-3 rounded-full" />
          <p className="text-[#7a7178] dark:text-gray-400">Select the type of publication you want to submit</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PUBLICATION_TYPES.map((pubType) => {
            const Icon = pubType.icon;
            return (
              <Link
                key={pubType.type}
                href={pubType.href}
                className="group bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-[#f0e2d2] dark:border-gray-750 hover:shadow-md hover:border-[#7d1a34] dark:hover:border-[#c8973f] transition-all duration-200"
              >
                <div className="flex items-start space-x-4">
                  <div className={`w-14 h-14 ${pubType.color} ${pubType.hoverColor} rounded-xl flex items-center justify-center flex-shrink-0 transition-colors shadow-sm`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-[#2b1d22] dark:text-white mb-1 group-hover:text-[#7d1a34] dark:group-hover:text-[#c8973f] transition-colors">
                      {pubType.label}
                    </h3>
                    <p className="text-[#7a7178] dark:text-gray-400 text-sm mb-3">{pubType.description}</p>
                    <div className="space-y-1">
                      {pubType.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#c8973f] dark:bg-gray-600 mr-2" />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-[#7d1a34] dark:group-hover:text-[#c8973f] group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 p-6 bg-white dark:bg-gray-800 border border-[#f0e2d2] dark:border-gray-700 rounded-xl shadow-sm">
          <h3 className="font-bold text-[#7d1a34] dark:text-amber-500 mb-3 flex items-center gap-2">
            <span className="text-lg">📋</span> How it works
          </h3>
          <ol className="text-sm text-[#7a7178] dark:text-gray-300 space-y-2">
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#fdf5ec] text-[#7d1a34] dark:bg-wine/20 dark:text-amber-400 text-xs font-bold flex items-center justify-center">1</span>
              Select the type of publication above
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#fdf5ec] text-[#7d1a34] dark:bg-wine/20 dark:text-amber-400 text-xs font-bold flex items-center justify-center">2</span>
              Fill in the Journal Details and add co-authors
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#fdf5ec] text-[#7d1a34] dark:bg-wine/20 dark:text-amber-400 text-xs font-bold flex items-center justify-center">3</span>
              Submit for DRD review
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#fdf5ec] text-[#7d1a34] dark:bg-wine/20 dark:text-amber-400 text-xs font-bold flex items-center justify-center">4</span>
              Upon approval, incentives are automatically credited to all authors
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
