'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import PublicNav from '@/shared/components/public/PublicNav';
import Wordmark from '@/shared/components/brand/Wordmark';
import {
  BookOpen,
  Lightbulb,
  BarChart3,
  Users,
  ShieldCheck,
  Workflow,
  FileText,
  Building2,
  ArrowRight,
  CheckCircle,
  Globe,
  Zap,
  Award,
  TrendingUp,
  ChevronRight,
  DollarSign,
  Calendar,
  GraduationCap,
  Play,
  Sparkles,
  Lock,
  BrainCircuit,
  Layers,
  LineChart,
  Shield,
  Landmark,
} from 'lucide-react';

/* ─────────────────── DATA ─────────────────── */
// Every claim on this page must describe something the product does today.
const FEATURES = [
  { icon: BookOpen, gradient: 'from-blue-500 to-indigo-600', title: 'Research Management', description: 'Papers, books, chapters and conference papers move from submission through review to approval in one workspace.' },
  { icon: Lightbulb, gradient: 'from-amber-500 to-orange-500', title: 'IPR & Patent Workflow', description: 'File patents, copyrights, trademarks and designs, and follow each application through mentor, DRD and dean review to filing.' },
  { icon: DollarSign, gradient: 'from-emerald-500 to-teal-600', title: 'Grant Applications', description: 'Submit grant proposals with investigators and consortium partners, and route them through review and approval.' },
  { icon: BarChart3, gradient: 'from-violet-500 to-purple-600', title: 'DRD Analytics', description: 'Dashboards for submissions, outcomes and reviewer turnaround by school, department and person, with CSV export.' },
  { icon: Workflow, gradient: 'from-rose-500 to-pink-600', title: 'Review Workflows', description: 'Multi-stage review and approval with school-wise routing of IPR, research, book, conference and grant submissions.' },
  { icon: Award, gradient: 'from-sky-500 to-blue-600', title: 'Incentive Policies', description: 'Configure incentive amounts and points per contribution type; they are calculated automatically when work is approved.' },
  { icon: Users, gradient: 'from-teal-500 to-cyan-600', title: 'Researcher Profiles', description: 'Public researcher profiles, with publications synced from ORCID, Scopus and OpenAlex.' },
  { icon: ShieldCheck, gradient: 'from-slate-600 to-gray-700', title: 'Security & DPDP', description: 'Tenant data isolation, role-based access control, audit logs, and tools for India’s DPDP Act.' },
];

const AUDIENCES = [
  { icon: GraduationCap, title: 'Researchers & students', desc: 'Submit work once, see exactly where it is in review, respond to change requests, and keep a public profile up to date.' },
  { icon: Workflow, title: 'DRD reviewers', desc: 'Work from a queue of assigned submissions, suggest edits, request changes and record decisions with a full history.' },
  { icon: LineChart, title: 'Deans & leadership', desc: 'Approve what reaches you and follow output and turnaround across schools and departments in the analytics dashboards.' },
  { icon: Landmark, title: 'Finance & administrators', desc: 'Set incentive policies, process IPR incentive payments, manage users and roles, and handle DPDP requests.' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Onboard Your University', desc: 'Superadmins provision your tenant in minutes. Configure departments, schools, and user roles to match your org structure.', icon: Building2 },
  { step: '02', title: 'Activate Your Team', desc: 'Admins provision faculty, staff, and student accounts. Assign roles, permissions, and department hierarchies instantly.', icon: Users },
  { step: '03', title: 'Track & Grow', desc: 'Start filing research, tracking IPR, managing grants, and generating analytics reports from day one.', icon: TrendingUp },
];

const MODULES = [
  { label: 'Research Papers', icon: BookOpen },
  { label: 'Book Chapters', icon: FileText },
  { label: 'Conference Papers', icon: Calendar },
  { label: 'IPR / Patents', icon: Lightbulb },
  { label: 'Grants Management', icon: DollarSign },
  { label: 'DRD Analytics', icon: BarChart3 },
  { label: 'Incentive Policies', icon: Award },
  { label: 'Researcher Profiles', icon: Users },
  { label: 'Student Submissions', icon: GraduationCap },
  { label: 'Bulk Uploads', icon: Zap },
  { label: 'Research Intelligence (AI)', icon: BrainCircuit },
  { label: 'DPDP Compliance', icon: Shield },
  { label: 'Multi-Tenant SaaS', icon: Layers },
];

/* Facts about the product's scope (not usage figures), animated by CountUp. */
const HERO_STAT_BAR = [
  { icon: FileText, end: 5, suffix: '', label: 'Contribution types', color: 'bg-rose-50 text-rose-600' },
  { icon: Lightbulb, end: 4, suffix: '', label: 'IPR types', color: 'bg-amber-50 text-amber-600' },
  { icon: Globe, end: 3, suffix: '', label: 'Publication sources synced', color: 'bg-violet-50 text-violet-600' },
  { icon: ShieldCheck, end: 6, suffix: '', label: 'DPDP request types', color: 'bg-emerald-50 text-emerald-600' },
];

const TRUST_BADGES = [
  { icon: CheckCircle, label: 'ORCID · Scopus · OpenAlex sync' },
  { icon: Shield, label: 'DPDP compliance tools' },
  { icon: Building2, label: 'Isolated multi-tenant data' },
];

const PLATFORM_HIGHLIGHTS = [
  { icon: BrainCircuit, title: 'Research Intelligence', desc: 'An AI assistant that answers questions about experts, publications, topics and trends across your institution.' },
  { icon: LineChart, title: 'Analytics Dashboards', desc: 'Submission, outcome and reviewer-turnaround analytics by school, department and person, exportable to CSV.' },
  { icon: Lock, title: 'Role-Based Security', desc: 'Granular roles and permissions, per-university data isolation, and audit logs of administrative actions.' },
  { icon: Shield, title: 'DPDP Compliance Tools', desc: 'Consent notices, data-principal requests, breach records and retention policies for India’s DPDP Act.' },
];
/* ─────────────────── FADE-IN ─────────────────── */
function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If already on-screen (common for above-the-fold sections), show immediately.
    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (inView) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: '80px 0px' }
    );
    observer.observe(el);

    // Safety net — never leave content stuck invisible
    const fallback = window.setTimeout(() => setVisible(true), 1200);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────── COUNT-UP (hardcoded targets, scroll-triggered) ─────────────────── */
function CountUp({
  end,
  suffix = '',
  className = 'text-xl sm:text-2xl font-extrabold text-charcoal leading-tight tabular-nums',
  duration = 2000,
  delay = 0,
  formatWithCommas = false,
}: {
  end: number;
  suffix?: string;
  className?: string;
  duration?: number;
  delay?: number;
  formatWithCommas?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const hasRun = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const run = () => {
      if (hasRun.current || cancelled) return;
      hasRun.current = true;

      startTimer = setTimeout(() => {
        const t0 = performance.now();
        const frame = (now: number) => {
          if (cancelled) return;
          const progress = Math.min(1, (now - t0) / duration);
          const eased = 1 - (1 - progress) ** 3;
          setValue(end * eased);
          if (progress < 1) {
            raf = requestAnimationFrame(frame);
          } else {
            setValue(end);
          }
        };
        raf = requestAnimationFrame(frame);
      }, delay);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);

    // If already on screen after layout, start without waiting for scroll
    const checkVisible = () => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92 && r.bottom > 40) run();
    };
    const layoutTimer = window.setTimeout(checkVisible, 50);
    // Absolute safety — never leave at 0 forever
    const forceTimer = window.setTimeout(run, 2000);

    return () => {
      cancelled = true;
      hasRun.current = false;
      observer.disconnect();
      window.clearTimeout(layoutTimer);
      window.clearTimeout(forceTimer);
      if (startTimer) clearTimeout(startTimer);
      cancelAnimationFrame(raf);
    };
  }, [end, duration, delay, formatWithCommas]);

  return (
    <span ref={ref} className={className}>
      {formatWithCommas ? Math.round(value).toLocaleString('en-IN') : Math.round(value)}
      {suffix}
    </span>
  );
}

/* ─────────────────── PAGE ─────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ivory font-sans antialiased">
      <PublicNav />

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative overflow-hidden pt-20 pb-12 sm:pt-28 sm:pb-16 lg:pt-32 lg:pb-20 bg-white">
        <div className="pointer-events-none absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-peach/12 blur-3xl" />

        {/* Full-bleed hero — text padded left, photo fills the right edge */}
        <div className="relative w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-0 items-center">

            {/* Left — text */}
            <div className="lg:col-span-4 space-y-6 lg:space-y-7 px-5 sm:px-8 lg:pl-10 xl:pl-14 2xl:pl-20 lg:pr-4">
              <div className="inline-flex items-center gap-2 bg-white border border-wine/15 text-wine text-xs font-bold px-4 py-2 rounded-full shadow-sm">
                <Zap className="h-3.5 w-3.5 fill-wine" />
                Enterprise Research Management · SaaS Platform
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] xl:text-[4rem] 2xl:text-[4.5rem] font-extrabold text-charcoal tracking-tight leading-[1.08]">
                Where Ideas
                <br />
                <span className="text-wine">Become</span>{' '}
                <span className="text-amber">Impact</span>
              </h1>

              <p className="text-base sm:text-lg xl:text-xl text-charcoal/55 max-w-md leading-relaxed">
                ResearchSphere empowers universities to manage research, patents, grants, and publications — all in one unified, intelligent platform built for academic excellence.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-1">
                <Link
                  href="/pricing"
                  className="group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 xl:px-8 xl:py-4 bg-wine text-wine-fg text-sm sm:text-base font-bold rounded-2xl hover:bg-wine-dark transition-all duration-200 shadow-lg shadow-wine/20 hover:shadow-xl hover:shadow-wine/30 hover:-translate-y-0.5"
                >
                  View Plans & Pricing
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 xl:px-8 xl:py-4 bg-white text-charcoal text-sm sm:text-base font-bold rounded-2xl border border-gray-200 hover:bg-blush hover:border-wine/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  Sign In to Platform
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
                {TRUST_BADGES.map(({ icon: Icon, label }) => (
                  <div key={label} className="inline-flex items-center gap-1.5 text-sm text-charcoal/45">
                    <Icon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — large borderless photo filling to the right edge */}
            <div className="lg:col-span-8 relative px-5 sm:px-8 lg:px-0">
              <div className="relative w-full min-h-[320px] sm:min-h-[400px] lg:min-h-[520px] xl:min-h-[600px] 2xl:min-h-[680px]">
                <img
                  src="/images/hero-researcher.png"
                  alt="Researcher using ResearchSphere"
                  className="absolute inset-0 w-full h-full object-cover object-[center_28%]"
                />
                {/* Soft white fades — no card border */}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-24 lg:w-32 bg-gradient-to-r from-white via-white/75 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-10 sm:h-14 bg-gradient-to-b from-white via-white/50 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 sm:h-14 bg-gradient-to-t from-white via-white/50 to-transparent" />
              </div>
            </div>

          </div>

          {/* Stat bar + trusted — always visible (no fade gate) */}
          <div className="px-5 sm:px-8 lg:px-12 xl:px-16">
            <div className="mt-10 sm:mt-12">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-6 sm:px-10 py-7 grid grid-cols-2 sm:grid-cols-4 gap-8 sm:divide-x divide-gray-100">
                {HERO_STAT_BAR.map(({ icon: Icon, end, suffix, label, color }, i) => (
                  <div key={label} className="flex items-center gap-3 sm:pl-8 sm:first:pl-0">
                    <div className={`w-11 h-11 rounded-2xl ${color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CountUp end={end} suffix={suffix} delay={i * 120} duration={2000} />
                      <div className="text-xs text-charcoal/45 font-medium">{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ MODULES TICKER ═══════════ */}
      <div className="bg-wine/4 border-y border-wine/10 py-4 overflow-hidden">
        <div className="flex gap-10 whitespace-nowrap" style={{ animation: 'ticker 30s linear infinite' }}>
          {[...MODULES, ...MODULES, ...MODULES].map((m, i) => (
            <div key={i} className="inline-flex items-center gap-2.5 text-sm font-semibold text-wine/60 flex-shrink-0">
              <m.icon className="h-4 w-4" />
              {m.label}
              <span className="text-wine/25 ml-2">◆</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════ PLATFORM HIGHLIGHTS ═══════════ */}
      <section className="py-28 bg-gradient-to-br from-wine-darker via-wine-dark to-wine">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Decorative texture */}
          <div
            className="pointer-events-none absolute left-0 right-0 h-full opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(#FDD7BF 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          />
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 border border-white/15 bg-white/8 text-white/60 text-xs font-semibold px-4 py-2 rounded-full mb-5">
              <Sparkles className="h-3.5 w-3.5 text-amber" />
              Why ResearchSphere
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Built Different.
              <br />
              <span className="text-amber">Designed for Excellence.</span>
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLATFORM_HIGHLIGHTS.map(({ icon: Icon, title, desc }, i) => (
              <FadeIn key={title} delay={i * 100}>
                <div className="group relative rounded-3xl border border-white/10 bg-white/8 backdrop-blur-sm p-8 hover:border-white/25 hover:bg-white/12 transition-all duration-300 h-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-peach/0 to-amber/0 group-hover:from-peach/8 group-hover:to-amber/5 transition-all duration-500 rounded-3xl" />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                      <Icon className="h-6 w-6 text-amber" strokeWidth={1.8} />
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURES GRID ═══════════ */}
      <section className="py-28 bg-ivory">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center max-w-2xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 bg-blush border border-peach text-wine text-xs font-bold px-4 py-2 rounded-full mb-5">
              <Globe className="h-3.5 w-3.5" />
              Everything You Need
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-charcoal tracking-tight leading-tight mb-4">
              A Complete Research<br />Management Ecosystem
            </h2>
            <p className="text-charcoal/50 text-lg leading-relaxed">
              From first submission to final publication — every step of the research lifecycle managed in one place.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, gradient, title, description }, i) => (
              <FadeIn key={title} delay={i * 60}>
                <div className="group relative bg-white rounded-3xl p-7 border border-gray-100 hover:border-wine/15 shadow-sm hover:shadow-xl hover:shadow-wine/5 transition-all duration-300 hover:-translate-y-1.5 overflow-hidden h-full">
                  <div className="relative">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} mb-5 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="h-6 w-6 text-white" strokeWidth={1.8} />
                    </div>
                    <h3 className="text-[15px] font-bold text-charcoal mb-2.5 group-hover:text-wine transition-colors">{title}</h3>
                    <p className="text-sm text-charcoal/50 leading-relaxed">{description}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="py-28 bg-gradient-to-br from-blush to-ivory">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center max-w-2xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 bg-white border border-wine/15 text-wine text-xs font-bold px-4 py-2 rounded-full mb-5 shadow-sm">
              <Play className="h-3 w-3 fill-wine" />
              How It Works
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-charcoal tracking-tight leading-tight mb-4">
              Simple to<br />Roll Out
            </h2>
            <p className="text-charcoal/50 text-lg">Set up your structure, bring in your people, and start filing — bulk import helps with the first load.</p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop only) */}
            <div className="hidden md:block absolute top-[68px] left-[calc(16.67%+40px)] right-[calc(16.67%+40px)] h-px bg-gradient-to-r from-peach via-wine/20 to-peach" />

            {HOW_IT_WORKS.map(({ step, title, desc, icon: Icon }, i) => (
              <FadeIn key={step} delay={i * 150}>
                <div className="relative bg-white rounded-3xl p-8 border border-white shadow-sm hover:shadow-xl hover:shadow-wine/5 transition-all duration-300 hover:-translate-y-1">
                  {/* Step circle */}
                  <div className="relative z-10 inline-flex items-center justify-center w-14 h-14 bg-wine text-wine-fg font-extrabold text-lg rounded-2xl shadow-lg shadow-wine/30 mb-6">
                    {step}
                  </div>
                  <div className="w-12 h-12 bg-blush rounded-2xl flex items-center justify-center mb-5">
                    <Icon className="h-6 w-6 text-wine" />
                  </div>
                  <h3 className="text-xl font-bold text-charcoal mb-3">{title}</h3>
                  <p className="text-charcoal/50 leading-relaxed text-sm">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ WHO IT'S FOR ═══════════ */}
      <section className="py-28 bg-ivory">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center max-w-2xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 bg-amber/10 border border-amber/25 text-amber-700 text-xs font-bold px-4 py-2 rounded-full mb-5">
              <Users className="h-3.5 w-3.5 text-amber" />
              Built for the Whole Research Office
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-charcoal tracking-tight mb-4">One Platform, Every Role</h2>
            <p className="text-charcoal/50 text-lg">Each person sees the work that is theirs to do, and nothing they shouldn&apos;t.</p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {AUDIENCES.map(({ icon: Icon, title, desc }, i) => (
              <FadeIn key={title} delay={i * 100}>
                <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-wine/5 transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
                  <div className="w-12 h-12 bg-blush rounded-2xl flex items-center justify-center mb-5">
                    <Icon className="h-6 w-6 text-wine" />
                  </div>
                  <h3 className="text-lg font-bold text-charcoal mb-3">{title}</h3>
                  <p className="text-charcoal/55 text-[15px] leading-relaxed">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SECURITY & COMPLIANCE BAR ═══════════ */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <p className="text-xs font-semibold uppercase tracking-widest text-charcoal/30 mb-10">Security & Compliance</p>
            <div className="flex flex-wrap justify-center gap-8 items-center">
              {[
                { icon: ShieldCheck, label: 'Tenant Data Isolation' },
                { icon: Lock, label: 'Role-Based Access Control' },
                { icon: FileText, label: 'Audit Logs' },
                { icon: Shield, label: 'DPDP Act Tools' },
                { icon: BarChart3, label: 'CSV Data Export' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 text-sm font-semibold text-charcoal/40 hover:text-wine transition-colors">
                  <Icon className="h-5 w-5 text-wine/50" />
                  {label}
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══════════ CTA BANNER ═══════════ */}
      <section className="py-10 px-4 sm:px-8 lg:px-16 bg-ivory">
        <FadeIn>
          <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-wine-darker via-wine to-wine-light">
            {/* Glow blob */}
            <div className="pointer-events-none absolute -top-1/2 right-0 w-[600px] h-[600px] rounded-full bg-amber/15 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-1/2 left-0 w-[500px] h-[500px] rounded-full bg-peach/10 blur-[80px]" />
            {/* Dot texture */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{ backgroundImage: 'radial-gradient(#FDD7BF 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}
            />

            <div className="relative py-24 px-6 text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 border border-white/15 bg-white/8 text-white/60 text-xs font-semibold px-4 py-2 rounded-full mb-8">
                <Zap className="h-3.5 w-3.5 text-amber" />
                Pilots available for institutions
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight leading-[1.1]">
                Ready to Transform Your<br />
                <span className="text-amber">Research Management?</span>
              </h2>
              <p className="text-white/55 text-lg mb-12 leading-relaxed max-w-xl mx-auto">
                Bring research, IPR and grant workflows, incentive policies and analytics into one place. Tell us about your institution and we&apos;ll help you get started.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/pricing"
                  className="group inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-white text-wine font-extrabold text-base rounded-2xl hover:bg-ivory transition-all duration-200 hover:-translate-y-0.5 shadow-xl hover:shadow-2xl"
                >
                  See Pricing Plans
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 border border-white/20 text-white font-semibold text-base rounded-2xl hover:bg-white/20 transition-all duration-200 hover:-translate-y-0.5"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t border-gray-100 py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Wordmark heightClassName="h-8" />
            <span className="text-gray-200">·</span>
            <span className="text-sm text-charcoal/35">© {new Date().getFullYear()} All rights reserved</span>
          </div>
          <div className="flex items-center gap-8">
            <Link href="/" className="text-sm text-charcoal/40 hover:text-wine font-medium transition-colors">Product</Link>
            <Link href="/pricing" className="text-sm text-charcoal/40 hover:text-wine font-medium transition-colors">Pricing</Link>
            <Link href="/contact" className="text-sm text-charcoal/40 hover:text-wine font-medium transition-colors">Contact</Link>
            <Link href="/login" className="text-sm text-charcoal/40 hover:text-wine font-medium transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}
