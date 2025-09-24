import dotenv from "dotenv";

dotenv.config();

export interface ChannelMapping {
  tags: string[];
  webhookUrl: string;
  channelName: string;
}

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
    defaultChannel?: ChannelMapping;
    channels: ChannelMapping[];
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
    defaultChannel: process.env.TEAMS_DEFAULT_WEBHOOK_URL
      ? {
          tags: [],
          webhookUrl: process.env.TEAMS_DEFAULT_WEBHOOK_URL,
          channelName: "Default",
        }
      : undefined,
    channels: process.env.TEAMS_CHANNELS
      ? JSON.parse(process.env.TEAMS_CHANNELS)
      : [],
  },
};
