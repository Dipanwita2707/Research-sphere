import { redirect } from 'next/navigation';

/**
 * Edit draft is handled by the same page as create: /noting/new.
 * This route redirects so old links and bookmarks still work.
 */
export default function EditDraftRedirectPage({ params }: { params: { id: string } }) {
  const id = params?.id;
  if (id) redirect(`/noting/new?draft=${encodeURIComponent(id)}`);
  redirect('/noting/new');
}
