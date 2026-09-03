'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PublicNav from '@/shared/components/public/PublicNav';
import Wordmark from '@/shared/components/brand/Wordmark';
import {
  CheckCircle,
  XCircle,
  Zap,
  Building2,
  Globe,
  ChevronRight,
  HelpCircle,
  Star,
  Shield,
  Users,
  BarChart3,
  BookOpen,
  Lightbulb,
  DollarSign
} from 'lucide-react';

type BillingCycle = 'monthly' | 'annual';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    icon: Zap,
    tagline: 'Perfect for small departments',
    monthlyPrice: 24999,
    annualPrice: 19999,
    highlight: false,
    badge: null,
    color: 'border-gray-200',
    buttonClass: 'bg-gray-900 hover:bg-black text-white',
    features: [
      { label: 'Up to 100 researchers', included: true },
      { label: 'Research paper tracking', included: true },
      { label: 'IPR / Patent filing', included: true },
      { label: 'Basic analytics dashboard', included: true },
      { label: 'Email support', included: true },
      { label: 'Grants management', included: false },
      { label: 'Advanced analytics & reports', included: false },
      { label: 'DRD workflow automation', included: false },
      { label: 'Custom branding', included: false },
      { label: 'Dedicated account manager', included: false },
      { label: 'SLA guarantee', included: false },
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    icon: Building2,
    tagline: 'Ideal for growing institutions',
    monthlyPrice: 79999,
    annualPrice: 58333,
    highlight: true,
    badge: 'Most Popular',
    color: 'border-wine',
    buttonClass: 'bg-wine hover:bg-wine-dark text-white',
    features: [
      { label: 'Up to 500 researchers', included: true },
      { label: 'Research paper tracking', included: true },
      { label: 'IPR / Patent filing', included: true },
      { label: 'Advanced analytics dashboard', included: true },
      { label: 'Priority email & chat support', included: true },
      { label: 'Grants management', included: true },
      { label: 'Advanced analytics & reports', included: true },
      { label: 'DRD workflow automation', included: true },
      { label: 'Custom branding', included: false },
      { label: 'Dedicated account manager', included: false },
      { label: 'SLA guarantee (99.5%)', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: Globe,
    tagline: 'For large universities & consortiums',
    monthlyPrice: null,
    annualPrice: null,
    highlight: false,
    badge: null,
    color: 'border-amber',
    buttonClass: 'bg-amber hover:bg-amber-600 text-white',
    features: [
      { label: 'Unlimited researchers', included: true },
      { label: 'Research paper tracking', included: true },
      { label: 'IPR / Patent filing', included: true },
      { label: 'Enterprise analytics & BI', included: true },
      { label: '24/7 phone, email & chat support', included: true },
      { label: 'Grants management', included: true },
      { label: 'Advanced analytics & reports', included: true },
      { label: 'DRD workflow automation', included: true },
      { label: 'Custom branding & white-label', included: true },
      { label: 'Dedicated account manager', included: true },
      { label: 'SLA guarantee (99.9%)', included: true },
    ],
  },
];

const COMPARISON_ROWS = [
  { category: 'Research', label: 'Research paper submissions', starter: true, pro: true, enterprise: true },
  { category: 'Research', label: 'Book & chapter management', starter: true, pro: true, enterprise: true },
  { category: 'Research', label: 'Conference paper tracking', starter: true, pro: true, enterprise: true },
  { category: 'IPR', label: 'Patent / IPR filing', starter: true, pro: true, enterprise: true },
  { category: 'IPR', label: 'Multi-school assignment', starter: false, pro: true, enterprise: true },
  { category: 'Grants', label: 'Grant application & tracking', starter: false, pro: true, enterprise: true },
  { category: 'Grants', label: 'Grant analytics', starter: false, pro: true, enterprise: true },
  { category: 'Analytics', label: 'Basic dashboard', starter: true, pro: true, enterprise: true },
  { category: 'Analytics', label: 'Applicant analytics', starter: false, pro: true, enterprise: true },
  { category: 'Analytics', label: 'DRD member performance', starter: false, pro: true, enterprise: true },
  { category: 'Analytics', label: 'Custom BI reports', starter: false, pro: false, enterprise: true },
  { category: 'Workflows', label: 'Review & approval workflows', starter: true, pro: true, enterprise: true },
  { category: 'Workflows', label: 'DRD automation engine', starter: false, pro: true, enterprise: true },
  { category: 'Admin', label: 'Multiple admin accounts', starter: '2 admins', pro: '10 admins', enterprise: 'Unlimited' },
  { category: 'Admin', label: 'Custom branding & logo', starter: false, pro: false, enterprise: true },
  { category: 'Admin', label: 'Dedicated account manager', starter: false, pro: false, enterprise: true },
  { category: 'Support', label: 'Email support', starter: true, pro: true, enterprise: true },
  { category: 'Support', label: 'Priority support', starter: false, pro: true, enterprise: true },
  { category: 'Support', label: '24/7 support', starter: false, pro: false, enterprise: true },
];

const FAQS = [
  {
    q: 'Can I switch plans later?',
    a: 'Yes! You can upgrade or downgrade your plan at any time. Upgrades take effect immediately, and downgrades at the end of the billing cycle.',
  },
  {
    q: 'Is there a free trial?',
    a: 'We offer a 14-day pilot for the Professional plan. Contact our team to get started with no credit card required.',
  },
  {
    q: 'How does billing work?',
    a: 'We bill per university/tenant on a monthly or annual basis. Annual plans offer significant savings. All prices are in INR and exclude applicable taxes.',
  },
  {
    q: 'What is the SLA commitment?',
    a: 'Starter has no formal SLA. Professional guarantees 99.5% uptime and Enterprise guarantees 99.9% with compensation for downtime beyond the threshold.',
  },
  {
    q: 'Is data isolated between tenants?',
    a: 'Absolutely. ResearchSphere uses strict multi-tenant architecture with complete data isolation. One university cannot access another\'s data.',
  },
  {
    q: 'Can we have multiple admin accounts?',
    a: 'Yes. Starter supports 2 admin accounts, Professional supports 10, and Enterprise supports unlimited admins — all with role-based access control.',
  },
];

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(price);
}

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircle className="h-5 w-5 text-emerald-500 mx-auto" />;
  if (value === false) return <XCircle className="h-5 w-5 text-gray-300 mx-auto" />;
  return <span className="text-xs font-semibold text-gray-700">{value}</span>;
}

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingCycle>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-ivory font-sans antialiased">
      <PublicNav />

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-24">
        <div className="pointer-events-none absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-peach/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-wine/5 blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white border border-wine/20 text-wine text-xs font-bold px-4 py-2 rounded-full mb-6 shadow-sm">
            <Shield className="h-3.5 w-3.5" />
            Simple, Transparent Pricing
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-charcoal tracking-tight mb-4">
            Plans for Every<br />
            <span className="text-wine">Institution</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10">
            Choose the plan that fits your university's scale. All plans include core research management features with no hidden fees.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-1.5 shadow-sm">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${billing === 'monthly' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${billing === 'annual' ? 'bg-wine text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Annual
              {billing === 'annual' && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">Save 23%</span>}
            </button>
          </div>
          {billing === 'annual' && (
            <p className="text-emerald-600 text-xs font-semibold mt-3">🎉 Annual billing saves you up to ₹36,000/year</p>
          )}
        </div>
      </section>

      {/* ===== PLAN CARDS ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const price = billing === 'annual' ? plan.annualPrice : plan.monthlyPrice;
            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl border-2 ${plan.color} bg-white shadow-sm ${plan.highlight ? 'shadow-xl shadow-wine/10 scale-105 z-10' : 'hover:shadow-md'} transition-all duration-300 overflow-hidden`}
              >
                {plan.badge && (
                  <div className="absolute top-0 left-0 right-0 bg-wine text-white text-center text-xs font-extrabold py-1.5 tracking-wider uppercase">
                    {plan.badge}
                  </div>
                )}
                <div className={`p-8 ${plan.badge ? 'pt-10' : ''}`}>
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${plan.highlight ? 'bg-wine text-white' : 'bg-blush text-wine'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-charcoal">{plan.name}</h3>
                      <p className="text-xs text-gray-400">{plan.tagline}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6 pb-6 border-b border-gray-100">
                    {price ? (
                      <div>
                        {billing === 'annual' ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm text-gray-400 line-through font-normal">{formatPrice(plan.monthlyPrice!)}</span>
                              <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                {plan.id === 'starter' ? '20%' : '27%'} Off
                              </span>
                            </div>
                            <div className="text-4xl font-extrabold text-charcoal">
                              {formatPrice(plan.annualPrice!)}
                              <span className="text-base font-normal text-gray-400">/mo</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-4xl font-extrabold text-charcoal">
                            {formatPrice(plan.monthlyPrice!)}
                            <span className="text-base font-normal text-gray-400">/mo</span>
                          </div>
                        )}
                        {billing === 'annual' && (
                          <div className="text-xs text-gray-400 mt-2">
                            Billed annually · <span className="text-emerald-600 font-semibold">Save {formatPrice((plan.monthlyPrice! - plan.annualPrice!) * 12)}/yr</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="text-3xl font-extrabold text-charcoal">Custom Pricing</div>
                        <div className="text-xs text-gray-400 mt-1">Tailored to your institution</div>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <Link
                    href="/login"
                    className={`w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all hover:-translate-y-0.5 hover:shadow-lg mb-6 ${plan.buttonClass}`}
                  >
                    {plan.id === 'enterprise' ? 'Contact Sales' : 'Get Started'}
                    <ChevronRight className="h-4 w-4" />
                  </Link>

                  {/* Features */}
                  <ul className="space-y-3">
                    {plan.features.map(({ label, included }) => (
                      <li key={label} className={`flex items-start gap-2.5 text-sm ${included ? 'text-gray-700' : 'text-gray-300 line-through'}`}>
                        {included
                          ? <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          : <XCircle className="h-4 w-4 text-gray-200 flex-shrink-0 mt-0.5" />
                        }
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold text-charcoal tracking-tight mb-3">Full Feature Comparison</h2>
            <p className="text-gray-400">See exactly what's included in each plan.</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-sm font-bold text-gray-500 w-1/2">Feature</th>
                  <th className="text-center px-6 py-4 text-sm font-bold text-gray-500">Starter</th>
                  <th className="text-center px-6 py-4 text-sm font-bold text-wine bg-blush/40">Professional</th>
                  <th className="text-center px-6 py-4 text-sm font-bold text-amber-700">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let lastCategory = '';
                  return COMPARISON_ROWS.map((row, i) => {
                    const isNewCategory = row.category !== lastCategory;
                    lastCategory = row.category;
                    return (
                      <React.Fragment key={i}>
                        {isNewCategory && (
                          <tr className="bg-gray-50/70">
                            <td colSpan={4} className="px-6 py-2 text-xs font-extrabold text-gray-400 uppercase tracking-widest">
                              {row.category}
                            </td>
                          </tr>
                        )}
                        <tr className={`border-b border-gray-50 hover:bg-blush/20 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                          <td className="px-6 py-3.5 text-sm text-gray-700 font-medium">{row.label}</td>
                          <td className="px-6 py-3.5 text-center"><Cell value={row.starter} /></td>
                          <td className="px-6 py-3.5 text-center bg-blush/20"><Cell value={row.pro} /></td>
                          <td className="px-6 py-3.5 text-center"><Cell value={row.enterprise} /></td>
                        </tr>
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===== TRUSTED BY ===== */}
      <section className="py-16 bg-gradient-to-br from-blush to-ivory">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-8">What Our Customers Say About Pricing</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { name: 'VP Research', quote: 'The ROI was immediate. We replaced 4 separate tools with ResearchSphere and cut our admin costs by 60% in the first year.', stars: 5 },
              { name: 'Head IT', quote: 'Enterprise pricing was customized to our 3,000-researcher scale. The team was incredibly accommodating and transparent throughout.', stars: 5 },
            ].map(({ name, quote, stars }) => (
              <div key={name} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-left">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber text-amber" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 italic mb-3">&ldquo;{quote}&rdquo;</p>
                <p className="text-xs font-bold text-gray-400">— {name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold text-charcoal tracking-tight mb-3">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map(({ q, a }, i) => (
              <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-blush/30 transition-colors"
                >
                  <span className="font-bold text-charcoal text-sm">{q}</span>
                  <HelpCircle className={`h-5 w-5 flex-shrink-0 transition-all ${openFaq === i ? 'text-wine rotate-180' : 'text-gray-300'}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-50 pt-3 bg-gray-50/50">
                    {a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-20 bg-gradient-to-br from-wine to-wine-darker mx-4 sm:mx-8 lg:mx-16 rounded-3xl mb-16 relative overflow-hidden text-center">
        <div className="pointer-events-none absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="relative max-w-2xl mx-auto px-6">
          <h2 className="text-4xl font-extrabold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-white/70 text-lg mb-8">Talk to our team and get a customized demo for your institution.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-wine font-extrabold text-base rounded-2xl hover:bg-ivory transition-all hover:-translate-y-0.5 shadow-xl">
              Sign In to Platform
              <ChevronRight className="h-5 w-5" />
            </Link>
            <a href="mailto:mrinal11092002@gmail.com" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 border border-white/20 text-white font-bold text-base rounded-2xl hover:bg-white/20 transition-all hover:-translate-y-0.5 backdrop-blur-sm">
              Contact Sales
            </a>
          </div>
        </div>
      </section>

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
