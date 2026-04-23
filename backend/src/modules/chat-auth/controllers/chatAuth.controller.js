/**
 * Chat Auth Controller
 * Handles chat session login, refresh, logout, and session management.
 */
const bcrypt = require('bcryptjs');
const prisma = require('../../../shared/config/database');
const {
  createChatSession,
  refreshChatSession,
  revokeChatSession,
  revokeAllUserChatSessions,
  listActiveSessions,
} = require('../services/chatAuth.service');

/**
 * POST /chat-auth/login
 * Authenticates user credentials and creates a chat session.
 */
const login = async (req, res) => {
  try {
    const { username, password, deviceId, platform, deviceName } = req.body;
    console.log('[chat-auth/login] body keys:', Object.keys(req.body), '| username:', username);

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    // Look up user by uid or email (same logic as main auth)
    const user = await prisma.userLogin.findFirst({
      where: {
        OR: [
          { uid: username },
          { email: username },
        ],
      },
      select: {
        id: true,
        uid: true,
        email: true,
        role: true,
        status: true,
        passwordHash: true,
        profileImage: true,
        employeeDetails: {
          select: { firstName: true, lastName: true, displayName: true },
        },
        studentLogin: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    // Verify password
    const trimmedPassword = password.trim();
    console.log('[chat-auth/login] password length:', password.length, 'trimmed length:', trimmedPassword.length, 'user found:', !!user, 'status:', user?.status);
    const isMatch = await bcrypt.compare(trimmedPassword, user.passwordHash);
    console.log('[chat-auth/login] bcrypt match:', isMatch);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Create chat session
    const meta = {
      deviceId: deviceId || null,
      platform: platform || 'web',
      deviceName: deviceName || null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null,
    };

    const { chatAccessToken, chatRefreshToken, sessionId } = await createChatSession(user.id, meta);

    // Build user object (without passwordHash)
    const { passwordHash: _, ...userDetails } = user;

    res.status(200).json({
      success: true,
      data: {
        chatAccessToken,
        chatRefreshToken,
        sessionId,
        user: userDetails,
      },
    });
  } catch (error) {
    console.error('Chat auth login error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /chat-auth/refresh
 * Exchanges a valid refresh token for a new token pair (rotation).
 */
const refresh = async (req, res) => {
  try {
    const { chatRefreshToken } = req.body;

    if (!chatRefreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    const result = await refreshChatSession(chatRefreshToken);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * POST /chat-auth/logout
 * Revokes the current chat session.
 */
const logout = async (req, res) => {
  try {
    await revokeChatSession(req.chatSessionId);
    res.status(200).json({ success: true, message: 'Chat session ended' });
  } catch (error) {
    console.error('Chat auth logout error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /chat-auth/logout-all
 * Revokes all chat sessions for the current user.
 */
const logoutAll = async (req, res) => {
  try {
    await revokeAllUserChatSessions(req.user.id);
    res.status(200).json({ success: true, message: 'All chat sessions ended' });
  } catch (error) {
    console.error('Chat auth logout-all error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /chat-auth/me
 * Returns the authenticated chat user.
 */
const getMe = async (req, res) => {
  try {
    const user = await prisma.userLogin.findUnique({
      where: { id: req.user.id },
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

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Chat auth getMe error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /chat-auth/sessions
 * Lists all active chat sessions for the user.
 */
const getSessions = async (req, res) => {
  try {
    const sessions = await listActiveSessions(req.user.id);
    res.status(200).json({ success: true, data: sessions });
  } catch (error) {
    console.error('Chat auth sessions error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /chat-auth/exchange
 * Exchanges a valid UMS access token for a chat session.
 * Uses the main `protect` middleware so req.user is already verified.
 * No password required — the UMS JWT is the proof of identity.
 */
const exchangeToken = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch full user record needed for chat session response
    const user = await prisma.userLogin.findUnique({
      where: { id: userId },
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

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    const meta = {
      deviceId: null,
      platform: 'web',
      deviceName: 'UMS Web',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null,
    };

    const { chatAccessToken, chatRefreshToken, sessionId } = await createChatSession(userId, meta);

    res.status(200).json({
      success: true,
      data: {
        chatAccessToken,
        chatRefreshToken,
        sessionId,
        user,
      },
    });
  } catch (error) {
    console.error('Chat auth exchange error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { login, refresh, logout, logoutAll, getMe, getSessions, exchangeToken };
