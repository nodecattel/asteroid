import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';

interface RateLimitConfig {
  requestWeight: { limit: number; used: number; resetAt: number };
  orders: { limit: number; used: number; resetAt: number };
}

export class AsterdexClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private axiosInstance: AxiosInstance;
  private rateLimits: RateLimitConfig;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;

  constructor(apiKey: string, apiSecret: string, baseUrl: string = 'https://fapi.asterdex.com') {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
      },
    });

    // Initialize rate limits (will be updated from API responses)
    this.rateLimits = {
      requestWeight: { limit: 2400, used: 0, resetAt: Date.now() + 60000 },
      orders: { limit: 1200, used: 0, resetAt: Date.now() + 60000 },
    };

    // Add response interceptor to track rate limits
    this.axiosInstance.interceptors.response.use(
      (response: any) => {
        this.updateRateLimitsFromHeaders(response.headers);
        return response;
      },
      (error: any) => {
        if (error.response) {
          this.updateRateLimitsFromHeaders(error.response.headers);
          
          // Handle rate limit errors
          if (error.response.status === 429) {
            console.error('Rate limit exceeded, backing off...');
            // Implement exponential backoff
            return this.handleRateLimitError(error);
          }
          
          if (error.response.status === 418) {
            console.error('IP banned! Stopping all requests.');
            throw new Error('IP_BANNED');
          }
        }
        throw error;
      }
    );
  }

  private updateRateLimitsFromHeaders(headers: any) {
    // Update request weight limits
    const weightHeader = Object.keys(headers).find(key => 
      key.toLowerCase().includes('x-mbx-used-weight')
    );
    if (weightHeader) {
      this.rateLimits.requestWeight.used = parseInt(headers[weightHeader]) || 0;
    }

    // Update order count limits
    const orderHeader = Object.keys(headers).find(key => 
      key.toLowerCase().includes('x-mbx-order-count')
    );
    if (orderHeader) {
      this.rateLimits.orders.used = parseInt(headers[orderHeader]) || 0;
    }
  }

  private async handleRateLimitError(error: any) {
    // Wait before retrying
    const backoffMs = 1000; // Start with 1 second
    await this.sleep(backoffMs);
    
    // Retry the request
    return this.axiosInstance.request(error.config);
  }

  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  private buildQueryString(params: Record<string, any>): string {
    return Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Check if we're approaching rate limits
  private shouldBackoff(): boolean {
    const now = Date.now();
    
    // If we're at 80% of request weight limit, back off
    if (this.rateLimits.requestWeight.used > this.rateLimits.requestWeight.limit * 0.8) {
      return true;
    }
    
    // If we're at 80% of order limit, back off
    if (this.rateLimits.orders.used > this.rateLimits.orders.limit * 0.8) {
      return true;
    }
    
    return false;
  }

  // Public API Methods

  async ping(): Promise<boolean> {
    try {
      await this.axiosInstance.get('/fapi/v1/ping');
      return true;
    } catch (error) {
      return false;
    }
  }

  async getServerTime(): Promise<number> {
    const response = await this.axiosInstance.get('/fapi/v1/time');
    return response.data.serverTime;
  }

  async getExchangeInfo(): Promise<any> {
    const response = await this.axiosInstance.get('/fapi/v1/exchangeInfo');
    return response.data;
  }

  async getOrderBook(symbol: string, limit: number = 10): Promise<any> {
    const response = await this.axiosInstance.get('/fapi/v1/depth', {
      params: { symbol, limit }
    });
    return response.data;
  }

  // Signed endpoints
  async placeOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET';
    quantity: number;
    price?: number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTX';
    newClientOrderId?: string;
  }): Promise<any> {
    if (this.shouldBackoff()) {
      console.log('Approaching rate limit, adding delay...');
      await this.sleep(500);
    }

    const timestamp = Date.now();
    const orderParams = {
      ...params,
      timestamp,
      recvWindow: 5000,
    };

    const queryString = this.buildQueryString(orderParams);
    const signature = this.createSignature(queryString);
    const signedQueryString = `${queryString}&signature=${signature}`;

    const response = await this.axiosInstance.post(
      `/fapi/v1/order?${signedQueryString}`
    );
    
    return response.data;
  }

  async cancelOrder(symbol: string, orderId?: string, origClientOrderId?: string): Promise<any> {
    const timestamp = Date.now();
    const params: any = {
      symbol,
      timestamp,
      recvWindow: 5000,
    };

    if (orderId) params.orderId = orderId;
    if (origClientOrderId) params.origClientOrderId = origClientOrderId;

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);
    const signedQueryString = `${queryString}&signature=${signature}`;

    const response = await this.axiosInstance.delete(
      `/fapi/v1/order?${signedQueryString}`
    );
    
    return response.data;
  }

  async cancelAllOrders(symbol: string): Promise<any> {
    const timestamp = Date.now();
    const params = {
      symbol,
      timestamp,
      recvWindow: 5000,
    };

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);
    const signedQueryString = `${queryString}&signature=${signature}`;

    const response = await this.axiosInstance.delete(
      `/fapi/v1/allOpenOrders?${signedQueryString}`
    );
    
    return response.data;
  }

  async getOpenOrders(symbol?: string): Promise<any> {
    const timestamp = Date.now();
    const params: any = {
      timestamp,
      recvWindow: 5000,
    };

    if (symbol) params.symbol = symbol;

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);
    const signedQueryString = `${queryString}&signature=${signature}`;

    const response = await this.axiosInstance.get(
      `/fapi/v1/openOrders?${signedQueryString}`
    );
    
    return response.data;
  }

  async getAccountInfo(): Promise<any> {
    const timestamp = Date.now();
    const params = {
      timestamp,
      recvWindow: 5000,
    };

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);
    const signedQueryString = `${queryString}&signature=${signature}`;

    const response = await this.axiosInstance.get(
      `/fapi/v2/account?${signedQueryString}`
    );
    
    return response.data;
  }

  getRateLimitStatus(): RateLimitConfig {
    return { ...this.rateLimits };
  }
}
