// utils/progressTracker.ts
import fs from "fs";
import path from "path";

interface ProgressData {
  status: "pending" | "processing" | "completed" | "error";
  progress: number; // 0-100
  message: string;
  error?: string;
  startTime: number;
  lastUpdateTime: number;
}

// Create a directory for storing progress data
const PROGRESS_DIR = path.join(process.cwd(), "tmp", "progress");

// Ensure the progress directory exists
try {
  if (!fs.existsSync(path.join(process.cwd(), "tmp"))) {
    fs.mkdirSync(path.join(process.cwd(), "tmp"));
  }
  if (!fs.existsSync(PROGRESS_DIR)) {
    fs.mkdirSync(PROGRESS_DIR);
  }
} catch (error) {
  console.error("Error creating progress directory:", error);
}

// Helper function to get the file path for an operation ID
const getFilePath = (id: string): string => {
  return path.join(PROGRESS_DIR, `${id}.json`);
};

// Helper function to clean up old files
const cleanupStaleFiles = (): void => {
  try {
    const now = Date.now();
    const TWO_HOURS = 2 * 60 * 60 * 1000;

    if (fs.existsSync(PROGRESS_DIR)) {
      const files = fs.readdirSync(PROGRESS_DIR);

      files.forEach((file) => {
        const filePath = path.join(PROGRESS_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > TWO_HOURS) {
            fs.unlinkSync(filePath);
            console.log(`Removed stale progress file: ${file}`);
          }
        } catch (fileError) {
          console.error(`Error checking file stats for ${file}:`, fileError);
        }
      });
    }
  } catch (error) {
    console.error("Error cleaning up stale files:", error);
  }
};

// Run cleanup every hour
setInterval(cleanupStaleFiles, 60 * 60 * 1000);

// Memory cache to avoid excessive file reads
const inMemoryCache = new Map<
  string,
  { data: ProgressData; expires: number }
>();

export const ProgressTracker = {
  // Initialize a new progress tracker with a unique ID
  create: (id: string): void => {
    console.log(`Creating progress tracker for operation ${id}`);

    const progressData: ProgressData = {
      status: "pending",
      progress: 0,
      message: "Initializing...",
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
    };

    // Save to file
    try {
      fs.writeFileSync(getFilePath(id), JSON.stringify(progressData));

      // Update memory cache
      inMemoryCache.set(id, {
        data: progressData,
        expires: Date.now() + 30000, // Cache for 30 seconds
      });
    } catch (error) {
      console.error(`Error creating progress tracker for ${id}:`, error);
    }
  },

  // Update progress for a specific operation
  update: (
    id: string,
    data: Partial<Omit<ProgressData, "startTime" | "lastUpdateTime">>,
  ): void => {
    try {
      const filePath = getFilePath(id);
      let currentData: ProgressData;

      // Try to get from cache first
      const cachedItem = inMemoryCache.get(id);

      if (cachedItem && cachedItem.expires > Date.now()) {
        currentData = cachedItem.data;
      } else if (fs.existsSync(filePath)) {
        // Read from file if not in cache
        const fileData = fs.readFileSync(filePath, "utf8");
        currentData = JSON.parse(fileData);
      } else {
        // Create new if doesn't exist
        console.warn(
          `Attempted to update non-existent progress tracker: ${id}`,
        );
        ProgressTracker.create(id);
        const fileData = fs.readFileSync(filePath, "utf8");
        currentData = JSON.parse(fileData);
      }

      // Update the data
      const updatedData: ProgressData = {
        ...currentData,
        ...data,
        lastUpdateTime: Date.now(),
      };

      console.log(
        `Updating progress for operation ${id}: ${updatedData.status || currentData.status} - ${updatedData.progress || currentData.progress}%`,
      );

      // Write updated data to file
      fs.writeFileSync(filePath, JSON.stringify(updatedData));

      // Update memory cache
      inMemoryCache.set(id, {
        data: updatedData,
        expires: Date.now() + 30000, // Cache for 30 seconds
      });
    } catch (error) {
      console.error(`Error updating progress for ${id}:`, error);
    }
  },

  // Get current progress for an operation
  get: (id: string): ProgressData | undefined => {
    try {
      const filePath = getFilePath(id);

      // Try to get from cache first
      const cachedItem = inMemoryCache.get(id);

      if (cachedItem && cachedItem.expires > Date.now()) {
        return cachedItem.data;
      } else if (fs.existsSync(filePath)) {
        // Read from file if not in cache
        const fileData = fs.readFileSync(filePath, "utf8");
        const data = JSON.parse(fileData) as ProgressData;

        // Update cache
        inMemoryCache.set(id, {
          data,
          expires: Date.now() + 30000, // Cache for 30 seconds
        });

        return data;
      }

      console.warn(`Progress data not found for operation: ${id}`);
      return undefined;
    } catch (error) {
      console.error(`Error getting progress for ${id}:`, error);
      return undefined;
    }
  },

  // Delete progress data when no longer needed
  delete: (id: string): void => {
    try {
      const filePath = getFilePath(id);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        inMemoryCache.delete(id);
        console.log(`Deleted progress tracker for operation ${id}`);
      }
    } catch (error) {
      console.error(`Error deleting progress tracker for ${id}:`, error);
    }
  },
};
