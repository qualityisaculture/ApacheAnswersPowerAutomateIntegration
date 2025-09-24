import axios from "axios";
import { config } from "../config/config";
import logger from "../services/logger";

export interface LoginResponse {
  code: number;
  data: {
    access_token: string;
    answer_count: number;
    authority_group: number;
    avatar: string;
    bio: string;
    bio_html: string;
    color_scheme: string;
    created_at: number;
    display_name: string;
    e_mail: string;
    follow_count: number;
    have_password: boolean;
    id: string;
    language: string;
    last_login_date: number;
    location: string;
    mail_status: number;
    mobile: string;
    notice_status: number;
    question_count: number;
    rank: number;
    role_id: number;
    status: string;
    suspended_until: number;
    username: string;
    visit_token: string;
    website: string;
  };
  msg: string;
  reason: string;
}

export async function getAccessToken(): Promise<string> {
  if (!config.answers.email || !config.answers.password) {
    throw new Error("Email and password are required to get access token");
  }

  try {
    logger.info("Authenticating with Apache Answers...");

    const response = await axios.post<LoginResponse>(
      `${config.answers.baseUrl}/answer/api/v1/user/login/email`,
      {
        e_mail: config.answers.email,
        pass: config.answers.password,
        captcha_code: "", // Leave empty if captcha is not enabled
        captcha_id: "", // Leave empty if captcha is not enabled
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Log the response for debugging
    logger.debug("Login response:", {
      code: response.data.code,
      msg: response.data.msg,
      hasAccessToken: !!response.data.data?.access_token,
    });

    if (response.data.code !== 200) {
      throw new Error(`Authentication failed: ${response.data.msg}`);
    }

    // Check if we have a valid access token
    if (!response.data.data?.access_token) {
      throw new Error("No access token received in response");
    }

    const accessToken = response.data.data.access_token;
    logger.info("Successfully obtained access token");
    logger.info(
      `User: ${response.data.data.display_name} (${response.data.data.e_mail})`
    );

    return accessToken;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error("HTTP Error:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
    } else {
      logger.error("Failed to get access token:", error);
    }
    throw error;
  }
}

// CLI function to get and display access token
if (require.main === module) {
  // Set log level to debug for this script
  process.env.LOG_LEVEL = "debug";

  getAccessToken()
    .then((token) => {
      console.log("\n🎉 Access Token obtained successfully!");
      console.log("Add this to your .env file:");
      console.log(`ANSWERS_ACCESS_TOKEN=${token}\n`);
    })
    .catch((error) => {
      console.error("❌ Failed to get access token:", error.message);
      process.exit(1);
    });
}
