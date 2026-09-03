'use client';

import { motion } from 'framer-motion';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { StaggerContainer, StaggerItem } from '@/features/dashboard/animations/AnimatedComponents';
import Link from 'next/link';

interface QuickAccessModule {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  link: string;
  stats?: { label: string; value: string | number }[];
  isExternal?: boolean;
}

export default function QuickAccessModules({ hideHeader = false }: { hideHeader?: boolean }) {
  const modules: QuickAccessModule[] = [
    {
      title: 'Monthly Progress Tracker',
      description: 'Track your research work, publications, and IPR applications through every milestone.',
      icon: TrendingUp,
      link: '/research/progress-tracker',
      stats: [
        { label: 'Active Research', value: 5 },
        { label: 'Publications', value: 12 },
        { label: 'IPR Filed', value: 8 },
      ],
      isExternal: false,
    },
  ];

  return (
    <div className={hideHeader ? '' : 'mb-8'}>
      {!hideHeader && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4 sm:mb-5"
        >
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Quick Access</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500">Jump into your essential modules</p>
        </motion.div>
      )}

      <StaggerContainer className="grid grid-cols-1 gap-4 sm:gap-5">
        {modules.map((module, index) => {
          const Icon = module.icon;
          return (
            <StaggerItem key={index}>
              <Link
                href={module.link}
                target={module.isExternal ? '_blank' : '_self'}
                rel={module.isExternal ? 'noopener noreferrer' : ''}
              >
                <motion.div
                  whileHover={{ y: -3 }}
                  className="group relative rounded-2xl bg-white dark:bg-gray-900 p-5 sm:p-6 border border-gray-100 dark:border-gray-800 hover:border-wine/25 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_24px_rgba(132,28,67,0.10)] transition-all duration-300 cursor-pointer overflow-hidden"
                >
                  {/* Subtle bg gradient on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-wine/[0.02] to-amber/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />

                  <div className="relative">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-wine to-[#6E1738] flex items-center justify-center shadow-lg shadow-wine/20">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-wine dark:group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all duration-200" />
                    </div>

                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1.5 group-hover:text-wine dark:group-hover:text-amber-400 transition-colors">
                      {module.title}
                    </h3>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-5 leading-relaxed">
                      {module.description}
                    </p>

                    {/* Stats */}
                    {module.stats && (
                      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                        {module.stats.map((stat, statIndex) => (
                          <div key={statIndex} className="text-center">
                            <div className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{stat.value}</div>
                            <div className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 uppercase tracking-wide">{stat.label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </Link>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </div>
  );
}