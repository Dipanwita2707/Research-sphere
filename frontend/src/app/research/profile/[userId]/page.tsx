'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
  Mail, 
  Building2, 
  GraduationCap,
  Edit2,
  ExternalLink,
  FileText,
  TrendingUp,
  Users,
  Award,
  Save,
  X,
  Settings,
  Star,
  BookOpen,
  Quote,
  Globe,
  Calendar,
  MapPin,
  Phone,
  Download,
  Share2,
  Eye,
  BarChart3,
  Network,
  Zap,
  Trophy,
  Target,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  Heart,
  MessageCircle,
  Bookmark,
  Filter,
  Search,
  SortDesc,
  Grid3X3,
  List,
  ChevronDown,
  Plus,
  Minus,
  Info,
  CheckCircle,
  AlertCircle,
  Clock,
  Flame,
  Layers3,
  Hash,
  Lightbulb,
  Wallet,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { mockResearchProfileAPI } from '@/mocks/research-profile-api';
import type { ProfileData } from '@/shared/types/research-profile.types';
import { useAuthStore } from '@/shared/auth/authStore';
import logger from '@/shared/utils/logger';
import { 
  drdAnalyticsService,
  type DrdAnalyticsResponse,
  type PersonSubmissionsResponse,
  type ApplicantPersonTrackerWorks,
  type ProgressTrackerRecord,
} from '@/features/ipr-management/services/drdAnalytics.service';
import { mapDrdAnalyticsToProfileData } from '@/features/research-profile/services/profileDataMapper';
import { applyResearchIdentity, buildProfileDataFromAuthUser } from '@/features/research-profile/services/profileFallback';
import { researchProfileService } from '@/features/research-profile/services/researchProfile.service';
import { researchService } from '@/features/research-management/services/research.service';
import type { Publication, CoAuthor } from '@/shared/types/research-profile.types';
import PerformanceMonitor from '@/shared/components/performance/PerformanceMonitor';
import { useStaffDashboardSummary } from '@/shared/hooks/useUserContextQueries';

// Dynamic imports for heavy components to reduce initial bundle size
const CitationMetricsPanel = dynamic(
  () => import('@/features/research-profile/components/CitationMetricsPanel'),
  { 
    ssr: false,
    loading: () => <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
  }
);

const PublicationList = dynamic(
  () => import('@/features/research-profile/components/PublicationList'),
  { 
    ssr: false,
    loading: () => <div className="space-y-4">{Array.from({length: 3}).map((_, i) => (
      <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
    ))}</div>
  }
);

const CitationTrendChart = dynamic(
  () => import('@/features/research-profile/components/CitationTrendChart'),
  { 
    ssr: false,
    loading: () => <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
  }
);

const ResearchInterestsTags = dynamic(
  () => import('@/features/research-profile/components/ResearchInterestsTags'),
  { 
    ssr: false,
    loading: () => <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
  }
);

const CoAuthorNetwork = dynamic(
  () => import('@/features/research-profile/components/CoAuthorNetwork'),
  { 
    ssr: false,
    loading: () => <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
  }
);

const ComprehensiveAnalyticsTab = dynamic(
  () => import('@/features/research-profile/components/ComprehensiveAnalyticsTab'),
  { 
    ssr: false,
    loading: () => <div className="space-y-6">{Array.from({length: 4}).map((_, i) => (
      <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
    ))}</div>
  }
);

export default function ProfilePage() {
  const params = useParams();
  const userId = params?.userId as string;
  const { user } = useAuthStore();
  const { data: staffDashboardData } = useStaffDashboardSummary({ enabled: !!user });
  
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
  
  // Inline editing state
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isEditingInterests, setIsEditingInterests] = useState(false);
  const [isEditingWebsite, setIsEditingWebsite] = useState(false);
  const [editedBio, setEditedBio] = useState('');
  const [editedInterests, setEditedInterests] = useState<string[]>([]);
  const [editedWebsite, setEditedWebsite] = useState('');
  const [interestInput, setInterestInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [showNetworkView, setShowNetworkView] = useState(false);
  
  const isOwnProfile = user?.id === userId;
  const hasApplicantAnalyticsAccess =
    user?.userType === 'admin' ||
    !!staffDashboardData?.permissions?.some((dept) =>
      (dept.permissions || []).some((permission) => {
        const normalized = permission.toLowerCase();
        return (
          normalized.includes('applicant_analytics') ||
          normalized.includes('research_applicant_analytics') ||
          normalized.includes('book_applicant_analytics') ||
          normalized.includes('conference_applicant_analytics') ||
          normalized.includes('grant_applicant_analytics') ||
          normalized.includes('ipr_applicant_analytics')
        );
      })
    );

  useEffect(() => {
    if (userId) {
      // Use requestIdleCallback for non-critical data fetching
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          fetchProfile();
        });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          fetchProfile();
        }, 0);
      }
    }
  }, [userId, isOwnProfile, user, hasApplicantAnalyticsAccess]);

  const fetchProfile = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Only hit DRD analytics when the viewer actually has applicant analytics access.
      if (hasApplicantAnalyticsAccess) {
        try {
          const [analyticsResponse, submissionsResponse] = await Promise.all([
            drdAnalyticsService.getApplicantPersonAnalytics(userId),
            drdAnalyticsService.getApplicantPersonSubmissions(userId).catch(() => null), // Optional
          ]);
          
          if (analyticsResponse.data) {
            setDrdAnalyticsData(analyticsResponse.data);
            setSubmissionsData(submissionsResponse?.data || null);
            
            // Extract tracker works from extensions
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
              logger.warn('Failed to fetch profile identity data:', identityError);
            }
            setProfileData(finalProfile);
            mockResearchProfileAPI.seedProfile(finalProfile);
            
            // Initialize edit state with current values
            setEditedBio(finalProfile.profile.bio || '');
            setEditedInterests(finalProfile.profile.researchInterests || []);
            setEditedWebsite(finalProfile.profile.personalWebsite || '');
            return;
          }
        } catch (drdError) {
          logger.warn('Failed to fetch DRD analytics data for research profile:', drdError);
        }
      }

      if (isOwnProfile && user) {
        let fallbackProfile = buildProfileDataFromAuthUser(user);
        try {
          const identity = await researchProfileService.getIdentity(userId);
          fallbackProfile = applyResearchIdentity(fallbackProfile, identity);
        } catch (identityError) {
          logger.warn('Failed to fetch profile identity data for fallback profile:', identityError);
        }

        // Populate publications and co-authors from the user's own contributions
        try {
          const contribResponse = await researchService.getMyContributions({ limit: 200 });
          const contributions: any[] = contribResponse?.data?.contributions || contribResponse?.contributions || (Array.isArray(contribResponse) ? contribResponse : []);
          if (contributions.length > 0) {
            const publications: Publication[] = contributions.map((c: any) => ({
              id: c.id,
              profileId: userId,
              researchContributionId: c.id,
              title: c.title || 'Untitled',
              authors: (c.authors || []).map((a: any, idx: number) => ({
                name: a.name || '',
                affiliation: a.affiliation || null,
                email: a.email || null,
                isCorresponding: a.isCorresponding || false,
                authorOrder: a.orderNumber ?? idx,
              })),
              venue: c.journalName || c.conferenceName || c.bookTitle || c.publisherName || '',
              publicationType: c.publicationType || 'research_paper',
              year: c.publishedYear || new Date().getFullYear(),
              volume: c.volume || null,
              issue: c.issue || null,
              pages: c.pageNumbers || null,
              doi: c.doi || null,
              isbn: c.isbn || null,
              issn: c.issn || null,
              arxivId: null,
              pubmedId: null,
              citationCount: 0,
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
            }));

            // Build unique co-authors (all named authors across contributions, excluding the profile owner)
            const coAuthorMap = new Map<string, CoAuthor>();
            contributions.forEach((c: any) => {
              (c.authors || []).forEach((a: any) => {
                if (!a.userId || a.userId !== userId) {
                  const key = a.userId || a.name;
                  if (key && !coAuthorMap.has(key)) {
                    coAuthorMap.set(key, {
                      id: a.userId || a.id || a.name,
                      name: a.name || '',
                      affiliation: a.affiliation || null,
                      email: a.email || null,
                      profileId: a.userId || null,
                      collaborationCount: 1,
                      firstCollaboration: c.publishedYear || new Date().getFullYear(),
                      lastCollaboration: c.publishedYear || new Date().getFullYear(),
                      sharedPublications: [c.id],
                    });
                  } else if (key && coAuthorMap.has(key)) {
                    const existing = coAuthorMap.get(key)!;
                    existing.collaborationCount += 1;
                    existing.sharedPublications.push(c.id);
                    existing.firstCollaboration = Math.min(existing.firstCollaboration, c.publishedYear || existing.firstCollaboration);
                    existing.lastCollaboration = Math.max(existing.lastCollaboration, c.publishedYear || existing.lastCollaboration);
                  }
                }
              });
            });

            fallbackProfile = {
              ...fallbackProfile,
              publications,
              coAuthors: Array.from(coAuthorMap.values()),
            };
          }
        } catch (contribError) {
          logger.warn('Failed to fetch contributions for profile stats:', contribError);
        }

        setProfileData(fallbackProfile);
        mockResearchProfileAPI.seedProfile(fallbackProfile);
        setEditedBio(fallbackProfile.profile.bio || '');
        setEditedInterests(fallbackProfile.profile.researchInterests || []);
        setEditedWebsite(fallbackProfile.profile.personalWebsite || '');
        return;
      }

      setError('Profile data is not available yet');
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

  // Inline editing handlers
  const handleEditBio = () => {
    setIsEditingBio(true);
    setEditedBio(profileData?.profile.bio || '');
  };

  const handleSaveBio = async () => {
    if (!profileData) return;
    
    try {
      setSaving(true);
      // Update via API (mock for now)
      const updated = await mockResearchProfileAPI.updateProfile(userId, {
        bio: editedBio,
      });
      setProfileData(updated);
      setIsEditingBio(false);
    } catch (err) {
      logger.error('Error saving bio:', err);
      alert('Failed to save bio');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelBio = () => {
    setIsEditingBio(false);
    setEditedBio(profileData?.profile.bio || '');
  };

  const handleEditInterests = () => {
    setIsEditingInterests(true);
    setEditedInterests(profileData?.profile.researchInterests || []);
  };

  const handleAddInterest = () => {
    if (interestInput.trim() && !editedInterests.includes(interestInput.trim())) {
      setEditedInterests([...editedInterests, interestInput.trim()]);
      setInterestInput('');
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setEditedInterests(editedInterests.filter(i => i !== interest));
  };

  const handleSaveInterests = async () => {
    if (!profileData) return;
    
    try {
      setSaving(true);
      const updated = await mockResearchProfileAPI.updateResearchInterests(userId, editedInterests);
      setProfileData(updated);
      setIsEditingInterests(false);
    } catch (err) {
      logger.error('Error saving interests:', err);
      alert('Failed to save research interests');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelInterests = () => {
    setIsEditingInterests(false);
    setEditedInterests(profileData?.profile.researchInterests || []);
    setInterestInput('');
  };

  const handleEditWebsite = () => {
    setIsEditingWebsite(true);
    setEditedWebsite(profileData?.profile.personalWebsite || '');
  };

  const handleSaveWebsite = async () => {
    if (!profileData) return;
    
    try {
      setSaving(true);
      const updated = await mockResearchProfileAPI.updateProfile(userId, {
        personalWebsite: editedWebsite,
      });
      setProfileData(updated);
      setIsEditingWebsite(false);
    } catch (err) {
      logger.error('Error saving website:', err);
      alert('Failed to save website');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelWebsite = () => {
    setIsEditingWebsite(false);
    setEditedWebsite(profileData?.profile.personalWebsite || '');
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {error || 'Profile not found'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            The researcher profile could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  const { user: userData, profile, publications, coAuthors, impactMetrics } = profileData;

  // Calculate additional metrics for advanced UI
  const totalPublications = publications.length;
  const recentPublications = publications.filter(p => p.year >= new Date().getFullYear() - 2).length;
  const topCitedPaper = publications.reduce((max, pub) => pub.citationCount > max.citationCount ? pub : max, publications[0] || { citationCount: 0 });
  const collaborationScore = Math.min(100, Math.round((coAuthors.length / Math.max(1, totalPublications)) * 50));
  const impactScore = Math.min(100, Math.round(profile.metrics.hIndex * 5 + profile.metrics.totalCitations / 10));
  const activityScore = Math.min(100, Math.round((recentPublications / Math.max(1, totalPublications)) * 100));

  // Filter publications based on current filters
  const filteredPublications = publications
    .filter(pub => selectedYear === 'all' || pub.year === parseInt(selectedYear))
    .filter(pub => selectedType === 'all' || pub.publicationType === selectedType)
    .sort((a, b) => {
      switch (sortBy) {
        case 'year': return b.year - a.year;
        case 'citations': return b.citationCount - a.citationCount;
        case 'relevance': return b.citationCount - a.citationCount; // Default to citations for relevance
        default: return b.year - a.year;
      }
    });

  const publicationTypes = Array.from(new Set(publications.map(p => p.publicationType)));
  const years = Array.from(new Set(publications.map(p => p.year))).sort((a, b) => b - a);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
      <PerformanceMonitor pageName="ResearchProfile" />
      
      {/* Floating Action Buttons */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 group-hover:scale-110 transition-transform ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <button className="w-12 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group">
          <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
        <button className="w-12 h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group">
          <Bookmark className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Hero Section with Gradient Background */}
      <div className="relative overflow-hidden research-profile-hero">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-purple-600/5 to-emerald-600/5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
                             radial-gradient(circle at 75% 75%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)`
          }} />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col lg:flex-row items-start gap-8">
            {/* Profile Photo with Advanced Styling */}
            <div className="profile-photo-container group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 rounded-full opacity-75 group-hover:opacity-100 blur-sm group-hover:blur transition-all duration-300"></div>
              <div className="relative">
                {userData.photo ? (
                  <img
                    src={userData.photo}
                    alt={userData.name}
                    className="profile-photo"
                    loading="eager"
                    fetchPriority="high"
                  />
                ) : (
                  <div className="profile-photo bg-gradient-to-br from-blue-500 via-purple-500 to-emerald-500 flex items-center justify-center">
                    <span className="text-4xl lg:text-6xl font-bold text-white">
                      {userData.name.charAt(0)}
                    </span>
                  </div>
                )}
                {/* Status Indicator */}
                <div className="absolute bottom-2 right-2 w-6 h-6 bg-emerald-500 border-3 border-white rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Profile Info with Enhanced Typography */}
            <div className="flex-1 min-w-0">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="profile-title">
                    {userData.name}
                  </h1>
                  {profile.isVerified && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                      <CheckCircle className="w-4 h-4" />
                      Verified
                    </div>
                  )}
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Link
                    href="/research"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 backdrop-blur-sm transition-colors hover:bg-white dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back To Research
                  </Link>
                  {isOwnProfile && (
                    <Link
                      href={`/research/profile/${userId}/manage`}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-emerald-700"
                    >
                      <Settings className="h-4 w-4" />
                      Manage Profile
                    </Link>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-lg text-gray-600 dark:text-gray-300 mb-4">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <span className="font-medium">{userData.designation}</span>
                  </div>
                  <span className="text-gray-400">•</span>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-500" />
                    <span>{userData.department}</span>
                  </div>
                  <span className="text-gray-400">•</span>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-purple-500" />
                    <span>{userData.school}</span>
                  </div>
                </div>

                {/* Quick Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="stats-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <Quote className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{profile.metrics.totalCitations}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Citations</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="stats-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{profile.metrics.hIndex}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">h-index</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="stats-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalPublications}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Publications</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="stats-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{coAuthors.length}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Collaborators</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                {profile.visibility.showEmail && (
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <a 
                      href={`mailto:${userData.email}`}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      {userData.email}
                    </a>
                    {profile.personalWebsite && (
                      <a 
                        href={profile.personalWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                      >
                        <Globe className="w-4 h-4" />
                        Website
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Navigation Tabs */}
      <div className="navigation-tabs">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: Eye },
                { id: 'publications', label: 'Publications', icon: BookOpen },
                { id: 'collaborations', label: 'Network', icon: Network },
                { id: 'metrics', label: 'Analytics', icon: BarChart3 },
                { id: 'analytics', label: 'Comprehensive Analytics', icon: Layers3 },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
            
            {/* View Controls */}
            <div className="flex items-center gap-3">
              {activeTab === 'publications' && (
                <>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      showFilters
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    Filters
                  </button>
                  <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-md transition-colors ${
                        viewMode === 'list'
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-md transition-colors ${
                        viewMode === 'grid'
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && activeTab === 'publications' && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Years</option>
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type:</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  {publicationTypes.map(type => (
                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="year">Year</option>
                  <option value="citations">Citations</option>
                  <option value="relevance">Relevance</option>
                </select>
              </div>
              
              <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                {filteredPublications.length} of {totalPublications} publications
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && (
          <OverviewTab 
            profile={profile} 
            userData={userData} 
            publications={publications}
            coAuthors={coAuthors}
            impactMetrics={impactMetrics}
            isOwnProfile={isOwnProfile}
            impactScore={impactScore}
            collaborationScore={collaborationScore}
            activityScore={activityScore}
            topCitedPaper={topCitedPaper}
            recentPublications={recentPublications}
          />
        )}
        
        {activeTab === 'publications' && (
          <PublicationsTab 
            publications={filteredPublications}
            viewMode={viewMode}
            totalPublications={totalPublications}
          />
        )}
        
        {activeTab === 'collaborations' && (
          <CollaborationsTab 
            coAuthors={coAuthors}
            userData={userData}
            publications={publications}
          />
        )}
        
        {activeTab === 'metrics' && (
          <MetricsTab 
            profile={profile}
            publications={publications}
            impactMetrics={impactMetrics}
            impactScore={impactScore}
            collaborationScore={collaborationScore}
            activityScore={activityScore}
          />
        )}
        
        {activeTab === 'analytics' && (
          <ComprehensiveAnalyticsTab 
            drdAnalyticsData={drdAnalyticsData}
            submissionsData={submissionsData}
            trackerWorks={trackerWorks}
            profileData={profileData}
            userId={userId}
          />
        )}
      </div>
    </div>
  );
}

// Loading Skeleton Component
function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/10">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-purple-600/5 to-emerald-600/5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
                             radial-gradient(circle at 75% 75%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)`
          }} />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col lg:flex-row items-start gap-8">
            <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="flex-1 space-y-6">
              <div className="space-y-3">
                <div className="h-12 w-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-6 w-80 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Advanced Tab Components
function OverviewTab({ 
  profile, 
  userData, 
  publications, 
  coAuthors, 
  impactMetrics, 
  isOwnProfile,
  impactScore,
  collaborationScore,
  activityScore,
  topCitedPaper,
  recentPublications
}: any) {
  return (
    <div className="space-y-8">
      {/* Research Impact Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Impact Score */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Research Impact</h3>
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{impactScore}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">/ 100</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-red-500 to-orange-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${impactScore}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Based on citations, h-index, and publication quality
            </p>
          </div>
        </div>

        {/* Collaboration Score */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Collaboration</h3>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Network className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{collaborationScore}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">/ 100</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${collaborationScore}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Network strength and co-authorship diversity
            </p>
          </div>
        </div>

        {/* Activity Score */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{activityScore}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">/ 100</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${activityScore}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {recentPublications} publications in last 2 years
            </p>
          </div>
        </div>
      </div>

      {/* Research Interests & Bio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Research Interests */}
        {profile.visibility.showResearchInterests && profile.researchInterests.length > 0 && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Research Interests</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              {profile.researchInterests.map((interest: string, index: number) => (
                <span
                  key={interest}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium border border-purple-200/50 dark:border-purple-700/50 hover:shadow-md transition-all duration-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <Sparkles className="w-3 h-3" />
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Quote className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">About</h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {profile.bio}
            </p>
          </div>
        )}
      </div>

      {/* Top Publications & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Cited Publication */}
        {topCitedPaper && topCitedPaper.citationCount > 0 && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                <Trophy className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Most Cited Work</h3>
            </div>
            <div className="space-y-3">
              <h4 className="text-lg font-medium text-blue-600 dark:text-blue-400 leading-snug">
                {topCitedPaper.title}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {topCitedPaper.venue} • {topCitedPaper.year}
              </p>
              <div className="flex items-center gap-2">
                <Quote className="w-4 h-4 text-amber-500" />
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {topCitedPaper.citationCount} citations
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Citation Trend Chart */}
        {profile.visibility.showMetrics && profile.metrics.citationsPerYear.length > 0 && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Citation Trend</h3>
            </div>
            <CitationTrendChart data={profile.metrics.citationsPerYear} variant="bar" />
          </div>
        )}
      </div>
    </div>
  );
}

function PublicationsTab({ publications, viewMode, totalPublications }: any) {
  if (viewMode === 'grid') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Publications</h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {publications.length} of {totalPublications} publications
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {publications.map((publication: any) => (
            <div key={publication.id} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl transition-all duration-300 group">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {publication.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {publication.venue} • {publication.year}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                    <Quote className="w-3 h-3" />
                    {publication.citationCount}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {publication.authors.slice(0, 3).map((author: any, index: number) => (
                    <span key={index} className="text-xs text-gray-500 dark:text-gray-400">
                      {author.name}
                      {index < Math.min(2, publication.authors.length - 1) && ', '}
                    </span>
                  ))}
                  {publication.authors.length > 3 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      +{publication.authors.length - 3} more
                    </span>
                  )}
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      publication.publicationType === 'journal' ? 'bg-blue-500' :
                      publication.publicationType === 'conference' ? 'bg-emerald-500' :
                      publication.publicationType === 'book' ? 'bg-purple-500' : 'bg-gray-500'
                    }`} />
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {publication.publicationType}
                    </span>
                  </div>
                  
                  {publication.isVerified && (
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      <span className="text-xs">Verified</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Publications</h2>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {publications.length} of {totalPublications} publications
        </div>
      </div>
      
      <PublicationList publications={publications} />
    </div>
  );
}

function CollaborationsTab({ coAuthors, userData, publications }: any) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Research Network</h2>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {coAuthors.length} collaborators
        </div>
      </div>

      {/* Network Visualization */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Collaboration Network</h3>
        <CoAuthorNetwork 
          coAuthors={coAuthors} 
          mainAuthorName={userData.name}
          onNodeClick={(coAuthor) => console.log('Clicked co-author:', coAuthor)}
        />
      </div>

      {/* Top Collaborators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {coAuthors.slice(0, 9).map((coAuthor: any) => (
          <div key={coAuthor.id} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">
                    {coAuthor.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {coAuthor.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {coAuthor.affiliation || 'SGT University'}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Collaborations</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {coAuthor.collaborationCount}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Period</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {coAuthor.firstCollaboration} - {coAuthor.lastCollaboration}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricsTab({ profile, publications, impactMetrics, impactScore, collaborationScore, activityScore }: any) {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Research Analytics</h2>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Quote className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {profile.metrics.totalCitations}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Citations</div>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {profile.metrics.hIndex}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">h-index</div>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Star className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {profile.metrics.i10Index}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">i10-index</div>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {publications.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Publications</div>
            </div>
          </div>
        </div>
      </div>

      {/* Citation Trend */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Citation Trend Over Time</h3>
        <div className="h-80">
          <CitationTrendChart data={profile.metrics.citationsPerYear} variant="line" />
        </div>
      </div>

      {/* Impact Distribution */}
      {impactMetrics && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Citation Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {impactMetrics.citationDistribution.map((dist: any) => (
              <div key={dist.range} className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {dist.count}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {dist.range} citations
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
