// controllers/authController.js
'use strict';

const bcrypt = require('bcryptjs');
const User   = require('../models/User');
const { issueToken, clearTokens } = require('../middleware/auth');
const { createError } = require('../middleware/errorHandler');

const authController = {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
      }

      const user = User.findByEmail(email.toLowerCase().trim());
      if (!user) {
        // Constant-time comparison even on miss (prevents timing attacks)
        await bcrypt.compare(password, '$2a$12$invalidhashpadding.invalidhashpadding.invalid');
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      User.updateLastLogin(user.id);
      issueToken(res, user);

      return res.json({
        success: true,
        message: 'Logged in successfully.',
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    } catch (err) {
      next(err);
    }
  },

  logout(req, res) {
    clearTokens(res);
    // Accept both API and browser logout
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.path.startsWith('/api/')) {
      return res.json({ success: true, message: 'Logged out.' });
    }
    return res.redirect('/admin/login');
  },

  me(req, res) {
    // req.user is set by requireAuth middleware
    const user = User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, user });
  },
};

module.exports = authController;
