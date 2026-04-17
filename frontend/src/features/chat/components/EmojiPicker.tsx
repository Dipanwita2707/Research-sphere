/**
 * Emoji Picker Component
 * Simple emoji picker for messages
 */
'use client';

import React, { useRef, useEffect } from 'react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥'],
  },
  {
    name: 'Gestures',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
  },
  {
    name: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  },
  {
    name: 'Objects',
    emojis: ['📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '📷', '📸', '📹', '🎥', '📽️', '🎬', '📺', '📻', '🎙️', '🎚️', '🎛️', '📞', '☎️', '📟', '📠', '📧', '📨', '📩', '📮', '📫', '📬', '📭', '📦', '📝', '📁', '📂', '🗂️', '📅', '📆', '🗒️', '🗓️', '📇', '📈', '📉', '📊', '📋'],
  },
  {
    name: 'Symbols',
    emojis: ['✅', '❌', '❓', '❗', '💯', '✨', '⭐', '🌟', '💫', '🔥', '💥', '💢', '💤', '💨', '💦', '🎉', '🎊', '🎈', '🎁', '🏆', '🏅', '🥇', '🥈', '🥉'],
  },
];

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="w-72 h-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
    >
      {/* Emoji Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {EMOJI_CATEGORIES.map((category) => (
          <div key={category.name} className="mb-3">
            <h4 className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-1">
              {category.name}
            </h4>
            <div className="grid grid-cols-8 gap-0.5">
              {category.emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onSelect(emoji)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
