/**
 * Foreign-key metadata read from prisma/schema.prisma.
 *
 * Prisma 5's DMMF told us which scalar fields back each relation (`relationFromFields`); Prisma 7's
 * does not. The tenant extension needs that to tell checked create inputs (relation objects) from
 * unchecked ones (FK scalars) and to find the relation behind `universityId`. The declarations are
 * simple one-line `@relation(... fields: [a, b] ...)` attributes, so they are parsed from the schema.
 *
 * tenantExtension.test.js and tenantIsolation.db.test.js guard this contract.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = process.env.PRISMA_SCHEMA_PATH || path.join(__dirname, '../../../prisma/schema.prisma');

let cache = null;

/** @returns {Map<string, Map<string, string[]>>} model → (relation field → FK scalar field names) */
function load() {
  if (cache) return cache;
  const map = new Map();
  let text;
  try {
    text = fs.readFileSync(SCHEMA_PATH, 'utf8');
  } catch (err) {
    throw new Error(
      `tenant isolation needs ${SCHEMA_PATH} to read relation metadata (${err.message}). ` +
        'Ship prisma/schema.prisma with the backend or set PRISMA_SCHEMA_PATH.'
    );
  }
  let model = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!model) {
      const m = line.match(/^model\s+(\w+)\s*\{/);
      if (m) {
        model = m[1];
        map.set(model, new Map());
      }
      continue;
    }
    if (line === '}') {
      model = null;
      continue;
    }
    if (line.startsWith('//') || line.startsWith('@@')) continue;
    // fieldName  Type[]?  ... @relation("Name", fields: [a, b], references: [id], ...)
    const f = line.match(/^(\w+)\s+\w+(?:\[\])?\??\s+.*@relation\(([^)]*)\)/);
    if (!f) continue;
    const fields = f[2].match(/fields:\s*\[([^\]]*)\]/);
    if (fields) {
      map.get(model).set(
        f[1],
        fields[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  }
  cache = map;
  return map;
}

/** FK scalar names backing `model.relationField` (empty for the list/inverse side). */
const relationFromFields = (model, field) => load().get(model)?.get(field) || [];

module.exports = { relationFromFields, load };
