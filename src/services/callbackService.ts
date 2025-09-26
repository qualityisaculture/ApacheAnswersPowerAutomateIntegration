import express, { Request, Response } from "express";
import { config } from "../config/config";
import { AnswersApiService } from "./answersApi";
import { TeamsService } from "./teamsService";
import logger from "./logger";

export interface PowerAutomateCallback {
  messageId: string;
  messageLink: string;
  body: string;
  postId: string;
  timestamp?: string;
}

export class CallbackService {
  private app: express.Application;
  private server: any;
  private port: number;
  private answersApi: AnswersApiService;
  private teamsService: TeamsService;

  constructor(port?: number) {
    this.app = express();
    this.port = port || config.callback.port;
    this.answersApi = new AnswersApiService();
    this.teamsService = new TeamsService();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json());

    // Log all incoming requests
    this.app.use((req: Request, res: Response, next) => {
      logger.info(`📥 Incoming ${req.method} request to ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get("/health", (req: Request, res: Response) => {
      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "Apache Answers Teams Integration",
      });
    });

    // Teams message callback endpoint
    this.app.get(
      "/callback/teams-message",
      async (req: Request, res: Response) => {
        try {
          const item = req.query.item as string;
          const teamId = req.query.teamId as string;
          const channelId = req.query.channelId as string;
          const messageId = req.query.messageId as string;
          const messageLink = req.query.messageLink as string;
          const tag = req.query.tag as string;

          // Log the received parameters
          logger.info("📨 Received Teams message callback:", {
            item,
            teamId,
            channelId,
            messageId,
            messageLink,
            tag,
            timestamp: new Date().toISOString(),
          });

          // Log detailed information
          logger.info(`📦 Item: ${JSON.stringify(item, null, 2)}`);
          logger.info(`👥 Team ID: ${teamId}`);
          logger.info(`💬 Channel ID: ${channelId}`);
          logger.info(`📨 Message ID: ${messageId}`);
          logger.info(`🔗 Message Link: ${messageLink}`);
          logger.info(`🏷️ Tag: ${tag || "No tag provided"}`);

          // Extract message content from item (item is a string from query params)
          let messageContent = "No content available";
          try {
            const itemObj = JSON.parse(item);
            messageContent =
              itemObj?.body?.content ||
              itemObj?.text ||
              item ||
              "No content available";
          } catch {
            // If item is not JSON, use it as plain text
            messageContent = item || "No content available";
          }

          // Create title from first line of message, truncated to 50 characters with ellipses
          // Strip HTML tags from the content first
          const strippedContent = messageContent.replace(/<[^>]*>/g, "");
          const firstLine = strippedContent.split("\n")[0].trim();
          const messageTitle =
            firstLine.length > 50
              ? firstLine.substring(0, 50) + "..."
              : firstLine;

          // Check if this message is a duplicate of a question we recently sent to Teams
          logger.info(`🔍 Checking for duplicate message: "${messageTitle}"`);
          logger.info(
            `📝 Message content preview: "${strippedContent.substring(
              0,
              100
            )}..."`
          );

          const sentQuestionsTracker =
            this.teamsService.getSentQuestionsTracker();
          logger.info(
            `📊 Tracker stats before check:`,
            sentQuestionsTracker.getStats()
          );

          const isDuplicate = sentQuestionsTracker.isDuplicateMessage(
            messageTitle,
            strippedContent
          );

          if (isDuplicate) {
            logger.info(
              `🚫 DUPLICATE DETECTED! Skipping message: "${messageTitle}"`
            );
            logger.info(
              `📊 Tracker stats after check:`,
              sentQuestionsTracker.getStats()
            );
            res.status(200).json({
              success: true,
              message: "Duplicate message detected and skipped",
              timestamp: new Date().toISOString(),
              duplicate: true,
            });
            return;
          } else {
            logger.info(
              `✅ No duplicate detected, proceeding with message processing`
            );
          }

          // Post the Teams message as a question to Apache Answers
          try {
            const questionResponse =
              await this.answersApi.postTeamsMessageAsQuestion(
                messageTitle,
                strippedContent,
                teamId,
                channelId,
                messageId,
                messageLink,
                tag
              );

            // Extract the question ID from the response
            const questionId = questionResponse.data.id;

            logger.info(
              `✅ Successfully posted Teams message as question with ID: ${questionId}`
            );

            // Add a comment with the messageId to the question
            try {
              await this.answersApi.postComment(
                questionId,
                `Teams Message ID: ${messageId}`
              );
              logger.info(
                `✅ Successfully added messageId comment to question ${questionId}`
              );
            } catch (commentError) {
              logger.error(
                `❌ Failed to add messageId comment to question ${questionId}:`,
                commentError
              );
              // Don't fail the entire request if comment fails
            }

            // Send notification back to Teams with the question URL
            try {
              const questionUrl = `${config.answers.baseUrl}/questions/${questionId}`;
              await this.teamsService.sendNewQuestionNotification(
                messageId,
                questionUrl,
                messageTitle
              );
              logger.info(
                `📊 Tracker stats after processing:`,
                sentQuestionsTracker.getStats()
              );
            } catch (notificationError) {
              logger.error(
                `❌ Failed to send Teams notification:`,
                notificationError
              );
              // Don't fail the entire request if notification fails
            }

            // Respond with success
            res.status(200).json({
              success: true,
              message: "Teams message posted as question successfully",
              timestamp: new Date().toISOString(),
              questionId: questionId,
              receivedData: {
                item,
                teamId,
                channelId,
                messageId,
                messageLink,
                tag,
              },
            });
          } catch (questionError) {
            logger.error(
              `❌ Failed to post Teams message as question:`,
              questionError
            );

            // Still respond with success for the callback, but indicate the question posting failed
            res.status(200).json({
              success: true,
              message:
                "Teams message callback received but failed to post as question",
              timestamp: new Date().toISOString(),
              error:
                questionError instanceof Error
                  ? questionError.message
                  : "Unknown error",
              receivedData: {
                item,
                teamId,
                channelId,
                messageId,
                messageLink,
                tag,
              },
            });
          }
        } catch (error) {
          logger.error("❌ Error processing Teams message callback:", error);
          res.status(500).json({
            success: false,
            message: "Error processing Teams message callback",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    );

    // Power Automate callback endpoint
    this.app.get(
      "/callback/power-automate",
      async (req: Request, res: Response) => {
        try {
          const callbackData: PowerAutomateCallback = {
            messageId: req.query.messageId as string,
            messageLink: req.query.messageLink as string,
            body: req.query.body as string,
            postId: req.query.postId as string,
            timestamp:
              (req.query.timestamp as string) || new Date().toISOString(),
          };

          // Log the callback data
          logger.info("🔄 Received Power Automate callback:", {
            messageId: callbackData.messageId,
            messageLink: callbackData.messageLink,
            body: callbackData.body,
            postId: callbackData.postId,
            timestamp: callbackData.timestamp,
          });

          // Log detailed information
          logger.info(`📨 Message ID: ${callbackData.messageId}`);
          logger.info(`🔗 Message Link: ${callbackData.messageLink}`);
          logger.info(`📝 Message Body: ${callbackData.body}`);
          logger.info(`🔍 Apache Answers Post ID: ${callbackData.postId}`);

          if (callbackData.postId) {
            try {
              // Post a comment to the Apache Answers post with messageId
              await this.answersApi.postComment(
                callbackData.postId,
                `Teams Message ID: ${callbackData.messageId}`
              );

              // Post a separate comment with the Teams link
              await this.answersApi.postComment(
                callbackData.postId,
                `[View in Teams](${callbackData.messageLink})`
              );

              logger.info(
                `✅ Successfully posted Teams message comment to Apache Answers post ${callbackData.postId}`
              );
            } catch (commentError) {
              logger.error(
                `❌ Failed to post comment to Apache Answers post ${callbackData.postId}:`,
                commentError
              );
              // Don't fail the entire callback if comment posting fails
            }
          } else {
            logger.warn("⚠️ No Apache Answers Post ID provided in callback");
          }

          // Respond with success
          res.status(200).json({
            success: true,
            message: "Callback received and processed successfully",
            timestamp: new Date().toISOString(),
            postId: callbackData.postId || null,
          });
        } catch (error) {
          logger.error("❌ Error processing Power Automate callback:", error);
          res.status(500).json({
            success: false,
            message: "Error processing callback",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    );

    // Catch-all for undefined routes
    this.app.use((req: Request, res: Response) => {
      logger.warn(
        `🚫 Unknown route accessed: ${req.method} ${req.originalUrl}`
      );
      res.status(404).json({
        success: false,
        message: "Route not found",
        availableRoutes: [
          "/health",
          "/debug/duplicate-test",
          "/debug/tracker-status",
          "/callback/power-automate",
          "/callback/teams-message",
        ],
      });
    });
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          logger.info(`🌐 HTTP server started on port ${this.port}`);
          logger.info(
            `📡 Power Automate callback endpoint available at: http://localhost:${this.port}/callback/power-automate`
          );
          logger.info(
            `💬 Teams message callback endpoint available at: http://localhost:${this.port}/callback/teams-message`
          );
          logger.info(
            `❤️  Health check available at: http://localhost:${this.port}/health`
          );
          resolve();
        });

        this.server.on("error", (error: any) => {
          logger.error("❌ HTTP server error:", error);
          reject(error);
        });
      } catch (error) {
        logger.error("❌ Failed to start HTTP server:", error);
        reject(error);
      }
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info("🛑 HTTP server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get server status
   */
  getStatus(): { isRunning: boolean; port: number } {
    return {
      isRunning: this.server && this.server.listening,
      port: this.port,
    };
  }
}
