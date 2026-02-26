const fs = require('fs');
const files = [
    'src/app/noting/[id]/page.tsx',
    'src/app/noting/[id]/edit/page.tsx',
    'src/app/noting/page.tsx',
    'src/app/noting/new/page.tsx',
    'src/app/events/[id]/volunteers/[volunteerId]/page.tsx',
    'src/app/events/[id]/scan/page.tsx',
    'src/app/events/[id]/registration/team/page.tsx',
    'src/app/events/[id]/registration/page.tsx',
    'src/app/events/[id]/manage/page.tsx',
    'src/app/events/volunteer/[id]/page.tsx',
    'src/app/events/volunteer/activity/page.tsx',
    'src/app/events/page.tsx',
    'src/app/events/registrations/page.tsx'
];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/import \{ LoadingSpinner \} from '@\/shared\/components\/LoadingSpinner';/g, 'import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";');

    // Custom replaces
    content = content.replace(/<LoadingSpinner size="sm" className="w-3 h-3" \/>/g, '<Skeleton className="w-3 h-3 rounded-sm" />');
    content = content.replace(/<LoadingSpinner size="sm" className="absolute right-2\.5 top-1\/2 -translate-y-1\/2 w-3\.5 h-3\.5 !border-gray-400" \/>/g, '<Skeleton className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-sm" />');
    content = content.replace(/<LoadingSpinner size="sm" className="w-3\.5 h-3\.5" \/>/g, '<Skeleton className="w-3.5 h-3.5 rounded-sm" />');
    content = content.replace(/<LoadingSpinner size="sm" \/>/g, '<Skeleton className="w-4 h-4 rounded-sm" />');

    content = content.replace(/<LoadingSpinner size="md" className="!border-indigo-600" \/>/g, '<Skeleton className="w-8 h-8 rounded-sm" />');
    content = content.replace(/<LoadingSpinner size="md" className="!border-sgt-600" \/>/g, '<Skeleton className="w-8 h-8 rounded-sm" />');

    content = content.replace(/<LoadingSpinner size="lg" className="mx-auto mb-3" \/>/g, '<CardSkeleton className="max-w-sm mx-auto mb-3" />');
    content = content.replace(/<LoadingSpinner size="lg" \/>/g, '<CardSkeleton className="w-full max-w-sm" />');
    content = content.replace(/<LoadingSpinner size="lg" className="!border-gray-300" \/>/g, '<CardSkeleton className="w-full max-w-sm" />');

    content = content.replace(/<LoadingSpinner \/>/g, '<Skeleton className="w-5 h-5 rounded-sm" />');

    fs.writeFileSync(file, content, 'utf8');
}
console.log('Safe Replace Done!');
