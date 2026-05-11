const router = require('express').Router();
const seminarHallRoutes = require('./routes/seminarHall.routes');

router.use('/', seminarHallRoutes);

module.exports = router;