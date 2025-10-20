import { AsterdexClient } from './asterdex-client';
import { UserDataStreamManager } from './user-data-stream';
import { storage } from './storage';
import { BotConfig, Order, ActivityLog } from '@shared/schema';
import { EventEmitter } from 'events';

interface MarketData {
  markPrice: number;
  fundingRate: number;
  nextFundingTime: number;
  ticker24h: any;
}

interface RiskMetrics {
  adlQuantile: any;
  positionRisk: any[];
  leverageBracket: any;
}

export class BotEngine extends EventEmitter {
  private client: AsterdexClient;
  private userDataStream: UserDataStreamManager | null = null;
  private config: BotConfig;
  private botId: string;
  private isRunning: boolean = false;
  private orderIndex: number = 50000;
  private activeOrders: Map<string, any> = new Map();
  private sessionStart: Date = new Date();
  private refreshTimer: NodeJS.Timeout | null = null;
  private statusTimer: NodeJS.Timeout | null = null;
  private marketData: MarketData | null = null;
  private riskMetrics: RiskMetrics | null = null;

  // Symbol precision
  private pricePrecision: number = 2;
  private quantityPrecision: number = 6;

  // Performance tracking
  private commissionRate: { maker: number; taker: number } | null = null;

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

      // Get commission rates
      try {
        const commissionData = await this.client.getCommissionRate(this.config.marketSymbol);
        this.commissionRate = {
          maker: parseFloat(commissionData.makerCommissionRate),
          taker: parseFloat(commissionData.takerCommissionRate),
        };
        await this.addLog('info', `Commission rates: Maker ${(this.commissionRate.maker * 100).toFixed(3)}%, Taker ${(this.commissionRate.taker * 100).toFixed(3)}%`);
      } catch (error: any) {
        await this.addLog('warning', `Failed to fetch commission rates: ${error.message}`);
      }

      // Initialize user data stream for real-time order updates
      try {
        this.userDataStream = new UserDataStreamManager(this.client);
        this.setupUserDataStreamHandlers();
        await this.userDataStream.start();
        await this.addLog('info', 'Real-time order updates enabled');
      } catch (error: any) {
        await this.addLog('warning', `WebSocket stream disabled: ${error.message}`);
      }

      await this.addLog('info', `Bot initialized for ${this.config.marketSymbol}`);
    } catch (error: any) {
      await this.addLog('error', `Initialization failed: ${error.message}`);
      throw error;
    }
  }

  private setupUserDataStreamHandlers(): void {
    if (!this.userDataStream) return;

    // Handle order updates
    this.userDataStream.on('ORDER_TRADE_UPDATE', async (event) => {
      const orderData = event.data.o;
      
      if (orderData.s !== this.config.marketSymbol) return;

      const clientOrderId = orderData.c;
      
      // Update order in database
      try {
        const existingOrders = await storage.getOrders(this.botId);
        const order = existingOrders.find(o => o.clientOrderId === clientOrderId);
        
        if (order) {
          await storage.updateOrder(order.id!, {
            status: orderData.X,
            filledQuantity: parseFloat(orderData.z),
            updatedAt: new Date().toISOString(),
          });

          // Track fills for statistics
          if (orderData.X === 'FILLED' || orderData.X === 'PARTIALLY_FILLED') {
            const fillQty = parseFloat(orderData.l);
            const fillPrice = parseFloat(orderData.L);
            
            await this.trackFill(orderData.S, fillQty, fillPrice);
            await this.addLog('success', `Order ${orderData.X}: ${orderData.S} ${fillQty} @ ${fillPrice}`);
          }

          this.emit('orderUpdated', { botId: this.botId, order: orderData });
        }
      } catch (error: any) {
        console.error('Error handling order update:', error);
      }
    });

    // Handle account updates
    this.userDataStream.on('ACCOUNT_UPDATE', async (event) => {
      const updateData = event.data.a;
      
      // Update position information
      if (updateData.P && Array.isArray(updateData.P)) {
        for (const pos of updateData.P) {
          if (pos.s === this.config.marketSymbol) {
            await this.addLog('info', `Position updated: ${pos.pa} @ ${pos.ep}, PnL: ${pos.up}`);
          }
        }
      }

      this.emit('accountUpdated', { botId: this.botId, data: updateData });
    });

    // Handle margin call warnings
    this.userDataStream.on('MARGIN_CALL', async (event) => {
      await this.addLog('error', 'MARGIN CALL WARNING! Position at risk of liquidation!');
      this.emit('marginCall', { botId: this.botId, data: event.data });
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.sessionStart = new Date();
    
    await storage.updateBotInstance(this.botId, { status: 'running' });
    await this.addLog('info', 'Bot started');

    // Fetch initial market data and risk metrics
    await this.updateMarketData();
    await this.updateRiskMetrics();

    // Start main trading loop
    this.runTradingLoop();

    // Start status update timer (every 30s)
    this.statusTimer = setInterval(() => {
      this.updateStatus();
      this.updateMarketData();
      this.updateRiskMetrics();
    }, 30000);
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

    // Stop user data stream
    if (this.userDataStream) {
      try {
        await this.userDataStream.stop();
      } catch (error: any) {
        console.error('Error stopping user data stream:', error);
      }
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

  private async updateMarketData(): Promise<void> {
    try {
      // Fetch mark price and funding rate
      const markPriceData = await this.client.getMarkPrice(this.config.marketSymbol);
      const ticker24h = await this.client.get24hrTicker(this.config.marketSymbol);

      this.marketData = {
        markPrice: parseFloat(markPriceData.markPrice),
        fundingRate: parseFloat(markPriceData.lastFundingRate || '0'),
        nextFundingTime: markPriceData.nextFundingTime || 0,
        ticker24h: ticker24h,
      };

      this.emit('marketDataUpdated', { botId: this.botId, data: this.marketData });
    } catch (error: any) {
      console.error('Failed to update market data:', error);
    }
  }

  private async updateRiskMetrics(): Promise<void> {
    try {
      // Fetch ADL quantile
      const adlQuantile = await this.client.getADLQuantile(this.config.marketSymbol);
      
      // Fetch position risk
      const positionRisk = await this.client.getPositionRisk(this.config.marketSymbol);
      
      // Fetch leverage bracket
      const leverageBracket = await this.client.getLeverageBracket(this.config.marketSymbol);

      this.riskMetrics = {
        adlQuantile,
        positionRisk,
        leverageBracket,
      };

      // Check for high ADL quantile (risk of auto-deleveraging)
      if (Array.isArray(adlQuantile) && adlQuantile.length > 0) {
        const adl = adlQuantile[0].adlQuantile;
        if (adl && (adl.LONG > 3 || adl.SHORT > 3 || adl.BOTH > 3)) {
          await this.addLog('warning', `High ADL risk detected: ${JSON.stringify(adl)}`);
        }
      }

      this.emit('riskMetricsUpdated', { botId: this.botId, metrics: this.riskMetrics });
    } catch (error: any) {
      console.error('Failed to update risk metrics:', error);
    }
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
        
        // Use mark price if available for more accurate pricing
        const referencePrice = this.marketData?.markPrice || (bestBid + bestAsk) / 2;

        // Calculate spread
        const spreadAmount = referencePrice * (this.config.spreadBps / 10000);

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
        const quantity = this.formatQuantity(orderSize / referencePrice);

        // Use batch orders for efficiency
        const batchOrders: any[] = [];

        // Prepare buy orders
        for (let i = 0; i < Math.min(this.config.ordersPerSide, this.config.maxOrdersToPlace); i++) {
          const price = this.formatPrice(referencePrice - spreadAmount - (i * spreadAmount * 0.1));
          const clientOrderId = `${this.botId}_${this.orderIndex++}`;
          
          batchOrders.push({
            symbol: this.config.marketSymbol,
            side: 'BUY',
            type: 'LIMIT',
            quantity: quantity,
            price: price,
            timeInForce: this.config.usePostOnly ? 'GTX' : 'GTC',
            newClientOrderId: clientOrderId,
          });

          // Store order intent in database
          await storage.createOrder({
            botId: this.botId,
            clientOrderId,
            symbol: this.config.marketSymbol,
            side: 'BUY',
            type: 'LIMIT',
            price,
            quantity,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        // Prepare sell orders
        for (let i = 0; i < Math.min(this.config.ordersPerSide, this.config.maxOrdersToPlace); i++) {
          const price = this.formatPrice(referencePrice + spreadAmount + (i * spreadAmount * 0.1));
          const clientOrderId = `${this.botId}_${this.orderIndex++}`;
          
          batchOrders.push({
            symbol: this.config.marketSymbol,
            side: 'SELL',
            type: 'LIMIT',
            quantity: quantity,
            price: price,
            timeInForce: this.config.usePostOnly ? 'GTX' : 'GTC',
            newClientOrderId: clientOrderId,
          });

          // Store order intent in database
          await storage.createOrder({
            botId: this.botId,
            clientOrderId,
            symbol: this.config.marketSymbol,
            side: 'SELL',
            type: 'LIMIT',
            price,
            quantity,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        // Place batch orders (up to 5 at a time per API limit)
        const maxBatchSize = 5;
        for (let i = 0; i < batchOrders.length; i += maxBatchSize) {
          const batch = batchOrders.slice(i, i + maxBatchSize);
          
          try {
            await this.client.placeBatchOrders(batch);
            await this.addLog('info', `Placed ${batch.length} orders`);
            
            // Update order statuses
            for (const order of batch) {
              await storage.updateOrderByClientId(order.newClientOrderId, { status: 'NEW' });
            }
            
            this.emit('ordersBatchPlaced', { botId: this.botId, count: batch.length });
            
            await this.sleep(this.config.delayBetweenOrders * 1000);
          } catch (error: any) {
            await this.addLog('error', `Failed to place batch orders: ${error.message}`);
            
            // Fall back to individual orders
            for (const order of batch) {
              try {
                await this.client.placeOrder(order);
                await storage.updateOrderByClientId(order.newClientOrderId, { status: 'NEW' });
                await this.sleep(this.config.delayBetweenOrders * 1000);
              } catch (individualError: any) {
                await this.addLog('error', `Failed to place ${order.side} order: ${individualError.message}`);
                await storage.updateOrderByClientId(order.newClientOrderId, { status: 'FAILED' });
              }
            }
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

  private async trackFill(side: string, quantity: number, price: number): Promise<void> {
    const stats = await storage.getBotStats(this.botId);
    if (!stats) return;

    const volume = quantity * price;
    const commission = this.commissionRate 
      ? volume * (this.config.usePostOnly ? this.commissionRate.maker : this.commissionRate.taker)
      : 0;

    await storage.updateBotStats(this.botId, {
      totalVolume: stats.totalVolume + volume,
      totalTrades: stats.totalTrades + 1,
      totalFees: stats.totalFees + commission,
    });
  }

  private async updateStatus(): Promise<void> {
    try {
      // Get current stats
      const stats = await storage.getBotStats(this.botId);
      if (!stats) return;

      // Calculate session uptime
      const uptime = Math.floor((Date.now() - this.sessionStart.getTime()) / 1000);

      // Get all orders to calculate fill rate
      const allOrders = await storage.getOrders(this.botId);
      const totalOrders = allOrders.length;
      const filledOrders = allOrders.filter(o => o.status === 'FILLED').length;
      const fillRate = totalOrders > 0 ? (filledOrders / totalOrders) * 100 : 0;

      // Calculate hourly volume
      const hourlyVolume = await this.calculateHourlyVolume();

      // Update stats
      await storage.updateBotStats(this.botId, {
        sessionUptime: uptime,
        fillRate,
      });

      // Store hourly volume
      if (hourlyVolume > 0) {
        const now = new Date();
        const hourKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
        
        await storage.updateHourlyVolume(this.botId, hourKey, hourlyVolume);
      }

      this.emit('statsUpdated', { botId: this.botId, stats });

    } catch (error: any) {
      console.error('Failed to update status:', error);
    }
  }

  private async calculateHourlyVolume(): Promise<number> {
    try {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const trades = await this.client.getUserTrades(this.config.marketSymbol, {
        startTime: oneHourAgo,
        limit: 1000,
      });

      let volume = 0;
      for (const trade of trades) {
        volume += parseFloat(trade.quoteQty);
      }

      return volume;
    } catch (error) {
      return 0;
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

  getMarketData(): MarketData | null {
    return this.marketData;
  }

  getRiskMetrics(): RiskMetrics | null {
    return this.riskMetrics;
  }

  getCommissionRate(): { maker: number; taker: number } | null {
    return this.commissionRate;
  }
}
