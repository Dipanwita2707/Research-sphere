/**
 * Branding module: per-university name, logos, theme preset/colours and dashboard text.
 * Exports the authenticated router (/branding), the public router (/public/branding)
 * and the controller (the superadmin router mounts its editor handlers).
 */
module.exports = require('./routes/branding.routes');
module.exports.publicRoutes = require('./routes/brandingPublic.routes');
module.exports.controller = require('./controllers/branding.controller');
