import { AnswerPost } from "../types/answers";
import logger from "./logger";

interface SentQuestion {
  id: string;
  title: string;
  sentAt: Date;
  teamsMessageId?: string;
}

export class SentQuestionsTracker {
  private static instance: SentQuestionsTracker | null = null;
  private sentQuestions: Map<string, SentQuestion> = new Map();
  private readonly maxStoredQuestions = 100; // Keep only recent questions

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of SentQuestionsTracker
   */
  static getInstance(): SentQuestionsTracker {
    if (!SentQuestionsTracker.instance) {
      logger.info(`🆕 Creating new SentQuestionsTracker singleton instance`);
      SentQuestionsTracker.instance = new SentQuestionsTracker();
    } else {
      logger.debug(
        `♻️ Reusing existing SentQuestionsTracker singleton instance`
      );
    }
    return SentQuestionsTracker.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    SentQuestionsTracker.instance = null;
  }

  /**
   * Track a question that was sent to Teams
   */
  trackSentQuestion(post: AnswerPost, teamsMessageId?: string): void {
    logger.info(`📝 Tracking question: "${post.title}" (ID: ${post.id})`);

    const sentQuestion: SentQuestion = {
      id: post.id,
      title: post.title,
      sentAt: new Date(),
      teamsMessageId,
    };

    this.sentQuestions.set(post.id, sentQuestion);
    logger.info(`✅ Tracked question (total: ${this.sentQuestions.size})`);

    // Clean up old entries if we exceed the limit
    if (this.sentQuestions.size > this.maxStoredQuestions) {
      const oldestEntry = Array.from(this.sentQuestions.entries()).sort(
        (a, b) => a[1].sentAt.getTime() - b[1].sentAt.getTime()
      )[0];
      this.sentQuestions.delete(oldestEntry[0]);
      logger.info(`🧹 Cleaned up old question: "${oldestEntry[1].title}"`);
    }
  }

  /**
   * Check if a callback message matches a recently sent question
   */
  isDuplicateMessage(messageTitle: string, messageContent: string): boolean {
    logger.info(`🔍 Checking for duplicate: "${messageTitle}"`);

    const totalTracked = this.sentQuestions.size;
    logger.info(`📊 Total tracked questions: ${totalTracked}`);

    if (totalTracked === 0) {
      logger.info(`ℹ️ No tracked questions found`);
      return false;
    }

    // Check if any recent question's title matches the message title
    for (const [questionId, sentQuestion] of this.sentQuestions.entries()) {
      // Only check recent questions (within last 10 minutes)
      const timeDiff = Date.now() - sentQuestion.sentAt.getTime();
      if (timeDiff > 10 * 60 * 1000) {
        continue;
      }

      logger.info(`📋 Checking for duplicate: "${sentQuestion.title}"`);
      logger.info(`📋 Message content: "${messageContent}"`);
      logger.info(`📋 Sent question content: "${sentQuestion.title}"`);
      // Simple check: if the titles match exactly, it's a duplicate
      if (messageContent.includes(sentQuestion.title)) {
        logger.info(
          `🚫 DUPLICATE FOUND! Question: "${sentQuestion.title}" (ID: ${questionId})`
        );
        return true;
      }
    }

    logger.info(`✅ No duplicate found`);
    return false;
  }

  /**
   * Get statistics about tracked questions
   */
  getStats(): { totalTracked: number; recentSent: number } {
    const now = Date.now();
    const recentSent = Array.from(this.sentQuestions.values()).filter(
      (q) => now - q.sentAt.getTime() < 10 * 60 * 1000
    ).length; // Last 10 minutes

    return {
      totalTracked: this.sentQuestions.size,
      recentSent,
    };
  }

  /**
   * Clear old tracked questions (older than 1 hour)
   */
  clearOldQuestions(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let cleared = 0;

    for (const [questionId, sentQuestion] of this.sentQuestions.entries()) {
      if (sentQuestion.sentAt.getTime() < oneHourAgo) {
        this.sentQuestions.delete(questionId);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.info(`🧹 Cleared ${cleared} old tracked questions`);
    }
  }

  /**
   * Get all tracked questions for debugging
   */
  getAllTrackedQuestions(): SentQuestion[] {
    return Array.from(this.sentQuestions.values());
  }
}
