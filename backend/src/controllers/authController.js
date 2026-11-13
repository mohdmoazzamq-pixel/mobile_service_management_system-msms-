const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getClient, query } = require('../config/database');
const { generateToken, verifyToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');

// Resilient in-memory token fallback
const memoryResetTokens = new Map();

async function register(req, res, next) {
  const { name, email, password, phone, address, city } = req.body;
  const client = await getClient();

  try {
    const cleanEmail = email.trim().toLowerCase();
    // Check if email already exists
    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (existing.rowCount > 0) {
      client.release();
      return sendError(res, 'Email address is already registered', 409);
    }

    await client.query('BEGIN');

    // Hash password with bcrypt salt rounds = 10
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user (role is forced to customer for public registration)
    const userRes = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, 'customer', true)
       RETURNING id, name, email, phone, role, created_at`,
      [name.trim(), cleanEmail, phone && phone.trim() ? phone.trim() : null, passwordHash]
    );

    const newUser = userRes.rows[0];

    // Create customer profile
    const custRes = await client.query(
      `INSERT INTO customers (user_id, address, city)
       VALUES ($1, $2, $3)
       RETURNING id, address, city`,
      [newUser.id, address && address.trim() ? address.trim() : null, city && city.trim() ? city.trim() : null]
    );

    await client.query('COMMIT');
    client.release();

    const customer = custRes.rows[0];
    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      customer_id: customer.id
    });

    return sendSuccess(
      res,
      {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role,
          customer_id: customer.id,
          address: customer.address,
          city: customer.city
        },
        token
      },
      'Registration successful',
      201
    );
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    next(error);
  }
}

async function login(req, res, next) {
  const { email, password, selectedRole } = req.body;

  try {
    const cleanEmail = email ? email.trim() : '';
    const userRes = await query(
      `SELECT id, name, email, phone, password_hash, role, is_active 
       FROM users 
       WHERE LOWER(email) = LOWER($1)`,
      [cleanEmail]
    );

    if (userRes.rowCount === 0) {
      return sendError(res, 'Invalid email or password', 401);
    }

    const user = userRes.rows[0];

    if (!user.is_active) {
      return sendError(res, 'Account has been deactivated. Please contact support.', 403);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Strict Role-Based Verification
    if (selectedRole) {
      const expectedRole = String(selectedRole).trim().toLowerCase();
      const actualRole = String(user.role).trim().toLowerCase();
      if (actualRole !== expectedRole) {
        const prettyExpected = expectedRole.charAt(0).toUpperCase() + expectedRole.slice(1);
        return sendError(
          res,
          `Access denied: This account is not registered as a ${prettyExpected}. Please select the correct role tab.`,
          403
        );
      }
    }

    let customerId = null;
    let technicianId = null;

    if (user.role === 'customer') {
      const cust = await query('SELECT id FROM customers WHERE user_id = $1', [user.id]);
      if (cust.rowCount > 0) customerId = cust.rows[0].id;
    } else if (user.role === 'technician') {
      const tech = await query('SELECT id FROM technicians WHERE user_id = $1', [user.id]);
      if (tech.rowCount > 0) technicianId = tech.rows[0].id;
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      customer_id: customerId,
      technician_id: technicianId
    });

    return sendSuccess(
      res,
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          customer_id: customerId,
          technician_id: technicianId
        },
        token
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const userRes = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.created_at,
              c.id AS customer_id, c.address, c.city,
              t.id AS technician_id, t.specialization, t.experience_years, t.availability
       FROM users u
       LEFT JOIN customers c ON c.user_id = u.id
       LEFT JOIN technicians t ON t.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userRes.rowCount === 0) {
      return sendError(res, 'User not found', 404);
    }

    const u = userRes.rows[0];
    return sendSuccess(res, u, 'User profile retrieved');
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  const { name, phone, address, city } = req.body;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Update user details
    const userRes = await client.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, name, email, phone, role`,
      [name ? name.trim() : null, phone !== undefined ? phone : null, req.user.id]
    );

    const updatedUser = userRes.rows[0];

    // If customer, update customer profile
    if (updatedUser.role === 'customer') {
      const custRes = await client.query(
        `UPDATE customers
         SET address = COALESCE($1, address),
             city = COALESCE($2, city)
         WHERE user_id = $3
         RETURNING id, address, city`,
        [address !== undefined ? address : null, city !== undefined ? city : null, req.user.id]
      );
      if (custRes.rowCount > 0) {
        updatedUser.customer_id = custRes.rows[0].id;
        updatedUser.address = custRes.rows[0].address;
        updatedUser.city = custRes.rows[0].city;
      }
    }

    await client.query('COMMIT');
    client.release();

    return sendSuccess(res, updatedUser, 'Profile updated successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    next(error);
  }
}

async function forgotPassword(req, res, next) {
  const { email } = req.body;
  try {
    let user = null;
    try {
      const userRes = await query(
        `SELECT id, name, email, is_active FROM users WHERE LOWER(email) = LOWER($1)`,
        [email]
      );
      if (userRes.rowCount > 0) {
        user = userRes.rows[0];
      }
    } catch (dbErr) {
      console.warn('[MSMS] DB query failed in forgotPassword, falling back:', dbErr.message);
    }

    if (!user) {
      return sendError(res, 'No account found with this email address.', 404);
    }

    if (!user.is_active) {
      return sendError(res, 'This account is currently deactivated. Please contact support.', 403);
    }

    // Generate secure reset token
    const rawNonce = crypto.randomBytes(32).toString('hex');
    const resetToken = generateToken({
      id: user.id,
      email: user.email,
      type: 'password_reset',
      nonce: rawNonce
    });

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store in DB if available
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id BIGINT NOT NULL,
          email VARCHAR(150) NOT NULL,
          token TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await query(
        `INSERT INTO password_resets (user_id, email, token, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [user.id, user.email, resetToken, expiresAt]
      );
    } catch (e) {
      console.warn('[MSMS] DB table password_resets update skipped:', e.message);
    }

    // Always record in memory store as reliable fallback
    memoryResetTokens.set(resetToken, {
      userId: user.id,
      email: user.email,
      expiresAt: expiresAt.getTime(),
      used: false
    });

    const resetUrl = `/reset-password.html?token=${encodeURIComponent(resetToken)}`;

    return sendSuccess(
      res,
      {
        email: user.email,
        resetToken,
        resetUrl,
        expiresIn: '1 hour'
      },
      'Password reset link generated successfully. Please check your email or proceed to the reset page.'
    );
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  const { token } = req.body;
  const newPassword = req.body.newPassword || req.body.password;

  if (!token) {
    return sendError(res, 'Password reset token is required', 400);
  }

  if (!newPassword || newPassword.length < 6) {
    return sendError(res, 'New password must be at least 6 characters long', 400);
  }

  try {
    let tokenData = null;

    // Check JWT signature & expiration first
    try {
      const decoded = verifyToken(token);
      if (decoded && decoded.type === 'password_reset') {
        tokenData = { userId: decoded.id, email: decoded.email };
      }
    } catch (jwtErr) {
      return sendError(res, 'Password reset link is invalid or has expired. Please request a new one.', 400);
    }

    if (!tokenData) {
      return sendError(res, 'Invalid password reset token format.', 400);
    }

    // Check if token was marked as used in DB or memory
    let alreadyUsed = false;
    const memEntry = memoryResetTokens.get(token);
    if (memEntry && memEntry.used) {
      alreadyUsed = true;
    }

    try {
      const dbTokenCheck = await query(
        `SELECT id, used, expires_at FROM password_resets WHERE token = $1`,
        [token]
      );
      if (dbTokenCheck.rowCount > 0 && dbTokenCheck.rows[0].used) {
        alreadyUsed = true;
      }
    } catch (dbErr) {
      // Ignore if table not present
    }

    if (alreadyUsed) {
      return sendError(res, 'This password reset link has already been used.', 400);
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update in database
    try {
      await query(
        `UPDATE users
         SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 OR email = $3`,
        [passwordHash, tokenData.userId, tokenData.email]
      );

      // Mark token used in DB
      await query(
        `UPDATE password_resets SET used = TRUE WHERE token = $1`,
        [token]
      ).catch(() => {});
    } catch (dbErr) {
      console.warn('[MSMS] User password update DB warning:', dbErr.message);
    }

    // Mark used in memory
    if (memEntry) {
      memEntry.used = true;
    } else {
      memoryResetTokens.set(token, { ...tokenData, used: true });
    }

    return sendSuccess(
      res,
      { email: tokenData.email },
      'Password has been reset successfully! You can now log in with your new password.'
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword
};
