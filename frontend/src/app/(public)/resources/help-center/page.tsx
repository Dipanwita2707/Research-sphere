'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PublicNav from '@/shared/components/public/PublicNav';
import Wordmark from '@/shared/components/brand/Wordmark';
import { Search, BookOpen, Key, DollarSign, Award, Settings, ChevronDown, ChevronUp } from 'lucide-react';

const CATEGORIES = [
  { icon: Key, title: 'Account & Security', desc: 'Managing passwords, roles, and login access.' },
  { icon: BookOpen, title: 'Publication Syncing', desc: 'Connecting ORCID, Scopus, and PubMed IDs.' },
  { icon: Award, title: 'Patents & IPR', desc: 'Filing processes, co-author approvals, and status tracking.' },
  { icon: DollarSign, title: 'Grants & Funding', desc: 'Budget tracking, milestone submissions, and approvals.' },
  { icon: Settings, title: 'Administration', desc: 'Configuring departments, schools, and bulk uploads.' },
];

const FAQS = [
  {
    q: 'How do I link my ORCID, Scopus, and PubMed identifiers?',
    a: 'Only administrators can add or edit these IDs to maintain data integrity. Please contact your department coordinator or administrator to add your Scopus Author ID, ORCID iD, or PubMed ID. Once saved, the platform will automatically sync your past and future publications.'
  },
  {
    q: 'Why is my publication not appearing in the search repository?',
    a: 'First, check if your publication is approved. After publications are synced or manually added, they must go through an approval workflow (by the department head or DRD) before they become visible on the public research search page. Also, ensure your Scopus or ORCID IDs are correctly formatted in your profile.'
  },
  {
    q: 'What should I do if a co-inventor rejects a patent application?',
    a: 'If a co-author rejects a patent application (for instance, due to an incorrect contribution percentage), the patent will return to a "Draft" status. The primary applicant can edit the details or the percentages and resubmit the application, which will trigger a new round of approvals.'
  },
  {
    q: 'Can I track budget utilization on my active grants?',
    a: 'Yes. The Grants module provides a real-time ledger where you can view sanctioned funds, expenses recorded, and remaining balance. To log an expense against a grant, navigate to your active grant and select "Log Milestone Expense" to submit for review.'
  }
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filteredFaqs = FAQS.filter(faq =>
    faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-ivory font-sans antialiased flex flex-col justify-between">
      <div>
        <PublicNav />

        {/* Header Spacer */}
        <div className="h-16 sm:h-20" />

        {/* SEARCH BANNER */}
        <section className="bg-brand-gradient text-white py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
          <div className="max-w-3xl mx-auto text-center space-y-6 relative z-10">
            <span className="text-xs font-extrabold uppercase tracking-widest text-amber bg-white/10 px-3.5 py-1.5 rounded-full">
              Support Center
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold font-serif tracking-tight">
              How can we help you today?
            </h1>
            <div className="relative max-w-xl mx-auto">
              <input
                type="text"
                placeholder="Search for articles, guides, FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white text-charcoal border-none shadow-lg focus:ring-2 focus:ring-amber focus:outline-none placeholder-gray-400 text-sm"
              />
              <Search className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
            </div>
          </div>
        </section>

        {/* CATEGORIES GRID */}
        {searchQuery === '' && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-bold text-charcoal font-serif mb-8 text-center">Browse by Topic</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div key={cat.title} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow text-center flex flex-col items-center space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-blush flex items-center justify-center text-wine">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-sm text-charcoal">{cat.title}</h3>
                    <p className="text-xs text-gray-400 leading-normal">{cat.desc}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* FAQS SECTION */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 pt-8">
          <h2 className="text-2xl font-bold text-charcoal font-serif mb-6 text-center">
            {searchQuery ? 'Search Results' : 'Frequently Asked Questions'}
          </h2>
          {filteredFaqs.length > 0 ? (
            <div className="space-y-4">
              {filteredFaqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full px-6 py-5 flex items-center justify-between text-left font-semibold text-charcoal hover:text-wine transition-colors"
                    >
                      <span className="text-sm sm:text-base">{faq.q}</span>
                      {isOpen ? <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />}
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 text-xs sm:text-sm text-gray-500 border-t border-gray-50/50 pt-4 leading-relaxed bg-gray-50/30">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              No matching help articles found for "{searchQuery}".
            </div>
          )}
        </section>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Wordmark heightClassName="h-8" />
            <span className="text-gray-200">·</span>
            <span className="text-sm text-gray-400 font-medium">© {new Date().getFullYear()} All rights reserved</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm text-gray-400 hover:text-wine font-medium transition-colors">Product</Link>
            <Link href="/pricing" className="text-sm text-gray-400 hover:text-wine font-medium transition-colors">Pricing</Link>
            <Link href="/contact" className="text-sm text-gray-400 hover:text-wine font-medium transition-colors">Contact</Link>
            <Link href="/login" className="text-sm text-gray-400 hover:text-wine font-medium transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
