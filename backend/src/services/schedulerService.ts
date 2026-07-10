import { processOverdueFollowups, processDormantLeads } from './reminderProcessor';
import { sendDailyDigests } from './digestProcessor';
import { runEscalationChecks } from './escalationService';

type Job = {
  name: string;
  intervalMs: number;
  fn: () => Promise<void>;
  lastRun: number;
  timer?: ReturnType<typeof setInterval>;
};

const jobs: Job[] = [];

function addJob(name: string, intervalMs: number, fn: () => Promise<void>) {
  jobs.push({ name, intervalMs, fn, lastRun: 0 });
}

async function runJob(job: Job) {
  try {
    await job.fn();
  } catch (e: any) {
    console.error(`[scheduler] Job "${job.name}" failed:`, e.message);
  }
  job.lastRun = Date.now();
}

function scheduleNextRun(job: Job) {
  if (job.timer) clearInterval(job.timer);
  job.timer = setInterval(() => runJob(job), job.intervalMs);
}

export function startScheduler() {
  addJob('overdue-followups', 5 * 60 * 1000, processOverdueFollowups);
  addJob('dormant-leads', 15 * 60 * 1000, processDormantLeads);
  addJob('escalation-checks', 10 * 60 * 1000, runEscalationChecks);

  const now = new Date();
  const msUntil8am = (
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0).getTime() - now.getTime()
  );

  setTimeout(() => sendDailyDigests(), msUntil8am > 0 ? msUntil8am : msUntil8am + 86400000);
  addJob('daily-digest', 86400000, sendDailyDigests);

  for (const job of jobs) {
    scheduleNextRun(job);
    console.log(`[scheduler] Registered job: ${job.name} (every ${job.intervalMs / 60000}min)`);
  }
  console.log(`[scheduler] Daily digest scheduled for 08:00 local time`);
}

export function stopScheduler() {
  for (const job of jobs) {
    if (job.timer) clearInterval(job.timer);
  }
  jobs.length = 0;
}
