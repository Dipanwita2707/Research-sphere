'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Languages, Check, ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const languages = [{ code: 'en' as const }, { code: 'hi' as const }];

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const currentLanguage = languages.find((lang) => lang.code === language) || languages[0];

  const getPrimaryLabel = (code: 'en' | 'hi') => {
    return code === 'en' ? 'English' : 'हिंदी';
  };

  const getSecondaryLabel = (code: 'en' | 'hi') => {
    return code === 'en' ? t('language.english') : t('language.hindi');
  };

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl bg-white hover:bg-[#f8fafc] border border-[#b3cde0] hover:border-[#6497b1] shadow-[0_8px_20px_rgba(1,31,75,0.12)] hover:shadow-[0_12px_24px_rgba(1,31,75,0.18)] transition-all duration-300 group backdrop-blur-sm min-w-[120px] justify-center"
        aria-label={t('language.selectorTitle')}
        type="button"
      >
        <Languages className="w-4 h-4 md:w-5 md:h-5 text-[#005b96] group-hover:scale-110 group-hover:rotate-12 transition-all duration-300" />
        <span className="text-xs md:text-sm font-bold text-[#011f4b]">
          {getPrimaryLabel(currentLanguage.code)}
        </span>
        <ChevronDown
          className={`w-3 h-3 md:w-4 md:h-4 text-[#6497b1] transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-2 w-72 md:w-80 bg-white rounded-2xl shadow-[0_18px_40px_rgba(1,31,75,0.24)] border border-[#6497b1] overflow-hidden z-[100] animate-slideDown">
            <div className="px-4 py-3 bg-gradient-to-r from-[#011f4b] via-[#03396c] to-[#005b96] border-b border-[#6497b1]">
              <div className="flex items-center gap-2">
                <Languages className="w-5 h-5 text-white" />
                <h3 className="text-sm font-semibold text-white">{t('language.selectorTitle')}</h3>
              </div>
              <p className="text-xs text-[#b3cde0] mt-1">{t('language.selectorSubtitle')}</p>
            </div>

            <div className="py-2 bg-white">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#b3cde0]/20 transition-all duration-200 group ${
                    language === lang.code ? 'bg-[#b3cde0]/25' : ''
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span
                      className={`text-sm font-medium ${
                        language === lang.code ? 'text-[#005b96]' : 'text-[#03396c]'
                      } group-hover:text-[#005b96] transition-colors`}
                    >
                      {getPrimaryLabel(lang.code)}
                    </span>
                    <span className="text-xs text-[#6497b1] group-hover:text-[#03396c]">
                      {getSecondaryLabel(lang.code)}
                    </span>
                  </div>
                  {language === lang.code && (
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#005b96] animate-scaleIn shadow-[0_4px_10px_rgba(3,57,108,0.28)]">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="px-4 py-2 bg-[#f8fafc] border-t border-[#b3cde0]">
              <p className="text-xs text-[#6497b1] text-center">{t('language.savedAuto')}</p>
            </div>
          </div>
        </>
      )}

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
