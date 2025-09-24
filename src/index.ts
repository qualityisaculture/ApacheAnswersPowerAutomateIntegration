import { PostMonitor } from "./monitor";
import logger from "./services/logger";

async function main() {
  logger.info("🚀 Starting Apache Answers - Teams Integration");

  const monitor = new PostMonitor();

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    logger.info("Received SIGINT, shutting down gracefully...");
    monitor.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM, shutting down gracefully...");
    monitor.stop();
    process.exit(0);
  });

  try {
    await monitor.start();

    // Keep the process running
    setInterval(() => {
      const status = monitor.getStatus();
      logger.debug(
        `Monitor status: ${status.isRunning ? "Running" : "Stopped"}`
      );
    }, 60000); // Log status every minute
  } catch (error) {
    logger.error("Failed to start monitor:", error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main().catch((error) => {
    logger.error("Unhandled error:", error);
    process.exit(1);
  });
}

export { PostMonitor };
