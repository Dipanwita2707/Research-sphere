const express = require('express');
const controller = require('../controllers/seminarHall.controller');
const { protect } = require('../../../shared/middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/rooms', controller.getRooms);
router.get('/bookings', controller.getBookings);
router.post('/bookings', controller.createBooking);

module.exports = router;