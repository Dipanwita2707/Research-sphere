'use client';

import React, { useEffect, useState } from 'react';
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
import { mapDrdAnalyticsToProfileData } from '@/features/research-profile/services/profileDataMapper';
import { applyResearchIdentity, buildProfileDataFromAuthUser } from '@/features/research-profile/services/profileFallback';
import { researchProfileService } from '@/features/research-profile/services/researchProfile.service';
import { researchService } from '@/features/research-management/services/research.service';
import { useAffiliation } from '@/shared/hooks/useAffiliation';
import heroArtSrc from '@/assets/hero-art.jpg';

const PublicationList = PublicationListDirect;

const CollaborationNetworkTab = dynamic(
  () => import('@/features/research-profile/components/CollaborationNetworkTab'),
  {
    ssr: false,
    loading: () => <div className="h-[720px] bg-[#fdf5ec] rounded-xl animate-pulse border border-[#f0e2d2]" />,
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
  const { canonicalName: universityName } = useAffiliation();
  
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [drdAnalyticsData, setDrdAnalyticsData] = useState<DrdAnalyticsResponse | null>(null);
  const [submissionsData, setSubmissionsData] = useState<PersonSubmissionsResponse | null>(null);
  const [trackerWorks, setTrackerWorks] = useState<ApplicantPersonTrackerWorks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'overview' | 'publications' | 'collaborations' | 'metrics' | 'analytics'>('overview');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'year' | 'citations' | 'relevance'>('year');
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
      
      // Attempt to load from DRD Analytics first
      try {
        const [analyticsResponse, submissionsResponse] = await Promise.all([
          drdAnalyticsService.getApplicantPersonAnalytics(userId).catch(() => null),
          drdAnalyticsService.getApplicantPersonSubmissions(userId).catch(() => null),
        ]);
        
        if (analyticsResponse?.data) {
          setDrdAnalyticsData(analyticsResponse.data);
          setSubmissionsData(submissionsResponse?.data || null);
          
          const trackerWorksData = analyticsResponse.data.extensions?.trackerWorks as ApplicantPersonTrackerWorks | undefined;
          setTrackerWorks(trackerWorksData || null);
          
          const mappedProfile = mapDrdAnalyticsToProfileData(
            userId,
            analyticsResponse.data,
            submissionsResponse?.data || undefined
          );
          let finalProfile = mappedProfile;
          try {
            const identity = await researchProfileService.getIdentity(userId);
            finalProfile = applyResearchIdentity(mappedProfile, identity);
          } catch (identityError) {
            logger.warn('Failed to fetch profile identity:', identityError);
          }
          
          setProfileData(finalProfile);
          return;
        }
      } catch (drdError) {
        logger.warn('Failed to fetch DRD analytics data for research profile:', drdError);
      }

      // Fallback: Query contributions or build profile
      let fallbackProfile = user && isOwnProfile ? buildProfileDataFromAuthUser(user, universityName) : null;
      if (!fallbackProfile) {
        // Mock a general profile
        fallbackProfile = {
          user: {
            uid: userId,
            name: userId === 'FAC001' ? 'Prateek Agrawal' : 'Research Faculty',
            email: 'researcher@sgtuniversity.edu',
            photo: null,
            designation: 'Assistant Professor',
            department: 'Computer Science',
            school: 'School of Computer Science',
          },
          profile: {
            id: userId,
            userId,
            bio: 'Research faculty at School of Computer Science. Specializing in advanced software engineering and machine learning.',
            researchInterests: ['Machine Learning', 'Computer Networks', 'Internet of Things'],
            googleScholarId: null,
            scopusAuthorId: null,
            webOfScienceId: null,
            orcid: null,
            personalWebsite: null,
            lastSyncedAt: null,
            syncStatus: 'never_synced',
            syncError: null,
            autoSyncEnabled: false,
            filterSgtOnly: false,
            syncFrequencyDays: 30,
            visibility: {
              profile: 'public',
              showEmail: true,
              showPhone: false,
              showPublications: true,
              showMetrics: true,
              showCoAuthors: true,
              showResearchInterests: true,
            },
            metrics: {
              totalCitations: 0,
              hIndex: 0,
              i10Index: 0,
              avgCitationsPerPaper: 0,
              citationsPerYear: [],
            },
            profileCompleteness: 50,
            isVerified: true,
            verifiedAt: null,
            verifiedBy: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          publications: [],
          coAuthors: [],
          impactMetrics: {
            avgCitationsPerPaper: 0,
            medianCitations: 0,
            highlyCitedPapers: 0,
            citationDistribution: [
              { range: '0-5', count: 0 },
              { range: '6-10', count: 0 },
              { range: '11-20', count: 0 },
              { range: '21+', count: 0 },
            ],
          },
        };
      }

      try {
        const identity = await researchProfileService.getIdentity(userId).catch(() => null);
        if (identity) {
          fallbackProfile = applyResearchIdentity(fallbackProfile, identity);
        }
      } catch (identityError) {}

      // Try fetching contributions list to populate publications
      try {
        const contribResponse = await researchService.getMyContributions({ limit: 200 }).catch(() => null);
        const contributions = contribResponse?.data?.contributions || contribResponse?.contributions || (Array.isArray(contribResponse) ? contribResponse : []);
        if (contributions && contributions.length > 0) {
          const publications: Publication[] = contributions.map((c: any) => {
            const citationCount = Number(c.indexingDetails?.citationCount || 0);
            const pubYear = c.publicationDate ? new Date(c.publicationDate).getFullYear() : (c.publishedYear || new Date().getFullYear());
            return {
              id: c.id,
              profileId: userId,
              researchContributionId: c.id,
              title: c.title || 'Untitled Publication',
              authors: (c.authors || []).map((a: any, idx: number) => ({
                name: a.name || '',
                affiliation: a.affiliation || null,
                email: a.email || null,
                isCorresponding: a.isCorresponding || false,
                authorOrder: a.authorOrder ?? idx,
              })),
              venue: c.journalName || c.conferenceName || c.bookTitle || c.publisherName || 'Conference / Journal',
              publicationType: c.publicationType || 'research_paper',
              year: pubYear,
              volume: c.volume || null,
              issue: c.issue || null,
              pages: c.pageNumbers || null,
              doi: c.doi || null,
              isbn: c.isbn || null,
              issn: c.issn || null,
              arxivId: null,
              pubmedId: null,
              citationCount,
              citationsPerYear: {},
              source: 'manual' as const,
              externalId: null,
              pdfUrl: null,
              publicationUrl: c.url || null,
              abstract: c.abstract || null,
              keywords: [],
              isVerified: c.status === 'approved',
              createdAt: c.createdAt,
              updatedAt: c.updatedAt,
            };
          });

          fallbackProfile.publications = publications;
        }
      } catch (contribError) {}

      setProfileData(fallbackProfile);
    } catch (err) {
      logger.error('Error fetching profile:', err);
      setError('Failed to load profile');
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
      <div className="min-h-screen flex items-center justify-center bg-[#fdf5ec]">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#7d1a34] mx-auto"></div>
          <p className="text-sm text-gray-500 mt-4">Loading research profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdf5ec]">
        <div className="text-center bg-white p-8 rounded-xl border border-[#f0e2d2] shadow-sm max-w-md mx-auto">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{error || 'Profile not found'}</h3>
          <p className="text-sm text-gray-500 mb-6">We could not retrieve the researcher profile. Please try again later.</p>
          <button onClick={() => router.push('/research')} className="px-5 py-2.5 bg-[#7d1a34] text-white rounded-lg font-semibold hover:bg-[#5e1024] transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const name = profileData.user.name;
  const email = profileData.user.email;
  const designation = profileData.user.designation || 'Assistant Professor';
  const department = profileData.user.department || 'Computer Science';
  const school = profileData.user.school || 'School of Computer Science';

  const citations = profileData.profile.metrics.totalCitations || 0;
  const hIndex = profileData.profile.metrics.hIndex || 0;
  const publicationsCount = profileData.publications.length || 0;
  const collaboratorsCount = profileData.coAuthors.length || 0;

  const bio =
    profileData.profile.bio || 'Research faculty specializing in advanced computing fields.';

  const researchInterests =
    profileData.profile.researchInterests.length > 0
      ? profileData.profile.researchInterests
      : ['Research Methodology', 'Academic Publishing', 'Computer Networks', 'Academic Writing'];

  const citationHistory = profileData.profile.metrics.citationsPerYear;

  const featuredPub = profileData.publications.reduce(
    (max, pub) => (pub.citationCount > max.citationCount ? pub : max),
    profileData.publications[0] || null
  );

  // Filter publications based on current filters and search queries
  const filteredPublications = profileData.publications
    .filter(pub => selectedYear === 'all' || pub.year === parseInt(selectedYear))
    .filter(pub => selectedType === 'all' || pub.publicationType === selectedType)
    .filter(pub => searchQuery === '' || pub.title.toLowerCase().includes(searchQuery.toLowerCase()) || pub.venue.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'year': return b.year - a.year;
        case 'citations': return b.citationCount - a.citationCount;
        case 'relevance': return b.citationCount - a.citationCount;
        default: return b.year - a.year;
      }
    });

  const publicationTypes = Array.from(new Set(profileData.publications.map(p => p.publicationType)));
  const years = Array.from(new Set(profileData.publications.map(p => p.year))).sort((a, b) => b - a);

  // Dynamic bar-chart heights
  const maxCitationInHistory = citationHistory.length > 0 ? Math.max(...citationHistory.map(c => c.count), 1) : 1;

  // Custom CSS block
  const CSS = `:root{--maroon:#7d1a34;--maroon-dark:#5e1024;--gold:#c8973f;--page-bg:#fdf5ec;--card-bg:#ffffff;--border:#f0e2d2;--text-dark:#2b1d22;--text-gray:#7a7178;--text-gray-light:#9a9198;}.profile-body *{box-sizing:border-box;}.profile-body{background:var(--page-bg);color:var(--text-dark);font-family:Arial,Helvetica,sans-serif;min-height:100vh;}.profile-main{max-width:1600px;margin:0 auto;padding:30px 40px 60px;position:relative;}.profile-banner{position:relative;background:linear-gradient(to right, #fbeee0 0%, #fdf7ee 50%, #fdf7ee 100%);border-radius:18px;padding:36px 40px;overflow:hidden;margin-bottom:24px;display:flex;align-items:center;gap:34px;border:1px solid var(--border);}.avatar-lg{width:135px;height:135px;border-radius:50%;background:var(--maroon-dark);border:4px solid #fff;box-shadow:0 0 0 2px var(--gold);display:flex;align-items:center;justify-content:center;color:#fff;font-size:56px;font-weight:700;font-family:Georgia,serif;flex-shrink:0;position:relative;z-index:1;}.status-dot{position:absolute;bottom:6px;right:6px;width:18px;height:18px;background:#2ecc71;border:3px solid #fff;border-radius:50%;}.profile-info{position:relative;z-index:1;flex-shrink:0;}.profile-info h2{font-family:Georgia,serif;font-size:30px;margin-bottom:8px;color:var(--text-dark);}.profile-role{display:flex;align-items:center;gap:8px;color:var(--maroon);font-weight:700;font-size:15px;margin-bottom:4px;}.profile-role svg{width:17px;height:17px;}.profile-dept{color:var(--text-gray);font-size:14px;margin-bottom:14px;}.profile-tags{display:flex;gap:10px;margin-bottom:14px;}.tag{display:flex;align-items:center;gap:6px;border:1px solid var(--border);background:#fff;border-radius:8px;padding:7px 12px;font-size:12.5px;font-weight:600;color:var(--text-dark);}.tag svg{width:14px;height:14px;}.tag.gold{color:#b9822c;}.profile-email{display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--text-gray);}.profile-email svg{width:15px;height:15px;color:var(--gold);}.banner-art{position:absolute;right:0;top:0;bottom:0;width:480px;height:100%;object-fit:contain;object-position:right center;pointer-events:none;}.banner-actions{position:absolute;top:36px;right:40px;display:flex;gap:10px;z-index:2;}.btn-outline{background:#fff;border:1px solid var(--border);border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px;color:var(--text-dark);cursor:pointer;}.btn-solid{background:var(--maroon-dark);color:#fff;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px;cursor:pointer;border:none;}.btn-outline svg,.btn-solid svg{width:14px;height:14px;}.stats-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-bottom:24px;}.stat-card{background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:20px 22px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 4px 12px rgba(125,26,52,0.02);}.stat-left{display:flex;align-items:center;gap:14px;}.stat-icon{width:48px;height:48px;border-radius:12px;background:#fbecd2;display:flex;align-items:center;justify-content:center;flex-shrink:0;}.stat-icon svg{width:22px;height:22px;color:var(--gold);}.stat-value{font-size:26px;font-weight:800;color:var(--maroon);line-height:1;}.stat-value.gold{color:#b9822c;}.stat-label{font-size:11.5px;font-weight:700;letter-spacing:0.5px;color:var(--text-gray);margin-top:4px;}.sparkline{width:80px;height:34px;}.tabs-bar{display:flex;gap:8px 22px;border-bottom:1px solid var(--border);margin-bottom:26px;flex-wrap:wrap;overflow:visible;position:relative;z-index:20;background:var(--page-bg);padding:6px 2px 0;}.tabs-bar::-webkit-scrollbar{display:none;width:0;height:0;}.ptab{display:flex;align-items:center;gap:8px;padding:0 6px 16px;font-size:14px;font-weight:600;color:var(--text-gray-light);cursor:pointer;position:relative;background:transparent;border:none;flex-shrink:0;white-space:nowrap;}.ptab svg{width:17px;height:17px;flex-shrink:0;}.ptab.active{color:var(--maroon);}.ptab.active::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2.5px;background:var(--maroon);}.content-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-bottom:22px;}.card{background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:26px 28px;box-shadow:0 10px 30px rgba(125,26,52,0.02);}.card h3{font-size:16.5px;font-weight:700;margin-bottom:14px;position:relative;padding-bottom:10px;color:var(--text-dark);}.card h3::after{content:"";position:absolute;left:0;bottom:0;width:34px;height:3px;background:var(--gold);}.chart-head h3::after{display:none;}.card p{font-size:13.5px;color:var(--text-gray);line-height:1.6;}.pill-grid{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px;}.pill{display:flex;align-items:center;gap:8px;border:1px solid var(--border);background:#fdf8f2;border-radius:9px;padding:9px 14px;font-size:13px;font-weight:600;color:var(--text-dark);}.pill svg{width:15px;height:15px;color:var(--maroon);}.featured-pub{display:flex;gap:16px;align-items:flex-start;}.pub-icon{width:56px;height:56px;border-radius:12px;background:#fbecd2;display:flex;align-items:center;justify-content:center;flex-shrink:0;}.pub-icon svg{width:24px;height:24px;color:var(--gold);}.pub-title{color:var(--maroon);font-weight:700;font-size:15px;line-height:1.4;margin-bottom:8px;}.pub-meta{font-size:12.5px;color:var(--text-gray);margin-bottom:10px;}.pub-cites{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-gray);font-weight:600;}.pub-cites svg{width:14px;height:14px;color:var(--gold);}.chart-card{grid-column:span 1;}.chart-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;}.yearly-btn{display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:8px;padding:7px 12px;font-size:12.5px;font-weight:600;color:var(--text-dark);}.yearly-btn svg{width:14px;height:14px;}.bar-chart{display:flex;align-items:flex-end;gap:14px;height:230px;padding-left:34px;position:relative;}.y-axis{position:absolute;left:0;top:0;bottom:24px;display:flex;flex-direction:column;justify-content:space-between;font-size:11px;color:var(--text-gray-light);}.bars{display:flex;align-items:flex-end;gap:16px;flex:1;height:100%;padding-bottom:24px;border-left:1px solid var(--border);padding-left:16px;}.bar-col{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;height:100%;justify-content:flex-end;}.bar{width:100%;max-width:34px;background:linear-gradient(180deg,var(--maroon) 0%,var(--maroon-dark) 100%);border-radius:4px 4px 0 0;}.bar-col span{font-size:11px;color:var(--text-gray-light);}.fab-stack{position:fixed;right:24px;bottom:2rem;top:auto;transform:none;display:flex;flex-direction:column;gap:14px;z-index:30;}.fab{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 8px 18px rgba(0,0,0,0.18);border:none;cursor:pointer;transition:transform 0.2s;}.fab:hover{transform:scale(1.1);}.fab svg{width:19px;height:19px;}.fab-maroon{background:var(--maroon-dark);}.fab-gold{background:var(--gold);}@media (max-width:1100px){.stats-row{grid-template-columns:repeat(2,minmax(0,1fr));}}@media (max-width:900px){.profile-main{padding:20px 16px 48px;}.profile-banner{flex-direction:column;align-items:flex-start;padding:24px 20px;}.banner-art{width:min(100%,320px);height:auto;max-height:160px;position:relative;margin-top:8px;align-self:flex-end;}.banner-actions{position:static;margin-top:16px;width:100%;flex-wrap:wrap;}.content-grid{grid-template-columns:1fr;}.ptab{font-size:13px;}}@media (max-width:520px){.stats-row{grid-template-columns:1fr;}}`;

  return (
    <>
      <style>{CSS}</style>
      <div className="profile-body">
        <main className="profile-main">

          {/* Profile Banner */}
          <div className="profile-banner">
            <div className="avatar-lg">
              {name.charAt(0)}
              <span className="status-dot"></span>
            </div>
            
            <div className="profile-info">
              <h2>{name}</h2>
              <div className="profile-role">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
                {designation}
              </div>
              <div className="profile-dept">{department}</div>
              <div className="profile-tags">
                {department && !department.toLowerCase().includes('not available') && (
                  <span className="tag">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="13" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    {department}
                  </span>
                )}
                {school && !school.toLowerCase().includes('not available') && school !== 'Research' && (
                  <span className="tag">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg>
                    {school}
                  </span>
                )}
                <span className="tag gold">
                  <svg viewBox="0 0 24 24" fill="#c8973f" stroke="#c8973f" strokeWidth="1"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9"/></svg>
                  Active Researcher
                </span>
              </div>
              <div className="profile-email">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 6 10-6"/></svg>
                {email}
              </div>
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
              {isOwnProfile && (
                <button onClick={() => router.push('/research/profile/' + userId + '/manage')} className="btn-solid">
                  <Settings className="w-4 h-4" />
                  Manage Profile
                </button>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-left">
                <span className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#c8973f" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                </span>
                <div>
                  <div className="stat-value">{citations}</div>
                  <div className="stat-label">CITATIONS</div>
                </div>
              </div>
              <svg className="sparkline" viewBox="0 0 80 34">
                <polyline points="0,26 15,24 30,20 45,22 60,10 80,4" fill="none" stroke="#7d1a34" strokeWidth="2"/>
              </svg>
            </div>
            
            <div className="stat-card">
              <div className="stat-left">
                <span className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#c8973f" strokeWidth="2"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>
                </span>
                <div>
                  <div className="stat-value gold">{hIndex}</div>
                  <div className="stat-label">H-INDEX</div>
                </div>
              </div>
              <svg className="sparkline" viewBox="0 0 80 34">
                <polyline points="0,28 15,26 30,22 45,18 60,12 80,6" fill="none" stroke="#c8973f" strokeWidth="2"/>
              </svg>
            </div>

            <div className="stat-card">
              <div className="stat-left">
                <span className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#c8973f" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                </span>
                <div>
                  <div className="stat-value">{publicationsCount}</div>
                  <div className="stat-label">PUBLICATIONS</div>
                </div>
              </div>
              <svg className="sparkline" viewBox="0 0 80 34">
                <polyline points="0,26 15,22 30,24 45,16 60,18 80,4" fill="none" stroke="#7d1a34" strokeWidth="2"/>
              </svg>
            </div>

            <div className="stat-card">
              <div className="stat-left">
                <span className="stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#c8973f" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M22 21c0-3-2-5.5-5-6"/></svg>
                </span>
                <div>
                  <div className="stat-value gold">{collaboratorsCount}</div>
                  <div className="stat-label">COLLABORATORS</div>
                </div>
              </div>
              <svg className="sparkline" viewBox="0 0 80 34">
                <polyline points="0,28 15,24 30,26 45,14 60,16 80,4" fill="none" stroke="#c8973f" strokeWidth="2"/>
              </svg>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="tabs-bar" role="tablist" aria-label="Profile sections">
            <button type="button" role="tab" aria-selected={activeTab === 'overview'} onClick={() => setActiveTab('overview')} className={'ptab ' + (activeTab === 'overview' ? 'active' : '')}>
              <Eye className="w-[17px] h-[17px]" />
              Overview
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'publications'} onClick={() => setActiveTab('publications')} className={'ptab ' + (activeTab === 'publications' ? 'active' : '')}>
              <BookOpen className="w-[17px] h-[17px]" />
              Publications
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'collaborations'} onClick={() => setActiveTab('collaborations')} className={'ptab ' + (activeTab === 'collaborations' ? 'active' : '')}>
              <Network className="w-[17px] h-[17px]" />
              Network
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'metrics'} onClick={() => setActiveTab('metrics')} className={'ptab ' + (activeTab === 'metrics' ? 'active' : '')}>
              <BarChart3 className="w-[17px] h-[17px]" />
              Analytics
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} className={'ptab ' + (activeTab === 'analytics' ? 'active' : '')}>
              <Layers3 className="w-[17px] h-[17px]" />
              DRD Reports
            </button>
          </div>

          {/* Tab Views */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="content-grid">
                <div className="card">
                  <h3>Biography</h3>
                  <p>{bio}</p>
                </div>
                <div className="card">
                  <h3>Research Focus</h3>
                  <div className="pill-grid">
                    {researchInterests.map((interest, idx) => (
                      <span key={idx} className="pill">
                        <Star className="w-3.5 h-3.5" />
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="content-grid">
                {featuredPub && (
                  <div className="card">
                    <h3>Featured Publication</h3>
                    <div className="featured-pub">
                      <span className="pub-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#c8973f" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                      </span>
                      <div>
                        <div className="pub-title">{featuredPub.title}</div>
                        <div className="pub-meta">{featuredPub.venue || 'Publication Venue'}</div>
                        <div className="pub-cites">
                          <Quote className="w-3.5 h-3.5 text-[#c8973f]" />
                          {featuredPub.citationCount} total citations
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {citationHistory.length > 0 && (
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
                        <span>{maxCitationInHistory}</span>
                        <span>{Math.round(maxCitationInHistory * 0.75)}</span>
                        <span>{Math.round(maxCitationInHistory * 0.5)}</span>
                        <span>{Math.round(maxCitationInHistory * 0.25)}</span>
                        <span>0</span>
                      </div>
                      <div className="bars">
                        {citationHistory.map((item, idx) => {
                          const barHeight = Math.round((item.count / maxCitationInHistory) * 100);
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

          {activeTab === 'publications' && (
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
              <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-white rounded-xl border border-[#f0e2d2] shadow-sm">
                <div className="flex items-center bg-gray-50 rounded-lg border border-[#f0e2d2] px-3 py-2 w-full md:w-80">
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
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-3 py-2 bg-white border border-[#f0e2d2] rounded-lg text-sm"
                  >
                    <option value="all">All Years</option>
                    {years.map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>

                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="px-3 py-2 bg-white border border-[#f0e2d2] rounded-lg text-sm"
                  >
                    <option value="all">All Types</option>
                    {publicationTypes.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-2 bg-white border border-[#f0e2d2] rounded-lg text-sm"
                  >
                    <option value="year">Sort by Year</option>
                    <option value="citations">Sort by Citations</option>
                  </select>
                </div>
              </div>

              <PublicationList publications={filteredPublications} />
            </div>
          )}

          {activeTab === 'collaborations' && (
            <CollaborationNetworkTab
              coAuthors={profileData.coAuthors}
              mainAuthorName={name}
            />
          )}

          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Citation Analytics</h2>
                <p className="text-sm text-slate-500 mt-0.5">Statistical breakdown of citation metrics and paper indexes</p>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <CitationMetricsPanel metrics={profileData.profile.metrics} />
                <div className="bg-white p-6 rounded-xl border border-[#f0e2d2] shadow-sm">
                  <h3 className="text-base font-bold mb-4">Citations Growth Trend</h3>
                  <CitationTrendChart data={citationHistory} variant="bar" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
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
