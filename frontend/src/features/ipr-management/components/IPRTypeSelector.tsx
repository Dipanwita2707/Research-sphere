'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Lightbulb, FileText, Palette, Briefcase } from 'lucide-react';

interface IPRType {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
}

const IPR_TYPES: IPRType[] = [
  {
    id: 'patent',
    title: 'Patent Filing',
    description: 'Protect your inventions and technical innovations',
    icon: Lightbulb,
    color: 'bg-white border-[#f0e2d2] hover:border-[#7d1a34] dark:bg-gray-800 dark:border-gray-700 dark:hover:border-[#c8973f]'
  },
  {
    id: 'copyright',
    title: 'Copyright Filing',
    description: 'Protect your original works of authorship',
    icon: FileText,
    color: 'bg-white border-[#f0e2d2] hover:border-[#7d1a34] dark:bg-gray-800 dark:border-gray-700 dark:hover:border-[#c8973f]'
  },
  {
    id: 'design',
    title: 'Design Filing',
    description: 'Protect the visual design of your products',
    icon: Palette,
    color: 'bg-white border-[#f0e2d2] hover:border-[#7d1a34] dark:bg-gray-800 dark:border-gray-700 dark:hover:border-[#c8973f]'
  },
  {
    id: 'trademark',
    title: 'Trademark Filing',
    description: 'Protect your brand names, logos, and symbols',
    icon: Briefcase,
    color: 'bg-white border-[#f0e2d2] hover:border-[#7d1a34] dark:bg-gray-800 dark:border-gray-700 dark:hover:border-[#c8973f]'
  }
];

export default function IPRTypeSelector() {
  const router = useRouter();

  const handleTypeSelection = (type: string) => {
    router.push(`/ipr/apply?type=${type}`);
  };

  return (
    <div className="min-h-screen bg-[#fdf5ec] dark:bg-gray-950 py-8">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#2b1d22] dark:text-white mb-2 font-serif">
            Intellectual Property Rights (IPR) Application
          </h1>
          <div className="w-16 h-1 bg-gradient-to-r from-[#7d1a34] to-[#c8973f] mx-auto mb-3 rounded-full" />
          <p className="text-lg text-[#7a7178] dark:text-gray-400">
            Select the type of IPR you want to apply for
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {IPR_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <div
                key={type.id}
                onClick={() => handleTypeSelection(type.id)}
                className={`${type.color} border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 transform hover:scale-[1.02] hover:shadow-md`}
              >
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-[#fdf5ec] dark:bg-gray-700 rounded-lg shadow-sm mr-4">
                    <Icon className="w-8 h-8 text-[#7d1a34] dark:text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-[#2b1d22] dark:text-white mb-1">
                      {type.title}
                    </h3>
                  </div>
                </div>
                <p className="text-[#7a7178] dark:text-gray-300 leading-relaxed text-sm">
                  {type.description}
                </p>
                <div className="mt-4 flex justify-end">
                  <button className="bg-[#7d1a34] text-white hover:bg-[#5e1024] dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-gray-950 px-4 py-2 rounded-lg font-medium transition-colors text-sm border-none shadow-sm flex items-center gap-1">
                    Apply Now →
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 bg-white dark:bg-gray-800 rounded-xl border border-[#f0e2d2] dark:border-gray-700 shadow-sm p-6 max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold text-[#7d1a34] dark:text-amber-500 mb-4 font-serif">
            Need Help Choosing?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-bold text-[#2b1d22] dark:text-gray-200 mb-2">Patents</h4>
              <p className="text-[#7a7178] dark:text-gray-400">
                For new inventions, processes, or improvements to existing technology
              </p>
            </div>
            <div>
              <h4 className="font-bold text-[#2b1d22] dark:text-gray-200 mb-2">Copyrights</h4>
              <p className="text-[#7a7178] dark:text-gray-400">
                For original works like software, literature, art, or music
              </p>
            </div>
            <div>
              <h4 className="font-bold text-[#2b1d22] dark:text-gray-200 mb-2">Design Rights</h4>
              <p className="text-[#7a7178] dark:text-gray-400">
                For the visual appearance of products, including shape, pattern, or ornamentation
              </p>
            </div>
            <div>
              <h4 className="font-bold text-[#2b1d22] dark:text-gray-200 mb-2">Entrepreneurship</h4>
              <p className="text-[#7a7178] dark:text-gray-400">
                For business innovations, startup ideas, and commercial applications
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}