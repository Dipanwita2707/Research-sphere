'use client';

import React from 'react';

/**
 * Minimal, safe markdown renderer. Builds React elements only (no HTML
 * injection). Supports: # / ## / ### headings, paragraphs, - / * / 1. lists,
 * > quotes, **bold**, *italic*, `code` and [links](https://…|mailto:…|/path).
 * Anything else is rendered as plain text.
 */

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${i++}`;
    if (match[2] || match[3]) {
      nodes.push(<strong key={key}>{match[2] || match[3]}</strong>);
    } else if (match[4] || match[5]) {
      nodes.push(<em key={key}>{match[4] || match[5]}</em>);
    } else if (match[6]) {
      nodes.push(
        <code key={key} className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[0.85em]">
          {match[6]}
        </code>,
      );
    } else if (match[7] && match[8]) {
      const href = match[8];
      if (SAFE_HREF.test(href)) {
        const external = /^https?:/i.test(href);
        nodes.push(
          <a
            key={key}
            href={href}
            className="text-wine dark:text-amber-400 underline underline-offset-2 hover:opacity-80"
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {match[7]}
          </a>,
        );
      } else {
        nodes.push(match[7]);
      }
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'hr' };

function parse(source: string): Block[] {
  const lines = (source || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ') });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      flushList();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ kind: 'h', level: heading[1].length, text: heading[2] });
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushPara();
      flushList();
      blocks.push({ kind: 'hr' });
      continue;
    }
    const ul = /^[-*+]\s+(.*)$/.exec(trimmed);
    const ol = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (ul || ol) {
      flushPara();
      const kind = ul ? 'ul' : 'ol';
      if (!list || list.kind !== kind) {
        flushList();
        list = { kind, items: [] };
      }
      list.items.push((ul || ol)![1]);
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      flushPara();
      flushList();
      blocks.push({ kind: 'quote', text: quote[1] });
      continue;
    }
    if (list) {
      // continuation of the previous list item
      const current = list as { kind: 'ul' | 'ol'; items: string[] };
      current.items[current.items.length - 1] += ` ${trimmed}`;
      continue;
    }
    para.push(trimmed);
  }
  flushPara();
  flushList();
  return blocks;
}

const headingClass: Record<number, string> = {
  1: 'text-xl font-bold mt-4 mb-2',
  2: 'text-lg font-semibold mt-4 mb-2',
  3: 'text-base font-semibold mt-3 mb-1.5',
  4: 'text-sm font-semibold mt-3 mb-1',
  5: 'text-sm font-semibold mt-2 mb-1',
  6: 'text-sm font-medium mt-2 mb-1',
};

export default function SafeMarkdown({ content, className = '' }: { content: string; className?: string }) {
  const blocks = parse(content);
  return (
    <div className={`text-sm leading-relaxed text-gray-700 dark:text-gray-300 ${className}`}>
      {blocks.map((b, idx) => {
        const key = `b${idx}`;
        switch (b.kind) {
          case 'h': {
            const Tag = `h${Math.min(b.level + 1, 6)}` as keyof JSX.IntrinsicElements;
            return (
              <Tag key={key} className={`${headingClass[b.level]} text-gray-900 dark:text-white`}>
                {renderInline(b.text, key)}
              </Tag>
            );
          }
          case 'ul':
            return (
              <ul key={key} className="list-disc pl-5 my-2 space-y-1">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `${key}-${j}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} className="list-decimal pl-5 my-2 space-y-1">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `${key}-${j}`)}</li>
                ))}
              </ol>
            );
          case 'quote':
            return (
              <blockquote key={key} className="border-l-4 border-wine/40 pl-3 my-2 italic text-gray-600 dark:text-gray-400">
                {renderInline(b.text, key)}
              </blockquote>
            );
          case 'hr':
            return <hr key={key} className="my-4 border-gray-200 dark:border-gray-700" />;
          default:
            return (
              <p key={key} className="my-2">
                {renderInline(b.text, key)}
              </p>
            );
        }
      })}
    </div>
  );
}
