/**
 * Email Queue Stub (Events module removed)
 */

async function init() {
  console.log('[EmailQueue] Background email queue is disabled (Event Management removed).');
}

function isAvailable() {
  return false;
}

async function enqueue() {
  return null;
}

async function shutdown() {}

module.exports = { init, isAvailable, enqueue, shutdown };
