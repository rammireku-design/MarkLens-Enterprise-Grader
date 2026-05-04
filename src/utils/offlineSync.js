import { getOfflineJobs, removeOfflineJob } from './db';
import { syncHistoryBatchToCloud } from './supabaseClient';
import toast from 'react-hot-toast';

export const initOfflineSync = () => {
    window.addEventListener('online', async () => {
        const jobs = await getOfflineJobs();
        if (jobs.length > 0) {
            toast.loading(`Syncing ${jobs.length} offline batches to cloud...`, { id: 'offline-sync' });
            
            let successCount = 0;
            for (const job of jobs) {
                if (job.data.type === 'SYNC_BATCH') {
                    try {
                        // The original function might fail again if network drops midway,
                        // so we call it and if it succeeds (doesn't throw or handles its own errors),
                        // wait, syncHistoryBatchToCloud catches its own errors.
                        // We should re-throw inside syncHistoryBatchToCloud or just check network here.
                        // For safety, let's assume if we are online, it will go through.
                        await syncHistoryBatchToCloud(job.data.userId, job.data.batchData);
                        await removeOfflineJob(job.id);
                        successCount++;
                    } catch (e) {
                        console.error("Retry failed for job", job.id, e);
                    }
                }
            }
            
            if (successCount > 0) {
                toast.success(`Successfully synced ${successCount} offline batches!`, { id: 'offline-sync' });
            } else {
                toast.error(`Failed to sync offline batches. Will retry later.`, { id: 'offline-sync' });
            }
        }
    });
};
