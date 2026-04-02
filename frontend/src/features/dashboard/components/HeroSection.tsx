'use client';

import { motion } from 'framer-motion';
import { SlideIn } from '../animations/AnimatedComponents';
import { 
  BookOpen, 
  Calendar, 
  TrendingUp, 
  Award, 
  Users, 
  School,
  BarChart3,
  GraduationCap 
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface HeroSectionProps {
  userName: string;
  userType: string;
  userImage?: string;
}

export default function HeroSection({ userName, userType, userImage }: HeroSectionProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getUserInitials = () => {
    return userName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Orbit animation path for icons
  const orbitIcons = [
    { Icon: Calendar, color: 'from-blue-500 to-cyan-500', delay: 0 },
    { Icon: BarChart3, color: 'from-purple-500 to-pink-500', delay: 0.2 },
    { Icon: TrendingUp, color: 'from-green-500 to-emerald-500', delay: 0.4 },
    { Icon: Award, color: 'from-orange-500 to-red-500', delay: 0.6 },
    { Icon: Users, color: 'from-indigo-500 to-blue-500', delay: 0.8 },
    { Icon: School, color: 'from-pink-500 to-rose-500', delay: 1.0 },
    { Icon: GraduationCap, color: 'from-teal-500 to-cyan-500', delay: 1.2 },
    { Icon: BookOpen, color: 'from-yellow-500 to-amber-500', delay: 1.4 },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl mb-8 bg-white/70 backdrop-blur-sm dark:bg-gray-800 border border-blue-200 dark:border-gray-700 shadow-md transition-colors duration-200">
      {/* Subtle animated background pattern */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]">
        <motion.div
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          className="w-full h-full"
          style={{
            backgroundImage: 'radial-gradient(circle, #3b82f6 2px, transparent 2px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative px-4 py-8 sm:px-8 sm:py-12 lg:px-16 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left Content */}
          <div className="space-y-6">
            <SlideIn direction="left">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="inline-block px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-700 rounded-full text-blue-600 dark:text-blue-300 text-sm font-medium"
              >
                {currentTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </motion.div>
            </SlideIn>

            <SlideIn direction="left" delay={0.2}>
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-gray-800 dark:text-white leading-tight">
                {getGreeting()},<br />
                <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                  {userName}
                </span>
              </h1>
            </SlideIn>

            <SlideIn direction="left" delay={0.4}>
              <p className="text-gray-600 dark:text-gray-300 text-lg">
                Welcome to your {userType} dashboard. Track your progress, manage your work, and stay connected.
              </p>
            </SlideIn>

            {/* Time Display */}
            <SlideIn direction="left" delay={0.6}>
              <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Active Now</span>
                </div>
                <div className="text-2xl font-bold text-gray-800 dark:text-white">
                  {currentTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </SlideIn>

            {/* Quick Stats */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="grid grid-cols-3 gap-2 sm:gap-4 pt-4"
            >
              {[
                { label: 'Tasks', value: '12', color: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300' },
                { label: 'Notifications', value: '5', color: 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300' },
                { label: 'Progress', value: '85%', color: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-600 dark:text-green-300' },
              ].map((item) => (
                <motion.div
                  key={item.label}
                  whileHover={{ scale: 1.05 }}
                  className={`${item.color} rounded-xl p-4 border`}
                >
                  <div className="text-gray-600 dark:text-gray-400 text-xs mb-1">{item.label}</div>
                  <div className="text-2xl font-bold">
                    {item.value}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Right Content - Animated Orbit */}
          <div className="relative hidden lg:block">
            <div className="relative w-full h-[400px] flex items-center justify-center">
              {/* Center Avatar - FIXED (no rotation) */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.3, type: 'spring', stiffness: 200 }}
                className="z-10 w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-2xl border-4 border-white dark:border-gray-700"
              >
                <span className="text-4xl font-bold text-white">{getUserInitials()}</span>
              </motion.div>

              {/* Orbiting Icons with Circular Animation */}
              <motion.div
                className="absolute"
                style={{
                  width: '280px',
                  height: '280px',
                }}
                animate={{ rotate: 360 }}
                transition={{
                  duration: 25,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              >
                {orbitIcons.map(({ Icon, color, delay }, index) => {
                  const angle = (index / orbitIcons.length) * 360;
                  const radius = 140;
                  const radian = (angle * Math.PI) / 180;
                  const x = Math.cos(radian) * radius;
                  const y = Math.sin(radian) * radius;
                  
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay }}
                      className="absolute z-20"
                      style={{
                        left: '50%',
                        top: '50%',
                        marginLeft: x - 24,
                        marginTop: y - 24,
                      }}
                    >
                      <motion.div
                        animate={{ rotate: -360 }}
                        transition={{
                          duration: 25,
                          repeat: Infinity,
                          ease: 'linear'
                        }}
                      >
                        <motion.div
                          whileHover={{ scale: 1.2 }}
                          transition={{ duration: 0.2 }}
                          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg cursor-pointer`}
                        >
                          <Icon className="w-6 h-6 text-white" />
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Orbit Path removed - cleaner design */}
            </div>
          </div>

          {/* Mobile/Tablet Avatar - show on smaller screens */}
          <div className="lg:hidden flex justify-center mt-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3, type: 'spring' }}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-xl border-4 border-white dark:border-gray-700"
            >
              <span className="text-2xl font-bold text-white">{getUserInitials()}</span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
