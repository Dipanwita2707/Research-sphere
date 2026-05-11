const express = require('express');
const controller = require('../controllers/seminarHall.controller');
const { protect } = require('../../../shared/middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/rooms', controller.getRooms);
router.get('/bookings/availability', controller.getAvailabilityBookings);
router.get('/bookings', controller.getBookings);
router.post('/bookings', controller.createBooking);
router.post('/bookings/:id/action', controller.createBookingActionRequest);
router.patch('/bookings/:id/status', controller.updateBookingStatus);

module.exports = router;