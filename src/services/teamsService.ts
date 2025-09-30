import axios from "axios";
import https from "https";
import { AnswerPost } from "../types/answers";
import { ChannelMapping, config } from "../config/config";
import logger from "./logger";
import { SentQuestionsTracker } from "./sentQuestionsTracker";

interface TeamsMessage {
  type: "message";
  attachments: Array<{
    contentType: "application/vnd.microsoft.card.adaptive";
    contentUrl: null;
    content: {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json";
      type: "AdaptiveCard";
      version: "1.2";
      body: Array<{
        type: "TextBlock";
        text: string;
        weight?: "bolder" | "lighter" | "normal";
        size?: "small" | "medium" | "large" | "extraLarge";
        color?:
          | "default"
          | "dark"
          | "light"
          | "accent"
          | "good"
          | "warning"
          | "attention";
      }>;
    };
  }>;
}

export class TeamsService {
  private sentQuestionsTracker: SentQuestionsTracker;

  constructor() {
    this.sentQuestionsTracker = SentQuestionsTracker.getInstance();
  }

  /**
   * Find the appropriate channel(s) for a post based on its tags
   */
  private findChannelsForPost(post: AnswerPost): ChannelMapping[] {
    const matchingChannels: ChannelMapping[] = [];
    const postTagNames = post.tags.map((tag) => tag.slug_name);

    // Check if any channel has matching tags
    for (const channel of config.teams.channels) {
      if (
        channel.tags.length === 0 ||
        channel.tags.some((tag) => postTagNames.includes(tag))
      ) {
        matchingChannels.push(channel);
      }
    }

    // If no specific channels match, use default channel
    if (matchingChannels.length === 0 && config.teams.defaultChannel) {
      matchingChannels.push(config.teams.defaultChannel);
    }

    return matchingChannels;
  }

  /**
   * Send a post to Teams channels
   */
  async sendPostToTeams(post: AnswerPost): Promise<void> {
    const channels = this.findChannelsForPost(post);

    if (channels.length === 0) {
      logger.info(`📭 No Teams channels configured for post: ${post.title}`);
      return;
    }

    const postUrl = `${config.answers.baseUrl}/questions/${post.id}`;
    const createdDate = new Date(post.created_at * 1000).toLocaleString(); // Convert from Unix timestamp
    const tagNames = post.tags.map((tag) => tag.display_name).join(", ");

    const message: TeamsMessage = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.2",
            body: [
              {
                type: "TextBlock",
                text: `📝 ${post.title}`,
                weight: "bolder",
                size: "large",
                color: "accent",
              },
              {
                type: "TextBlock",
                text:
                  post.description.substring(0, 200) +
                  (post.description.length > 200 ? "..." : ""),
                size: "medium",
              },
              {
                type: "TextBlock",
                text: `**Author:** ${post.operator.username}\n**Posted:** ${createdDate}\n**Tags:** ${tagNames}`,
                size: "small",
                color: "light",
              },
              {
                type: "TextBlock",
                text: `[View Post in Apache Answers](${postUrl})`,
                size: "small",
                color: "accent",
              },
              {
                type: "TextBlock",
                text: `${post.id}`,
                size: "small",
                color: "light",
              },
            ],
          },
        },
      ],
    };

    logger.info(
      `📤 Sending post "${post.title}" to ${channels.length} Teams channel(s)`
    );

    // Send to all matching channels
    const sendPromises = channels.map(async (channel) => {
      try {
        await axios.post(channel.webhookUrl, message, {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000,
          httpsAgent: new https.Agent({
            rejectUnauthorized: false,
          }),
        });

        logger.info(`✅ Successfully sent to ${channel.channelName}`);
      } catch (error) {
        logger.error(`❌ Failed to send to ${channel.channelName}:`, error);
        throw error;
      }
    });

    try {
      await Promise.all(sendPromises);

      // Track this question as sent to Teams
      logger.info(
        `📝 About to track question: "${post.title}" (ID: ${post.id})`
      );
      this.sentQuestionsTracker.trackSentQuestion(post);
      logger.info(`✅ Question tracking completed`);

      logger.info(
        `🎉 Successfully sent post to all ${channels.length} channel(s)`
      );
    } catch (error) {
      logger.error("❌ Failed to send post to one or more channels:", error);
      throw error;
    }
  }

  /**
   * Reply to a message in Teams with messageId, teamId, channelId, URL, and additional text
   */
  async replyToTeamsMessageWithFullContext(
    messageId: string,
    teamId: string,
    channelId: string,
    url: string,
    additionalText: string
  ): Promise<void> {
    if (!config.teams.newPostReplyWebhook) {
      logger.warn(
        "⚠️ No new post reply webhook configured, skipping notification"
      );
      return;
    }

    const message: TeamsMessage = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.2",
            body: [
              {
                type: "TextBlock",
                text: messageId,
                weight: "bolder",
                size: "medium",
                color: "accent",
              },
              {
                type: "TextBlock",
                text: teamId,
                weight: "normal",
                size: "small",
                color: "light",
              },
              {
                type: "TextBlock",
                text: channelId,
                weight: "normal",
                size: "small",
                color: "light",
              },
              {
                type: "TextBlock",
                text: url,
                weight: "normal",
                size: "medium",
                color: "accent",
              },
              {
                type: "TextBlock",
                text: additionalText,
                weight: "normal",
                size: "medium",
                color: "default",
              },
            ],
          },
        },
      ],
    };

    try {
      logger.info(`📤 Sending message reply to Teams...`);
      logger.info(`📨 Message ID: ${messageId}`);
      logger.info(`👥 Team ID: ${teamId}`);
      logger.info(`💬 Channel ID: ${channelId}`);
      logger.info(`🔗 URL: ${url}`);
      logger.info(`📝 Additional Text: ${additionalText}`);

      await axios.post(config.teams.newPostReplyWebhook, message, {
        headers: {
          "Content-Type": "application/json",
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      });

      logger.info(`✅ Successfully sent message reply to Teams`);
    } catch (error) {
      logger.error("❌ Failed to send message reply to Teams:", error);
      throw error;
    }
  }

  /**
   * Reply to a message in Teams with messageId, URL, and additional text
   */
  async replyToTeamsMessageWithURL(
    messageId: string,
    url: string,
    additionalText: string
  ): Promise<void> {
    if (!config.teams.newPostReplyWebhook) {
      logger.warn(
        "⚠️ No new post reply webhook configured, skipping notification"
      );
      return;
    }

    const message: TeamsMessage = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.2",
            body: [
              {
                type: "TextBlock",
                text: messageId,
                weight: "bolder",
                size: "medium",
                color: "accent",
              },
              {
                type: "TextBlock",
                text: url,
                weight: "normal",
                size: "medium",
                color: "accent",
              },
              {
                type: "TextBlock",
                text: additionalText,
                weight: "normal",
                size: "medium",
                color: "default",
              },
            ],
          },
        },
      ],
    };

    try {
      logger.info(`📤 Sending message reply to Teams...`);
      logger.info(`📨 Message ID: ${messageId}`);
      logger.info(`🔗 URL: ${url}`);
      logger.info(`📝 Additional Text: ${additionalText}`);

      await axios.post(config.teams.newPostReplyWebhook, message, {
        headers: {
          "Content-Type": "application/json",
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      });

      logger.info(`✅ Successfully sent message reply to Teams`);
    } catch (error) {
      logger.error("❌ Failed to send message reply to Teams:", error);
      throw error;
    }
  }

  /**
   * Get the sent questions tracker for duplicate detection
   */
  getSentQuestionsTracker(): SentQuestionsTracker {
    return this.sentQuestionsTracker;
  }
}
