const fs = require('fs');
const files = [
    'src/app/events/[id]/volunteers_redirect/page.tsx',
    'src/app/events/[id]/volunteers/page.tsx',
    'src/app/events/[id]/statistics_old/page.tsx',
    'src/app/events/[id]/statistics/page.tsx',
    'src/app/events/[id]/management/page.tsx',
    'src/app/events/[id]/manage/registration-settings/page.tsx'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;

    // Ensure import exists if we update anything
    if (content.includes('Loader2') && content.includes('animate-spin')) {
        if (!content.includes('@/components/skeletons')) {
            const importMatch = content.match(/^import.*?;/m);
            if (importMatch) {
                content = content.replace(importMatch[0], importMatch[0] + '\nimport { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";');
            } else {
                content = 'import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";\n' + content;
            }
        }
    }

    // Large centered loaders
    content = content.replace(/<Loader2 className="w-12 h-12 animate-spin[^"]*" \/>/g, '<CardSkeleton className="w-full max-w-sm mx-auto mb-4" />');
    content = content.replace(/<Loader2 className="w-8 h-8 animate-spin[^"]*" \/>/g, '<CardSkeleton className="w-full max-w-sm mx-auto mb-4" />');

    // Small button/inline loaders
    content = content.replace(/<Loader2 className="w-5 h-5 animate-spin[^"]*" \/>/g, '<Skeleton className="w-5 h-5 rounded-full" />');
    content = content.replace(/<Loader2 className="w-4 h-4 animate-spin[^"]*" \/>/g, '<Skeleton className="w-4 h-4 rounded-full" />');

    // Also remove unused Loader2 from lucide-react if no longer used. Actually we'll let TS complain if it's unused, or just leave it.

    if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed ' + file);
    }
}
console.log('Loader2 Replace Done!');
