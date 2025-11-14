import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/database.js';
import logger from '../config/logger.js';

const router = express.Router();

// Generate random password
function generatePassword(length = 16) {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

// POST /api/auth/register - Register new user (called by webhook)
router.post('/register', async (req, res) => {
  const { email, firstName, lastName, tenantId, sendWelcomeEmail = true } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id, email FROM users WHERE email = $1 AND tenant_id = $2',
      [email, tenantId || null]
    );

    if (existingUser.rows.length > 0) {
      return res.json({ 
        user: existingUser.rows[0], 
        alreadyExists: true 
      });
    }

    // Generate temporary password
    const tempPassword = generatePassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, first_name, last_name, role, created_at`,
      [tenantId || null, email, passwordHash, firstName || null, lastName || null, 'customer', 'active']
    );

    const user = result.rows[0];

    // Send welcome email with temp password
    if (sendWelcomeEmail) {
      try {
        const nodemailer = await import('nodemailer');
        
        const transporter = nodemailer.default.createTransporter({
          host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER || 'apikey',
            pass: process.env.SMTP_PASS || process.env.SENDGRID_API_KEY
          }
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@migrahosting.com',
          to: email,
          subject: 'Welcome to MigraHosting',
          html: `
            <h1>Welcome to MigraHosting!</h1>
            <p>Your account has been created successfully.</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
            <p>Please log in and change your password immediately.</p>
            <p><a href="${process.env.APP_URL || 'http://localhost:3001'}/login">Login to your account</a></p>
          `
        });
        
        logger.info(`Welcome email sent to ${email}`);
      } catch (emailError) {
        logger.error('Failed to send welcome email:', emailError);
        // Don't fail registration if email fails
      }
    }

    res.json({
      user,
      message: 'User created successfully. Welcome email sent.'
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login - Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND status = $2',
      [email, 'active']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/set-password - Set/reset password (for first-time login)
router.post('/set-password', async (req, res) => {
  const { email, tempPassword, newPassword } = req.body;

  if (!email || !tempPassword || !newPassword) {
    return res.status(400).json({ error: 'Email, temporary password, and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const validTempPassword = await bcrypt.compare(tempPassword, user.password_hash);

    if (!validTempPassword) {
      return res.status(401).json({ error: 'Invalid temporary password' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password and mark email as verified
    await pool.query(
      'UPDATE users SET password_hash = $1, email_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      },
      message: 'Password updated successfully'
    });
  } catch (error) {
    logger.error('Set password error:', error);
    res.status(500).json({ error: 'Password update failed' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role, tenant_id, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
});

// GET /api/auth/permissions - Get user's role and permissions
router.get('/permissions', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user's role
    const userResult = await pool.query(
      'SELECT role_id FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const roleId = userResult.rows[0].role_id;

    if (!roleId) {
      // User has no role assigned, return empty permissions
      return res.json({ role: null, permissions: [] });
    }

    // Get role details
    const roleResult = await pool.query(
      'SELECT id, name, level, description FROM roles WHERE id = $1',
      [roleId]
    );

    // Get role permissions
    const permissionsResult = await pool.query(
      `SELECT p.id, p.name, p.resource, p.description
       FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.resource, p.name`,
      [roleId]
    );

    res.json({
      role: roleResult.rows[0] || null,
      permissions: permissionsResult.rows || [],
    });
  } catch (error) {
    logger.error('Get permissions error:', error);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
});

// POST /api/auth/verify-session - Verify Stripe session and auto-login
router.post('/verify-session', async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  try {
    // TODO: Verify the Stripe session is valid
    // For now, we'll decode it or look it up in our database
    
    // This would typically query your database for the session
    // and return the associated user email
    
    res.json({
      message: 'Session verification not yet implemented',
      sessionId
    });
  } catch (error) {
    logger.error('Session verification error:', error);
    res.status(500).json({ error: 'Session verification failed' });
  }
});

export default router;
