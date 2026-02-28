'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Languages, Check, ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const languages = [
  { code: 'en' as const, name: 'English', nativeName: 'English' },
  { code: 'hi' as const, name: 'Hindi', nativeName: 'हिंदी' },
];

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const currentLanguage = languages.find(lang => lang.code === language) || languages[0];

  return (
    <div className="relative z-50" ref={dropdownRef}>
      {/* Language Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl bg-white hover:bg-white/95 border-2 border-white/50 hover:border-white shadow-lg hover:shadow-xl transition-all duration-300 group backdrop-blur-sm min-w-[120px] justify-center"
        aria-label="Select Language"
        type="button"
      >
        <Languages className="w-4 h-4 md:w-5 md:h-5 text-blue-600 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300" />
        <span className="text-xs md:text-sm font-bold text-gray-800">
          {currentLanguage.nativeName}
        </span>
        <ChevronDown 
          className={`w-3 h-3 md:w-4 md:h-4 text-gray-600 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute right-0 mt-2 w-60 md:w-64 bg-white rounded-2xl shadow-2xl border-2 border-blue-200 overflow-hidden z-[100] animate-slideDown">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 border-b border-blue-200">
            <div className="flex items-center gap-2">
              <Languages className="w-5 h-5 text-white" />
              <h3 className="text-sm font-semibold text-white">Select Language</h3>
            </div>
            <p className="text-xs text-blue-100 mt-1">भाषा चुनें</p>
          </div>

          {/* Language Options */}
          <div className="py-2">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 flex items-center justify-between hover:bg-blue-50 transition-all duration-200 group ${
                  language === lang.code ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex flex-col items-start">
                  <span className={`text-sm font-medium ${
                    language === lang.code ? 'text-blue-600' : 'text-gray-700'
                  } group-hover:text-blue-600 transition-colors`}>
                    {lang.nativeName}
                  </span>
                  <span className="text-xs text-gray-500 group-hover:text-gray-600">
                    {lang.name}
                  </span>
                </div>
                {language === lang.code && (
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 animate-scaleIn">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              Language will be saved automatically
            </p>
          </div>
        </div>
        </>
      )}

      {/* Add animations */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0);
          }
          to {
            transform: scale(1);
          }
        }

        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
