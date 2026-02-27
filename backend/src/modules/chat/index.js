/**
 * Chat Module
 * Handles real-time messaging, group management, and chat functionality
 */
const router = require('express').Router();
const groupRoutes = require('./routes/group.routes');
const messageRoutes = require('./routes/message.routes');
const directMessageRoutes = require('./routes/directMessage.routes');
const statusRoutes = require('./routes/status.routes');
const uploadRoutes = require('./routes/upload.routes');
const userPermissionRoutes = require('./routes/userPermission.routes');

// User-level permissions (admin management + user self-check)
router.use('/user-permissions', userPermissionRoutes);

// Group management
router.use('/groups', groupRoutes);

// Messages
router.use('/messages', messageRoutes);

// Direct messages
router.use('/direct', directMessageRoutes);

// User status (online/offline/last seen)
router.use('/status', statusRoutes);

// File uploads
router.use('/upload', uploadRoutes);

module.exports = router;
