'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PublicNav from '@/shared/components/public/PublicNav';
import Wordmark from '@/shared/components/brand/Wordmark';
import { 
  BookOpen, 
  Users, 
  Award, 
  DollarSign, 
  ShieldCheck, 
  CheckCircle, 
  ChevronRight,
  Menu,
  X,
  FileText,
  HelpCircle,
  ArrowRight,
  Terminal,
  Layers,
  Sparkles
} from 'lucide-react';

const DOCS_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Sparkles,
    content: (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-charcoal font-serif">Getting Started</h2>
        <p className="text-gray-600 leading-relaxed">
          Welcome to the ResearchSphere documentation. ResearchSphere is an enterprise-grade Research Information Management System (RIMS) designed to streamline academic research, tracking, and compliance.
        </p>
        <div className="bg-blush border border-wine/10 rounded-2xl p-6 space-y-3">
          <h4 className="font-bold text-wine flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Key Architecture Highlight
          </h4>
          <p className="text-sm text-charcoal/70">
            Our platform operates under a secure, multi-tenant model. Each institution's data is fully isolated to guarantee safety, privacy, and regulatory compliance.
          </p>
        </div>
        <h3 className="text-xl font-bold text-charcoal pt-4 border-t border-gray-100">Core Capabilities</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-shadow">
            <h4 className="font-bold text-charcoal flex items-center gap-2 mb-2">
              <BookOpen className="h-5 w-5 text-wine" /> Research Repository
            </h4>
            <p className="text-xs text-gray-500">Automated publication indexing from Scopus, ORCID, and PubMed with smart deduplication.</p>
          </div>
          <div className="border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-shadow">
            <h4 className="font-bold text-charcoal flex items-center gap-2 mb-2">
              <Award className="h-5 w-5 text-wine" /> IPR & Patents
            </h4>
            <p className="text-xs text-gray-500">End-to-end patent filing workflows with integrated institutional co-author approvals.</p>
          </div>
          <div className="border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-shadow">
            <h4 className="font-bold text-charcoal flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-wine" /> Grants Tracking
            </h4>
            <p className="text-xs text-gray-500">Streamline budget allocations, reviews, and progress tracking for research projects.</p>
          </div>
          <div className="border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-shadow">
            <h4 className="font-bold text-charcoal flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-wine" /> Workflows
            </h4>
            <p className="text-xs text-gray-500">Role-based approval loops involving Deans, DRD (Directorate of Research), and Finance.</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'employee-management',
    title: 'Employee Management',
    icon: Users,
    content: (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-charcoal font-serif">Employee Management</h2>
        <p className="text-gray-600 leading-relaxed">
          Administrators can manage faculty, staff, and researchers centrally. This module supports role mapping, department/school allocation, and user credential management.
        </p>
        <h3 className="text-xl font-bold text-charcoal pt-4 border-t border-gray-100">Adding Users</h3>
        <p className="text-sm text-gray-600">
          There are two primary ways to add new researchers or staff members:
        </p>
        <ol className="list-decimal list-inside space-y-3 text-sm text-gray-600">
          <li>
            <strong className="text-charcoal">Manual Entry:</strong> Click "Add New Employee" in the Admin Panel. Enter personal, employment, and academic identifier details.
          </li>
          <li>
            <strong className="text-charcoal">Bulk Upload:</strong> Download the pre-formatted Excel template, populate your faculty data, and upload the spreadsheet to provision accounts in bulk.
          </li>
        </ol>
        <div className="bg-amber-50 border border-amber/20 rounded-2xl p-6 mt-4">
          <p className="text-xs text-amber-800 font-medium">
            <strong>Security Notice:</strong> Only system administrators can assign or modify critical institutional roles (e.g., Dean, DRD Reviewer, Finance Officer) to prevent unauthorized escalation of privileges.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'researcher-profiles',
    title: 'Researcher Profiles & Sync',
    icon: BookOpen,
    content: (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-charcoal font-serif">Researcher Profiles & Sync</h2>
        <p className="text-gray-600 leading-relaxed">
          ResearchSphere integrates with external academic databases to keep the university's research repository up-to-date automatically.
        </p>
        <h3 className="text-xl font-bold text-charcoal pt-4 border-t border-gray-100">Configuring Identifiers</h3>
        <p className="text-sm text-gray-600">
          To enable automated syncing, administrators must associate the relevant database identifiers with the researcher's profile. These fields can be configured during employee creation or updated via the <strong>Researcher Profiles</strong> section:
        </p>
        <div className="overflow-hidden border border-gray-100 rounded-2xl">
          <table className="min-w-full divide-y divide-gray-100 text-left">
            <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Identifier</th>
                <th className="px-6 py-3">Format Example</th>
                <th className="px-6 py-3">Sync Mechanism</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
              <tr>
                <td className="px-6 py-4 font-semibold text-charcoal">Scopus Author ID</td>
                <td className="px-6 py-4"><code>57211603500</code></td>
                <td className="px-6 py-4">Elsevier API integration</td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-semibold text-charcoal">ORCID iD</td>
                <td className="px-6 py-4"><code>0000-0002-1825-0097</code></td>
                <td className="px-6 py-4">Public XML endpoint polling</td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-semibold text-charcoal">PubMed ID</td>
                <td className="px-6 py-4"><code>34892911</code></td>
                <td className="px-6 py-4">NCBI E-utilities sync engine</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="bg-emerald-50 border border-emerald/20 rounded-2xl p-6">
          <h4 className="font-bold text-emerald-800 flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5" /> How Deduplication Works
          </h4>
          <p className="text-xs text-emerald-700 leading-relaxed">
            The background sync engine searches all configured databases. When a new publication is found, it evaluates identifiers (DOI, Scopus ID, PubMed ID) and matches them against existing records. If a match is found, the system links the researcher without duplicating the publication entry.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'ipr-patents',
    title: 'IPR & Patent Workflows',
    icon: Award,
    content: (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-charcoal font-serif">IPR & Patent Workflows</h2>
        <p className="text-gray-600 leading-relaxed">
          The Intellectual Property Rights (IPR) module enables researchers to draft, file, and track patent applications directly within the platform.
        </p>
        <h3 className="text-xl font-bold text-charcoal pt-4 border-t border-gray-100">Step-by-Step Filing Process</h3>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-wine text-white flex items-center justify-center font-bold flex-shrink-0">1</div>
            <div>
              <h4 className="font-bold text-charcoal">Submit Draft</h4>
              <p className="text-xs text-gray-500 mt-1">The primary researcher enters patent details, adds abstract, uploads claims documents, and lists co-inventors.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-wine text-white flex items-center justify-center font-bold flex-shrink-0">2</div>
            <div>
              <h4 className="font-bold text-charcoal">Co-Author Notification</h4>
              <p className="text-xs text-gray-500 mt-1">All internal co-authors/co-inventors receive immediate in-app notifications and can track progress and incentives from their dashboard.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-wine text-white flex items-center justify-center font-bold flex-shrink-0">3</div>
            <div>
              <h4 className="font-bold text-charcoal">DRD Evaluation</h4>
              <p className="text-xs text-gray-500 mt-1">The Directorate of Research reviews the patentability, claims strength, and compliance with institutional research guidelines.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-wine text-white flex items-center justify-center font-bold flex-shrink-0">4</div>
            <div>
              <h4 className="font-bold text-charcoal">Final Approval & Filing</h4>
              <p className="text-xs text-gray-500 mt-1">Once approved by the Dean/DRD, the patent is assigned an internal filing ID, forwarded to legal, and tracked through public granting stages.</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'grants-funding',
    title: 'Grants & Funding',
    icon: DollarSign,
    content: (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-charcoal font-serif">Grants & Funding</h2>
        <p className="text-gray-600 leading-relaxed">
          Manage extramural, intramural, and government-funded research grants. Track proposal reviews, budget utilization, and progress milestones.
        </p>
        <h3 className="text-xl font-bold text-charcoal pt-4 border-t border-gray-100">Lifecycle of a Grant</h3>
        <div className="relative border-l-2 border-wine/10 pl-6 space-y-8 ml-3">
          <div className="relative">
            <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-wine ring-4 ring-white" />
            <h4 className="font-bold text-charcoal text-sm">Proposal Drafting</h4>
            <p className="text-xs text-gray-500 mt-1">Submit budget breakdown, project goals, timeline milestones, and principal investigators (PIs).</p>
          </div>
          <div className="relative">
            <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-wine ring-4 ring-white" />
            <h4 className="font-bold text-charcoal text-sm">Internal Review Committee</h4>
            <p className="text-xs text-gray-500 mt-1">DRD and dean committees evaluate the proposal against strategic university priorities and feasibility metrics.</p>
          </div>
          <div className="relative">
            <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-wine ring-4 ring-white" />
            <h4 className="font-bold text-charcoal text-sm">Budget Sanction & Disbursement</h4>
            <p className="text-xs text-gray-500 mt-1">Finance teams verify external funding letters or authorize internal funds, making the budget active in the researcher's portal.</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'accreditation-reports',
    title: 'Accreditation & Analytics',
    icon: ShieldCheck,
    content: (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-charcoal font-serif">Accreditation & Analytics</h2>
        <p className="text-gray-600 leading-relaxed">
          ResearchSphere's reporting suite enables administrative leaders to generate institutional reports required by national and international accreditation bodies (e.g. NAAC, UGC, NIRF).
        </p>
        <h3 className="text-xl font-bold text-charcoal pt-4 border-t border-gray-100">Exportable Metrics</h3>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-wine" /> Total publications categorized by indexing type (Scopus, WoS, PubMed, Peer Reviewed)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-wine" /> H-index, i10-index, and citation count trends over custom timeframes
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-wine" /> Total grant funding received, utilized, and pending milestones
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-wine" /> Patents filed vs patents published and granted
          </li>
        </ul>
      </div>
    )
  }
];

export default function DocumentationPage() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeDoc = DOCS_SECTIONS.find(sec => sec.id === activeSection) || DOCS_SECTIONS[0];

  return (
    <div className="min-h-screen bg-ivory font-sans antialiased flex flex-col justify-between">
      <div>
        <PublicNav />

        {/* Header Spacer */}
        <div className="h-16 sm:h-20" />

        {/* Mobile Sidebar Toggle */}
        <div className="md:hidden bg-white border-b border-[#f0e2d2] px-6 py-3 flex items-center justify-between">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-wine"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            Menu
          </button>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{activeDoc.title}</span>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            
            {/* Sidebar Left */}
            <aside className={`md:block ${sidebarOpen ? 'block' : 'hidden'} col-span-1 space-y-1`}>
              <div className="sticky top-28 space-y-1">
                <p className="px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Guides & Docs</p>
                {DOCS_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => {
                        setActiveSection(section.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition-all ${
                        isActive 
                          ? 'bg-wine text-white shadow-md shadow-wine/20' 
                          : 'text-gray-600 hover:bg-blush hover:text-wine'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {section.title}
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Content Right */}
            <main className="col-span-3 bg-white border border-gray-100 rounded-3xl p-6 sm:p-10 shadow-sm min-h-[500px]">
              {activeDoc.content}
            </main>

          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-12 bg-white mt-16">
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
