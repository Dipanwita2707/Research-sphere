'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp } from 'lucide-react';
import { EXTERNAL_URLS } from '@/shared/constants';

export default function UniversityEventsSlideshow() {
  const [currentSlide, setCurrentSlide] = useState(0);

  // SGT University Research Publications and Activities
  const slides = [
    {
      title: 'AI-Powered Healthcare Diagnostics',
      description: 'Novel machine learning algorithms for early disease detection published in Nature Medicine',
      image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80',
      paperName: 'Deep Learning Framework for Medical Image Analysis',
      author: 'Dr. Rajesh Kumar et al.',
    },
    {
      title: 'Sustainable Energy Solutions',
      description: 'Breakthrough research in solar panel efficiency enhancement - IEEE Journal',
      image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80',
      paperName: 'Advanced Photovoltaic Materials for Next-Gen Solar Cells',
      author: 'Dr. Priya Sharma et al.',
    },
    {
      title: 'Quantum Computing Applications',
      description: 'Revolutionary quantum algorithms for cryptography published in Science',
      image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80',
      paperName: 'Quantum Key Distribution in Network Security',
      author: 'Dr. Amit Verma et al.',
    },
    {
      title: 'Biotechnology Innovation',
      description: 'Novel gene therapy approach for cancer treatment - Cell Journal',
      image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&q=80',
      paperName: 'CRISPR-Based Therapeutic Strategies for Oncology',
      author: 'Dr. Sneha Patel et al.',
    },
    {
      title: 'Climate Change Research',
      description: 'Innovative carbon capture technology published in Environmental Science & Technology',
      image: '/images/CLIMATE.jpg',
      paperName: 'Scalable Carbon Sequestration Using Nanomaterials',
      author: 'Dr. Vikram Singh et al.',
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(timer);
  }, [slides.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.9 }}
      className="mb-8"
    >
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 transition-colors duration-200">
        <div className="grid lg:grid-cols-2 gap-4 lg:gap-6 items-center p-4 sm:p-5 lg:p-8">
          {/* Left Content - Text Section */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-3 lg:space-y-4 order-2 lg:order-1"
          >
            <div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">
                Research Excellence at <span className="text-blue-600 dark:text-blue-400">SGT University.</span>
              </h2>
              <p className="text-sm sm:text-base lg:text-lg text-gray-700 dark:text-gray-300">
                Pioneering innovations and groundbreaking discoveries <span className="font-semibold text-blue-600 dark:text-blue-400">shaping the future.</span>
              </p>
            </div>
            
            <div className="space-y-2 lg:space-y-3">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-start gap-3 p-3 bg-white/70 backdrop-blur-sm dark:bg-gray-800 rounded-xl shadow-sm"
              >
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white mb-1">Track Research Impact</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Monitor publications, citations, and research impact across all disciplines in real-time.</p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-start gap-3 p-3 bg-white/70 backdrop-blur-sm dark:bg-gray-800 rounded-xl shadow-sm"
              >
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white mb-1">Foster Innovation & IPR</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Manage intellectual property, patents, and innovation from ideation to commercialization.</p>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right Content - Image Slideshow */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="relative order-1 lg:order-2"
          >
            <div className="relative h-[250px] sm:h-[300px] lg:h-[350px] rounded-xl overflow-hidden shadow-xl group">
              {/* Slideshow Container */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.7 }}
                  className="relative w-full h-full"
                >
                  {/* Background Image */}
                  <div className="absolute inset-0">
                    <img
                      src={slides[currentSlide].image}
                      alt={slides[currentSlide].title}
                      className="w-full h-full object-cover"
                    />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  </div>

                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <motion.h3
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-2xl font-bold mb-2"
                    >
                      {slides[currentSlide].title}
                    </motion.h3>
                    <motion.p
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-sm text-white/90 mb-1"
                    >
                      {slides[currentSlide].description}
                    </motion.p>
                    <motion.p
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-xs text-white/80 italic"
                    >
                      📄 {slides[currentSlide].paperName}
                    </motion.p>
                    <motion.p
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-xs text-white/70 mt-1"
                    >
                      by {slides[currentSlide].author}
                    </motion.p>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation Arrows */}
              <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 backdrop-blur-md hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-all opacity-0 group-hover:opacity-100 z-10"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 backdrop-blur-md hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-all opacity-0 group-hover:opacity-100 z-10"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Slide Indicators */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`h-1.5 rounded-full transition-all ${
                      index === currentSlide
                        ? 'bg-white w-8'
                        : 'bg-white/50 hover:bg-white/75 w-1.5'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Thumbnail Gallery - Small photo boxes */}
            <div className="flex gap-2 mt-4 justify-center">
              {slides.map((slide, index) => (
                <motion.button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                    index === currentSlide 
                      ? 'border-blue-500 shadow-lg' 
                      : 'border-gray-200 dark:border-gray-600 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img 
                    src={slide.image} 
                    alt={slide.title} 
                    className="w-full h-full object-cover"
                  />
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
