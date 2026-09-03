'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Lightbulb, 
  Copyright as CopyrightIcon, 
  Palette, 
  Briefcase,
  BookOpen, 
  Presentation, 
  DollarSign,
  Plus, 
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Eye,
  UserCheck,
  Award,
  Coins,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { iprService } from '@/features/ipr-management/services/ipr.service';
import { researchService, ResearchContribution } from '@/features/research-management/services/research.service';
import { useAuthStore } from '@/shared/auth/authStore';
import { logger } from '@/shared/utils/logger';
import heroArtSrc from '@/assets/hero-art.jpg';

const IPR_TYPES = [
  { type: 'patent', label: 'Patent', icon: Lightbulb, color: 'bg-maroon-solid', description: 'Protect your inventions and novel ideas', href: '/ipr/apply?type=patent', bgType: 'maroon' },
  { type: 'copyright', label: 'Copyright', icon: CopyrightIcon, color: 'bg-gold-solid', description: 'Protect creative works and publications', href: '/ipr/apply?type=copyright', bgType: 'gold' },
  { type: 'design', label: 'Design', icon: Palette, color: 'bg-maroon-solid', description: 'Protect visual designs and aesthetics', href: '/ipr/apply?type=design', bgType: 'maroon' },
  { type: 'entrepreneurship', label: 'Entrepreneurship', icon: Briefcase, color: 'bg-gold-solid', description: 'Submit innovative business ideas and startups', href: '/ipr/apply?type=entrepreneurship', bgType: 'gold' },
];

const RESEARCH_TYPES = [
  { type: 'research_paper', label: 'Research Paper', icon: FileText, color: 'bg-maroon-solid', description: 'Submit new research paper for journal publication', href: '/research/apply?type=research_paper', bgType: 'maroon' },
  { type: 'book', label: 'Book / Chapter', icon: BookOpen, color: 'bg-gold-solid', description: 'Submit book or chapter publications', href: '/research/apply?type=book', bgType: 'gold' },
  { type: 'conference_paper', label: 'Conference Paper', icon: Presentation, color: 'bg-maroon-solid', description: 'Submit new conference paper publications', href: '/research/apply?type=conference_paper', bgType: 'maroon' },
  { type: 'grant_proposal', label: 'Grant Proposal', icon: DollarSign, color: 'bg-gold-solid', description: 'Apply for research grants & external funding', href: '/research/apply-grant', bgType: 'gold' },
];

const IPR_STATUS_CONFIG = {
  draft: { label: 'Draft', icon: Edit, color: 'text-gray-600 bg-gray-100 border border-gray-200' },
  pending_mentor_approval: { label: 'Pending Mentor', icon: UserCheck, color: 'text-orange-700 bg-orange-50 border border-orange-200' },
  submitted: { label: 'Submitted', icon: Clock, color: 'text-blue-700 bg-blue-50 border border-blue-200' },
  under_drd_review: { label: 'DRD Review', icon: Eye, color: 'text-yellow-800 bg-yellow-50 border border-yellow-200' },
  drd_approved: { label: 'DRD Approved', icon: CheckCircle, color: 'text-green-700 bg-green-50 border border-green-200' },
  under_dean_review: { label: 'Dean Review', icon: Eye, color: 'text-purple-700 bg-purple-50 border border-purple-200' },
  dean_approved: { label: 'Dean Approved', icon: CheckCircle, color: 'text-green-700 bg-green-50 border border-green-200' },
  published: { label: 'Published', icon: CheckCircle, color: 'text-indigo-700 bg-indigo-50 border border-indigo-200' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-700 bg-green-50 border border-green-200' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-700 bg-red-50 border border-red-200' },
};

const RESEARCH_STATUS_CONFIG = {
  draft: { label: 'Draft', icon: FileText, color: 'text-gray-600 bg-gray-100 border border-gray-200' },
  pending_mentor_approval: { label: 'Pending Mentor', icon: UserCheck, color: 'text-orange-700 bg-orange-50 border border-orange-200' },
  submitted: { label: 'Submitted', icon: Clock, color: 'text-blue-700 bg-blue-50 border border-blue-200' },
  under_review: { label: 'Under Review', icon: Clock, color: 'text-yellow-800 bg-yellow-50 border border-yellow-200' },
  changes_required: { label: 'Changes Required', icon: AlertCircle, color: 'text-orange-700 bg-orange-50 border border-orange-200' },
  resubmitted: { label: 'Resubmitted', icon: Clock, color: 'text-blue-700 bg-blue-50 border border-blue-200' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-700 bg-green-50 border border-green-200' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-700 bg-red-50 border border-red-200' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-indigo-700 bg-indigo-50 border border-indigo-200' },
};

export default function MyWorkDashboard() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'ipr' | 'research'>('ipr');
  const [iprApplications, setIprApplications] = useState<any[]>([]);
  const [researchContributions, setResearchContributions] = useState<ResearchContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHeroArt, setShowHeroArt] = useState(true);
  const [pendingMentorCount, setPendingMentorCount] = useState(0);
  
  const [iprStats, setIprStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    totalIncentives: 0,
    totalPoints: 0,
  });
  
  const [researchStats, setResearchStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    totalIncentives: 0,
    totalPoints: 0,
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      const iprData = await iprService.getMyApplications().catch(() => ({ data: [] }));
      const validIprApps = (iprData.data || iprData || []).filter((app: any) => app && app.id);
      setIprApplications(validIprApps);
      
      const [myContribRes, contributedRes] = await Promise.all([
        researchService.getMyContributions().catch(() => ({ success: false, data: { contributions: [] } })),
        researchService.getContributedResearch().catch(() => ({ success: false, data: [] }))
      ]);
      
      const myContributions = myContribRes?.data?.contributions || myContribRes?.data?.myContributions || myContribRes?.data || [];
      const contributed = contributedRes?.data?.contributions || contributedRes?.data || [];
      
      setResearchContributions(Array.isArray(myContributions) ? myContributions : []);
      
      try {
        const mentorData = await iprService.getPendingMentorApprovals();
        setPendingMentorCount(mentorData?.length || 0);
      } catch (error) {
        // Not a mentor
      }
      
      const iprCompletedStatuses = ['drd_approved', 'dean_approved', 'published', 'completed'];
      const iprCompletedApps = validIprApps.filter((app: any) => iprCompletedStatuses.includes(app.status));
      
      setIprStats({
        total: validIprApps.length,
        pending: validIprApps.filter((app: any) => 
          ['submitted', 'under_drd_review', 'under_dean_review', 'pending_mentor_approval'].includes(app.status)
        ).length,
        approved: iprCompletedApps.length,
        totalIncentives: iprCompletedApps.reduce((sum: number, app: any) => sum + (Number(app.incentiveAmount) || 0), 0),
        totalPoints: iprCompletedApps.reduce((sum: number, app: any) => sum + (Number(app.pointsAwarded) || 0), 0),
      });
      
      const allContribs = [...myContributions, ...contributed.filter(
        (c: ResearchContribution) => !myContributions.some((m: ResearchContribution) => m.id === c.id)
      )];
      
      const researchCompletedStatuses = ['approved', 'completed'];
      const researchCompletedContribs = allContribs.filter((c: ResearchContribution) => 
        researchCompletedStatuses.includes(c.status)
      );
      
      setResearchStats({
        total: myContributions.length,
        pending: myContributions.filter((c: ResearchContribution) => 
          ['submitted', 'under_review', 'resubmitted', 'changes_required', 'pending_mentor_approval'].includes(c.status)
        ).length,
        approved: myContributions.filter((c: ResearchContribution) => 
          researchCompletedStatuses.includes(c.status)
        ).length,
        totalIncentives: researchCompletedContribs.reduce((sum: number, c: ResearchContribution) => 
          sum + (Number(c.incentiveAmount) || 0), 0
        ),
        totalPoints: researchCompletedContribs.reduce((sum: number, c: ResearchContribution) => 
          sum + (Number(c.pointsAwarded) || 0), 0
        ),
      });
      
    } catch (error) {
      logger.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredIprApplications = iprApplications.filter(app => 
    app.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredResearchContributions = researchContributions.filter(contrib => 
    contrib.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contrib.journalName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getIprStatusInfo = (status: string) => {
    return IPR_STATUS_CONFIG[status as keyof typeof IPR_STATUS_CONFIG] || IPR_STATUS_CONFIG.draft;
  };

  const getResearchStatusInfo = (status: string) => {
    return RESEARCH_STATUS_CONFIG[status as keyof typeof RESEARCH_STATUS_CONFIG] || RESEARCH_STATUS_CONFIG.draft;
  };

  const combinedStats = {
    total: iprStats.total + researchStats.total,
    pending: iprStats.pending + researchStats.pending,
    approved: iprStats.approved + researchStats.approved,
    totalIncentives: iprStats.totalIncentives + researchStats.totalIncentives,
    totalPoints: iprStats.totalPoints + researchStats.totalPoints,
  };

  const CSS = `:root{--maroon:#7d1a34;--maroon-dark:#5e1024;--gold:#c8973f;--page-bg:#fdf5ec;--card-bg:#ffffff;--border:#f0e2d2;--text-dark:#2b1d22;--text-gray:#7a7178;--text-gray-light:#9a9198;}.work-body *{box-sizing:border-box;}.work-body{background:var(--page-bg);color:var(--text-dark);font-family:Arial,Helvetica,sans-serif;min-height:100vh;}.work-main{max-width:1220px;margin:0 auto;padding:32px 32px 60px;}.hero-banner{position:relative;background:linear-gradient(to right, #fbeee0 0%, #fdf7ee 50%, #fdf7ee 100%);border-radius:18px;padding:40px 44px;min-height:190px;overflow:hidden;margin-bottom:26px;border:1px solid var(--border);}.hero-banner h1{font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:700;color:#1f1418;margin-bottom:14px;}.hero-underline{width:52px;height:4px;border-radius:2px;background:linear-gradient(95deg,var(--maroon),var(--gold));margin-bottom:16px;}.hero-banner p{color:var(--text-gray);font-size:14.5px;}.hero-art{position:absolute;right:0;top:0;bottom:0;width:420px;}.stats-row{display:grid;grid-template-columns:repeat(5,1fr);gap:18px;margin-bottom:24px;}.stat-card{background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:22px 20px;display:flex;align-items:center;gap:14px;box-shadow:0 4px 12px rgba(125,26,52,0.02);}.stat-icon{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}.stat-icon svg{width:22px;height:22px;}.bg-rose{background:#fbe2e8;}.bg-amber{background:#fbecd2;}.bg-mint{background:#dff5e6;}.bg-lav{background:#ece2fa;}.stat-label{font-size:13px;color:var(--text-gray);margin-bottom:6px;}.stat-value{font-size:25px;font-weight:700;line-height:1;}.c-maroon{color:var(--maroon);}.c-gold{color:#cc9427;}.c-green{color:#28a24d;}.c-purple{color:#8a4fd4;}.panel{background:var(--card-bg);border:1px solid var(--border);border-radius:18px;padding:28px 30px 34px;box-shadow:0 10px 30px rgba(125,26,52,0.02);}.tabs{display:flex;gap:36px;border-bottom:1px solid var(--border);margin-bottom:24px;}.tab{display:flex;align-items:center;gap:9px;padding-bottom:16px;font-size:14.5px;font-weight:600;color:var(--text-gray-light);cursor:pointer;position:relative;border:none;background:transparent;}.tab svg{width:17px;height:17px;}.tab.active{color:var(--maroon);}.tab.active::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2.5px;background:var(--maroon);}.tab .count{font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:10px;background:#f1e9ec;color:var(--text-gray);}.tab.active .count{background:#fbe2e8;color:var(--maroon);}.search-row{display:flex;gap:12px;margin-bottom:32px;}.search-box{flex:1;display:flex;align-items:center;gap:10px;border:1px solid var(--border);border-radius:12px;padding:13px 18px;color:var(--text-dark);font-size:14px;}.search-box input{border:none;outline:none;width:100%;font-size:14px;color:var(--text-dark);background:transparent;}.search-box input::placeholder{color:#b0a5ab;}.search-box svg{width:17px;height:17px;flex-shrink:0;}.filter-btn{width:48px;border:1px solid var(--border);border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--text-gray);background:transparent;cursor:pointer;}.panel h3{font-size:17.5px;font-weight:700;margin-bottom:18px;color:var(--text-dark);}.cards-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;}.ipr-card{position:relative;border:1px solid var(--border);border-radius:16px;padding:24px 22px 22px;overflow:hidden;min-height:190px;background:var(--card-bg);transition:all 0.2s ease-in-out;cursor:pointer;text-decoration:none;color:inherit;}.ipr-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(125,26,52,0.06);border-color:var(--maroon);}.ipr-badge{width:50px;height:50px;border-radius:13px;display:flex;align-items:center;justify-content:center;margin-bottom:18px;position:relative;z-index:1;}.ipr-badge svg{width:24px;height:24px;}.bg-maroon-solid{background:var(--maroon);}.bg-gold-solid{background:var(--gold);}.ipr-card h4{font-size:16.5px;font-weight:700;margin-bottom:8px;position:relative;z-index:1;}.ipr-card p{font-size:12.8px;color:var(--text-gray);line-height:1.5;margin-bottom:22px;max-width:75%;position:relative;z-index:1;}.ipr-go{width:34px;height:34px;border-radius:50%;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--maroon);position:relative;z-index:1;background:var(--card-bg);}.ipr-go svg{width:14px;height:14px;}.ipr-watermark{position:absolute;right:-8px;bottom:-6px;opacity:0.5;z-index:0;}.list-section{margin-top:40px;border-top:1px dashed var(--border);padding-top:32px;}.list-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;}.list-header h3{font-size:18px;font-weight:700;color:var(--text-dark);}.view-all-link{color:var(--maroon);font-size:14px;font-weight:600;text-decoration:none;}.item-card{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border:1px solid var(--border);border-radius:12px;background:var(--card-bg);margin-bottom:12px;transition:border-color 0.15s;text-decoration:none;color:inherit;}.item-card:hover{border-color:var(--maroon);}.item-left{display:flex;align-items:center;gap:16px;}.item-icon-wrap{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}.item-details h4{font-size:15px;font-weight:700;color:var(--text-dark);margin-bottom:4px;}.item-details p{font-size:12.5px;color:var(--text-gray);}.item-meta{display:flex;align-items:center;gap:16px;font-size:12px;color:var(--text-gray-light);margin-top:6px;}.item-meta span{display:flex;align-items:center;gap:4px;}.status-badge{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px;}`;

  const watermarks = {
    patent: (
      <svg className="ipr-watermark" width="90" height="90" viewBox="0 0 90 90">
        <rect x="18" y="6" width="54" height="72" rx="3" fill="none" stroke="#e9d9c4" strokeWidth="2"/>
        <line x1="26" y1="22" x2="64" y2="22" stroke="#e9d9c4" strokeWidth="2"/>
        <line x1="26" y1="32" x2="64" y2="32" stroke="#e9d9c4" strokeWidth="2"/>
        <line x1="26" y1="42" x2="50" y2="42" stroke="#e9d9c4" strokeWidth="2"/>
        <circle cx="60" cy="62" r="12" fill="none" stroke="#e9d9c4" strokeWidth="2"/>
      </svg>
    ),
    copyright: (
      <svg className="ipr-watermark" width="90" height="90" viewBox="0 0 90 90">
        <circle cx="55" cy="45" r="34" fill="none" stroke="#f2e6cd" strokeWidth="2"/>
        <text x="55" y="55" fontSize="34" textAnchor="middle" fill="#f2e6cd" fontFamily="Georgia,serif">©</text>
      </svg>
    ),
    design: (
      <svg className="ipr-watermark" width="90" height="90" viewBox="0 0 90 90">
        <circle cx="35" cy="65" r="4" fill="none" stroke="#e9d9c4" strokeWidth="2"/>
        <circle cx="65" cy="20" r="4" fill="none" stroke="#e9d9c4" strokeWidth="2"/>
        <line x1="38" y1="62" x2="62" y2="23" stroke="#e9d9c4" strokeWidth="2"/>
        <line x1="20" y1="75" x2="70" y2="75" stroke="#e9d9c4" strokeWidth="2"/>
      </svg>
    ),
    entrepreneurship: (
      <svg className="ipr-watermark" width="90" height="90" viewBox="0 0 90 90">
        <path d="M50,75 C40,65 38,50 48,30 C58,50 56,65 50,75 Z" fill="none" stroke="#f2e6cd" strokeWidth="2"/>
        <circle cx="49" cy="42" r="4" fill="none" stroke="#f2e6cd" strokeWidth="2"/>
        <path d="M42,68 L36,80 M56,68 L62,80" stroke="#f2e6cd" strokeWidth="2"/>
      </svg>
    ),
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="work-body">
        <main className="work-main">
          
          {/* Hero Banner */}
          <div className="hero-banner">
            <div>
              <h1>My Research &amp; IPR Work</h1>
              <div className="hero-underline"></div>
              <p>Manage your intellectual property and research contributions</p>
            </div>
            {showHeroArt ? (
              <img
                src={typeof heroArtSrc === 'string' ? heroArtSrc : heroArtSrc.src}
                alt=""
                aria-hidden
                className="hero-art"
                style={{ height: '100%', objectFit: 'contain', objectPosition: 'right' }}
                onError={() => setShowHeroArt(false)}
              />
            ) : null}
          </div>

          {/* Stats Row */}
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-icon bg-rose">
                <svg viewBox="0 0 24 24" fill="none" stroke="#7d1a34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              </span>
              <div>
                <div className="stat-label">Total Submissions</div>
                <div className="stat-value c-maroon">{combinedStats.total}</div>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon bg-amber">
                <svg viewBox="0 0 24 24" fill="none" stroke="#cc9427" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
              </span>
              <div>
                <div className="stat-label">Pending Review</div>
                <div className="stat-value c-gold">{combinedStats.pending}</div>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon bg-mint">
                <svg viewBox="0 0 24 24" fill="none" stroke="#28a24d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9"/></svg>
              </span>
              <div>
                <div className="stat-label">Approved</div>
                <div className="stat-value c-green">{combinedStats.approved}</div>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon bg-mint">
                <svg viewBox="0 0 24 24" fill="none" stroke="#28a24d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12M6 8h12M9 3v5c0 3 3 4 3 7s-3 4-3 7M15 3v5c0 3-3 4-3 7"/></svg>
              </span>
              <div>
                <div className="stat-label">Total Incentives</div>
                <div className="stat-value c-green">₹{combinedStats.totalIncentives.toLocaleString('en-IN')}</div>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon bg-lav">
                <svg viewBox="0 0 24 24" fill="none" stroke="#8a4fd4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5L7 21l5-3 5 3-1.5-8.5"/></svg>
              </span>
              <div>
                <div className="stat-label">Total Points</div>
                <div className="stat-value c-purple">{combinedStats.totalPoints}</div>
              </div>
            </div>
          </div>

          {/* Panel */}
          <div className="panel">
            {/* Tabs */}
            <div className="tabs">
              <button
                onClick={() => { setActiveTab('ipr'); setSearchQuery(''); }}
                className={`tab ${activeTab === 'ipr' ? 'active' : ''}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>
                IPR Applications <span className="count">{iprStats.total}</span>
              </button>
              <button
                onClick={() => { setActiveTab('research'); setSearchQuery(''); }}
                className={`tab ${activeTab === 'research' ? 'active' : ''}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></svg>
                Research Contributions <span className="count">{researchStats.total}</span>
              </button>
            </div>

            {/* Search Row */}
            <div className="search-row">
              <div className="search-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="#b0a5ab" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text"
                  placeholder={activeTab === 'ipr' ? 'Search IPR applications...' : 'Search research contributions...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="filter-btn">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="11" cy="18" r="2" fill="currentColor" stroke="none"/></svg>
              </button>
            </div>

            {/* Tab Specific Content */}
            {activeTab === 'ipr' ? (
              <div>
                <h3>Create New IPR Application</h3>
                <div className="cards-grid">
                  {IPR_TYPES.map((iprType, idx) => {
                    const Icon = iprType.icon;
                    const wKey = iprType.type === 'patent' ? 'patent' : (iprType.type === 'copyright' ? 'copyright' : (iprType.type === 'design' ? 'design' : 'entrepreneurship'));
                    return (
                      <Link
                        key={iprType.type}
                        href={iprType.href}
                        className="ipr-card"
                      >
                        <span className={`ipr-badge ${iprType.color}`}>
                          <Icon className="w-5 h-5 text-white" />
                        </span>
                        <h4>{iprType.label}</h4>
                        <p>{iprType.description}</p>
                        <span className="ipr-go">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                        {watermarks[wKey]}
                      </Link>
                    );
                  })}
                </div>

                {/* IPR Applications List */}
                <div className="list-section">
                  <div className="list-header">
                    <h3>My IPR Applications</h3>
                    <Link href="/ipr/my-applications" className="view-all-link">
                      View All →
                    </Link>
                  </div>

                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wine mx-auto"></div>
                      <p className="text-xs text-gray-500 mt-3">Loading applications...</p>
                    </div>
                  ) : filteredIprApplications.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-sm text-gray-500">No IPR Applications Found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredIprApplications.slice(0, 5).map((app: any) => {
                        const statusInfo = getIprStatusInfo(app.status);
                        const StatusIcon = statusInfo.icon;
                        const typeInfo = IPR_TYPES.find(t => t.type === app.iprType);
                        const TypeIcon = typeInfo?.icon || Lightbulb;
                        const iconBg = typeInfo?.bgType === 'gold' ? 'bg-[#c8973f]' : 'bg-[#7d1a34]';
                        
                        return (
                          <Link
                            key={app.id}
                            href={`/ipr/applications/${app.id}`}
                            className="item-card"
                          >
                            <div className="item-left">
                              <div className={`item-icon-wrap ${iconBg} text-white`}>
                                <TypeIcon className="w-5 h-5" />
                              </div>
                              <div className="item-details">
                                <h4>{app.title}</h4>
                                <div className="item-meta">
                                  <span>
                                    <Calendar className="w-3 h-3" />
                                    {new Date(app.createdAt).toLocaleDateString()}
                                  </span>
                                  {app.applicationNumber && (
                                    <span className="font-mono">{app.applicationNumber}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className={`status-badge ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusInfo.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h3>Create New Research Contribution</h3>
                <div className="cards-grid">
                  {RESEARCH_TYPES.map((resType, idx) => {
                    const Icon = resType.icon;
                    const wKey = resType.type === 'research_paper' ? 'patent' : (resType.type === 'book' ? 'copyright' : (resType.type === 'conference_paper' ? 'design' : 'entrepreneurship'));
                    return (
                      <Link
                        key={resType.type}
                        href={resType.href}
                        className="ipr-card"
                      >
                        <span className={`ipr-badge ${resType.color}`}>
                          <Icon className="w-5 h-5 text-white" />
                        </span>
                        <h4>{resType.label}</h4>
                        <p>{resType.description}</p>
                        <span className="ipr-go">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                        {watermarks[wKey]}
                      </Link>
                    );
                  })}
                </div>

                {/* Research Contributions List */}
                <div className="list-section">
                  <div className="list-header">
                    <h3>My Research Contributions</h3>
                    <Link href="/research/my-contributions" className="view-all-link">
                      View All →
                    </Link>
                  </div>

                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wine mx-auto"></div>
                      <p className="text-xs text-gray-500 mt-3">Loading contributions...</p>
                    </div>
                  ) : filteredResearchContributions.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-sm text-gray-500">No Research Contributions Found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredResearchContributions.slice(0, 5).map((contrib: ResearchContribution) => {
                        const statusInfo = getResearchStatusInfo(contrib.status);
                        const StatusIcon = statusInfo.icon;
                        const typeInfo = RESEARCH_TYPES.find(t => t.type === contrib.publicationType);
                        const TypeIcon = typeInfo?.icon || FileText;
                        const iconBg = typeInfo?.bgType === 'gold' ? 'bg-[#c8973f]' : 'bg-[#7d1a34]';
                        
                        return (
                          <Link
                            key={contrib.id}
                            href={`/research/contribution/${contrib.id}`}
                            className="item-card"
                          >
                            <div className="item-left">
                              <div className={`item-icon-wrap ${iconBg} text-white`}>
                                <TypeIcon className="w-5 h-5" />
                              </div>
                              <div className="item-details">
                                <h4>{contrib.title}</h4>
                                <div className="item-meta">
                                  <span>
                                    <Calendar className="w-3 h-3" />
                                    {new Date(contrib.createdAt).toLocaleDateString()}
                                  </span>
                                  {contrib.applicationNumber && (
                                    <span className="font-mono">{contrib.applicationNumber}</span>
                                  )}
                                  {contrib.status === 'completed' && (
                                    <span className="flex items-center gap-1 text-green-700">
                                      <Coins className="w-3 h-3" />
                                      ₹{Number(contrib.incentiveAmount || 0).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className={`status-badge ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusInfo.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  );
}
