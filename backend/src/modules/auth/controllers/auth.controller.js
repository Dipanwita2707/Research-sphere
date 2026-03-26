/**
 * Auth Controller
 * Thin HTTP adapter — delegates all business logic to auth.service.js
 */

const authService = require('../services/auth.service');
const log = require('../../../shared/utils/logger');

// Login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password, req);

    if (result.error) {
      return res.status(result.status).json({
        success: false,
        message: result.error
      });
    }

    res.cookie('token', result.token, result.cookieOptions);

    res.status(200).json({
      success: true,
      token: result.token,
      user: result.userDetails
    });
  } catch (error) {
    log.error('Login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    const result = await authService.logout(req.user.id, req);

    res.cookie('token', 'none', result.cookieOptions);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    log.error('Logout error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
};

// Get current user - OPTIMIZED WITH CACHING
exports.getMe = async (req, res) => {
  try {
    const { data, fromCache } = await authService.getMe(req.user.id);

    if (!data) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, user: data, cached: fromCache });
  } catch (error) {
    log.error('Get user error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching user data' });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword, req);

    if (result.error) {
      return res.status(result.status).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    log.error('Change password error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error changing password'
    });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, email } = req.body;
    const result = await authService.updateProfile(req.user.id, { firstName, lastName, phone, email }, req);

    if (result.error) {
      return res.status(result.status).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: result.userDetails
    });
  } catch (error) {
    log.error('Update profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error updating profile'
    });
  }
};

// Get user settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await authService.getSettings(req.user.id);

    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    log.error('Get settings error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error fetching settings'
    });
  }
};

// Update user settings
exports.updateSettings = async (req, res) => {
  try {
    const settings = await authService.updateSettings(req.user.id, req.body);

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      settings
    });
  } catch (error) {
    log.error('Update settings error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error updating settings'
    });
  }
};
