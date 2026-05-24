import cron from 'node-cron';
import AccountService from '../services/AccountService.js';

// 每週一至週五 14:30（台股收盤後）為所有活躍用戶建立每日快照
cron.schedule('30 14 * * 1-5', async () => {
  console.log('[SnapshotJob] Running daily snapshot job...');
  try {
    await AccountService.createDailySnapshotsForAllUsers();
  } catch (err) {
    console.error('[SnapshotJob] Failed:', err.message);
  }
}, {
  timezone: 'Asia/Taipei',
});

console.log('[SnapshotJob] Scheduled: weekdays at 14:30 (Asia/Taipei)');
