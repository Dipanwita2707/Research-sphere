'use client';

import React, { useMemo } from 'react';
import type { ChatSource } from '../../types';

type SourceMap = Map<number, ChatSource>;

const SAFE_URL = /^https?:\/\//i;

function Citation({ refs, sources }: { refs: number[]; sources: SourceMap }) {
  return (
    <span className="inline-flex gap-0.5 align-baseline">
      {refs.map((n) => {
        const s = sources.get(n);
        const tip = s ? (s.type === 'publication' ? `${s.title}${s.year ? ` (${s.year})` : ''}` : `${s.name}${s.department ? ` · ${s.department}` : ''}`) : undefined;
        return (
          <a
            key={n}
            href={`#src-${n}`}
            title={tip}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(`src-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }}
            className={`inline-flex items-center justify-center min-w-[1.25rem] h-[1.15rem] px-1 rounded-md text-[10.5px] font-semibold leading-none no-underline transition-colors ${
              s
                ? 'bg-brand-100/70 text-brand-700 hover:bg-brand-600 hover:text-white dark:bg-brand-600/25 dark:text-brand-200'
                : 'bg-slate-100 text-slate-500 dark:bg-white/10'
            }`}
          >
            {n}
          </a>
        );
      })}
    </span>
  );
}

function parseInline(text: string, sources: SourceMap): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\[\d+(?:\s*,\s*\d+)*\]|(?<![*\w])\*[^*\s][^*]*\*(?!\*))/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      out.push(<strong key={k++} className="font-semibold text-slate-900 dark:text-white">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('`')) {
      out.push(<code key={k++} className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 font-mono text-[12.5px]">{tok.slice(1, -1)}</code>);
    } else if (/^\[\d/.test(tok)) {
      out.push(<Citation key={k++} refs={tok.slice(1, -1).split(',').map((n) => Number(n.trim()))} sources={sources} />);
    } else if (tok.startsWith('[')) {
      const mm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (mm && SAFE_URL.test(mm[2])) {
        out.push(<a key={k++} href={mm[2]} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline underline-offset-2 hover:text-brand-700 dark:text-brand-300">{mm[1]}</a>);
      } else out.push(mm ? mm[1] : tok);
    } else if (tok.startsWith('*')) {
      out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const splitRow = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export function Markdown({ content, sources = [], streaming = false }: { content: string; sources?: ChatSource[]; streaming?: boolean }) {
  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.ref, s])), [sources]);

  const blocks = useMemo(() => {
    const lines = content.split('\n');
    const acc: React.ReactNode[] = [];
    let i = 0;
    let key = 0;
    const inline = (t: string) => parseInline(t, sourceMap);

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) {
        i++;
        continue;
      }

      if (trimmed.startsWith('```')) {
        const buf: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) buf.push(lines[i++]);
        i++;
        acc.push(<pre key={key++} className="my-3 p-3.5 rounded-xl overflow-x-auto bg-slate-950 text-slate-100 text-[12.5px] leading-relaxed font-mono">{buf.join('\n')}</pre>);
        continue;
      }

      if (trimmed.startsWith('|') && i + 1 < lines.length && /^\|?[\s:|-]+\|?$/.test(lines[i + 1].trim()) && lines[i + 1].includes('-')) {
        const header = splitRow(trimmed);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(splitRow(lines[i++]));
        acc.push(
          <div key={key++} className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-[13px]">
              <thead className="bg-brand-50 dark:bg-white/5">
                <tr>{header.map((h, hi) => <th key={hi} className="text-left px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-white/10 whitespace-nowrap">{inline(h)}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={ri} className="border-b border-slate-100 dark:border-white/5 last:border-0 even:bg-slate-50/50 dark:even:bg-white/[0.02]">
                    {r.map((c, ci) => <td key={ci} className="px-3 py-2 align-top text-slate-700 dark:text-slate-300">{inline(c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
      if (heading) {
        const level = heading[1].length;
        const cls = level <= 1 ? 'text-lg font-bold' : level === 2 ? 'text-[16px] font-semibold' : 'text-[15px] font-semibold';
        acc.push(<div key={key++} role="heading" aria-level={level} className={`${cls} text-slate-900 dark:text-white pt-3 pb-0.5`}>{inline(heading[2])}</div>);
        i++;
        continue;
      }

      if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
        acc.push(<hr key={key++} className="my-4 border-slate-200 dark:border-white/10" />);
        i++;
        continue;
      }

      if (trimmed.startsWith('>')) {
        const buf: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) buf.push(lines[i++].trim().replace(/^>\s?/, ''));
        acc.push(<blockquote key={key++} className="my-2 pl-3.5 border-l-2 border-brand-400 text-slate-600 dark:text-slate-400">{inline(buf.join(' '))}</blockquote>);
        continue;
      }

      if (/^([-*•]|\d+[.)])\s+/.test(trimmed)) {
        const ordered = /^\d/.test(trimmed);
        const items: { text: string; indent: number }[] = [];
        while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
          const indent = lines[i].match(/^\s*/)![0].length;
          items.push({ text: lines[i].trim().replace(/^([-*•]|\d+[.)])\s+/, ''), indent });
          i++;
        }
        const Tag = ordered ? 'ol' : 'ul';
        acc.push(
          <Tag key={key++} className={`my-2 space-y-1 pl-5 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-slate-400`}>
            {items.map((it, ii) => <li key={ii} style={it.indent ? { marginLeft: Math.min(it.indent, 8) * 6 } : undefined} className="pl-1">{inline(it.text)}</li>)}
          </Tag>
        );
        continue;
      }

      // Paragraph: merge consecutive plain lines.
      const buf: string[] = [trimmed];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|[-*•]\s|\d+[.)]\s|>|\||```)/.test(lines[i].trim())) buf.push(lines[i++].trim());
      acc.push(<p key={key++} className="my-2">{inline(buf.join(' '))}</p>);
    }
    return acc;
  }, [content, sourceMap]);

  return (
    <div className="text-[14.5px] leading-[1.7] text-slate-800 dark:text-slate-200 break-words">
      {blocks}
      {streaming && <span className="inline-block w-1.5 h-4 ml-0.5 -mb-0.5 bg-brand-600 animate-pulse rounded-sm" aria-hidden />}
    </div>
  );
}
