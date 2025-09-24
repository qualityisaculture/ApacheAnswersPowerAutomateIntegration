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
      logger.debug(
        `📡 Fetching recent posts: page=${page}, pageSize=${pageSize}`
      );

      const response = await this.client.get<
        AnswerApiResponse<AnswerPostListResponse>
      >(`/answer/api/v1/question/page`, {
        params: {
          page,
          page_size: pageSize,
          order: "newest",
        },
      });

      logger.debug(
        `📡 API Response: code=${response.data.code}, total=${
          response.data.data?.total || 0
        }`
      );

      if (response.data.code !== 200) {
        throw new Error(`API Error: ${response.data}`);
      }

      const posts = response.data.data.list;
      logger.debug(`📡 Retrieved ${posts.length} posts from API`);

      return posts;
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
      logger.info("🔍 Checking for new posts...");
      const recentPosts = await this.getRecentPosts(1, 10);

      logger.info(`📊 Found ${recentPosts.length} recent posts from API`);
      logger.debug(
        "Recent posts:",
        recentPosts.map((post) => ({
          id: post.id,
          title: post.title.substring(0, 50) + "...",
          author: post.operator.display_name,
          created_at: post.created_at,
        }))
      );

      if (!this.lastCheckedPostId) {
        // First run - set the latest post as baseline
        this.lastCheckedPostId = recentPosts[0]?.id || null;
        logger.info(
          `🎯 Initial baseline set to post ID: ${this.lastCheckedPostId}`
        );
        logger.info("📝 No new posts to report on first run.");
        return [];
      }

      logger.info(
        `🔍 Comparing against baseline post ID: ${this.lastCheckedPostId}`
      );

      // Find posts newer than our last check
      // We need to find posts that are newer than our baseline
      // Since posts are ordered by newest first, we take posts until we hit our baseline
      const newPosts = [];
      for (const post of recentPosts) {
        if (post.id === this.lastCheckedPostId) {
          // We've reached our baseline, stop here
          break;
        }
        newPosts.push(post);
        logger.debug(
          `Post ${post.id}: is newer than baseline ${this.lastCheckedPostId}`
        );
      }

      logger.info(
        `🔍 Found ${newPosts.length} posts that are newer than baseline`
      );

      if (newPosts.length > 0) {
        // Update our baseline to the newest post
        const previousBaseline = this.lastCheckedPostId;
        this.lastCheckedPostId = recentPosts[0].id;
        logger.info(
          `🎯 Updated baseline from ${previousBaseline} to ${this.lastCheckedPostId}`
        );
        logger.info(`🎉 Found ${newPosts.length} new posts!`);
      } else {
        logger.info("📭 No new posts found this check");
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
