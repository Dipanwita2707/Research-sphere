'use client';

import { motion } from 'framer-motion';
import { Heart, MessageCircle, Instagram, ExternalLink, Calendar } from 'lucide-react';
import Image from 'next/image';
import { EXTERNAL_URLS } from '@/shared/constants';

interface SocialPost {
  id: string;
  platform: 'instagram' | 'facebook' | 'twitter';
  username: string;
  date: string;
  image: string;
  caption: string;
  likes: number;
  comments: number;
  postUrl: string;
}

// Sample data - In production, these images should be hosted on your own server
// and fetched from an API. Using placeholder paths for local assets.
const samplePosts: SocialPost[] = [
  {
    id: '1',
    platform: 'instagram',
    username: 'researchsphere',
    date: 'Jan 14, 2026',
    image: EXTERNAL_URLS.PLACEHOLDER_IMAGES.SOCIAL_1,
    caption: '#PlacementDay2026 at ResearchSphere was a moment of destiny in motion! Across our campus, cheers, hugs and happy tears marked the journey from classrooms to careers.',
    likes: 443,
    comments: 2,
    postUrl: EXTERNAL_URLS.INSTAGRAM,
  },
  {
    id: '2',
    platform: 'instagram',
    username: 'researchsphere',
    date: 'Jan 13, 2026',
    image: EXTERNAL_URLS.PLACEHOLDER_IMAGES.SOCIAL_2,
    caption: 'Our #ResearchSphereCampus came alive with the warmth of celebrations as our #ResearchSphereFamily came together to celebrate the spirit of unity and togetherness!',
    likes: 2500,
    comments: 5,
    postUrl: EXTERNAL_URLS.INSTAGRAM,
  },
  {
    id: '3',
    platform: 'instagram',
    username: 'researchsphere',
    date: 'Jan 13, 2026',
    image: EXTERNAL_URLS.PLACEHOLDER_IMAGES.SOCIAL_3,
    caption: 'Crackling bonfires, flying revris, beats of dhol and smiles that refuse to fade — celebrations at the #ResearchSphereCampus was pure magic this year!',
    likes: 4200,
    comments: 49,
    postUrl: EXTERNAL_URLS.INSTAGRAM,
  },
  {
    id: '4',
    platform: 'instagram',
    username: 'researchsphere',
    date: 'Jan 12, 2026',
    image: EXTERNAL_URLS.PLACEHOLDER_IMAGES.SOCIAL_4,
    caption: 'Degrees in hand. Parents in the front row. Friends on speed dial for photos! At #ResearchSphere12thConvocation, pride spoke louder than words as our graduates stepped into the future.',
    likes: 2000,
    comments: 17,
    postUrl: EXTERNAL_URLS.INSTAGRAM,
  },
  {
    id: '5',
    platform: 'instagram',
    username: 'researchsphere',
    date: 'Jan 12, 2026',
    image: EXTERNAL_URLS.PLACEHOLDER_IMAGES.SOCIAL_5,
    caption: '#MustWatch: In a powerful address at #ResearchSphere12thConvocation, Hon\'ble Vice President of India, Shri C. P. Radhakrishnan congratulated the graduating students.',
    likes: 1700,
    comments: 12,
    postUrl: EXTERNAL_URLS.INSTAGRAM,
  },
  {
    id: '6',
    platform: 'instagram',
    username: 'researchsphere',
    date: 'Jan 11, 2026',
    image: EXTERNAL_URLS.PLACEHOLDER_IMAGES.SOCIAL_6,
    caption: 'Innovation meets excellence! Our students showcasing groundbreaking projects at the Annual Tech Fest. The future is here! 🚀',
    likes: 3200,
    comments: 28,
    postUrl: EXTERNAL_URLS.INSTAGRAM,
  },
  {
    id: '7',
    platform: 'instagram',
    username: 'researchsphere',
    date: 'Jan 10, 2026',
    image: EXTERNAL_URLS.PLACEHOLDER_IMAGES.SOCIAL_7,
    caption: 'Sports Day 2026! Our champions showing incredible team spirit and determination. Pride in every stride! 🏆',
    likes: 1800,
    comments: 15,
    postUrl: EXTERNAL_URLS.INSTAGRAM,
  },
  {
    id: '8',
    platform: 'instagram',
    username: 'researchsphere',
    date: 'Jan 9, 2026',
    image: EXTERNAL_URLS.PLACEHOLDER_IMAGES.SOCIAL_8,
    caption: 'Guest lecture by industry leaders sharing insights on the future of technology and innovation. Learning never stops! 📚',
    likes: 2800,
    comments: 22,
    postUrl: EXTERNAL_URLS.INSTAGRAM,
  },
  {
    id: '9',
    platform: 'instagram',
    username: 'researchsphere',
    date: 'Jan 8, 2026',
    image: EXTERNAL_URLS.PLACEHOLDER_IMAGES.SOCIAL_9,
    caption: 'Cultural fest highlights! Our talented students bringing colors, music, and joy to campus life. What a spectacular performance! 🎭',
    likes: 3500,
    comments: 35,
    postUrl: EXTERNAL_URLS.INSTAGRAM,
  },
  {
    id: '10',
    platform: 'instagram',
    username: 'researchsphere',
    date: 'Jan 7, 2026',
    image: EXTERNAL_URLS.PLACEHOLDER_IMAGES.SOCIAL_10,
    caption: 'Research excellence recognized! Our faculty and students awarded for their outstanding contributions to science and innovation. 🔬',
    likes: 2100,
    comments: 18,
    postUrl: EXTERNAL_URLS.INSTAGRAM,
  },
];

const formatNumber = (num: number): string => {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

export default function SocialFootprints() {
  const handleInteraction = (postUrl: string) => {
    window.open(postUrl, '_blank', 'noopener,noreferrer');
  };

  // Duplicate posts for seamless infinite scroll
  const duplicatedPosts = [...samplePosts, ...samplePosts];

  return (
    <div className="py-16 bg-gradient-to-br from-white via-orange-50/30 via-rose-50/30 to-purple-50/30 dark:from-gray-900 dark:via-gray-850 dark:to-gray-900 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-gradient-to-r from-orange-100 via-rose-100 to-purple-100 dark:from-orange-900/30 dark:via-rose-900/30 dark:to-purple-900/30 mb-4">
            <Instagram className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-600 via-rose-600 to-purple-600 dark:from-orange-400 dark:via-rose-400 dark:to-purple-400 text-sm tracking-wide"># Social Footprints</span>
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-orange-900 to-purple-900 dark:from-white dark:via-orange-200 dark:to-purple-200 bg-clip-text text-transparent mb-3">
            Stay Connected
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Follow our journey through campus life, achievements, and memorable moments
          </p>
        </motion.div>
      </div>

      {/* Scrolling Posts Container */}
      <div className="relative">
        {/* Gradient Fade Edges */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white via-white/80 to-transparent dark:from-gray-900 dark:via-gray-900/80 dark:to-transparent z-10 pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white via-white/80 to-transparent dark:from-gray-900 dark:via-gray-900/80 dark:to-transparent z-10 pointer-events-none"></div>

        {/* Infinite Scroll Animation */}
        <motion.div
          className="flex gap-6"
          animate={{
            x: [0, -1920], // Adjust based on card width + gap
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 40,
              ease: "linear",
            },
          }}
        >
          {duplicatedPosts.map((post, index) => (
            <motion.div
              key={`${post.id}-${index}`}
              whileHover={{ scale: 1.05, zIndex: 20 }}
              className="flex-shrink-0 w-80 cursor-pointer group"
              onClick={() => handleInteraction(post.postUrl)}
            >
              <div className="relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300">
                {/* Image */}
                <div className="relative h-96 overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.caption.substring(0, 50)}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300"></div>
                  
                  {/* Platform Badge */}
                  <div className="absolute top-3 right-3 p-2 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-md">
                    <Instagram className="w-4 h-4 text-pink-600" />
                  </div>

                  {/* External Link Icon */}
                  <div className="absolute top-3 left-3 p-2 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 backdrop-blur-sm shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <ExternalLink className="w-4 h-4 text-white" />
                  </div>
                </div>

                {/* Content Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  {/* Username & Date */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-sm">@{post.username}</p>
                    <div className="flex items-center gap-1 text-xs opacity-90">
                      <Calendar className="w-3 h-3" />
                      <span>{post.date}</span>
                    </div>
                  </div>

                  {/* Caption */}
                  <p className="text-xs leading-relaxed mb-3 line-clamp-3 opacity-90">
                    {post.caption}
                  </p>

                  {/* Interaction Buttons */}
                  <div className="flex items-center gap-4">
                    <motion.button
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInteraction(post.postUrl);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500/20 to-pink-500/20 hover:from-red-500 hover:to-pink-500 backdrop-blur-sm transition-all duration-300"
                    >
                      <Heart className="w-4 h-4" fill="currentColor" />
                      <span className="text-sm font-semibold">{formatNumber(post.likes)}</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInteraction(post.postUrl);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500 hover:to-cyan-500 backdrop-blur-sm transition-all duration-300"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-sm font-semibold">{post.comments}</span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Follow Button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-12"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.open(EXTERNAL_URLS.INSTAGRAM, '_blank')}
            className="px-8 py-4 rounded-full bg-gradient-to-r from-orange-500 via-rose-500 to-purple-500 hover:from-orange-600 hover:via-rose-600 hover:to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 mx-auto"
          >
            <Instagram className="w-5 h-5" />
            Follow us on Instagram
            <ExternalLink className="w-4 h-4" />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
