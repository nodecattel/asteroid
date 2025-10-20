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

    this.rateLimits = {
      requestWeight: { limit: 2400, used: 0, resetAt: Date.now() + 60000 },
      orders: { limit: 1200, used: 0, resetAt: Date.now() + 60000 },
    };

    this.axiosInstance.interceptors.response.use(
      (response: any) => {
        this.updateRateLimitsFromHeaders(response.headers);
        return response;
      },
      (error: any) => {
        if (error.response) {
          this.updateRateLimitsFromHeaders(error.response.headers);
          
          if (error.response.status === 429) {
            console.error('Rate limit exceeded, backing off...');
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
    const weightHeader = Object.keys(headers).find(key => 
      key.toLowerCase().includes('x-mbx-used-weight')
    );
    if (weightHeader) {
      this.rateLimits.requestWeight.used = parseInt(headers[weightHeader]) || 0;
    }

    const orderHeader = Object.keys(headers).find(key => 
      key.toLowerCase().includes('x-mbx-order-count')
    );
    if (orderHeader) {
      this.rateLimits.orders.used = parseInt(headers[orderHeader]) || 0;
    }
  }

  private async handleRateLimitError(error: any) {
    const backoffMs = 1000;
    await this.sleep(backoffMs);
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
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private shouldBackoff(): boolean {
    if (this.rateLimits.requestWeight.used > this.rateLimits.requestWeight.limit * 0.8) {
      return true;
    }
    if (this.rateLimits.orders.used > this.rateLimits.orders.limit * 0.8) {
      return true;
    }
    return false;
  }

  // ========== MARKET DATA ENDPOINTS (PUBLIC) ==========

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

  async getRecentTrades(symbol: string, limit: number = 500): Promise<any> {
    const response = await this.axiosInstance.get('/fapi/v1/trades', {
      params: { symbol, limit }
    });
    return response.data;
  }

  async getHistoricalTrades(symbol: string, limit: number = 500, fromId?: number): Promise<any> {
    const response = await this.axiosInstance.get('/fapi/v1/historicalTrades', {
      params: { symbol, limit, fromId }
    });
    return response.data;
  }

  async getAggregateTrades(symbol: string, params?: { fromId?: number; startTime?: number; endTime?: number; limit?: number }): Promise<any> {
    const response = await this.axiosInstance.get('/fapi/v1/aggTrades', {
      params: { symbol, ...params }
    });
    return response.data;
  }

  async getKlines(symbol: string, interval: string, params?: { startTime?: number; endTime?: number; limit?: number }): Promise<any> {
    const response = await this.axiosInstance.get('/fapi/v1/klines', {
      params: { symbol, interval, ...params }
    });
    return response.data;
  }

  async getIndexPriceKlines(pair: string, interval: string, params?: { startTime?: number; endTime?: number; limit?: number }): Promise<any> {
    const response = await this.axiosInstance.get('/fapi/v1/indexPriceKlines', {
      params: { pair, interval, ...params }
    });
    return response.data;
  }

  async getMarkPriceKlines(symbol: string, interval: string, params?: { startTime?: number; endTime?: number; limit?: number }): Promise<any> {
    const response = await this.axiosInstance.get('/fapi/v1/markPriceKlines', {
      params: { symbol, interval, ...params }
    });
    return response.data;
  }

  async getMarkPrice(symbol?: string): Promise<any> {
    const response = await this.axiosInstance.get('/fapi/v1/premiumIndex', {
      params: symbol ? { symbol } : {}
    });
    return response.data;
  }

  async getFundingRate(symbol?: string, params?: { startTime?: number; endTime?: number; limit?: number }): Promise<any> {
    const response = await this.axiosInstance.get('/fapi/v1/fundingRate', {
      params: { symbol, ...params }
    });
    return response.data;
  }

  async get24hrTicker(symbol?: string): Promise<any> {
    const response = await this.axiosInstance.get('/fapi/v1/ticker/24hr', {
      params: symbol ? { symbol } : {}
    });
    return response.data;
  }

  async getSymbolPriceTicker(symbol?: string): Promise<any> {
    const response = await this.axiosInstance.get('/fapi/v1/ticker/price', {
      params: symbol ? { symbol } : {}
    });
    return response.data;
  }

  async getBookTicker(symbol?: string): Promise<any> {
    const response = await this.axiosInstance.get('/fapi/v1/ticker/bookTicker', {
      params: symbol ? { symbol } : {}
    });
    return response.data;
  }

  // ========== ACCOUNT/TRADE ENDPOINTS (SIGNED) ==========

  async changePositionMode(dualSidePosition: boolean): Promise<any> {
    const timestamp = Date.now();
    const params = {
      dualSidePosition: dualSidePosition.toString(),
      timestamp,
      recvWindow: 5000,
    };

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.post(
      `/fapi/v1/positionSide/dual?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async getPositionMode(): Promise<any> {
    const timestamp = Date.now();
    const params = { timestamp, recvWindow: 5000 };

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v1/positionSide/dual?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async changeMultiAssetsMode(multiAssetsMargin: boolean): Promise<any> {
    const timestamp = Date.now();
    const params = {
      multiAssetsMargin: multiAssetsMargin.toString(),
      timestamp,
      recvWindow: 5000,
    };

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.post(
      `/fapi/v1/multiAssetsMargin?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async getMultiAssetsMode(): Promise<any> {
    const timestamp = Date.now();
    const params = { timestamp, recvWindow: 5000 };

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v1/multiAssetsMargin?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async placeOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET' | 'STOP' | 'STOP_MARKET' | 'TAKE_PROFIT' | 'TAKE_PROFIT_MARKET' | 'TRAILING_STOP_MARKET';
    quantity?: number;
    price?: number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTX';
    positionSide?: 'BOTH' | 'LONG' | 'SHORT';
    reduceOnly?: boolean;
    newClientOrderId?: string;
    stopPrice?: number;
    closePosition?: boolean;
    activationPrice?: number;
    callbackRate?: number;
    workingType?: 'MARK_PRICE' | 'CONTRACT_PRICE';
    priceProtect?: boolean;
    newOrderRespType?: 'ACK' | 'RESULT';
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

    const response = await this.axiosInstance.post(
      `/fapi/v1/order?${queryString}&signature=${signature}`
    );
    
    return response.data;
  }

  async placeBatchOrders(orders: Array<any>): Promise<any> {
    if (this.shouldBackoff()) {
      await this.sleep(500);
    }

    const timestamp = Date.now();
    const params = {
      batchOrders: JSON.stringify(orders),
      timestamp,
      recvWindow: 5000,
    };

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.post(
      `/fapi/v1/batchOrders?${queryString}&signature=${signature}`
    );
    
    return response.data;
  }

  async queryOrder(symbol: string, orderId?: string, origClientOrderId?: string): Promise<any> {
    const timestamp = Date.now();
    const params: any = { symbol, timestamp, recvWindow: 5000 };

    if (orderId) params.orderId = orderId;
    if (origClientOrderId) params.origClientOrderId = origClientOrderId;

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v1/order?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async cancelOrder(symbol: string, orderId?: string, origClientOrderId?: string): Promise<any> {
    const timestamp = Date.now();
    const params: any = { symbol, timestamp, recvWindow: 5000 };

    if (orderId) params.orderId = orderId;
    if (origClientOrderId) params.origClientOrderId = origClientOrderId;

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.delete(
      `/fapi/v1/order?${queryString}&signature=${signature}`
    );
    
    return response.data;
  }

  async cancelAllOrders(symbol: string): Promise<any> {
    const timestamp = Date.now();
    const params = { symbol, timestamp, recvWindow: 5000 };

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.delete(
      `/fapi/v1/allOpenOrders?${queryString}&signature=${signature}`
    );
    
    return response.data;
  }

  async cancelBatchOrders(symbol: string, orderIdList?: number[], origClientOrderIdList?: string[]): Promise<any> {
    const timestamp = Date.now();
    const params: any = { symbol, timestamp, recvWindow: 5000 };

    if (orderIdList) params.orderIdList = JSON.stringify(orderIdList);
    if (origClientOrderIdList) params.origClientOrderIdList = JSON.stringify(origClientOrderIdList);

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.delete(
      `/fapi/v1/batchOrders?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async setAutoCancelTimer(symbol: string, countdownTime: number): Promise<any> {
    const timestamp = Date.now();
    const params = { symbol, countdownTime, timestamp, recvWindow: 5000 };

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.post(
      `/fapi/v1/countdownCancelAll?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async getOpenOrders(symbol?: string): Promise<any> {
    const timestamp = Date.now();
    const params: any = { timestamp, recvWindow: 5000 };

    if (symbol) params.symbol = symbol;

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v1/openOrders?${queryString}&signature=${signature}`
    );
    
    return response.data;
  }

  async getAllOrders(symbol: string, params?: { orderId?: number; startTime?: number; endTime?: number; limit?: number }): Promise<any> {
    const timestamp = Date.now();
    const queryParams = {
      symbol,
      ...params,
      timestamp,
      recvWindow: 5000,
    };

    const queryString = this.buildQueryString(queryParams);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v1/allOrders?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async getBalance(): Promise<any> {
    const timestamp = Date.now();
    const params = { timestamp, recvWindow: 5000 };

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v2/balance?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async getAccountInfo(): Promise<any> {
    const timestamp = Date.now();
    const params = { timestamp, recvWindow: 5000 };

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v4/account?${queryString}&signature=${signature}`
    );
    
    return response.data;
  }

  async changeLeverage(symbol: string, leverage: number): Promise<any> {
    const timestamp = Date.now();
    const params = { symbol, leverage, timestamp, recvWindow: 5000 };

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.post(
      `/fapi/v1/leverage?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async changeMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSSED'): Promise<any> {
    const timestamp = Date.now();
    const params = { symbol, marginType, timestamp, recvWindow: 5000 };

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.post(
      `/fapi/v1/marginType?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async modifyPositionMargin(symbol: string, amount: number, type: 1 | 2, positionSide?: 'BOTH' | 'LONG' | 'SHORT'): Promise<any> {
    const timestamp = Date.now();
    const params: any = { symbol, amount, type, timestamp, recvWindow: 5000 };
    if (positionSide) params.positionSide = positionSide;

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.post(
      `/fapi/v1/positionMargin?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async getPositionMarginHistory(symbol: string, params?: { type?: number; startTime?: number; endTime?: number; limit?: number }): Promise<any> {
    const timestamp = Date.now();
    const queryParams = { symbol, ...params, timestamp, recvWindow: 5000 };

    const queryString = this.buildQueryString(queryParams);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v1/positionMargin/history?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async getPositionRisk(symbol?: string): Promise<any> {
    const timestamp = Date.now();
    const params: any = { timestamp, recvWindow: 5000 };
    if (symbol) params.symbol = symbol;

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v2/positionRisk?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async getUserTrades(symbol: string, params?: { startTime?: number; endTime?: number; fromId?: number; limit?: number }): Promise<any> {
    const timestamp = Date.now();
    const queryParams = { symbol, ...params, timestamp, recvWindow: 5000 };

    const queryString = this.buildQueryString(queryParams);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v1/userTrades?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async getIncome(params?: { symbol?: string; incomeType?: string; startTime?: number; endTime?: number; limit?: number }): Promise<any> {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp, recvWindow: 5000 };

    const queryString = this.buildQueryString(queryParams);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v1/income?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async getLeverageBracket(symbol?: string): Promise<any> {
    const timestamp = Date.now();
    const params: any = { timestamp, recvWindow: 5000 };
    if (symbol) params.symbol = symbol;

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v1/leverageBracket?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async getADLQuantile(symbol?: string): Promise<any> {
    const timestamp = Date.now();
    const params: any = { timestamp, recvWindow: 5000 };
    if (symbol) params.symbol = symbol;

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v1/adlQuantile?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async getForceOrders(params?: { symbol?: string; autoCloseType?: 'LIQUIDATION' | 'ADL'; startTime?: number; endTime?: number; limit?: number }): Promise<any> {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp, recvWindow: 5000 };

    const queryString = this.buildQueryString(queryParams);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v1/forceOrders?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  async getCommissionRate(symbol: string): Promise<any> {
    const timestamp = Date.now();
    const params = { symbol, timestamp, recvWindow: 5000 };

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const response = await this.axiosInstance.get(
      `/fapi/v1/commissionRate?${queryString}&signature=${signature}`
    );
    return response.data;
  }

  // ========== USER DATA STREAM ENDPOINTS ==========

  async startUserDataStream(): Promise<string> {
    const response = await this.axiosInstance.post('/fapi/v1/listenKey');
    return response.data.listenKey;
  }

  async keepaliveUserDataStream(): Promise<void> {
    await this.axiosInstance.put('/fapi/v1/listenKey');
  }

  async closeUserDataStream(): Promise<void> {
    await this.axiosInstance.delete('/fapi/v1/listenKey');
  }

  // ========== UTILITY METHODS ==========

  getRateLimitStatus(): RateLimitConfig {
    return { ...this.rateLimits };
  }
}
