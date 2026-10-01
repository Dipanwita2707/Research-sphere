/**
 * Route inventory: every HTTP route the backend registers, with its full path and methods.
 *
 * Records Router#use / Router#route calls while server.js loads (without starting it),
 * then walks the tree from the app's root router. Used by audit-endpoints.js.
 *
 *   node scripts/security/route-inventory.js            # prints the list
 */

'use strict';

const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '../..');

function collectRoutes() {
  const Router = require(require.resolve('router', { paths: [require.resolve('express', { paths: [ROOT] })] }));
  const Route = require(require.resolve('router/lib/route', { paths: [require.resolve('express', { paths: [ROOT] })] }));
  const proto = Router.prototype;

  const uses = new Map(); // router -> [{ path, children: [router] }]
  const routes = new Map(); // router -> [{ path, route }]
  const routeMethods = new Map(); // route -> Set(methods)

  const origUse = proto.use;
  const origRoute = proto.route;
  proto.use = function patchedUse(...args) {
    let mount = '/';
    let handlers = args;
    if (typeof args[0] === 'string' || args[0] instanceof RegExp || Array.isArray(args[0])) {
      mount = args[0];
      handlers = args.slice(1);
    }
    const flat = handlers.flat(Infinity);
    const children = flat.filter((h) => typeof h === 'function' && Array.isArray(h.stack));
    if (!uses.has(this)) uses.set(this, []);
    uses.get(this).push({ path: mount, children });
    return origUse.apply(this, args);
  };
  proto.route = function patchedRoute(p) {
    const r = origRoute.call(this, p);
    if (!routes.has(this)) routes.set(this, []);
    routes.get(this).push({ path: p, route: r });
    return r;
  };
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'all'];
  const origMethods = {};
  for (const m of methods) {
    origMethods[m] = Route.prototype[m];
    Route.prototype[m] = function patchedMethod(...a) {
      if (!routeMethods.has(this)) routeMethods.set(this, new Set());
      routeMethods.get(this).add(m.toUpperCase());
      return origMethods[m].apply(this, a);
    };
  }

  // Load the app without letting it listen or connect to schedulers.
  const http = require('http');
  const origListen = http.Server.prototype.listen;
  http.Server.prototype.listen = function noListen() {
    return this;
  };
  const origExit = process.exit;
  let app;
  try {
    process.env.ROUTE_INVENTORY = '1';
    app = require(path.join(ROOT, 'src/server.js'));
  } finally {
    http.Server.prototype.listen = origListen;
    proto.use = origUse;
    proto.route = origRoute;
    for (const m of methods) Route.prototype[m] = origMethods[m];
    process.exit = origExit;
  }

  const join = (a, b) => {
    const s = `${a}/${b}`.replace(/\/+/g, '/');
    return s.length > 1 ? s.replace(/\/$/, '') : s;
  };
  const out = [];
  const seen = new Set();
  const walk = (router, prefix) => {
    if (seen.has(`${prefix}|${routes.get(router)?.length}|${uses.get(router)?.length}`) && prefix.length > 400) return;
    for (const { path: p, route } of routes.get(router) || []) {
      const ms = routeMethods.get(route) || new Set();
      for (const m of ms) out.push({ method: m, path: typeof p === 'string' ? join(prefix, p) : `${prefix} ${String(p)}` });
    }
    for (const { path: p, children } of uses.get(router) || []) {
      for (const child of children) walk(child, typeof p === 'string' ? join(prefix, p) : `${prefix}${String(p)}`);
    }
  };
  walk(app.router, '');
  // de-duplicate
  const keyed = new Map(out.map((r) => [`${r.method} ${r.path}`, r]));
  return { app, routes: [...keyed.values()].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)) };
}

module.exports = { collectRoutes };

if (require.main === module) {
  const { routes } = collectRoutes();
  for (const r of routes) console.log(r.method.padEnd(7), r.path);
  console.log(`\n${routes.length} routes`);
  setTimeout(() => process.exit(0), 50);
}
