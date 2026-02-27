const fs = require('fs');
const path = require('path');

// Target the Timeline extension storage mechanism (Antigravity timeline storage if applicable via Code data)
// Since Antigravity modifies files and VS Code syncs it into timeline, sometimes it is located in global Storage
const vscodeHistoryDir = path.join(process.env.APPDATA, 'Code', 'User', 'History');
const cursorHistoryDir = path.join(process.env.APPDATA, 'Cursor', 'User', 'History');

// Checking specifically for the Antigravity extension timeline folder (if isolated) or 
// global workspace storage timeline.
const globalStorageDir = path.join(process.env.APPDATA, 'Code', 'User', 'workspaceStorage');
const antigravityLocalPaths = [
    path.join(process.env.APPDATA, 'antigravity', 'User', 'History'),
    path.join(process.env.USERPROFILE, '.gemini', 'antigravity', 'history')
];

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

const cutoffTime = new Date('2026-02-26T15:35:00+05:30').getTime();

function recoverFromHistoryDir(historyDir, sourceName) {
    if (!fs.existsSync(historyDir)) return 0;

    let restored = 0;
    const folders = fs.readdirSync(historyDir);

    for (const folder of folders) {
        const folderPath = path.join(historyDir, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;

        const entriesFile = path.join(folderPath, 'entries.json');
        if (!fs.existsSync(entriesFile)) continue;

        try {
            const entriesData = JSON.parse(fs.readFileSync(entriesFile, 'utf8'));
            let resourcePath = entriesData.resource;

            if (resourcePath.includes('userdata:')) continue;

            resourcePath = resourcePath.replace('file:///', '');
            resourcePath = decodeURIComponent(resourcePath).replace(/\//g, '\\');
            const lowerCasePath = resourcePath.toLowerCase();

            const matchesTarget = targetPrefixes.some(prefix => lowerCasePath.startsWith(prefix));

            if (matchesTarget) {
                const entries = entriesData.entries || [];
                const validEntries = entries.filter(e => e.timestamp < cutoffTime);

                if (validEntries.length > 0) {
                    validEntries.sort((a, b) => b.timestamp - a.timestamp);
                    const latestEntry = validEntries[0];
                    const backupFilePath = path.join(folderPath, latestEntry.id);

                    // Check if this latest version from timeline is actually DIFFERENT or newer than what we already restored
                    if (fs.existsSync(backupFilePath)) {
                        const currentContent = fs.existsSync(resourcePath) ? fs.readFileSync(resourcePath, 'utf8') : '';
                        const backupContent = fs.readFileSync(backupFilePath, 'utf8');

                        if (currentContent !== backupContent) {
                            const stat = fs.existsSync(resourcePath) ? fs.statSync(resourcePath).mtimeMs : 0;
                            // Only overwrite if this timeline entry is objectively NEWER than the file currently sitting on disk
                            if (latestEntry.timestamp > stat) {
                                console.log(`\nFound newer timeline save in ${sourceName}: ${resourcePath}`);
                                console.log(`-> Saved on: ${new Date(latestEntry.timestamp).toLocaleString()}`);

                                if (!fs.existsSync(path.dirname(resourcePath))) {
                                    fs.mkdirSync(path.dirname(resourcePath), { recursive: true });
                                }

                                fs.copyFileSync(backupFilePath, resourcePath);
                                restored++;
                            }
                        }
                    }
                }
            }
        } catch (e) {
        }
    }
    return restored;
}

console.log("Searching All Custom Timelines / History Engines (including Antigravity paths)...");

let total = 0;
total += recoverFromHistoryDir(vscodeHistoryDir, "VS Code Timeline");
total += recoverFromHistoryDir(cursorHistoryDir, "Cursor Timeline");

for (const p of antigravityLocalPaths) {
    total += recoverFromHistoryDir(p, "Antigravity Local Timeline");
}

console.log(`\n✅ Timeline Sync Complete! Restored ${total} newer files into the codebase.`);
