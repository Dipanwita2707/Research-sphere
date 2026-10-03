/**
 * NotFoundError(resource) appends " not found" itself, so call sites must pass only the
 * resource name. Passing "X not found" produced messages like "Chat session not found not found".
 */

const fs = require('fs');
const path = require('path');
const { NotFoundError } = require('../../shared/utils/AppError');

const SRC_ROOT = path.resolve(__dirname, '../../');

function* jsFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* jsFiles(full);
    else if (entry.name.endsWith('.js')) yield full;
  }
}

describe('NotFoundError messages', () => {
  it('appends "not found" exactly once', () => {
    expect(new NotFoundError('Chat session').message).toBe('Chat session not found');
    expect(new NotFoundError().message).toBe('Resource not found');
  });

  it('no call site passes a message that already says "not found"', () => {
    const offenders = [];
    for (const file of jsFiles(SRC_ROOT)) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/new\s+NotFoundError\(\s*(['"`])([^'"`]*)\1/g)) {
        if (/not\s+found/i.test(m[2])) offenders.push(`${path.relative(SRC_ROOT, file)}: ${m[2]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
