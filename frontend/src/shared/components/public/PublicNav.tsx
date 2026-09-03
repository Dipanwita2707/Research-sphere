'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronRight, ChevronDown, BookOpen, HelpCircle, FileText } from 'lucide-react';
import Wordmark from '@/shared/components/brand/Wordmark';

const NAV_LINKS = [
  { label: 'Product', href: '/' },
  { label: 'Pricing', href: '/pricing' },
];

const RESOURCES_LINKS = [
  { label: 'Documentation', href: '/resources/documentation', icon: BookOpen, desc: 'Guides to get you started' },
  { label: 'Blog', href: '/resources/blog', icon: FileText, desc: 'Product updates & insights' },
  { label: 'Help Center', href: '/resources/help-center', icon: HelpCircle, desc: 'Answers to common questions' },
];

export default function PublicNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const resourcesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (resourcesRef.current && !resourcesRef.current.contains(e.target as Node)) {
        setResourcesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-[#f0e2d2]' : 'bg-transparent'}`}>
      <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 h-16 sm:h-20 flex items-center justify-between gap-4">
        <Link href="/" className="flex-shrink-0 hover:opacity-90 transition-opacity">
          <Wordmark heightClassName="h-12 sm:h-14" />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                pathname === href
                  ? 'bg-blush text-wine'
                  : 'text-gray-600 hover:text-wine hover:bg-blush'
              }`}
            >
              {label}
            </Link>
          ))}

          {/* Resources dropdown */}
          <div className="relative" ref={resourcesRef}>
            <button
              onClick={() => setResourcesOpen((v) => !v)}
              className={`inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                resourcesOpen ? 'bg-blush text-wine' : 'text-gray-600 hover:text-wine hover:bg-blush'
              }`}
            >
              Resources
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${resourcesOpen ? 'rotate-180' : ''}`} />
            </button>

            {resourcesOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-50">
                {RESOURCES_LINKS.map(({ label, href, icon: Icon, desc }) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setResourcesOpen(false)}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-blush transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blush flex items-center justify-center flex-shrink-0 group-hover:bg-wine/10">
                      <Icon className="h-4 w-4 text-wine" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-charcoal">{label}</div>
                      <div className="text-xs text-charcoal/45 mt-0.5">{desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/about-us"
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              pathname === '/about-us'
                ? 'bg-blush text-wine'
                : 'text-gray-600 hover:text-wine hover:bg-blush'
            }`}
          >
            About Us
          </Link>
          <Link
            href="/contact"
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              pathname === '/contact'
                ? 'bg-blush text-wine'
                : 'text-gray-600 hover:text-wine hover:bg-blush'
            }`}
          >
            Contact Us
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="px-4 py-2 text-sm font-semibold text-wine hover:bg-blush rounded-lg transition-colors">
            Sign In
          </Link>
          <Link href="/pricing" className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-wine text-white text-sm font-bold rounded-xl hover:bg-wine-dark transition-colors shadow-md shadow-wine/20">
            Get Started
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-gray-600 hover:text-wine rounded-lg">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-[#f0e2d2] px-4 py-4 space-y-2 shadow-lg">
          {NAV_LINKS.map(({ label, href }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className="block px-4 py-3 text-sm font-semibold text-gray-700 hover:text-wine hover:bg-blush rounded-xl transition-all">
              {label}
            </Link>
          ))}

          {/* Resources accordion */}
          <button
            onClick={() => setMobileResourcesOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:text-wine hover:bg-blush rounded-xl transition-all"
          >
            Resources
            <ChevronDown className={`h-4 w-4 transition-transform ${mobileResourcesOpen ? 'rotate-180' : ''}`} />
          </button>
          {mobileResourcesOpen && (
            <div className="pl-4 space-y-1">
              {RESOURCES_LINKS.map(({ label, href, icon: Icon }) => (
                <Link key={label} href={href} onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-wine hover:bg-blush rounded-xl transition-all">
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </div>
          )}

          <Link href="/about-us" onClick={() => setMobileOpen(false)}
            className="block px-4 py-3 text-sm font-semibold text-gray-700 hover:text-wine hover:bg-blush rounded-xl transition-all">
            About Us
          </Link>
          <Link href="/contact" onClick={() => setMobileOpen(false)}
            className="block px-4 py-3 text-sm font-semibold text-gray-700 hover:text-wine hover:bg-blush rounded-xl transition-all">
            Contact Us
          </Link>

          <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
            <Link href="/login" onClick={() => setMobileOpen(false)}
              className="block px-4 py-3 text-sm font-semibold text-center text-wine border border-wine/30 rounded-xl hover:bg-blush transition-colors">
              Sign In
            </Link>
            <Link href="/pricing" onClick={() => setMobileOpen(false)}
              className="block px-4 py-3 text-sm font-bold text-center text-white bg-wine rounded-xl hover:bg-wine-dark transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
