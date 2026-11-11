import { scheduledCloverSync } from '../_clover-schedule.js';
export const config = { maxDuration: 60 };
// Yesterday catches payments spanning midnight; overnight reconciliation covers older edits.
export default scheduledCloverSync({ lookbackDays: 1, budgetMs: 45_000, batchLimit: 100 });
