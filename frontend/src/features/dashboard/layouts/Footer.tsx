'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Linkedin,
  Youtube,
  Instagram,
  Twitter,
  GraduationCap,
} from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const navLinks = [
    { name: 'About Us', href: '#' },
    { name: 'Partner With Us', href: '#' },
    { name: 'Contact Us', href: '#' },
    { name: 'Privacy Policy', href: '#' },
    { name: 'Refund Policy', href: '#' },
    { name: 'Terms and Conditions', href: '#' },
  ];

  const socialLinks = [
    { icon: Linkedin, href: 'https://www.linkedin.com/school/sgt-university', label: 'LinkedIn' },
    { icon: Youtube, href: 'https://www.youtube.com/@sgtuniversity', label: 'YouTube' },
    { icon: Instagram, href: 'https://www.instagram.com/sgtuniversity', label: 'Instagram' },
    { icon: Twitter, href: 'https://twitter.com/sgtuniversity', label: 'X' },
  ];

  return (
    <footer className="relative mt-8 w-screen -ml-6 -mr-6 overflow-hidden select-none">
      {/* Gradient top border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#003d6b] via-[#6497b1] to-[#003d6b]"></div>

      {/* ====== TOP NAV BAR ====== */}
      <div className="bg-[#004a80] border-b border-white/[0.10]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo + Brand */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-[#6497b1] to-[#005b96] flex items-center justify-center shadow-lg shadow-[#005b96]/20 group-hover:shadow-[#6497b1]/30 transition-all duration-300">
              <GraduationCap className="w-5 h-5 text-white" />
              <div className="absolute inset-0 rounded-lg bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-[15px] font-bold tracking-[0.08em] text-white/90 group-hover:text-white transition-colors uppercase">
              SGT University
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="relative text-[13px] text-white/60 hover:text-white font-medium tracking-wide transition-colors duration-200 after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-[1.5px] after:bg-[#6497b1] after:transition-all after:duration-300 hover:after:w-full"
              >
                {link.name}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* ====== COPYRIGHT BAR ====== */}
      <div className="bg-[#003d6b]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[13px] text-white/50 font-medium">
            © {currentYear} SGT University. All Rights Reserved
          </p>
          <div className="flex items-center gap-3">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <motion.a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.92 }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.12] text-white/60 hover:text-white hover:bg-white/[0.18] hover:border-white/[0.25] transition-all duration-200"
                >
                  <Icon className="w-[15px] h-[15px]" />
                </motion.a>
              );
            })}
          </div>
        </div>
      </div>

      {/* ====== GIANT WATERMARK SECTION ====== */}
      <div className="relative bg-[#00335a] py-6 overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#002a4d] via-transparent to-transparent pointer-events-none" />
        
        {/* Animated subtle glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-[#005b96]/[0.08] rounded-full blur-3xl pointer-events-none" />

        {/* Giant Text */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 flex items-center justify-center"
        >
          <h2
            className="text-[clamp(3rem,12vw,10rem)] font-black tracking-[0.06em] leading-none text-transparent uppercase select-none"
            style={{
              WebkitTextStroke: '1.5px rgba(255,255,255,0.08)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          >
            SGT UNIVERSITY
          </h2>
        </motion.div>

        {/* Bottom fade-out line */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />
      </div>
    </footer>
  );
};

export default Footer;
