'use client';

import React, { useState, useEffect } from 'react';
import { Search, Layers, BookOpen, Award, TrendingUp, ExternalLink, Filter } from 'lucide-react';
import { researchService } from '@/features/research-management/services/research.service';

export default function ResearchSearchPage() {
  const [publications, setPublications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await researchService.getPublicRepository();
        if (res && res.success) {
          setPublications(res.data || []);
        }
      } catch (e) {
        console.error('Failed to load public repository publications:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Compute unique departments dynamically
  const uniqueDepartments = Array.from(new Set(
    publications
      .map(p => p.department?.departmentName)
      .filter(Boolean)
  )) as string[];

  // Filter publications based on search, category, and department
  const filteredPublications = publications.filter(pub => {
    const titleMatch = pub.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const doiMatch = pub.doi?.toLowerCase().includes(searchQuery.toLowerCase());
    const authorMatch = pub.authors?.some((a: any) => a.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    const venueMatch = (
      pub.journalName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pub.publisherName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pub.conferenceName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    const matchesSearch = !searchQuery || titleMatch || doiMatch || authorMatch || venueMatch;
    
    // Category match
    const matchesCategory = selectedCategory === 'all' || pub.publicationType === selectedCategory;
    
    // Department match
    const deptName = pub.department?.departmentName || pub.departmentId || '';
    const matchesDept = selectedDepartment === 'all' || deptName.toLowerCase() === selectedDepartment.toLowerCase();
    
    return matchesSearch && matchesCategory && matchesDept;
  });

  // Calculate dynamic stats
  const totalPublications = publications.length;
  const totalCitations = publications.reduce((sum, pub) => {
    return sum + (Number(pub.indexingDetails?.citationCount) || 0);
  }, 0);
  const grantsCount = publications.filter(p => p.publicationType === 'grant_proposal').length;
  const activeDepartments = uniqueDepartments.length;

  return (
    <div className="min-h-screen bg-[#fdf5ec] dark:bg-slate-950">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-[#f0e2d2] dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium tracking-wide uppercase">
            <Layers className="w-3.5 h-3.5 text-[#7d1a34] dark:text-[#c8973f]" />
            Research Repository
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-serif">University Research Repository</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Explore approved publications, books, conference papers, and grants across the institution
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* ── Stats Bar ──────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 border border-[#f0e2d2] dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-200 dark:divide-slate-800">
            {[
              { icon: BookOpen,  label: 'Approved Publications', value: totalPublications, accent: 'text-[#7d1a34] dark:text-[#c8973f]', bg: 'bg-[#fdf5ec] dark:bg-slate-950/50' },
              { icon: Award,     label: 'Total Citations',     value: totalCitations,     accent: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50' },
              { icon: TrendingUp,label: 'Grants & Funding',    value: grantsCount,        accent: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50' },
              { icon: Layers,    label: 'Departments',         value: activeDepartments,   accent: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/50' },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="p-5 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${stat.accent}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{stat.value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Search & Filter Controls ───────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 border border-[#f0e2d2] dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search publications by title, author name, DOI, journal..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-[#7d1a34] dark:focus:border-[#c8973f] text-slate-900 dark:text-white placeholder-slate-400 transition-colors"
              />
            </div>
            <div className="flex gap-4 flex-wrap md:flex-nowrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#7d1a34] dark:focus:border-[#c8973f] transition-colors"
                >
                  <option value="all">All Categories</option>
                  <option value="research_paper">Research Papers</option>
                  <option value="book">Books</option>
                  <option value="book_chapter">Book Chapters</option>
                  <option value="conference_paper">Conference Papers</option>
                  <option value="grant_proposal">Grants & Funding</option>
                </select>
              </div>

              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#7d1a34] dark:focus:border-[#c8973f] transition-colors max-w-[200px]"
              >
                <option value="all">All Departments</option>
                {uniqueDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Repository Results List ────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 border border-[#f0e2d2] dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white font-serif">Approved Research Repository Items</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Showing {filteredPublications.length} of {publications.length} records</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 bg-slate-50 dark:bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredPublications.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 p-6 space-y-4">
              {filteredPublications.map(pub => (
                <div key={pub.id} className="bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-xl p-5 hover:shadow-md hover:border-[#f0e2d2] dark:hover:border-[#5e1024] transition-all duration-200">
                  <div className="flex flex-wrap gap-2 items-center mb-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                      pub.publicationType === 'research_paper' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                      pub.publicationType === 'book' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' :
                      pub.publicationType === 'book_chapter' ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' :
                      pub.publicationType === 'conference_paper' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                      'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {pub.publicationType === 'research_paper' ? 'Research Paper' :
                       pub.publicationType === 'book' ? 'Book Publication' :
                       pub.publicationType === 'book_chapter' ? 'Book Chapter' :
                       pub.publicationType === 'conference_paper' ? 'Conference Paper' : 'Grant Proposal'}
                    </span>
                    {pub.applicationNumber && (
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 font-mono">
                        {pub.applicationNumber}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2 leading-snug font-serif">
                    {pub.title}
                  </h3>

                  <div className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                    <span className="font-semibold">Authors: </span>
                    {pub.authors && pub.authors.length > 0 ? (
                      pub.authors.map((author: any, idx: number) => (
                        <span key={author.id}>
                          <span className={author.affiliation?.toLowerCase().includes('sgt') || author.affiliation?.toLowerCase().includes('researchsphere') ? 'text-[#7d1a34] dark:text-[#c8973f] font-semibold' : ''}>
                            {author.name}
                          </span>
                          {idx < pub.authors.length - 1 ? ', ' : ''}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400">Not specified</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div>
                      {pub.publicationType === 'research_paper' && pub.journalName && (
                        <span>Published in: <span className="font-medium text-slate-700 dark:text-slate-300 italic">{pub.journalName}</span></span>
                      )}
                      {pub.publicationType === 'conference_paper' && pub.conferenceName && (
                        <span>Presented at: <span className="font-medium text-slate-700 dark:text-slate-300 italic">{pub.conferenceName}</span></span>
                      )}
                      {(pub.publicationType === 'book' || pub.publicationType === 'book_chapter') && pub.publisherName && (
                        <span>Publisher: <span className="font-medium text-slate-700 dark:text-slate-300 italic">{pub.publisherName}</span></span>
                      )}
                      {pub.publicationType === 'grant_proposal' && (
                        <span>Funding Agency: <span className="font-medium text-slate-700 dark:text-slate-300 italic">{pub.journalName || 'Approved Grant'}</span></span>
                      )}
                    </div>
                    <div className="md:text-right">
                      {pub.department?.departmentName && (
                        <span>Department: <span className="font-medium text-slate-700 dark:text-slate-300">{pub.department.departmentName}</span></span>
                      )}
                    </div>
                  </div>

                  {(pub.doi || pub.publicationDate) && (
                    <div className="flex justify-between items-center mt-3 text-[11px] text-slate-400 dark:text-slate-500">
                      <div>
                        {pub.publicationDate && (
                          <span>Date: {new Date(pub.publicationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
                        )}
                      </div>
                      <div>
                        {pub.doi && (
                          <a
                            href={pub.doi.startsWith('http') ? pub.doi : `https://doi.org/${pub.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#7d1a34] dark:text-[#c8973f] hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            DOI / Reference
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">No publications found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Try adjusting your filters or search keywords.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}