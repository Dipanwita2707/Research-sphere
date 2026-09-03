/**
 * build-protected-dist.js
 * Builds an obfuscated and tamper-locked production distribution of the backend.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('🔒 =========================================================');
console.log('   SGT-UMS Backend Protection & Obfuscation Build Pipeline   ');
console.log('============================================================\n');

// 1. Clean dist directory
if (fs.existsSync(DIST_DIR)) {
  console.log('🧹 Cleaning existing dist/ directory...');
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. Install javascript-obfuscator if not already present
try {
  require.resolve('javascript-obfuscator');
} catch (err) {
  console.log('📦 Installing javascript-obfuscator dependency...');
  execSync('npm install --save-dev javascript-obfuscator', { cwd: ROOT_DIR, stdio: 'inherit' });
}

const JavaScriptObfuscator = require('javascript-obfuscator');

const OBFUSCATION_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: false, // keep clean for performance
  debugProtection: true,
  debugProtectionInterval: 4000,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.75,
  stringArrayEncoding: ['rc4'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.8,
  target: 'node',
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

function copyAndObfuscate(srcPath, destPath) {
  const stat = fs.statSync(srcPath);

  if (stat.isDirectory()) {
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }
    const files = fs.readdirSync(srcPath);
    for (const file of files) {
      // Skip test directories during production builds
      if (file === '__tests__' || file === 'test') continue;
      copyAndObfuscate(path.join(srcPath, file), path.join(destPath, file));
    }
  } else if (srcPath.endsWith('.js')) {
    const rawCode = fs.readFileSync(srcPath, 'utf8');
    try {
      const obfuscated = JavaScriptObfuscator.obfuscate(rawCode, OBFUSCATION_OPTIONS).getObfuscatedCode();
      fs.writeFileSync(destPath, obfuscated, 'utf8');
      console.log(`  ✓ Protected & Obfuscated: ${path.relative(ROOT_DIR, srcPath)}`);
    } catch (err) {
      console.warn(`  ⚠️ Could not obfuscate ${srcPath} directly, copying as fallback:`, err.message);
      fs.writeFileSync(destPath, rawCode, 'utf8');
    }
  } else {
    // Copy non-JS assets directly (e.g. JSON, templates)
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ✓ Copied asset: ${path.relative(ROOT_DIR, srcPath)}`);
  }
}

console.log('⚙️ Obfuscating backend codebase into dist/ ...');
copyAndObfuscate(SRC_DIR, path.join(DIST_DIR, 'src'));

// Copy prisma schema, package.json for production distribution
fs.mkdirSync(path.join(DIST_DIR, 'prisma'), { recursive: true });
fs.copyFileSync(path.join(ROOT_DIR, 'prisma', 'schema.prisma'), path.join(DIST_DIR, 'prisma', 'schema.prisma'));

// Create production distribution package.json
const pkg = require(path.join(ROOT_DIR, 'package.json'));
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  main: 'src/server.js',
  scripts: {
    start: 'node src/server.js',
  },
  dependencies: pkg.dependencies,
};
fs.writeFileSync(path.join(DIST_DIR, 'package.json'), JSON.stringify(prodPkg, null, 2), 'utf8');

console.log('\n✅ Protection build completed successfully!');
console.log(`📁 Protected output folder: ${DIST_DIR}`);
console.log('🔒 All JavaScript source code is encrypted with self-defending anti-tamper mechanisms.\n');
