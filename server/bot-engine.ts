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
  private lastProtectionOrderUpdate: Map<string, number> = new Map(); // Track last TP/SL update time per position

  // Smart order management
  private lastOrderPrice: number = 0; // Track last reference price when orders were placed
  private priceDeviationThreshold: number = 0.003; // Cancel only if price moves > 0.3%

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
        // Extract filters for tick size, step size, and min notional
        if (symbolInfo.filters && Array.isArray(symbolInfo.filters)) {
          const priceFilter = symbolInfo.filters.find((f: any) => f.filterType === 'PRICE_FILTER');
          if (priceFilter && priceFilter.tickSize) {
            const tickSizeStr = priceFilter.tickSize.toString();
            this.tickSize = parseFloat(tickSizeStr);
            
            // Calculate price precision from tickSize decimal places
            if (tickSizeStr.includes('.')) {
              this.pricePrecision = tickSizeStr.split('.')[1].replace(/0+$/, '').length;
            } else {
              this.pricePrecision = 0;
            }
            
            console.log(`[Bot ${this.botId}] Tick size: ${this.tickSize}, Price precision: ${this.pricePrecision}`);
          }
          
          const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
          if (lotSizeFilter && lotSizeFilter.stepSize) {
            const stepSizeStr = lotSizeFilter.stepSize.toString();
            this.stepSize = parseFloat(stepSizeStr);
            
            // Calculate quantity precision from stepSize decimal places
            if (stepSizeStr.includes('.')) {
              this.quantityPrecision = stepSizeStr.split('.')[1].replace(/0+$/, '').length;
            } else {
              this.quantityPrecision = 0;
            }
            
            console.log(`[Bot ${this.botId}] Step size: ${this.stepSize}, Quantity precision: ${this.quantityPrecision}`);
          }
          
          const minNotionalFilter = symbolInfo.filters.find((f: any) => f.filterType === 'MIN_NOTIONAL');
          if (minNotionalFilter && minNotionalFilter.notional) {
            this.minNotional = parseFloat(minNotionalFilter.notional);
            console.log(`[Bot ${this.botId}] Min notional: ${this.minNotional}`);
          }
        }
        
        await this.addLog('info', `Precision: Price ${this.pricePrecision} decimals (tick: ${this.tickSize}), Qty ${this.quantityPrecision} decimals (step: ${this.stepSize}), Min: ${this.minNotional} USDT`);
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
            
            await this.trackFill(order.id, orderData.S, fillQty, fillPrice);
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

    // Set leverage on exchange for this symbol
    try {
      await this.client.changeLeverage(this.config.marketSymbol, this.config.leverage);
      await this.addLog('success', `Leverage set to ${this.config.leverage}x on ${this.config.marketSymbol}`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.msg || error.message;
      await this.addLog('warning', `Failed to set leverage: ${errorMsg} (will use existing leverage)`);
    }

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

    // Close all positions with market orders
    try {
      if (this.positions.size > 0) {
        await this.addLog('info', `Closing ${this.positions.size} position(s) before stopping...`);
        await this.closeAllPositions();
        await this.addLog('success', 'All positions closed');
      }
    } catch (error: any) {
      await this.addLog('error', `Failed to close positions: ${error.message}`);
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

        // Calculate spread amounts
        const firstOrderSpread = referencePrice * (this.config.firstOrderSpreadBps / 10000);
        const orderSpacing = referencePrice * (this.config.orderSpacingBps / 10000);

        // Get current open orders
        const openOrders = await this.client.getOpenOrders(this.config.marketSymbol);
        
        // Cancel only LIMIT orders (not TP/SL protection orders)
        const limitOrders = openOrders.filter((order: any) => 
          order.type === 'LIMIT' && 
          order.type !== 'STOP_MARKET' && 
          order.type !== 'TAKE_PROFIT_MARKET'
        );
        
        // Smart order management: Only cancel if price has moved significantly
        let shouldCancelOrders = false;
        let shouldPlaceOrders = false;
        
        // Calculate expected order count based on trading bias
        let expectedBuyOrders = this.config.ordersPerSide;
        let expectedSellOrders = this.config.ordersPerSide;
        
        if (this.config.tradingBias === 'long') {
          const totalOrders = this.config.ordersPerSide * 2;
          expectedBuyOrders = Math.round((totalOrders * this.config.longBiasPercent) / 100);
          expectedSellOrders = totalOrders - expectedBuyOrders;
        } else if (this.config.tradingBias === 'short') {
          const totalOrders = this.config.ordersPerSide * 2;
          expectedSellOrders = Math.round((totalOrders * this.config.longBiasPercent) / 100);
          expectedBuyOrders = totalOrders - expectedSellOrders;
        } else if (this.config.longBiasPercent !== 50) {
          const totalOrders = this.config.ordersPerSide * 2;
          expectedBuyOrders = Math.round((totalOrders * this.config.longBiasPercent) / 100);
          expectedSellOrders = totalOrders - expectedBuyOrders;
        }
        
        const totalExpectedOrders = expectedBuyOrders + expectedSellOrders;
        const currentBuyOrders = limitOrders.filter((o: any) => o.side === 'BUY').length;
        const currentSellOrders = limitOrders.filter((o: any) => o.side === 'SELL').length;
        const currentTotalOrders = limitOrders.length;
        
        if (this.lastOrderPrice === 0) {
          // First iteration - no previous orders
          shouldCancelOrders = false;
          shouldPlaceOrders = true;
          console.log(`[Bot ${this.botId}] 🆕 First iteration - will place initial ${totalExpectedOrders} orders`);
        } else {
          const priceChange = Math.abs(referencePrice - this.lastOrderPrice) / this.lastOrderPrice;
          const threshold = Math.max(this.priceDeviationThreshold, this.config.firstOrderSpreadBps / 10000);
          
          if (priceChange > threshold) {
            shouldCancelOrders = true;
            shouldPlaceOrders = true;
            console.log(`[Bot ${this.botId}] 📊 Price moved ${(priceChange * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%) - will cancel and replace ${currentTotalOrders} orders`);
          } else if (currentTotalOrders < totalExpectedOrders) {
            // Price is stable BUT we're missing some orders (filled or cancelled externally)
            shouldCancelOrders = true; // Cancel all to replace with full set around current price
            shouldPlaceOrders = true;
            console.log(`[Bot ${this.botId}] 🔄 Price stable but missing orders: have ${currentTotalOrders}/${totalExpectedOrders} (${currentBuyOrders} BUY, ${currentSellOrders} SELL) - will replace all`);
          } else {
            shouldCancelOrders = false;
            shouldPlaceOrders = false;
            console.log(`[Bot ${this.botId}] ✅ Price stable (${(priceChange * 100).toFixed(3)}% change) - keeping ${currentTotalOrders} orders alive (${currentBuyOrders} BUY, ${currentSellOrders} SELL)`);
          }
        }
        
        if (shouldCancelOrders && limitOrders.length > 0) {
          console.log(`[Bot ${this.botId}] Canceling ${limitOrders.length} LIMIT orders (keeping TP/SL protection orders active)`);
          
          // Cancel each limit order individually to preserve TP/SL orders
          for (const order of limitOrders) {
            try {
              await this.client.cancelOrder(this.config.marketSymbol, order.orderId);
            } catch (error: any) {
              console.error(`[Bot ${this.botId}] Failed to cancel order ${order.orderId}:`, error.message);
            }
          }
          
          await this.sleep(this.config.delayAfterCancel * 1000);
        }
        
        if (!shouldPlaceOrders) {
          // Skip order placement - all orders are in place and price is stable
          await this.sleep(this.config.refreshInterval * 1000);
          continue;
        }

        // Calculate order size using margin-based risk model
        // IMPROVED: Maximize margin utilization for better volume generation
        const totalBudget = this.config.marginUsdt;
        const totalOrdersPlanned = this.config.ordersPerSide * 2; // buy + sell sides
        
        // Distribute margin equally across all orders to maximize utilization
        const marginPerOrder = totalBudget / totalOrdersPlanned;
        
        // Calculate notional value per order using leverage
        const notionalPerOrder = marginPerOrder * this.config.leverage;
        
        console.log(`[Bot ${this.botId}] 💰 Margin utilization: Budget=${totalBudget} USDT, Orders=${totalOrdersPlanned}, Margin/order=${marginPerOrder.toFixed(2)} USDT, Notional/order=${notionalPerOrder.toFixed(2)} USDT (${this.config.leverage}x leverage)`);
        
        // Calculate minimum notional needed to produce at least 1 step size unit
        const minQuantityNeeded = this.stepSize;
        const minNotionalForQuantity = minQuantityNeeded * referencePrice;
        
        // Use the largest of: calculated notional, exchange min notional, or notional needed for valid quantity
        const effectiveNotional = Math.max(
          notionalPerOrder,
          this.minNotional * 1.1,  // 10% above exchange minimum
          minNotionalForQuantity * 1.5  // 50% above minimum to ensure rounding works
        );
        
        const rawQuantity = effectiveNotional / referencePrice;
        const quantity = this.formatQuantity(rawQuantity);
        
        // Calculate actual margin usage
        const actualMarginPerOrder = effectiveNotional / this.config.leverage;
        const totalMarginUsed = actualMarginPerOrder * totalOrdersPlanned;
        const utilizationPercent = (totalMarginUsed / totalBudget) * 100;
        
        console.log(`[Bot ${this.botId}] 📊 Order size: Notional=${effectiveNotional.toFixed(2)} USDT, Quantity=${quantity}, Margin/order=${actualMarginPerOrder.toFixed(2)} USDT`);
        console.log(`[Bot ${this.botId}] 🎯 Total margin: ${totalMarginUsed.toFixed(2)} USDT / ${totalBudget.toFixed(2)} USDT (${utilizationPercent.toFixed(1)}% utilization)`);
        
        // Check for zero quantity
        if (parseFloat(quantity) === 0 || isNaN(parseFloat(quantity))) {
          console.error(`[Bot ${this.botId}] ERROR: Calculated quantity is zero or invalid!`);
          await this.sleep(this.config.refreshInterval * 1000);
          continue;
        }
        
        // Verify final order meets minimum notional
        const finalNotionalCheck = parseFloat(quantity) * referencePrice;
        if (finalNotionalCheck < this.minNotional) {
          console.error(`[Bot ${this.botId}] ERROR: Order size too small! Notional ${finalNotionalCheck.toFixed(2)} < minimum ${this.minNotional}`);
          await this.addLog('error', `Order size too small (${finalNotionalCheck.toFixed(2)} USDT). Increase investment or reduce orders per side.`);
          await this.sleep(this.config.refreshInterval * 1000);
          continue;
        }
        
        // Warn if we're exceeding budget significantly (should be rare now)
        if (utilizationPercent > 110) {
          await this.addLog('warning', `⚠️ Margin utilization ${utilizationPercent.toFixed(1)}% exceeds budget due to exchange minimums. Consider increasing margin or reducing orders.`);
        } else if (utilizationPercent > 95) {
          await this.addLog('info', `✅ High margin utilization: ${utilizationPercent.toFixed(1)}% of ${totalBudget.toFixed(2)} USDT budget`);
        }

        // Use pre-calculated order distribution (already calculated above)
        let buyOrderCount = expectedBuyOrders;
        let sellOrderCount = expectedSellOrders;
        
        if (this.config.tradingBias === 'long') {
          console.log(`[Bot ${this.botId}] 📈 LONG bias active: placing ${buyOrderCount} buy orders, ${sellOrderCount} sell orders (${this.config.longBiasPercent}% long)`);
        } else if (this.config.tradingBias === 'short') {
          console.log(`[Bot ${this.botId}] 📉 SHORT bias active: placing ${buyOrderCount} buy orders, ${sellOrderCount} sell orders (${this.config.longBiasPercent}% short)`);
        } else if (this.config.longBiasPercent !== 50) {
          console.log(`[Bot ${this.botId}] ⚖️ Custom bias: placing ${buyOrderCount} buy orders, ${sellOrderCount} sell orders (${this.config.longBiasPercent}% long)`);
        } else {
          console.log(`[Bot ${this.botId}] ⚖️ Neutral bias: placing ${buyOrderCount} buy orders, ${sellOrderCount} sell orders (50/50)`);
        }

        // Use batch orders for efficiency
        const batchOrders: any[] = [];

        // Prepare buy orders (respecting bias)
        for (let i = 0; i < Math.min(buyOrderCount, this.config.maxOrdersToPlace); i++) {
          // First order: referencePrice - firstOrderSpread
          // Subsequent orders: previous price - orderSpacing
          const rawPrice = referencePrice - firstOrderSpread - (i * orderSpacing);
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

        // Prepare sell orders (respecting bias)
        for (let i = 0; i < Math.min(sellOrderCount, this.config.maxOrdersToPlace); i++) {
          // First order: referencePrice + firstOrderSpread
          // Subsequent orders: previous price + orderSpacing
          const rawPrice = referencePrice + firstOrderSpread + (i * orderSpacing);
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

        // Track order placement statistics
        let successfulOrders = 0;
        let failedOrders = 0;
        
        // Place batch orders (up to 5 at a time per API limit)
        const maxBatchSize = 5;
        for (let i = 0; i < batchOrders.length; i += maxBatchSize) {
          const batch = batchOrders.slice(i, i + maxBatchSize);
          
          console.log(`[Bot ${this.botId}] Sending batch with client order IDs:`, batch.map(o => o.newClientOrderId));
          
          try {
            const batchResponse = await this.client.placeBatchOrders(batch);
            console.log(`[Bot ${this.botId}] Batch order response:`, JSON.stringify(batchResponse).substring(0, 200));
            
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
                  successfulOrders++;
                } else if (orderResp.code) {
                  await storage.updateOrderByClientId(batch[idx].newClientOrderId, { status: 'FAILED' });
                  await this.addLog('error', `Order ${idx + 1} failed: ${orderResp.msg}`);
                  failedOrders++;
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
                successfulOrders++;
                await this.sleep(this.config.delayBetweenOrders * 1000);
              } catch (individualError: any) {
                console.error(`[Bot ${this.botId}] Individual order error:`, individualError.message);
                await this.addLog('error', `Failed to place ${order.side} order: ${individualError.message}`);
                await storage.updateOrderByClientId(order.newClientOrderId, { status: 'FAILED' });
                failedOrders++;
              }
            }
          }
        }

        // Log order placement summary
        const actualBuyOrders = batchOrders.filter(o => o.side === 'BUY').length;
        const actualSellOrders = batchOrders.filter(o => o.side === 'SELL').length;
        console.log(`[Bot ${this.botId}] ✅ Order placement complete: ${successfulOrders}/${batchOrders.length} successful (${actualBuyOrders} BUY, ${actualSellOrders} SELL), ${failedOrders} failed`);
        await this.addLog('info', `Placed ${successfulOrders} orders around mark price ${referencePrice.toFixed(4)} (${actualBuyOrders} BUY, ${actualSellOrders} SELL)`);

        // Update last order price for smart order management
        this.lastOrderPrice = referencePrice;
        
        // Check manual TP/SL and circuit breaker (Layer 2 protection)
        await this.checkManualTPSL();

        // Wait before next cycle (using configurable cycle time)
        await this.sleep(this.config.cycleTimeSeconds * 1000);

      } catch (error: any) {
        await this.addLog('error', `Trading loop error: ${error.message}`);
        await this.sleep(this.config.cycleTimeSeconds * 1000); // Wait cycle time on error
      }
    }
  }

  private async trackFill(orderId: string, side: string, quantity: number, price: number): Promise<void> {
    const stats = await storage.getBotStats(this.botId);
    if (!stats) return;

    const volume = quantity * price;
    const commission = this.commissionRate 
      ? volume * (this.config.usePostOnly ? this.commissionRate.maker : this.commissionRate.taker)
      : 0;

    // Save individual trade to history
    await storage.createTrade({
      botId: this.botId,
      orderId,
      symbol: this.config.marketSymbol,
      side: side as 'BUY' | 'SELL',
      price,
      quantity,
      quoteQuantity: volume,
      commission,
      commissionAsset: 'USDT',
      realizedPnl: 0, // Will be calculated later when matching trades
      timestamp: new Date().toISOString(),
    });

    // Calculate realized P&L after each trade
    const currentPnL = await storage.calculateRealizedPnL(this.botId);

    await storage.updateBotStats(this.botId, {
      totalVolume: stats.totalVolume + volume,
      totalTrades: stats.totalTrades + 1,
      totalFees: stats.totalFees + commission,
      currentPnL,
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
          this.lastProtectionOrderUpdate.set(positionId, Date.now());
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
      // LONG: SL below entry (lose money), TP above entry (make money)
      // SHORT: SL above entry (lose money), TP below entry (make money)
      const stopLossPrice = position.side === 'LONG'
        ? position.entryPrice * (1 - this.config.stopLossPercent / 100)  // LONG: lower price
        : position.entryPrice * (1 + this.config.stopLossPercent / 100); // SHORT: higher price

      const takeProfitPrice = position.side === 'LONG'
        ? position.entryPrice * (1 + this.config.takeProfitPercent / 100) // LONG: higher price
        : position.entryPrice * (1 - this.config.takeProfitPercent / 100); // SHORT: lower price

      // Validate TP/SL positions are correct
      if (position.side === 'LONG') {
        if (stopLossPrice >= position.entryPrice) {
          console.error(`[Bot ${this.botId}] ERROR: LONG SL price ${stopLossPrice} is not below entry ${position.entryPrice}!`);
          await this.addLog('error', `SL calculation error for LONG: SL should be below entry`);
          return;
        }
        if (takeProfitPrice <= position.entryPrice) {
          console.error(`[Bot ${this.botId}] ERROR: LONG TP price ${takeProfitPrice} is not above entry ${position.entryPrice}!`);
          await this.addLog('error', `TP calculation error for LONG: TP should be above entry`);
          return;
        }
      } else {
        // SHORT position
        if (stopLossPrice <= position.entryPrice) {
          console.error(`[Bot ${this.botId}] ERROR: SHORT SL price ${stopLossPrice} is not above entry ${position.entryPrice}!`);
          await this.addLog('error', `SL calculation error for SHORT: SL should be above entry`);
          return;
        }
        if (takeProfitPrice >= position.entryPrice) {
          console.error(`[Bot ${this.botId}] ERROR: SHORT TP price ${takeProfitPrice} is not below entry ${position.entryPrice}!`);
          await this.addLog('error', `TP calculation error for SHORT: TP should be below entry`);
          return;
        }
      }

      // Log calculated prices for debugging
      console.log(`[Bot ${this.botId}] ✅ Protection orders for ${position.side} position validated:`);
      console.log(`  Entry: ${position.entryPrice.toFixed(4)}, SL: ${stopLossPrice.toFixed(4)} (${position.side === 'LONG' ? 'below' : 'above'} entry, ${this.config.stopLossPercent}%), TP: ${takeProfitPrice.toFixed(4)} (${position.side === 'LONG' ? 'above' : 'below'} entry, ${this.config.takeProfitPercent}%)`);

      // Place Stop-Loss order (Layer 1)
      if (this.config.enableStopLoss) {
        try {
          const stopLossOrder = await this.client.placeOrder({
            symbol: this.config.marketSymbol,
            side: position.side === 'LONG' ? 'SELL' : 'BUY',
            type: 'STOP_MARKET',
            quantity: this.formatQuantity(position.quantity),
            stopPrice: this.formatPrice(stopLossPrice),
            reduceOnly: true,
            workingType: 'MARK_PRICE',
          });

          position.stopLossOrderId = stopLossOrder.orderId?.toString();
          await this.addLog('success', `Stop-loss placed: ${this.formatPrice(stopLossPrice)} (${position.side === 'LONG' ? 'below' : 'above'} entry, ${this.config.stopLossPercent}% loss limit)`);
        } catch (error: any) {
          const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
          console.error(`[Bot ${this.botId}] Stop-loss placement error:`, errorDetails);
          await this.addLog('error', `Failed to place stop-loss: ${errorDetails}`);
        }
      }

      // Place Take-Profit order (Layer 1)
      if (this.config.enableTakeProfit) {
        try {
          const takeProfitOrder = await this.client.placeOrder({
            symbol: this.config.marketSymbol,
            side: position.side === 'LONG' ? 'SELL' : 'BUY',
            type: 'TAKE_PROFIT_MARKET',
            quantity: this.formatQuantity(position.quantity),
            stopPrice: this.formatPrice(takeProfitPrice),
            reduceOnly: true,
            workingType: 'MARK_PRICE',
          });

          position.takeProfitOrderId = takeProfitOrder.orderId?.toString();
          await this.addLog('success', `Take-profit placed: ${this.formatPrice(takeProfitPrice)} (${position.side === 'LONG' ? 'above' : 'below'} entry, ${this.config.takeProfitPercent}% profit target)`);
        } catch (error: any) {
          const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
          console.error(`[Bot ${this.botId}] Take-profit placement error:`, errorDetails);
          await this.addLog('error', `Failed to place take-profit: ${errorDetails}`);
        }
      }

    } catch (error: any) {
      console.error('Error placing protection orders:', error);
    }
  }

  private async updateProtectionOrders(positionId: string, position: TrackedPosition): Promise<void> {
    // Prevent too frequent TP/SL updates to avoid hitting exchange stop order limits
    const now = Date.now();
    const lastUpdate = this.lastProtectionOrderUpdate.get(positionId) || 0;
    const timeSinceLastUpdate = now - lastUpdate;
    
    // Only update if at least 30 seconds have passed since last update
    // This prevents rapid cancel/replace cycles that hit exchange limits
    if (timeSinceLastUpdate < 30000) {
      console.log(`[Bot ${this.botId}] Skipping TP/SL update (last update was ${(timeSinceLastUpdate/1000).toFixed(1)}s ago)`);
      return;
    }
    
    // Cancel existing protection orders
    await this.cancelProtectionOrders(positionId, position);
    
    // Place new protection orders with updated prices
    await this.placeProtectionOrders(positionId, position);
    
    // Track update time
    this.lastProtectionOrderUpdate.set(positionId, now);
  }

  private async cancelProtectionOrders(positionId: string, position: TrackedPosition): Promise<void> {
    try {
      // Cancel stop-loss
      if (position.stopLossOrderId) {
        try {
          await this.client.cancelOrder(this.config.marketSymbol, position.stopLossOrderId);
        } catch (error) {
          // Order might already be filled or cancelled
        }
      }

      // Cancel take-profit
      if (position.takeProfitOrderId) {
        try {
          await this.client.cancelOrder(this.config.marketSymbol, position.takeProfitOrderId);
        } catch (error) {
          // Order might already be filled or cancelled
        }
      }

      // Cancel trailing stop
      if (position.trailingStopOrderId) {
        try {
          await this.client.cancelOrder(this.config.marketSymbol, position.trailingStopOrderId);
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

        // Check stop-loss trigger (same logic for both LONG and SHORT)
        // calculatePnLPercent returns negative when losing money for both sides
        if (this.config.enableStopLoss) {
          const stopLossTriggered = pnlPercent <= -this.config.stopLossPercent;

          if (stopLossTriggered) {
            await this.addLog('warning', `🛑 Stop-loss triggered! ${position.side} position closed at PnL: ${pnlPercent.toFixed(2)}%`);
            await this.closePosition(position);
            this.positions.delete(positionId);
            continue; // Skip to next position after closing
          }
        }

        // Check take-profit trigger (same logic for both LONG and SHORT)
        // calculatePnLPercent returns positive when making money for both sides
        if (this.config.enableTakeProfit) {
          const takeProfitTriggered = pnlPercent >= this.config.takeProfitPercent;

          if (takeProfitTriggered) {
            await this.addLog('success', `✅ Take-profit triggered! ${position.side} position closed at PnL: ${pnlPercent.toFixed(2)}%`);
            await this.closePosition(position);
            this.positions.delete(positionId);
            continue; // Skip to next position after closing
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
    try {
      // First, close tracked positions
      for (const [positionId, position] of this.positions) {
        await this.closePosition(position);
        await this.cancelProtectionOrders(positionId, position);
      }
      
      // Clear tracked positions
      this.positions.clear();
      this.netPosition = 0;
      
      // Also query and close any actual account positions for this symbol
      // (in case positions exist from previous sessions or weren't tracked)
      const positionRisk = await this.client.getPositionRisk(this.config.marketSymbol);
      
      for (const pos of positionRisk) {
        const positionAmt = parseFloat(pos.positionAmt || '0');
        
        if (Math.abs(positionAmt) > 0.00001) {
          // There's an open position - close it
          const side = positionAmt > 0 ? 'SELL' : 'BUY'; // Close LONG with SELL, SHORT with BUY
          const quantity = this.formatQuantity(Math.abs(positionAmt));
          
          try {
            await this.client.placeOrder({
              symbol: this.config.marketSymbol,
              side: side,
              type: 'MARKET',
              quantity: quantity,
            });
            
            await this.addLog('info', `Closed ${positionAmt > 0 ? 'LONG' : 'SHORT'} position: ${Math.abs(positionAmt)} contracts`);
          } catch (error: any) {
            await this.addLog('error', `Failed to close position ${this.config.marketSymbol}: ${error.message}`);
          }
        }
      }
    } catch (error: any) {
      console.error('Error closing all positions:', error);
      await this.addLog('error', `Error closing positions: ${error.message}`);
    }
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

      // Calculate hourly volume (actual trades from last hour)
      const hourlyVolume = await this.calculateHourlyVolume();

      // Update stats with real hourly volume
      await storage.updateBotStats(this.botId, {
        sessionUptime: uptime,
        fillRate,
        hourlyVolume, // Store actual hourly volume from exchange
      });

      // Store hourly volume for charting
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
    await storage.updateBotInstance(this.botId, { config: this.config });
    
    // Log the update
    const updatedFields = Object.keys(updates).join(', ');
    await this.addLog('info', `Configuration updated: ${updatedFields}`);
    
    // If leverage was changed, update it on the exchange
    if (updates.leverage !== undefined && this.status === 'running') {
      try {
        await this.client.changeLeverage(this.config.marketSymbol, this.config.leverage);
        await this.addLog('success', `Leverage updated to ${this.config.leverage}x on ${this.config.marketSymbol}`);
      } catch (error: any) {
        const errorMsg = error.response?.data?.msg || error.message;
        await this.addLog('warning', `Failed to update leverage: ${errorMsg}`);
      }
    }
    
    // If bot is running, trigger immediate order refresh
    if (this.status === 'running') {
      await this.addLog('info', 'Refreshing orders with new configuration...');
      // Cancel all existing orders and the bot will place new ones on next loop iteration
      try {
        await this.client.cancelAllOrders(this.config.marketSymbol);
        await this.addLog('info', 'Existing orders canceled, new orders will be placed shortly');
      } catch (error: any) {
        await this.addLog('error', `Failed to cancel orders during config update: ${error.message}`);
      }
    }
    
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
