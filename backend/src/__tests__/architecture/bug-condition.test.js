/**
 * Bug Condition Exploration Tests
 *
 * Property 1: Fault Condition - Architectural Defect Detection
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 *
 * CRITICAL: These tests MUST FAIL on unfixed code.
 * Failure confirms the architectural defects exist.
 * When the fix is applied (Task 3), these tests will pass.
 *
 * These are structural inspection tests using Node.js fs module.
 * No database connection required.
 */

const fs = require('fs');
const path = require('path');

// Resolve the backend src root relative to this test file
const SRC_ROOT = path.resolve(__dirname, '../../');
const MODULES_ROOT = path.join(SRC_ROOT, 'modules');

// Helper: count lines in a file
function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split('\n').length;
}

// Helper: check if a file contains a direct import of prisma or database/connection
function importsPrismaDirectly(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    /require\s*\(\s*['"][^'"]*prisma[^'"]*['"]\s*\)/.test(content) ||
    /require\s*\(\s*['"][^'"]*database\/connection[^'"]*['"]\s*\)/.test(content) ||
    /require\s*\(\s*['"][^'"]*database[^'"]*['"]\s*\)/.test(content)
  );
}

// Helper: find the line span of a named function in a file
function getFunctionLineCount(filePath, functionName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Find the line where the function starts
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes(`const ${functionName}`) ||
      lines[i].includes(`function ${functionName}`) ||
      lines[i].includes(`async function ${functionName}`) ||
      lines[i].includes(`exports.${functionName}`)
    ) {
      startLine = i;
      break;
    }
  }

  if (startLine === -1) return null; // function not found

  // Walk forward counting braces to find the end
  let depth = 0;
  let foundOpen = false;
  for (let i = startLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; foundOpen = true; }
      if (ch === '}') { depth--; }
    }
    if (foundOpen && depth === 0) {
      return i - startLine + 1;
    }
  }
  return lines.length - startLine; // fallback
}

// Helper: check if a directory exists
function dirExists(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

// Helper: check if a directory exists AND contains at least one .js file
function dirExistsWithFiles(dirPath) {
  if (!dirExists(dirPath)) return false;
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
  return files.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('Bug Condition Exploration - Architectural Defect Detection', () => {

  // ── Test 1: Direct Prisma Import ──────────────────────────────────────────
  describe('1. Direct Prisma Import in Controllers', () => {
    test('contribution.controller.js does NOT import prisma or database/connection directly', () => {
      const filePath = path.join(
        MODULES_ROOT,
        'research/controllers/contribution.controller.js'
      );

      expect(fs.existsSync(filePath)).toBe(true);

      const hasPrismaImport = importsPrismaDirectly(filePath);

      // EXPECTED TO FAIL on unfixed code:
      // contribution.controller.js imports prisma directly
      expect(hasPrismaImport).toBe(false);
    });
  });

  // ── Test 2: Controller File Size ──────────────────────────────────────────
  describe('2. Controller File Size (must not exceed 500 lines)', () => {
    const controllerFiles = [
      { module: 'research', file: 'contribution.controller.js' },
      { module: 'research', file: 'review.controller.js' },
      { module: 'ipr',      file: 'ipr.controller.js' },
      { module: 'grants',   file: 'grant.controller.js' },
    ];

    controllerFiles.forEach(({ module, file }) => {
      test(`${module}/${file} does not exceed 500 lines`, () => {
        const filePath = path.join(MODULES_ROOT, module, 'controllers', file);

        expect(fs.existsSync(filePath)).toBe(true);

        const lineCount = countLines(filePath);

        // EXPECTED TO FAIL on unfixed code:
        // contribution.controller.js = 4,168 lines
        // review.controller.js = 1,939 lines
        // ipr.controller.js = 1,200+ lines
        expect(lineCount).toBeLessThanOrEqual(500);
      });
    });
  });

  // ── Test 3: Function Size ─────────────────────────────────────────────────
  describe('3. createResearchContribution function is under 50 lines', () => {
    test('createResearchContribution in contribution.controller.js is under 50 lines', () => {
      const filePath = path.join(
        MODULES_ROOT,
        'research/controllers/contribution.controller.js'
      );

      expect(fs.existsSync(filePath)).toBe(true);

      const lineCount = getFunctionLineCount(filePath, 'createResearchContribution');

      // Function must be found
      expect(lineCount).not.toBeNull();

      // EXPECTED TO FAIL on unfixed code:
      // createResearchContribution spans 700+ lines
      expect(lineCount).toBeLessThan(50);
    });
  });

  // ── Test 4: Research Module Service Layer ─────────────────────────────────
  describe('4. Research module service layer exists', () => {
    test('backend/src/modules/research/services/ directory exists and contains service files', () => {
      const servicesDir = path.join(MODULES_ROOT, 'research/services');

      // EXPECTED TO FAIL on unfixed code: directory does not exist
      expect(dirExistsWithFiles(servicesDir)).toBe(true);
    });
  });

  // ── Test 5: Research Module Repository Layer ──────────────────────────────
  describe('5. Research module repository layer exists', () => {
    test('backend/src/modules/research/repositories/ directory exists', () => {
      const reposDir = path.join(MODULES_ROOT, 'research/repositories');

      // EXPECTED TO FAIL on unfixed code: directory does not exist
      expect(dirExists(reposDir)).toBe(true);
    });
  });

  // ── Test 6: IPR Module Layers ─────────────────────────────────────────────
  describe('6. IPR module service and repository layers exist', () => {
    test('backend/src/modules/ipr/services/ directory exists', () => {
      const servicesDir = path.join(MODULES_ROOT, 'ipr/services');

      // EXPECTED TO FAIL on unfixed code: directory does not exist
      expect(dirExists(servicesDir)).toBe(true);
    });

    test('backend/src/modules/ipr/repositories/ directory exists', () => {
      const reposDir = path.join(MODULES_ROOT, 'ipr/repositories');

      // EXPECTED TO FAIL on unfixed code: directory does not exist
      expect(dirExists(reposDir)).toBe(true);
    });
  });

  // ── Test 7: Grants Module Layers ──────────────────────────────────────────
  describe('7. Grants module service and repository layers exist', () => {
    test('backend/src/modules/grants/services/ directory exists', () => {
      const servicesDir = path.join(MODULES_ROOT, 'grants/services');

      // EXPECTED TO FAIL on unfixed code: directory does not exist
      expect(dirExists(servicesDir)).toBe(true);
    });

    test('backend/src/modules/grants/repositories/ directory exists', () => {
      const reposDir = path.join(MODULES_ROOT, 'grants/repositories');

      // EXPECTED TO FAIL on unfixed code: directory does not exist
      expect(dirExists(reposDir)).toBe(true);
    });
  });

});
