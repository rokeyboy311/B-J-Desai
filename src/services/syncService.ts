import { executeApiAction, getPendingQueue, clearPendingQueue } from './api';

export async function processPendingQueue(): Promise<{ processed: number; errors: number }> {
  const pending = getPendingQueue();
  if (pending.length === 0) return { processed: 0, errors: 0 };

  let processed = 0;
  let errors = 0;

  for (const item of pending) {
    try {
      await executeApiAction(item.action, item.payload, item.requestId);
      processed++;
    } catch (err) {
      console.error(`Failed to process pending item ${item.requestId}:`, err);
      errors++;
    }
  }

  if (errors === 0) {
    clearPendingQueue();
  }

  return { processed, errors };
}

export async function triggerManualBackup(frequency: 'Daily' | 'Weekly' | 'Monthly' = 'Daily') {
  return await executeApiAction('BACKUP_DATABASE', { frequency });
}

export async function restoreDatabase(backupData: any, adminPin: string) {
  return await executeApiAction('RESTORE_DATABASE', { backupData, adminPin });
}
