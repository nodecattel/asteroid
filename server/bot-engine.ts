import { AsterdexClient } from './asterdex-client';
import { storage } from './storage';
import { BotConfig, Order, ActivityLog } from '@shared/schema';
import { EventEmitter } from 'events';

export class BotEngine extends EventEmitter {
  private client: AsterdexClient;
  private config: BotConfig;
  private botId: string;
  private isRunning: boolean = false;
  private orderIndex: number = 50000;
  private activeOrders: Map<string, any> = new Map();
  private sessionStart: Date = new Date();
  private refreshTimer: NodeJS.Timeout | null = null;
  private statusTimer: NodeJS.Timeout | null = null;

  // Symbol precision
  private pricePrecision: number = 2;
  private quantityPrecision: number = 6;

  constructor(botId: string, config: BotConfig) {
    super();
    this.botId = botId;
    this.config = config;
    this.client = new AsterdexClient(
      config.apiKey,
      config.apiSecret,
      config.baseUrl
    );
  }

  async initialize(): Promise<void> {
    try {
      // Test connectivity
      const connected = await this.client.ping();
      if (!connected) {
        throw new Error('Failed to connect to Asterdex API');
      }

      // Get symbol info for precision
      const exchangeInfo = await this.client.getExchangeInfo();
      const symbolInfo = exchangeInfo.symbols?.find(
        (s: any) => s.symbol === this.config.marketSymbol
      );

      if (symbolInfo) {
        this.pricePrecision = symbolInfo.pricePrecision || 2;
        this.quantityPrecision = symbolInfo.quantityPrecision || 6;
      }

      await this.addLog('info', `Bot initialized for ${this.config.marketSymbol}`);
    } catch (error: any) {
      await this.addLog('error', `Initialization failed: ${error.message}`);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.sessionStart = new Date();
    
    await storage.updateBotInstance(this.botId, { status: 'running' });
    await this.addLog('info', 'Bot started');

    // Start main trading loop
    this.runTradingLoop();

    // Start status update timer
    this.statusTimer = setInterval(() => this.updateStatus(), 30000);
  }

  async pause(): Promise<void> {
    this.isRunning = false;
    
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    await storage.updateBotInstance(this.botId, { status: 'paused' });
    await this.addLog('info', 'Bot paused');
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }

    // Cancel all open orders
    try {
      await this.client.cancelAllOrders(this.config.marketSymbol);
      await this.addLog('info', 'All orders cancelled');
    } catch (error: any) {
      await this.addLog('error', `Failed to cancel orders: ${error.message}`);
    }

    await storage.updateBotInstance(this.botId, { status: 'stopped' });
    await this.addLog('info', 'Bot stopped');
  }

  private async runTradingLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Get current orderbook
        const orderbook = await this.client.getOrderBook(this.config.marketSymbol, 10);
        
        if (!orderbook.bids || !orderbook.asks) {
          await this.sleep(this.config.refreshInterval * 1000);
          continue;
        }

        const bestBid = parseFloat(orderbook.bids[0][0]);
        const bestAsk = parseFloat(orderbook.asks[0][0]);
        const midPrice = (bestBid + bestAsk) / 2;

        // Calculate spread
        const spreadAmount = midPrice * (this.config.spreadBps / 10000);

        // Get current open orders
        const openOrders = await this.client.getOpenOrders(this.config.marketSymbol);
        
        // Cancel stale orders
        if (openOrders.length > 0) {
          await this.client.cancelAllOrders(this.config.marketSymbol);
          await this.sleep(this.config.delayAfterCancel * 1000);
        }

        // Calculate order size
        const effectiveCapital = this.config.investmentUsdt * this.config.leverage;
        const orderSize = (effectiveCapital * this.config.orderSizePercent) / 100;
        const quantity = this.formatQuantity(orderSize / midPrice);

        // Place buy orders
        for (let i = 0; i < Math.min(this.config.ordersPerSide, this.config.maxOrdersToPlace); i++) {
          const price = this.formatPrice(midPrice - spreadAmount - (i * spreadAmount * 0.1));
          
          try {
            await this.placeOrder('BUY', price, quantity);
            await this.sleep(this.config.delayBetweenOrders * 1000);
          } catch (error: any) {
            await this.addLog('error', `Failed to place buy order: ${error.message}`);
          }
        }

        // Place sell orders
        for (let i = 0; i < Math.min(this.config.ordersPerSide, this.config.maxOrdersToPlace); i++) {
          const price = this.formatPrice(midPrice + spreadAmount + (i * spreadAmount * 0.1));
          
          try {
            await this.placeOrder('SELL', price, quantity);
            await this.sleep(this.config.delayBetweenOrders * 1000);
          } catch (error: any) {
            await this.addLog('error', `Failed to place sell order: ${error.message}`);
          }
        }

        // Wait before next refresh
        await this.sleep(this.config.refreshInterval * 1000);

      } catch (error: any) {
        await this.addLog('error', `Trading loop error: ${error.message}`);
        await this.sleep(5000); // Wait 5s on error
      }
    }
  }

  private async placeOrder(side: 'BUY' | 'SELL', price: number, quantity: number): Promise<void> {
    const clientOrderId = `${this.botId}_${this.orderIndex++}`;
    
    try {
      const order = await this.client.placeOrder({
        symbol: this.config.marketSymbol,
        side,
        type: 'LIMIT',
        quantity,
        price,
        timeInForce: this.config.usePostOnly ? 'GTX' : 'GTC',
        newClientOrderId: clientOrderId,
      });

      // Store order in database
      await storage.createOrder({
        botId: this.botId,
        clientOrderId,
        symbol: this.config.marketSymbol,
        side,
        type: 'LIMIT',
        price,
        quantity,
        status: 'NEW',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      this.emit('orderPlaced', { botId: this.botId, order });

    } catch (error: any) {
      throw error;
    }
  }

  private async updateStatus(): Promise<void> {
    try {
      // Get current stats
      const stats = await storage.getBotStats(this.botId);
      if (!stats) return;

      // Calculate session uptime
      const uptime = Math.floor((Date.now() - this.sessionStart.getTime()) / 1000);

      // Update stats
      await storage.updateBotStats(this.botId, {
        sessionUptime: uptime,
      });

      this.emit('statsUpdated', { botId: this.botId, stats });

    } catch (error: any) {
      console.error('Failed to update status:', error);
    }
  }

  private async addLog(type: ActivityLog['type'], message: string): Promise<void> {
    await storage.addActivityLog({
      botId: this.botId,
      timestamp: new Date().toISOString(),
      type,
      message,
    });

    this.emit('log', { botId: this.botId, type, message });
  }

  private formatPrice(price: number): number {
    return parseFloat(price.toFixed(this.pricePrecision));
  }

  private formatQuantity(quantity: number): number {
    return parseFloat(quantity.toFixed(this.quantityPrecision));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getBotId(): string {
    return this.botId;
  }

  getConfig(): BotConfig {
    return { ...this.config };
  }
}
