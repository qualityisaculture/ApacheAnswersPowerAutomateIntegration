import { AnswersApiService } from "./services/answersApi";
import { TeamsService } from "./services/teamsService";
import { AnswerTracker } from "./services/answerTracker";
import { config } from "./config/config";
import logger from "./services/logger";

export class PostMonitor {
  private answersApi: AnswersApiService;
  private teamsService: TeamsService;
  private answerTracker: AnswerTracker;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.answersApi = new AnswersApiService();
    this.teamsService = new TeamsService();
    this.answerTracker = new AnswerTracker();
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
          // Check if this post has the "from_teams" tag to prevent infinite loops
          const hasFromTeamsTag = post.tags.some(
            (tag) => tag.slug_name === "from_teams"
          );

          if (hasFromTeamsTag) {
            logger.info(
              `🚫 Skipping post with "from_teams" tag: ${post.title} by ${post.operator.username}`
            );
            continue;
          }

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

      // Check for answers on all recent questions
      await this.checkForAnswers();

      // Periodically clean up old tracked questions (every 10th check)
      const cleanupCounter = Math.floor(
        Date.now() / (config.monitoring.checkIntervalMs * 10)
      );
      if (cleanupCounter % 10 === 0) {
        this.teamsService.getSentQuestionsTracker().clearOldQuestions();
      }
    } catch (error) {
      logger.error("❌ Error checking for new posts:", error);
    }
  }

  /**
   * Check for answers on all questions and detect new ones
   */
  private async checkForAnswers(): Promise<void> {
    try {
      // Get all questions (using a larger page size to get more questions)
      const allPosts = await this.answersApi.getRecentPosts(1, 100);

      let totalNewAnswers = 0;
      const newAnswerDetails: string[] = [];

      for (const post of allPosts) {
        try {
          const answers = await this.answersApi.getAnswersForQuestion(post.id);
          const answerIds = answers.map((answer) => answer.id);

          // Update tracking and get new answers
          const newAnswerIds = this.answerTracker.updateQuestionAnswers(
            post.id,
            post.title,
            answerIds
          );

          totalNewAnswers += newAnswerIds.length;

          // Collect new answer details and handle Teams replies
          if (newAnswerIds.length > 0) {
            newAnswerDetails.push(
              `"${post.title}": [${newAnswerIds.join(", ")}]`
            );

            // Try to reply to the Teams message if this question has one
            try {
              const teamsMessageId =
                await this.answersApi.getTeamsMessageIdForQuestion(post.id);
              if (teamsMessageId) {
                const answerUrl = `${config.answers.baseUrl}/questions/${post.id}`;

                // Get the actual answer content for the new answers
                const newAnswers = answers.filter((answer) =>
                  newAnswerIds.includes(answer.id)
                );
                const answerMessages = newAnswers
                  .map((answer) => {
                    const content =
                      answer.content.substring(0, 200) +
                      (answer.content.length > 200 ? "..." : "");
                    return `**${answer.user_info.display_name}**: ${content}`;
                  })
                  .join("\n\n");

                const answerText = `New answer added:\n\n${answerMessages}`;

                await this.teamsService.replyToTeamsMessageWithURL(
                  teamsMessageId,
                  answerUrl,
                  answerText
                );

                logger.info(
                  `📤 Replied to Teams message for question "${post.title}"`
                );
              } else {
                logger.debug(
                  `No Teams message ID found for question "${post.title}"`
                );
              }
            } catch (teamsError) {
              logger.error(
                `❌ Failed to reply to Teams for question "${post.title}":`,
                teamsError
              );
            }
          }
        } catch (error) {
          logger.error(
            `❌ Failed to fetch answers for question "${post.title}" (ID: ${post.id}):`,
            error
          );
        }
      }

      if (totalNewAnswers > 0) {
        logger.info(`🆕 New answers found: ${newAnswerDetails.join(", ")}`);
      } else {
        logger.info("No new answers");
      }

      // Clean up old tracked questions periodically
      this.answerTracker.cleanupOldQuestions();
    } catch (error) {
      logger.error("❌ Error checking for answers:", error);
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
