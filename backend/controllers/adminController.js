const db = require('../config/db');

// 1. Get System Settings
exports.getSettings = async (req, res) => {
  try {
    const result = await db.query('SELECT key, value FROM system_settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Get Settings Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve system settings.' });
  }
};

// 2. Update System Settings
exports.updateSettings = async (req, res) => {
  const { 
    maintenance_mode, 
    force_logout, 
    registration_blocked, 
    commission_l1, 
    commission_l2, 
    commission_l3, 
    min_withdrawal, 
    daily_task_limit 
  } = req.body;

  try {
    const updates = {
      maintenance_mode,
      force_logout,
      registration_blocked,
      commission_l1,
      commission_l2,
      commission_l3,
      min_withdrawal,
      daily_task_limit
    };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        await db.query(
          'INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
          [key, String(value)]
        );
      }
    }

    res.json({ success: true, message: 'System configurations updated successfully.' });
  } catch (error) {
    console.error('Update Settings Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update system settings.' });
  }
};

// 3. Get Admin Dashboard Stats
exports.getStats = async (req, res) => {
  try {
    // Total members (excluding system node)
    const membersRes = await db.query('SELECT COUNT(*)::int as count FROM users WHERE id > 1');
    // Active members
    const activeRes = await db.query('SELECT COUNT(*)::int as count FROM users WHERE is_active = true AND id > 1');
    // Total tasks completed
    const tasksRes = await db.query('SELECT COUNT(*)::int as count FROM user_tasks');
    // Total activation inflows (Approved activations)
    const activationsRes = await db.query("SELECT COALESCE(SUM(amount), 0)::numeric as total FROM activations WHERE status = 'Approved'");
    // Pending withdrawals value in queue
    const withdrawalsRes = await db.query("SELECT COALESCE(SUM(amount), 0)::numeric as total FROM withdrawals WHERE status = 'Pending'");

    // Recent user signups for list
    const recentUsersRes = await db.query(
      `SELECT u.username, u.phone, u.created_at, u.wallet_balance, u.is_active, 
              (SELECT username FROM users WHERE id = u.referrer_id) as referrer
       FROM users u 
       WHERE u.id > 1 
       ORDER BY u.created_at DESC 
       LIMIT 5`
    );

    res.json({
      success: true,
      stats: {
        totalMembers: membersRes.rows[0].count,
        activeMembers: activeRes.rows[0].count,
        totalTasksCompleted: tasksRes.rows[0].count,
        totalActivations: parseFloat(activationsRes.rows[0].total),
        pendingWithdrawals: parseFloat(withdrawalsRes.rows[0].total)
      },
      recentUsers: recentUsersRes.rows
    });
  } catch (error) {
    console.error('Get Stats Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'Failed to load dashboard statistics.' });
  }
};

// 4. Get User Directory
exports.getUsers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.phone, u.is_active, u.wallet_balance, u.created_at,
              (SELECT username FROM users WHERE id = u.referrer_id) as referrer
       FROM users u
       WHERE u.id > 1
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('Get Users Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve member list.' });
  }
};

// 5. Toggle Member Activation Status
exports.toggleUserStatus = async (req, res) => {
  const { userId } = req.body;

  try {
    if (!userId) {
      return res.status(400).json({ error: 'Validation Error', message: 'User ID is required.' });
    }

    const checkRes = await db.query('SELECT is_active FROM users WHERE id = $1', [userId]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
    }

    const newStatus = !checkRes.rows[0].is_active;
    await db.query('UPDATE users SET is_active = $1 WHERE id = $2', [newStatus, userId]);

    res.json({ success: true, is_active: newStatus, message: `Account status updated successfully.` });
  } catch (error) {
    console.error('Toggle User Status Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update user status.' });
  }
};

// 6. Get Earning Tasks List
exports.getTasks = async (req, res) => {
  try {
    const result = await db.query('SELECT id, type, title, url_or_question, options, correct_answer, reward, created_at FROM tasks ORDER BY id DESC');
    res.json({ success: true, tasks: result.rows });
  } catch (error) {
    console.error('Get Tasks Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve earning tasks list.' });
  }
};

// 7. Create Earning Task
exports.createTask = async (req, res) => {
  const { type, title, url_or_question, options, correct_answer, reward } = req.body;

  try {
    if (!type || !title || !reward) {
      return res.status(400).json({ error: 'Validation Error', message: 'Type, title, and reward parameters are required.' });
    }

    const result = await db.query(
      `INSERT INTO tasks (type, title, url_or_question, options, correct_answer, reward)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, type, title, reward`,
      [type, title, url_or_question, options, correct_answer, reward]
    );

    res.status(201).json({ success: true, task: result.rows[0], message: 'Earning task created successfully.' });
  } catch (error) {
    console.error('Create Task Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'Failed to create earning task.' });
  }
};

// 8. Delete Earning Task
exports.deleteTask = async (req, res) => {
  const { id } = req.params;

  try {
    const checkRes = await db.query('SELECT id FROM tasks WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Earning task not found.' });
    }

    await db.query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ success: true, message: 'Earning task deleted successfully.' });
  } catch (error) {
    console.error('Delete Task Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'Failed to delete earning task.' });
  }
};
