import { PostMonitor } from "./monitor";
import { CallbackService } from "./services/callbackService";
import { config } from "./config/config";
import logger from "./services/logger";

async function main() {
  logger.info("🚀 Starting Apache Answers - Teams Integration");

  const monitor = new PostMonitor();
  const callbackService = new CallbackService();

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("Received SIGINT, shutting down gracefully...");
    monitor.stop();
    await callbackService.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("Received SIGTERM, shutting down gracefully...");
    monitor.stop();
    await callbackService.stop();
    process.exit(0);
  });

  try {
    // Start the callback service first
    await callbackService.start();

    // Start the monitor
    await monitor.start();

    // Keep the process running
    setInterval(() => {
      const monitorStatus = monitor.getStatus();
      const callbackStatus = callbackService.getStatus();
      logger.debug(
        `Monitor status: ${monitorStatus.isRunning ? "Running" : "Stopped"}, ` +
          `Callback service: ${
            callbackStatus.isRunning ? "Running" : "Stopped"
          } on port ${callbackStatus.port}`
      );
    }, 60000); // Log status every minute
  } catch (error) {
    logger.error("Failed to start services:", error);
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
