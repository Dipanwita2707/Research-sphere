/**
 * Route-param guard for UUID ids.
 *
 * `router.param('id', skipNonUuidParam)` makes every `/:id…` route of that router ignore a
 * value that is not a UUID: the request moves on to the next matching route (or router) and
 * ends in the app's 404 handler, instead of reaching Prisma and failing with a 500
 * ("invalid input syntax for type uuid").
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

/** Express param callback: continue for a UUID, otherwise skip this route ('route'). */
function skipNonUuidParam(req, res, next, value) {
  return isUuid(value) ? next() : next('route');
}

module.exports = { UUID_RE, isUuid, skipNonUuidParam };
