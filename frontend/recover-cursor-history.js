const fs = require('fs');
const path = require('path');

// Extract ONLY from Cursor history
const cursorHistoryDir = path.join(process.env.APPDATA, 'Cursor', 'User', 'History');

const targetPrefixes = [
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\app\\dsw',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\features\\dsw',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\backend\\src\\modules\\dsw',

    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\app\\noting',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\features\\noting-management',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\backend\\src\\modules\\noting',

    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\app\\events',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\features\\event-management',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\features\\events',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\backend\\src\\modules\\event-management',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\backend\\src\\modules\\events'
];

// Reverting to ONLY extract files just before the catastrophic `git restore` event 
// to prevent older partial saves from ruining currently working components.
const cutoffTime = new Date('2026-02-26T15:35:00+05:30').getTime();

console.log("Searching ONLY Cursor Local History...");

if (!fs.existsSync(cursorHistoryDir)) {
    console.log("Could not find Cursor history directory. Perhaps you haven't used it or the path is different.");
    process.exit(0);
}

const folders = fs.readdirSync(cursorHistoryDir);
let cursorRestored = 0;

for (const folder of folders) {
    const folderPath = path.join(cursorHistoryDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const entriesFile = path.join(folderPath, 'entries.json');
    if (!fs.existsSync(entriesFile)) continue;

    try {
        const entriesData = JSON.parse(fs.readFileSync(entriesFile, 'utf8'));
        let resourcePath = entriesData.resource;

        // Skip Cursor settings files
        if (resourcePath.startsWith('cursor-userdata:')) continue;

        resourcePath = resourcePath.replace('file:///', '');
        resourcePath = decodeURIComponent(resourcePath).replace(/\//g, '\\');

        const lowerCasePath = resourcePath.toLowerCase();

        // Only target files in our DSW, Noting, or Event-Management locations
        const matchesTarget = targetPrefixes.some(prefix => lowerCasePath.startsWith(prefix));

        if (matchesTarget) {
            const entries = entriesData.entries || [];
            const validEntries = entries.filter(e => e.timestamp < cutoffTime);

            if (validEntries.length > 0) {
                // Sort descending to grab the very last uncorrupted save state
                validEntries.sort((a, b) => b.timestamp - a.timestamp);
                const latestEntry = validEntries[0];
                const backupFilePath = path.join(folderPath, latestEntry.id);

                if (fs.existsSync(backupFilePath)) {
                    console.log(`\nRestoring from Cursor: ${resourcePath}`);
                    console.log(`-> Saved on: ${new Date(latestEntry.timestamp).toLocaleString()}`);

                    if (!fs.existsSync(path.dirname(resourcePath))) {
                        fs.mkdirSync(path.dirname(resourcePath), { recursive: true });
                    }

                    // Re-write directly into the main repository source as requested
                    fs.copyFileSync(backupFilePath, resourcePath);
                    cursorRestored++;
                }
            }
        }
    } catch (e) {
        // Ignore inaccessible files
    }
}

console.log(`\n✅ Cursor Recovery Complete!`);
console.log(`Total Files Restored straight into codebase: ${cursorRestored}`);
