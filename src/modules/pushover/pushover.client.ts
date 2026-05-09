import { env } from '../../config/env';
import { logger } from '../../utils/logger';

interface PushoverResponse {
  status: number;
  requestId: string;
}

interface PushoverSendParams {
  token: string;
  user: string;
  message: string;
  priority: number;
  title?: string;
  sound?: string;
  retry?: number;
  expire?: number;
  timestamp?: number;
}

interface SendResult {
  success: boolean;
  status: number;
  error?: string;
}

/**
 * HTTP client for the Pushover API.
 * Handles different alert types and error conditions without crashing.
 */
export class PushoverClient {
  private readonly baseUrl = 'https://api.pushover.net/1/messages.json';
  private readonly appToken: string;
  private requestCount = 0;
  private readonly maxConcurrent = 10;
  private readonly batchDelayMs = 100;

  constructor() {
    this.appToken = env.PUSHOVER_APP_TOKEN;
  }

  /**
   * Sends a notification to a Pushover user.
   */
  async send(
    userKey: string,
    message: string,
    priority: number,
    options?: { title?: string; sound?: string; retry?: number; expire?: number },
  ): Promise<SendResult> {
    // Rate limiting check
    if (this.requestCount >= this.maxConcurrent) {
      await this.delay(this.batchDelayMs);
    }

    this.requestCount++;

    const params: Record<string, string | number> = {
      token: this.appToken,
      user: userKey,
      message,
      priority,
      timestamp: Math.floor(Date.now() / 1000),
      ...options,
    };

    try {
      const response = await this.httpPost(this.baseUrl, params);
      const result = (await response.json()) as PushoverResponse;

      this.requestCount--;

      if (response.ok) {
        logger.debug('Pushover notification sent', {
          userKey: this.maskKey(userKey),
          status: result.requestId,
        });
        return { success: true, status: response.status };
      }

      // Handle specific error codes
      if (response.status === 400) {
        logger.warn('Pushover 400 - Invalid user key', {
          userKey: this.maskKey(userKey),
        });
        return { success: false, status: 400, error: 'Invalid user key' };
      }

      if (response.status === 429) {
        logger.warn('Pushover 429 - Rate limited, waiting 5s', {
          userKey: this.maskKey(userKey),
        });
        await this.delay(5000);
        return this.send(userKey, message, priority, options);
      }

      if (response.status === 500) {
        logger.error('Pushover 500 - Server error', {
          userKey: this.maskKey(userKey),
        });
        return { success: false, status: 500, error: 'Server error' };
      }

      return {
        success: false,
        status: response.status,
        error: `HTTP ${response.status}`,
      };
    } catch (error: any) {
      this.requestCount--;
      logger.error('Pushover send failed', {
        userKey: this.maskKey(userKey),
        error: error.message,
      });
      return { success: false, status: 0, error: error.message };
    }
  }

  /**
   * Sends a test notification to verify connectivity.
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.httpPost(this.baseUrl, {
        token: this.appToken,
        user: 'test',
        message: 'Test',
        priority: -2,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async httpPost(url: string, body: Record<string, string | number>): Promise<Response> {
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      formData.append(key, String(value));
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    return response;
  }

  private maskKey(key: string): string {
    if (key.length !== 30) return '[INVALID]';
    return `${key.slice(0, 4)}...${key.slice(-3)}`;
  }
}

// Singleton instance
export const pushoverClient = new PushoverClient();