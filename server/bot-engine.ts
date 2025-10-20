import { AsterdexClient } from './asterdex-client';
import { UserDataStreamManager } from './user-data-stream';
import { storage } from './storage';
import { BotConfig, Order, ActivityLog, Position } from '@shared/schema';
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

interface TrackedPosition {
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  stopLossOrderId?: string;
  takeProfitOrderId?: string;
  trailingStopOrderId?: string;
  peakProfit: number;
  warningTriggered50: boolean;
  warningTriggered75: boolean;
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
  
  // Symbol filters (tick size, step size, min notional)
  private tickSize: number = 0.01;
  private stepSize: number = 0.001;
  private minNotional: number = 5;

  // Performance tracking
  private commissionRate: { maker: number; taker: number } | null = null;

  // Position tracking (NEW)
  private positions: Map<string, TrackedPosition> = new Map();
  private netPosition: number = 0; // Net position quantity (positive = long, negative = short)
  private circuitBreakerTriggered: boolean = false;

  private botShortId: string;

  constructor(botId: string, config: BotConfig) {
    super();
    this.botId = botId;
    this.botShortId = botId.substring(0, 8).replace(/-/g, ''); // Use first 8 chars, remove dashes
    this.config = config;
    this.client = new AsterdexClient(
      config.apiKey,
      config.apiSecret,
      config.baseUrl
    );
  }
  
  private generateClientOrderId(): string {
    // Format: bot_{shortId}_{index} (max 36 chars, valid chars only)
    // Prefix with 'bot_' to ensure it starts with a letter
    // Example: "bot_781ea178_50001" (18 chars)
    const orderId = `bot_${this.botShortId}_${this.orderIndex++}`;
    console.log(`[Bot ${this.botId}] Generated client order ID: "${orderId}" (length: ${orderId.length})`);
    
    if (orderId.length > 36) {
      throw new Error(`Client order ID too long: ${orderId.length} chars`);
    }
    
    // Validate pattern: ^[\.A-Z\:/a-z0-9_-]{1,36}$
    const validPattern = /^[\.A-Z\:/a-z0-9_-]{1,36}$/;
    if (!validPattern.test(orderId)) {
      console.error(`[Bot ${this.botId}] Invalid order ID pattern: "${orderId}"`);
      throw new Error(`Client order ID doesn't match required pattern`);
    }
    
    return orderId;
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
        
        // Extract filters for tick size, step size, and min notional
        if (symbolInfo.filters && Array.isArray(symbolInfo.filters)) {
          const priceFilter = symbolInfo.filters.find((f: any) => f.filterType === 'PRICE_FILTER');
          if (priceFilter && priceFilter.tickSize) {
            this.tickSize = parseFloat(priceFilter.tickSize);
            console.log(`[Bot ${this.botId}] Tick size: ${this.tickSize}`);
          }
          
          const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
          if (lotSizeFilter && lotSizeFilter.stepSize) {
            this.stepSize = parseFloat(lotSizeFilter.stepSize);
            console.log(`[Bot ${this.botId}] Step size: ${this.stepSize}`);
          }
          
          const minNotionalFilter = symbolInfo.filters.find((f: any) => f.filterType === 'MIN_NOTIONAL');
          if (minNotionalFilter && minNotionalFilter.notional) {
            this.minNotional = parseFloat(minNotionalFilter.notional);
            console.log(`[Bot ${this.botId}] Min notional: ${this.minNotional}`);
          }
        }
        
        await this.addLog('info', `Filters: Tick ${this.tickSize}, Step ${this.stepSize}, Min ${this.minNotional} USDT`);
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
      
      console.log(`[Bot ${this.botId}] ACCOUNT UPDATE received:`, JSON.stringify(updateData).substring(0, 300));
      
      // Update position information
      if (updateData.P && Array.isArray(updateData.P)) {
        for (const pos of updateData.P) {
          console.log(`[Bot ${this.botId}] Position update:`, {
            symbol: pos.s,
            amount: pos.pa,
            entryPrice: pos.ep,
            unrealizedPnL: pos.up,
            side: parseFloat(pos.pa) > 0 ? 'LONG' : parseFloat(pos.pa) < 0 ? 'SHORT' : 'NONE'
          });
          
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
    console.log(`[Bot ${this.botId}] 🚀 Trading loop started for ${this.config.marketSymbol}`);
    
    while (this.isRunning) {
      try {
        console.log(`[Bot ${this.botId}] 🔄 Loop iteration - fetching orderbook...`);
        
        // Get current orderbook
        const orderbook = await this.client.getOrderBook(this.config.marketSymbol, 10);
        
        if (!orderbook.bids || !orderbook.asks) {
          console.log(`[Bot ${this.botId}] ⚠️  No orderbook data, retrying...`);
          await this.sleep(this.config.refreshInterval * 1000);
          continue;
        }

        const bestBid = parseFloat(orderbook.bids[0][0]);
        const bestAsk = parseFloat(orderbook.asks[0][0]);
        
        // Use mark price if available for more accurate pricing
        const referencePrice = this.marketData?.markPrice || (bestBid + bestAsk) / 2;
        
        console.log(`[Bot ${this.botId}] 💰 Reference price: ${referencePrice}, Bid: ${bestBid}, Ask: ${bestAsk}`);

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
        const rawQuantity = orderSize / referencePrice;
        const quantity = this.formatQuantity(rawQuantity);
        
        console.log(`[Bot ${this.botId}] Order calculation: effectiveCapital=${effectiveCapital}, orderSize=${orderSize}, rawQuantity=${rawQuantity}, formatted=${quantity}`);
        
        // Check for zero quantity
        if (parseFloat(quantity) === 0 || isNaN(parseFloat(quantity))) {
          console.error(`[Bot ${this.botId}] ERROR: Calculated quantity is zero or invalid!`);
          await this.sleep(this.config.refreshInterval * 1000);
          continue;
        }

        // Use batch orders for efficiency
        const batchOrders: any[] = [];

        // Prepare buy orders
        for (let i = 0; i < Math.min(this.config.ordersPerSide, this.config.maxOrdersToPlace); i++) {
          const rawPrice = referencePrice - spreadAmount - (i * spreadAmount * 0.1);
          const price = this.formatPrice(rawPrice);
          const priceNum = parseFloat(price);
          const qtyNum = parseFloat(quantity);
          
          // Validate minimum notional
          if (!this.validateOrderNotional(priceNum, qtyNum)) {
            console.log(`[Bot ${this.botId}] Skipping BUY order ${i+1}: Notional ${(priceNum * qtyNum).toFixed(2)} < ${this.minNotional}`);
            continue;
          }
          
          const clientOrderId = this.generateClientOrderId();
          
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
          const rawPrice = referencePrice + spreadAmount + (i * spreadAmount * 0.1);
          const price = this.formatPrice(rawPrice);
          const priceNum = parseFloat(price);
          const qtyNum = parseFloat(quantity);
          
          // Validate minimum notional
          if (!this.validateOrderNotional(priceNum, qtyNum)) {
            console.log(`[Bot ${this.botId}] Skipping SELL order ${i+1}: Notional ${(priceNum * qtyNum).toFixed(2)} < ${this.minNotional}`);
            continue;
          }
          
          const clientOrderId = this.generateClientOrderId();
          
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
          
          console.log(`[Bot ${this.botId}] Sending batch with client order IDs:`, batch.map(o => o.newClientOrderId));
          
          try {
            const batchResponse = await this.client.placeBatchOrders(batch);
            console.log(`[Bot ${this.botId}] Batch order response:`, JSON.stringify(batchResponse).substring(0, 200));
            await this.addLog('info', `Placed ${batch.length} orders on exchange`);
            
            // Update order statuses with exchange order IDs
            if (Array.isArray(batchResponse)) {
              for (let idx = 0; idx < batchResponse.length; idx++) {
                const orderResp = batchResponse[idx];
                if (orderResp.orderId) {
                  await storage.updateOrderByClientId(batch[idx].newClientOrderId, { 
                    status: orderResp.status || 'NEW',
                    exchangeOrderId: orderResp.orderId?.toString()
                  });
                  console.log(`[Bot ${this.botId}] Order ${batch[idx].newClientOrderId} placed: ID ${orderResp.orderId}`);
                } else if (orderResp.code) {
                  await storage.updateOrderByClientId(batch[idx].newClientOrderId, { status: 'FAILED' });
                  await this.addLog('error', `Order ${idx + 1} failed: ${orderResp.msg}`);
                }
              }
            }
            
            this.emit('ordersBatchPlaced', { botId: this.botId, count: batch.length });
            
            await this.sleep(this.config.delayBetweenOrders * 1000);
          } catch (error: any) {
            console.error(`[Bot ${this.botId}] Batch order error:`, error.message, error.response?.data);
            await this.addLog('error', `Failed to place batch orders: ${error.message}`);
            
            // Fall back to individual orders
            for (const order of batch) {
              try {
                const singleResponse = await this.client.placeOrder(order);
                console.log(`[Bot ${this.botId}] Single order placed:`, singleResponse.orderId);
                await storage.updateOrderByClientId(order.newClientOrderId, { 
                  status: 'NEW',
                  exchangeOrderId: singleResponse.orderId?.toString()
                });
                await this.sleep(this.config.delayBetweenOrders * 1000);
              } catch (individualError: any) {
                console.error(`[Bot ${this.botId}] Individual order error:`, individualError.message);
                await this.addLog('error', `Failed to place ${order.side} order: ${individualError.message}`);
                await storage.updateOrderByClientId(order.newClientOrderId, { status: 'FAILED' });
              }
            }
          }
        }

        // Check manual TP/SL and circuit breaker (Layer 2 protection)
        await this.checkManualTPSL();

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

    // Update position tracking (NEW)
    await this.updatePositionTracking(side, quantity, price);
  }

  // ===== POSITION TRACKING & RISK MANAGEMENT (NEW) =====

  private async updatePositionTracking(side: string, quantity: number, price: number): Promise<void> {
    try {
      // Update net position
      const quantityChange = side === 'BUY' ? quantity : -quantity;
      this.netPosition += quantityChange;

      // Determine if we're opening a new position or closing existing one
      const positionId = `${this.config.marketSymbol}_${this.botId}`;
      const existingPosition = this.positions.get(positionId);

      if (Math.abs(this.netPosition) > 0.0001) { // Position exists
        const positionSide: 'LONG' | 'SHORT' = this.netPosition > 0 ? 'LONG' : 'SHORT';
        
        if (!existingPosition || existingPosition.side !== positionSide) {
          // New position opened
          const newPosition: TrackedPosition = {
            side: positionSide,
            entryPrice: price,
            quantity: Math.abs(this.netPosition),
            peakProfit: 0,
            warningTriggered50: false,
            warningTriggered75: false,
          };
          
          this.positions.set(positionId, newPosition);
          await this.addLog('info', `Position opened: ${positionSide} ${Math.abs(this.netPosition)} @ ${price}`);
          
          // Place native TP/SL orders (Layer 1 protection)
          await this.placeProtectionOrders(positionId, newPosition);
        } else {
          // Position size changed - update entry price (weighted average)
          const totalQty = existingPosition.quantity + Math.abs(quantityChange);
          const totalCost = (existingPosition.entryPrice * existingPosition.quantity) + (price * Math.abs(quantityChange));
          existingPosition.entryPrice = totalCost / totalQty;
          existingPosition.quantity = Math.abs(this.netPosition);
          
          await this.addLog('info', `Position updated: ${positionSide} ${existingPosition.quantity} @ ${existingPosition.entryPrice}`);
          
          // Update protection orders
          await this.updateProtectionOrders(positionId, existingPosition);
        }
      } else {
        // Position closed
        if (existingPosition) {
          await this.addLog('success', `Position closed: ${existingPosition.side}`);
          await this.cancelProtectionOrders(positionId, existingPosition);
          this.positions.delete(positionId);
        }
      }

      this.emit('positionUpdated', { botId: this.botId, netPosition: this.netPosition });
    } catch (error: any) {
      console.error('Error updating position tracking:', error);
    }
  }

  private async placeProtectionOrders(positionId: string, position: TrackedPosition): Promise<void> {
    try {
      const markPrice = this.marketData?.markPrice || position.entryPrice;

      // Calculate TP/SL prices
      const stopLossPrice = position.side === 'LONG'
        ? position.entryPrice * (1 - this.config.stopLossPercent / 100)
        : position.entryPrice * (1 + this.config.stopLossPercent / 100);

      const takeProfitPrice = position.side === 'LONG'
        ? position.entryPrice * (1 + this.config.takeProfitPercent / 100)
        : position.entryPrice * (1 - this.config.takeProfitPercent / 100);

      // Place Stop-Loss order (Layer 1)
      if (this.config.enableStopLoss) {
        try {
          const stopLossOrder = await this.client.placeOrder({
            symbol: this.config.marketSymbol,
            side: position.side === 'LONG' ? 'SELL' : 'BUY',
            type: 'STOP_MARKET',
            stopPrice: this.formatPrice(stopLossPrice),
            closePosition: true,
            workingType: 'MARK_PRICE',
            priceProtect: true,
          });

          position.stopLossOrderId = stopLossOrder.orderId?.toString();
          await this.addLog('success', `Stop-loss placed at ${this.formatPrice(stopLossPrice)} (${this.config.stopLossPercent}%)`);
        } catch (error: any) {
          await this.addLog('error', `Failed to place stop-loss: ${error.message}`);
        }
      }

      // Place Take-Profit order (Layer 1)
      if (this.config.enableTakeProfit) {
        try {
          const takeProfitOrder = await this.client.placeOrder({
            symbol: this.config.marketSymbol,
            side: position.side === 'LONG' ? 'SELL' : 'BUY',
            type: 'TAKE_PROFIT_MARKET',
            stopPrice: this.formatPrice(takeProfitPrice),
            closePosition: true,
            workingType: 'MARK_PRICE',
          });

          position.takeProfitOrderId = takeProfitOrder.orderId?.toString();
          await this.addLog('success', `Take-profit placed at ${this.formatPrice(takeProfitPrice)} (${this.config.takeProfitPercent}%)`);
        } catch (error: any) {
          await this.addLog('error', `Failed to place take-profit: ${error.message}`);
        }
      }

    } catch (error: any) {
      console.error('Error placing protection orders:', error);
    }
  }

  private async updateProtectionOrders(positionId: string, position: TrackedPosition): Promise<void> {
    // Cancel existing protection orders
    await this.cancelProtectionOrders(positionId, position);
    
    // Place new protection orders with updated prices
    await this.placeProtectionOrders(positionId, position);
  }

  private async cancelProtectionOrders(positionId: string, position: TrackedPosition): Promise<void> {
    try {
      // Cancel stop-loss
      if (position.stopLossOrderId) {
        try {
          await this.client.cancelOrder(this.config.marketSymbol, { orderId: position.stopLossOrderId });
        } catch (error) {
          // Order might already be filled or cancelled
        }
      }

      // Cancel take-profit
      if (position.takeProfitOrderId) {
        try {
          await this.client.cancelOrder(this.config.marketSymbol, { orderId: position.takeProfitOrderId });
        } catch (error) {
          // Order might already be filled or cancelled
        }
      }

      // Cancel trailing stop
      if (position.trailingStopOrderId) {
        try {
          await this.client.cancelOrder(this.config.marketSymbol, { orderId: position.trailingStopOrderId });
        } catch (error) {
          // Order might already be filled or cancelled
        }
      }
    } catch (error: any) {
      console.error('Error cancelling protection orders:', error);
    }
  }

  private async checkManualTPSL(): Promise<void> {
    // Layer 2: Manual fallback protection
    if (!this.marketData) return;

    for (const [positionId, position] of this.positions) {
      try {
        const markPrice = this.marketData.markPrice;
        const pnlPercent = this.calculatePnLPercent(position, markPrice);

        // Check stop-loss trigger
        if (this.config.enableStopLoss) {
          const stopLossTriggered = position.side === 'LONG'
            ? pnlPercent <= -this.config.stopLossPercent
            : pnlPercent >= this.config.stopLossPercent;

          if (stopLossTriggered) {
            await this.addLog('warning', `Manual stop-loss triggered! PnL: ${pnlPercent.toFixed(2)}%`);
            await this.closePosition(position);
            this.positions.delete(positionId);
          }
        }

        // Check take-profit trigger
        if (this.config.enableTakeProfit) {
          const takeProfitTriggered = position.side === 'LONG'
            ? pnlPercent >= this.config.takeProfitPercent
            : pnlPercent <= -this.config.takeProfitPercent;

          if (takeProfitTriggered) {
            await this.addLog('success', `Manual take-profit triggered! PnL: ${pnlPercent.toFixed(2)}%`);
            await this.closePosition(position);
            this.positions.delete(positionId);
          }
        }

        // Check trailing stop
        if (this.config.enableTrailingStop) {
          await this.checkTrailingStop(positionId, position, markPrice);
        }

        // Update position health
        await this.updatePositionHealth(positionId, position, markPrice);

      } catch (error: any) {
        console.error('Error checking manual TP/SL:', error);
      }
    }

    // Check circuit breaker
    await this.checkCircuitBreaker();
  }

  private async checkTrailingStop(positionId: string, position: TrackedPosition, markPrice: number): Promise<void> {
    const pnlPercent = this.calculatePnLPercent(position, markPrice);
    
    // Update peak profit
    if (pnlPercent > position.peakProfit) {
      position.peakProfit = pnlPercent;
    }

    // Check if trailing stop should activate
    if (!position.trailingStopActive && pnlPercent >= this.config.trailingStopActivationPercent) {
      // Activate trailing stop
      try {
        const callbackRate = this.config.trailingStopCallbackRate;
        const activationPrice = markPrice;

        const trailingStopOrder = await this.client.placeOrder({
          symbol: this.config.marketSymbol,
          side: position.side === 'LONG' ? 'SELL' : 'BUY',
          type: 'TRAILING_STOP_MARKET',
          activationPrice: this.formatPrice(activationPrice),
          callbackRate: callbackRate.toString(),
          closePosition: true,
          workingType: 'MARK_PRICE',
        });

        position.trailingStopOrderId = trailingStopOrder.orderId?.toString();
        position.trailingStopActive = true;
        
        await this.addLog('success', `Trailing stop activated at ${pnlPercent.toFixed(2)}% profit (callback ${callbackRate}%)`);
      } catch (error: any) {
        await this.addLog('error', `Failed to place trailing stop: ${error.message}`);
      }
    }
  }

  private async updatePositionHealth(positionId: string, position: TrackedPosition, markPrice: number): Promise<void> {
    const pnlPercent = this.calculatePnLPercent(position, markPrice);
    const lossPercent = Math.abs(Math.min(0, pnlPercent));
    const stopLossPercent = this.config.stopLossPercent;

    // Early warning at 50% of stop-loss
    if (this.config.earlyWarningThreshold50 && !position.warningTriggered50 && lossPercent >= stopLossPercent * 0.5) {
      position.warningTriggered50 = true;
      await this.addLog('warning', `⚠️ Position ${position.side} at 50% of stop-loss threshold! PnL: ${pnlPercent.toFixed(2)}%`);
      this.emit('positionWarning', { botId: this.botId, level: 50, pnlPercent });
    }

    // Early warning at 75% of stop-loss
    if (this.config.earlyWarningThreshold75 && !position.warningTriggered75 && lossPercent >= stopLossPercent * 0.75) {
      position.warningTriggered75 = true;
      await this.addLog('warning', `⚠️⚠️ Position ${position.side} at 75% of stop-loss threshold! PnL: ${pnlPercent.toFixed(2)}%`);
      this.emit('positionWarning', { botId: this.botId, level: 75, pnlPercent });
    }
  }

  private async checkCircuitBreaker(): Promise<void> {
    if (!this.config.circuitBreakerEnabled || this.circuitBreakerTriggered) return;

    try {
      // Get account positions
      const positionRisk = await this.client.getPositionRisk(this.config.marketSymbol);
      let totalUnrealizedPnL = 0;

      for (const pos of positionRisk) {
        totalUnrealizedPnL += parseFloat(pos.unRealizedProfit || '0');
      }

      // Check if unrealized loss exceeds threshold
      if (totalUnrealizedPnL < -this.config.circuitBreakerThreshold) {
        this.circuitBreakerTriggered = true;
        await this.addLog('error', `🚨 CIRCUIT BREAKER TRIGGERED! Unrealized loss: ${totalUnrealizedPnL.toFixed(2)} USDT`);
        
        // Close all positions
        await this.closeAllPositions();
        
        // Stop the bot
        await this.pause();
        
        this.emit('circuitBreakerTriggered', { botId: this.botId, totalLoss: totalUnrealizedPnL });
      }
    } catch (error: any) {
      console.error('Error checking circuit breaker:', error);
    }
  }

  private calculatePnLPercent(position: TrackedPosition, currentPrice: number): number {
    if (position.side === 'LONG') {
      return ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    } else {
      return ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
    }
  }

  private async closePosition(position: TrackedPosition): Promise<void> {
    try {
      await this.client.placeOrder({
        symbol: this.config.marketSymbol,
        side: position.side === 'LONG' ? 'SELL' : 'BUY',
        type: 'MARKET',
        quantity: this.formatQuantity(position.quantity),
      });

      await this.addLog('info', `Closed ${position.side} position: ${position.quantity} contracts`);
    } catch (error: any) {
      await this.addLog('error', `Failed to close position: ${error.message}`);
    }
  }

  private async closeAllPositions(): Promise<void> {
    for (const [positionId, position] of this.positions) {
      await this.closePosition(position);
      await this.cancelProtectionOrders(positionId, position);
    }
    
    this.positions.clear();
    this.netPosition = 0;
  }

  // ===== END POSITION TRACKING & RISK MANAGEMENT =====

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

  private formatPrice(price: number): string {
    // Round to tick size: price = round(price / tickSize) * tickSize
    const rounded = Math.round(price / this.tickSize) * this.tickSize;
    return rounded.toFixed(this.pricePrecision);
  }

  private formatQuantity(quantity: number): string {
    // Round to step size: quantity = round(quantity / stepSize) * stepSize
    const rounded = Math.round(quantity / this.stepSize) * this.stepSize;
    return rounded.toFixed(this.quantityPrecision);
  }
  
  private validateOrderNotional(price: number, quantity: number): boolean {
    const notional = price * quantity;
    return notional >= this.minNotional;
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
  
  async updateConfig(updates: Partial<BotConfig>): Promise<void> {
    // Update configuration
    this.config = { ...this.config, ...updates };
    
    // Update in storage
    await storage.updateBot(this.botId, { config: this.config });
    
    // Log the update
    const updatedFields = Object.keys(updates).join(', ');
    await this.addLog('info', `Configuration updated: ${updatedFields}`);
    
    // Emit event
    this.emit('configUpdated', { botId: this.botId, config: this.config });
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
