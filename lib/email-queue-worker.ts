import { processEmailQueue } from "@/lib/mailer";

type EmailQueueWorkerState = {
  started: boolean;
  running: boolean;
  timer: NodeJS.Timeout | null;
};

const globalForEmailQueueWorker = globalThis as typeof globalThis & {
  emailQueueWorker?: EmailQueueWorkerState;
};

export function startEmailQueueWorker() {
  if (!isWorkerEnabled()) {
    return;
  }

  if (globalForEmailQueueWorker.emailQueueWorker?.started) {
    return;
  }

  const state: EmailQueueWorkerState = {
    started: true,
    running: false,
    timer: null,
  };

  const tick = async () => {
    if (state.running) {
      return;
    }

    state.running = true;

    try {
      await processEmailQueue();
    } catch (error) {
      console.error("[knowledge][email-queue-worker]", error);
    } finally {
      state.running = false;
    }
  };

  state.timer = setInterval(() => {
    void tick();
  }, getWorkerIntervalMs());

  state.timer.unref?.();
  globalForEmailQueueWorker.emailQueueWorker = state;

  void tick();
}

function isWorkerEnabled() {
  const value = process.env.EMAIL_QUEUE_AUTOSTART;
  if (value === undefined || value === "") {
    return true;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function getWorkerIntervalMs() {
  const seconds = Number(process.env.EMAIL_QUEUE_POLL_INTERVAL_SECONDS ?? 30);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 30_000;
  }

  return Math.floor(seconds * 1000);
}
