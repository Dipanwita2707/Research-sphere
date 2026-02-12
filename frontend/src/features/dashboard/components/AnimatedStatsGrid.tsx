'use client';

import { motion } from 'framer-motion';
import { StaggerContainer, StaggerItem } from '../animations/AnimatedComponents';
import { LucideIcon } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { useEffect, useState } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  change?: string;
  changeType?: 'increase' | 'decrease';
  progress?: number;
}

export default function AnimatedStatsGrid({ stats }: { stats: StatCardProps[] }) {
  return (
    <StaggerContainer className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-4 sm:mb-8">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </StaggerContainer>
  );
}

function StatCard({ title, value, icon: Icon, color, change, changeType, progress }: StatCardProps) {
  const { ref, inView } = useInView({ threshold: 0.3, triggerOnce: true });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (inView && typeof value === 'number') {
      let start = 0;
      const end = value;
      const duration = 2000;
      const increment = end / (duration / 16);

      const timer = setInterval(() => {
        start += increment;
        if (start >= end) {
          setDisplayValue(end);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.floor(start));
        }
      }, 16);

      return () => clearInterval(timer);
    } else if (inView) {
      setDisplayValue(value as any);
    }
  }, [inView, value]);

  return (
    <StaggerItem>
      <motion.div
        ref={ref}
        whileHover={{ y: -8, scale: 1.03 }}
        className="relative bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer border border-gray-100 dark:border-gray-700 min-h-[160px] sm:min-h-[220px] flex flex-col"
      >
        {/* Animated Background Gradient */}
        <motion.div
          className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-5 dark:group-hover:opacity-10 transition-opacity duration-300`}
        />

        {/* Border Glow Effect */}
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className={`absolute inset-0 rounded-2xl border-2 border-transparent bg-gradient-to-r ${color} bg-clip-border`}
          style={{ padding: '2px' }}
        />

        <div className="relative z-10">
          {/* Icon */}
          <motion.div
            whileHover={{ rotate: 360, scale: 1.1 }}
            transition={{ duration: 0.6 }}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3 sm:mb-4 shadow-md`}
          >
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </motion.div>

          {/* Title */}
          <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">{title}</h3>

          {/* Value with Count Up Animation */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3"
          >
            {typeof displayValue === 'number' ? displayValue : displayValue}
          </motion.div>

          {/* Change Indicator */}
          {change && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-2"
            >
              <span
                className={`text-sm font-medium ${
                  changeType === 'increase' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {changeType === 'increase' ? '↑' : '↓'} {change}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">vs last month</span>
            </motion.div>
          )}

          {/* Progress Bar */}
          {progress !== undefined && (
            <div className="mt-4">
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={inView ? { width: `${progress}%` } : {}}
                  transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                  className={`h-full bg-gradient-to-r ${color} rounded-full`}
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">{progress}%</div>
            </div>
          )}

          {/* Decorative Corner Element */}
          <motion.div
            animate={{
              rotate: [0, 360],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className={`absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br ${color} opacity-10 rounded-full blur-xl`}
          />
        </div>
      </motion.div>
    </StaggerItem>
  );
}
