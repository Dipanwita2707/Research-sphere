'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Linkedin,
  Github,
  ChevronRight,
} from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerSections = [
    {
      title: 'Quick Links',
      links: [
        { name: 'Dashboard', href: '/dashboard', isExternal: false },
        { name: 'Research', href: '/research', isExternal: false },
        { name: 'IPR Module', href: '/ipr', isExternal: false },
        { name: 'Admissions', href: 'http://localhost:3000/', isExternal: true },
        { name: 'Publications', href: '/publications', isExternal: false },
      ],
    },
    {
      title: 'Resources',
      links: [
        { name: 'Documentation', href: '#' },
        { name: 'Help Center', href: '#' },
        { name: 'FAQs', href: '#' },
        { name: 'Support', href: '#' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { name: 'Privacy Policy', href: '#' },
        { name: 'Terms of Service', href: '#' },
        { name: 'Cookie Policy', href: '#' },
        { name: 'Disclaimer', href: '#' },
      ],
    },
  ];

  const socialLinks = [
    { icon: Facebook, href: 'https://www.facebook.com/sgtuniversity', label: 'Facebook' },
    { icon: Twitter, href: 'https://twitter.com/sgtuniversity', label: 'Twitter' },
    { icon: Linkedin, href: 'https://www.linkedin.com/school/sgt-university', label: 'LinkedIn' },
    { icon: Github, href: 'https://github.com/sgtuniversity', label: 'GitHub' },
  ];

  const contactInfo = [
    {
      icon: Mail,
      label: 'Email',
      value: 'info@sgtuniversity.ac.in',
      href: 'mailto:info@sgtuniversity.ac.in',
    },
    {
      icon: Phone,
      label: 'Phone',
      value: '+91 1275 281112',
      href: 'tel:+911275281112',
    },
    {
      icon: MapPin,
      label: 'Address',
      value: 'Gurugram-Badli Road, Chandu, Budhera, Gurugram, Haryana - 122505',
      href: 'https://goo.gl/maps/sgtuniversity',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <footer className="relative bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 dark:from-gray-950 dark:via-blue-950 dark:to-gray-950 text-gray-300 pt-4 pb-2 mt-8 w-screen -ml-6 -mr-6">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
      </div>

      <div className="relative z-10 w-full">
        {/* Main Footer Content */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="w-full px-8 lg:px-16"
        >
          {/* Header Section */}
          <motion.div variants={itemVariants} className="mb-3 pb-3 border-b border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
              {/* Branding */}
              <div className="space-y-1">
                <motion.h2
                  variants={itemVariants}
                  className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent"
                >
                  SGT University
                </motion.h2>
                <motion.p
                  variants={itemVariants}
                  className="text-gray-400 max-w-sm text-xs"
                >
                  Transforming academic excellence through innovative research
                  management and intellectual property protection.
                </motion.p>
              </div>

              {/* Newsletter Signup */}
              <motion.div variants={itemVariants} className="space-y-1">
                <h3 className="text-sm font-semibold text-white">Stay Updated</h3>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <button className="px-4 py-1.5 text-sm bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300">
                    Subscribe
                  </button>
                </div>
              </motion.div>
            </div>

            {/* Contact Info */}
            <motion.div
              variants={containerVariants}
              className="grid grid-cols-1 sm:grid-cols-3 gap-2"
            >
              {contactInfo.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.a
                    key={item.label}
                    variants={itemVariants}
                    href={item.href}
                    className="flex items-start gap-2 p-2 rounded-lg bg-gray-800/30 hover:bg-gray-800/60 border border-gray-700 hover:border-blue-500/50 transition-all duration-300 group"
                  >
                    <Icon className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{item.label}</p>
                      <p className="text-xs text-white font-medium group-hover:text-blue-400 transition-colors">
                        {item.value}
                      </p>
                    </div>
                  </motion.a>
                );
              })}
            </motion.div>
          </motion.div>

          {/* Links Grid */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3"
          >
            {footerSections.map((section) => (
              <motion.div key={section.title} variants={itemVariants}>
                <h3 className="text-sm font-semibold text-white mb-2">
                  {section.title}
                </h3>
                <ul className="space-y-1">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      {(link as any).isExternal ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-gray-400 hover:text-blue-400 transition-colors group"
                        >
                          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -ml-2 group-hover:ml-0 transition-all" />
                          <span className="group-hover:translate-x-1 transition-transform">
                            {link.name}
                          </span>
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="flex items-center gap-2 text-xs text-gray-400 hover:text-blue-400 transition-colors group"
                        >
                          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -ml-2 group-hover:ml-0 transition-all" />
                          <span className="group-hover:translate-x-1 transition-transform">
                            {link.name}
                          </span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>

          {/* Social Links */}
          <motion.div
            variants={itemVariants}
            className="flex justify-center gap-3 mb-3 pb-3 border-b border-gray-700"
          >
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <motion.a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-gray-700 hover:border-blue-500 text-gray-400 hover:text-blue-400 transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </motion.a>
              );
            })}
          </motion.div>

          {/* Bottom Section */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2"
          >
            <p className="text-gray-500 text-[11px]">
              © {currentYear} SGT University. All rights reserved.
            </p>
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <a href="#" className="hover:text-gray-300 transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-gray-300 transition-colors">
                Terms
              </a>
              <a href="#" className="hover:text-gray-300 transition-colors">
                Sitemap
              </a>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Gradient Border Top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
    </footer>
  );
};

export default Footer;
