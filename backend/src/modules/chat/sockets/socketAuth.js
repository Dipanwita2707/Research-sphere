/**
 * Socket.io Authentication Middleware
 * Verifies JWT tokens for socket connections
 */
const jwt = require('jsonwebtoken');
const config = require('../../../shared/config/app.config');
const prisma = require('../../../shared/config/database');

/**
 * Authenticate socket connection
 */
const socketAuth = async (socket, next) => {
  try {
    // Get token from handshake auth or query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Get user from database
    const user = await prisma.userLogin.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        uid: true,
        email: true,
        role: true,
        status: true,
        profileImage: true,
        employeeDetails: {
          select: { firstName: true, lastName: true, displayName: true },
        },
        studentLogin: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!user || user.status !== 'active') {
      return next(new Error('User not found or inactive'));
    }

    // Attach user to socket
    socket.user = user;
    socket.userId = user.id;

    next();
  } catch (error) {
    console.error('Socket auth error:', error.message);
    next(new Error('Invalid or expired token'));
  }
};

module.exports = { socketAuth };
