'use client';

import React from 'react';
import Link from 'next/link';
import PublicNav from '@/shared/components/public/PublicNav';
import Wordmark from '@/shared/components/brand/Wordmark';
import { ChevronRight, Calendar, Clock, User, ArrowRight } from 'lucide-react';

const POSTS = [
  {
    id: 1,
    title: 'Introducing Automated Multi-Source Publication Syncing',
    excerpt: 'How we built a deduplicating citation matching engine that queries Scopus, ORCID, and PubMed concurrently to save thousands of admin hours.',
    date: 'July 15, 2026',
    readTime: '6 min read',
    author: 'Dr. Vivek Sharma',
    category: 'Product Update',
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
    color: 'text-wine bg-wine/5 border-wine/10'
  },
  {
    id: 2,
    title: 'The Digital Transformation of University Research Portals',
    excerpt: 'Why modern institutions are shifting away from manual spreadsheets and legacy systems towards real-time, zero-trust cloud repositories.',
    date: 'July 08, 2026',
    readTime: '5 min read',
    author: 'Prof. Anjali Desai',
    category: 'Research Culture',
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80',
    color: 'text-amber-700 bg-amber-50 border-amber/20'
  },
  {
    id: 3,
    title: 'Securing Intellectual Property: A Guide for Research Deans',
    excerpt: 'A deep dive into setting up digital approval workflows, contribution percentages, and auditing logs to protect institutional patents.',
    date: 'June 29, 2026',
    readTime: '8 min read',
    author: 'Sarah Jenkins',
    category: 'IPR & Patents',
    image: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-500/10'
  }
];

export default function BlogPage() {
  const featuredPost = POSTS[0];
  const otherPosts = POSTS.slice(1);

  return (
    <div className="min-h-screen bg-ivory font-sans antialiased flex flex-col justify-between">
      <div>
        <PublicNav />

        {/* Header Spacer */}
        <div className="h-16 sm:h-20" />

        {/* HERO HEADER */}
        <section className="py-16 text-center max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-xs font-extrabold uppercase tracking-widest text-wine bg-wine/5 border border-wine/15 px-3.5 py-1.5 rounded-full">
            Our Blog
          </span>
          <h1 className="text-5xl font-extrabold text-charcoal font-serif mt-6 mb-4 tracking-tight">
            Insights & Platform Updates
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Stay up to date with the latest features, guides, and academic research trends from the ResearchSphere team.
          </p>
        </section>

        {/* FEATURED POST */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-6 h-64 lg:h-auto relative bg-gray-100">
              <img 
                src={featuredPost.image} 
                alt={featuredPost.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-center space-y-4">
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className={`px-2.5 py-1 rounded-md border ${featuredPost.color}`}>{featuredPost.category}</span>
                <span className="text-gray-400 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{featuredPost.date}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-charcoal font-serif hover:text-wine transition-colors">
                <Link href={`#`}>{featuredPost.title}</Link>
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                {featuredPost.excerpt}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-xs font-semibold text-charcoal">
                  <div className="w-7 h-7 rounded-full bg-blush flex items-center justify-center text-[10px] font-bold text-wine">VS</div>
                  <span>{featuredPost.author}</span>
                </div>
                <span className="text-xs font-bold text-wine flex items-center gap-1 hover:underline cursor-pointer">
                  Read Article <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* POSTS GRID */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {otherPosts.map((post) => (
              <article key={post.id} className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col h-full">
                <div className="h-48 overflow-hidden bg-gray-100">
                  <img 
                    src={post.image} 
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6 sm:p-8 flex flex-col justify-between flex-1 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs font-semibold">
                      <span className={`px-2.5 py-1 rounded-md border ${post.color}`}>{post.category}</span>
                      <span className="text-gray-400 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{post.date}</span>
                    </div>
                    <h3 className="text-xl font-bold text-charcoal font-serif group-hover:text-wine transition-colors line-clamp-2">
                      <Link href={`#`}>{post.title}</Link>
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
                      {post.excerpt}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {post.readTime}
                    </span>
                    <span className="text-xs font-bold text-wine flex items-center gap-1 group-hover:underline cursor-pointer">
                      Read Article <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
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
