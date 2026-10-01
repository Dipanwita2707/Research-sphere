/**
 * Tenant context must survive every middleware between `protect` and the handler.
 * multer resumes the request from a stream callback, which drops AsyncLocalStorage
 * context — so every multer middleware must be wrapped in bindMiddleware
 * (a.k.a. withTenantContext). This test fails the build on any unwrapped call.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const http = require('http');
const tenantContext = require('../../shared/tenancy/tenantContext');

const SRC = path.join(__dirname, '..', '..');
const MULTER_CALL = /\b[\w.]*\.(single|array|fields|any|none)\(/;
const WRAPPED = /(bindMiddleware|withTenantContext)\(/;

const listJs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(dir, e.name);
  if (e.isDirectory()) return e.name === 'node_modules' || e.name === '__tests__' ? [] : listJs(full);
  return e.name.endsWith('.js') ? [full] : [];
});

describe('architecture: tenant context across upload middleware', () => {
  it('wraps every multer middleware in route files with bindMiddleware', () => {
    const offenders = [];
    for (const file of listJs(SRC).filter((f) => /[\\/]routes[\\/]/.test(f))) {
      const source = fs.readFileSync(file, 'utf8');
      if (!/multer|upload/i.test(source)) continue;
      source.split('\n').forEach((line, i) => {
        if (!MULTER_CALL.test(line) || !/upload/i.test(line)) return;
        // allowed: wrapped on the same line, or inside a function passed to bindMiddleware
        const window = source.split('\n').slice(Math.max(0, i - 3), i + 1).join('\n');
        if (!WRAPPED.test(window)) offenders.push(`${path.relative(SRC, file)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('bindMiddleware keeps the tenant context through multer', async () => {
    const upload = multer({ storage: multer.memoryStorage() });
    const app = express();
    const seen = {};
    const enter = (req, res, next) => tenantContext.run({ tenantId: 'tenant-1' }, () => next());
    app.post('/plain', enter, upload.single('f'), (req, res) => { seen.plain = tenantContext.getTenantId(); res.end(); });
    app.post('/bound', enter, tenantContext.bindMiddleware(upload.single('f')), (req, res) => {
      seen.bound = tenantContext.getTenantId();
      res.end();
    });

    const server = app.listen(0);
    const { port } = server.address();
    const post = (p) => new Promise((resolve, reject) => {
      const boundary = 'b0undary';
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="f"; filename="a.txt"\r\n\r\nhello\r\n--${boundary}--\r\n`;
      const req = http.request({
        port, path: p, method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': Buffer.byteLength(body) },
      }, (res) => { res.resume(); res.on('end', resolve); });
      req.on('error', reject);
      req.end(body);
    });
    try {
      await post('/plain');
      await post('/bound');
    } finally {
      server.close();
    }
    expect(seen.bound).toBe('tenant-1');
    // Older multer dropped the context (why the wrapper exists); multer >= 2.4 preserves it, so
    // plain multer is no longer asserted either way. The wrapper stays as a guard.
  });
});
