'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PublicNav from '@/shared/components/public/PublicNav';
import Wordmark from '@/shared/components/brand/Wordmark';
import api from '@/shared/api/api';
import { Mail, MapPin, Send, CheckCircle, AlertCircle } from 'lucide-react';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/contact', { name, email, subject, message });
      setSuccessMsg('Your message has been sent successfully! Our team will get back to you shortly.');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to send message. Please try again later.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ivory font-sans antialiased flex flex-col justify-between">
      <div>
        <PublicNav />

        {/* Header Spacer */}
        <div className="h-16 sm:h-20" />

        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-20 pb-12 sm:pt-28 sm:pb-16 text-center">
          <div className="pointer-events-none absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-peach/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-wine/5 blur-3xl" />
          
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <span className="text-xs font-extrabold uppercase tracking-widest text-wine bg-wine/5 border border-wine/15 px-3.5 py-1.5 rounded-full mb-6 inline-block">
              Support & Inquiries
            </span>
            <h1 className="text-5xl sm:text-6xl font-extrabold text-charcoal font-serif tracking-tight leading-none mb-6">
              Connect With <span className="text-wine">ResearchSphere</span>
            </h1>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Have questions about our platform, enterprise pricing, or custom installations? Drop us a line and our academic consulting team will reach out.
            </p>
          </div>
        </section>

        {/* CONTACT CONTAINER */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* Contact Details Left */}
            <div className="lg:col-span-4 space-y-8">
              <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm space-y-6">
                <h2 className="text-xl font-bold text-charcoal font-serif pb-4 border-b border-gray-100">Contact Details</h2>
                
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blush text-wine flex items-center justify-center flex-shrink-0">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Us</h3>
                    <a
                      href="mailto:mrinal11092002@gmail.com"
                      className="text-sm font-semibold text-charcoal mt-1 hover:text-wine transition-colors block"
                    >
                      mrinal11092002@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blush text-wine flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Location</h3>
                    <p className="text-sm font-semibold text-charcoal mt-1">Kolkata, West Bengal</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form Right */}
            <div className="lg:col-span-8">
              <div className="bg-white border border-gray-100 rounded-3xl p-8 sm:p-10 shadow-sm">
                <h2 className="text-2xl font-bold text-charcoal font-serif mb-6">Send Us a Message</h2>
                
                {successMsg && (
                  <div className="mb-6 flex items-start gap-3 bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-2xl text-sm font-medium">
                    <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {errorMsg && (
                  <div className="mb-6 flex items-start gap-3 bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-2xl text-sm font-medium">
                    <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-wine/20 focus:border-wine focus:outline-none transition-all placeholder-gray-400 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@institution.edu"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-wine/20 focus:border-wine focus:outline-none transition-all placeholder-gray-400 text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="What is this regarding?"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-wine/20 focus:border-wine focus:outline-none transition-all placeholder-gray-400 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Message</label>
                    <textarea
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message here..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-wine/20 focus:border-wine focus:outline-none transition-all placeholder-gray-400 text-sm resize-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-wine text-white text-sm font-bold rounded-xl hover:bg-wine-dark transition-all disabled:opacity-55 disabled:cursor-not-allowed shadow-md shadow-wine/20"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>

          </div>
        </section>
      </div>

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
            <Link href="/login" className="text-sm text-gray-400 hover:text-wine font-medium transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
