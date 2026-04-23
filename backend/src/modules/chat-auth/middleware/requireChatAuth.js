/**
 * requireChatAuth Middleware
 * Verifies chat-scoped JWT access tokens and loads req.user identically to `protect`.
 * Reuses the same Redis user-session cache so permission checks work unchanged.
 */
const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const { verifyChatToken } = require('../services/token.service');
const { isSessionValid } = require('../services/chatAuth.service');

const requireChatAuth = async (req, res, next) => {
  try {
    let token;

    // Extract Bearer token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Chat authentication required' });
    }

    // Verify chat access token
    let decoded;
    try {
      decoded = verifyChatToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired chat token' });
    }

    // Must be a chat access token (not refresh)
    if (decoded.scope !== 'chat') {
      return res.status(401).json({ success: false, message: 'Invalid token scope' });
    }

    // Check session not revoked (Redis cache → DB fallback)
    const valid = await isSessionValid(decoded.sid);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Chat session revoked or expired' });
    }

    // Load user from cache (same cache key as `protect` middleware → no extra DB hit)
    const cacheKey = `${cache.CACHE_KEYS.USER}auth:${decoded.sub}`;
    const { data: user } = await cache.getOrSet(
      cacheKey,
      async () => {
        const userData = await prisma.userLogin.findUnique({
          where: { id: decoded.sub },
          select: {
            id: true,
            uid: true,
            email: true,
            role: true,
            status: true,
            centralDeptPermissions: {
              where: { isActive: true },
              select: {
                centralDeptId: true,
                permissions: true,
                isPrimary: true,
                centralDept: {
                  select: {
                    departmentCode: true,
                    departmentName: true,
                  },
                },
              },
            },
            schoolDeptPermissions: {
              where: { isActive: true },
              select: {
                departmentId: true,
                permissions: true,
                isPrimary: true,
              },
            },
          },
        });

        if (!userData) return null;

        // Pre-cache chairperson club lookup for students (same as protect)
        let chairpersonClubData = null;
        if (userData.role === 'student') {
          try {
            const chairClub = await prisma.club.findFirst({
              where: {
                chairpersonId: userData.id,
                status: { in: ['approved', 'active'] },
              },
              select: { id: true, name: true, facultyFacilitatorId: true },
            });
            if (chairClub) chairpersonClubData = chairClub;
          } catch (_) {
            // Non-critical
          }
        }

        return {
          ...userData,
          _chairpersonClub: chairpersonClubData,
        };
      },
      cache.CACHE_TTL.USER_SESSION
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'User account is deactivated' });
    }

    // Attach to request — identical shape to protect middleware
    req.user = user;
    req.chatSessionId = decoded.sid;
    next();
  } catch (error) {
    console.error('Chat auth middleware error:', error.message);
    return res.status(401).json({ success: false, message: 'Chat authentication failed' });
  }
};

module.exports = { requireChatAuth };
