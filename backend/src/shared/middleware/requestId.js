/**
 * Request id middleware.
 *
 * Accepts an incoming `X-Request-Id` (from the load balancer / frontend) when it
 * is a short safe token, otherwise generates a UUID. The id is exposed as
 * `req.id`, echoed back in the `X-Request-Id` response header, included in
 * error responses (errorHandler) and in audit log metadata, so a user-reported
 * error can be matched to server logs.
 */
const crypto = require('crypto');

const SAFE_ID = /^[A-Za-z0-9._:-]{8,128}$/;

const requestId = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
};

module.exports = { requestId };
