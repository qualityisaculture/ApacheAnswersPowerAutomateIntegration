import axios from "axios";
import { AnswerPost } from "../types/answers";
import { ChannelMapping, config } from "../config/config";
import logger from "./logger";

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
   * Create a Teams message from an Apache Answers post
   */
  private createTeamsMessage(post: AnswerPost): TeamsMessage {
    const postUrl = `${config.answers.baseUrl}/questions/${post.id}`;
    const createdDate = new Date(post.created_at * 1000).toLocaleString(); // Convert from Unix timestamp
    const tagNames = post.tags.map((tag) => tag.display_name).join(", ");

    return {
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
            ],
          },
        },
      ],
    };
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

    const message = this.createTeamsMessage(post);

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
        });

        logger.info(`✅ Successfully sent to ${channel.channelName}`);
      } catch (error) {
        logger.error(`❌ Failed to send to ${channel.channelName}:`, error);
        throw error;
      }
    });

    try {
      await Promise.all(sendPromises);
      logger.info(
        `🎉 Successfully sent post to all ${channels.length} channel(s)`
      );
    } catch (error) {
      logger.error("❌ Failed to send post to one or more channels:", error);
      throw error;
    }
  }
}
