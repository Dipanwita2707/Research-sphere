'use client';

import { useAuthStore } from '@/shared/auth/authStore';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getUserPerformance, type PerformanceData } from '@/shared/services/performanceService';
import { logger } from '@/shared/utils/logger';
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  Lightbulb, 
  FileText, 
  DollarSign,
  Building2,
  Library,
  ClipboardList,
  Settings,
  BarChart3,
  UserCog,
  Briefcase,
  Award,
  Monitor,
  ChevronRight,
  Shield,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Clock
} from 'lucide-react';

// Import widgets
import StudentsWidget from '../widgets/StudentsWidget';
import FacultyWidget from '../widgets/FacultyWidget';
import AcademicsWidget from '../widgets/AcademicsWidget';
import ResearchWidget from '../widgets/ResearchWidget';
import FinanceWidget from '../widgets/FinanceWidget';
import LibraryWidget from '../widgets/LibraryWidget';
import ExaminationsWidget from '../widgets/ExaminationsWidget';
import AdmissionsWidget from '../widgets/AdmissionsWidget';
import ReportsWidget from '../widgets/ReportsWidget';
import SystemWidget from '../widgets/SystemWidget';
import StaffWidget from '../widgets/StaffWidget';

// Permission category to widget mapping
const CATEGORY_WIDGETS: Record<string, {
  component: React.ComponentType<any>;
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  color: string;
  href: string;
}> = {
  'Students': {
    component: StudentsWidget,
    icon: GraduationCap,
    title: 'Students',
    description: 'Manage student records and data',
    color: 'from-blue-500 to-blue-600',
    href: '/students'
  },
  'Faculty': {
    component: FacultyWidget,
    icon: Users,
    title: 'Faculty',
    description: 'Faculty management and workload',
    color: 'from-purple-500 to-purple-600',
    href: '/faculty'
  },
  'Academics': {
    component: AcademicsWidget,
    icon: BookOpen,
    title: 'Academics',
    description: 'Courses, curriculum and schedules',
    color: 'from-indigo-500 to-indigo-600',
    href: '/academics'
  },
  'Research': {
    component: ResearchWidget,
    icon: Lightbulb,
    title: 'Research',
    description: 'Research projects and publications',
    color: 'from-amber-500 to-amber-600',
    href: '/research'
  },
  'DRD': {
    component: ResearchWidget,
    icon: Award,
    title: 'DRD / IPR',
    description: 'IPR and research development',
    color: 'from-teal-500 to-teal-600',
    href: '/drd'
  },
  'Directorate of Research and Development': {
    component: ResearchWidget,
    icon: Award,
    title: 'DRD / IPR',
    description: 'IPR and research development',
    color: 'from-teal-500 to-teal-600',
    href: '/drd'
  },
  'Finance': {
    component: FinanceWidget,
    icon: DollarSign,
    title: 'Finance',
    description: 'Financial management and reports',
    color: 'from-emerald-500 to-emerald-600',
    href: '/finance'
  },
  'Finance Department': {
    component: FinanceWidget,
    icon: DollarSign,
    title: 'Finance',
    description: 'Financial management and reports',
    color: 'from-emerald-500 to-emerald-600',
    href: '/finance'
  },
  'Library': {
    component: LibraryWidget,
    icon: Library,
    title: 'Library',
    description: 'Library resources and books',
    color: 'from-orange-500 to-orange-600',
    href: '/library'
  },
  'Examinations': {
    component: ExaminationsWidget,
    icon: ClipboardList,
    title: 'Examinations',
    description: 'Exam schedules and results',
    color: 'from-red-500 to-red-600',
    href: '/examinations'
  },
  'Admissions': {
    component: AdmissionsWidget,
    icon: Building2,
    title: 'Admissions',
    description: 'Student admissions management',
    color: 'from-cyan-500 to-cyan-600',
    href: '/admissions'
  },
  'HR': {
    component: StaffWidget,
    icon: UserCog,
    title: 'Human Resources',
    description: 'HR and employee management',
    color: 'from-pink-500 to-pink-600',
    href: '/hr'
  },
  'Human Resources': {
    component: StaffWidget,
    icon: UserCog,
    title: 'Human Resources',
    description: 'HR and employee management',
    color: 'from-pink-500 to-pink-600',
    href: '/hr'
  },
  'IT': {
    component: SystemWidget,
    icon: Monitor,
    title: 'IT Systems',
    description: 'IT infrastructure management',
    color: 'from-slate-500 to-slate-600',
    href: '/it'
  },
  'Reports': {
    component: ReportsWidget,
    icon: BarChart3,
    title: 'Reports',
    description: 'Analytics and reporting',
    color: 'from-violet-500 to-violet-600',
    href: '/reports'
  },
  'System': {
    component: SystemWidget,
    icon: Settings,
    title: 'System',
    description: 'System configuration',
    color: 'from-gray-500 to-gray-600',
    href: '/settings'
  },
  'Staff': {
    component: StaffWidget,
    icon: Briefcase,
    title: 'Staff',
    description: 'Staff management',
    color: 'from-rose-500 to-rose-600',
    href: '/staff'
  },
  'Registrar': {
    component: StudentsWidget,
    icon: FileText,
    title: 'Registrar',
    description: 'Academic records management',
    color: 'from-sky-500 to-sky-600',
    href: '/registrar'
  }
};

interface PermissionBasedDashboardProps {
  userPermissions: Array<{
    category: string;
    permissions: string[];
  }>;
  userRole: string;
}

export default function PermissionBasedDashboard({ userPermissions, userRole }: PermissionBasedDashboardProps) {
  const { user } = useAuthStore();
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
    const [hoveredTermIndex, setHoveredTermIndex] = useState<number | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([
    { term: 'Week 1', attendance: 45, tasksCompleted: 58, deptEngagement: 40, responseTime: 35, overallScore: 42 },
    { term: 'Week 2', attendance: 72, tasksCompleted: 85, deptEngagement: 68, responseTime: 62, overallScore: 70 },
    { term: 'Week 3', attendance: 88, tasksCompleted: 92, deptEngagement: 82, responseTime: 78, overallScore: 85 },
    { term: 'Week 4', attendance: 95, tasksCompleted: 88, deptEngagement: 90, responseTime: 85, overallScore: 89 },
  ]);

  // Fetch real user performance data on component mount
  useEffect(() => {
    const fetchPerformanceData = async () => {
      if (user?.id) {
        try {
          // Convert user.id to number, handle both numeric IDs and string UIDs
          const numericId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10);
          
          // Only fetch if we have a valid numeric ID
          if (!isNaN(numericId) && numericId > 0) {
            const data = await getUserPerformance(numericId);
            if (data && data.length > 0) {
              setPerformanceData(data);
            }
          } else {
            logger.debug('User ID is not numeric, skipping performance fetch:', user.id);
          }
        } catch (error) {
          logger.error('Failed to fetch performance data:', error);
          // Keep using fallback data in state
        }
      }
    };
    
    fetchPerformanceData();
  }, [user?.id]);

  const chartMetrics = [
    { key: 'attendance', label: 'Attendance', color: '#ef4444' },
    { key: 'tasksCompleted', label: 'Tasks Completed', color: '#3b82f6' },
    { key: 'deptEngagement', label: 'Dept. Engagement', color: '#22c55e' },
    { key: 'responseTime', label: 'Response Time', color: '#f59e0b' },
    { key: 'overallScore', label: 'Overall Score', color: '#8b5cf6' },
  ];

  // Chart dimensions - optimized to use full width with minimal side margins
  const chartWidth = 1000;
  const chartHeight = 280;
  const padding = { top: 30, right: 30, bottom: 40, left: 55 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  // Calculate point positions - spread points across full width
  const getX = (index: number) => padding.left + (index / (performanceData.length - 1)) * graphWidth;
  const getY = (value: number) => padding.top + graphHeight - (value / 100) * graphHeight;
  
  // Get tooltip X position - smart positioning to prevent cutoff
  const getTooltipX = (termIndex: number, baseX: number) => {
    const tooltipWidth = 160;
    const margin = 5;
    
    // First term - position to the right
    if (termIndex === 0) {
      return Math.max(margin, baseX - 20);
    }
    // Last term - position to the left
    if (termIndex === performanceData.length - 1) {
      return Math.min(chartWidth - tooltipWidth - margin, baseX - tooltipWidth + 20);
    }
    // Middle terms - center the tooltip
    const centeredX = baseX - tooltipWidth / 2;
    // Ensure tooltip stays within bounds
    return Math.max(margin, Math.min(chartWidth - tooltipWidth - margin, centeredX));
  };

  // Generate SVG path for a line
  const generatePath = (metricKey: string) => {
    return performanceData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY((d as any)[metricKey])}`)
      .join(' ');
  };

  // Debug logging
  logger.debug('PermissionBasedDashboard - userPermissions:', userPermissions);
  logger.debug('PermissionBasedDashboard - userRole:', userRole);

  // Get unique categories from permissions
  const permissionCategories = userPermissions.map(p => p.category);
  
  // Extract all permission keys
  const allPermissionKeys = userPermissions.flatMap(perm => 
    Array.isArray(perm.permissions) ? perm.permissions : []
  );

  // Get widgets to display based on permission categories
  const widgetsToDisplay = permissionCategories
    .map(category => {
      const widgetConfig = CATEGORY_WIDGETS[category];
      if (widgetConfig) {
        const permissions = userPermissions.find(p => p.category === category)?.permissions || [];
        return {
          category,
          config: widgetConfig,
          permissions
        };
      }
      return null;
    })
    .filter(Boolean);

  // Remove duplicates based on title
  const uniqueWidgets = widgetsToDisplay.filter((widget, index, self) => 
    index === self.findIndex(w => w?.config.title === widget?.config.title)
  );

  return (
    <div className="space-y-6">
      {/* University-Wide Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      >
        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <Users className="w-8 h-8 mb-3 relative z-10" />
          <h3 className="text-3xl font-bold mb-1 relative z-10">{userPermissions.length}</h3>
          <p className="text-blue-100 text-sm relative z-10">Active Modules</p>
          <div className="mt-3 flex items-center text-xs relative z-10">
            <Shield className="w-4 h-4 mr-1" />
            <span>Departments assigned</span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <Activity className="w-8 h-8 mb-3 relative z-10" />
          <h3 className="text-3xl font-bold mb-1 relative z-10">92%</h3>
          <p className="text-green-100 text-sm relative z-10">Task Completion</p>
          <div className="mt-3 flex items-center text-xs relative z-10">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>+8% this term</span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <Clock className="w-8 h-8 mb-3 relative z-10" />
          <h3 className="text-3xl font-bold mb-1 relative z-10">2.4h</h3>
          <p className="text-purple-100 text-sm relative z-10">Avg Response Time</p>
          <div className="mt-3 flex items-center text-xs relative z-10">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>15% faster</span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <Target className="w-8 h-8 mb-3 relative z-10" />
          <h3 className="text-3xl font-bold mb-1 relative z-10">85%</h3>
          <p className="text-orange-100 text-sm relative z-10">Overall Score</p>
          <div className="mt-3 flex items-center text-xs relative z-10">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>Above average</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Performance Line Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="bg-white/70 backdrop-blur-sm dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-blue-100 dark:border-gray-700"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Employee Performance Overview</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your weekly activity and engagement metrics this month</p>
          </div>
          <BarChart3 className="w-6 h-6 text-blue-500" />
        </div>

        {/* SVG Line Chart */}
        <div className="relative">
          <svg viewBox="0 0 1000 320" className="w-full h-80" preserveAspectRatio="xMidYMid meet">
            {/* Y-Axis Label */}
            <text 
              x="18" 
              y="155" 
              transform="rotate(-90 18 155)" 
              className="fill-gray-500 dark:fill-gray-400 text-xs font-medium" 
              textAnchor="middle"
            >
              Avg Performance
            </text>
            
            {/* Y-Axis values */}
            <text x="48" y="35" className="fill-gray-500 dark:fill-gray-400 text-xs" textAnchor="end">100</text>
            <text x="48" y="77" className="fill-gray-500 dark:fill-gray-400 text-xs" textAnchor="end">80</text>
            <text x="48" y="119" className="fill-gray-500 dark:fill-gray-400 text-xs" textAnchor="end">60</text>
            <text x="48" y="161" className="fill-gray-500 dark:fill-gray-400 text-xs" textAnchor="end">40</text>
            <text x="48" y="203" className="fill-gray-500 dark:fill-gray-400 text-xs" textAnchor="end">20</text>
            <text x="48" y="245" className="fill-gray-500 dark:fill-gray-400 text-xs" textAnchor="end">0</text>
            
            {/* Baseline */}
            <line x1="55" y1="240" x2="970" y2="240" stroke="#e5e7eb" strokeWidth="1" className="dark:stroke-gray-700" />

            {/* Lines */}
            {chartMetrics.map((metric) => (
              <motion.path
                key={metric.key}
                d={generatePath(metric.key)}
                stroke={metric.color}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 0.2 }}
              />
            ))}

            {/* Data Points with Hover */}
            {performanceData.map((data, termIndex) => {
              const x = getX(termIndex);
              return (
                <g key={`term-${termIndex}`}>
                  {chartMetrics.map((metric) => {
                    const value = (data as any)[metric.key];
                    const y = getY(value);
                    return (
                      <motion.circle
                        key={`${termIndex}-${metric.key}`}
                        cx={x}
                        cy={y}
                        r="6"
                        fill={metric.color}
                        stroke="white"
                        strokeWidth="3"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3, delay: 1.5 + termIndex * 0.1 }}
                        style={{ cursor: 'pointer' }}
                        className="hover:r-8 transition-all"
                      />
                    );
                  })}
                  
                  {/* Invisible hover area for each term */}
                  <rect
                    x={x - 35}
                    y={padding.top - 15}
                    width="70"
                    height={graphHeight + 30}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredTermIndex(termIndex)}
                    onMouseLeave={() => setHoveredTermIndex(null)}
                  />
                  
                  {/* Tooltip showing all metrics for this term */}
                  {hoveredTermIndex === termIndex && (
                    <g>
                      {/* Outer glow for glass effect */}
                      <defs>
                        <filter id={`glow-${termIndex}`}>
                          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                        <linearGradient id={`glass-gradient-${termIndex}`} x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" style={{ stopColor: 'rgba(255, 255, 255, 0.15)', stopOpacity: 1 }} />
                          <stop offset="100%" style={{ stopColor: 'rgba(255, 255, 255, 0.02)', stopOpacity: 1 }} />
                        </linearGradient>
                      </defs>
                      
                      {/* Glass background with subtle blur effect */}
                      <rect
                        x={getTooltipX(termIndex, x)}
                        y={padding.top + 10}
                        width="160"
                        height="120"
                        rx="10"
                        fill="rgba(31, 41, 55, 0.85)"
                      />
                      
                      {/* Glass shine overlay - reduced opacity */}
                      <rect
                        x={getTooltipX(termIndex, x)}
                        y={padding.top + 10}
                        width="160"
                        height="120"
                        rx="10"
                        fill={`url(#glass-gradient-${termIndex})`}
                        opacity="0.25"
                      />
                      
                      {/* Border with subtle glass effect */}
                      <rect
                        x={getTooltipX(termIndex, x)}
                        y={padding.top + 10}
                        width="160"
                        height="120"
                        rx="10"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.15)"
                        strokeWidth="1"
                      />
                      
                      {/* Inner highlight for depth - reduced */}
                      <rect
                        x={getTooltipX(termIndex, x) + 1}
                        y={padding.top + 11}
                        width="158"
                        height="35"
                        rx="9"
                        fill="rgba(255, 255, 255, 0.05)"
                        opacity="0.4"
                      />
                      
                      {/* Term label */}
                      <text 
                        x={getTooltipX(termIndex, x) + 80} 
                        y={padding.top + 28} 
                        fill="white" 
                        textAnchor="middle" 
                        className="text-sm font-bold"
                      >
                        {data.term}
                      </text>
                      {/* Metrics list */}
                      {chartMetrics.map((metric, idx) => {
                        const value = (data as any)[metric.key];
                        const tooltipX = getTooltipX(termIndex, x);
                        return (
                          <g key={metric.key}>
                            <circle 
                              cx={tooltipX + 12} 
                              cy={padding.top + 43 + idx * 17} 
                              r="3.5" 
                              fill={metric.color}
                            />
                            <text 
                              x={tooltipX + 22} 
                              y={padding.top + 47 + idx * 17} 
                              fill="rgba(255, 255, 255, 0.9)" 
                              className="text-[10px]"
                            >
                              {metric.label}:
                            </text>
                            <text 
                              x={tooltipX + 148} 
                              y={padding.top + 47 + idx * 17} 
                              fill={metric.color} 
                              textAnchor="end"
                              className="text-[10px] font-bold"
                            >
                              {typeof value === 'number' ? value.toFixed(1) : value}%
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  )}
                </g>
              );
            })}

            {/* X-Axis Labels */}
            {performanceData.map((data, i) => (
              <text
                key={i}
                x={getX(i)}
                y="270"
                textAnchor="middle"
                className="fill-gray-600 dark:fill-gray-400 text-xs font-medium"
              >
                {data.term}
              </text>
            ))}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-8 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
          {chartMetrics.map((metric) => (
            <div key={metric.key} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: metric.color }} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {metric.label}: <strong className="text-gray-900 dark:text-white">
                  {(performanceData[performanceData.length - 1] as any)[metric.key]}%
                </strong>
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Widget Grid - HIDDEN */}
      {false && uniqueWidgets.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {uniqueWidgets.map((widget, index) => {
            if (!widget) return null;
            const { config, permissions, category } = widget;
            const IconComponent = config.icon;
            
            return (
              <motion.div
                key={`${category}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 + 0.4 }}
                whileHover={{ 
                  scale: 1.05,
                  y: -8,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
                }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  href={config.href}
                  className="block group bg-white/70 backdrop-blur-sm dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-blue-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 relative overflow-hidden"
                  onMouseEnter={() => setSelectedModule(category)}
                  onMouseLeave={() => setSelectedModule(null)}
                >
                  {/* Animated Background */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: selectedModule === category ? 0.1 : 0 }}
                    className={`absolute inset-0 bg-gradient-to-br ${config.color}`}
                  />

                  {/* Icon Header */}
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <motion.div
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.6 }}
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center shadow-lg`}
                    >
                      <IconComponent className="w-7 h-7 text-white" />
                    </motion.div>
                    <motion.div
                      animate={{ x: selectedModule === category ? 5 : 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-all" />
                    </motion.div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-bold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors relative z-10">
                    {config.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 relative z-10">
                    {config.description}
                  </p>

                  {/* Permission Count Badge */}
                  <div className="flex items-center gap-2 relative z-10">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                      {permissions.length} permission{permissions.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Permissions List (collapsed) */}
                  {permissions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 relative z-10">
                      <div className="flex flex-wrap gap-1">
                        {permissions.slice(0, 3).map((perm, i) => (
                          <motion.span
                            key={i}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className="inline-block px-2 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md"
                          >
                            {perm.replace(/_/g, ' ')}
                          </motion.span>
                        ))}
                        {permissions.length > 3 && (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-md">
                            +{permissions.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Quick Actions based on role */}
      {allPermissionKeys.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allPermissionKeys.includes('file_ipr') && (
              <Link 
                href="/ipr/apply"
                className="flex items-center gap-2 p-3 bg-sgt-50 hover:bg-sgt-100 rounded-xl text-sgt-700 transition-colors text-sm font-medium"
              >
                <FileText className="w-4 h-4" />
                <span>New IPR</span>
              </Link>
            )}
            {allPermissionKeys.includes('view_own_ipr') && (
              <Link 
                href="/ipr/my-applications"
                className="flex items-center gap-2 p-3 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-emerald-700 transition-colors text-sm font-medium"
              >
                <ClipboardList className="w-4 h-4" />
                <span>My IPR</span>
              </Link>
            )}
            {(allPermissionKeys.includes('ipr_review') || allPermissionKeys.includes('ipr_recommend')) && (
              <Link 
                href="/drd/review"
                className="flex items-center gap-2 p-3 bg-amber-50 hover:bg-amber-100 rounded-xl text-amber-700 transition-colors text-sm font-medium"
              >
                <Award className="w-4 h-4" />
                <span>Review IPR</span>
              </Link>
            )}
            {allPermissionKeys.includes('view_students') && (
              <Link 
                href="/students"
                className="flex items-center gap-2 p-3 bg-blue-50 hover:bg-blue-100 rounded-xl text-blue-700 transition-colors text-sm font-medium"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Students</span>
              </Link>
            )}
            {allPermissionKeys.includes('view_faculty') && (
              <Link 
                href="/faculty"
                className="flex items-center gap-2 p-3 bg-purple-50 hover:bg-purple-100 rounded-xl text-purple-700 transition-colors text-sm font-medium"
              >
                <Users className="w-4 h-4" />
                <span>Faculty</span>
              </Link>
            )}
            {(allPermissionKeys.includes('process_incentive') || allPermissionKeys.includes('finance_ipr')) && (
              <Link 
                href="/ipr/finance"
                className="flex items-center gap-2 p-3 bg-green-50 hover:bg-green-100 rounded-xl text-green-700 transition-colors text-sm font-medium"
              >
                <DollarSign className="w-4 h-4" />
                <span>Finance</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}