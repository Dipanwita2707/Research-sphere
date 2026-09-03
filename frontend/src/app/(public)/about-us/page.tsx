'use client';

import React from 'react';
import Link from 'next/link';
import PublicNav from '@/shared/components/public/PublicNav';
import Wordmark from '@/shared/components/brand/Wordmark';
import { ShieldCheck, Target, Eye, Users, ChevronRight, Award, Compass, Heart } from 'lucide-react';

const VALUES = [
  {
    icon: ShieldCheck,
    title: 'Security & Compliance First',
    desc: 'Each institution enjoys absolute, dedicated database isolation to meet compliance, privacy, and sovereignty standards.'
  },
  {
    icon: Target,
    title: 'Academic Excellence',
    desc: 'We are committed to helping universities index, evaluate, and showcase intellectual property and citation achievements.'
  },
  {
    icon: Compass,
    title: 'Transparent Collaboration',
    desc: 'Remove administrative gaps between departments, deans, legal, and financial reviews to facilitate unified research workflows.'
  },
  {
    icon: Heart,
    title: 'Faculty Empowerment',
    desc: 'Let researchers focus on discovery by replacing tedious record-keeping with automated publication syncing across multiple databases.'
  }
];

const STATS = [
  { value: '500+', label: 'Universities Supported' },
  { value: '25K+', label: 'Active Researchers' },
  { value: '1.2M+', label: 'Publications Indexed' },
  { value: '₹250Cr+', label: 'Research Grants Managed' }
];

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-ivory font-sans antialiased flex flex-col justify-between">
      <div>
        <PublicNav />

        {/* Header Spacer */}
        <div className="h-16 sm:h-20" />

        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-20 pb-16 sm:pt-28 sm:pb-20 text-center">
          <div className="pointer-events-none absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-peach/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-wine/5 blur-3xl" />
          
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <span className="text-xs font-extrabold uppercase tracking-widest text-wine bg-wine/5 border border-wine/15 px-3.5 py-1.5 rounded-full mb-6 inline-block">
              Our Journey
            </span>
            <h1 className="text-5xl sm:text-6xl font-extrabold text-charcoal font-serif tracking-tight leading-none mb-6">
              Empowering Academic<br />
              <span className="text-wine">Scholarly Excellence</span>
            </h1>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              ResearchSphere was founded with a single mission: to build the modern research operating system for progressive universities. We streamline administration, tracking, and compliance so researchers can focus on making an impact.
            </p>
          </div>
        </section>

        {/* MISSION & VISION */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white border border-gray-100 rounded-3xl p-8 sm:p-10 shadow-sm space-y-4">
              <div className="w-12 h-12 bg-blush text-wine rounded-2xl flex items-center justify-center">
                <Target className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold text-charcoal font-serif">Our Mission</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                To remove institutional friction from scholarly discovery. By automating citations retrieval from ORCID, PubMed, and Scopus, and providing transparent pipelines for patents and grants, we eliminate administrative overhead and highlight true academic productivity.
              </p>
            </div>
            <div className="bg-white border border-gray-100 rounded-3xl p-8 sm:p-10 shadow-sm space-y-4">
              <div className="w-12 h-12 bg-blush text-wine rounded-2xl flex items-center justify-center">
                <Eye className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold text-charcoal font-serif">Our Vision</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                To become the global infrastructure for research intelligence, compliance, and accreditation reporting, transforming raw dataset syncs into meaningful strategic directions for institutions worldwide.
              </p>
            </div>
          </div>
        </section>

        {/* STATS SECTION */}
        <section className="bg-wine text-white py-16 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
              {STATS.map((stat, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="text-4xl sm:text-5xl font-extrabold text-amber font-serif">{stat.value}</div>
                  <div className="text-xs sm:text-sm uppercase tracking-wider text-peach/75">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CORE VALUES */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl font-bold text-charcoal font-serif">Our Core Values</h2>
            <p className="text-sm text-gray-400">
              The fundamental principles that guide how we design products and support our partner universities.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map((val, idx) => {
              const Icon = val.icon;
              return (
                <div key={idx} className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col space-y-4">
                  <div className="w-10 h-10 bg-blush text-wine rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-charcoal text-sm">{val.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed flex-grow">{val.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="bg-[#fdfaf7] border border-[#f0e2d2] rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden shadow-sm">
            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <h2 className="text-3xl font-bold text-charcoal font-serif">Accelerate Your University's Research Potential</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Connect with our product specialists to discover how our multi-tenant SaaS solution can elevate your faculty's research capabilities and index compliance.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/pricing" className="inline-flex items-center gap-1.5 px-6 py-3 bg-wine text-white text-sm font-bold rounded-xl hover:bg-wine-dark transition-colors shadow-md shadow-wine/20">
                  Explore Pricing Plans <ChevronRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="px-6 py-3 border border-wine/20 text-wine hover:bg-blush text-sm font-bold rounded-xl transition-colors">
                  Sign In to Platform
                </Link>
              </div>
            </div>
          </div>
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
