'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/auth/authStore';
import { LogIn, AlertCircle, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';

const SGT_LOGO_URL = '/sgt-logo.png';

const slideImages = [
  {
    url: 'https://images.unsplash.com/photo-1562774053-701939374585?w=1200&q=80',
    title: 'SGT University Campus',
    description: 'World-class infrastructure and modern facilities'
  },
  {
    url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&q=80',
    title: 'State-of-the-Art Library',
    description: 'Extensive resources for academic excellence'
  },
  {
    url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=1200&q=80',
    title: 'Research & Innovation',
    description: 'Leading innovations in research and development'
  },
  {
    url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&q=80',
    title: 'Vibrant Student Life',
    description: 'Diverse campus life and cultural activities'
  }
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    setMounted(true);
    
    // Auto-advance slideshow
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideImages.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slideImages.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slideImages.length) % slideImages.length);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      // Small delay to ensure state is persisted
      await new Promise(resolve => setTimeout(resolve, 100));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Left Side - Slideshow */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden bg-gradient-to-br from-orange-600 via-primary-600 to-indigo-600">
        {/* Slideshow Images */}
        <div className="absolute inset-0">
          {slideImages.map((slide, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentSlide ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <img
                src={slide.url}
                alt={slide.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-orange-900/80 via-primary-900/80 to-indigo-900/80"></div>
            </div>
          ))}
        </div>

        {/* Overlay Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo and Title */}
          <div className="animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl">
                <img 
                  src={SGT_LOGO_URL} 
                  alt="SGT University Logo" 
                  className="w-14 h-14 object-contain"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/56x56/0F2573/FFFFFF?text=SGT';
                  }}
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold">SGT University</h1>
                <p className="text-white/80 text-sm">University Management System</p>
              </div>
            </div>
          </div>

          {/* Slide Content */}
          <div className="space-y-6 mb-8">
            <div className="transition-all duration-500">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
                {slideImages[currentSlide].title}
              </h2>
              <p className="text-xl text-white/90 max-w-md">
                {slideImages[currentSlide].description}
              </p>
            </div>
          </div>

          {/* Footer and Navigation */}
          <div className="space-y-6">
            {/* Slide Navigation */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={prevSlide}
                className="p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all hover:scale-110"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              {/* Slide Indicators */}
              <div className="flex gap-2">
                {slideImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentSlide
                        ? 'w-8 bg-white'
                        : 'w-2 bg-white/50 hover:bg-white/70'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
              
              <button
                onClick={nextSlide}
                className="p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all hover:scale-110"
                aria-label="Next slide"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Footer */}
            <div className="text-sm text-white/60 text-center">
              © {new Date().getFullYear()} SGT University. All rights reserved.
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
        {/* Animated Watermark Logo Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-5 dark:opacity-10 animate-pulse-slow">
            <img 
              src={SGT_LOGO_URL} 
              alt="SGT Watermark" 
              className="w-96 h-96 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="absolute top-20 right-20 opacity-3 dark:opacity-5 animate-float-slow">
            <img 
              src={SGT_LOGO_URL} 
              alt="SGT Watermark" 
              className="w-48 h-48 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="absolute bottom-20 left-20 opacity-3 dark:opacity-5 animate-float-slow animation-delay-2000">
            <img 
              src={SGT_LOGO_URL} 
              alt="SGT Watermark" 
              className="w-40 h-40 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Animated Background Elements for mobile */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none lg:hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-300 dark:bg-orange-900/30 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-300 dark:bg-primary-900/30 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        </div>

        <div className={`w-full max-w-xl relative z-10 transition-all duration-1000 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
          {/* Mobile Header */}
          <div className="text-center mb-8 lg:hidden">
            <div className="flex items-center justify-center mb-4">
              <div className="relative bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-lg">
                <img 
                  src={SGT_LOGO_URL} 
                  alt="SGT University Logo" 
                  className="w-16 h-16 object-contain"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/64x64/0F2573/FFFFFF?text=SGT';
                  }}
                />
              </div>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 via-primary-600 to-indigo-600 dark:from-orange-400 dark:via-primary-400 dark:to-indigo-400 bg-clip-text text-transparent mb-2 animate-gradient">
              SGT University
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">University Management System</p>
          </div>

          {/* Login Card */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-10 lg:p-12 border border-gray-200 dark:border-gray-700">
            {/* Card Header */}
            <div className="mb-10">
              <div className="hidden lg:flex items-center gap-2 mb-4">
                <div className="w-1.5 h-12 bg-gradient-to-b from-orange-500 to-primary-600 rounded-full"></div>
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
              </div>
              <div className="lg:hidden text-center mb-2">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400 lg:ml-5 text-center lg:text-left text-base">Please sign in to your account</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start animate-shake">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-7">
              <div className="space-y-2">
                <label htmlFor="username" className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  UID / Registration Number
                </label>
                <div className="relative group">
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-5 py-4 text-base border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400 transition-all duration-300 placeholder:text-gray-400 group-hover:border-gray-300 dark:group-hover:border-gray-500"
                    placeholder="Enter your UID or Registration Number"
                    required
                    autoComplete="username"
                  />
                  <div className="absolute inset-0 -z-10 bg-gradient-to-r from-orange-500 to-primary-600 rounded-xl opacity-0 group-focus-within:opacity-20 blur transition-opacity duration-300"></div>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 ml-1">
                  Students: 9-digit registration number | Staff: UID
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative group">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-4 pr-14 text-base border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:border-orange-500 dark:focus:border-orange-400 transition-all duration-300 placeholder:text-gray-400 group-hover:border-gray-300 dark:group-hover:border-gray-500"
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  <div className="absolute inset-0 -z-10 bg-gradient-to-r from-orange-500 to-primary-600 rounded-xl opacity-0 group-focus-within:opacity-20 blur transition-opacity duration-300"></div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-orange-600 to-primary-600 hover:from-orange-700 hover:to-primary-700 dark:from-orange-500 dark:to-primary-500 dark:hover:from-orange-600 dark:hover:to-primary-600 text-white text-lg font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:shadow-orange-500/50 dark:hover:shadow-orange-500/30 transform hover:-translate-y-0.5 active:translate-y-0 group"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <>
                    <LogIn className="w-6 h-6 mr-2 group-hover:translate-x-1 transition-transform" />
                    Sign In
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer - Mobile Only */}
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-8 lg:hidden">
            © {new Date().getFullYear()} SGT University. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
