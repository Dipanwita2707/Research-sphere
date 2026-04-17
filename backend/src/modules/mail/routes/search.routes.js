/**
 * Search Routes
 * Mail search and user search for recipient selector
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../../../shared/middleware/auth');
const searchController = require('../controllers/search.controller');

// All routes require authentication
router.use(protect);

// Search mail
router.get('/', searchController.search);

// Search users for recipient selection (typeahead)
router.get('/users/:query', searchController.searchUsers);

// Browse all groups (depts, schools, central depts) for group mail
router.get('/groups', searchController.getAllGroups);

module.exports = router;
