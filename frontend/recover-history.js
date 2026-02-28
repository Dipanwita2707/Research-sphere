const fs = require('fs');
const path = require('path');

const historyDir = path.join(process.env.APPDATA, 'Code', 'User', 'History');
const targetPrefixes = [
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\app\\events',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\app\\noting',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\features\\events',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\features\\noting-management',
    'c:\\users\\anwee\\desktop_1\\learning-season\\sgt_1v\\sgt-ums\\frontend\\src\\features\\event-management'
];

// Target cutoff: 2026-02-26T15:35:00+05:30 (Just before the git restore was mistakenly run)
const cutoffTime = new Date('2026-02-26T15:35:00+05:30').getTime();

console.log("Searching VS Code Local History...");

if (!fs.existsSync(historyDir)) {
    console.log("Could not find VS Code history directory.");
    process.exit(1);
}

const folders = fs.readdirSync(historyDir);
let restoredCount = 0;

for (const folder of folders) {
    const folderPath = path.join(historyDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const entriesFile = path.join(folderPath, 'entries.json');
    if (!fs.existsSync(entriesFile)) continue;

    try {
        const entriesData = JSON.parse(fs.readFileSync(entriesFile, 'utf8'));
        let resourcePath = entriesData.resource;

        // Convert VS Code file URI to standard windows path
        if (resourcePath.startsWith('vscode-userdata:')) continue; // Skip settings
        resourcePath = resourcePath.replace('file:///', '');
        resourcePath = decodeURIComponent(resourcePath).replace(/\//g, '\\');

        // Check if it belongs to our target directories
        const matchesTarget = targetPrefixes.some(prefix => resourcePath.toLowerCase().startsWith(prefix));

        if (matchesTarget) {
            const entries = entriesData.entries || [];
            // Look for the most recent save BEFORE the git restore wiped it
            const validEntries = entries.filter(e => e.timestamp < cutoffTime);

            if (validEntries.length > 0) {
                // Sort descending by timestamp
                validEntries.sort((a, b) => b.timestamp - a.timestamp);
                const latestEntry = validEntries[0];

                const backupFilePath = path.join(folderPath, latestEntry.id);
                if (fs.existsSync(backupFilePath)) {
                    console.log(`Restoring: ${resourcePath}`);
                    console.log(` -> From timestamp: ${new Date(latestEntry.timestamp).toLocaleString()}`);

                    // Only restore if the file exists or we want to recreate it
                    if (!fs.existsSync(path.dirname(resourcePath))) {
                        fs.mkdirSync(path.dirname(resourcePath), { recursive: true });
                    }

                    fs.copyFileSync(backupFilePath, resourcePath);
                    restoredCount++;
                }
            }
        }
    } catch (e) {
        // skip unparseable
    }
}

console.log(`\nSuccessfully restored ${restoredCount} files! Check your IDE.`);
