import React from 'react';
import { Tag } from 'lucide-react';

interface ResearchInterestsTagsProps {
  interests: string[];
}

export default function ResearchInterestsTags({ interests }: ResearchInterestsTagsProps) {
  if (interests.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tag className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      {interests.map((interest, index) => (
        <button
          key={index}
          className="px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          {interest}
        </button>
      ))}
    </div>
  );
}
