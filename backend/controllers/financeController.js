const db = require('../config/db');

// Get Finance stats
exports.getStats = async (req, res) => {
  try {
    // 1. Total Paid Activations
    const activationsQuery = await db.query(
      "SELECT COALESCE(SUM(amount), 0)::numeric as total_inflow FROM activations WHERE status = 'Approved'"
    );
    const totalInflow = parseFloat(activationsQuery.rows[0].total_inflow);

    // 2. Pending Withdrawals
    const pendingWithdrawalsQuery = await db.query(
      "SELECT COALESCE(SUM(amount), 0)::numeric as total_pending FROM withdrawals WHERE status = 'Pending'"
    );
    const totalPending = parseFloat(pendingWithdrawalsQuery.rows[0].total_pending);

    // 3. Total Completed Payouts
    const completedPayoutsQuery = await db.query(
      "SELECT COALESCE(SUM(amount), 0)::numeric as total_completed FROM withdrawals WHERE status = 'Completed'"
    );
    const totalCompleted = parseFloat(completedPayoutsQuery.rows[0].total_completed);

    // Net Profit
    const netProfit = totalInflow - totalCompleted - totalPending;

    // 4. Recent Transactions Ledger (Union of approved activations and recent withdrawals)
    const ledgerQuery = await db.query(
      `
      (
        SELECT 'Activation Fee' as type, a.phone_number as phone, a.created_at as timestamp, a.amount::numeric, a.status, a.transaction_code
        FROM activations a
        ORDER BY a.created_at DESC
        LIMIT 10
      )
      UNION ALL
      (
        SELECT CONCAT('Withdrawal (', w.channel, ')') as type, w.phone_number as phone, w.created_at as timestamp, -w.amount::numeric as amount, w.status, w.transaction_code
        FROM withdrawals w
        ORDER BY w.created_at DESC
        LIMIT 10
      )
      ORDER BY timestamp DESC
      LIMIT 10
      `
    );

    res.json({
      success: true,
      totalInflow,
      totalPending,
      totalCompleted,
      netProfit,
      ledger: ledgerQuery.rows
    });
  } catch (error) {
    console.error('Finance Stats Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'An unexpected error occurred.' });
  }
};

// Get all activations
exports.getActivations = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, user_id, transaction_code, phone_number, amount, status, created_at FROM activations ORDER BY created_at DESC'
    );
    res.json({
      success: true,
      activations: result.rows
    });
  } catch (error) {
    console.error('Get Activations Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'An unexpected error occurred.' });
  }
};

// Manual override/approval of activation payment
exports.overrideActivation = async (req, res) => {
  const { transactionCode } = req.body;
  try {
    const activationQuery = await db.query('SELECT user_id, status FROM activations WHERE transaction_code = $1', [transactionCode]);
    if (activationQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Transaction not found.' });
    }

    const { user_id, status } = activationQuery.rows[0];
    if (status === 'Approved') {
      return res.status(400).json({ error: 'Bad Request', message: 'Transaction already approved.' });
    }

    // Begin Transaction
    await db.query('BEGIN');

    // 1. Update activation status
    await db.query(
      "UPDATE activations SET status = 'Approved' WHERE transaction_code = $1",
      [transactionCode]
    );

    // 2. Activate user
    await db.query(
      "UPDATE users SET is_active = TRUE WHERE id = $1",
      [user_id]
    );

    // 3. Fetch referrer details for MLM commission payouts
    const userQuery = await db.query(
      'SELECT username, referrer_id FROM users WHERE id = $1',
      [user_id]
    );
    const user = userQuery.rows[0];

    // MLM Commission levels percentage rates (L1: 50%, L2: 20%, L3: 10%)
    // Fetch rates from system settings
    const settingsResult = await db.query('SELECT key, value FROM system_settings');
    const settings = {};
    settingsResult.rows.forEach(r => { settings[r.key] = r.value; });

    const l1_rate = parseFloat(settings.commission_l1 || '50') / 100;
    const l2_rate = parseFloat(settings.commission_l2 || '20') / 100;
    const l3_rate = parseFloat(settings.commission_l3 || '10') / 100;
    const fee = 500.00;

    let currentReferrerId = user.referrer_id;

    // LEVEL 1 COMMISSION
    if (currentReferrerId) {
      const amount = fee * l1_rate;
      await db.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [amount, currentReferrerId]);
      await db.query(
        'INSERT INTO commissions (user_id, downline_id, level, amount) VALUES ($1, $2, 1, $3)',
        [currentReferrerId, user_id, amount]
      );

      // Fetch Level 1 referrer node to payout Level 2
      const r1Query = await db.query('SELECT referrer_id FROM users WHERE id = $1', [currentReferrerId]);
      currentReferrerId = r1Query.rows[0]?.referrer_id;

      // LEVEL 2 COMMISSION
      if (currentReferrerId) {
        const amount2 = fee * l2_rate;
        await db.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [amount2, currentReferrerId]);
        await db.query(
          'INSERT INTO commissions (user_id, downline_id, level, amount) VALUES ($1, $2, 2, $3)',
          [currentReferrerId, user_id, amount2]
        );

        // Fetch Level 2 referrer node to payout Level 3
        const r2Query = await db.query('SELECT referrer_id FROM users WHERE id = $1', [currentReferrerId]);
        currentReferrerId = r2Query.rows[0]?.referrer_id;

        // LEVEL 3 COMMISSION
        if (currentReferrerId) {
          const amount3 = fee * l3_rate;
          await db.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [amount3, currentReferrerId]);
          await db.query(
            'INSERT INTO commissions (user_id, downline_id, level, amount) VALUES ($1, $2, 3, $3)',
            [currentReferrerId, user_id, amount3]
          );
        }
      }
    }

    await db.query('COMMIT');
    res.json({ success: true, message: 'Transaction approved and account activated.' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Override Activation Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'An unexpected error occurred.' });
  }
};

// Get all withdrawals
exports.getWithdrawals = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT w.id, w.user_id, w.phone_number, w.channel, w.amount, w.status, w.transaction_code, w.created_at, u.username
       FROM withdrawals w
       JOIN users u ON w.user_id = u.id
       ORDER BY w.created_at DESC`
    );
    res.json({
      success: true,
      withdrawals: result.rows
    });
  } catch (error) {
    console.error('Get Withdrawals Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'An unexpected error occurred.' });
  }
};

// Approve withdrawal manually or automatically
exports.approveWithdrawal = async (req, res) => {
  const { withdrawalId, transactionCode } = req.body;
  try {
    const withdrawalQuery = await db.query('SELECT status, user_id, amount FROM withdrawals WHERE id = $1', [withdrawalId]);
    if (withdrawalQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Withdrawal request not found.' });
    }

    const { status, user_id, amount } = withdrawalQuery.rows[0];
    if (status !== 'Pending') {
      return res.status(400).json({ error: 'Bad Request', message: 'Withdrawal already processed.' });
    }

    const code = transactionCode || 'MPESA' + Math.random().toString(36).substr(2, 9).toUpperCase();

    // Begin Transaction
    await db.query('BEGIN');

    // Update status to Completed
    await db.query(
      "UPDATE withdrawals SET status = 'Completed', transaction_code = $1 WHERE id = $2",
      [code, withdrawalId]
    );

    await db.query('COMMIT');
    res.json({ success: true, message: 'Withdrawal request approved successfully.', transactionCode: code });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Approve Withdrawal Error:', error.message);
    res.status(500).json({ error: 'Server Error', message: 'An unexpected error occurred.' });
  }
};
