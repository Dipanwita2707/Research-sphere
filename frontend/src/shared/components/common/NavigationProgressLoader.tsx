'use client';

import dynamic from 'next/dynamic';

// `ssr: false` is only allowed inside a Client Component (Next 16), so the lazy import lives here
// and the server-rendered root layout renders this wrapper.
const NavigationProgress = dynamic(
  () => import('@/shared/components/common/NavigationProgress').then((mod) => mod.NavigationProgress),
  { ssr: false }
);

export default function NavigationProgressLoader() {
  return <NavigationProgress />;
}
