'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { superadminService, University, SaaSTier, UniversityAdmin } from '@/shared/services/superadmin.service';
import { generateAffiliationVariants } from '@/shared/utils/affiliationEngine';
import { 
  ArrowLeft, 
  Building, 
  Calendar, 
  CreditCard, 
  Users, 
  Activity, 
  Power, 
  ExternalLink, 
  Loader2, 
  AlertTriangle, 
  CheckCircle,
  ShieldAlert,
  Plus,
  KeyRound,
  X,
  Tags,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';

export default function UniversityDetails() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [university, setUniversity] = useState<University | null>(null);
  const [tiers, setTiers] = useState<SaaSTier[]>([]);
  const [admins, setAdmins] = useState<UniversityAdmin[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Editing Fields
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Affiliation Variants
  const [affiliationAliases, setAffiliationAliases] = useState<string[]>([]);
  const [newAliasInput, setNewAliasInput] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add Admin State
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ uid: '', email: '', password: '' });
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');

  const fetchUniversityData = async () => {
    try {
      const [uniData, tiersData, adminsData] = await Promise.all([
        superadminService.getUniversityById(id),
        superadminService.getAllTiers(),
        superadminService.getUniversityAdmins(id)
      ]);
      setUniversity(uniData);
      setTiers(tiersData);
      setAdmins(adminsData);

      // Populate edit states
      setName(uniData.name);
      setLogoUrl(uniData.logoUrl || '');
      setPrimaryColor(uniData.primaryColor || '');
      setContactEmail(uniData.contactEmail || '');
      setWebsiteUrl(uniData.websiteUrl || '');
      setIsActive(uniData.isActive);
      setCity(uniData.city || '');
      setState(uniData.state || '');
      setAffiliationAliases(Array.isArray(uniData.affiliationAliases) ? uniData.affiliationAliases : []);
    } catch (err) {
      setError('Failed to fetch university details.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchUniversityData();
    }
  }, [id]);

  // Live affiliation variants: generate instantly on the client (same algorithm
  // as the backend), and optionally refresh from the API when available.
  const generatedVariants = useMemo(
    () =>
      generateAffiliationVariants({
        name,
        code: university?.code,
        city,
        state,
        extraAliases: affiliationAliases,
      }),
    [name, city, state, affiliationAliases, university?.code]
  );

  useEffect(() => {
    if (!id || !name) return;
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(async () => {
      try {
        setIsPreviewLoading(true);
        await superadminService.previewAffiliationVariants(id, {
          name,
          city,
          state,
          aliases: affiliationAliases,
        });
        // Client-side list is already authoritative for the live preview;
        // API call validates the endpoint is healthy for save/sync consumers.
      } catch (err) {
        console.warn('Affiliation preview API unavailable; using client-side variants.', err);
      } finally {
        setIsPreviewLoading(false);
      }
    }, 500);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [id, name, city, state, affiliationAliases]);

  const handleAddAlias = () => {
    const trimmed = newAliasInput.trim();
    if (!trimmed || affiliationAliases.includes(trimmed)) return;
    setAffiliationAliases([...affiliationAliases, trimmed]);
    setNewAliasInput('');
  };

  const handleRemoveAlias = (alias: string) => {
    setAffiliationAliases(affiliationAliases.filter((a) => a !== alias));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const updated = await superadminService.updateUniversity(id, {
        name,
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || null,
        contactEmail: contactEmail || null,
        websiteUrl: websiteUrl || null,
        isActive,
        city: city || null,
        state: state || null,
        affiliationAliases,
      });
      setUniversity(prev => prev ? { ...prev, ...updated } : null);
      setSuccess('University settings updated successfully.');
    } catch (err) {
      setError('Failed to save settings.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!university) return;
    try {
      setIsSubmitting(true);
      await superadminService.suspendUniversity(id, university.isActive);
      setSuccess(university.isActive ? 'University has been suspended.' : 'University has been activated.');
      await fetchUniversityData();
    } catch (err) {
      setError('Failed to update status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImpersonate = () => {
    if (!university) return;
    localStorage.setItem('superadmin-impersonate-university-id', university.id);
    window.location.href = '/dashboard';
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setIsAddingAdmin(true);

    try {
      const added = await superadminService.createUniversityAdmin(id, {
        adminUsername: newAdmin.uid,
        adminEmail: newAdmin.email,
        adminPassword: newAdmin.password
      });
      setAdmins([...admins, added]);
      setIsAddAdminModalOpen(false);
      setNewAdmin({ uid: '', email: '', password: '' });
      setSuccess(`Admin account ${added.uid} created successfully.`);
    } catch (err: any) {
      setAdminError(err.response?.data?.message || 'Failed to create admin account.');
    } finally {
      setIsAddingAdmin(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-10 w-10 text-wine animate-spin" />
        <p className="text-gray-500 dark:text-gray-400">Loading university container...</p>
      </div>
    );
  }

  if (!university) {
    return (
      <div className="bg-wine/5 dark:bg-wine/20 border border-wine/20 dark:border-wine/40 p-6 rounded-2xl max-w-xl mx-auto text-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-wine mx-auto" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">University Container Not Found</h2>
        <p className="text-gray-500">The university ID is invalid or has been decommissioned.</p>
        <Link href="/superadmin/universities" className="inline-block bg-wine hover:bg-wine-dark text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
          Return to Directory
        </Link>
      </div>
    );
  }

  const formatNumber = (num?: number) => {
    if (num === undefined) return '0';
    return new Intl.NumberFormat('en-IN').format(num);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top action bar */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <Link
          href="/superadmin/universities"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-wine dark:text-gray-400 dark:hover:text-amber-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Directory
        </Link>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleToggleStatus}
            disabled={isSubmitting}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
              university.isActive
                ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-400'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400'
            }`}
          >
            <Power className="h-4 w-4" />
            {university.isActive ? 'Suspend' : 'Activate'}
          </button>

          <button
            onClick={handleImpersonate}
            className="inline-flex items-center gap-2 bg-wine hover:bg-wine-dark text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-brand transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Login as Admin
          </button>
        </div>
      </div>

      {/* Hero Header — premium gradient banner */}
      <div className="relative overflow-hidden rounded-2xl bg-brand-gradient shadow-brand-lg">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #E28B22 0%, transparent 50%)' }} />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full bg-amber/10 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 p-6 sm:p-8">
          <div className="h-20 w-20 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg overflow-hidden">
            {university.logoUrl ? (
              <img src={university.logoUrl} alt={university.name} className="h-full w-full object-cover" />
            ) : (
              <Building className="h-10 w-10" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                university.isActive
                  ? 'bg-emerald-400/20 text-emerald-50 border border-emerald-300/30'
                  : 'bg-red-400/20 text-red-50 border border-red-300/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${university.isActive ? 'bg-emerald-300' : 'bg-red-300'}`} />
                {university.isActive ? 'Active' : 'Suspended'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{university.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/70 text-sm mt-2">
              <span>Code: <span className="font-semibold text-white">{university.code}</span></span>
              <span className="text-white/30">•</span>
              <span>Slug: <span className="font-semibold text-white">{university.slug}</span></span>
              <span className="text-white/30">•</span>
              <a href={`https://${university.slug}.sgt-ums.com`} target="_blank" className="text-amber-300 hover:text-amber-200 font-medium inline-flex items-center gap-1 hover:underline">
                {university.slug}.sgt-ums.com <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl text-emerald-700 dark:text-emerald-400 flex items-start gap-3 shadow-sm">
          <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p className="font-medium">{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-wine/5 dark:bg-wine/20 border border-wine/20 dark:border-wine/40 p-4 rounded-xl text-wine dark:text-amber-400 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Grid: Stats & Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Stats & Subscription */}
        <div className="space-y-6 lg:col-span-1">
          {/* Stats Card */}
          <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-wine/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-wine" />
              </div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400">Database Size</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl bg-blush dark:bg-gray-900/60">
                <Users className="h-4 w-4 text-wine mx-auto mb-1.5" />
                <div className="text-xl font-extrabold text-gray-950 dark:text-white">{formatNumber(university.stats?.users)}</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Users</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-blush dark:bg-gray-900/60">
                <Building className="h-4 w-4 text-wine mx-auto mb-1.5" />
                <div className="text-xl font-extrabold text-gray-950 dark:text-white">{formatNumber(university.stats?.schools)}</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Schools</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-blush dark:bg-gray-900/60">
                <Building className="h-4 w-4 text-wine mx-auto mb-1.5" />
                <div className="text-xl font-extrabold text-gray-950 dark:text-white">{formatNumber(university.stats?.centralDepts)}</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Depts</div>
              </div>
            </div>
          </div>

          {/* Subscription Card */}
          <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-amber-dark" />
              </div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400">Subscription</h3>
            </div>
            {university.subscription ? (
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 uppercase font-bold">Tier Plan</span>
                  <div className="font-bold text-base text-gray-950 dark:text-white flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-wine" />
                    {university.subscription.tierName}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 uppercase font-bold">Status</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-full text-xs font-bold uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {university.subscription.status}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-3">
                  <span className="text-gray-500 font-medium flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Billing Cycle</span>
                  <span className="font-bold capitalize text-gray-800 dark:text-gray-200">{university.subscription.billingCycle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Period Ends</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    {new Date(university.subscription.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No subscription found for this university.</p>
            )}
          </div>
        </div>

        {/* Right Column: Settings & Admins */}
        <div className="lg:col-span-2 space-y-6">

          {/* General Settings */}
          <div className="bg-white dark:bg-gray-950 p-6 sm:p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-4 mb-6">
              <div className="w-9 h-9 rounded-lg bg-wine/10 flex items-center justify-center">
                <Building className="h-4.5 w-4.5 text-wine" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">General Settings &amp; Configuration</h3>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SGT University"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-blush/50 dark:bg-gray-900 outline-none text-sm focus:border-wine focus:ring-2 focus:ring-wine/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Primary Color</label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="e.g. #841C43"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-blush/50 dark:bg-gray-900 outline-none text-sm focus:border-wine focus:ring-2 focus:ring-wine/10 pl-11 transition-all"
                    />
                    <div
                      className="absolute left-3 w-5 h-5 rounded border border-gray-200 dark:border-gray-700 shadow-sm"
                      style={{ backgroundColor: primaryColor || '#eee' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Logo URL</label>
                  <input
                    type="url"
                    placeholder="https://domain.com/logo.png"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-blush/50 dark:bg-gray-900 outline-none text-sm focus:border-wine focus:ring-2 focus:ring-wine/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Contact Email</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@university.edu"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-blush/50 dark:bg-gray-900 outline-none text-sm focus:border-wine focus:ring-2 focus:ring-wine/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Website URL</label>
                  <input
                    type="url"
                    placeholder="https://university.edu"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-blush/50 dark:bg-gray-900 outline-none text-sm focus:border-wine focus:ring-2 focus:ring-wine/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Gurugram"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-blush/50 dark:bg-gray-900 outline-none text-sm focus:border-wine focus:ring-2 focus:ring-wine/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">State</label>
                  <input
                    type="text"
                    placeholder="e.g. Haryana"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-blush/50 dark:bg-gray-900 outline-none text-sm focus:border-wine focus:ring-2 focus:ring-wine/10 transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-wine hover:bg-wine-dark disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-brand transition-all hover:-translate-y-0.5 active:translate-y-0 inline-flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {isSubmitting ? 'Saving Changes...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>

          {/* Affiliation Variants */}
          <div className="bg-white dark:bg-gray-950 p-6 sm:p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-800 pb-4 mb-6">
              <div className="w-9 h-9 rounded-lg bg-wine/10 flex items-center justify-center">
                <Tags className="h-4.5 w-4.5 text-wine" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Affiliation Variants</h3>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  Name variants the system recognizes as this university when matching author affiliations during publication sync.
                </p>
              </div>
              {isPreviewLoading && <Loader2 className="h-4 w-4 text-wine animate-spin ml-auto" />}
            </div>

            {/* Auto-detected variants (read-only, live-generated) */}
            <div className="mb-6">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Auto-detected ({generatedVariants.length})
                </span>
              </div>
              {generatedVariants.length === 0 && !isPreviewLoading ? (
                <p className="text-xs text-gray-400 italic">
                  {name.trim()
                    ? 'No variants could be derived from the current name.'
                    : 'No variants generated yet — enter a Display Name above.'}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {generatedVariants.map((variant) => (
                    <span
                      key={variant}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-blush/60 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800"
                    >
                      {variant}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Custom aliases (editable overrides) */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">
                Custom Aliases ({affiliationAliases.length})
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {affiliationAliases.map((alias) => (
                  <span
                    key={alias}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-wine/10 text-wine dark:bg-wine/20 dark:text-amber-400 border border-wine/20 dark:border-wine/40"
                  >
                    {alias}
                    <button
                      type="button"
                      onClick={() => handleRemoveAlias(alias)}
                      className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {affiliationAliases.length === 0 && (
                  <p className="text-xs text-gray-400 italic">
                    No custom aliases yet. Add old names, transliterations, or misspellings the engine might miss.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. Shri Guru Gobind Singh University"
                  value={newAliasInput}
                  onChange={(e) => setNewAliasInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAlias();
                    }
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-blush/50 dark:bg-gray-900 outline-none text-sm focus:border-wine focus:ring-2 focus:ring-wine/10 transition-all"
                />
                <button
                  type="button"
                  onClick={handleAddAlias}
                  className="inline-flex items-center gap-1.5 bg-wine hover:bg-wine-dark text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-brand transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Custom aliases are saved with the university and merged into the live variant list above. Remember to click{' '}
                <span className="font-semibold text-gray-500 dark:text-gray-400">Save Configuration</span> to persist changes.
              </p>
            </div>
          </div>

          {/* Tenant Administrators */}
          <div className="bg-white dark:bg-gray-950 p-6 sm:p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-4 border-b border-gray-100 dark:border-gray-800 pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-wine/10 flex items-center justify-center">
                  <KeyRound className="h-4.5 w-4.5 text-wine" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tenant Administrators</h3>
                  <p className="text-xs font-medium text-gray-500 mt-0.5">Manage admin credentials for this university.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddAdminModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 bg-wine hover:bg-wine-dark text-white px-4 py-2 rounded-xl text-sm font-bold shadow-brand transition-all"
              >
                <Plus className="h-4 w-4" />
                Add Admin
              </button>
            </div>

            {/* List of admins */}
            <div className="space-y-3">
              {admins.map((admin) => (
                <div key={admin.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-blush/40 dark:bg-gray-900/50 hover:bg-blush dark:hover:bg-gray-900 transition-colors">
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {admin.uid}
                      <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        admin.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900'
                          : 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${admin.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {admin.status}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>{admin.email}</span>
                      <span className="text-gray-400">|</span>
                      <span>Created {new Date(admin.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
              {admins.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm font-medium">
                  No administrators found.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Add Admin Modal — proper centered overlay */}
      {isAddAdminModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-wine/10 flex items-center justify-center">
                  <KeyRound className="h-4 w-4 text-wine" />
                </div>
                <h4 className="font-bold text-gray-900 dark:text-white">Create Tenant Admin</h4>
              </div>
              <button
                onClick={() => setIsAddAdminModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {adminError && (
              <div className="mx-6 mt-4 bg-wine/5 dark:bg-wine/20 text-wine dark:text-amber-400 p-3 rounded-lg text-sm font-semibold border border-wine/20 dark:border-wine/40">
                {adminError}
              </div>
            )}

            <form onSubmit={handleAddAdmin} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Username (UID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. admin_sgt"
                  value={newAdmin.uid}
                  onChange={(e) => setNewAdmin({ ...newAdmin, uid: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-blush/50 dark:bg-gray-900 text-sm outline-none focus:border-wine focus:ring-2 focus:ring-wine/10 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="admin@university.edu"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-blush/50 dark:bg-gray-900 text-sm outline-none focus:border-wine focus:ring-2 focus:ring-wine/10 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Secure password"
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-blush/50 dark:bg-gray-900 text-sm outline-none focus:border-wine focus:ring-2 focus:ring-wine/10 transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddAdminModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingAdmin}
                  className="flex-1 bg-wine hover:bg-wine-dark disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold shadow-brand transition-colors inline-flex items-center justify-center gap-2"
                >
                  {isAddingAdmin && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isAddingAdmin ? 'Provisioning...' : 'Provision Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
