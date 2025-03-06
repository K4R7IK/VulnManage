// utils/progressTracker.ts

interface ProgressData {
  status: "pending" | "processing" | "completed" | "error";
  progress: number; // 0-100
  message: string;
  error?: string;
  startTime: number;
  lastUpdateTime: number;
}

// Map to store progress data by operation ID
const progressMap = new Map<string, ProgressData>();

// Clean up stale progress data (older than 1 hour)
function cleanupStaleData() {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  progressMap.forEach((data, id) => {
    if (now - data.lastUpdateTime > ONE_HOUR) {
      progressMap.delete(id);
    }
  });
}

// Run cleanup every 30 minutes
setInterval(cleanupStaleData, 30 * 60 * 1000);

export const ProgressTracker = {
  // Initialize a new progress tracker with a unique ID
  create: (id: string): void => {
    progressMap.set(id, {
      status: "pending",
      progress: 0,
      message: "Initializing...",
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
    });
  },

  // Update progress for a specific operation
  update: (
    id: string,
    data: Partial<Omit<ProgressData, "startTime" | "lastUpdateTime">>,
  ): void => {
    const current = progressMap.get(id);
    if (current) {
      progressMap.set(id, {
        ...current,
        ...data,
        lastUpdateTime: Date.now(),
      });
    }
  },

  // Get current progress for an operation
  get: (id: string): ProgressData | undefined => {
    return progressMap.get(id);
  },

  // Delete progress data when no longer needed
  delete: (id: string): void => {
    progressMap.delete(id);
  },
};
