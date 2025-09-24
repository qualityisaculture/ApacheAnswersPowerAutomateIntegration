import dotenv from "dotenv";

dotenv.config();

export interface Config {
  answers: {
    baseUrl: string;
    accessToken?: string;
    email?: string;
    password?: string;
  };
  monitoring: {
    checkIntervalMs: number;
    logLevel: string;
  };
  teams: {
    webhookUrl?: string;
  };
}

export const config: Config = {
  answers: {
    baseUrl: process.env.ANSWERS_BASE_URL || "https://meta.answer.dev",
    accessToken: process.env.ANSWERS_ACCESS_TOKEN,
    email: process.env.ANSWERS_EMAIL,
    password: process.env.ANSWERS_PASSWORD,
  },
  monitoring: {
    checkIntervalMs: parseInt(process.env.CHECK_INTERVAL_MS || "30000", 10),
    logLevel: process.env.LOG_LEVEL || "info",
  },
  teams: {
    webhookUrl: process.env.TEAMS_WEBHOOK_URL,
  },
};
