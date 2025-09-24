import { AnswersApiService } from "./services/answersApi";
import { config } from "./config/config";
import logger from "./services/logger";

export class PostMonitor {
  private answersApi: AnswersApiService;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.answersApi = new AnswersApiService();
  }

  /**
   * Start monitoring for new posts
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Monitor is already running");
      return;
    }

    logger.info("Starting Apache Answers post monitor...");

    // Test connection first
    const isConnected = await this.answersApi.testConnection();
    if (!isConnected) {
      logger.error("Failed to connect to Apache Answers. Monitor not started.");
      return;
    }

    this.isRunning = true;

    // Check immediately
    await this.checkForNewPosts();

    // Set up interval
    this.intervalId = setInterval(async () => {
      await this.checkForNewPosts();
    }, config.monitoring.checkIntervalMs);

    logger.info(
      `Monitor started. Checking every ${config.monitoring.checkIntervalMs}ms`
    );
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn("Monitor is not running");
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info("Monitor stopped");
  }

  /**
   * Check for new posts and log them
   */
  private async checkForNewPosts(): Promise<void> {
    try {
      logger.info("⏰ Starting post check cycle...");
      const newPosts = await this.answersApi.checkForNewPosts();

      if (newPosts.length > 0) {
        logger.info(
          `🎉 Found ${newPosts.length} new post(s) in Apache Answers!`
        );

        newPosts.forEach((post, index) => {
          logger.info(`📝 New Post #${index + 1}:`, {
            id: post.id,
            title: post.title,
            author: post.operator.username,
            created_at: post.created_at,
            tags: post.tags,
            url: `${config.answers.baseUrl}/questions/${post.id}`,
          });
        });
      } else {
        logger.info("📭 No new posts found this cycle");
      }

      logger.info("✅ Post check cycle completed");
    } catch (error) {
      logger.error("❌ Error checking for new posts:", error);
    }
  }

  /**
   * Get monitor status
   */
  getStatus(): { isRunning: boolean; checkInterval: number } {
    return {
      isRunning: this.isRunning,
      checkInterval: config.monitoring.checkIntervalMs,
    };
  }
}
