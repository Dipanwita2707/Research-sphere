'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { 
  FileText,
  MessageSquare,
  BookOpen,
  Calendar,
  GraduationCap,
  ClipboardList,
  Award,
  Briefcase,
  ExternalLink,
  Clock,
  CheckCircle,
  MapPin,
  X,
  Building2,
  CalendarDays,
  DollarSign,
  ScrollText,
  Library,
  FileCheck,
  Newspaper,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Shield,
  Home,
  ChevronLeft,
  ChevronRight,
  Gift,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { logger } from '@/shared/utils/logger';
import { FadeInUp } from '../animations/AnimatedComponents';
import UniversityEventsSlideshow from './UniversityEventsSlideshow';
import PermissionBasedDashboard from './PermissionBasedDashboard';
import CurrentActionSection from './CurrentActionSection';
import RecentNotifications from './RecentNotifications';
import SocialFootprints from './SocialFootprints';
import Footer from '../layouts/Footer';
import TourGuide, { TourStep, TourStartButton } from './TourGuide';

interface StudentData {
  uid: string;
  section: string;
  batch: string;
  program: string;
  cgpa: number;
  research: number;
  publications: number;
  iprFiled: number;
  happening: number;
  messages: number;
  assignments: number;
  events: number;
  attendance: {
    today: string;
    thisWeek: number;
    thisMonth: number;
    overall: number;
  };
}

interface ExamDetail {
  id: number;
  date: string;
  day: string;
  subject: string;
  subjectCode: string;
  time: string;
  duration: string;
  roomNo: string;
  building: string;
  examType: string;
  maxMarks: number;
  instructions: string[];
}

interface PlacementData {
  id: number;
  studentName: string;
  company: string;
  package: string;
  role: string;
  batch: string;
}

// Exam schedule data
const examSchedule: ExamDetail[] = [
  {
    id: 1,
    date: '2026-02-05',
    day: 'Thursday',
    subject: 'Data Structures & Algorithms',
    subjectCode: 'CS301',
    time: '10:00 AM - 1:00 PM',
    duration: '3 hours',
    roomNo: 'Room 201',
    building: 'Block A',
    examType: 'End Semester',
    maxMarks: 100,
    instructions: [
      'Carry your admit card and ID card',
      'Report 30 minutes before exam',
      'No electronic devices allowed',
      'Use only blue/black pen'
    ]
  },
  {
    id: 2,
    date: '2026-02-08',
    day: 'Sunday',
    subject: 'Database Management Systems',
    subjectCode: 'CS302',
    time: '10:00 AM - 1:00 PM',
    duration: '3 hours',
    roomNo: 'Room 105',
    building: 'Block B',
    examType: 'End Semester',
    maxMarks: 100,
    instructions: [
      'Carry your admit card and ID card',
      'Report 30 minutes before exam',
      'No electronic devices allowed',
      'Use only blue/black pen'
    ]
  },
  {
    id: 3,
    date: '2026-02-12',
    day: 'Thursday',
    subject: 'Computer Networks',
    subjectCode: 'CS303',
    time: '2:00 PM - 5:00 PM',
    duration: '3 hours',
    roomNo: 'Room 302',
    building: 'Block A',
    examType: 'End Semester',
    maxMarks: 100,
    instructions: [
      'Carry your admit card and ID card',
      'Report 30 minutes before exam',
      'No electronic devices allowed',
      'Use only blue/black pen'
    ]
  },
  {
    id: 4,
    date: '2026-02-15',
    day: 'Sunday',
    subject: 'Operating Systems',
    subjectCode: 'CS304',
    time: '10:00 AM - 1:00 PM',
    duration: '3 hours',
    roomNo: 'Room 201',
    building: 'Block C',
    examType: 'End Semester',
    maxMarks: 100,
    instructions: [
      'Carry your admit card and ID card',
      'Report 30 minutes before exam',
      'No electronic devices allowed',
      'Use only blue/black pen'
    ]
  },
  {
    id: 5,
    date: '2026-02-19',
    day: 'Thursday',
    subject: 'Software Engineering',
    subjectCode: 'CS305',
    time: '10:00 AM - 1:00 PM',
    duration: '3 hours',
    roomNo: 'Room 401',
    building: 'Block A',
    examType: 'End Semester',
    maxMarks: 100,
    instructions: [
      'Carry your admit card and ID card',
      'Report 30 minutes before exam',
      'No electronic devices allowed',
      'Use only blue/black pen'
    ]
  }
];

// Slideshow data for SGT University mega events and news
const sgtEventSlides = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=600&fit=crop',
    title: 'Annual Convocation 2026',
    description: 'Celebrating academic excellence with over 2000 graduates receiving their degrees.',
    category: 'Mega Event'
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&h=600&fit=crop',
    title: 'Research Excellence Awards',
    description: 'Recognizing groundbreaking research contributions by faculty and students.',
    category: 'Achievement'
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&h=600&fit=crop',
    title: 'International Sports Meet',
    description: 'SGT University hosts inter-university sports championship with 50+ institutions.',
    category: 'Sports'
  },
  {
    id: 4,
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop',
    title: 'Tech Innovation Summit 2026',
    description: 'Industry leaders and students collaborate on cutting-edge technology solutions.',
    category: 'Innovation'
  },
  {
    id: 5,
    image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&h=600&fit=crop',
    title: 'Cultural Fest - Sanskriti 2026',
    description: 'A vibrant celebration of art, music, dance, and cultural diversity.',
    category: 'Cultural'
  }
];

// Recent placements data
const recentPlacements: PlacementData[] = [
  { id: 1, studentName: 'Rahul Sharma', company: 'Google', package: '45 LPA', role: 'SDE II', batch: '2025' },
  { id: 2, studentName: 'Priya Singh', company: 'Microsoft', package: '42 LPA', role: 'Software Engineer', batch: '2025' },
  { id: 3, studentName: 'Amit Kumar', company: 'Amazon', package: '38 LPA', role: 'SDE I', batch: '2025' },
];

interface ClassSchedule {
  id: number;
  subject: string;
  subjectCode: string;
  time: string;
  duration: string;
  roomNo: string;
  building: string;
  faculty: string;
  type: 'Lecture' | 'Lab' | 'Tutorial';
}

interface WeeklySchedule {
  [key: string]: ClassSchedule[];
}

// Weekly timetable for B.Tech CSE students
const weeklyTimetable: WeeklySchedule = {
  'Monday': [
    { id: 1, subject: 'Data Structures & Algorithms', subjectCode: 'CS301', time: '9:00 AM - 10:00 AM', duration: '1 hour', roomNo: '201', building: 'Block A', faculty: 'Dr. Sharma', type: 'Lecture' },
    { id: 2, subject: 'Operating Systems', subjectCode: 'CS302', time: '10:00 AM - 11:00 AM', duration: '1 hour', roomNo: '202', building: 'Block A', faculty: 'Prof. Kumar', type: 'Lecture' },
    { id: 3, subject: 'Database Management Systems', subjectCode: 'CS303', time: '11:30 AM - 12:30 PM', duration: '1 hour', roomNo: '203', building: 'Block A', faculty: 'Dr. Singh', type: 'Lecture' },
    { id: 4, subject: 'Computer Networks', subjectCode: 'CS304', time: '2:00 PM - 3:00 PM', duration: '1 hour', roomNo: '204', building: 'Block B', faculty: 'Prof. Verma', type: 'Lecture' },
  ],
  'Tuesday': [
    { id: 1, subject: 'DSA Lab', subjectCode: 'CS301L', time: '9:00 AM - 11:00 AM', duration: '2 hours', roomNo: 'Lab 1', building: 'Block C', faculty: 'Dr. Sharma', type: 'Lab' },
    { id: 2, subject: 'Software Engineering', subjectCode: 'CS305', time: '11:30 AM - 12:30 PM', duration: '1 hour', roomNo: '205', building: 'Block A', faculty: 'Dr. Gupta', type: 'Lecture' },
    { id: 3, subject: 'Web Technologies', subjectCode: 'CS306', time: '2:00 PM - 3:00 PM', duration: '1 hour', roomNo: '206', building: 'Block B', faculty: 'Prof. Patel', type: 'Lecture' },
    { id: 4, subject: 'DBMS Tutorial', subjectCode: 'CS303T', time: '3:00 PM - 4:00 PM', duration: '1 hour', roomNo: '207', building: 'Block A', faculty: 'Dr. Singh', type: 'Tutorial' },
  ],
  'Wednesday': [
    { id: 1, subject: 'Computer Networks Lab', subjectCode: 'CS304L', time: '9:00 AM - 11:00 AM', duration: '2 hours', roomNo: 'Lab 2', building: 'Block C', faculty: 'Prof. Verma', type: 'Lab' },
    { id: 2, subject: 'Machine Learning', subjectCode: 'CS307', time: '11:30 AM - 12:30 PM', duration: '1 hour', roomNo: '208', building: 'Block B', faculty: 'Dr. Agarwal', type: 'Lecture' },
    { id: 3, subject: 'Data Structures & Algorithms', subjectCode: 'CS301', time: '2:00 PM - 3:00 PM', duration: '1 hour', roomNo: '201', building: 'Block A', faculty: 'Dr. Sharma', type: 'Lecture' },
  ],
  'Thursday': [
    { id: 1, subject: 'Operating Systems', subjectCode: 'CS302', time: '9:00 AM - 10:00 AM', duration: '1 hour', roomNo: '202', building: 'Block A', faculty: 'Prof. Kumar', type: 'Lecture' },
    { id: 2, subject: 'Web Technologies Lab', subjectCode: 'CS306L', time: '10:00 AM - 12:00 PM', duration: '2 hours', roomNo: 'Lab 3', building: 'Block C', faculty: 'Prof. Patel', type: 'Lab' },
    { id: 3, subject: 'Software Engineering', subjectCode: 'CS305', time: '2:00 PM - 3:00 PM', duration: '1 hour', roomNo: '205', building: 'Block A', faculty: 'Dr. Gupta', type: 'Lecture' },
    { id: 4, subject: 'Computer Networks', subjectCode: 'CS304', time: '3:00 PM - 4:00 PM', duration: '1 hour', roomNo: '204', building: 'Block B', faculty: 'Prof. Verma', type: 'Lecture' },
  ],
  'Friday': [
    { id: 1, subject: 'Machine Learning Lab', subjectCode: 'CS307L', time: '9:00 AM - 11:00 AM', duration: '2 hours', roomNo: 'Lab 4', building: 'Block C', faculty: 'Dr. Agarwal', type: 'Lab' },
    { id: 2, subject: 'Database Management Systems', subjectCode: 'CS303', time: '11:30 AM - 12:30 PM', duration: '1 hour', roomNo: '203', building: 'Block A', faculty: 'Dr. Singh', type: 'Lecture' },
    { id: 3, subject: 'Seminar', subjectCode: 'CS399', time: '2:00 PM - 3:00 PM', duration: '1 hour', roomNo: 'Auditorium', building: 'Block D', faculty: 'All Faculty', type: 'Lecture' },
  ],
  'Saturday': [
    { id: 1, subject: 'Industry Expert Session', subjectCode: 'CS398', time: '10:00 AM - 12:00 PM', duration: '2 hours', roomNo: 'Auditorium', building: 'Block D', faculty: 'Guest Speaker', type: 'Lecture' },
    { id: 2, subject: 'Project Work', subjectCode: 'CS397', time: '2:00 PM - 4:00 PM', duration: '2 hours', roomNo: 'Project Lab', building: 'Block C', faculty: 'Dr. Gupta', type: 'Lab' },
  ],
  'Sunday': [],
};

// Function to get today's timetable based on server date
const getTodayTimetable = (): ClassSchedule[] => {
  const today = new Date();
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = daysOfWeek[today.getDay()];
  return weeklyTimetable[dayName] || [];
};

// Function to get day name
const getTodayName = (): string => {
  const today = new Date();
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return daysOfWeek[today.getDay()];
};

// Guidelines data - Expanded to 6 cards
const guidelinesData = [
  {
    id: 1,
    title: 'Scholarship Guidelines',
    description: 'Merit-based and need-based scholarship policies and application procedures',
    icon: DollarSign,
    color: 'from-green-500 to-emerald-600',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    iconColor: 'text-green-600 dark:text-green-400',
    pdfUrl: '/documents/scholarship-guidelines.pdf'
  },
  {
    id: 2,
    title: 'Academic Rules',
    description: 'University academic policies, grading system, and progression criteria',
    icon: BookOpen,
    color: 'from-blue-500 to-cyan-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    pdfUrl: '/documents/academic-rules.pdf'
  },
  {
    id: 3,
    title: 'Examination Rules',
    description: 'Exam conduct, assessment policies, and evaluation guidelines',
    icon: FileCheck,
    color: 'from-purple-500 to-indigo-600',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    iconColor: 'text-purple-600 dark:text-purple-400',
    pdfUrl: '/documents/examination-rules.pdf'
  },
  {
    id: 4,
    title: 'Library Rules',
    description: 'Library services, borrowing policies, and digital resource access',
    icon: Library,
    color: 'from-orange-500 to-red-600',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    iconColor: 'text-orange-600 dark:text-orange-400',
    pdfUrl: '/documents/library-rules.pdf'
  },
  {
    id: 5,
    title: 'Anti-Ragging Policy',
    description: 'Zero tolerance policy, complaint procedures, and safety measures',
    icon: Shield,
    color: 'from-red-500 to-pink-600',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    iconColor: 'text-red-600 dark:text-red-400',
    pdfUrl: '/documents/anti-ragging-policy.pdf'
  },
  {
    id: 6,
    title: 'Hostel Guidelines',
    description: 'Accommodation rules, mess facilities, and residential regulations',
    icon: Home,
    color: 'from-teal-500 to-cyan-600',
    bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    iconColor: 'text-teal-600 dark:text-teal-400',
    pdfUrl: '/documents/hostel-guidelines.pdf'
  }
];

// SGT Times categories
const sgtTimesCategories = [
  { name: 'All', count: 18 },
  { name: 'Achievement', count: 4 },
  { name: 'Innovation', count: 3 },
  { name: 'Placements', count: 3 },
  { name: 'Global', count: 3 },
  { name: 'Events', count: 3 },
  { name: 'Research', count: 2 }
];

// SGT Times headlines data with categories
const sgtTimesData: Record<string, Array<{id: number; title: string; category: string; date: string; excerpt: string; url: string}>> = {
  All: [
    {
      id: 1,
      title: 'SGT University Ranks Among Top 100 in NIRF Rankings 2026',
      category: 'Achievement',
      date: 'Feb 1, 2026',
      excerpt: 'Significant jump in national rankings showcases academic excellence and research output...',
      url: 'https://sgttimes.com/nirf-rankings-2026'
    },
    {
      id: 2,
      title: 'New AI Research Center Inaugurated at SGT Campus',
      category: 'Innovation',
      date: 'Jan 28, 2026',
      excerpt: 'State-of-the-art facility to foster cutting-edge research in artificial intelligence...',
      url: 'https://sgttimes.com/ai-research-center'
    },
    {
      id: 3,
      title: 'Record Placements: 500+ Students Placed in Top Companies',
      category: 'Placements',
      date: 'Jan 25, 2026',
      excerpt: 'Highest package of 45 LPA offered by leading tech giants including Google and Microsoft...',
      url: 'https://sgttimes.com/placement-records-2026'
    },
    {
      id: 4,
      title: 'International Collaboration with MIT for Research Exchange',
      category: 'Global',
      date: 'Jan 20, 2026',
      excerpt: 'MoU signed for student and faculty exchange programs with Massachusetts Institute of Technology...',
      url: 'https://sgttimes.com/mit-collaboration'
    },
    {
      id: 5,
      title: 'Annual Tech Summit 2026 Attracts 5000+ Participants',
      category: 'Events',
      date: 'Jan 18, 2026',
      excerpt: 'Three-day technology festival features hackathons, workshops, and industry talks...',
      url: 'https://sgttimes.com/tech-summit-2026'
    },
    {
      id: 6,
      title: 'SGT Students Win National Robotics Championship',
      category: 'Achievement',
      date: 'Jan 15, 2026',
      excerpt: 'Team of 5 engineering students secures first place in prestigious robotics competition...',
      url: 'https://sgttimes.com/robotics-championship'
    },
    {
      id: 7,
      title: 'Smart Campus Initiative Launched with IoT Integration',
      category: 'Innovation',
      date: 'Jan 12, 2026',
      excerpt: 'University implements IoT sensors across campus for energy optimization and security...',
      url: 'https://sgttimes.com/smart-campus-iot'
    },
    {
      id: 8,
      title: 'Amazon and Flipkart to Recruit 200+ Students This Semester',
      category: 'Placements',
      date: 'Jan 10, 2026',
      excerpt: 'Major e-commerce giants announce mega recruitment drive with attractive packages...',
      url: 'https://sgttimes.com/amazon-flipkart-drive'
    },
    {
      id: 9,
      title: 'Partnership with University of Oxford for Joint Research',
      category: 'Global',
      date: 'Jan 8, 2026',
      excerpt: 'Collaborative research programs in medicine and biotechnology announced...',
      url: 'https://sgttimes.com/oxford-partnership'
    },
    {
      id: 10,
      title: 'Cultural Fest "Rang-e-SGT" Mesmerizes with Star Performances',
      category: 'Events',
      date: 'Jan 5, 2026',
      excerpt: 'Three-day cultural extravaganza features celebrity performances and student competitions...',
      url: 'https://sgttimes.com/rang-e-sgt-2026'
    },
    {
      id: 11,
      title: 'Research Paper by SGT Faculty Published in Nature Journal',
      category: 'Research',
      date: 'Jan 3, 2026',
      excerpt: 'Breakthrough research in cancer treatment gets international recognition...',
      url: 'https://sgttimes.com/nature-publication'
    },
    {
      id: 12,
      title: 'SGT Debate Team Wins Inter-University Championship',
      category: 'Achievement',
      date: 'Dec 28, 2025',
      excerpt: 'Students outshine competitors from 50+ universities in national debate competition...',
      url: 'https://sgttimes.com/debate-championship'
    },
    {
      id: 13,
      title: 'Green Energy Project: Solar Panels Installed Across Campus',
      category: 'Innovation',
      date: 'Dec 25, 2025',
      excerpt: 'University moves towards carbon neutrality with renewable energy infrastructure...',
      url: 'https://sgttimes.com/solar-project'
    },
    {
      id: 14,
      title: 'Deloitte and PwC Offer Pre-Placement Opportunities',
      category: 'Placements',
      date: 'Dec 22, 2025',
      excerpt: 'Leading consulting firms open internship and full-time positions for SGT students...',
      url: 'https://sgttimes.com/consulting-offers'
    },
    {
      id: 15,
      title: 'Study Abroad Fair: 30+ International Universities Participate',
      category: 'Global',
      date: 'Dec 20, 2025',
      excerpt: 'Universities from USA, UK, Canada, and Australia offer admission guidance...',
      url: 'https://sgttimes.com/study-abroad-fair'
    },
    {
      id: 16,
      title: 'Annual Sports Meet Concludes with Record Participation',
      category: 'Events',
      date: 'Dec 18, 2025',
      excerpt: '2000+ students compete in various sporting events showcasing athletic talent...',
      url: 'https://sgttimes.com/annual-sports-meet'
    },
    {
      id: 17,
      title: 'Interdisciplinary Research Grant of ₹5 Crores Awarded',
      category: 'Research',
      date: 'Dec 15, 2025',
      excerpt: 'Government funding secured for collaborative research in healthcare technology...',
      url: 'https://sgttimes.com/research-grant'
    },
    {
      id: 18,
      title: 'SGT Alumni Association Hosts Grand Homecoming Event',
      category: 'Achievement',
      date: 'Dec 12, 2025',
      excerpt: '1000+ alumni return to campus for networking and knowledge sharing...',
      url: 'https://sgttimes.com/alumni-homecoming'
    }
  ],
  Achievement: [
    {
      id: 1,
      title: 'SGT University Ranks Among Top 100 in NIRF Rankings 2026',
      category: 'Achievement',
      date: 'Feb 1, 2026',
      excerpt: 'Significant jump in national rankings showcases academic excellence and research output...',
      url: 'https://sgttimes.com/nirf-rankings-2026'
    },
    {
      id: 6,
      title: 'SGT Students Win National Robotics Championship',
      category: 'Achievement',
      date: 'Jan 15, 2026',
      excerpt: 'Team of 5 engineering students secures first place in prestigious robotics competition...',
      url: 'https://sgttimes.com/robotics-championship'
    },
    {
      id: 12,
      title: 'SGT Debate Team Wins Inter-University Championship',
      category: 'Achievement',
      date: 'Dec 28, 2025',
      excerpt: 'Students outshine competitors from 50+ universities in national debate competition...',
      url: 'https://sgttimes.com/debate-championship'
    },
    {
      id: 18,
      title: 'SGT Alumni Association Hosts Grand Homecoming Event',
      category: 'Achievement',
      date: 'Dec 12, 2025',
      excerpt: '1000+ alumni return to campus for networking and knowledge sharing...',
      url: 'https://sgttimes.com/alumni-homecoming'
    }
  ],
  Innovation: [
    {
      id: 2,
      title: 'New AI Research Center Inaugurated at SGT Campus',
      category: 'Innovation',
      date: 'Jan 28, 2026',
      excerpt: 'State-of-the-art facility to foster cutting-edge research in artificial intelligence...',
      url: 'https://sgttimes.com/ai-research-center'
    },
    {
      id: 7,
      title: 'Smart Campus Initiative Launched with IoT Integration',
      category: 'Innovation',
      date: 'Jan 12, 2026',
      excerpt: 'University implements IoT sensors across campus for energy optimization and security...',
      url: 'https://sgttimes.com/smart-campus-iot'
    },
    {
      id: 13,
      title: 'Green Energy Project: Solar Panels Installed Across Campus',
      category: 'Innovation',
      date: 'Dec 25, 2025',
      excerpt: 'University moves towards carbon neutrality with renewable energy infrastructure...',
      url: 'https://sgttimes.com/solar-project'
    }
  ],
  Placements: [
    {
      id: 3,
      title: 'Record Placements: 500+ Students Placed in Top Companies',
      category: 'Placements',
      date: 'Jan 25, 2026',
      excerpt: 'Highest package of 45 LPA offered by leading tech giants including Google and Microsoft...',
      url: 'https://sgttimes.com/placement-records-2026'
    },
    {
      id: 8,
      title: 'Amazon and Flipkart to Recruit 200+ Students This Semester',
      category: 'Placements',
      date: 'Jan 10, 2026',
      excerpt: 'Major e-commerce giants announce mega recruitment drive with attractive packages...',
      url: 'https://sgttimes.com/amazon-flipkart-drive'
    },
    {
      id: 14,
      title: 'Deloitte and PwC Offer Pre-Placement Opportunities',
      category: 'Placements',
      date: 'Dec 22, 2025',
      excerpt: 'Leading consulting firms open internship and full-time positions for SGT students...',
      url: 'https://sgttimes.com/consulting-offers'
    }
  ],
  Global: [
    {
      id: 4,
      title: 'International Collaboration with MIT for Research Exchange',
      category: 'Global',
      date: 'Jan 20, 2026',
      excerpt: 'MoU signed for student and faculty exchange programs with Massachusetts Institute of Technology...',
      url: 'https://sgttimes.com/mit-collaboration'
    },
    {
      id: 9,
      title: 'Partnership with University of Oxford for Joint Research',
      category: 'Global',
      date: 'Jan 8, 2026',
      excerpt: 'Collaborative research programs in medicine and biotechnology announced...',
      url: 'https://sgttimes.com/oxford-partnership'
    },
    {
      id: 15,
      title: 'Study Abroad Fair: 30+ International Universities Participate',
      category: 'Global',
      date: 'Dec 20, 2025',
      excerpt: 'Universities from USA, UK, Canada, and Australia offer admission guidance...',
      url: 'https://sgttimes.com/study-abroad-fair'
    }
  ],
  Events: [
    {
      id: 5,
      title: 'Annual Tech Summit 2026 Attracts 5000+ Participants',
      category: 'Events',
      date: 'Jan 18, 2026',
      excerpt: 'Three-day technology festival features hackathons, workshops, and industry talks...',
      url: 'https://sgttimes.com/tech-summit-2026'
    },
    {
      id: 10,
      title: 'Cultural Fest "Rang-e-SGT" Mesmerizes with Star Performances',
      category: 'Events',
      date: 'Jan 5, 2026',
      excerpt: 'Three-day cultural extravaganza features celebrity performances and student competitions...',
      url: 'https://sgttimes.com/rang-e-sgt-2026'
    },
    {
      id: 16,
      title: 'Annual Sports Meet Concludes with Record Participation',
      category: 'Events',
      date: 'Dec 18, 2025',
      excerpt: '2000+ students compete in various sporting events showcasing athletic talent...',
      url: 'https://sgttimes.com/annual-sports-meet'
    }
  ],
  Research: [
    {
      id: 11,
      title: 'Research Paper by SGT Faculty Published in Nature Journal',
      category: 'Research',
      date: 'Jan 3, 2026',
      excerpt: 'Breakthrough research in cancer treatment gets international recognition...',
      url: 'https://sgttimes.com/nature-publication'
    },
    {
      id: 17,
      title: 'Interdisciplinary Research Grant of ₹5 Crores Awarded',
      category: 'Research',
      date: 'Dec 15, 2025',
      excerpt: 'Government funding secured for collaborative research in healthcare technology...',
      url: 'https://sgttimes.com/research-grant'
    }
  ]
};

// Know Your Authorities data - Hierarchical Structure
const yourAuthorities = [
  // Mentor - Prateek Agrawal
  {
    id: 'm1',
    name: 'Prof. (Dr.) Prateek Agrawal',
    position: 'Mentor',
    role: 'Your Mentor',
    department: 'SGT University',
    image: 'https://sgtuniversity.ac.in/assets/images/about-sgt/university/Prateek-Agrawal.jpg',
    email: 'prateek.agrawal@sgtuniversity.org',
    phone: '1800 102 5661',
    type: 'mentor',
    profileUrl: 'https://sgtuniversity.ac.in/about/our-officers/dean-academics.html'
  },
  // HOD - Prateek Agrawal
  {
    id: 'h1',
    name: 'Prof. (Dr.) Prateek Agrawal',
    position: 'HOD',
    role: 'Head of Department',
    department: 'SGT University',
    image: 'https://sgtuniversity.ac.in/assets/images/about-sgt/university/Prateek-Agrawal.jpg',
    email: 'prateek.agrawal@sgtuniversity.org',
    phone: '1800 102 5661',
    type: 'hod',
    profileUrl: 'https://sgtuniversity.ac.in/about/our-officers/dean-academics.html'
  },
  // Dean - Prateek Agrawal
  {
    id: 'd1',
    name: 'Prof. (Dr.) Prateek Agrawal',
    position: 'Dean',
    role: 'Dean',
    department: 'SGT University',
    image: 'https://sgtuniversity.ac.in/assets/images/about-sgt/university/Prateek-Agrawal.jpg',
    email: 'prateek.agrawal@sgtuniversity.org',
    phone: '1800 102 5661',
    type: 'dean',
    profileUrl: 'https://sgtuniversity.ac.in/about/our-officers/dean-academics.html'
  },
  // Pro Vice-Chancellors
  {
    id: 'pvc1',
    name: 'Prof. (Dr.) Atul Kumar Nasa',
    position: 'Pro Vice-Chancellor',
    role: 'Academic Leadership',
    department: 'SGT University',
    image: 'https://sgtuniversity.ac.in/assets/images/about-sgt/university/Dr-Atul-Kumar-Nasa.webp',
    email: 'info@sgtuniversity.org',
    phone: '1800 102 5661',
    profileUrl: 'https://sgtuniversity.ac.in/about/our-officers/dr-atul-kumar-nasa.html',
    type: 'provc'
  },
  // Vice-Chancellor
  {
    id: 'vc1',
    name: 'Prof. (Dr.) Hemant Verma',
    position: 'Vice-Chancellor',
    role: 'University Leadership',
    department: 'SGT University',
    image: 'https://sgtuniversity.ac.in/assets/images/about-sgt/university/hemant-sir.png',
    email: 'info@sgtuniversity.org',
    phone: '1800 102 5661',
    profileUrl: 'https://sgtuniversity.ac.in/about/our-officers/dr-hemant-verma.html',
    type: 'vc'
  },
  // Other Dignities
  {
    id: 'o2',
    name: 'Dr. Subodh Kumar',
    position: 'Registrar',
    role: 'Administration',
    department: 'SGT University',
    image: 'https://sgtuniversity.ac.in/assets/images/about-sgt/university/dr-subodh-kumar.png',
    email: 'info@sgtuniversity.org',
    phone: '1800 102 5661',
    profileUrl: 'https://sgtuniversity.ac.in/about/our-officers/registrar.html',
    type: 'dignity'
  },
  {
    id: 'o4',
    name: 'Dr. Joginder Yadav',
    position: 'Director - Admissions and New Initiative',
    role: 'Student Services',
    department: 'SGT University',
    image: 'https://sgtuniversity.ac.in/assets/images/about-sgt/university/Dr-Joginder-Yadav.webp',
    email: 'info@sgtuniversity.org',
    phone: '1800 102 5661',
    profileUrl: 'https://sgtuniversity.ac.in/about/our-officers/dr-joginder-yadav.html',
    type: 'dignity'
  }
];

// Announcements data with different categories
interface Announcement {
  id: number;
  title: string;
  date: string;
  category: string;
  details: string;
  fileReference?: string;
}

const announcementsData: Record<string, Announcement[]> = {
  Academic: [
    {
      id: 1,
      title: 'Career Counselling Session for the Second Year undergraduate students of Mittal School of Business session 3',
      date: '31 Jan 2026',
      category: 'Academic',
      details: 'A comprehensive career counselling session will be conducted for second year undergraduate students of Mittal School of Business. The session will cover various career opportunities, industry trends, and guidance for internships and placements. Students are requested to attend with their resume drafts.',
      fileReference: 'SGT/20.2/ST/2024/001/IC/260131/0001'
    },
    {
      id: 2,
      title: 'EDU Revolution: List of students (Phase I) selected for Up to 10 % Attendance benefit for Term–II of session 2025–26',
      date: '31 Jan 2026',
      category: 'Academic',
      details: 'The EDU Revolution program has announced Phase I results for attendance benefits. Selected students will receive up to 10% attendance benefit for Term-II of the academic session 2025-26. This benefit is awarded based on academic performance, participation in co-curricular activities, and consistent attendance in previous terms.',
      fileReference: 'SGT/10.2/ANN(DAA)/2024/023(23.2)(Vol–1)/IC/260131/0133'
    },
    {
      id: 3,
      title: 'Invitation for Ph.D. Public Viva–Voce Examination - Computer Science Department',
      date: '31 Jan 2026',
      category: 'Academic',
      details: 'The Department of Computer Science invites faculty members and research scholars to attend the Ph.D. Public Viva-Voce Examination. The candidate will present their research work on "Advanced Machine Learning Algorithms for Real-time Data Processing". All interested participants are requested to register in advance.',
      fileReference: 'SGT/10.2/ANN(EXAM)/2024/023(23.4)(Vol–7)/IC/260131/0131'
    },
    {
      id: 4,
      title: 'Mid-Semester Examination Schedule - All Programs (Feb 2026)',
      date: '30 Jan 2026',
      category: 'Academic',
      details: 'The mid-semester examinations for all undergraduate and postgraduate programs will be conducted from February 15-28, 2026. Students are advised to check the detailed datesheet on the university portal. Special attention should be given to examination guidelines and required documents.',
      fileReference: 'SGT/10.2/ANN(EXAM)/2024/023/IC/260130/0125'
    },
    {
      id: 5,
      title: 'Workshop on Advanced Data Analytics and Machine Learning',
      date: '29 Jan 2026',
      category: 'Academic',
      details: 'A 3-day intensive workshop on Advanced Data Analytics and Machine Learning will be organized from February 10-12, 2026. Industry experts and academicians will conduct hands-on sessions covering Python, R, TensorFlow, and real-world case studies. Registration closes on February 5, 2026.',
      fileReference: 'SGT/10.2/ANN(DAA)/2024/021/IC/260129/0118'
    }
  ],
  'Administrative/Misc': [
    {
      id: 6,
      title: 'University ID Card Renewal Process - Academic Year 2025-26',
      date: '30 Jan 2026',
      category: 'Administrative/Misc',
      details: 'All students are required to renew their University ID cards for the academic year 2025-26. The renewal process will be conducted at the Administrative Block from February 1-15, 2026. Students must bring their old ID card, two passport-size photographs, and a copy of their fee receipt.',
      fileReference: 'SGT/ADMIN/2024/ID/001'
    },
    {
      id: 7,
      title: 'Library Timing Revision - Extended Hours During Exam Period',
      date: '28 Jan 2026',
      category: 'Administrative/Misc',
      details: 'The Central Library will extend its working hours during the examination period from February 1 to March 31, 2026. New timings: Monday-Saturday: 7:00 AM to 11:00 PM, Sunday: 9:00 AM to 9:00 PM. The 24-hour reading room will remain operational with prior registration.',
      fileReference: 'SGT/LIB/2024/TIMING/003'
    },
    {
      id: 8,
      title: 'New Transport Route for Greater Noida Students',
      date: '27 Jan 2026',
      category: 'Administrative/Misc',
      details: 'A new transport route has been introduced for students residing in Greater Noida Extension. The bus will operate on a fixed schedule with pickup points at Pari Chowk, Alpha-1, and Knowledge Park-3. Students interested in availing this facility should register at the Transport Section by February 5, 2026.',
      fileReference: 'SGT/TRANS/2024/ROUTE/012'
    },
    {
      id: 9,
      title: 'Mandatory Safety Drill - All Hostels and Academic Blocks',
      date: '25 Jan 2026',
      category: 'Administrative/Misc',
      details: 'A mandatory safety and fire drill will be conducted across all hostels and academic blocks on February 3, 2026, at 10:00 AM. All students and staff members are required to participate. The drill will include evacuation procedures, use of fire extinguishers, and emergency protocols.',
      fileReference: 'SGT/SAFETY/2024/DRILL/002'
    }
  ],
  'Co-Curricular/Sports/Cultural': [
    {
      id: 10,
      title: 'Annual Inter-University Sports Championship 2026 - Registration Open',
      date: '31 Jan 2026',
      category: 'Co-Curricular/Sports/Cultural',
      details: 'SGT University invites student athletes to register for the Annual Inter-University Sports Championship 2026. Events include Cricket, Football, Basketball, Badminton, Table Tennis, Athletics, and Swimming. Trials will be conducted from February 8-12, 2026. Interested students should contact the Sports Department.',
      fileReference: 'SGT/SPORTS/2026/CHAMP/001'
    },
    {
      id: 11,
      title: 'Cultural Fest "Rang-e-SGT 2026" - Call for Participants',
      date: '30 Jan 2026',
      category: 'Co-Curricular/Sports/Cultural',
      details: 'The much-awaited cultural fest "Rang-e-SGT 2026" will be held from March 15-17, 2026. Events include Dance, Music, Drama, Fashion Show, Stand-up Comedy, and Literary competitions. Celebrity performances and industry interactions are planned. Register your team by February 10, 2026.',
      fileReference: 'SGT/CULTURAL/2026/FEST/001'
    },
    {
      id: 12,
      title: 'National Level Technical Symposium - TechXplore 2026',
      date: '29 Jan 2026',
      category: 'Co-Curricular/Sports/Cultural',
      details: 'Department of Engineering is organizing TechXplore 2026, a National Level Technical Symposium featuring Hackathons, Project Competitions, Technical Paper Presentations, and Robotics challenges. Total prize pool of ₹5 Lakhs. Open for participation from all universities. Register before February 15, 2026.',
      fileReference: 'SGT/TECH/2026/SYMP/001'
    },
    {
      id: 13,
      title: 'Yoga and Wellness Program - Weekly Sessions Starting February',
      date: '28 Jan 2026',
      category: 'Co-Curricular/Sports/Cultural',
      details: 'The Sports and Wellness Department is launching weekly Yoga and Wellness sessions starting February 5, 2026. Sessions will be conducted every Tuesday and Thursday from 6:00-7:00 AM at the University Auditorium lawn. Professional yoga instructors will guide students through meditation, asanas, and breathing exercises.',
      fileReference: 'SGT/WELLNESS/2026/YOGA/001'
    }
  ],
  Examination: [
    {
      id: 14,
      title: 'End Semester Examination Datesheet - Term II (April 2026)',
      date: '31 Jan 2026',
      category: 'Examination',
      details: 'The End Semester Examination datesheet for Term-II has been published on the university portal. Examinations will commence from April 1, 2026. Students must carry their admit cards and university ID cards. Any discrepancies in the datesheet should be reported to the Examination Cell by February 7, 2026.',
      fileReference: 'SGT/EXAM/2026/DATESHEET/001'
    },
    {
      id: 15,
      title: 'Admit Card Download Notice - Mid Semester Examinations',
      date: '30 Jan 2026',
      category: 'Examination',
      details: 'Admit cards for Mid Semester Examinations (February 2026) are now available for download on the student portal. Students must verify all details on their admit cards including examination center, roll number, and subjects. Any errors should be immediately reported to the Examination Section.',
      fileReference: 'SGT/EXAM/2026/ADMIT/001'
    },
    {
      id: 16,
      title: 'Supplementary Examination Registration - Last Date Extended',
      date: '29 Jan 2026',
      category: 'Examination',
      details: 'The last date for Supplementary Examination registration has been extended to February 10, 2026. Eligible students who have backlog in previous semesters can register through the student portal. Late fee will be applicable after February 5, 2026. Contact Examination Cell for any queries.',
      fileReference: 'SGT/EXAM/2026/SUPP/002'
    },
    {
      id: 17,
      title: 'Re-evaluation and Photocopy Request Process for December 2025 Results',
      date: '27 Jan 2026',
      category: 'Examination',
      details: 'Students who wish to apply for re-evaluation or photocopy of answer scripts for December 2025 examinations can submit their applications from February 1-15, 2026. The prescribed fee must be paid online. Results of re-evaluation will be declared within 30 days of application.',
      fileReference: 'SGT/EXAM/2026/REEVAL/001'
    }
  ],
  Placement: [
    {
      id: 18,
      title: 'Campus Recruitment Drive - TCS, Infosys, Wipro (February 2026)',
      date: '31 Jan 2026',
      category: 'Placement',
      details: 'Leading IT companies TCS, Infosys, and Wipro will conduct campus recruitment drives from February 20-25, 2026. Eligible students: B.Tech/MCA with CGPA ≥ 7.0. The drive will include aptitude test, technical interview, and HR round. Students must register on the placement portal by February 8, 2026.',
      fileReference: 'SGT/PLACEMENT/2026/DRIVE/001'
    },
    {
      id: 19,
      title: 'Internship Opportunities - Summer 2026 at Fortune 500 Companies',
      date: '30 Jan 2026',
      category: 'Placement',
      details: 'The Placement Cell has received internship offers from multiple Fortune 500 companies for Summer 2026. Positions available in Software Development, Data Science, Marketing, Finance, and Operations. Stipend range: ₹20,000-50,000 per month. Apply through the placement portal before February 12, 2026.',
      fileReference: 'SGT/PLACEMENT/2026/INTERN/002'
    },
    {
      id: 20,
      title: 'Pre-Placement Talk - Deloitte & Amazon - Register Now',
      date: '29 Jan 2026',
      category: 'Placement',
      details: 'Deloitte and Amazon will conduct Pre-Placement Talks on February 15, 2026, in the University Auditorium. Representatives will discuss company culture, job roles, selection process, and career growth opportunities. Open for final year students of all branches. Registration mandatory through placement portal.',
      fileReference: 'SGT/PLACEMENT/2026/PPT/003'
    },
    {
      id: 21,
      title: 'Placement Preparation Workshop - Aptitude, Coding & Interview Skills',
      date: '28 Jan 2026',
      category: 'Placement',
      details: 'A comprehensive 5-day Placement Preparation Workshop will be conducted from February 10-14, 2026. Sessions will cover Quantitative Aptitude, Logical Reasoning, Data Structures & Algorithms, System Design, HR Interview techniques, and Group Discussion. Industry mentors will conduct mock interviews. Free for all students.',
      fileReference: 'SGT/PLACEMENT/2026/WORKSHOP/001'
    }
  ]
};

const announcementCategories = [
  { name: 'Academic', count: 5 },
  { name: 'Administrative/Misc', count: 4 },
  { name: 'Co-Curricular/Sports/Cultural', count: 4 },
  { name: 'Examination', count: 4 },
  { name: 'Placement', count: 4 }
];

// Placement Drives Data with Full JD Details
const placementDrives = [
  {
    id: 1,
    company: 'Tata Consultancy Services',
    shortName: 'TCS',
    logo: null,
    role: 'Software Developer',
    eligibility: 'B.Tech CSE, IT',
    package: '7-12 LPA',
    timing: '9:00 AM - 5:00 PM',
    status: 'ongoing' as const,
    statusText: 'Ongoing',
    venue: 'Block D, Auditorium',
    date: '2026-02-03',
    colorScheme: 'blue',
    jobDescription: {
      aboutCompany: 'Tata Consultancy Services (TCS) is an IT services, consulting, and business solutions organization that has been partnering with many of the world\'s largest businesses for over 50 years. TCS offers a consulting-led, cognitive powered, integrated portfolio of business, technology, and engineering services and solutions.',
      roleDescription: 'As a Software Developer at TCS, you will be responsible for designing, developing, and maintaining software applications. You will work with cross-functional teams to define, design, and ship new features.',
      responsibilities: [
        'Design, develop, and maintain high-quality software solutions',
        'Write clean, scalable, and efficient code following coding standards',
        'Collaborate with product managers and designers to define software requirements',
        'Troubleshoot, debug, and upgrade existing software applications',
        'Participate in code reviews and contribute to team knowledge sharing',
        'Stay updated with emerging technologies and industry trends'
      ],
      requirements: [
        'B.Tech/B.E. in Computer Science, IT, or related field',
        'Strong understanding of data structures and algorithms',
        'Proficiency in at least one programming language (Java, Python, C++)',
        'Knowledge of database management systems (SQL/NoSQL)',
        'Excellent problem-solving and analytical skills',
        'Good communication and teamwork abilities'
      ],
      skills: ['Java', 'Python', 'SQL', 'Data Structures', 'Problem Solving', 'Agile'],
      selectionProcess: ['Online Assessment', 'Technical Interview', 'HR Interview'],
      perks: ['Health Insurance', 'Life Insurance', 'Paid Time Off', 'Learning & Development Programs', 'Employee Stock Options']
    }
  },
  {
    id: 2,
    company: 'Infosys Limited',
    shortName: 'Infosys',
    logo: null,
    role: 'Systems Engineer',
    eligibility: 'B.Tech All Branches',
    package: '6-9 LPA',
    timing: '10:00 AM - 4:00 PM',
    status: 'upcoming' as const,
    statusText: '2:00 PM',
    venue: 'Block D, Auditorium',
    date: '2026-02-03',
    colorScheme: 'purple',
    jobDescription: {
      aboutCompany: 'Infosys Limited is a global leader in next-generation digital services and consulting. We enable clients in more than 50 countries to navigate their digital transformation. With over 4 decades of experience, we expertly steer clients through their digital journey.',
      roleDescription: 'As a Systems Engineer at Infosys, you will be working on cutting-edge technologies and will be involved in all phases of the software development lifecycle.',
      responsibilities: [
        'Analyze system requirements and develop technical specifications',
        'Design and implement software solutions based on client requirements',
        'Perform system testing and quality assurance activities',
        'Provide technical support and troubleshooting',
        'Document system configurations and procedures',
        'Collaborate with global teams on project deliverables'
      ],
      requirements: [
        'B.Tech/B.E. in any branch with 60%+ aggregate',
        'Strong logical and analytical thinking',
        'Basic programming knowledge in any language',
        'Good communication skills in English',
        'Flexibility to work in shifts and relocate',
        'No active backlogs at the time of joining'
      ],
      skills: ['Programming Fundamentals', 'Problem Solving', 'Communication', 'Teamwork', 'Adaptability'],
      selectionProcess: ['Online Test', 'Technical Interview', 'HR Interview'],
      perks: ['Competitive Salary', 'Global Exposure', 'Training Programs', 'Health Benefits', 'Career Growth']
    }
  },
  {
    id: 3,
    company: 'Wipro Technologies',
    shortName: 'Wipro',
    logo: null,
    role: 'Project Engineer',
    eligibility: 'B.Tech CSE, ECE',
    package: '5-8 LPA',
    timing: '11:00 AM - 6:00 PM',
    status: 'upcoming' as const,
    statusText: '3:30 PM',
    venue: 'Block D, Auditorium',
    date: '2026-02-03',
    colorScheme: 'teal',
    jobDescription: {
      aboutCompany: 'Wipro Limited is a leading global information technology, consulting, and business process services company. We harness the power of cognitive computing, hyper-automation, robotics, cloud, analytics, and emerging technologies.',
      roleDescription: 'As a Project Engineer at Wipro, you will work on diverse technology projects for global clients, contributing to solution design and implementation.',
      responsibilities: [
        'Develop and maintain software applications as per project requirements',
        'Participate in requirement gathering and analysis sessions',
        'Write unit tests and ensure code quality',
        'Collaborate with team members and stakeholders',
        'Follow Agile/Scrum methodologies for project delivery',
        'Continuously learn and adapt to new technologies'
      ],
      requirements: [
        'B.Tech/B.E. in CSE, ECE, or related fields',
        'Minimum 60% throughout academics',
        'Strong foundation in programming concepts',
        'Good analytical and problem-solving skills',
        'Willingness to work in any Wipro location',
        'Excellent verbal and written communication'
      ],
      skills: ['Java', 'C++', 'Python', 'SQL', 'Linux', 'Agile Methodology'],
      selectionProcess: ['Aptitude Test', 'Technical Round', 'HR Discussion'],
      perks: ['Insurance Coverage', 'Flexible Work Hours', 'Learning Platforms', 'Employee Wellness Programs']
    }
  },
  {
    id: 4,
    company: 'Capgemini India',
    shortName: 'Capgemini',
    logo: null,
    role: 'Analyst',
    eligibility: 'B.Tech, BCA, MCA',
    package: '4-7 LPA',
    timing: '9:30 AM - 5:30 PM',
    status: 'completed' as const,
    statusText: 'Completed',
    venue: 'Block D, Auditorium',
    date: '2026-02-03',
    colorScheme: 'amber',
    jobDescription: {
      aboutCompany: 'Capgemini is a global leader in partnering with companies to transform and manage their business by harnessing the power of technology. We are guided every day by our purpose of unleashing human energy through technology for an inclusive and sustainable future.',
      roleDescription: 'As an Analyst at Capgemini, you will support project teams in delivering solutions to clients across various industries.',
      responsibilities: [
        'Analyze business requirements and translate into technical solutions',
        'Develop and test software components',
        'Prepare documentation and reports',
        'Support senior team members in project activities',
        'Participate in client meetings and presentations',
        'Maintain quality standards in all deliverables'
      ],
      requirements: [
        'B.Tech, BCA, MCA with 55%+ aggregate',
        'Basic understanding of software development',
        'Strong analytical and logical reasoning',
        'Good presentation and communication skills',
        'Team player with positive attitude',
        'Ready to travel and relocate as needed'
      ],
      skills: ['Analytical Skills', 'MS Office', 'Basic Programming', 'Communication', 'Problem Solving'],
      selectionProcess: ['Written Test', 'Group Discussion', 'Personal Interview'],
      perks: ['Competitive Package', 'Global Opportunities', 'Skill Development', 'Work-Life Balance']
    }
  }
];

// Academic Calendar Events Data - Official Gazetted Holidays from India.gov.in
const academicCalendarEvents = [
  // January 2026 - Indian National Gazetted Holidays
  { date: '2026-01-01', title: 'New Year\'s Day', type: 'holiday' as const, description: 'Celebration of the first day of the year - Gazetted Holiday' },
  { date: '2026-01-14', title: 'Makar Sankranti / Pongal', type: 'holiday' as const, description: 'Harvest festival celebrated across India - Restricted Holiday' },
  { date: '2026-01-23', title: 'Netaji Subhas Chandra Bose Jayanti', type: 'holiday' as const, description: 'Birth anniversary of Netaji Subhas Chandra Bose - Restricted Holiday (Parakram Diwas)' },
  { date: '2026-01-26', title: 'Republic Day', type: 'holiday' as const, description: 'National holiday - Celebration of Indian Constitution adoption - Gazetted Holiday' },
  
  // February 2026 - Official Holidays
  { date: '2026-02-01', title: 'Guru Ravi Das Jayanti', type: 'holiday' as const, description: 'Birth anniversary of Sant Guru Ravi Das - Restricted Holiday' },
  { date: '2026-02-02', title: 'Data Structures & Algorithms Exam', type: 'exam' as const, description: 'End-term examination', courseCode: 'CS301', room: 'Room 201', building: 'Block A', time: '10:00 AM - 1:00 PM', examType: 'End Semester', maxMarks: 100, duration: '3 hours', instructions: ['Carry your admit card and ID card', 'Report 30 minutes before exam', 'No electronic devices allowed', 'Use only blue/black pen'] },
  { date: '2026-02-05', title: 'Mid-Semester Exam Begins', type: 'exam' as const, description: 'Mid-term examinations start for all departments', courseCode: 'ALL', room: 'As per datesheet', building: 'All Blocks', time: '9:00 AM onwards', examType: 'Mid Semester', maxMarks: 50, duration: '2 hours', instructions: ['Check datesheet for subject-wise schedule', 'Carry hall ticket', 'No electronic devices allowed', 'Use only blue/black pen'] },
  { date: '2026-02-06', title: 'Operating Systems Exam', type: 'exam' as const, description: 'Mid-term examination', courseCode: 'CS302', room: 'Room 105', building: 'Block B', time: '10:00 AM - 12:00 PM', examType: 'Mid Semester', maxMarks: 50, duration: '2 hours', instructions: ['Carry your admit card and ID card', 'Report 30 minutes before exam', 'No electronic devices allowed', 'Use only blue/black pen'] },
  { date: '2026-02-12', title: 'Swami Dayananda Saraswati Jayanti', type: 'holiday' as const, description: 'Birthday of Swami Dayananda Saraswati - Restricted Holiday' },
  { date: '2026-02-14', title: 'Valentine\'s Day Celebration', type: 'event' as const, description: 'Campus cultural event organized by Student Council' },
  { date: '2026-02-15', title: 'Maha Shivaratri', type: 'holiday' as const, description: 'Hindu festival dedicated to Lord Shiva - Gazetted Holiday' },
  { date: '2026-02-16', title: 'Database Management Systems Exam', type: 'exam' as const, description: 'Mid-term examination', courseCode: 'CS303', room: 'Room 302', building: 'Block A', time: '2:00 PM - 4:00 PM', examType: 'Mid Semester', maxMarks: 50, duration: '2 hours', instructions: ['Carry your admit card and ID card', 'Report 30 minutes before exam', 'No electronic devices allowed', 'Use only blue/black pen'] },
  { date: '2026-02-19', title: 'Shivaji Jayanti', type: 'holiday' as const, description: 'Birth anniversary of Chhatrapati Shivaji Maharaj - Restricted Holiday' },
  { date: '2026-02-20', title: 'Computer Networks Exam', type: 'exam' as const, description: 'Mid-term examination', courseCode: 'CS304', room: 'Room 401', building: 'Block C', time: '10:00 AM - 12:00 PM', examType: 'Mid Semester', maxMarks: 50, duration: '2 hours', instructions: ['Carry your admit card and ID card', 'Report 30 minutes before exam', 'No electronic devices allowed', 'Use only blue/black pen'] },
  { date: '2026-02-26', title: 'Mid-Semester Results', type: 'crucial' as const, description: 'Mid-term exam results announcement' },
  { date: '2026-02-27', title: 'Software Engineering Exam', type: 'exam' as const, description: 'Mid-term examination', courseCode: 'CS305', room: 'Room 201', building: 'Block A', time: '10:00 AM - 12:00 PM', examType: 'Mid Semester', maxMarks: 50, duration: '2 hours', instructions: ['Carry your admit card and ID card', 'Report 30 minutes before exam', 'No electronic devices allowed', 'Use only blue/black pen'] },
  
  // February 2026 - SGT University Events
  { date: '2026-02-05', title: 'Interview & Counseling Sessions', type: 'event' as const, description: 'Admissions & Student Interaction - SGT University Event' },
  
  // March 2026 - Official Holidays & SGT Events
  { date: '2026-03-01', title: 'Basant Utsav 2026', type: 'event' as const, description: 'Spring Festival / Agriculture Celebration - SGT University Event' },
  { date: '2026-03-03', title: 'Holi', type: 'holiday' as const, description: 'Festival of colors - Gazetted Holiday' },
  { date: '2026-03-08', title: 'International Women\'s Day', type: 'event' as const, description: 'Special celebration and seminar' },
  { date: '2026-03-15', title: 'Agri Job Fair', type: 'event' as const, description: 'Career Placement in Agriculture - SGT University Event' },
  { date: '2026-03-25', title: 'Sports Week Begins', type: 'event' as const, description: 'Inter-department sports competitions' },
  
  // April 2026 - Official Holidays & SGT Events
  { date: '2026-04-03', title: 'Good Friday', type: 'holiday' as const, description: 'Christian holy day - Gazetted Holiday' },
  { date: '2026-04-06', title: 'End-Semester Exam Registration', type: 'crucial' as const, description: 'Last date for exam form submission' },
  { date: '2026-04-14', title: 'Dr. Ambedkar Jayanti', type: 'holiday' as const, description: 'Birth anniversary of Dr. B.R. Ambedkar - Gazetted Holiday' },
  { date: '2026-04-14', title: 'Baisakhi Festival', type: 'event' as const, description: 'Regional Cultural Celebration - SGT University Event' },
  { date: '2026-04-21', title: 'Mahavir Jayanti', type: 'holiday' as const, description: 'Birth anniversary of Lord Mahavir - Gazetted Holiday' },
  { date: '2026-04-22', title: 'Ram Navami', type: 'holiday' as const, description: 'Birth of Lord Rama - Restricted Holiday' },
  
  // May 2026 - Official Holidays & SGT Events
  { date: '2026-05-01', title: 'May Day', type: 'holiday' as const, description: 'International Workers\' Day - Gazetted Holiday' },
  { date: '2026-05-04', title: 'End-Semester Exams Begin', type: 'exam' as const, description: 'Final examinations start for all programs', courseCode: 'ALL', room: 'As per datesheet', building: 'All Blocks', time: '9:00 AM onwards', examType: 'End Semester', maxMarks: 100, duration: '3 hours', instructions: ['Check datesheet for subject-wise schedule', 'Carry hall ticket and ID card', 'No electronic devices allowed', 'Use only blue/black pen'] },
  { date: '2026-05-10', title: 'International Nanoscience Conference', type: 'event' as const, description: 'Research & Applied Sciences - SGT University Event' },
  { date: '2026-05-12', title: 'Buddha Purnima', type: 'holiday' as const, description: 'Birth anniversary of Gautama Buddha - Gazetted Holiday' },
  
  // June 2026 - SGT Events
  { date: '2026-06-05', title: 'Summer Vacation Begins', type: 'crucial' as const, description: 'Semester break starts' },
  { date: '2026-06-15', title: 'Annual Convocation 2026', type: 'crucial' as const, description: 'Graduation Ceremony - SGT University Event' },
  { date: '2026-06-15', title: 'Result Declaration', type: 'crucial' as const, description: 'End-semester results published' },
  { date: '2026-06-17', title: 'Eid ul-Adha (Bakrid)', type: 'holiday' as const, description: 'Islamic festival of sacrifice - Gazetted Holiday' },
  
  // July 2026 - Official Holidays
  { date: '2026-07-15', title: 'New Session Begins', type: 'crucial' as const, description: 'Next academic year starts' },
  { date: '2026-07-17', title: 'Muharram', type: 'holiday' as const, description: 'Islamic New Year - Gazetted Holiday' },
  
  // August 2026 - Official Holidays
  { date: '2026-08-08', title: 'Janmashtami', type: 'holiday' as const, description: 'Birth anniversary of Lord Krishna - Gazetted Holiday' },
  { date: '2026-08-15', title: 'Independence Day', type: 'holiday' as const, description: 'National holiday - Flag hoisting ceremony - Gazetted Holiday' },
  { date: '2026-08-26', title: 'Freshers\' Week', type: 'event' as const, description: 'Welcome program for new students' },
  
  // September 2026 - Official Holidays
  { date: '2026-09-05', title: 'Teachers\' Day', type: 'event' as const, description: 'Birth anniversary of Dr. Sarvepalli Radhakrishnan - Celebration for teachers' },
  { date: '2026-09-16', title: 'Milad-un-Nabi', type: 'holiday' as const, description: 'Prophet Muhammad\'s Birthday - Gazetted Holiday' },
  
  // October 2026 - Official Holidays
  { date: '2026-10-02', title: 'Mahatma Gandhi Jayanti', type: 'holiday' as const, description: 'Birth anniversary of Mahatma Gandhi - Gazetted Holiday' },
  { date: '2026-10-20', title: 'Dussehra (Vijaya Dashami)', type: 'holiday' as const, description: 'Victory of good over evil - Gazetted Holiday' },
  { date: '2026-10-31', title: 'Sardar Patel Jayanti', type: 'event' as const, description: 'National Unity Day - Birth anniversary of Sardar Vallabhbhai Patel' },
  
  // November 2026 - Official Holidays
  { date: '2026-11-08', title: 'Diwali (Deepavali)', type: 'holiday' as const, description: 'Festival of lights - Gazetted Holiday' },
  { date: '2026-11-09', title: 'Govardhan Puja', type: 'holiday' as const, description: 'Day after Diwali - Restricted Holiday' },
  { date: '2026-11-10', title: 'Bhai Dooj', type: 'holiday' as const, description: 'Festival celebrating brother-sister bond - Restricted Holiday' },
  { date: '2026-11-14', title: 'Children\'s Day', type: 'event' as const, description: 'Birth anniversary of Jawaharlal Nehru - Special activities for children' },
  { date: '2026-11-23', title: 'Guru Nanak Jayanti', type: 'holiday' as const, description: 'Birth anniversary of Guru Nanak Dev - Gazetted Holiday' },
  { date: '2026-11-26', title: 'Constitution Day', type: 'event' as const, description: 'Commemoration of adoption of Indian Constitution' },
  
  // December 2026 - Official Holidays
  { date: '2026-12-25', title: 'Christmas', type: 'holiday' as const, description: 'Birth of Jesus Christ - Gazetted Holiday' },
  { date: '2026-12-31', title: 'New Year\'s Eve', type: 'event' as const, description: 'End of year celebration' }
];

export default function StudentDashboard() {
  console.log('✅ =========================================');
  console.log('✅ StudentDashboard component RENDERING');
  console.log('✅ Version: NEW REDESIGNED WITH CALENDAR');
  console.log('✅ Timestamp:', new Date().toISOString());
  console.log('✅ =========================================');

  const { user } = useAuthStore();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<ExamDetail | null>(null);
  const [showFullTimetable, setShowFullTimetable] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 1, 1)); // February 2026
  const [showYearView, setShowYearView] = useState(true); // Show year view by default
  const [activeModal, setActiveModal] = useState<'happening' | 'messages' | 'assignments' | 'events' | null>(null);
  const [showCGPAModal, setShowCGPAModal] = useState(false);
  const [cgpaActiveTab, setCgpaActiveTab] = useState<'statistical' | 'marks' | 'grades'>('statistical');
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceActiveTab, setAttendanceActiveTab] = useState<'overview' | 'comparison'>('overview');
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{x: number, y: number, value: string} | null>(null);
  const authoritiesScrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [activeAuthorityIndex, setActiveAuthorityIndex] = useState(5); // Start with Vice-Chancellor in center
  const [activeAnnouncementTab, setActiveAnnouncementTab] = useState('Academic');
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<number | null>(null);
  const [activeSgtTimesTab, setActiveSgtTimesTab] = useState('All');
  const [selectedMarksTerm, setSelectedMarksTerm] = useState(1);
  const [selectedGradesTerm, setSelectedGradesTerm] = useState(1);

  // Academic Calendar State
  const [selectedMonth, setSelectedMonth] = useState(new Date(2026, 1, 1)); // February 2026
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarFilter, setCalendarFilter] = useState<'all' | 'holiday' | 'exam' | 'event' | 'crucial'>('all');

  // Placement Drives State
  const [selectedPlacementDrive, setSelectedPlacementDrive] = useState<typeof placementDrives[0] | null>(null);
  const [showAllPlacementDrives, setShowAllPlacementDrives] = useState(false);

  // Virtual Tour State
  const [showTour, setShowTour] = useState(false);
  const [showTourButton, setShowTourButton] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Tour Steps Configuration - Ordered top to bottom, left to right
  const tourSteps: TourStep[] = [
    {
      id: 'profile-pic',
      target: 'profile-picture',
      title: 'Profile Picture',
      description: 'Tap your photo to access quick options like changing your UMS password, resetting Wi-Fi password, updating your profile, or signing out.',
      position: 'bottom'
    },
    {
      id: 'welcome-section',
      target: 'welcome-section',
      title: 'Welcome Section',
      description: 'View your personalized greeting with your name, student ID (UID), and current date. This section gives you a quick overview of your academic identity.',
      position: 'bottom'
    },
    {
      id: 'happening-card',
      target: 'happening-card',
      title: 'Happening Now',
      description: 'See real-time happenings on campus. Click to view all current activities, ongoing events, and live updates.',
      position: 'bottom'
    },
    {
      id: 'messages-card',
      target: 'messages-card',
      title: 'Messages',
      description: 'Check your unread messages from faculty, administration, and peers. Stay connected with important communications.',
      position: 'bottom'
    },
    {
      id: 'assignments-card',
      target: 'assignments-card',
      title: 'Assignments',
      description: 'Track pending assignments across all your courses. Click to view details, submit work, and manage deadlines.',
      position: 'bottom'
    },
    {
      id: 'events-card',
      target: 'events-card',
      title: 'Upcoming Events',
      description: 'Stay informed about upcoming university events, workshops, seminars, and campus activities.',
      position: 'bottom'
    },
    {
      id: 'fees-card',
      target: 'fees-card',
      title: 'Fees Status',
      description: 'Check your fee payment status. View pending dues, payment history, and access online payment options.',
      position: 'bottom'
    },
    {
      id: 'cgpa-card',
      target: 'cgpa-card',
      title: 'Academic Performance (CGPA)',
      description: 'Your cumulative grade point average is displayed here. Click to view detailed analytics including term-wise marks, grades distribution, and semester-wise TGPA trends.',
      position: 'right'
    },
    {
      id: 'attendance-card',
      target: 'attendance-card',
      title: 'Attendance Tracker',
      description: 'Monitor your attendance percentage including today\'s status (Present/Absent), weekly and monthly statistics. Click for detailed subject-wise attendance breakdown.',
      position: 'left'
    },
    {
      id: 'academic-calendar',
      target: 'academic-calendar',
      title: 'Academic Activities Calendar',
      description: 'Interactive calendar showing holidays, exams, events, and important dates. Click on any colored date to see event details. Use filter buttons to view specific event types.',
      position: 'left'
    },
    {
      id: 'todays-timetable',
      target: 'todays-timetable',
      title: 'Today\'s Timetable',
      description: 'View your class schedule for today including lecture timings, room numbers, building location, faculty names, and class types (Lecture/Lab/Tutorial).',
      position: 'top'
    },
    {
      id: 'recently-placed',
      target: 'recently-placed',
      title: 'Recently Placed Students',
      description: 'View recent placement success stories from SGT University. See company names, job roles, and packages offered to successfully placed students.',
      position: 'top'
    },
    {
      id: 'placement-drives',
      target: 'placement-drives',
      title: 'Today\'s Placement Drives',
      description: 'Check ongoing and upcoming placement drives happening today. Click on any company to view the complete Job Description, eligibility criteria, and apply.',
      position: 'top'
    },
    {
      id: 'announcements',
      target: 'research-excellence',
      title: 'University Announcements',
      description: 'Stay updated with important announcements from the university. Filter by category - Academic, Administrative, Co-Curricular, Examination, or Placement.',
      position: 'top'
    },
    {
      id: 'authorities',
      target: 'authorities-section',
      title: 'Know Your Authorities',
      description: 'Meet the university leadership team including Chancellor, Vice-Chancellor, Pro Vice-Chancellors, Registrar, and other key officials. View their profiles and contact details.',
      position: 'top'
    },
    {
      id: 'guidelines-news',
      target: 'guidelines-news',
      title: 'Guidelines & Policies',
      description: 'Access important university guidelines including Scholarship Policy, Academic Regulations, Exam Guidelines, Placement Policy, and more. Download policy documents directly.',
      position: 'top'
    },
    {
      id: 'social-footprints',
      target: 'social-footprints',
      title: 'Social Media Connect',
      description: 'Connect with SGT University on social media. Follow on Instagram, LinkedIn, YouTube, Facebook, and Twitter. Also access SGT Times for latest news.',
      position: 'top'
    }
  ];

  // Check if tour should be shown automatically (first visit)
  useEffect(() => {
    const tourCompleted = localStorage.getItem('dashboardTourCompleted');
    const remindLater = localStorage.getItem('dashboardTourRemindLater');
    
    if (!tourCompleted) {
      // Check if remind later was set and if 24 hours have passed
      if (remindLater) {
        const remindTime = parseInt(remindLater);
        const dayInMs = 24 * 60 * 60 * 1000;
        if (Date.now() - remindTime > dayInMs) {
          // Show tour after delay for better UX
          setTimeout(() => setShowTour(true), 2000);
        }
      } else {
        // First time visitor - show tour after page loads
        setTimeout(() => setShowTour(true), 2000);
      }
    }
  }, []);

  // Auto-advance slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sgtEventSlides.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Listen for tour start event from header button
  useEffect(() => {
    const handleStartTour = () => {
      setShowTour(true);
      setShowTourButton(true);
    };

    window.addEventListener('startTour', handleStartTour);
    return () => window.removeEventListener('startTour', handleStartTour);
  }, []);

  // Comprehensive Term-wise Data for all 7 terms
  const termWiseData = {
    1: {
      termId: '122231',
      cgpa: 7.85,
      subjects: [
        { subject: 'CHE110 : ENVIRONMENTAL STUDIES', credit: 4, grade: 'A+', gradePoint: 9, components: [
          { type: 'Objective Type Mid Term', obtained: '15/20', weighted: '15/20' },
          { type: 'Continuous Assessment', obtained: '90/100', weighted: '36/40' },
          { type: 'Attendance', obtained: '5/5', weighted: '5/5' },
          { type: 'Objective Type End Term', obtained: '30/35', weighted: '18/35' },
        ]},
        { subject: 'CSE111 : ORIENTATION TO COMPUTING - I', credit: 2, grade: 'O', gradePoint: 10, components: [
          { type: 'Continuous Assessment', obtained: '94/100', weighted: '60/60' },
        ]},
        { subject: 'CSE326 : INTERNET PROGRAMMING LABORATORY', credit: 2, grade: 'A+', gradePoint: 9, components: [
          { type: 'Continuous Assessment', obtained: '90/100', weighted: '41/45' },
          { type: 'Attendance', obtained: '5/5', weighted: '5/5' },
          { type: 'Practical End Term', obtained: '70/100', weighted: '35/50' },
        ]},
        { subject: 'MTH101 : MATHEMATICS - I', credit: 4, grade: 'B+', gradePoint: 8, components: [
          { type: 'Mid Term', obtained: '18/30', weighted: '18/30' },
          { type: 'Continuous Assessment', obtained: '75/100', weighted: '30/40' },
          { type: 'End Term', obtained: '45/70', weighted: '27/30' },
        ]},
        { subject: 'PHY101 : PHYSICS', credit: 3, grade: 'A', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '22/30', weighted: '22/30' },
          { type: 'Continuous Assessment', obtained: '85/100', weighted: '34/40' },
          { type: 'End Term', obtained: '50/70', weighted: '30/30' },
        ]},
      ]
    },
    2: {
      termId: '123332',
      cgpa: 8.12,
      subjects: [
        { subject: 'CSE201 : DATA STRUCTURES', credit: 4, grade: 'A', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '25/30', weighted: '25/30' },
          { type: 'Continuous Assessment', obtained: '88/100', weighted: '35/40' },
          { type: 'End Term', obtained: '55/70', weighted: '33/30' },
        ]},
        { subject: 'CSE202 : OBJECT ORIENTED PROGRAMMING', credit: 3, grade: 'A+', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '28/30', weighted: '28/30' },
          { type: 'Continuous Assessment', obtained: '92/100', weighted: '37/40' },
          { type: 'End Term', obtained: '58/70', weighted: '35/30' },
        ]},
        { subject: 'MTH201 : MATHEMATICS - II', credit: 4, grade: 'B+', gradePoint: 8, components: [
          { type: 'Mid Term', obtained: '20/30', weighted: '20/30' },
          { type: 'Continuous Assessment', obtained: '78/100', weighted: '31/40' },
          { type: 'End Term', obtained: '48/70', weighted: '29/30' },
        ]},
        { subject: 'CSE203 : DIGITAL LOGIC DESIGN', credit: 3, grade: 'A', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '24/30', weighted: '24/30' },
          { type: 'Continuous Assessment', obtained: '86/100', weighted: '34/40' },
          { type: 'End Term', obtained: '52/70', weighted: '31/30' },
        ]},
      ]
    },
    3: {
      termId: '124433',
      cgpa: 8.35,
      subjects: [
        { subject: 'CSE301 : ALGORITHMS', credit: 4, grade: 'A+', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '27/30', weighted: '27/30' },
          { type: 'Continuous Assessment', obtained: '90/100', weighted: '36/40' },
          { type: 'End Term', obtained: '60/70', weighted: '36/30' },
        ]},
        { subject: 'CSE302 : DATABASE SYSTEMS', credit: 4, grade: 'A', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '25/30', weighted: '25/30' },
          { type: 'Continuous Assessment', obtained: '85/100', weighted: '34/40' },
          { type: 'End Term', obtained: '55/70', weighted: '33/30' },
        ]},
        { subject: 'CSE303 : OPERATING SYSTEMS', credit: 3, grade: 'A', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '24/30', weighted: '24/30' },
          { type: 'Continuous Assessment', obtained: '88/100', weighted: '35/40' },
          { type: 'End Term', obtained: '54/70', weighted: '32/30' },
        ]},
        { subject: 'CSE304 : COMPUTER NETWORKS', credit: 3, grade: 'B+', gradePoint: 8, components: [
          { type: 'Mid Term', obtained: '22/30', weighted: '22/30' },
          { type: 'Continuous Assessment', obtained: '80/100', weighted: '32/40' },
          { type: 'End Term', obtained: '50/70', weighted: '30/30' },
        ]},
      ]
    },
    4: {
      termId: '125534',
      cgpa: 8.56,
      subjects: [
        { subject: 'CSE401 : SOFTWARE ENGINEERING', credit: 4, grade: 'A+', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '28/30', weighted: '28/30' },
          { type: 'Continuous Assessment', obtained: '92/100', weighted: '37/40' },
          { type: 'End Term', obtained: '62/70', weighted: '37/30' },
        ]},
        { subject: 'CSE402 : MACHINE LEARNING', credit: 4, grade: 'A', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '26/30', weighted: '26/30' },
          { type: 'Continuous Assessment', obtained: '88/100', weighted: '35/40' },
          { type: 'End Term', obtained: '58/70', weighted: '35/30' },
        ]},
        { subject: 'CSE403 : WEB TECHNOLOGIES', credit: 3, grade: 'O', gradePoint: 10, components: [
          { type: 'Mid Term', obtained: '29/30', weighted: '29/30' },
          { type: 'Continuous Assessment', obtained: '95/100', weighted: '38/40' },
          { type: 'End Term', obtained: '65/70', weighted: '39/30' },
        ]},
      ]
    },
    5: {
      termId: '126635',
      cgpa: 8.72,
      subjects: [
        { subject: 'CSE501 : ARTIFICIAL INTELLIGENCE', credit: 4, grade: 'A+', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '27/30', weighted: '27/30' },
          { type: 'Continuous Assessment', obtained: '91/100', weighted: '36/40' },
          { type: 'End Term', obtained: '61/70', weighted: '37/30' },
        ]},
        { subject: 'CSE502 : CLOUD COMPUTING', credit: 3, grade: 'A', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '25/30', weighted: '25/30' },
          { type: 'Continuous Assessment', obtained: '87/100', weighted: '35/40' },
          { type: 'End Term', obtained: '56/70', weighted: '34/30' },
        ]},
        { subject: 'CSE503 : CYBER SECURITY', credit: 3, grade: 'A+', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '28/30', weighted: '28/30' },
          { type: 'Continuous Assessment', obtained: '93/100', weighted: '37/40' },
          { type: 'End Term', obtained: '63/70', weighted: '38/30' },
        ]},
      ]
    },
    6: {
      termId: '127736',
      cgpa: 8.88,
      subjects: [
        { subject: 'CSE601 : DEEP LEARNING', credit: 4, grade: 'A+', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '28/30', weighted: '28/30' },
          { type: 'Continuous Assessment', obtained: '94/100', weighted: '38/40' },
          { type: 'End Term', obtained: '64/70', weighted: '38/30' },
        ]},
        { subject: 'CSE602 : BIG DATA ANALYTICS', credit: 4, grade: 'A+', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '27/30', weighted: '27/30' },
          { type: 'Continuous Assessment', obtained: '92/100', weighted: '37/40' },
          { type: 'End Term', obtained: '62/70', weighted: '37/30' },
        ]},
        { subject: 'CSE603 : BLOCKCHAIN TECHNOLOGY', credit: 3, grade: 'A', gradePoint: 9, components: [
          { type: 'Mid Term', obtained: '25/30', weighted: '25/30' },
          { type: 'Continuous Assessment', obtained: '88/100', weighted: '35/40' },
          { type: 'End Term', obtained: '58/70', weighted: '35/30' },
        ]},
      ]
    },
    7: {
      termId: '128837',
      cgpa: 8.50,
      subjects: [
        { subject: 'CSE701 : MAJOR PROJECT', credit: 6, grade: 'A+', gradePoint: 9, components: [
          { type: 'Project Evaluation', obtained: '85/100', weighted: '85/100' },
          { type: 'Presentation', obtained: '42/50', weighted: '42/50' },
          { type: 'Viva Voce', obtained: '45/50', weighted: '45/50' },
        ]},
        { subject: 'CSE702 : INTERNSHIP', credit: 4, grade: 'O', gradePoint: 10, components: [
          { type: 'Company Feedback', obtained: '95/100', weighted: '47/50' },
          { type: 'Report', obtained: '45/50', weighted: '45/50' },
        ]},
      ]
    }
  };

  // TGPA trajectory data for professional chart
  const tgpaChartData = [
    { term: 'Term 1', yourTGPA: 7.85, highestTGPA: 9.45, classAvg: 7.20 },
    { term: 'Term 2', yourTGPA: 8.12, highestTGPA: 9.52, classAvg: 7.35 },
    { term: 'Term 3', yourTGPA: 8.35, highestTGPA: 9.48, classAvg: 7.42 },
    { term: 'Term 4', yourTGPA: 8.56, highestTGPA: 9.55, classAvg: 7.50 },
    { term: 'Term 5', yourTGPA: 8.72, highestTGPA: 9.60, classAvg: 7.58 },
    { term: 'Term 6', yourTGPA: 8.88, highestTGPA: 9.58, classAvg: 7.65 },
    { term: 'Term 7', yourTGPA: 8.50, highestTGPA: 9.50, classAvg: 7.55 },
  ];

  // Grades distribution data for professional chart
  const gradesChartData = [
    { grade: 'O', count: 3, fullForm: 'Outstanding' },
    { grade: 'A+', count: 8, fullForm: 'Excellent' },
    { grade: 'A', count: 10, fullForm: 'Very Good' },
    { grade: 'B+', count: 3, fullForm: 'Good' },
    { grade: 'B', count: 0, fullForm: 'Above Average' },
    { grade: 'C', count: 0, fullForm: 'Average' },
    { grade: 'D', count: 0, fullForm: 'Below Average' },
    { grade: 'F', count: 0, fullForm: 'Fail' },
  ];

  // Component performance data
  const componentPerformanceData = [
    { term: 'Term 1', attendance: 95, ca: 85, midTerm: 72, endTerm: 78, practical: 82 },
    { term: 'Term 2', attendance: 92, ca: 88, midTerm: 75, endTerm: 80, practical: 85 },
    { term: 'Term 3', attendance: 94, ca: 87, midTerm: 78, endTerm: 82, practical: 86 },
    { term: 'Term 4', attendance: 96, ca: 90, midTerm: 80, endTerm: 85, practical: 88 },
    { term: 'Term 5', attendance: 95, ca: 91, midTerm: 82, endTerm: 86, practical: 90 },
    { term: 'Term 6', attendance: 97, ca: 93, midTerm: 85, endTerm: 88, practical: 92 },
    { term: 'Term 7', attendance: 96, ca: 92, midTerm: 84, endTerm: 87, practical: 91 },
  ];

  // Attendance data for all 7 terms
  const attendanceChartData = [
    { term: 'Term 1', yourAttendance: 92, classAverage: 85, required: 75 },
    { term: 'Term 2', yourAttendance: 88, classAverage: 83, required: 75 },
    { term: 'Term 3', yourAttendance: 95, classAverage: 87, required: 75 },
    { term: 'Term 4', yourAttendance: 90, classAverage: 86, required: 75 },
    { term: 'Term 5', yourAttendance: 94, classAverage: 88, required: 75 },
    { term: 'Term 6', yourAttendance: 89, classAverage: 84, required: 75 },
    { term: 'Term 7', yourAttendance: 96, classAverage: 89, required: 75 },
  ];

  // Subject-wise attendance for current term
  const subjectAttendanceData = [
    { subject: 'Data Structures', total: 45, attended: 42, percentage: 93, color: '#3b82f6' },
    { subject: 'Algorithms', total: 40, attended: 38, percentage: 95, color: '#10b981' },
    { subject: 'DBMS', total: 38, attended: 34, percentage: 89, color: '#f59e0b' },
    { subject: 'Operating Systems', total: 42, attended: 39, percentage: 93, color: '#ef4444' },
    { subject: 'Computer Networks', total: 36, attended: 32, percentage: 89, color: '#8b5cf6' },
    { subject: 'Web Technologies', total: 35, attended: 34, percentage: 97, color: '#06b6d4' },
  ];

  useEffect(() => {
    fetchStudentData();
  }, []);

  // Auto-scroll for authorities 3D carousel
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setActiveAuthorityIndex((prev) => (prev + 1) % yourAuthorities.length);
    }, 1500); // Change card every 1.5 seconds

    return () => clearInterval(interval);
  }, [isPaused, yourAuthorities.length]);

  const fetchStudentData = async () => {
    console.log('📊 Fetching student data...');
    try {
      setStudentData({
        uid: '22912084',
        section: 'CSE-A',
        batch: '2025',
        program: 'B.Tech. (Computer Science & Engineering) (P132)',
        cgpa: 8.5,
        research: 5,
        publications: 12,
        iprFiled: 205,
        happening: 10,
        messages: 59,
        assignments: 25,
        events: 3,
        attendance: {
          today: 'Present',
          thisWeek: 92,
          thisMonth: 88,
          overall: 95,
        },
      });
      console.log('✅ Student data loaded successfully');
    } catch (error) {
      logger.error('Failed to fetch student data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) return user.firstName;
    return user?.username || 'Student';
  };

  const getCurrentDate = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();
    return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear().toString().slice(-2)}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isExamDate = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return examSchedule.find(exam => exam.date === dateStr);
  };

  // Render mini month for year view
  const renderMiniMonth = (monthIndex: number) => {
    const monthDate = new Date(2026, monthIndex, 1);
    const daysInMonth = getDaysInMonth(monthDate);
    const firstDay = getFirstDayOfMonth(monthDate);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = [];

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-4 h-4"></div>);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `2026-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const exam = examSchedule.find(exam => exam.date === dateStr);
      
      days.push(
        <div
          key={day}
          onClick={() => exam && setSelectedExam(exam)}
          className={`
            w-4 h-4 flex items-center justify-center text-[8px] rounded cursor-pointer transition-all
            ${exam 
              ? 'bg-purple-500 text-white font-bold hover:bg-purple-600 shadow-sm' 
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }
          `}
        >
          {day}
        </div>
      );
    }

    return (
      <div className="text-center">
        <div className="text-[9px] font-bold text-purple-600 dark:text-purple-400 mb-1">{monthNames[monthIndex]}</div>
        <div className="grid grid-cols-7 gap-0.5">{days}</div>
      </div>
    );
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];
    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    // Week day headers
    const headers = weekDays.map(day => (
      <div key={day} className="text-center text-base font-bold text-gray-600 dark:text-gray-400 py-2">
        {day}
      </div>
    ));

    // Empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const exam = isExamDate(day);
      const isToday = day === new Date().getDate() && currentMonth.getMonth() === new Date().getMonth();
      
      days.push(
        <div
          key={day}
          onClick={() => exam && setSelectedExam(exam)}
          className={`
            p-2 text-center text-lg font-semibold rounded-lg cursor-pointer transition-all
            ${exam 
              ? 'bg-blue-500 text-white font-bold hover:bg-blue-600 shadow-md transform hover:scale-110' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }
            ${isToday && !exam ? 'ring-2 ring-blue-400 font-bold' : ''}
          `}
        >
          {day}
        </div>
      );
    }

    return (
      <div>
        <div className="grid grid-cols-7 gap-2">{headers}</div>
        <div className="grid grid-cols-7 gap-2 mt-2">{days}</div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      {/* CGPA Modal with 3 Tabs */}
      {showCGPAModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setShowCGPAModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 relative">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-3xl font-bold text-white">📚 CGPA - Academic Performance</h3>
                  <p className="text-white/90 mt-1 text-base">Cumulative Grade Point Average: <span className="font-bold text-xl">{studentData?.cgpa}</span></p>
                </div>
                <button
                  onClick={() => setShowCGPAModal(false)}
                  className="text-white/90 hover:text-white transition-all p-2 hover:bg-white/20 rounded-full hover:rotate-90 duration-300 flex-shrink-0 ml-4"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button
                onClick={() => setCgpaActiveTab('statistical')}
                className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                  cgpaActiveTab === 'statistical'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                📊 Statistical Analysis
              </button>
              <button
                onClick={() => setCgpaActiveTab('marks')}
                className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                  cgpaActiveTab === 'marks'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                📝 Marks
              </button>
              <button
                onClick={() => setCgpaActiveTab('grades')}
                className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                  cgpaActiveTab === 'grades'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                🎯 Grades
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Statistical Analysis Tab */}
              {cgpaActiveTab === 'statistical' && (
                <div className="space-y-6">
                  {/* Grades Distribution Chart - Professional Recharts */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xl font-bold text-gray-800 dark:text-white">📊 Grades Distribution Analysis</h4>
                      <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-base font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        24 Total Subjects
                      </div>
                    </div>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={gradesChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="grade" 
                            tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 600 }}
                            axisLine={{ stroke: '#d1d5db' }}
                          />
                          <YAxis 
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            axisLine={{ stroke: '#d1d5db' }}
                            label={{ value: 'Number of Subjects', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1f2937', 
                              border: 'none', 
                              borderRadius: '8px',
                              color: '#fff'
                            }}
                            formatter={(value, name) => [value, 'Subjects']}
                            labelFormatter={(label) => {
                              const item = gradesChartData.find(d => d.grade === label);
                              return `Grade: ${label} (${item?.fullForm})`;
                            }}
                          />
                          <Bar 
                            dataKey="count" 
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={60}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      {gradesChartData.map((item) => (
                        <div key={item.grade} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                          <span className="font-bold text-gray-700 dark:text-gray-300">{item.grade}:</span>
                          <span className="text-gray-600 dark:text-gray-400">{item.count} ({item.fullForm})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* TGPA Performance Trajectory - Professional Recharts */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-gray-800 dark:text-white">📈 TGPA Performance Trajectory</h4>
                      <div className="flex gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Your TGPA</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span className="text-xs font-semibold text-red-600 dark:text-red-400">Highest</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Class Avg</span>
                        </div>
                      </div>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={tgpaChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="term" 
                            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
                            axisLine={{ stroke: '#d1d5db' }}
                          />
                          <YAxis 
                            domain={[6, 10]}
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                            axisLine={{ stroke: '#d1d5db' }}
                            tickCount={9}
                            label={{ value: 'TGPA', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1f2937', 
                              border: 'none', 
                              borderRadius: '8px',
                              color: '#fff',
                              fontSize: '12px'
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="yourTGPA" 
                            stroke="#3b82f6" 
                            strokeWidth={3}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
                            activeDot={{ r: 8, fill: '#3b82f6' }}
                            name="Your TGPA"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="highestTGPA" 
                            stroke="#ef4444" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                            name="Highest TGPA"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="classAvg" 
                            stroke="#9ca3af" 
                            strokeWidth={2}
                            dot={{ fill: '#9ca3af', strokeWidth: 2, r: 3 }}
                            name="Class Average"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Component-wise Performance - Professional Recharts */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xl font-bold text-gray-800 dark:text-white">🎯 Component-wise Performance Analysis</h4>
                      <div className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-base font-semibold text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                        Multi-metric View
                      </div>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={componentPerformanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="term" 
                            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
                            axisLine={{ stroke: '#d1d5db' }}
                          />
                          <YAxis 
                            domain={[0, 100]}
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                            axisLine={{ stroke: '#d1d5db' }}
                            label={{ value: 'Score (%)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1f2937', 
                              border: 'none', 
                              borderRadius: '8px',
                              color: '#fff',
                              fontSize: '12px'
                            }}
                            formatter={(value) => [`${value}%`]}
                          />
                          <Legend 
                            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                          />
                          <Area type="monotone" dataKey="attendance" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Attendance" />
                          <Area type="monotone" dataKey="ca" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Continuous Assessment" />
                          <Area type="monotone" dataKey="midTerm" stackId="3" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Mid-Term" />
                          <Area type="monotone" dataKey="endTerm" stackId="4" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="End-Term" />
                          <Area type="monotone" dataKey="practical" stackId="5" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} name="Practical" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Marks Tab */}
              {cgpaActiveTab === 'marks' && (
                <div className="space-y-6">
                  {/* Term Selector - Clickable */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {[1, 2, 3, 4, 5, 6, 7].map((term) => (
                      <button
                        key={term}
                        onClick={() => setSelectedMarksTerm(term)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                          selectedMarksTerm === term
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        Term {term}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                      Marks Distribution - Term {selectedMarksTerm} ({termWiseData[selectedMarksTerm as keyof typeof termWiseData]?.termId})
                    </h4>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      Term CGPA: {termWiseData[selectedMarksTerm as keyof typeof termWiseData]?.cgpa}
                    </span>
                  </div>

                  {/* Subject-wise Marks - Dynamic based on selected term */}
                  <div className="space-y-4">
                    {termWiseData[selectedMarksTerm as keyof typeof termWiseData]?.subjects.map((subject, idx) => (
                      <div key={idx} className="border-l-4 border-blue-500 pl-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-r-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold text-gray-900 dark:text-white">{subject.subject}</h5>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded">
                              Credit: {subject.credit}
                            </span>
                            <span className={`px-3 py-1 text-white text-xs font-bold rounded ${
                              subject.grade === 'O' ? 'bg-green-600' :
                              subject.grade === 'A+' ? 'bg-blue-600' :
                              subject.grade === 'A' ? 'bg-cyan-600' :
                              subject.grade === 'B+' ? 'bg-yellow-500' :
                              'bg-gray-500'
                            }`}>
                              Grade: {subject.grade}
                            </span>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                          {subject.components.map((comp, i) => (
                            <div key={i} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">{comp.type}</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                Obtained: <span className="text-blue-600 dark:text-blue-400">{comp.obtained}</span>
                              </p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                Weighted: <span className="text-green-600 dark:text-green-400">{comp.weighted}</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grades Tab */}
              {cgpaActiveTab === 'grades' && (
                <div className="space-y-6">
                  {/* Grade Summary Chart */}
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">Overall Grade Distribution</h4>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={gradesChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                          <YAxis dataKey="grade" type="category" tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 600 }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                            formatter={(value, name) => [value, 'Subjects']}
                          />
                          <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={25} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Term Selector - Clickable */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {[1, 2, 3, 4, 5, 6, 7].map((term) => (
                      <button
                        key={term}
                        onClick={() => setSelectedGradesTerm(term)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                          selectedGradesTerm === term
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        Term {term}: {termWiseData[term as keyof typeof termWiseData]?.termId}
                      </button>
                    ))}
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                      Grade Distribution - Term {selectedGradesTerm}
                    </h4>
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold mt-1">
                      Term CGPA: {termWiseData[selectedGradesTerm as keyof typeof termWiseData]?.cgpa}
                    </p>
                  </div>

                  {/* Subject List with Grades - Dynamic */}
                  <div className="space-y-3">
                    {termWiseData[selectedGradesTerm as keyof typeof termWiseData]?.subjects.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white">{item.subject}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Credit: {item.credit} | Grade Point: {item.gradePoint}
                          </p>
                        </div>
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-lg ${
                          item.grade === 'O' ? 'bg-gradient-to-br from-green-500 to-green-600' :
                          item.grade === 'A+' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                          item.grade === 'A' ? 'bg-gradient-to-br from-cyan-500 to-cyan-600' :
                          item.grade === 'B+' ? 'bg-gradient-to-br from-yellow-500 to-amber-600' :
                          'bg-gradient-to-br from-gray-400 to-gray-500'
                        }`}>
                          {item.grade}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl">
              <button
                onClick={() => setShowCGPAModal(false)}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Modal with 2 Tabs */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setShowAttendanceModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 relative">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-3xl font-bold text-white">📊 Attendance Analytics</h3>
                  <p className="text-white/90 mt-1 text-base">Overall Attendance: <span className="font-bold text-xl">{studentData?.attendance?.overall}%</span></p>
                </div>
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="text-white/90 hover:text-white transition-all p-2 hover:bg-white/20 rounded-full hover:rotate-90 duration-300 flex-shrink-0 ml-4"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button
                onClick={() => setAttendanceActiveTab('overview')}
                className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                  attendanceActiveTab === 'overview'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                📊 Term-wise Overview
              </button>
              <button
                onClick={() => setAttendanceActiveTab('comparison')}
                className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                  attendanceActiveTab === 'comparison'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                📈 Comparison Analysis
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Term-wise Overview Tab */}
              {attendanceActiveTab === 'overview' && (
                <div className="space-y-6">
                  {/* Term-wise Attendance Chart */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xl font-bold text-gray-800 dark:text-white">📊 Term-wise Attendance</h4>
                      <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-base font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        7 Terms
                      </div>
                    </div>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={attendanceChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="term" 
                            tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 600 }}
                            axisLine={{ stroke: '#d1d5db' }}
                          />
                          <YAxis 
                            domain={[0, 100]}
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            axisLine={{ stroke: '#d1d5db' }}
                            label={{ value: 'Attendance (%)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1f2937', 
                              border: 'none', 
                              borderRadius: '8px',
                              color: '#fff'
                            }}
                            formatter={(value) => [`${value}%`]}
                          />
                          <Bar 
                            dataKey="yourAttendance" 
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={50}
                            name="Your Attendance"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Subject-wise Attendance */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-4">📚 Current Term Subject-wise Attendance</h4>
                    <div className="space-y-3">
                      {subjectAttendanceData.map((subject, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-gray-900 dark:text-white">{subject.subject}</span>
                            <span className={`text-sm font-bold ${
                              subject.percentage >= 90 ? 'text-green-600 dark:text-green-400' :
                              subject.percentage >= 75 ? 'text-blue-600 dark:text-blue-400' :
                              'text-red-600 dark:text-red-400'
                            }`}>
                              {subject.percentage}%
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all duration-500"
                                style={{ 
                                  width: `${subject.percentage}%`,
                                  backgroundColor: subject.color
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {subject.attended}/{subject.total} Classes
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Statistics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Today', value: studentData?.attendance?.today, icon: '📅', color: 'from-green-500 to-emerald-600' },
                      { label: 'This Week', value: `${studentData?.attendance?.thisWeek}%`, icon: '📊', color: 'from-blue-500 to-cyan-600' },
                      { label: 'This Month', value: `${studentData?.attendance?.thisMonth}%`, icon: '📈', color: 'from-purple-500 to-pink-600' },
                    ].map((item) => (
                      <div key={item.label} className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                        <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${item.color} opacity-10 rounded-bl-full`}></div>
                        <div className="relative">
                          <div className="text-3xl mb-2">{item.icon}</div>
                          <div className="text-base font-semibold text-gray-600 dark:text-gray-400">{item.label}</div>
                          <div className={`text-3xl font-bold bg-gradient-to-r ${item.color} bg-clip-text text-transparent mt-1`}>{item.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comparison Analysis Tab */}
              {attendanceActiveTab === 'comparison' && (
                <div className="space-y-6">
                  {/* Comparison Line Chart */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-gray-800 dark:text-white">📈 Attendance Trend Analysis</h4>
                      <div className="flex gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Your Attendance</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800">
                          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                          <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">Class Average</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span className="text-xs font-semibold text-red-600 dark:text-red-400">Required (75%)</span>
                        </div>
                      </div>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={attendanceChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="term" 
                            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
                            axisLine={{ stroke: '#d1d5db' }}
                          />
                          <YAxis 
                            domain={[50, 100]}
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                            axisLine={{ stroke: '#d1d5db' }}
                            tickCount={11}
                            label={{ value: 'Attendance (%)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1f2937', 
                              border: 'none', 
                              borderRadius: '8px',
                              color: '#fff',
                              fontSize: '12px'
                            }}
                            formatter={(value) => [`${value}%`]}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="yourAttendance" 
                            stroke="#3b82f6" 
                            strokeWidth={3}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
                            activeDot={{ r: 8, fill: '#3b82f6' }}
                            name="Your Attendance"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="classAverage" 
                            stroke="#f97316" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
                            name="Class Average"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="required" 
                            stroke="#ef4444" 
                            strokeWidth={2}
                            strokeDasharray="8 4"
                            dot={false}
                            name="Required (75%)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Performance Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
                      <div className="text-4xl mb-3">🎯</div>
                      <h5 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Best Performance</h5>
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400">Term 7</div>
                      <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">96% Attendance</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                      <div className="text-4xl mb-3">📊</div>
                      <h5 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Overall Average</h5>
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">92.3%</div>
                      <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">Across 7 Terms</p>
                    </div>
                  </div>

                  {/* Trend Insights */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
                    <h5 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <span>💡</span> Key Insights
                    </h5>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold text-green-600 dark:text-green-400">Excellent progress!</span> Your attendance improved by 8% from Term 1 to Term 7
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold text-blue-600 dark:text-blue-400">Above average:</span> You're consistently performing 7-9% above class average
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold text-purple-600 dark:text-purple-400">Steady growth:</span> Maintaining above 88% attendance in all terms
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Happening Modal */}
      {activeModal === 'happening' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-orange-400 to-orange-500 p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-bold text-white">What&apos;s Happening</h3>
                  <p className="text-orange-100 mt-1">Latest updates and announcements</p>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {[
                { id: 1, title: 'Annual Day Celebration 2026', date: '15th February', category: 'Event', priority: 'high' },
                { id: 2, title: 'Mid-Semester Examinations', date: '5th-19th February', category: 'Academic', priority: 'high' },
                { id: 3, title: 'Guest Lecture on AI & ML', date: '10th February', category: 'Workshop', priority: 'medium' },
                { id: 4, title: 'Sports Week Registration Open', date: '20th-25th February', category: 'Sports', priority: 'medium' },
                { id: 5, title: 'Library Book Return Deadline', date: '8th February', category: 'Notice', priority: 'low' },
                { id: 6, title: 'Placement Drive - TCS', date: '12th February', category: 'Placement', priority: 'high' },
                { id: 7, title: 'Tech Fest 2026 Registrations', date: '1st-28th February', category: 'Event', priority: 'medium' },
                { id: 8, title: 'Scholarship Application Deadline', date: '18th February', category: 'Finance', priority: 'high' },
                { id: 9, title: 'Club Activity - Coding Competition', date: '14th February', category: 'Club', priority: 'low' },
                { id: 10, title: 'Career Counseling Session', date: '22nd February', category: 'Career', priority: 'medium' },
              ].map((item) => (
                <div key={item.id} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-l-4 border-orange-400">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    item.priority === 'high' ? 'bg-red-100 dark:bg-red-900/30' :
                    item.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                    'bg-blue-100 dark:bg-blue-900/30'
                  }`}>
                    <FileText className={`w-6 h-6 ${
                      item.priority === 'high' ? 'text-red-600' :
                      item.priority === 'medium' ? 'text-yellow-600' :
                      'text-blue-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{item.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        item.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {item.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {item.date}
                      </span>
                      <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-sm">
                        {item.category}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages Modal */}
      {activeModal === 'messages' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-orange-400 via-orange-500 to-yellow-500 p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-bold text-white">Messages</h3>
                  <p className="text-orange-100 mt-1">Your inbox and notifications</p>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-3">
              {[
                { id: 1, from: 'Dr. Rajesh Kumar', subject: 'Assignment Submission Reminder', message: 'Please submit your DSA assignment by 5th Feb', time: '2 hours ago', unread: true, avatar: 'RK' },
                { id: 2, from: 'Placement Cell', subject: 'TCS Placement Drive Registration', message: 'Register for TCS recruitment drive scheduled on 12th February', time: '5 hours ago', unread: true, avatar: 'PC' },
                { id: 3, from: 'Library Department', subject: 'Book Return Reminder', message: 'Your borrowed books are due for return by 8th February', time: '1 day ago', unread: true, avatar: 'LD' },
                { id: 4, from: 'Prof. Amit Sharma', subject: 'Mid-Sem Exam Schedule', message: 'Your DBMS exam is on 8th Feb at 10 AM in Room 105', time: '1 day ago', unread: false, avatar: 'AS' },
                { id: 5, from: 'Student Council', subject: 'Annual Day Participation', message: 'Join us for Annual Day celebrations. Register your performance', time: '2 days ago', unread: false, avatar: 'SC' },
                { id: 6, from: 'Sports Committee', subject: 'Sports Week Registration', message: 'Register for inter-college sports week. Multiple events available', time: '2 days ago', unread: false, avatar: 'SC' },
                { id: 7, from: 'Dr. Priya Singh', subject: 'Project Evaluation Date', message: 'Your project evaluation is scheduled for 20th February', time: '3 days ago', unread: false, avatar: 'PS' },
              ].map((msg) => (
                <div key={msg.id} className={`flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer border ${
                  msg.unread ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-yellow-500 rounded-full flex items-center justify-center text-white font-bold">
                    {msg.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-white truncate">{msg.from}</h4>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{msg.subject}</p>
                      </div>
                      <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">{msg.time}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{msg.message}</p>
                    {msg.unread && (
                      <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        Unread
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Assignments Modal */}
      {activeModal === 'assignments' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-bold text-white">Assignments</h3>
                  <p className="text-blue-100 mt-1">Pending and submitted assignments</p>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { id: 1, subject: 'Data Structures', title: 'Implement AVL Tree', dueDate: '5th Feb', status: 'pending', marks: 20, submitted: false },
                  { id: 2, subject: 'DBMS', title: 'Normalization Exercise', dueDate: '7th Feb', status: 'pending', marks: 15, submitted: false },
                  { id: 3, subject: 'Computer Networks', title: 'TCP/IP Protocol Analysis', dueDate: '10th Feb', status: 'pending', marks: 25, submitted: false },
                  { id: 4, subject: 'Operating Systems', title: 'Process Scheduling Algorithms', dueDate: '12th Feb', status: 'pending', marks: 20, submitted: false },
                  { id: 5, subject: 'Software Engineering', title: 'UML Diagrams for Library System', dueDate: '15th Feb', status: 'pending', marks: 30, submitted: false },
                  { id: 6, subject: 'Web Development', title: 'Responsive Portfolio Website', dueDate: '18th Feb', status: 'pending', marks: 40, submitted: false },
                  { id: 7, subject: 'Machine Learning', title: 'Linear Regression Implementation', dueDate: '20th Feb', status: 'pending', marks: 35, submitted: false },
                  { id: 8, subject: 'Cloud Computing', title: 'AWS Deployment Report', dueDate: '22nd Feb', status: 'pending', marks: 25, submitted: false },
                ].map((assignment) => (
                  <div key={assignment.id} className="p-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">{assignment.subject}</p>
                        <h4 className="font-bold text-gray-900 dark:text-white">{assignment.title}</h4>
                      </div>
                      <BookOpen className="w-8 h-8 text-blue-500" />
                    </div>
                    
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Due Date:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{assignment.dueDate}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Marks:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{assignment.marks}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button onClick={() => alert('Coming Soon: Assignment submission portal will be available soon!')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-base font-semibold transition-colors">
                        Submit
                      </button>
                      <button onClick={() => alert('Coming Soon: View assignment details feature will be available soon!')} className="px-3 py-2 border-2 border-blue-600 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Events Modal */}
      {activeModal === 'events' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-cyan-400 to-blue-500 p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-bold text-white">Upcoming Events</h3>
                  <p className="text-cyan-100 mt-1">Campus events and activities</p>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid gap-4">
                {[
                  { 
                    id: 1, 
                    title: 'Annual Tech Fest 2026', 
                    date: '15th February', 
                    time: '9:00 AM - 6:00 PM', 
                    venue: 'Main Auditorium', 
                    category: 'Technical',
                    description: 'Join us for the biggest tech event of the year featuring coding competitions, hackathons, and tech talks',
                    registrationLink: 'https://sgtuniversity.ac.in', // Placeholder - will be replaced
                    image: '🎯'
                  },
                  { 
                    id: 2, 
                    title: 'Sports Week 2026', 
                    date: '20th-25th February', 
                    time: 'All Day', 
                    venue: 'Sports Complex', 
                    category: 'Sports',
                    description: 'Inter-college sports competition including cricket, football, basketball, and athletics',
                    registrationLink: 'https://sgtuniversity.ac.in',
                    image: '⚽'
                  },
                  { 
                    id: 3, 
                    title: 'Cultural Night - Sangam 2026', 
                    date: '28th February', 
                    time: '6:00 PM - 10:00 PM', 
                    venue: 'Open Air Theatre', 
                    category: 'Cultural',
                    description: 'Celebrate diversity with music, dance, drama and fashion shows from across India',
                    registrationLink: 'https://sgtuniversity.ac.in',
                    image: '🎭'
                  },
                ].map((event) => (
                  <div key={event.id} className="p-6 bg-gradient-to-r from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-xl border-2 border-blue-300 dark:border-blue-700 hover:shadow-xl transition-all">
                    <div className="flex items-start gap-4">
                      <div className="text-6xl">{event.image}</div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="text-2xl font-bold text-gray-900 dark:text-white">{event.title}</h4>
                            <span className="inline-block mt-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-semibold">
                              {event.category}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{event.description}</p>
                        
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="text-xs text-gray-500">Date</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{event.date}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="text-xs text-gray-500">Time</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{event.time}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="text-xs text-gray-500">Venue</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{event.venue}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <a
                            href="https://sgt-event.vercel.app/student"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg font-semibold transition-colors text-center flex items-center justify-center gap-2"
                          >
                            Register Now <ExternalLink className="w-4 h-4" />
                          </a>
                          <a
                            href={event.registrationLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2.5 border-2 border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-semibold flex items-center gap-2"
                          >
                            View Details <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Timetable Modal */}
      {showFullTimetable && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6 rounded-t-2xl sticky top-0 z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-bold text-white">Complete Exam Timetable</h3>
                  <p className="text-purple-100 mt-1">Academic Year 2026 - All Exams</p>
                </div>
                <button
                  onClick={() => setShowFullTimetable(false)}
                  className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {examSchedule.map((exam) => (
                  <div key={exam.id} className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-700 dark:to-gray-700 rounded-xl p-4 border-2 border-purple-200 dark:border-purple-900 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white">{exam.subject}</h4>
                        <p className="text-base text-purple-600 dark:text-purple-400 font-semibold">{exam.subjectCode}</p>
                      </div>
                      <span className="px-3 py-1 bg-purple-600 text-white text-sm font-bold rounded-full">
                        {exam.examType}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-blue-600" />
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">Date</p>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">{exam.day}, {new Date(exam.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-600" />
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">Time</p>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">{exam.time}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-purple-600" />
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">Room</p>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">{exam.roomNo}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-600" />
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">Duration</p>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">{exam.duration}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-yellow-600" />
                      <p className="text-sm text-gray-600 dark:text-gray-300">Max Marks: <span className="font-bold">{exam.maxMarks}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-b-2xl border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowFullTimetable(false)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exam Details Modal */}
      {selectedExam && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-bold text-white">{selectedExam.subject}</h3>
                  <p className="text-blue-100 mt-1">{selectedExam.subjectCode}</p>
                </div>
                <button
                  onClick={() => setSelectedExam(null)}
                  className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <CalendarDays className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedExam.day}, {new Date(selectedExam.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <Clock className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Time</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedExam.time}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                  <MapPin className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Room</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedExam.roomNo}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                  <Building2 className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Building</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedExam.building}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-600" />
                  <span className="text-gray-600 dark:text-gray-300">Exam Type</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">{selectedExam.examType}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-red-600" />
                  <span className="text-gray-600 dark:text-gray-300">Maximum Marks</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">{selectedExam.maxMarks}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-600 dark:text-gray-300">Duration</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">{selectedExam.duration}</span>
              </div>
              
              <div className="mt-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  Instructions
                </h4>
                <ul className="space-y-2">
                  {selectedExam.instructions.map((instruction, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {instruction}
                    </li>
                  ))}
                </ul>
              </div>
              
              <button
                onClick={() => setSelectedExam(null)}
                className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Placement Drive JD Modal */}
      {selectedPlacementDrive && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className={`bg-gradient-to-r ${
              selectedPlacementDrive.colorScheme === 'blue' ? 'from-blue-500 to-indigo-600' :
              selectedPlacementDrive.colorScheme === 'purple' ? 'from-purple-500 to-pink-600' :
              selectedPlacementDrive.colorScheme === 'teal' ? 'from-teal-500 to-cyan-600' :
              'from-amber-500 to-orange-600'
            } p-6 rounded-t-2xl`}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-lg">
                    <span className={`text-xl font-bold ${
                      selectedPlacementDrive.colorScheme === 'blue' ? 'text-blue-600' :
                      selectedPlacementDrive.colorScheme === 'purple' ? 'text-purple-600' :
                      selectedPlacementDrive.colorScheme === 'teal' ? 'text-teal-600' :
                      'text-amber-600'
                    }`}>{selectedPlacementDrive.shortName}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{selectedPlacementDrive.company}</h3>
                    <p className="text-white/80 mt-1">{selectedPlacementDrive.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlacementDrive(null)}
                  className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Quick Info */}
              <div className="flex flex-wrap gap-3 mt-4">
                <span className="px-3 py-1 bg-white/20 text-white rounded-full text-sm flex items-center gap-1">
                  <DollarSign className="w-4 h-4" /> {selectedPlacementDrive.package}
                </span>
                <span className="px-3 py-1 bg-white/20 text-white rounded-full text-sm flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {selectedPlacementDrive.venue}
                </span>
                <span className="px-3 py-1 bg-white/20 text-white rounded-full text-sm flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {selectedPlacementDrive.timing}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  selectedPlacementDrive.status === 'ongoing' ? 'bg-green-500 text-white' :
                  selectedPlacementDrive.status === 'completed' ? 'bg-gray-500 text-white' :
                  'bg-orange-500 text-white'
                }`}>
                  {selectedPlacementDrive.statusText}
                </span>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-6">
              {/* About Company */}
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  About {selectedPlacementDrive.company}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {selectedPlacementDrive.jobDescription.aboutCompany}
                </p>
              </div>
              
              {/* Role Description */}
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-purple-600" />
                  Role Description
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {selectedPlacementDrive.jobDescription.roleDescription}
                </p>
              </div>
              
              {/* Eligibility */}
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <h4 className="font-bold text-green-700 dark:text-green-400 mb-1 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  Eligibility
                </h4>
                <p className="text-sm text-green-600 dark:text-green-300">{selectedPlacementDrive.eligibility}</p>
              </div>
              
              {/* Responsibilities */}
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-orange-600" />
                  Key Responsibilities
                </h4>
                <ul className="space-y-2">
                  {selectedPlacementDrive.jobDescription.responsibilities.map((resp, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {resp}
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Requirements */}
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-red-600" />
                  Requirements
                </h4>
                <ul className="space-y-2">
                  {selectedPlacementDrive.jobDescription.requirements.map((req, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Skills */}
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-600" />
                  Required Skills
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedPlacementDrive.jobDescription.skills.map((skill, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Selection Process */}
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-indigo-600" />
                  Selection Process
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedPlacementDrive.jobDescription.selectionProcess.map((step, index) => (
                    <React.Fragment key={index}>
                      <span className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium">
                        {index + 1}. {step}
                      </span>
                      {index < selectedPlacementDrive.jobDescription.selectionProcess.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              
              {/* Perks */}
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-pink-600" />
                  Perks & Benefits
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedPlacementDrive.jobDescription.perks.map((perk, index) => (
                    <span key={index} className="px-3 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full text-sm font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {perk}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setSelectedPlacementDrive(null)}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold transition-colors"
                >
                  Close
                </button>
                <button
                  className={`flex-1 bg-gradient-to-r ${
                    selectedPlacementDrive.colorScheme === 'blue' ? 'from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700' :
                    selectedPlacementDrive.colorScheme === 'purple' ? 'from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700' :
                    selectedPlacementDrive.colorScheme === 'teal' ? 'from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700' :
                    'from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                  } text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2`}
                >
                  Apply Now <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Placement Drives Modal */}
      {showAllPlacementDrives && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Briefcase className="w-6 h-6" />
                    All Placement Drives
                  </h3>
                  <p className="text-purple-100 mt-1">Campus Recruitment 2026</p>
                </div>
                <button
                  onClick={() => setShowAllPlacementDrives(false)}
                  className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid md:grid-cols-2 gap-4">
                {placementDrives.map((drive) => (
                  <div
                    key={drive.id}
                    onClick={() => {
                      setShowAllPlacementDrives(false);
                      setSelectedPlacementDrive(drive);
                    }}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 ${
                      drive.colorScheme === 'blue' ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-800' :
                      drive.colorScheme === 'purple' ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 dark:border-purple-800' :
                      drive.colorScheme === 'teal' ? 'border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 dark:border-teal-800' :
                      'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-white dark:bg-gray-700 rounded-xl flex items-center justify-center shadow-sm border border-gray-100 dark:border-gray-600">
                        <span className={`text-lg font-bold ${
                          drive.colorScheme === 'blue' ? 'text-blue-600' :
                          drive.colorScheme === 'purple' ? 'text-purple-600' :
                          drive.colorScheme === 'teal' ? 'text-teal-600' :
                          'text-amber-600'
                        }`}>{drive.shortName}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-gray-900 dark:text-white">{drive.company}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{drive.role}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            drive.status === 'ongoing' ? 'bg-green-500 text-white' :
                            drive.status === 'completed' ? 'bg-gray-400 text-white' :
                            'bg-orange-500 text-white'
                          }`}>
                            {drive.statusText}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                          <span className="text-sm text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                            <DollarSign className="w-4 h-4" /> {drive.package}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Clock className="w-4 h-4" /> {drive.timing}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Eligibility: {drive.eligibility}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Info Footer */}
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">
                    <span className="font-semibold text-purple-600">{placementDrives.length}</span> drives scheduled • 
                    <span className="font-semibold text-green-600 ml-1">150+</span> positions available
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    Venue: Block D, Auditorium
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6" style={{ fontSize: '1.15em' }}>
        {/* Welcome Section */}
        <FadeInUp delay={0.1}>
          <div data-tour-id="welcome-section" className="bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 rounded-2xl shadow-lg border border-blue-100 dark:border-gray-700 p-8 backdrop-blur-sm">
            {/* Main Grid: Left Content + Right Slideshow */}
            <div className="grid lg:grid-cols-12 gap-6">
              {/* Left Side: Profile + Cards */}
              <div className="lg:col-span-7 space-y-6">
                {/* Profile Section */}
                <div className="flex items-start gap-6">
                  {/* Profile Picture */}
                  <div data-tour-id="profile-picture" className="relative flex-shrink-0 group">
                    <div className="relative">
                      {/* Animated Ring */}
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-75 group-hover:opacity-100 blur-md group-hover:blur-lg transition-all duration-300 animate-pulse"></div>
                      
                      {/* Profile Image Container */}
                      <div className="relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-white dark:ring-gray-800 shadow-xl">
                        <img 
                          src="/student-profile.jpeg"
                          alt={getUserName()}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">${getUserName().split(' ').map((n: string) => n[0]).join('').toUpperCase()}</div>`;
                            }
                          }}
                        />
                      </div>
                      
                      {/* Online Status Badge */}
                      <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-white dark:border-gray-800 shadow-lg">
                        <div className="w-full h-full rounded-full bg-green-400 animate-ping opacity-75"></div>
                      </div>
                    </div>
                    
                    {/* Verified Badge */}
                    <div className="absolute -top-1 -right-1 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  {/* Greeting and Info */}
                  <div className="flex-1">
                    <p className="text-base text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {getCurrentDate()}
                    </p>
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-1 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                      {getGreeting()},
                    </h1>
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
                      {getUserName()}
                    </h2>
                    
                    <div className="space-y-1 text-base">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 w-fit">
                        <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span><span className="font-semibold">Registration Number: </span> {studentData?.uid} | <span className="font-semibold">Section:</span> {studentData?.section} | <span className="font-semibold">Batch:</span> {studentData?.batch}</span>
                      </div>
                      <div className="text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 w-fit">
                        {studentData?.program}
                      </div>
                    </div>

                    <p className="mt-3 text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                      Welcome to your Student dashboard. Track your progress, manage your work, and stay connected.
                    </p>
                  </div>
                </div>

                {/* 5 Stats Cards in a row - With Internal Animations */}
                <div className="grid grid-cols-5 gap-3">
                  {/* Happening Card - Warm Coral Theme */}
                  <div 
                    data-tour-id="happening-card"
                    onClick={() => setActiveModal('happening')}
                    className="relative overflow-hidden rounded-xl p-3 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer group"
                    style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #dc2626 100%)' }}
                  >
                    {/* Animated Background Elements */}
                    <div className="absolute inset-0 overflow-hidden">
                      {/* Floating circles */}
                      <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full" style={{ animationDuration: '3s' }}></div>
                      <div className="absolute bottom-2 -left-3 w-10 h-10 bg-white/10 rounded-full" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>
                      {/* Moving wave */}
                      <div className="absolute bottom-0 left-0 right-0 h-8 opacity-20">
                        <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                          <path d="M0,10 Q25,0 50,10 T100,10 V20 H0 Z" fill="white" style={{ animationDuration: '2s' }}/>
                        </svg>
                      </div>
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </div>
                    {/* Content */}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-1">
                        <FileText className="w-5 h-5 drop-shadow-sm" />
                        <div className="w-2 h-2 bg-white/60 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
                      </div>
                      <p className="text-4xl font-bold drop-shadow-sm">{studentData?.happening}</p>
                      <p className="text-sm font-medium opacity-90">Happening Now</p>
                    </div>
                  </div>

                  {/* Messages Card - Royal Purple Theme */}
                  <div 
                    data-tour-id="messages-card"
                    onClick={() => setActiveModal('messages')}
                    className="relative overflow-hidden rounded-xl p-3 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer group"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)' }}
                  >
                    {/* Animated Background Elements */}
                    <div className="absolute inset-0 overflow-hidden">
                      {/* Message bubbles floating */}
                      <div className="absolute top-3 right-2 w-3 h-3 bg-white/15 rounded-full" style={{ animation: 'bounce 2s infinite' }}></div>
                      <div className="absolute top-6 right-5 w-2 h-2 bg-white/10 rounded-full" style={{ animation: 'bounce 2.5s infinite', animationDelay: '0.5s' }}></div>
                      <div className="absolute bottom-4 left-2 w-4 h-4 bg-white/10 rounded-full" style={{ animation: 'bounce 3s infinite', animationDelay: '1s' }}></div>
                      {/* Gradient orb */}
                      <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-gradient-to-br from-pink-400/20 to-transparent rounded-full" style={{ animationDuration: '4s' }}></div>
                      {/* Shimmer */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </div>
                    {/* Content */}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-1">
                        <MessageSquare className="w-5 h-5 drop-shadow-sm" />
                        <span className="text-[8px] bg-white/25 px-1.5 py-0.5 rounded-full font-semibold">New</span>
                      </div>
                      <p className="text-4xl font-bold drop-shadow-sm">{studentData?.messages}</p>
                      <p className="text-sm font-medium opacity-90">Messages</p>
                    </div>
                  </div>

                  {/* Assignments Card - Ocean Blue Theme */}
                  <div 
                    data-tour-id="assignments-card"
                    onClick={() => setActiveModal('assignments')}
                    className="relative overflow-hidden rounded-xl p-3 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer group"
                    style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #0369a1 100%)' }}
                  >
                    {/* Animated Background Elements */}
                    <div className="absolute inset-0 overflow-hidden">
                      {/* Rotating ring */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white/10 rounded-full" style={{ animation: 'spin 8s linear infinite' }}></div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-white/5 rounded-full" style={{ animation: 'spin 6s linear infinite reverse' }}></div>
                      {/* Corner accent */}
                      <div className="absolute -top-2 -right-2 w-12 h-12 bg-gradient-to-br from-cyan-300/20 to-transparent rounded-full"></div>
                      {/* Shimmer */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </div>
                    {/* Content */}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-1">
                        <BookOpen className="w-5 h-5 drop-shadow-sm" />
                        <div className="flex gap-0.5">
                          <div className="w-1.5 h-3 bg-white/40 rounded-full"></div>
                          <div className="w-1.5 h-2 bg-white/30 rounded-full mt-1"></div>
                          <div className="w-1.5 h-2.5 bg-white/35 rounded-full mt-0.5"></div>
                        </div>
                      </div>
                      <p className="text-4xl font-bold drop-shadow-sm">{studentData?.assignments}</p>
                      <p className="text-sm font-medium opacity-90">Assignments</p>
                    </div>
                  </div>

                  {/* Events Card - Teal Emerald Theme */}
                  <div 
                    data-tour-id="events-card"
                    onClick={() => setActiveModal('events')}
                    className="relative overflow-hidden rounded-xl p-3 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer group"
                    style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)' }}
                  >
                    {/* Animated Background Elements */}
                    <div className="absolute inset-0 overflow-hidden">
                      {/* Calendar grid pattern */}
                      <div className="absolute top-2 right-2 grid grid-cols-3 gap-0.5 opacity-15">
                        {[...Array(9)].map((_, i) => (
                          <div key={i} className="w-1.5 h-1.5 bg-white rounded-sm" style={{ animation: 'pulse 2s infinite', animationDelay: `${i * 0.2}s` }}></div>
                        ))}
                      </div>
                      {/* Glowing orb */}
                      <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-tr from-emerald-300/20 to-transparent rounded-full" style={{ animationDuration: '3s' }}></div>
                      {/* Shimmer */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </div>
                    {/* Content */}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-1">
                        <Calendar className="w-5 h-5 drop-shadow-sm" />
                        <div className="w-5 h-5 rounded-full border-2 border-white/30 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-ping" style={{ animationDuration: '1.5s' }}></div>
                        </div>
                      </div>
                      <p className="text-4xl font-bold drop-shadow-sm">{studentData?.events}</p>
                      <p className="text-sm font-medium opacity-90">Upcoming Events</p>
                    </div>
                  </div>

                  {/* Fees Card - Forest Green Theme */}
                  <div 
                    data-tour-id="fees-card"
                    className="relative overflow-hidden rounded-xl p-3 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer group"
                    style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)' }}
                  >
                    {/* Animated Background Elements */}
                    <div className="absolute inset-0 overflow-hidden">
                      {/* Coin-like circles */}
                      <div className="absolute top-2 right-3 w-4 h-4 border-2 border-white/20 rounded-full" style={{ animation: 'pulse 2s infinite' }}></div>
                      <div className="absolute bottom-3 right-2 w-3 h-3 border-2 border-white/15 rounded-full" style={{ animation: 'pulse 2.5s infinite', animationDelay: '0.5s' }}></div>
                      <div className="absolute top-8 left-2 w-2 h-2 bg-white/15 rounded-full" style={{ animation: 'pulse 3s infinite', animationDelay: '1s' }}></div>
                      {/* Checkmark sparkle */}
                      <div className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br from-lime-300/20 to-transparent rounded-full"></div>
                      {/* Shimmer */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </div>
                    {/* Content */}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-1">
                        <svg className="w-5 h-5 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex items-center gap-0.5">
                          <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-4xl font-bold drop-shadow-sm">₹0</p>
                      <p className="text-sm font-medium opacity-90">Fees Cleared</p>
                    </div>
                  </div>
                </div>

                {/* CGPA and Attendance Cards - Side by Side - SGT Theme */}
                <div className="grid grid-cols-2 gap-3">
                  {/* CGPA Card - Academic Blue Theme */}
                  <div 
                    data-tour-id="cgpa-card"
                    onClick={() => setShowCGPAModal(true)}
                    className="relative overflow-hidden rounded-xl p-4 bg-white dark:bg-gray-800 shadow-lg cursor-pointer transition-all duration-500 group border border-gray-200 dark:border-gray-700"
                    style={{
                      transition: 'all 0.5s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '';
                      e.currentTarget.style.color = '';
                      e.currentTarget.className = 'relative overflow-hidden rounded-xl p-4 bg-white dark:bg-gray-800 shadow-lg cursor-pointer transition-all duration-500 group border border-gray-200 dark:border-gray-700';
                    }}
                  >
                    {/* Animated Background Elements */}
                    <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                      {/* Floating academic elements */}
                      <div className="absolute top-3 right-3 w-16 h-16 border border-white/10 rounded-full" style={{ animation: 'spin 10s linear infinite' }}></div>
                      <div className="absolute top-5 right-5 w-12 h-12 border border-white/5 rounded-full" style={{ animation: 'spin 8s linear infinite reverse' }}></div>
                      {/* Book pages effect */}
                      <div className="absolute bottom-2 left-3 w-4 h-6 bg-white/5 rounded-sm" style={{ animation: 'pulse 2s infinite' }}></div>
                      <div className="absolute bottom-2 left-8 w-4 h-6 bg-white/5 rounded-sm" style={{ animation: 'pulse 2.5s infinite', animationDelay: '0.5s' }}></div>
                      <div className="absolute bottom-2 left-13 w-4 h-6 bg-white/5 rounded-sm" style={{ animation: 'pulse 3s infinite', animationDelay: '1s' }}></div>
                      {/* Star sparkles */}
                      <div className="absolute -top-2 -right-2 w-12 h-12 bg-gradient-to-br from-blue-300/15 to-transparent rounded-full"></div>
                      {/* Shimmer */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </div>
                    {/* Content */}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-[11px] font-medium mb-1 text-gray-600 dark:text-gray-400 group-hover:text-white/90">Academic Performance</p>
                          <p className="text-3xl font-bold drop-shadow-sm text-gray-900 dark:text-white group-hover:text-white">{studentData?.cgpa}</p>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-0 bg-blue-500/10 group-hover:bg-white/10 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
                          <GraduationCap className="w-10 h-10 drop-shadow-sm relative text-blue-600 group-hover:text-white" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-gray-100 dark:bg-gray-700 group-hover:bg-white/15 backdrop-blur-sm rounded-lg p-2 border border-gray-200 dark:border-gray-600 group-hover:border-white/10 transition-all duration-500">
                          <p className="text-[9px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-white/90">Current Sem</p>
                          <p className="text-base font-bold drop-shadow-sm text-gray-900 dark:text-white group-hover:text-white">7.85</p>
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-700 group-hover:bg-white/15 backdrop-blur-sm rounded-lg p-2 border border-gray-200 dark:border-gray-600 group-hover:border-white/10 transition-all duration-500">
                          <p className="text-[9px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-white/90">Credits</p>
                          <p className="text-base font-bold drop-shadow-sm text-gray-900 dark:text-white group-hover:text-white">120</p>
                        </div>
                      </div>
                      <p className="text-[10px] font-medium flex items-center gap-1 text-gray-500 dark:text-gray-400 group-hover:text-white/80">
                        <ExternalLink className="w-3 h-3" />
                        Click for details
                      </p>
                    </div>
                  </div>

                  {/* Attendance Card - Professional Teal Theme */}
                  <div 
                    data-tour-id="attendance-card"
                    onClick={() => setShowAttendanceModal(true)}
                    className="relative overflow-hidden rounded-xl p-4 bg-white dark:bg-gray-800 shadow-lg cursor-pointer transition-all duration-500 group border border-gray-200 dark:border-gray-700"
                    style={{
                      transition: 'all 0.5s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #0891b2 0%, #0e7490 50%, #155e75 100%)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '';
                      e.currentTarget.style.color = '';
                      e.currentTarget.className = 'relative overflow-hidden rounded-xl p-4 bg-white dark:bg-gray-800 shadow-lg cursor-pointer transition-all duration-500 group border border-gray-200 dark:border-gray-700';
                    }}
                  >
                    {/* Animated Background Elements */}
                    <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                      {/* Calendar grid animation */}
                      <div className="absolute top-3 right-3 grid grid-cols-4 gap-1 opacity-10">
                        {[...Array(12)].map((_, i) => (
                          <div key={i} className="w-2 h-2 bg-white rounded-sm" style={{ animation: 'pulse 2s infinite', animationDelay: `${i * 0.15}s` }}></div>
                        ))}
                      </div>
                      {/* Check marks floating */}
                      <div className="absolute bottom-3 left-3 text-white/10 text-xl font-bold" style={{ animation: 'bounce 3s infinite' }}>✓</div>
                      <div className="absolute bottom-8 left-8 text-white/10 text-sm font-bold" style={{ animation: 'bounce 2.5s infinite', animationDelay: '0.5s' }}>✓</div>
                      {/* Progress arc */}
                      <div className="absolute -bottom-6 -right-6 w-24 h-24 border-4 border-white/10 rounded-full"></div>
                      <div className="absolute -bottom-6 -right-6 w-24 h-24 border-4 border-white/20 rounded-full" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 95%, 0 95%)' }}></div>
                      {/* Shimmer */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </div>
                    {/* Content */}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-[11px] font-medium mb-1 text-gray-600 dark:text-gray-400 group-hover:text-white/90">Attendance Tracker</p>
                          <p className="text-3xl font-bold drop-shadow-sm text-gray-900 dark:text-white group-hover:text-white">{studentData?.attendance.overall}%</p>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-0 bg-teal-500/10 group-hover:bg-white/10 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
                          <Calendar className="w-10 h-10 drop-shadow-sm relative text-teal-600 group-hover:text-white" />
                        </div>
                      </div>
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 group-hover:bg-white/10 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-gray-200 dark:border-gray-600 group-hover:border-white/10 transition-all duration-500">
                          <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-white/90">Today</p>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                            studentData?.attendance.today === 'Present' ? 'bg-gray-200 dark:bg-gray-600 group-hover:bg-white/30 text-gray-700 dark:text-gray-200 group-hover:text-white' : 'bg-red-100 dark:bg-red-900 group-hover:bg-red-400/50 text-red-700 dark:text-red-200 group-hover:text-white'
                          }`}>
                            {studentData?.attendance.today}
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 group-hover:bg-white/10 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-gray-200 dark:border-gray-600 group-hover:border-white/10 transition-all duration-500">
                          <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-white/90">Week</p>
                          <p className="text-sm font-bold drop-shadow-sm text-gray-900 dark:text-white group-hover:text-white">{studentData?.attendance.thisWeek}%</p>
                        </div>
                        <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 group-hover:bg-white/10 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-gray-200 dark:border-gray-600 group-hover:border-white/10 transition-all duration-500">
                          <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-white/90">Month</p>
                          <p className="text-sm font-bold drop-shadow-sm text-gray-900 dark:text-white group-hover:text-white">{studentData?.attendance.thisMonth}%</p>
                        </div>
                      </div>
                      <p className="text-[10px] font-medium flex items-center gap-1 text-gray-500 dark:text-gray-400 group-hover:text-white/80">
                        <ExternalLink className="w-3 h-3" />
                        Click for analytics
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Glass Calendar UI - Modern Design */}
              <div data-tour-id="academic-calendar" className="lg:col-span-5 flex flex-col p-4" style={{ perspective: '1000px' }}>
                {/* Calendar Heading - Centered */}
                <div className="mb-4 text-center">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
                    <Calendar className="w-6 h-6 text-blue-600" />
                    Academic Activities Calendar
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Stay updated with university events & schedules</p>
                </div>
                <div className="relative w-full max-w-lg mx-auto flex-1" style={{ height: '540px' }}>
                  {/* Large animated gradient blobs - SGT theme colors with enhanced floating animations */}
                  <div 
                    className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full opacity-30" 
                    style={{ 
                      animation: 'floatDiagonal 10s ease-in-out infinite, pulseGlow 6s ease-in-out infinite',
                      animationDelay: '0s',
                      filter: 'blur(50px)'
                    }}
                  ></div>
                  <div 
                    className="absolute bottom-0 left-0 w-56 h-56 bg-gradient-to-tr from-cyan-400 via-blue-400 to-purple-400 rounded-full opacity-30" 
                    style={{ 
                      animation: 'floatCircular 12s ease-in-out infinite, pulseGlow 7s ease-in-out infinite',
                      animationDelay: '1s',
                      filter: 'blur(45px)'
                    }}
                  ></div>
                  <div 
                    className="absolute top-1/3 left-1/4 w-48 h-48 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full opacity-20" 
                    style={{ 
                      animation: 'floatWave 14s ease-in-out infinite, rotate 25s linear infinite, pulseGlow 8s ease-in-out infinite',
                      animationDelay: '2s',
                      filter: 'blur(40px)'
                    }}
                  ></div>
                  <div 
                    className="absolute top-10 left-10 w-40 h-40 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full opacity-25" 
                    style={{ 
                      animation: 'bounce 11s ease-in-out infinite, scale 8s ease-in-out infinite',
                      animationDelay: '0.5s',
                      filter: 'blur(42px)'
                    }}
                  ></div>
                  <div 
                    className="absolute bottom-20 right-20 w-52 h-52 bg-gradient-to-tr from-indigo-400 via-purple-500 to-pink-400 rounded-full opacity-25" 
                    style={{ 
                      animation: 'floatCircular 13s ease-in-out infinite reverse, rotate 30s linear infinite reverse',
                      animationDelay: '1.5s',
                      filter: 'blur(48px)'
                    }}
                  ></div>
                  <div 
                    className="absolute top-1/2 right-10 w-44 h-44 bg-gradient-to-br from-blue-400 via-cyan-400 to-teal-400 rounded-full opacity-20" 
                    style={{ 
                      animation: 'floatDiagonal 15s ease-in-out infinite reverse, pulseGlow 9s ease-in-out infinite',
                      animationDelay: '3s',
                      filter: 'blur(45px)'
                    }}
                  ></div>
                  <div 
                    className="absolute bottom-1/3 left-1/3 w-36 h-36 bg-gradient-to-tr from-violet-400 to-purple-500 rounded-full opacity-22" 
                    style={{ 
                      animation: 'floatWave 16s ease-in-out infinite reverse, scale 10s ease-in-out infinite',
                      animationDelay: '2.5s',
                      filter: 'blur(38px)'
                    }}
                  ></div>
                  
                  {/* Main Glass Calendar Card */}
                  <div 
                    className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                    style={{
                      border: '2px solid rgba(15, 37, 115, 0.5)',
                      animation: 'borderGlow 3s ease-in-out infinite'
                    }}
                  >
                    {/* Header with month navigation */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-white/50 to-blue-50/50 dark:from-gray-800/50 dark:to-blue-900/20">
                      <button
                        onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
                        className="p-2 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-200 hover:scale-110"
                      >
                        <ChevronLeft className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </button>
                      <div className="text-center flex-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </h3>
                      </div>
                      <button
                        onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
                        className="p-2 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-200 hover:scale-110"
                      >
                        <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </button>
                    </div>

                    {/* Calendar Content - No Scrolling */}
                    <div className="flex-1 px-5 py-4 flex flex-col">
                      {/* Day Headers */}
                      <div className="grid grid-cols-7 gap-1.5 mb-2">
                        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, idx) => (
                          <div key={idx} className="text-center">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{day}</span>
                          </div>
                        ))}
                      </div>

                      {/* Calendar Days Grid */}
                      <div className="grid grid-cols-7 gap-1.5 flex-1">
                        {(() => {
                          const year = selectedMonth.getFullYear();
                          const month = selectedMonth.getMonth();
                          const firstDay = new Date(year, month, 1).getDay();
                          const daysInMonth = new Date(year, month + 1, 0).getDate();
                          const prevMonthDays = new Date(year, month, 0).getDate();
                          const days = [];

                          // Previous month's trailing days
                          for (let i = firstDay - 1; i >= 0; i--) {
                            const day = prevMonthDays - i;
                            days.push(
                              <div key={`prev-${day}`} className="aspect-square flex items-center justify-center">
                                <span className="text-xs text-gray-300 dark:text-gray-600">{day}</span>
                              </div>
                            );
                          }

                          // Current month days
                          for (let day = 1; day <= daysInMonth; day++) {
                            const currentDate = new Date(year, month, day);
                            // Use local date formatting to avoid timezone issues
                            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const dayEvents = academicCalendarEvents.filter(e => e.date === dateString);
                            const filteredEvents = calendarFilter === 'all' 
                              ? dayEvents 
                              : dayEvents.filter(e => e.type === calendarFilter);

                            const hasEvents = filteredEvents.length > 0;
                            const eventType = hasEvents ? filteredEvents[0].type : null;
                            
                            let bgColor = '';
                            let bgGradient = '';
                            let ringColor = '';
                            
                            if (eventType === 'holiday') {
                              bgGradient = 'from-red-400 to-pink-500';
                              ringColor = 'ring-red-400/50';
                            } else if (eventType === 'exam') {
                              bgGradient = 'from-orange-400 to-amber-500';
                              ringColor = 'ring-orange-400/50';
                            } else if (eventType === 'event') {
                              bgGradient = 'from-purple-400 to-violet-500';
                              ringColor = 'ring-purple-400/50';
                            } else if (eventType === 'crucial') {
                              bgGradient = 'from-blue-400 to-cyan-500';
                              ringColor = 'ring-blue-400/50';
                            }

                            days.push(
                              <button
                                key={day}
                                onClick={() => hasEvents ? setSelectedDate(currentDate) : null}
                                className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 mx-auto ${
                                  hasEvents
                                    ? `bg-gradient-to-br ${bgGradient} text-white shadow-lg hover:shadow-xl hover:scale-110 cursor-pointer ring-2 ${ringColor}`
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 hover:scale-105'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          }

                          // Next month's leading days
                          const totalCells = days.length;
                          const remainingCells = 35 - totalCells;
                          for (let day = 1; day <= remainingCells; day++) {
                            days.push(
                              <div key={`next-${day}`} className="aspect-square flex items-center justify-center">
                                <span className="text-xs text-gray-300 dark:text-gray-600">{day}</span>
                              </div>
                            );
                          }

                          return days;
                        })()}
                      </div>

                      {/* Filter Pills */}
                      <div className="flex gap-2 mt-3 flex-wrap justify-center">
                        {[
                          { key: 'all', label: 'All', color: 'from-gray-500 to-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-700', textColor: 'text-gray-700 dark:text-gray-300' },
                          { key: 'holiday', label: 'Holidays', color: 'from-red-400 to-pink-500', bgColor: 'bg-red-50 dark:bg-red-900/30', textColor: 'text-red-600 dark:text-red-400' },
                          { key: 'exam', label: 'Exams', color: 'from-orange-400 to-amber-500', bgColor: 'bg-orange-50 dark:bg-orange-900/30', textColor: 'text-orange-600 dark:text-orange-400' },
                          { key: 'event', label: 'Events', color: 'from-purple-400 to-violet-500', bgColor: 'bg-purple-50 dark:bg-purple-900/30', textColor: 'text-purple-600 dark:text-purple-400' },
                          { key: 'crucial', label: 'Important', color: 'from-blue-400 to-cyan-500', bgColor: 'bg-blue-50 dark:bg-blue-900/30', textColor: 'text-blue-600 dark:text-blue-400' }
                        ].map((filter) => (
                          <button
                            key={filter.key}
                            onClick={() => setCalendarFilter(filter.key as any)}
                            className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 ${
                              calendarFilter === filter.key
                                ? `bg-gradient-to-r ${filter.color} text-white shadow-lg scale-105 ring-2 ring-white/50`
                                : `${filter.bgColor} ${filter.textColor} hover:scale-105 border border-current/20`
                            }`}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>

                      {/* View Timetable Button */}
                      {calendarFilter === 'exam' && (
                        <div className="mt-2 text-center">
                          <button
                            onClick={() => setShowFullTimetable(true)}
                            className="px-4 py-1.5 bg-gradient-to-r from-orange-400 to-amber-500 hover:from-orange-500 hover:to-amber-600 text-white rounded-full text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200 inline-flex items-center gap-2 hover:scale-105"
                          >
                            <CalendarDays className="w-3.5 h-3.5" />
                            View Exam Timetable
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeInUp>

        {/* Event Details Modal */}
        {selectedDate && (() => {
          // Use local date formatting to avoid timezone issues
          const year = selectedDate!.getFullYear();
          const month = selectedDate!.getMonth() + 1;
          const day = selectedDate!.getDate();
          const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEvents = academicCalendarEvents.filter(e => e.date === dateString);
          const filteredEvents = calendarFilter === 'all' 
            ? dayEvents 
            : dayEvents.filter(e => e.type === calendarFilter);

          return filteredEvents.length > 0 ? (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" onClick={() => setSelectedDate(null)}>
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp" onClick={(e) => e.stopPropagation()}>
                {filteredEvents.map((event, idx) => {
                  const headerColors = {
                    holiday: 'from-red-400 to-pink-500',
                    exam: 'from-orange-400 to-yellow-500',
                    event: 'from-purple-400 to-indigo-500',
                    crucial: 'from-blue-400 to-cyan-500'
                  };
                  
                  const badgeColors = {
                    holiday: 'bg-red-400',
                    exam: 'bg-orange-400',
                    event: 'bg-purple-400',
                    crucial: 'bg-blue-400'
                  };

                  // Check if this is an exam with detailed info
                  const isExamWithDetails = event.type === 'exam' && (event as any).courseCode;
                  const examDetails = event as any;

                  return (
                    <div key={idx} className={idx > 0 ? 'border-t-4 border-gray-200 dark:border-gray-700' : ''}>
                      <div className={`bg-gradient-to-r ${headerColors[event.type]} p-5 text-white relative overflow-hidden`}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-12 -mb-12"></div>
                        <div className="relative flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-bold text-xl leading-tight">{event.title}</h4>
                            {isExamWithDetails && (
                              <p className="text-white/80 text-sm mt-1">{examDetails.courseCode}</p>
                            )}
                          </div>
                          {idx === 0 && (
                            <button
                              onClick={() => setSelectedDate(null)}
                              className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-all ml-2"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        {/* Date and Time Row */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                              <Calendar className="w-4 h-4" />
                              <span className="text-xs font-medium">Date</span>
                            </div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {selectedDate!.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                          </div>

                          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 border border-purple-100 dark:border-purple-800">
                            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                              <Clock className="w-4 h-4" />
                              <span className="text-xs font-medium">Time</span>
                            </div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {isExamWithDetails ? examDetails.time : 'All Day'}
                            </p>
                          </div>
                        </div>

                        {/* Room and Building for Exams */}
                        {isExamWithDetails && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-3 border border-pink-100 dark:border-pink-800">
                              <div className="flex items-center gap-2 text-pink-600 dark:text-pink-400 mb-1">
                                <MapPin className="w-4 h-4" />
                                <span className="text-xs font-medium">Room</span>
                              </div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{examDetails.room}</p>
                            </div>

                            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-3 border border-teal-100 dark:border-teal-800">
                              <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-1">
                                <Building2 className="w-4 h-4" />
                                <span className="text-xs font-medium">Building</span>
                              </div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{examDetails.building}</p>
                            </div>
                          </div>
                        )}

                        {/* Exam Details */}
                        {isExamWithDetails && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-500" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">Exam Type</span>
                              </div>
                              <span className="text-sm font-bold text-gray-900 dark:text-white">{examDetails.examType}</span>
                            </div>
                            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Award className="w-4 h-4 text-gray-500" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">Maximum Marks</span>
                              </div>
                              <span className="text-sm font-bold text-gray-900 dark:text-white">{examDetails.maxMarks}</span>
                            </div>
                            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-500" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">Duration</span>
                              </div>
                              <span className="text-sm font-bold text-gray-900 dark:text-white">{examDetails.duration}</span>
                            </div>
                          </div>
                        )}

                        {/* Instructions for Exams */}
                        {isExamWithDetails && examDetails.instructions && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800">
                            <div className="flex items-center gap-2 mb-3">
                              <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">Instructions</span>
                            </div>
                            <ul className="space-y-2">
                              {examDetails.instructions.map((instruction: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                  <span>{instruction}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Description for non-exam events */}
                        {!isExamWithDetails && event.description && (
                          <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              {event.type === 'holiday' && <span className="text-2xl">🏖️</span>}
                              {event.type === 'event' && <span className="text-2xl">🎉</span>}
                              {event.type === 'crucial' && <span className="text-2xl">⭐</span>}
                              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 capitalize">{event.type}</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{event.description}</p>
                          </div>
                        )}

                        {idx === filteredEvents.length - 1 && (
                          <button
                            onClick={() => setSelectedDate(null)}
                            className={`w-full bg-gradient-to-r ${headerColors[event.type]} text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all`}
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null;
        })()}

        {/* Quick Access Section - White with Blue Border */}
        <FadeInUp delay={0.3}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Quick Access</h2>
            
            <div className="grid md:grid-cols-3 gap-4">
              {/* Today's Timetable */}
              <div data-tour-id="todays-timetable" className="bg-white dark:bg-gray-800 rounded-xl p-4 border-2 border-blue-400 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex flex-col h-[420px]"
                style={{ boxShadow: '0 4px 20px rgba(59, 130, 246, 0.15)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Today&apos;s Timetable</h3>
                    <p className="text-xs text-gray-500">{getTodayName()}, {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
                
                <div className="flex-1 space-y-2 overflow-y-auto" style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#60a5fa #f1f5f9'
                }}>
                  {getTodayTimetable().length > 0 ? (
                    getTodayTimetable().map((classItem) => (
                      <div key={classItem.id} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">{classItem.subject}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            classItem.type === 'Lab' 
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' 
                              : classItem.type === 'Tutorial'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {classItem.type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{classItem.subjectCode} • {classItem.faculty}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" /> {classItem.time}
                          <MapPin className="w-3 h-3 ml-2" /> {classItem.roomNo}, {classItem.building}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">No classes today</p>
                      <p className="text-xs text-gray-400 mt-1">Enjoy your day off!</p>
                    </div>
                  )}
                </div>
                
                {getTodayTimetable().length > 0 && (
                  <button className="w-full mt-3 text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center justify-center gap-1">
                    View Full Week <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Recently Placed */}
              <div data-tour-id="recently-placed" className="bg-white dark:bg-gray-800 rounded-xl p-4 border-2 border-green-400 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex flex-col h-[420px]"
                style={{ boxShadow: '0 4px 20px rgba(34, 197, 94, 0.15)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <Award className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recently Placed</h3>
                    <p className="text-xs text-gray-500">Top Recruiters</p>
                  </div>
                </div>
                
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] pr-2" style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#60a5fa #f1f5f9'
                }}>
                  {recentPlacements.map((placement) => (
                    <div key={placement.id} className="relative flex items-center gap-3 p-3 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-700/50 dark:to-gray-700/30 rounded-xl hover:shadow-md transition-all border border-green-200/50 dark:border-green-900/30">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-base shadow-md">
                        {placement.studentName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base text-gray-900 dark:text-white truncate mb-0.5">{placement.studentName}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-1">
                          <span className="font-semibold text-green-600 dark:text-green-400">{placement.company}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{placement.role}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="bg-green-600 text-white px-2 py-1 rounded-lg shadow-sm">
                          <p className="font-bold text-sm whitespace-nowrap">{placement.package}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm">
                  View All Placements <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {/* Today's Placement Drives */}
              <div data-tour-id="placement-drives" className="bg-white dark:bg-gray-800 rounded-xl p-4 border-2 border-purple-400 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex flex-col h-[420px]"
                style={{ boxShadow: '0 4px 20px rgba(147, 51, 234, 0.15)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                    <Briefcase className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Today's Placement Drives</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Tuesday, 3 Feb 2026
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full animate-pulse">
                    LIVE
                  </span>
                </div>

                {/* Placement Drives List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ scrollbarWidth: 'thin' }}>
                  {placementDrives.map((drive) => (
                    <div 
                      key={drive.id}
                      onClick={() => setSelectedPlacementDrive(drive)}
                      className={`rounded-xl p-3 border hover:shadow-md transition-all cursor-pointer group ${
                        drive.colorScheme === 'blue' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800' :
                        drive.colorScheme === 'purple' ? 'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800' :
                        drive.colorScheme === 'teal' ? 'bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-teal-200 dark:border-teal-800' :
                        'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center shadow-sm border border-gray-100 dark:border-gray-600">
                          <span className={`font-bold ${
                            drive.shortName.length > 5 ? 'text-[10px]' : drive.shortName.length > 3 ? 'text-sm' : 'text-lg'
                          } ${
                            drive.colorScheme === 'blue' ? 'text-blue-600' :
                            drive.colorScheme === 'purple' ? 'text-purple-600' :
                            drive.colorScheme === 'teal' ? 'text-teal-600' :
                            'text-amber-600'
                          }`}>{drive.shortName}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-base font-bold text-gray-900 dark:text-white transition-colors ${
                            drive.colorScheme === 'blue' ? 'group-hover:text-blue-600' :
                            drive.colorScheme === 'purple' ? 'group-hover:text-purple-600' :
                            drive.colorScheme === 'teal' ? 'group-hover:text-teal-600' :
                            'group-hover:text-amber-600'
                          }`}>{drive.company}</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{drive.role} | {drive.eligibility}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-semibold">
                              <DollarSign className="w-3 h-3" /> {drive.package}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <Clock className="w-3 h-3" /> {drive.timing}
                            </span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 text-white text-[9px] font-bold rounded-full ${
                          drive.status === 'ongoing' ? 'bg-blue-500' :
                          drive.status === 'completed' ? 'bg-green-500' :
                          'bg-orange-500'
                        }`}>{drive.statusText}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      <span className="font-semibold text-purple-600">{placementDrives.length}</span> drives today • <span className="font-semibold text-green-600">150+</span> positions
                    </span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                      Venue: Block D, Auditorium
                    </span>
                  </div>
                  <button 
                    onClick={() => setShowAllPlacementDrives(true)}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-lg hover:shadow-xl"
                  >
                    View All Placement Drives <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </FadeInUp>

        {/* University Announcements Section */}
        <FadeInUp delay={0.5}>
          <div data-tour-id="research-excellence" className="bg-white/70 backdrop-blur-sm dark:bg-gray-800 rounded-2xl shadow-md p-6 border border-blue-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">University Announcements</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Latest updates and notifications</p>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Updated Daily</span>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
              {announcementCategories.map((category) => (
                <button
                  key={category.name}
                  onClick={() => {
                    setActiveAnnouncementTab(category.name);
                    setExpandedAnnouncement(null);
                  }}
                  className={`
                    px-4 py-2 rounded-lg text-base font-medium transition-all
                    ${activeAnnouncementTab === category.name
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  {category.name}
                  <span className={`
                    ml-2 px-2 py-0.5 rounded-full text-sm font-bold
                    ${activeAnnouncementTab === category.name
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    }
                  `}>
                    {category.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Announcements List */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#60a5fa #f1f5f9'
            }}>
              {announcementsData[activeAnnouncementTab]?.map((announcement) => (
                <div
                  key={announcement.id}
                  className="group bg-gradient-to-r from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg transition-all overflow-hidden"
                >
                  {/* Announcement Header */}
                  <div
                    onClick={() => setExpandedAnnouncement(expandedAnnouncement === announcement.id ? null : announcement.id)}
                    className="flex items-start gap-4 p-4 cursor-pointer"
                  >
                    {/* Bullet Point */}
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2 h-2 bg-gray-800 dark:bg-gray-200 rounded-full"></div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-relaxed">
                        {announcement.title}
                      </h3>
                      {announcement.fileReference && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                          ( {announcement.fileReference} )
                        </p>
                      )}
                    </div>

                    {/* Date and Arrow */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs font-medium text-orange-600 dark:text-orange-400 whitespace-nowrap">
                        {announcement.date}
                      </span>
                      <div className="transition-transform duration-300" style={{
                        transform: expandedAnnouncement === announcement.id ? 'rotate(180deg)' : 'rotate(0deg)'
                      }}>
                        <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedAnnouncement === announcement.id && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-600 bg-white/50 dark:bg-gray-900/30">
                      <div className="pl-6">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                          {announcement.details}
                        </p>
                        <div className="flex items-center gap-4">
                          <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center gap-2">
                            <FileText className="w-3 h-3" />
                            View Full Notification
                          </button>
                          <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center gap-2">
                            <ExternalLink className="w-3 h-3" />
                            Download PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* No announcements message */}
              {(!announcementsData[activeAnnouncementTab] || announcementsData[activeAnnouncementTab].length === 0) && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No announcements in this category</p>
                </div>
              )}
            </div>
          </div>
        </FadeInUp>

        {/* Know Your Authorities Section - Exact SGT University Style */}
        <FadeInUp delay={0.6}>
          <div 
            data-tour-id="authorities-section"
            className="py-8 overflow-hidden relative bg-white dark:bg-gray-900 rounded-2xl"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Header */}
            <div className="max-w-7xl mx-auto px-4 mb-8 relative z-10">
              <div className="text-center">
                <h2 className="text-3xl md:text-5xl font-extrabold mb-3 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  Know Your Authorities
                </h2>
                <p className="text-base text-gray-600 dark:text-gray-400">
                  Connect with university leadership for guidance and support
                </p>
              </div>
            </div>

            {/* Carousel Container - SGT Overlapping Style */}
            <div className="relative h-[520px] flex items-center justify-center">
              {/* Navigation Arrow - Left */}
              <button
                onClick={() => {
                  setActiveAuthorityIndex((prev) => (prev - 1 + yourAuthorities.length) % yourAuthorities.length);
                }}
                className="absolute left-4 md:left-16 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full bg-gray-200/50 dark:bg-white/20 backdrop-blur-sm hover:bg-gray-300/60 dark:hover:bg-white/30 flex items-center justify-center text-gray-700 dark:text-white transition-all border border-gray-300 dark:border-white/30"
                aria-label="Previous"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              {/* Navigation Arrow - Right */}
              <button
                onClick={() => {
                  setActiveAuthorityIndex((prev) => (prev + 1) % yourAuthorities.length);
                }}
                className="absolute right-4 md:right-16 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full bg-gray-200/50 dark:bg-white/20 backdrop-blur-sm hover:bg-gray-300/60 dark:hover:bg-white/30 flex items-center justify-center text-gray-700 dark:text-white transition-all border border-gray-300 dark:border-white/30"
                aria-label="Next"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Overlapping Cards Container */}
              <div className="relative w-full h-full flex items-center justify-center">
                {yourAuthorities.map((authority, index) => {
                  const totalCards = yourAuthorities.length;
                  let position = index - activeAuthorityIndex;
                  
                  // Handle wrap-around
                  if (position > totalCards / 2) position -= totalCards;
                  if (position < -totalCards / 2) position += totalCards;
                  
                  // Show 5 cards at a time (-2 to +2)
                  const isVisible = Math.abs(position) <= 2;
                  if (!isVisible) return null;
                  
                  const isCenter = position === 0;
                  const isAdjacent = Math.abs(position) === 1;
                  
                  // Calculate overlapping positions like SGT website
                  const translateX = position * 180; // Cards overlap
                  const scale = isCenter ? 1 : isAdjacent ? 0.85 : 0.7;
                  const zIndex = isCenter ? 30 : isAdjacent ? 20 : 10;
                  
                  return (
                    <div
                      key={authority.id}
                      onClick={() => {
                        if (isCenter) {
                          // Open profile in new window/tab
                          window.open(`/faculty/${authority.id}`, '_blank');
                        } else {
                          setActiveAuthorityIndex(index);
                        }
                      }}
                      className="absolute cursor-pointer transition-all duration-500 ease-out"
                      style={{
                        transform: `translateX(${translateX}px) scale(${scale})`,
                        zIndex,
                        filter: isCenter ? 'none' : 'grayscale(100%)',
                      }}
                    >
                      <div 
                        className={`relative overflow-hidden rounded-xl transition-all duration-500 ${isCenter ? 'ring-4 ring-white/30' : ''}`}
                        style={{ 
                          width: '280px', 
                          height: isCenter ? '500px' : '380px',
                          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 10px 30px rgba(0, 0, 0, 0.3)'
                        }}
                      >
                        {/* Full Image */}
                        <div className="absolute top-0 left-0 right-0" style={{ height: isCenter ? '300px' : '380px' }}>
                          <img
                            src={authority.image}
                            alt={authority.name}
                            className="w-full h-full object-cover object-top"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666" stroke="none"%3E%3Crect width="24" height="24" fill="%23ddd"/%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E';
                            }}
                          />
                        </div>
                        
                        {/* Text Overlay at Bottom - SGT Style (for non-center cards) */}
                        {!isCenter && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 pt-12">
                            <h3 className="font-semibold text-base text-white text-center mb-1" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                              {authority.name}
                            </h3>
                            <p className="text-sm text-blue-300 text-center font-medium" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
                              {authority.position}
                            </p>
                          </div>
                        )}
                        
                        {/* Center Card Extra Info */}
                        {isCenter && (
                          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl p-4 pt-5 transform transition-all duration-300" style={{ height: '200px' }}>
                            <h3 className="font-bold text-base text-gray-900 dark:text-white text-center mb-1">
                              {authority.name}
                            </h3>
                            <p className="text-sm text-blue-600 dark:text-blue-400 text-center font-medium mb-1">
                              {authority.position}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3">
                              SGT University
                            </p>
                            
                            {/* Contact Info */}
                            <div className="space-y-1.5 mb-3">
                              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="truncate">{authority.email}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <span>{authority.phone}</span>
                              </div>
                            </div>
                            
                            {/* Book Appointment Button */}
                            <button 
                              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                alert('Coming Soon!');
                              }}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Book Appointment
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </FadeInUp>

        {/* Permission-Based Dashboard - Guidelines & News */}
        <FadeInUp delay={0.7}>
          <div data-tour-id="guidelines-news" className="bg-white/70 backdrop-blur-sm dark:bg-gray-800 rounded-2xl shadow-md p-6 border border-blue-100 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Guidelines & Policies </h2>
                
                {/* Guidelines Cards - Single Row with 6 Columns */}
                <div className="grid grid-cols-6 gap-3 mb-6">
                  {guidelinesData.map((guideline) => {
                    const IconComponent = guideline.icon;
                    return (
                      <a
                        key={guideline.id}
                        href={guideline.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`group relative overflow-hidden rounded-xl p-4 bg-gradient-to-br ${guideline.color} shadow-md hover:shadow-xl transition-all hover:scale-105 cursor-pointer`}
                      >
                        {/* Animated Background Elements */}
                        <div className="absolute inset-0 opacity-20">
                          {/* Floating circles */}
                          <div className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full opacity-20"></div>
                          <div className="absolute bottom-2 left-2 w-6 h-6 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                          <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-white rounded-full animate-ping" style={{ animationDelay: '0.6s' }}></div>
                          {/* Wave pattern */}
                          <svg className="absolute bottom-0 left-0 w-full h-16" viewBox="0 0 200 80" preserveAspectRatio="none">
                            <path d="M0,40 Q50,20 100,40 T200,40 L200,80 L0,80 Z" fill="white" opacity="0.15" />
                          </svg>
                        </div>
                        
                        <div className="relative z-10 flex flex-col items-center text-center h-full">
                          {/* Icon */}
                          <div className="w-10 h-10 bg-white/25 backdrop-blur-sm rounded-lg flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all mb-2">
                            <IconComponent className="w-5 h-5 text-white" />
                          </div>
                          
                          {/* Title */}
                          <h3 className="font-bold text-sm text-white mb-1.5 line-clamp-2">
                            {guideline.title}
                          </h3>
                          
                          {/* View Button */}
                          <div className="mt-auto flex items-center gap-1 text-xs text-white/90 font-semibold">
                            <FileText className="w-2.5 h-2.5" />
                            <span>View</span>
                            <ExternalLink className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                        
                        {/* Shine effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                      </a>
                    );
                  })}
                </div>

                {/* SGT Times Section with Categories */}
                <div className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/90 rounded-2xl p-6 border-2 border-blue-100 dark:border-gray-600 shadow-xl">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img 
                          src="https://sgttimes.com/wp-content/uploads/2023/08/cropped-SGT-Times-Logo-1-192x192.png"
                          alt="SGT Times"
                          className="w-12 h-12 rounded-xl object-contain shadow-md"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              const fallback = document.createElement('div');
                              fallback.className = 'w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md';
                              fallback.innerHTML = '<svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>';
                              parent.insertBefore(fallback, target);
                            }
                          }}
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">SGT Times</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Latest University News & Updates</p>
                      </div>
                    </div>
                    <a
                      href="https://sgttimes.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                      <span>Visit Website</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Category Tabs */}
                  <div className="flex flex-wrap gap-2 mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
                    {sgtTimesCategories.map((category) => (
                      <button
                        key={category.name}
                        onClick={() => setActiveSgtTimesTab(category.name)}
                        className={`
                          px-4 py-2 rounded-lg text-sm font-medium transition-all
                          ${activeSgtTimesTab === category.name
                            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }
                        `}
                      >
                        {category.name}
                        <span className={`
                          ml-2 px-2 py-0.5 rounded-full text-xs font-bold
                          ${activeSgtTimesTab === category.name
                            ? 'bg-white/20 text-white'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          }
                        `}>
                          {category.count}
                        </span>
                      </button>
                    ))}
                  </div>
                  
                  {/* News Articles */}
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2" style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#60a5fa #f1f5f9'
                  }}>
                    {sgtTimesData[activeSgtTimesTab]?.map((article) => (
                      <a
                        key={article.id}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block bg-gradient-to-r from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 hover:shadow-lg transition-all border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          {/* Category Badge */}
                          <div className="flex-shrink-0 mt-1">
                            <span className={`
                              inline-block px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider
                              ${article.category === 'Achievement' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' :
                                article.category === 'Innovation' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' :
                                article.category === 'Placements' ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' :
                                article.category === 'Global' ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white' :
                                article.category === 'Events' ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white' :
                                'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                              }
                            `}>
                              {article.category}
                            </span>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-relaxed mb-2 line-clamp-2">
                              {article.title}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2 mb-2">
                              {article.excerpt}
                            </p>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="font-medium">{article.date}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-semibold group-hover:gap-2 transition-all">
                                <span>Read More</span>
                                <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </FadeInUp>

            {/* Social Footprints Section */}
            <FadeInUp delay={0.9}>
              <div data-tour-id="social-footprints">
                <SocialFootprints />
              </div>
            </FadeInUp>
          </div>

          {/* Virtual Tour Component */}
          <TourGuide 
            steps={tourSteps}
            isOpen={showTour}
            onClose={() => setShowTour(false)}
            onComplete={() => {
              setShowTour(false);
              // Keep tour button visible so users can retake the tour anytime
            }}
          />

          {/* Tour Start Button */}
          {showTourButton && !showTour && (
            <button
              onClick={() => setShowTour(true)}
              className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 group"
              aria-label="Start virtual tour"
            >
              <HelpCircle className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              <span className="font-semibold text-sm">Take a Tour</span>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full" />
            </button>
          )}

          {/* Footer */}
          <Footer />
        </>
      );
    }
