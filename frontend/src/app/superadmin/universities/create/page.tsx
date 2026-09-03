'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { superadminService, SaaSTier } from '@/shared/services/superadmin.service';
import { 
  ArrowLeft, 
  Building, 
  UserPlus, 
  Key, 
  Globe, 
  Loader2, 
  AlertTriangle, 
  CheckCircle 
} from 'lucide-react';
import Link from 'next/link';

export default function ProvisionNewUniversity() {
  const router = useRouter();
  const [tiers, setTiers] = useState<SaaSTier[]>([]);
  const [isLoadingTiers, setIsLoadingTiers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [slug, setSlug] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [tierId, setTierId] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    const fetchTiers = async () => {
      try {
        const data = await superadminService.getAllTiers();
        setTiers(data);
        if (data.length > 0) {
          setTierId(data[0].id);
        }
      } catch (err) {
        setErrorMsg('Failed to load subscription tiers.');
      } finally {
        setIsLoadingTiers(false);
      }
    };
    fetchTiers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      await superadminService.provisionUniversity({
        code,
        name,
        slug,
        contactEmail,
        websiteUrl,
        tierId,
        adminUsername,
        adminEmail,
        adminPassword
      });

      setSuccessMsg('University tenant and administrator account provisioned successfully!');
      setTimeout(() => {
        router.push('/superadmin/universities');
      }, 2000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Provisioning failed. Check fields and try again.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSlug = (val: string) => {
    setName(val);
    const generatedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setSlug(generatedSlug);
  };

  if (isLoadingTiers) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-10 w-10 text-red-600 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400">Loading provisioning workspace...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/superadmin/universities"
          className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Directory
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Provision University</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Deploy a new logically isolated tenant university container.</p>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl text-emerald-700 dark:text-emerald-400 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p>{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 rounded-xl text-red-700 dark:text-red-400 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p>{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: University Identity */}
        <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2 border-b border-gray-100 dark:border-gray-850 pb-3 text-gray-900 dark:text-white">
            <Building className="h-5 w-5 text-red-600" />
            University Identity & Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">University Name</label>
              <input
                type="text"
                required
                placeholder="e.g. SGT University"
                value={name}
                onChange={(e) => handleAutoSlug(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Acronym / Code</label>
              <input
                type="text"
                required
                placeholder="e.g. SGT"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Subdomain Slug</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  placeholder="sgt"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600 pr-24"
                />
                <span className="absolute right-4 text-xs font-semibold text-gray-400">.sgt-ums.com</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Contact Email Address</label>
              <input
                type="email"
                required
                placeholder="admin@university.edu"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Website URL</label>
              <input
                type="url"
                placeholder="https://university.edu"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600"
              />
            </div>
          </div>
        </div>

        {/* Step 2: License Plan */}
        <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2 border-b border-gray-100 dark:border-gray-850 pb-3 text-gray-900 dark:text-white">
            <Globe className="h-5 w-5 text-red-600" />
            License Plan & Terms
          </h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">SaaS Pricing Tier</label>
            <select
              value={tierId}
              onChange={(e) => setTierId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600 font-semibold"
            >
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName} (₹{t.monthlyPriceCents / 100}/mo, {t.maxApiCallsPerMonth === -1 ? 'unlimited' : `${t.maxApiCallsPerMonth / 1000000}M`} requests)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Step 3: Admin Provisioning */}
        <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2 border-b border-gray-100 dark:border-gray-850 pb-3 text-gray-900 dark:text-white">
            <UserPlus className="h-5 w-5 text-red-600" />
            Tenant Admin Account Creation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Administrator Username</label>
              <input
                type="text"
                required
                placeholder="e.g. sgt_admin"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Admin Email Address</label>
              <input
                type="email"
                required
                placeholder="admin@slug.sgt-ums.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Must be unique across the whole platform (not used by any other tenant admin or user).
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Password</label>
              <div className="relative flex items-center">
                <Key className="absolute left-4 text-gray-400 h-4 w-4" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end items-center gap-4">
          <Link
            href="/superadmin/universities"
            className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deploying Tenant Container...
              </>
            ) : (
              'Deploy & Onboard'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
