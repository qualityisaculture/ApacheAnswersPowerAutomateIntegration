import logger from "./logger";

interface QuestionAnswers {
  questionId: string;
  questionTitle: string;
  answerIds: Set<string>;
  lastChecked: number;
}

export class AnswerTracker {
  private trackedQuestions: Map<string, QuestionAnswers> = new Map();
  private readonly maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Update tracked answers for a question
   */
  updateQuestionAnswers(
    questionId: string,
    questionTitle: string,
    currentAnswerIds: string[]
  ): string[] {
    const now = Date.now();
    const existing = this.trackedQuestions.get(questionId);

    if (!existing) {
      // First time tracking this question
      this.trackedQuestions.set(questionId, {
        questionId,
        questionTitle,
        answerIds: new Set(currentAnswerIds),
        lastChecked: now,
      });

      logger.debug(
        `🆕 Started tracking question "${questionTitle}" with ${currentAnswerIds.length} existing answers`
      );
      return []; // No new answers on first check
    }

    // Update existing tracking
    const previousAnswerIds = new Set(existing.answerIds);
    const currentAnswerIdsSet = new Set(currentAnswerIds);

    // Find new answers
    const newAnswerIds = currentAnswerIds.filter(
      (id) => !previousAnswerIds.has(id)
    );

    // Update the tracked data
    existing.answerIds = currentAnswerIdsSet;
    existing.questionTitle = questionTitle;
    existing.lastChecked = now;

    // New answers will be logged by the monitor

    return newAnswerIds;
  }

  /**
   * Get all tracked question IDs
   */
  getTrackedQuestionIds(): string[] {
    return Array.from(this.trackedQuestions.keys());
  }

  /**
   * Clean up old tracked questions
   */
  cleanupOldQuestions(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [questionId, data] of this.trackedQuestions.entries()) {
      if (now - data.lastChecked > this.maxAgeMs) {
        toDelete.push(questionId);
      }
    }

    for (const questionId of toDelete) {
      const data = this.trackedQuestions.get(questionId);
      logger.debug(
        `🧹 Cleaning up old question tracking: "${data?.questionTitle}"`
      );
      this.trackedQuestions.delete(questionId);
    }

    if (toDelete.length > 0) {
      logger.info(`🧹 Cleaned up ${toDelete.length} old question trackings`);
    }
  }

  /**
   * Get tracking statistics
   */
  getStats(): { totalTracked: number; oldestQuestion: string | null } {
    const totalTracked = this.trackedQuestions.size;
    let oldestQuestion: string | null = null;
    let oldestTime = Date.now();

    for (const data of this.trackedQuestions.values()) {
      if (data.lastChecked < oldestTime) {
        oldestTime = data.lastChecked;
        oldestQuestion = data.questionTitle;
      }
    }

    return { totalTracked, oldestQuestion };
  }
}
