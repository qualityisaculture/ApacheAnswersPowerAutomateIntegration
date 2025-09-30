import axios, { AxiosInstance } from "axios";
import https from "https";
import {
  AnswerPost,
  AnswerApiResponse,
  AnswerPostListResponse,
  AnswerComment,
  AnswerCommentRequest,
  AnswerQuestionRequest,
  AnswerQuestionResponse,
  Answer,
  AnswerListResponse,
} from "../types/answers";
import { config } from "../config/config";
import logger from "./logger";

export class AnswersApiService {
  private client: AxiosInstance;
  private lastCheckedPostId: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: config.answers.baseUrl,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        ...(config.answers.accessToken && {
          Authorization: `Bearer ${config.answers.accessToken}`,
        }),
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(
          `Making request to: ${config.method?.toUpperCase()} ${config.url}`
        );
        return config;
      },
      (error) => {
        logger.error("Request error:", error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          `Response received: ${response.status} ${response.statusText}`
        );
        return response;
      },
      (error) => {
        logger.error("Response error:", error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetch recent posts from Apache Answers
   */
  async getRecentPosts(
    page: number = 1,
    pageSize: number = 20
  ): Promise<AnswerPost[]> {
    try {
      const response = await this.client.get<
        AnswerApiResponse<AnswerPostListResponse>
      >(`/answer/api/v1/question/page`, {
        params: {
          page,
          page_size: pageSize,
          order: "newest",
        },
      });

      if (response.data.code !== 200) {
        throw new Error(`API Error: ${response.data}`);
      }

      return response.data.data.list;
    } catch (error) {
      logger.error("Failed to fetch recent posts:", error);
      throw error;
    }
  }

  /**
   * Get a specific post by ID
   */
  async getPostById(postId: string): Promise<AnswerPost> {
    try {
      const response = await this.client.get<AnswerApiResponse<AnswerPost>>(
        `/api/v1/question/${postId}`
      );

      if (response.data.code !== 200) {
        throw new Error(`API Error: ${response.data.message}`);
      }

      return response.data.data;
    } catch (error) {
      logger.error(`Failed to fetch post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Check for new posts since last check
   */
  async checkForNewPosts(): Promise<AnswerPost[]> {
    try {
      const recentPosts = await this.getRecentPosts(1, 10);

      if (!this.lastCheckedPostId) {
        // First run - set the latest post as baseline
        this.lastCheckedPostId = recentPosts[0]?.id || null;
        logger.info(
          `🎯 Initial baseline set to post ID: ${this.lastCheckedPostId}`
        );
        return [];
      }

      // Find posts newer than our last check
      const newPosts = [];
      for (const post of recentPosts) {
        if (post.id === this.lastCheckedPostId) {
          break;
        }
        newPosts.push(post);
      }

      if (newPosts.length > 0) {
        this.lastCheckedPostId = recentPosts[0].id;
        logger.info(`🎉 Found ${newPosts.length} new posts!`);
      }

      return newPosts;
    } catch (error) {
      logger.error("Failed to check for new posts:", error);
      return [];
    }
  }

  /**
   * Post a comment to a specific question
   */
  async postComment(
    questionId: string,
    content: string
  ): Promise<AnswerComment> {
    try {
      const requestBody: AnswerCommentRequest = {
        object_id: questionId,
        original_text: content,
      };

      logger.info(`📝 Posting comment to question ${questionId}:`, requestBody);

      const response = await this.client.post<AnswerApiResponse<AnswerComment>>(
        `/answer/api/v1/comment`,
        requestBody
      );

      if (response.data.code !== 200) {
        throw new Error(`API Error: ${response.data.message}`);
      }

      logger.info(`✅ Successfully posted comment to question ${questionId}`);
      return response.data.data;
    } catch (error) {
      logger.error(`Failed to post comment to question ${questionId}:`, error);
      throw error;
    }
  }

  /**
   * Post a new question to Apache Answers
   */
  async postQuestion(
    title: string,
    content: string,
    tags: Array<{
      display_name: string;
      original_text: string;
      slug_name: string;
    }> = []
  ): Promise<AnswerQuestionResponse> {
    try {
      const requestBody: AnswerQuestionRequest = {
        content,
        tags,
        title,
      };

      logger.info(`📝 Posting new question: ${title}`);

      const response = await this.client.post<AnswerQuestionResponse>(
        `/answer/api/v1/question`,
        requestBody
      );

      if (response.data.code !== 200) {
        throw new Error(`API Error: ${response.data.msg}`);
      }

      logger.info(`✅ Successfully posted question: ${title}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to post question: ${title}`, error);
      throw error;
    }
  }

  /**
   * Post a Teams message as a question to Apache Answers
   */
  async postTeamsMessageAsQuestion(
    title: string,
    content: string,
    teamId: string,
    channelId: string,
    messageId: string,
    messageLink: string,
    additionalTag?: string
  ): Promise<AnswerQuestionResponse> {
    // Add the from_teams tag to prevent infinite loops
    const tags = [
      {
        display_name: "from_teams",
        original_text: "from_teams",
        slug_name: "from_teams",
      },
    ];

    // Add the additional tag if provided
    if (additionalTag) {
      tags.push({
        display_name: additionalTag,
        original_text: additionalTag,
        slug_name: additionalTag,
      });
    }

    // Enhance the content with Teams context
    const enhancedContent = `${content}\n\n---\n*Posted from Microsoft Teams*\n[View in Teams](${messageLink})`;

    logger.info(`📝 Posting Teams message as question: ${title}`);
    logger.info(`🔗 Message Link: ${messageLink}`);

    return this.postQuestion(title, enhancedContent, tags);
  }

  /**
   * Get answers for a specific question
   */
  async getAnswersForQuestion(
    questionId: string,
    page: number = 1,
    pageSize: number = 20,
    order: string = "newest"
  ): Promise<Answer[]> {
    try {
      const response = await this.client.get<
        AnswerApiResponse<AnswerListResponse>
      >(`/answer/api/v1/answer/page`, {
        params: {
          question_id: questionId,
          page,
          page_size: pageSize,
          order,
        },
      });

      if (response.data.code !== 200) {
        throw new Error(`API Error: ${response.data.message}`);
      }

      logger.debug(
        `Fetched ${response.data.data.list.length} answers for question ${questionId}`
      );
      return response.data.data.list;
    } catch (error) {
      logger.error(
        `Failed to fetch answers for question ${questionId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get comments for a specific question
   */
  async getCommentsForQuestion(questionId: string): Promise<AnswerComment[]> {
    try {
      const response = await this.client.get<
        AnswerApiResponse<{
          count: number;
          list: AnswerComment[];
        }>
      >(`/answer/api/v1/comment/page`, {
        params: {
          object_id: questionId,
          page: 1,
          page_size: 50,
        },
      });

      if (response.data.code !== 200) {
        throw new Error(`API Error: ${JSON.stringify(response.data)}`);
      }

      logger.debug(
        `Fetched ${response.data.data.list.length} comments for question ${questionId}`
      );
      return response.data.data.list;
    } catch (error) {
      logger.error(
        `Failed to fetch comments for question ${questionId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Extract Teams IDs from question comments
   */
  async getTeamsIdsForQuestion(questionId: string): Promise<{
    messageId: string | null;
    teamId: string | null;
    channelId: string | null;
  }> {
    try {
      const comments = await this.getCommentsForQuestion(questionId);

      // Look for a comment containing "Teams Message ID:"
      for (const comment of comments) {
        if (comment.original_text.includes("Teams Message ID:")) {
          const messageIdMatch = comment.original_text.match(
            /Teams Message ID:\s*([^\s\n]+)/
          );
          const teamIdMatch = comment.original_text.match(
            /Teams Team ID:\s*([^\s\n]+)/
          );
          const channelIdMatch = comment.original_text.match(
            /Teams Channel ID:\s*([^\s\n]+)/
          );

          const result = {
            messageId:
              messageIdMatch && messageIdMatch[1] ? messageIdMatch[1] : null,
            teamId: teamIdMatch && teamIdMatch[1] ? teamIdMatch[1] : null,
            channelId:
              channelIdMatch && channelIdMatch[1] ? channelIdMatch[1] : null,
          };

          logger.debug(`Found Teams IDs for question ${questionId}:`, result);
          return result;
        }
      }

      logger.debug(`No Teams IDs found for question ${questionId}`);
      return { messageId: null, teamId: null, channelId: null };
    } catch (error) {
      logger.error(
        `Failed to extract Teams IDs for question ${questionId}:`,
        error
      );
      return { messageId: null, teamId: null, channelId: null };
    }
  }

  /**
   * Post a comment with Teams IDs to a question
   */
  async postTeamsIdsComment(
    questionId: string,
    messageId: string,
    teamId: string,
    channelId: string
  ): Promise<void> {
    try {
      await this.postComment(
        questionId,
        `Teams Message ID: ${messageId}\nTeams Team ID: ${teamId}\nTeams Channel ID: ${channelId}`
      );
      logger.info(
        `✅ Successfully added Teams IDs comment to question ${questionId}`
      );
    } catch (error) {
      logger.error(
        `❌ Failed to add Teams IDs comment to question ${questionId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Extract Teams message ID from question comments (legacy method for backward compatibility)
   */
  async getTeamsMessageIdForQuestion(
    questionId: string
  ): Promise<string | null> {
    const ids = await this.getTeamsIdsForQuestion(questionId);
    return ids.messageId;
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getRecentPosts(1, 1);
      logger.info("Successfully connected to Apache Answers API");
      return true;
    } catch (error) {
      logger.error("Failed to connect to Apache Answers API:", error);
      return false;
    }
  }
}
