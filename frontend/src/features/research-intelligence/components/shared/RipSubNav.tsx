'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRipAccess } from '../../hooks/useRipAccess';
import { visibleRipViews } from '../../utils/graphUtils';

/** Tabs across the Research Intelligence views the user can open. */
export function RipSubNav() {
  const pathname = usePathname() || '';
  const { data } = useRipAccess();
  const views = visibleRipViews(data);
  if (views.length < 2) return null;
  // Longest matching prefix wins, so /research/intelligence only matches itself.
  const active = views
    .filter((v) => pathname === v.href || (v.href !== '/research/intelligence' && pathname.startsWith(`${v.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav aria-label="Research Intelligence" className="mb-3 -mx-1 overflow-x-auto">
      <ul className="flex min-w-max items-center gap-1 px-1">
        {views.map((v) => {
          const current = active?.key === v.key;
          return (
            <li key={v.key}>
              <Link
                href={v.href}
                title={v.description}
                aria-current={current ? 'page' : undefined}
                className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 ${
                  current
                    ? 'bg-wine text-wine-fg shadow-sm'
                    : 'text-stone-600 hover:bg-white hover:text-stone-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
              >
                {v.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
