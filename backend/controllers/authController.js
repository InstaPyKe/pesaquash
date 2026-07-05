const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Register a new user
exports.register = async (req, res) => {
  const { username, email, phone, password, referrer_id } = req.body;

  try {
    // 1. Check if user registration is globally blocked by administrator
    const gateCheck = await db.query("SELECT value FROM system_settings WHERE key = 'registration_blocked'");
    if (gateCheck.rows.length > 0 && gateCheck.rows[0].value === 'true') {
      return res.status(403).json({ 
        error: 'Registration Closed',
        message: 'Registration is temporarily closed by the system administrator.' 
      });
    }

    // 2. Simple field validation
    if (!username || !email || !phone || !password) {
      return res.status(400).json({ error: 'Validation Error', message: 'All registration fields are required.' });
    }

    // Validate phone number format (07... or 01...)
    const phonePattern = /^(07|01)\d{8}$/;
    if (!phonePattern.test(phone)) {
      return res.status(400).json({ error: 'Validation Error', message: 'Invalid phone number. Must start with 07 or 01 and have 10 digits.' });
    }

    // 3. Check for duplicates (username, email, or phone)
    const duplicateCheck = await db.query(
      'SELECT id, username, email, phone FROM users WHERE username = $1 OR email = $2 OR phone = $3',
      [username.trim().toLowerCase(), email.trim().toLowerCase(), phone.trim()]
    );

    if (duplicateCheck.rows.length > 0) {
      const match = duplicateCheck.rows[0];
      if (match.username === username.trim().toLowerCase()) {
        return res.status(409).json({ error: 'Duplicate Entry', message: 'Username is already taken.' });
      }
      if (match.email === email.trim().toLowerCase()) {
        return res.status(409).json({ error: 'Duplicate Entry', message: 'Email address is already registered.' });
      }
      if (match.phone === phone.trim()) {
        return res.status(409).json({ error: 'Duplicate Entry', message: 'Phone number is already registered.' });
      }
    }

    // 4. Resolve referrer_id
    let resolvedReferrerId = 1; // Default to 'system_node' (id: 1)
    
    if (referrer_id && referrer_id.trim() !== '' && referrer_id !== 'SYSTEM_NODE') {
      const referrerQuery = await db.query(
        'SELECT id FROM users WHERE username = $1',
        [referrer_id.trim().toLowerCase()]
      );
      if (referrerQuery.rows.length > 0) {
        resolvedReferrerId = referrerQuery.rows[0].id;
      }
    }

    // 5. Encrypt password using bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 6. Insert new inactive user
    const insertResult = await db.query(
      `INSERT INTO users (username, email, phone, password, referrer_id, is_active) 
       VALUES ($1, $2, $3, $4, $5, false) 
       RETURNING id, username, email, phone, is_active, created_at`,
      [
        username.trim().toLowerCase(),
        email.trim().toLowerCase(),
        phone.trim(),
        hashedPassword,
        resolvedReferrerId
      ]
    );

    const newUser = insertResult.rows[0];

    res.status(201).json({
      success: true,
      message: 'Account registered successfully. Activation required.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone,
        isActive: newUser.is_active,
        createdAt: newUser.created_at
      }
    });

  } catch (error) {
    console.error('Registration API Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'An unexpected error occurred during registration. Please try again.' });
  }
};

// Login an existing user
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Validation Error', message: 'Email and password are required.' });
    }

    // Query user by email
    const userQuery = await db.query(
      'SELECT id, username, email, phone, password, is_active, wallet_balance, referrer_id FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    if (userQuery.rows.length === 0) {
      return res.status(401).json({ error: 'Auth Error', message: 'Invalid email or password.' });
    }

    const user = userQuery.rows[0];

    // Compare password hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Auth Error', message: 'Invalid email or password.' });
    }

    res.json({
      success: true,
      message: 'Log in successful.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        isActive: user.is_active,
        walletBalance: user.wallet_balance,
        referrerId: user.referrer_id
      }
    });

  } catch (error) {
    console.error('Login API Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'An unexpected error occurred during login. Please try again.' });
  }
};

// Admin Authentication Login
exports.adminLogin = async (req, res) => {
  const { pin } = req.body;

  try {
    if (!pin) {
      return res.status(400).json({ error: 'Validation Error', message: 'Administrative PIN is required.' });
    }

    if (String(pin) === '222222') {
      return res.json({
        success: true,
        message: 'Administrator session initiated successfully.',
        admin: {
          username: 'admin',
          email: 'admin@pesaquash.com',
          role: 'SUPER_ADMIN'
        }
      });
    }

    return res.status(401).json({ error: 'Auth Error', message: 'Invalid Administrative PIN.' });

  } catch (error) {
    console.error('Admin Login API Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'An unexpected error occurred during admin authentication.' });
  }
};

// Activate user account and distribute multi-level commissions
exports.activate = async (req, res) => {
  const { userId, phone } = req.body;

  try {
    if (!userId || !phone) {
      return res.status(400).json({ error: 'Validation Error', message: 'User ID and phone number are required.' });
    }

    // 1. Verify user exists and is not already active
    const userRes = await db.query('SELECT id, username, is_active, referrer_id FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
    }

    const user = userRes.rows[0];
    if (user.is_active) {
      return res.status(400).json({ error: 'Activation Error', message: 'User account is already activated.' });
    }

    // 2. Generate random MPESA transaction code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let transactionCode = 'Q';
    for (let i = 0; i < 9; i++) {
      transactionCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // 3. Record activation payment
    await db.query(
      `INSERT INTO activations (user_id, transaction_code, phone_number, amount, status)
       VALUES ($1, $2, $3, 500.00, 'Approved')`,
      [user.id, transactionCode, phone]
    );

    // 4. Update user activation status
    await db.query('UPDATE users SET is_active = true WHERE id = $1', [user.id]);

    // 5. Distribute multi-level referral commissions
    let currentReferrerId = user.referrer_id;
    const levels = [
      { key: 'commission_l1', defaultPct: 50, level: 1 },
      { key: 'commission_l2', defaultPct: 20, level: 2 },
      { key: 'commission_l3', defaultPct: 10, level: 3 }
    ];

    for (let i = 0; i < levels.length; i++) {
      if (!currentReferrerId || currentReferrerId === 1) break; // Skip system node

      const refQuery = await db.query('SELECT id, is_active, referrer_id FROM users WHERE id = $1', [currentReferrerId]);
      if (refQuery.rows.length === 0) break;
      const ref = refQuery.rows[0];

      // Only active referrers receive commissions
      if (ref.is_active) {
        const settingsPctRes = await db.query("SELECT value FROM system_settings WHERE key = $1", [levels[i].key]);
        const pct = settingsPctRes.rows.length > 0 ? parseFloat(settingsPctRes.rows[0].value) : levels[i].defaultPct;
        const amount = (pct / 100) * 500.00;

        // Credit referrer balance
        await db.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [amount, ref.id]);

        // Log commission record
        await db.query(
          `INSERT INTO commissions (user_id, downline_id, level, amount)
           VALUES ($1, $2, $3, $4)`,
          [ref.id, user.id, levels[i].level, amount]
        );
      }

      currentReferrerId = ref.referrer_id;
    }

    res.json({
      success: true,
      message: 'Account activated successfully! Redirecting...',
      transactionCode
    });

  } catch (error) {
    console.error('User Activation Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'An unexpected error occurred during activation.' });
  }
};

// Finance Portal Login validation
exports.financeLogin = async (req, res) => {
  const { pin } = req.body;

  try {
    if (!pin) {
      return res.status(400).json({ error: 'Validation Error', message: 'Finance PIN is required.' });
    }

    if (String(pin) === '333333') {
      return res.json({
        success: true,
        message: 'Finance session initiated successfully.',
        finance: {
          username: 'finance_officer',
          role: 'FINANCE_ADMIN'
        }
      });
    }

    return res.status(401).json({ error: 'Auth Error', message: 'Invalid Finance PIN.' });

  } catch (error) {
    console.error('Finance Login API Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'An unexpected error occurred during finance authentication.' });
  }
};



