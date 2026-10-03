'use client';

import React, { useEffect, useState } from 'react';
import { integerAxis } from '@/shared/utils/chartScale';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import PublicationListDirect from '@/features/research-profile/components/PublicationList';
import {
  Mail,
  Building2, 
  GraduationCap,
  Settings,
  FileText,
  TrendingUp,
  Users,
  Award,
  Download,
  Bookmark,
  Filter,
  List,
  Grid3X3,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  BookOpen,
  Quote,
  Star,
  Layers3,
  Network,
  BarChart3,
  Search,
  AlertCircle,
  Calendar,
  Eye,
  Globe2,
  Lock,
  Copy,
  Check,
  Phone,
} from 'lucide-react';
import type { ProfileData, Publication, CoAuthor } from '@/shared/types/research-profile.types';
import { useAuthStore } from '@/shared/auth/authStore';
import logger from '@/shared/utils/logger';
import { 
  drdAnalyticsService,
  type DrdAnalyticsResponse,
  type PersonSubmissionsResponse,
  type ApplicantPersonTrackerWorks,
} from '@/features/ipr-management/services/drdAnalytics.service';
import {
  researchProfileService,
  viewToProfileData,
  profileAccessCodeOf,
  type AuthorProfileView,
  type ProfileAccessCode,
} from '@/features/research-profile/services/researchProfile.service';
import heroArtSrc from '@/assets/hero-art.jpg';

const PublicationList = PublicationListDirect;

const CollaborationNetworkTab = dynamic(
  () => import('@/features/research-profile/components/CollaborationNetworkTab'),
  {
    ssr: false,
    loading: () => <div className="h-[720px] bg-blush rounded-xl animate-pulse border border-blush-line" />,
  }
);

const ComprehensiveAnalyticsTab = dynamic(
  () => import('@/features/research-profile/components/ComprehensiveAnalyticsTab'),
  {
    ssr: false,
    loading: () => <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />,
  }
);

// Metrics Panel & Trend Chart
const CitationMetricsPanel = dynamic(
  () => import('@/features/research-profile/components/CitationMetricsPanel'),
  { ssr: false }
);
const CitationTrendChart = dynamic(
  () => import('@/features/research-profile/components/CitationTrendChart'),
  { ssr: false }
);

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.userId as string;
  const { user } = useAuthStore();
  
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [drdAnalyticsData, setDrdAnalyticsData] = useState<DrdAnalyticsResponse | null>(null);
  const [submissionsData, setSubmissionsData] = useState<PersonSubmissionsResponse | null>(null);
  const [trackerWorks, setTrackerWorks] = useState<ApplicantPersonTrackerWorks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<AuthorProfileView | null>(null);
  const [deniedCode, setDeniedCode] = useState<ProfileAccessCode | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'overview' | 'publications' | 'collaborations' | 'metrics' | 'analytics'>('overview');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBannerArt, setShowBannerArt] = useState(true);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  const fetchProfile = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);
      setDeniedCode(null);

      // The server applies the author's privacy settings: hidden sections arrive empty,
      // and a profile this viewer may not open is rejected with a PROFILE_* code.
      const profileView = await researchProfileService.getProfileView(userId);
      setView(profileView);
      setProfileData(viewToProfileData(profileView));

      // DRD reports are an extra for viewers who hold applicant-analytics access (or the author).
      const [analyticsResponse, submissionsResponse] = await Promise.all([
        drdAnalyticsService.getApplicantPersonAnalytics(userId, undefined, { optional: true }).catch(() => null),
        drdAnalyticsService.getApplicantPersonSubmissions(userId, undefined, { optional: true }).catch(() => null),
      ]);
      if (analyticsResponse?.data) {
        setDrdAnalyticsData(analyticsResponse.data);
        setSubmissionsData(submissionsResponse?.data || null);
        setTrackerWorks((analyticsResponse.data.extensions?.trackerWorks as ApplicantPersonTrackerWorks | undefined) || null);
      } else {
        setDrdAnalyticsData(null);
        setSubmissionsData(null);
        setTrackerWorks(null);
      }
    } catch (err) {
      const code = profileAccessCodeOf(err);
      if (code) {
        setDeniedCode(code);
      } else {
        logger.error('Error fetching profile:', err);
        setError('Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blush">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-wine mx-auto"></div>
          <p className="text-sm text-gray-500 mt-4">Loading research profile...</p>
        </div>
      </div>
    );
  }

  if (deniedCode) {
    const copy = {
      PROFILE_PRIVATE: { title: 'This profile is private', body: 'The author has chosen to keep their research profile private.' },
      PROFILE_INSTITUTION_ONLY: { title: 'Visible to university members only', body: 'The author shares this profile with members of their own university.' },
      PROFILE_NOT_FOUND: { title: 'Profile not found', body: 'There is no research profile at this address.' },
    }[deniedCode];
    return (
      <div className="min-h-screen flex items-center justify-center bg-blush dark:bg-gray-900 px-4">
        <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-xl border border-blush-line dark:border-gray-700 shadow-sm max-w-md mx-auto">
          <div className="w-12 h-12 bg-wine/10 text-wine rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{copy.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{copy.body}</p>
          <button onClick={() => router.push('/research')} className="px-5 py-2.5 bg-wine text-wine-fg rounded-lg font-semibold hover:bg-wine-dark transition-colors">
            Back to Research
          </button>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blush">
        <div className="text-center bg-white p-8 rounded-xl border border-blush-line shadow-sm max-w-md mx-auto">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{error || 'Profile not found'}</h3>
          <p className="text-sm text-gray-500 mb-6">We could not retrieve the researcher profile. Please try again later.</p>
          <button onClick={() => router.push('/research')} className="px-5 py-2.5 bg-wine text-wine-fg rounded-lg font-semibold hover:bg-wine-dark transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const name = profileData.user.name;
  const email = profileData.user.email;
  const phone = view?.user.phone || null;
  const designation = profileData.user.designation;
  const department = profileData.user.department;
  const school = profileData.user.school;
  const sections = view?.sections || { photo: true, email: true, phone: true, researchInterests: true, publications: true, coAuthors: true, metrics: true };
  const canEdit = Boolean(view?.access.isOwner);
  const visibility = view?.visibility || 'institution';
  const publicPath = view?.settings?.publicPath || null;
  const VISIBILITY_BADGE = {
    public: { label: 'Public profile', icon: <Globe2 className="w-3.5 h-3.5" /> },
    institution: { label: 'University only', icon: <Building2 className="w-3.5 h-3.5" /> },
    private: { label: 'Private', icon: <Lock className="w-3.5 h-3.5" /> },
  }[visibility];
  const copyPublicLink = async () => {
    if (!publicPath) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.open(publicPath, '_blank', 'noopener');
    }
  };

  const citations = profileData.profile.metrics.totalCitations || 0;
  const hIndex = profileData.profile.metrics.hIndex || 0;
  const publicationsCount = profileData.publications.length || 0;
  const collaboratorsCount = profileData.coAuthors.length || 0;

  const bio = profileData.profile.bio;
  const researchInterests = profileData.profile.researchInterests;
  const interestsDerived = view?.profile.researchInterestsSource === 'derived';
  const visibleTabs = {
    publications: sections.publications,
    collaborations: sections.coAuthors,
    metrics: sections.metrics,
    analytics: Boolean(drdAnalyticsData),
  };
  const currentTab = activeTab !== 'overview' && !visibleTabs[activeTab] ? 'overview' : activeTab;

  const citationHistory = profileData.profile.metrics.citationsPerYear;

  const featuredPub = profileData.publications.reduce(
    (max, pub) => (pub.citationCount > max.citationCount ? pub : max),
    profileData.publications[0] || null
  );

  // Filter publications based on current filters and search queries
  // Search and type narrow the list; PublicationList itself handles year filter and sort.
  const filteredPublications = profileData.publications
    .filter(pub => selectedType === 'all' || pub.publicationType === selectedType)
    .filter(pub => searchQuery === '' || pub.title.toLowerCase().includes(searchQuery.toLowerCase()) || pub.venue.toLowerCase().includes(searchQuery.toLowerCase()));

  const publicationTypes = Array.from(new Set(profileData.publications.map(p => p.publicationType)));

  // Dynamic bar-chart heights
  const maxCitationInHistory = citationHistory.length > 0 ? Math.max(...citationHistory.map(c => c.count), 1) : 1;
  const citationAxis = integerAxis(maxCitationInHistory);

  // Custom CSS block
  const CSS = `:root{--maroon:rgb(var(--brand-primary));--maroon-dark:rgb(var(--brand-primary-dark));--gold:rgb(var(--brand-gold));--page-bg:rgb(var(--brand-canvas));--card-bg:#ffffff;--border:rgb(var(--brand-line));--text-dark:rgb(var(--brand-ink));--text-gray:rgb(var(--brand-ink-muted));--text-gray-light:rgb(var(--brand-ink-subtle));}.profile-body *{box-sizing:border-box;}.profile-body{background:var(--page-bg);color:var(--text-dark);font-family:Arial,Helvetica,sans-serif;min-height:100vh;}.profile-main{max-width:1600px;margin:0 auto;padding:30px 40px 60px;position:relative;}.profile-banner{position:relative;background:linear-gradient(to right, rgb(var(--brand-gold-50)) 0%, rgb(var(--brand-canvas-light)) 50%, rgb(var(--brand-canvas-light)) 100%);border-radius:18px;padding:36px 40px;overflow:hidden;margin-bottom:24px;display:flex;align-items:center;gap:34px;border:1px solid var(--border);}.avatar-lg{width:135px;height:135px;border-radius:50%;background:var(--maroon-dark);border:4px solid #fff;box-shadow:0 0 0 2px var(--gold);display:flex;align-items:center;justify-content:center;color:#fff;font-size:56px;font-weight:700;font-family:Georgia,serif;flex-shrink:0;position:relative;z-index:1;}.status-dot{position:absolute;bottom:6px;right:6px;width:18px;height:18px;background:#2ecc71;border:3px solid #fff;border-radius:50%;}.profile-info{position:relative;z-index:1;flex-shrink:0;}.profile-info h2{font-family:Georgia,serif;font-size:30px;margin-bottom:8px;color:var(--text-dark);}.profile-role{display:flex;align-items:center;gap:8px;color:var(--maroon);font-weight:700;font-size:15px;margin-bottom:4px;}.profile-role svg{width:17px;height:17px;}.profile-dept{color:var(--text-gray);font-size:14px;margin-bottom:14px;}.profile-tags{display:flex;gap:10px;margin-bottom:14px;}.tag{display:flex;align-items:center;gap:6px;border:1px solid var(--border);background:#fff;border-radius:8px;padding:7px 12px;font-size:12.5px;font-weight:600;color:var(--text-dark);}.tag svg{width:14px;height:14px;}.tag.gold{color:rgb(var(--brand-gold));}.profile-email{display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--text-gray);}.profile-email svg{width:15px;height:15px;color:var(--gold);}.banner-art{position:absolute;right:0;top:0;bottom:0;width:480px;height:100%;object-fit:contain;object-position:right center;pointer-events:none;}.banner-actions{position:absolute;top:36px;right:40px;display:flex;gap:10px;z-index:2;}.btn-outline{background:#fff;border:1px solid var(--border);border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px;color:var(--text-dark);cursor:pointer;}.btn-solid{background:var(--maroon-dark);color:#fff;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px;cursor:pointer;border:none;}.btn-outline svg,.btn-solid svg{width:14px;height:14px;}.stats-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-bottom:24px;}.stat-card{background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:20px 22px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 4px 12px rgba(125,26,52,0.02);}.stat-left{display:flex;align-items:center;gap:14px;}.stat-icon{width:48px;height:48px;border-radius:12px;background:rgb(var(--brand-gold-50));display:flex;align-items:center;justify-content:center;flex-shrink:0;}.stat-icon svg{width:22px;height:22px;color:var(--gold);}.stat-value{font-size:26px;font-weight:800;color:var(--maroon);line-height:1;}.stat-value.gold{color:rgb(var(--brand-gold));}.stat-label{font-size:11.5px;font-weight:700;letter-spacing:0.5px;color:var(--text-gray);margin-top:4px;}.sparkline{width:80px;height:34px;}.tabs-bar{display:flex;gap:8px 22px;border-bottom:1px solid var(--border);margin-bottom:26px;flex-wrap:wrap;overflow:visible;position:relative;z-index:20;background:var(--page-bg);padding:6px 2px 0;}.tabs-bar::-webkit-scrollbar{display:none;width:0;height:0;}.ptab{display:flex;align-items:center;gap:8px;padding:0 6px 16px;font-size:14px;font-weight:600;color:var(--text-gray-light);cursor:pointer;position:relative;background:transparent;border:none;flex-shrink:0;white-space:nowrap;}.ptab svg{width:17px;height:17px;flex-shrink:0;}.ptab.active{color:var(--maroon);}.ptab.active::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2.5px;background:var(--maroon);}.content-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-bottom:22px;}.card{background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:26px 28px;box-shadow:0 10px 30px rgba(125,26,52,0.02);}.card h3{font-size:16.5px;font-weight:700;margin-bottom:14px;position:relative;padding-bottom:10px;color:var(--text-dark);}.card h3::after{content:"";position:absolute;left:0;bottom:0;width:34px;height:3px;background:var(--gold);}.chart-head h3::after{display:none;}.card p{font-size:13.5px;color:var(--text-gray);line-height:1.6;}.pill-grid{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px;}.pill{display:flex;align-items:center;gap:8px;border:1px solid var(--border);background:rgb(var(--brand-canvas-light));border-radius:9px;padding:9px 14px;font-size:13px;font-weight:600;color:var(--text-dark);}.pill svg{width:15px;height:15px;color:var(--maroon);}.featured-pub{display:flex;gap:16px;align-items:flex-start;}.pub-icon{width:56px;height:56px;border-radius:12px;background:rgb(var(--brand-gold-50));display:flex;align-items:center;justify-content:center;flex-shrink:0;}.pub-icon svg{width:24px;height:24px;color:var(--gold);}.pub-title{color:var(--maroon);font-weight:700;font-size:15px;line-height:1.4;margin-bottom:8px;}.pub-meta{font-size:12.5px;color:var(--text-gray);margin-bottom:10px;}.pub-cites{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-gray);font-weight:600;}.pub-cites svg{width:14px;height:14px;color:var(--gold);}.chart-card{grid-column:span 1;}.chart-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;}.yearly-btn{display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:8px;padding:7px 12px;font-size:12.5px;font-weight:600;color:var(--text-dark);}.yearly-btn svg{width:14px;height:14px;}.bar-chart{display:flex;align-items:flex-end;gap:14px;height:230px;padding-left:34px;position:relative;}.y-axis{position:absolute;left:0;top:0;bottom:24px;display:flex;flex-direction:column;justify-content:space-between;font-size:11px;color:var(--text-gray-light);}.bars{display:flex;align-items:flex-end;gap:16px;flex:1;height:100%;padding-bottom:24px;border-left:1px solid var(--border);padding-left:16px;}.bar-col{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;height:100%;justify-content:flex-end;}.bar{width:100%;max-width:34px;background:linear-gradient(180deg,var(--maroon) 0%,var(--maroon-dark) 100%);border-radius:4px 4px 0 0;}.bar-col span{font-size:11px;color:var(--text-gray-light);}.fab-stack{position:fixed;right:24px;bottom:2rem;top:auto;transform:none;display:flex;flex-direction:column;gap:14px;z-index:30;}.fab{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 8px 18px rgba(0,0,0,0.18);border:none;cursor:pointer;transition:transform 0.2s;}.fab:hover{transform:scale(1.1);}.fab svg{width:19px;height:19px;}.fab-maroon{background:var(--maroon-dark);}.fab-gold{background:var(--gold);}@media (max-width:1100px){.stats-row{grid-template-columns:repeat(2,minmax(0,1fr));}}@media (max-width:900px){.profile-main{padding:20px 16px 48px;}.profile-banner{flex-direction:column;align-items:flex-start;padding:24px 20px;}.banner-art{width:min(100%,320px);height:auto;max-height:160px;position:relative;margin-top:8px;align-self:flex-end;}.banner-actions{position:static;margin-top:16px;width:100%;flex-wrap:wrap;}.content-grid{grid-template-columns:1fr;}.ptab{font-size:13px;}}@media (max-width:520px){.stats-row{grid-template-columns:1fr;}}`;

  return (
    <>
      <style>{CSS}</style>
      <div className="profile-body">
        <main className="profile-main">

          {/* Profile Banner */}
          <div className="profile-banner">
            <div className="avatar-lg" style={profileData.user.photo ? { overflow: 'hidden' } : undefined}>
              {profileData.user.photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- authenticated /uploads route, not optimisable
                <img src={profileData.user.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                name.charAt(0)
              )}
              <span className="status-dot"></span>
            </div>
            
            <div className="profile-info">
              <h2>{name}</h2>
              {designation && (
                <div className="profile-role">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
                  {designation}
                </div>
              )}
              {view?.user.university && <div className="profile-dept">{view.user.university}</div>}
              <div className="profile-tags">
                {department && (
                  <span className="tag">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="13" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    {department}
                  </span>
                )}
                {school && (
                  <span className="tag">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg>
                    {school}
                  </span>
                )}
                {canEdit && (
                  <span className="tag gold" title="Who can see this profile. Change it under Manage Profile.">
                    {VISIBILITY_BADGE.icon}
                    {VISIBILITY_BADGE.label}
                  </span>
                )}
              </div>
              {sections.email && email && (
                <a className="profile-email" href={`mailto:${email}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 6 10-6"/></svg>
                  {email}
                </a>
              )}
              {sections.phone && phone && (
                <a className="profile-email" href={`tel:${phone}`} style={{ marginTop: 6 }}>
                  <Phone className="w-[15px] h-[15px] text-gold" />
                  {phone}
                </a>
              )}
            </div>

            {showBannerArt ? (
              <img
                className="banner-art"
                src={typeof heroArtSrc === 'string' ? heroArtSrc : heroArtSrc.src}
                alt=""
                aria-hidden
                onError={() => setShowBannerArt(false)}
              />
            ) : null}

            <div className="banner-actions">
              <button onClick={() => router.push('/research')} className="btn-outline">
                <ArrowLeft className="w-4 h-4" />
                Back to Research
              </button>
              {canEdit && publicPath && (
                <button onClick={copyPublicLink} className="btn-outline" title="Copy your public profile link">
                  {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {linkCopied ? 'Link copied' : 'Share public link'}
                </button>
              )}
              {canEdit && (
                <button onClick={() => router.push('/research/profile/' + userId + '/manage')} className="btn-solid">
                  <Settings className="w-4 h-4" />
                  Manage Profile
                </button>
              )}
            </div>
          </div>

          {/* Stats Row */}
          {(sections.metrics || sections.publications || sections.coAuthors) && (
          <div className="stats-row">
            {sections.metrics && (
            <div className="stat-card">
              <div className="stat-left">
                <span className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" style={{ stroke: 'rgb(var(--brand-gold))' }} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                </span>
                <div>
                  <div className="stat-value">{citations}</div>
                  <div className="stat-label">CITATIONS</div>
                </div>
              </div>
            </div>
            )}
            
            {sections.metrics && (
            <div className="stat-card">
              <div className="stat-left">
                <span className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" style={{ stroke: 'rgb(var(--brand-gold))' }} strokeWidth="2"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>
                </span>
                <div>
                  <div className="stat-value gold">{hIndex}</div>
                  <div className="stat-label">H-INDEX</div>
                </div>
              </div>
            </div>
            )}

            {sections.publications && (
            <div className="stat-card">
              <div className="stat-left">
                <span className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" style={{ stroke: 'rgb(var(--brand-gold))' }} strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                </span>
                <div>
                  <div className="stat-value">{publicationsCount}</div>
                  <div className="stat-label">PUBLICATIONS</div>
                </div>
              </div>
            </div>
            )}

            {sections.coAuthors && (
            <div className="stat-card">
              <div className="stat-left">
                <span className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" style={{ stroke: 'rgb(var(--brand-gold))' }} strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M22 21c0-3-2-5.5-5-6"/></svg>
                </span>
                <div>
                  <div className="stat-value gold">{collaboratorsCount}</div>
                  <div className="stat-label">COLLABORATORS</div>
                </div>
              </div>
            </div>
            )}
          </div>
          )}

          {/* Navigation Tabs Bar */}
          <div className="tabs-bar" role="tablist" aria-label="Profile sections">
            <button type="button" role="tab" aria-selected={currentTab === 'overview'} onClick={() => setActiveTab('overview')} className={'ptab ' + (currentTab === 'overview' ? 'active' : '')}>
              <Eye className="w-[17px] h-[17px]" />
              Overview
            </button>
            {visibleTabs.publications && (
            <button type="button" role="tab" aria-selected={currentTab === 'publications'} onClick={() => setActiveTab('publications')} className={'ptab ' + (currentTab === 'publications' ? 'active' : '')}>
              <BookOpen className="w-[17px] h-[17px]" />
              Publications
            </button>
            )}
            {visibleTabs.collaborations && (
            <button type="button" role="tab" aria-selected={currentTab === 'collaborations'} onClick={() => setActiveTab('collaborations')} className={'ptab ' + (currentTab === 'collaborations' ? 'active' : '')}>
              <Network className="w-[17px] h-[17px]" />
              Network
            </button>
            )}
            {visibleTabs.metrics && (
            <button type="button" role="tab" aria-selected={currentTab === 'metrics'} onClick={() => setActiveTab('metrics')} className={'ptab ' + (currentTab === 'metrics' ? 'active' : '')}>
              <BarChart3 className="w-[17px] h-[17px]" />
              Analytics
            </button>
            )}
            {visibleTabs.analytics && (
            <button type="button" role="tab" aria-selected={currentTab === 'analytics'} onClick={() => setActiveTab('analytics')} className={'ptab ' + (currentTab === 'analytics' ? 'active' : '')}>
              <Layers3 className="w-[17px] h-[17px]" />
              DRD Reports
            </button>
            )}
          </div>

          {/* Tab Views */}
          {currentTab === 'overview' && (
            <div className="space-y-6">
              <div className="content-grid">
                {(bio || canEdit) && (
                  <div className="card">
                    <h3>Biography</h3>
                    {bio ? (
                      <p style={{ whiteSpace: 'pre-line' }}>{bio}</p>
                    ) : (
                      <p>
                        You haven&apos;t written a biography yet.{' '}
                        <Link href={`/research/profile/${userId}/manage`} className="font-semibold text-wine hover:underline">Add one</Link>
                      </p>
                    )}
                  </div>
                )}
                {sections.researchInterests && (researchInterests.length > 0 || canEdit) && (
                  <div className="card">
                    <h3>Research Focus</h3>
                    {researchInterests.length > 0 ? (
                      <>
                        <div className="pill-grid">
                          {researchInterests.map((interest, idx) => (
                            <span key={idx} className="pill">
                              <Star className="w-3.5 h-3.5" />
                              {interest}
                            </span>
                          ))}
                        </div>
                        {interestsDerived && (
                          <p style={{ marginTop: 12, fontSize: 12 }}>
                            Based on keywords from published work.
                            {canEdit && <> <Link href={`/research/profile/${userId}/manage`} className="font-semibold text-wine hover:underline">Set your own</Link></>}
                          </p>
                        )}
                      </>
                    ) : (
                      <p>
                        No research interests yet.{' '}
                        <Link href={`/research/profile/${userId}/manage`} className="font-semibold text-wine hover:underline">Add them</Link>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="content-grid">
                {sections.publications && featuredPub && (
                  <div className="card">
                    <h3>Featured Publication</h3>
                    <div className="featured-pub">
                      <span className="pub-icon">
                        <svg viewBox="0 0 24 24" fill="none" style={{ stroke: 'rgb(var(--brand-gold))' }} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                      </span>
                      <div>
                        <div className="pub-title">{featuredPub.title}</div>
                        {featuredPub.venue && <div className="pub-meta">{featuredPub.venue}</div>}
                        <div className="pub-cites">
                          <Quote className="w-3.5 h-3.5 text-gold" />
                          {featuredPub.citationCount} total citations
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {sections.metrics && citationHistory.length > 0 && (
                  <div className="card chart-card">
                    <div className="chart-head">
                      <h3 style={{ paddingBottom: 0 }}>Citation History</h3>
                      <span className="yearly-btn">
                        <Calendar className="w-3.5 h-3.5" />
                        Yearly
                      </span>
                    </div>
                    <div className="bar-chart">
                      <div className="y-axis">
                        {citationAxis.ticks.map((t) => <span key={t}>{t}</span>)}
                      </div>
                      <div className="bars">
                        {citationHistory.map((item, idx) => {
                          const barHeight = Math.round((item.count / citationAxis.top) * 100);
                          return (
                            <div key={idx} className="bar-col">
                              <div className="bar" style={{ height: barHeight + '%' }} title={item.count + ' citations'}></div>
                              <span>{item.year}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentTab === 'publications' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Publications</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Explore research publications and review records</p>
                </div>
                <div className="text-sm text-gray-500">
                  {filteredPublications.length} of {profileData.publications.length} publications
                </div>
              </div>

              {/* Filtering Controls */}
              <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-white rounded-xl border border-blush-line shadow-sm">
                <div className="flex items-center bg-gray-50 rounded-lg border border-blush-line px-3 py-2 w-full md:w-80">
                  <Search className="w-4 h-4 text-gray-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Search publications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent outline-none text-sm w-full"
                  />
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="px-3 py-2 bg-white border border-blush-line rounded-lg text-sm"
                  >
                    <option value="all">All Types</option>
                    {publicationTypes.map(t => (
                      <option key={t} value={t}>{({ research_paper: 'Journal articles', conference_paper: 'Conference papers', book: 'Books', book_chapter: 'Book chapters' } as Record<string, string>)[t] || t}</option>
                    ))}
                  </select>

                </div>
              </div>

              <PublicationList publications={filteredPublications} />
            </div>
          )}

          {currentTab === 'collaborations' && (
            <CollaborationNetworkTab
              coAuthors={profileData.coAuthors}
              mainAuthorName={name}
            />
          )}

          {currentTab === 'metrics' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Citation Analytics</h2>
                <p className="text-sm text-slate-500 mt-0.5">Statistical breakdown of citation metrics and paper indexes</p>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <CitationMetricsPanel metrics={profileData.profile.metrics} />
                <div className="bg-white p-6 rounded-xl border border-blush-line shadow-sm">
                  <h3 className="text-base font-bold mb-4">Citations Growth Trend</h3>
                  <CitationTrendChart data={citationHistory} variant="bar" />
                </div>
              </div>
            </div>
          )}

          {currentTab === 'analytics' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Comprehensive DRD Reports</h2>
                <p className="text-sm text-slate-500 mt-0.5">Official compliance indices, submission pipeline status, and tracker details</p>
              </div>
              <ComprehensiveAnalyticsTab
                drdAnalyticsData={drdAnalyticsData}
                submissionsData={submissionsData}
                trackerWorks={trackerWorks}
                profileData={profileData}
                userId={userId}
              />
            </div>
          )}

        </main>

        {/* Floating Stack */}
        <div className="fab-stack no-print">
          <button onClick={() => window.print()} className="fab fab-gold" title="Download Report">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  );
}
