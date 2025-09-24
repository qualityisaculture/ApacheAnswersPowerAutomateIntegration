import { AnswersApiService } from "./services/answersApi";
import { TeamsService } from "./services/teamsService";
import { config } from "./config/config";
import logger from "./services/logger";

export class PostMonitor {
  private answersApi: AnswersApiService;
  private teamsService: TeamsService;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.answersApi = new AnswersApiService();
    this.teamsService = new TeamsService();
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
      const newPosts = await this.answersApi.checkForNewPosts();

      if (newPosts.length > 0) {
        for (const post of newPosts) {
          logger.info(
            `📝 New Post: ${post.title} by ${post.operator.username}`
          );

          // Send to Teams
          try {
            await this.teamsService.sendPostToTeams(post);
          } catch (error) {
            logger.error(`❌ Failed to send post to Teams:`, error);
          }
        }
      }
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
