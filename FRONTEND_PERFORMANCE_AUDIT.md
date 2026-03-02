# Frontend Performance & Code Quality Audit

**Modules:** Noting, DSW (Division of Student Welfare), Event Management  
**Stack:** Next.js 14 (App Router) · React 18 · TanStack Query 5 · Zustand · Tailwind CSS  
**Date:** June 2025  
**Baseline:** Backend latency already optimized (617 ms cold / 70–105 ms cached)

---

## 1 · Root-Cause Summary

The 10–15 second perceived load times originate from **five compounding issues**:

| # | Root Cause | Impact | Modules |
|---|-----------|--------|---------|
| RC-1 | **Event pages bypass TanStack Query** — raw `useEffect` + `useState` with no caching, deduplication, or background refetch | Every navigation re-fetches from scratch; no cache hits | Events (`[id]/page.tsx`, `my-events/page.tsx`) |
| RC-2 | **No cross-tab prefetching** — active tab fetches, inactive tabs wait until clicked | Users experience a fresh cold-start on every tab switch | Noting (list vs copies), DSW (clubs vs my-clubs) |
| RC-3 | **Monster single-file pages** — `noting/[id]/page.tsx` (3 592 lines), `events/[id]/page.tsx` (1 987 lines) ship as single client bundles | Large JS parse + hydration time; all code downloaded even when user only sees top fold | Noting, Events |
| RC-4 | **30 s Axios timeout as default floor** — Axios `timeout: 30000` on every service call, plus 30 s global default | Slow requests never fail fast; the spinner hangs for half a minute before the user sees an error | All three |
| RC-5 | **No `Suspense` / streaming** — all layouts are `"use client"` with no server components; `loading.tsx` skeleton only shows on first hard navigation, not on client-side transitions | React can't stream HTML; the waterfall is fully client-side | All three |

---

## 2 · Performance Findings & Evidence

### 2.1 Event Management — Manual Fetch Anti-Pattern (CRITICAL)

**File:** `src/app/events/[id]/page.tsx` (lines 139–200)

```tsx
// ❌ CURRENT — raw useEffect, zero caching
const [event, setEvent] = useState<Event | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  if (id) fetchEvent();          // fires on EVERY mount
}, [id]);

const fetchEvent = async () => {
  setLoading(true);
  const data = await eventService.getEventById(id);  // 30 s timeout
  setEvent(data);
  setLoading(false);
};
```

**Impact:**
- Every back-navigation re-fetches the entire event.
- Rapid route changes (list → detail → back → different detail) stack up concurrent requests with no cancellation.
- User reads `localStorage` directly for auth instead of `useAuthStore()` (lines 155–180).

**File:** `src/app/events/my-events/page.tsx` (lines 37–57)

```tsx
// ❌ CURRENT — fetches ALL events (limit 100) in useEffect, no caching
const fetchEvents = async () => {
  setLoading(true);
  const result = await eventService.getEvents({ myEvents: true }, 1, 100);
  setAllEvents(result.events);
  setLoading(false);
};

useEffect(() => { fetchEvents(); }, []);
```

**Impact:**
- Fetches up to 100 events with no pagination, no caching, no stale-while-revalidate.
- Tab re-visits always show the spinner.

### 2.2 Noting Detail — 3 592-line Monolith (HIGH)

**File:** `src/app/noting/[id]/page.tsx`

- ~30 `useState` hooks.
- Multiple `useEffect` hooks for sequential dependent fetches (permissions, copies, note data).
- All conditional rendering (festival panels, club panels, event panels, stall config, prizes, approval trail, copy escalation UI) is in one flat file.
- Every line ships in the client bundle — no code splitting, no `React.lazy()`.

**Estimated JS parse time:** ~200–400 ms on a mid-range mobile device for this file alone.

### 2.3 QueryClient — Missing `gcTime` Default (MEDIUM)

**File:** `src/shared/providers/QueryProvider.tsx` (lines 7–16)

```tsx
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,  // ✅ good
      retry: 1,
      // ❌ no gcTime — defaults to 5 min; acceptable but
      //    individual hooks should set higher for static data
    },
  },
})
```

The global config is reasonable, but there is **no `refetchOnWindowFocus: false`**. On flaky networks (common in university WiFi), every Alt-Tab triggers a refetch storm across _all_ active queries.

### 2.4 Missing `select` Transforms (MEDIUM)

**File:** `src/features/dsw/hooks/index.ts` — `useClubs()` (line 56)

```tsx
export function useClubs(filters?: ClubFilters) {
  return useQuery({
    queryKey: DSW_QUERY_KEYS.clubs(filters),
    queryFn: () => dswAPI.clubs.getClubs(filters),
    staleTime: 1000 * 60 * 5,
    // ❌ no `select` — UI re-renders even when the data it cares about hasn't changed
  });
}
```

Without a `select` function, downstream components re-render whenever _any_ field in the response changes, even fields they don't display.

### 2.5 Bundle Impact — Heavy Dependencies (MEDIUM)

**File:** `frontend/package.json`

| Dep | Approx Size (gzipped) | Usage |
|-----|----------------------|-------|
| `@mui/material` + `@emotion/*` | ~90 KB | Only used for DateTimePicker in noting event form |
| `recharts` | ~45 KB | Statistics page only |
| `react-quill` | ~40 KB | Description editor in noting new page only |
| `html2canvas` | ~30 KB | QR pass generator only |
| `framer-motion` | ~30 KB | Unknown (not found in the 3 audited modules) |

These are imported statically — they end up in the initial bundle even on pages that never use them.

---

## 3 · TanStack Query Optimizations

### 3.1 Convert Event Pages to TanStack Query (CRITICAL)

| Page | Current | Recommended |
|------|---------|-------------|
| `events/[id]/page.tsx` | `useEffect` + `useState` | `useEvent(id)` hook (already exists!) |
| `events/my-events/page.tsx` | `useEffect` + `useState` | New `useMyCreatedEvents()` hook |

**Before — `events/[id]/page.tsx`:**
```tsx
const [event, setEvent] = useState<Event | null>(null);
const [loading, setLoading] = useState(true);
useEffect(() => { fetchEvent(); }, [id]);
```

**After:**
```tsx
import { useEvent } from '@/features/event-management/hooks/useEvents';

const { data: event, isLoading: loading } = useEvent(id);
```

This single change gives you: caching, background refetch, deduplication, `placeholderData`, and zero manual state management.

**New hook for my-events:**
```tsx
// src/features/event-management/hooks/useEvents.ts — add:
export function useMyCreatedEvents() {
  return useQuery({
    queryKey: ['events', 'my-created'],
    queryFn: () => eventService.getEvents({ myEvents: true }, 1, 100),
    staleTime: 2 * 60 * 1000,
    select: (data) => data.events,
  });
}
```

### 3.2 Add Prefetching on Hover / Tab Pre-Warming (HIGH)

**Noting list page already does this well:**

```tsx
// src/app/noting/page.tsx — line ~870
onMouseEnter={() => {
  queryClient.prefetchQuery({
    queryKey: NOTING_QUERY_KEYS.detail(note.id),
    queryFn: () => notingService.getById(note.id),
    staleTime: 2 * 60 * 1000,
  });
}}
```

**Events list page does NOT do this.** Add to `events/page.tsx`:

```tsx
<Link
  href={`/events/${event.id}`}
  onMouseEnter={() => {
    queryClient.prefetchQuery({
      queryKey: EVENT_QUERY_KEYS.detail(event.id),
      queryFn: () => eventService.getEventById(event.id),
      staleTime: 2 * 60 * 1000,
    });
  }}
>
```

**DSW already does hover-prefetch** on the dashboard quick action cards (good).

### 3.3 Background Tab Prefetching (Noting List Page)

The Noting list page fetches only the active tab. When switching from "My Notes" to "Copies for Me", the user waits 2+ seconds. Prefetch inactive tabs in the background:

```tsx
// src/app/noting/page.tsx — add after the main list query:
const queryClient = useQueryClient();

// Prefetch the copies tab in the background when "mine" tab is active
useEffect(() => {
  if (filter !== 'copies' && user) {
    queryClient.prefetchQuery({
      queryKey: NOTING_QUERY_KEYS.myCopies(1, PAGE_SIZE),
      queryFn: () => notingService.getMyCopies({ page: 1, limit: PAGE_SIZE }),
      staleTime: 2 * 60 * 1000,
    });
  }
}, [filter, user, queryClient]);
```

### 3.4 Disable `refetchOnWindowFocus` Globally

```tsx
// src/shared/providers/QueryProvider.tsx
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,  // ← add this
    },
  },
})
```

This eliminates the refetch storm on every Alt-Tab, which is especially important on slow university WiFi.

---

## 4 · Next.js-Specific Issues

### 4.1 All Layouts Are Client Components (HIGH)

Every `layout.tsx` is `"use client"`:

```tsx
// src/app/noting/layout.tsx, dsw/layout.tsx, events/layout.tsx — identical
'use client';
import AuthenticatedLayout from '@/shared/layouts/AuthenticatedLayout';
export default function Layout({ children }) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
```

This forces the **entire page tree** into client rendering. The `loading.tsx` skeletons (which are server components) only work on the initial hard navigation — not on client-side `router.push()`.

**Recommendation:** Keep `AuthenticatedLayout` as client component but make the layout wrapper a server component that wraps children with `<Suspense>`:

```tsx
// src/app/noting/layout.tsx — IMPROVED
import AuthenticatedLayout from '@/shared/layouts/AuthenticatedLayout';
import { Suspense } from 'react';
import NotingLoading from './loading';

export default function NotingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthenticatedLayout>
      <Suspense fallback={<NotingLoading />}>
        {children}
      </Suspense>
    </AuthenticatedLayout>
  );
}
```

### 4.2 No Dynamic Imports for Heavy Components

The 3 592-line noting detail page and the 1 987-line event detail page are loaded as single chunks.

**Recommendation:** Split rarely-seen sections with `next/dynamic`:

```tsx
import dynamic from 'next/dynamic';

const CopyEscalationSection = dynamic(
  () => import('./components/CopyEscalationSection'),
  { ssr: false }
);

const FestivalDetailsPanel = dynamic(
  () => import('./components/FestivalDetailsPanel'),
  { ssr: false }
);
```

### 4.3 Heavy Library Dynamic Imports

MUI DateTimePicker, react-quill, recharts, and html2canvas should be dynamically imported:

```tsx
// Instead of:
import { DateTimePicker } from '@mui/x-date-pickers';

// Use:
const DateTimePicker = dynamic(
  () => import('@mui/x-date-pickers').then(m => m.DateTimePicker),
  { ssr: false, loading: () => <Skeleton className="h-10 w-full" /> }
);
```

### 4.4 Missing `next.config.js` Optimizations

```js
// next.config.js — add:
const nextConfig = {
  // ... existing config ...
  
  // Tree-shake MUI to only import used components
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },

  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@mui/material', 'recharts'],
  },
};
```

---

## 5 · Code Quality Issues

### 5.1 Duplicated Constants (MEDIUM)

`EVENT_TYPE_LABELS` and `STATUS_CONFIG` are defined inline in 3+ files:
- `src/app/events/[id]/page.tsx` (lines 52–96)
- `src/app/events/my-events/page.tsx` (lines 12–30)
- `src/app/events/page.tsx` (imports from `features/event-management/constants`)

**Fix:** Use the existing `features/event-management/constants` everywhere. Delete inline copies.

### 5.2 Direct `localStorage` Access Instead of Store (MEDIUM)

**File:** `src/app/events/[id]/page.tsx` (lines 155–180)

```tsx
// ❌ Reads auth from localStorage directly
const authStr = localStorage.getItem("auth-storage");
const auth = JSON.parse(authStr);
const user = auth?.state?.user;
setCurrentUserId(user?.id ?? null);
```

**Fix:** Use `useAuthStore()` — the Zustand store already persists to the same key:

```tsx
const { user } = useAuthStore();
const currentUserId = user?.id ?? null;
```

### 5.3 `useApi` Hook — Legacy Pattern Coexisting with TanStack Query (LOW)

**File:** `src/shared/hooks/useApi.ts`

This 170-line custom hook reimplements what TanStack Query already provides (loading state, error state, caching, abort). It's **not used** by any of the three audited modules (they all use TanStack Query), but it adds dead code to the bundle if tree-shaking doesn't eliminate it.

**Recommendation:** Mark as `@deprecated`, migrate remaining consumers, then remove.

### 5.4 Unused `usePagination` Hook (LOW)

**File:** `src/shared/hooks/usePagination.ts`

A 120-line hook that manages pagination state — but all three audited modules use either URL-based pagination (noting) or simple `useState` for `page`. Consider removing or consolidating.

### 5.5 ThemeProvider Blocks First Render (LOW)

**File:** `src/shared/providers/ThemeProvider.tsx` (lines 29–31)

```tsx
if (!mounted) {
  return null;  // ← returns nothing until useEffect fires
}
```

This causes a flash of blank screen on first load. Use `suppressHydrationWarning` + inline script instead.

---

## 6 · Architecture Improvements

### 6.1 Split Monster Pages into Compositions (HIGH)

**Target:** `noting/[id]/page.tsx` (3 592 lines) → ~8 focused components

```
noting/[id]/
├── page.tsx              (~200 lines — shell, data fetching, routing)
├── components/
│   ├── NoteHeader.tsx     (~80 lines — status badge, ID, dates)
│   ├── NoteDescription.tsx (~60 lines — HTML content)
│   ├── ClubCreationPanel.tsx (~150 lines — club-specific details)
│   ├── EventDetailsPanel.tsx (~200 lines — event/venue/stall/festival)
│   ├── ApprovalTimeline.tsx  (~150 lines — history trail)
│   ├── ApprovalActions.tsx   (~200 lines — approve/reject/forward buttons)
│   ├── CopySharingSection.tsx (~300 lines — send copy, escalation)
│   └── AttachmentsSection.tsx (~80 lines — file list + download)
```

**Target:** `events/[id]/page.tsx` (1 987 lines) → ~6 components

### 6.2 Extract Shared `<EventCard />` Component (MEDIUM)

Both `events/page.tsx` and `events/my-events/page.tsx` render event cards with nearly identical markup. Extract to:

```tsx
// src/features/event-management/components/EventCard.tsx
export function EventCard({ event, showDraftChecklist = false }: Props) { ... }
```

### 6.3 Centralize Auth Access Pattern (MEDIUM)

Replace all 3 patterns currently in use:
1. `useAuthStore()` (correct — Noting uses this)
2. `localStorage.getItem('auth-storage')` (wrong — Events detail page)
3. Implicit from cookie (not used in these modules)

Standardize on `useAuthStore()` everywhere.

---

## 7 · Caching Strategy

### Current State

| Data | staleTime | gcTime | Cache Key | Module |
|------|-----------|--------|-----------|--------|
| Noting list | 1 min | 5 min (default) | `['noting','list',{params}]` | Noting |
| Note detail | 2 min | 5 min | `['noting', id]` | Noting |
| My copies | 2 min | 5 min | `['noting','my-copies',{page,limit}]` | Noting |
| Noting config | 24 hr | 24 hr | `['noting','config']` | Noting |
| Noting permissions | 5 min | 10 min | `['noting','permissions']` | Noting |
| DSW clubs | 5 min | 5 min | `['dsw','clubs',filters]` | DSW |
| DSW categories | 1 hr | 5 min | `['dsw','categories']` | DSW |
| DSW statistics | 5 min | 5 min | `['dsw','statistics']` | DSW |
| Events list | 2 min | 5 min | `['events','list',filters,page,limit]` | Events |
| Event detail | 2 min | 5 min | `['events', id]` | Events |
| Event settings | 30 s | 5 min | `['events',id,'settings']` | Events |
| Hierarchy data | 10 min | 30 min | `['events','hierarchy']` | Events |

### Recommended Changes

| Data | Current | Recommended | Rationale |
|------|---------|-------------|-----------|
| DSW categories | `gcTime: default (5min)` | `gcTime: 60 * 60 * 1000` | Categories almost never change; keep in memory for the session |
| Event detail | **Not cached (useEffect)** | `staleTime: 2min, gcTime: 10min` | Must migrate to `useEvent()` hook first |
| My created events | **Not cached (useEffect)** | `staleTime: 2min` | New `useMyCreatedEvents()` hook |
| Noting permissions | 5 min / 10 min | ✅ Good as-is | Permissions rarely change |
| Event settings | 30 s | ✅ Good (real-time admin panel) | Needs fast refresh |

### Computed Data Caching via `select`

Add `select` transforms to avoid re-renders from unchanged slices:

```tsx
// Only extract the events array — ignore pagination metadata changes
export function useMyCreatedEvents() {
  return useQuery({
    queryKey: ['events', 'my-created'],
    queryFn: () => eventService.getEvents({ myEvents: true }, 1, 100),
    staleTime: 2 * 60 * 1000,
    select: (data) => data.events,  // referential stability for the array
  });
}
```

---

## 8 · Prioritized Action Plan

### P0 — Critical (1–2 day effort, biggest impact)

| # | Task | File(s) | Expected Speedup |
|---|------|---------|-----------------|
| 1 | **Migrate event detail to `useEvent()` hook** | `events/[id]/page.tsx` | Eliminates ~2–4 s on back-navigation (cache hit) |
| 2 | **Create `useMyCreatedEvents()` hook, replace `useEffect`** | `events/my-events/page.tsx`, `useEvents.ts` | Eliminates ~2–4 s on tab revisit |
| 3 | **Add `refetchOnWindowFocus: false`** to QueryProvider | `QueryProvider.tsx` | Stops refetch storms on Alt-Tab |
| 4 | **Add hover-prefetch to events list cards** | `events/page.tsx` | Detail page loads instantly on click |

### P1 — High (2–3 day effort)

| # | Task | File(s) | Expected Speedup |
|---|------|---------|-----------------|
| 5 | **Split `noting/[id]/page.tsx` into 8 components** | New component files | Faster parse/hydration, enables lazy loading |
| 6 | **Split `events/[id]/page.tsx` into 6 components** | New component files | Same as above |
| 7 | **Add background prefetch for inactive tabs** | `noting/page.tsx` | Copies tab loads instantly when clicked |
| 8 | **Dynamic import MUI/recharts/react-quill** | Various form pages | ~130 KB off initial bundle |

### P2 — Medium (1–2 day effort)

| # | Task | File(s) | Expected Speedup |
|---|------|---------|-----------------|
| 9 | **Delete duplicated constants** | `events/[id]/page.tsx`, `my-events/page.tsx` | Cleaner code, smaller bundle |
| 10 | **Replace `localStorage.getItem` with `useAuthStore()`** | `events/[id]/page.tsx` | Correctness + consistency |
| 11 | **Add `gcTime` to DSW categories** | `dsw/hooks/index.ts` | Category data stays cached all session |
| 12 | **Add `select` to `useClubs`, `useMyClubs`** | `dsw/hooks/index.ts` | Fewer unnecessary re-renders |
| 13 | **Add `optimizePackageImports` to next.config.js** | `next.config.js` | Automatic tree-shaking for lucide-react |

### P3 — Low (nice-to-have)

| # | Task | File(s) |
|---|------|---------|
| 14 | Deprecate + remove `useApi` hook | `shared/hooks/useApi.ts` |
| 15 | Fix ThemeProvider flash-of-blank | `ThemeProvider.tsx` |
| 16 | Add `<Suspense>` wrappers in layouts | All `layout.tsx` files |
| 17 | Investigate/remove `framer-motion` if unused | `package.json` |

---

## 9 · Example Optimized Flow — Event Detail Page

### Current Flow (10–15 s perceived)

```
User clicks event card
  → Client-side navigation starts
  → events/[id]/page.tsx JavaScript downloaded (1987 lines, ~60 KB)
  → Component mounts, shows <PageSkeleton> spinner
  → useEffect fires → eventService.getEventById(id) → 30s timeout
  → API call hits backend (~600 ms cold)
  → Response arrives → setState(event) → re-render
  → useEffect fires → localStorage.getItem('auth-storage') → parse → setState
  → Another re-render
  → Page visible
  
Total: ~1.5 s JS parse + 600 ms API + multiple re-render cycles
On slow network: 3-5 s minimum, up to 30 s if timeout hit
```

### Optimized Flow (<500 ms perceived)

```
User hovers over event card
  → queryClient.prefetchQuery fires → data cached from backend (~600 ms, in background)

User clicks event card
  → Client-side navigation starts  
  → <Suspense fallback={<Loading />}> shows skeleton immediately
  → events/[id]/page.tsx code-split into 6 lazy chunks
  → Main shell (~200 lines) loads immediately
  → useEvent(id) resolves INSTANTLY from prefetch cache
  → useAuthStore() resolves INSTANTLY from Zustand persisted state
  → Page visible with real data
  → Lazy chunks for FAQ accordion, prize section, etc. load in background

Total: ~100 ms from click to data (cache hit) + ~200 ms render
Worst case (no prefetch): 600 ms API + 200 ms render = 800 ms
```

### Implementation (events/[id]/page.tsx)

```tsx
"use client";

import { useParams } from "next/navigation";
import { useEvent } from "@/features/event-management/hooks/useEvents";
import { useAuthStore } from "@/shared/auth/authStore";
import { PageSkeleton } from "@/shared/components/PageSkeleton";
import dynamic from "next/dynamic";

// Lazy-load sub-sections
const EventHero = dynamic(() => import("./components/EventHero"));
const EventAbout = dynamic(() => import("./components/EventAbout"));
const EventPrizes = dynamic(() => import("./components/EventPrizes"), { ssr: false });
const EventFAQ = dynamic(() => import("./components/EventFAQ"), { ssr: false });
const EventSidebar = dynamic(() => import("./components/EventSidebar"));

export default function EventDetailPage() {
  const { id } = useParams() as { id: string };
  const { user } = useAuthStore();
  const { data: event, isLoading } = useEvent(id);

  if (isLoading || !event) return <PageSkeleton />;

  const isCreator = event.createdBy?.id === user?.id;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <EventHero event={event} isCreator={isCreator} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        <div className="lg:col-span-8 space-y-6">
          <EventAbout event={event} />
          {event.prizes?.length > 0 && <EventPrizes prizes={event.prizes} />}
          {event.faqs?.length > 0 && <EventFAQ faqs={event.faqs} />}
        </div>
        <div className="lg:col-span-4">
          <EventSidebar event={event} currentUserId={user?.id} />
        </div>
      </div>
    </div>
  );
}
```

**Line count: 35 lines** vs current 1 987 lines. Same features, but:
- ✅ Cache-first data loading via `useEvent()`  
- ✅ Auth from Zustand (no `localStorage.getItem`)  
- ✅ Code-split sub-sections (prizes, FAQs load lazily)  
- ✅ Single render cycle (no cascading `setState` calls)

---

## Summary

| Category | Issues Found | Critical | High | Medium | Low |
|----------|-------------|----------|------|--------|-----|
| Data Fetching | 4 | 2 | 1 | 1 | 0 |
| Bundle / Code Splitting | 3 | 0 | 2 | 1 | 0 |
| TanStack Query Config | 3 | 1 | 1 | 1 | 0 |
| Code Quality | 5 | 0 | 0 | 3 | 2 |
| Next.js Architecture | 3 | 0 | 1 | 1 | 1 |
| **Total** | **18** | **3** | **5** | **7** | **3** |

**Estimated impact of P0 fixes alone:** 60–80% reduction in perceived load time for Event Management pages, 30–40% for Noting tab switches.
