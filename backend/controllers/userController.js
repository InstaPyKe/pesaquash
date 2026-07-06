const db = require('../config/db');

// Get User Dashboard Stats
exports.getDashboardStats = async (req, res) => {
  const { userId } = req.query;

  try {
    if (!userId) {
      return res.status(400).json({ error: 'Validation Error', message: 'User ID is required.' });
    }

    // 1. Fetch user base details
    const userQuery = await db.query(
      'SELECT username, phone, wallet_balance, is_active FROM users WHERE id = $1',
      [userId]
    );

    if (userQuery.rows.length === 0) {
      return res.status(444).json({ error: 'Not Found', message: 'User not found.' });
    }

    const user = userQuery.rows[0];

    // 2. Fetch daily progress (tasks completed today)
    const dailyProgressQuery = await db.query(
      'SELECT COUNT(*)::int as completed_today FROM user_tasks WHERE user_id = $1 AND completed_date = CURRENT_DATE',
      [userId]
    );
    const completedToday = dailyProgressQuery.rows[0].completed_today || 0;

    // 3. Calculate total earnings (tasks rewards + referral commissions)
    const taskEarningsQuery = await db.query(
      'SELECT COALESCE(SUM(reward_earned), 0)::numeric as total_tasks FROM user_tasks WHERE user_id = $1',
      [userId]
    );
    const commissionEarningsQuery = await db.query(
      'SELECT COALESCE(SUM(amount), 0)::numeric as total_commissions FROM commissions WHERE user_id = $1',
      [userId]
    );

    const totalTasks = parseFloat(taskEarningsQuery.rows[0].total_tasks);
    const totalCommissions = parseFloat(commissionEarningsQuery.rows[0].total_commissions);
    const totalEarnings = totalTasks + totalCommissions;

    // 4. Fetch unified Recent Activity Log (tasks + commissions + withdrawals)
    const activityQuery = await db.query(
      `
      (
        SELECT 'task' as type, t.title as activity, ut.created_at, ut.reward_earned as amount, 'Paid' as status 
        FROM user_tasks ut 
        JOIN tasks t ON ut.task_id = t.id 
        WHERE ut.user_id = $1
      )
      UNION ALL
      (
        SELECT 'commission' as type, CONCAT('Referral Commission (Level ', c.level, ') from ', u.username) as activity, c.created_at, c.amount, 'Paid' as status 
        FROM commissions c 
        JOIN users u ON c.downline_id = u.id 
        WHERE c.user_id = $1
      )
      UNION ALL
      (
        SELECT 'withdrawal' as type, CONCAT('Withdrawal to ', w.channel) as activity, w.created_at, -w.amount as amount, w.status 
        FROM withdrawals w 
        WHERE w.user_id = $1
      )
      ORDER BY created_at DESC 
      LIMIT 5
      `,
      [userId]
    );

    res.json({
      success: true,
      username: user.username,
      phone: user.phone,
      isActive: user.is_active,
      walletBalance: parseFloat(user.wallet_balance),
      totalEarnings,
      completedToday,
      recentActivities: activityQuery.rows
    });

  } catch (error) {
    console.error('Dashboard Stats API Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'An unexpected error occurred loading dashboard data.' });
  }
};

// Fetch available tasks by type (TikTok, YouTube, Trivia) that the user hasn't completed yet
exports.getTasks = async (req, res) => {
  const { userId, type } = req.query;

  try {
    if (!userId || !type) {
      return res.status(400).json({ error: 'Validation Error', message: 'User ID and task type are required.' });
    }

    // Query tasks of this type that the user has NOT completed yet
    const result = await db.query(
      `SELECT t.id, t.type, t.title, t.url_or_question, t.options, t.reward 
       FROM tasks t
       LEFT JOIN user_tasks ut ON t.id = ut.task_id AND ut.user_id = $1
       WHERE t.type = $2 AND ut.id IS NULL
       ORDER BY t.id DESC`,
      [userId, type]
    );

    res.json({ success: true, tasks: result.rows });
  } catch (error) {
    console.error('Get User Tasks Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve available tasks.' });
  }
};

// Complete a task and credit the reward
exports.completeTask = async (req, res) => {
  const { userId, taskId } = req.body;

  try {
    if (!userId || !taskId) {
      return res.status(400).json({ error: 'Validation Error', message: 'User ID and task ID are required.' });
    }

    // 1. Verify user is active
    const userRes = await db.query('SELECT is_active FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      return res.status(403).json({ error: 'Access Denied', message: 'Please activate your account to claim task rewards.' });
    }

    // 2. Verify task exists
    const taskRes = await db.query('SELECT id, reward FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rows.length === 0) {
      return res.status(444).json({ error: 'Not Found', message: 'Task not found.' });
    }
    const task = taskRes.rows[0];

    // 3. Verify user has not already completed this task
    const duplicateRes = await db.query('SELECT id FROM user_tasks WHERE user_id = $1 AND task_id = $2', [userId, taskId]);
    if (duplicateRes.rows.length > 0) {
      return res.status(409).json({ error: 'Duplicate Submission', message: 'You have already completed this task.' });
    }

    // 4. Record task completion
    await db.query(
      'INSERT INTO user_tasks (user_id, task_id, reward_earned) VALUES ($1, $2, $3)',
      [userId, taskId, task.reward]
    );

    // 5. Credit user balance
    await db.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [task.reward, userId]);

    res.json({ success: true, message: 'Reward claimed successfully!', reward: parseFloat(task.reward) });

  } catch (error) {
    console.error('Complete Task Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'Failed to claim reward.' });
  }
};

// Record daily lucky spin wheel reward
exports.spinWheel = async (req, res) => {
  const { userId, amount } = req.body;

  try {
    if (!userId || amount === undefined) {
      return res.status(400).json({ error: 'Validation Error', message: 'User ID and amount are required.' });
    }

    // 1. Verify user is active
    const userRes = await db.query('SELECT is_active FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      return res.status(403).json({ error: 'Access Denied', message: 'Please activate your account to spin the lucky wheel.' });
    }

    // 2. Check if user already spun today
    const spinCheck = await db.query(
      `SELECT ut.id FROM user_tasks ut 
       JOIN tasks t ON ut.task_id = t.id 
       WHERE ut.user_id = $1 AND t.type = 'spin' AND ut.created_at::date = CURRENT_DATE`,
      [userId]
    );

    if (spinCheck.rows.length > 0) {
      return res.status(429).json({ error: 'Limit Exceeded', message: 'You have already used your daily lucky spin.' });
    }

    // 3. Find or create the system spin task
    let spinTaskId;
    const taskRes = await db.query("SELECT id FROM tasks WHERE type = 'spin' LIMIT 1");
    if (taskRes.rows.length > 0) {
      spinTaskId = taskRes.rows[0].id;
    } else {
      const newSpin = await db.query(
        "INSERT INTO tasks (type, title, url_or_question, reward) VALUES ('spin', 'Daily Spin Wheel', 'Daily Spin Wheel', 0.00) RETURNING id"
      );
      spinTaskId = newSpin.rows[0].id;
    }

    // 4. Record spin reward
    await db.query(
      'INSERT INTO user_tasks (user_id, task_id, reward_earned) VALUES ($1, $2, $3)',
      [userId, spinTaskId, amount]
    );

    // 5. Credit user balance
    await db.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [amount, userId]);

    res.json({ success: true, message: 'Lucky Spin reward credited successfully!', amount: parseFloat(amount) });

  } catch (error) {
    console.error('Spin Wheel Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'Failed to record spin wheel reward.' });
  }
};

// Fetch user referrals list and commission summaries
exports.getReferrals = async (req, res) => {
  const { userId } = req.query;

  try {
    if (!userId) {
      return res.status(400).json({ error: 'Validation Error', message: 'User ID is required.' });
    }

    // 1. Fetch Level 1 downlines (Direct Referrals)
    const level1Res = await db.query(
      `SELECT id, username, phone, is_active, created_at,
              COALESCE((SELECT SUM(amount) FROM commissions WHERE downline_id = users.id AND user_id = $1 AND level = 1), 0)::numeric as commission_earned
       FROM users WHERE referrer_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    // 2. Fetch Level 2 downlines (Indirect Referrals)
    const level2Res = await db.query(
      `SELECT id, username, phone, is_active, created_at,
              COALESCE((SELECT SUM(amount) FROM commissions WHERE downline_id = users.id AND user_id = $1 AND level = 2), 0)::numeric as commission_earned
       FROM users 
       WHERE referrer_id IN (SELECT id FROM users WHERE referrer_id = $1)
       ORDER BY created_at DESC`,
      [userId]
    );

    // 3. Fetch Level 3 downlines (Indirect Referrals)
    const level3Res = await db.query(
      `SELECT id, username, phone, is_active, created_at,
              COALESCE((SELECT SUM(amount) FROM commissions WHERE downline_id = users.id AND user_id = $1 AND level = 3), 0)::numeric as commission_earned
       FROM users 
       WHERE referrer_id IN (SELECT id FROM users WHERE referrer_id IN (SELECT id FROM users WHERE referrer_id = $1))
       ORDER BY created_at DESC`,
      [userId]
    );

    // Calculate level totals
    const calcTotal = (rows) => rows.reduce((acc, row) => acc + parseFloat(row.commission_earned), 0);

    res.json({
      success: true,
      level1: level1Res.rows,
      level1_total: calcTotal(level1Res.rows),
      level2: level2Res.rows,
      level2_total: calcTotal(level2Res.rows),
      level3: level3Res.rows,
      level3_total: calcTotal(level3Res.rows)
    });

  } catch (error) {
    console.error('Get Referrals Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve referral data.' });
  }
};

// Request withdrawal
exports.withdraw = async (req, res) => {
  const { userId, amount, phone } = req.body;

  try {
    if (!userId || !amount || !phone) {
      return res.status(400).json({ error: 'Validation Error', message: 'User ID, amount, and phone number are required.' });
    }

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ error: 'Validation Error', message: 'Please enter a valid withdrawal amount.' });
    }

    // 1. Fetch user balance and status
    const userRes = await db.query('SELECT wallet_balance, is_active FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Access Denied', message: 'Please activate your account to withdraw funds.' });
    }

    // 2. Verify minimum withdrawal limit from settings
    const limitRes = await db.query("SELECT value FROM system_settings WHERE key = 'min_withdrawal'");
    const minLimit = limitRes.rows.length > 0 ? parseFloat(limitRes.rows[0].value) : 50.00;

    if (withdrawAmount < minLimit) {
      return res.status(400).json({ error: 'Limit Error', message: `Minimum withdrawal amount is KES ${minLimit.toFixed(2)}.` });
    }

    // 3. Verify sufficient wallet balance
    const walletBalance = parseFloat(user.wallet_balance);
    if (walletBalance < withdrawAmount) {
      return res.status(400).json({ error: 'Balance Error', message: 'Insufficient wallet balance for this withdrawal request.' });
    }

    // 4. Create pending withdrawal request
    await db.query(
      `INSERT INTO withdrawals (user_id, phone_number, amount, status, channel) 
       VALUES ($1, $2, $3, 'Pending', 'M-Pesa')`,
      [userId, phone, withdrawAmount]
    );

    // 5. Deduct wallet balance
    await db.query('UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2', [withdrawAmount, userId]);

    res.json({ success: true, message: `Withdrawal request of KES ${withdrawAmount.toFixed(2)} submitted successfully.` });

  } catch (error) {
    console.error('Withdrawal Request Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'Failed to process withdrawal request.' });
  }
};
