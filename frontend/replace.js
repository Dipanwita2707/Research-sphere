const fs = require('fs');
const path = require('path');

const DIRECTORIES = [
    'c:/Users/anwee/Desktop_1/Learning-Season/SGT_1v/Sgt-Ums/frontend/src/app/noting',
    'c:/Users/anwee/Desktop_1/Learning-Season/SGT_1v/Sgt-Ums/frontend/src/app/events',
    'c:/Users/anwee/Desktop_1/Learning-Season/SGT_1v/Sgt-Ums/frontend/src/features/noting-management',
    'c:/Users/anwee/Desktop_1/Learning-Season/SGT_1v/Sgt-Ums/frontend/src/features/events'
];

function processDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            replaceInFile(fullPath);
        }
    }
}

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    if (content.includes('LoadingSpinner')) {
        content = content.replace(/import \{[^}]*LoadingSpinner[^}]*\} from ["']@\/shared\/components\/LoadingSpinner["'];/g, 'import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";');
        content = content.replace(/import LoadingSpinner from ["']@\/shared\/components\/LoadingSpinner["'];/g, 'import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";');

        // Also handle generic imports from @/shared
        // E.g., import { Toast, LoadingSpinner } from "@/shared/ui-components"
        content = content.replace(/LoadingSpinner\s*,?\s*/g, '');
        if (!content.includes('@/components/skeletons') && originalContent.includes('LoadingSpinner')) {
            // add import to top
            const importMatch = content.match(/^import.*?;/m);
            if (importMatch) {
                content = content.replace(importMatch[0], importMatch[0] + '\nimport { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";');
            } else {
                content = 'import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";\n' + content;
            }
        }

        // Replace actual components
        content = content.replace(/<LoadingSpinner[^>]*size=["']sm["'][^>]*className=["']([^"']+)["'][^>]*\/>/gs, '<Skeleton className="$1 rounded-sm" />');
        content = content.replace(/<LoadingSpinner[^>]*className=["']([^"']+)["'][^>]*size=["']sm["'][^>]*\/>/gs, '<Skeleton className="$1 rounded-sm" />');
        content = content.replace(/<LoadingSpinner[^>]*size=["']sm["'][^>]*\/>/gs, '<Skeleton className="w-4 h-4 rounded-sm" />');

        content = content.replace(/<LoadingSpinner[^>]*size=["']md["'][^>]*className=["']([^"']+)["'][^>]*\/>/gs, '<Skeleton className="$1 rounded-sm" />');
        content = content.replace(/<LoadingSpinner[^>]*size=["']md["'][^>]*\/>/gs, '<Skeleton className="w-6 h-6 rounded-full" />');

        content = content.replace(/<LoadingSpinner[^>]*size=["']lg["'][^>]*className=["']([^"']+)["'][^>]*\/>/gs, '<div className="flex justify-center w-full"><CardSkeleton className="w-full max-w-sm" /></div>');
        content = content.replace(/<LoadingSpinner[^>]*size=["']lg["'][^>]*\/>/gs, '<div className="flex justify-center w-full"><CardSkeleton className="w-full max-w-sm" /></div>');

        content = content.replace(/<LoadingSpinner[^>]*className=["']([^"']+)["'][^>]*\/>/gs, '<Skeleton className="$1 rounded-sm" />');
        content = content.replace(/<LoadingSpinner[^>]*\/>/gs, '<Skeleton className="w-5 h-5 rounded-full" />');

        // Clean up empty imports
        content = content.replace(/import \{\s*\} from ["'][^"']+["'];\n/g, '');

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Updated: ' + filePath);
        }
    }
}

DIRECTORIES.forEach(dir => processDirectory(dir));
console.log('Done.');
