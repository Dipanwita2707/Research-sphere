'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Users, BookOpen, Clock, TrendingUp } from 'lucide-react';
import { StaggerContainer, StaggerItem } from '@/features/dashboard/animations/AnimatedComponents';
import Link from 'next/link';
import { EXTERNAL_URLS } from '@/shared/constants';

interface QuickAccessModule {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  gradient: string;
  link: string;
  stats?: { label: string; value: string | number }[];
  isExternal?: boolean;
}

export default function QuickAccessModules() {
  const modules: QuickAccessModule[] = [
    {
      title: 'Learning Management System',
      description: 'Access courses, assignments, and learning materials',
      icon: BookOpen,
      color: 'from-blue-500 to-cyan-500',
      gradient: 'from-blue-50 to-cyan-50',
      link: EXTERNAL_URLS.STUDENT_ADMIN_DASHBOARD,
      stats: [
        { label: 'Active Courses', value: 8 },
        { label: 'Assignments', value: 12 },
        { label: 'Completion', value: '78%' },
      ],
      isExternal: true,
    },
    {
      title: 'Monthly Progress Tracker',
      description: 'Track your research work, publications, and IPR applications',
      icon: TrendingUp,
      color: 'from-green-500 to-emerald-500',
      gradient: 'from-green-50 to-emerald-50',
      link: '/research/progress-tracker',
      stats: [
        { label: 'Active Research', value: 5 },
        { label: 'Publications', value: 12 },
        { label: 'IPR Filed', value: 8 },
      ],
      isExternal: false,
    },
    {
      title: 'RFID Attendance System',
      description: 'Track attendance and view real-time presence data',
      icon: Users,
      color: 'from-purple-500 to-pink-500',
      gradient: 'from-purple-50 to-pink-50',
      link: 'http://192.168.7.20:3000',
      stats: [
        { label: 'Today', value: 'Present' },
        { label: 'This Week', value: '95%' },
        { label: 'Monthly', value: '92%' },
      ],
      isExternal: true,
    },
  ];

  return (
    <div className="mb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Quick Access</h2>
        <p className="text-gray-600 dark:text-gray-300">Connect to your essential university modules</p>
      </motion.div>

      <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ 
                    scale: 1.05,
                    y: -12,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                  }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${module.color} p-6 border border-white/20 shadow-2xl hover:shadow-3xl transition-all duration-300 cursor-pointer group min-h-[280px] flex flex-col`}
                >
                  {/* Animated Background Overlay */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 0.1 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 bg-white"
                  />

                  {/* Glow Effect */}
                  <motion.div
                    animate={{
                      boxShadow: [
                        '0 0 0 0 rgba(255, 255, 255, 0)',
                        '0 0 0 10px rgba(255, 255, 255, 0.1)',
                        '0 0 0 0 rgba(255, 255, 255, 0)',
                      ],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="absolute inset-0 rounded-2xl"
                  />

                  <div className="relative z-10 flex flex-col flex-grow">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <motion.div
                        whileHover={{ rotate: 360, scale: 1.15 }}
                        transition={{ duration: 0.6 }}
                        className={`w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:bg-white/30 transition-all`}
                      >
                        <Icon className="w-7 h-7 text-white" />
                      </motion.div>
                      
                      <motion.div
                        whileHover={{ x: 5 }}
                        className="text-white/70 group-hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </motion.div>
                    </div>

                    {/* Content */}
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-white transition-colors">
                      {module.title}
                    </h3>
                    <p className="text-white/90 text-sm mb-6 flex-grow">
                      {module.description}
                    </p>

                    {/* Stats */}
                    {module.stats && (
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {module.stats.map((stat, statIndex) => (
                          <motion.div
                            key={statIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * statIndex }}
                            whileHover={{ scale: 1.08, y: -2 }}
                            className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/20 text-center hover:bg-white/30 transition-all cursor-pointer"
                          >
                            <div className="text-xs text-white/80 mb-1">{stat.label}</div>
                            <div className="text-sm font-bold text-white">{stat.value}</div>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* Hover Indicator */}
                    <motion.div
                      initial={{ width: 0 }}
                      whileHover={{ width: '100%' }}
                      transition={{ duration: 0.3 }}
                      className="h-1 bg-white/40 rounded-full mt-auto"
                    />
                  </div>
                </motion.div>
              </Link>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      {/* Connecting Line Animation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ delay: 0.5 }}
        className="hidden lg:block absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-0"
      >
        
      </motion.div>
    </div>
  );
}
