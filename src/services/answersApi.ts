import axios, { AxiosInstance } from "axios";
import {
  AnswerPost,
  AnswerApiResponse,
  AnswerPostListResponse,
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
