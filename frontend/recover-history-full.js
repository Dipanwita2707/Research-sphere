const fs = require('fs');
const path = require('path');

const historyDir = path.join(process.env.APPDATA, 'Code', 'User', 'History');

// Include both frontend and backend specific paths for all three modules
const targetPrefixes = [
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\app\\dsw',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\features\\dsw',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\backend\\src\\modules\\dsw',

    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\app\\noting',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\features\\noting-management',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\backend\\src\\modules\\noting',

    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\app\\events',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\features\\event-management',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\features\\events', // Alternative folder name
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\backend\\src\\modules\\event-management',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\backend\\src\\modules\\events' // Alternative folder name
];

// Target cutoff: 2026-02-26T15:35:00+05:30 (Just before the git restore was mistakenly run)
const cutoffTime = new Date('2026-02-26T15:35:00+05:30').getTime();
// Look back up to 24 hours just in case
const oldestAllowableTime = cutoffTime - (24 * 60 * 60 * 1000);

console.log("Deep Searching VS Code Local History for DSW, Noting & Events (Frontend + Backend)...");

if (!fs.existsSync(historyDir)) {
    console.log("Could not find VS Code history directory.");
    process.exit(1);
}

const folders = fs.readdirSync(historyDir);
let restoredCountFrontend = 0;
let restoredCountBackend = 0;

for (const folder of folders) {
    const folderPath = path.join(historyDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const entriesFile = path.join(folderPath, 'entries.json');
    if (!fs.existsSync(entriesFile)) continue;

    try {
        const entriesData = JSON.parse(fs.readFileSync(entriesFile, 'utf8'));
        let resourcePath = entriesData.resource;

        // Skip internal VS Code settings and non-file paths
        if (resourcePath.startsWith('vscode-userdata:')) continue;
        resourcePath = resourcePath.replace('file:///', '');
        resourcePath = decodeURIComponent(resourcePath).replace(/\//g, '\\');

        const lowerCasePath = resourcePath.toLowerCase();

        // Check if it belongs to any of our target frontend/backend modules
        const matchesTarget = targetPrefixes.some(prefix => lowerCasePath.startsWith(prefix));

        if (matchesTarget) {
            const entries = entriesData.entries || [];
            // Look for the most recent save BEFORE the git restore wiped it, but don't fetch extremely old history
            const validEntries = entries.filter(e => e.timestamp < cutoffTime && e.timestamp > oldestAllowableTime);

            if (validEntries.length > 0) {
                // Sort descending by timestamp so we get the most recent uncorrupted state
                validEntries.sort((a, b) => b.timestamp - a.timestamp);
                const latestEntry = validEntries[0];

                const backupFilePath = path.join(folderPath, latestEntry.id);
                if (fs.existsSync(backupFilePath)) {
                    console.log(`\nRestoring: ${resourcePath}`);
                    console.log(`-> Saved on: ${new Date(latestEntry.timestamp).toLocaleString()}`);

                    if (!fs.existsSync(path.dirname(resourcePath))) {
                        fs.mkdirSync(path.dirname(resourcePath), { recursive: true });
                    }

                    fs.copyFileSync(backupFilePath, resourcePath);

                    if (lowerCasePath.includes('\\frontend\\')) {
                        restoredCountFrontend++;
                    } else {
                        restoredCountBackend++;
                    }
                }
            }
        }
    } catch (e) {
        // silently skip non-JSON or corrupted entry files
    }
}

console.log(`\n✅ Deep Recovery Complete!`);
console.log(`Restored Frontend Files: ${restoredCountFrontend}`);
console.log(`Restored Backend Files:  ${restoredCountBackend}`);
console.log(`Total Files Restored:    ${restoredCountFrontend + restoredCountBackend}`);
