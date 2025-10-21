import { 
  type User, 
  type InsertUser,
  type BotInstance,
  type BotStats,
  type Order,
  type ActivityLog,
  type HourlyVolume,
  type BotConfig,
  type Trade
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Bot Instance Management
  createBotInstance(config: BotConfig): Promise<BotInstance>;
  getBotInstance(id: string): Promise<BotInstance | undefined>;
  getAllBotInstances(): Promise<BotInstance[]>;
  updateBotInstance(id: string, updates: Partial<BotInstance>): Promise<BotInstance>;
  deleteBotInstance(id: string): Promise<void>;
  
  // Bot Statistics
  getBotStats(botId: string): Promise<BotStats | undefined>;
  updateBotStats(botId: string, stats: Partial<BotStats>): Promise<BotStats>;
  
  // Orders
  createOrder(order: Omit<Order, 'id'>): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByBot(botId: string): Promise<Order[]>;
  getOrders(botId: string): Promise<Order[]>;
  updateOrder(id: string, updates: Partial<Order>): Promise<Order>;
  updateOrderByClientId(clientOrderId: string, updates: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<void>;
  
  // Activity Logs
  addActivityLog(log: Omit<ActivityLog, 'id'>): Promise<ActivityLog>;
  getActivityLogs(botId: string, limit?: number): Promise<ActivityLog[]>;
  
  // Hourly Volume
  addHourlyVolume(data: HourlyVolume): Promise<void>;
  updateHourlyVolume(botId: string, hour: string, volume: number): Promise<void>;
  getHourlyVolume(botId: string): Promise<HourlyVolume[]>;
  
  // Trades
  createTrade(trade: Omit<Trade, 'id'>): Promise<Trade>;
  getTradesByBot(botId: string, limit?: number): Promise<Trade[]>;
  calculateRealizedPnL(botId: string): Promise<number>;
}

export class MemStorage implements IStorage {
  private botInstances: Map<string, BotInstance> = new Map();
  private botStats: Map<string, BotStats> = new Map();
  private orders: Map<string, Order> = new Map();
  private activityLogs: Map<string, ActivityLog[]> = new Map();
  private hourlyVolume: Map<string, HourlyVolume[]> = new Map();
  private trades: Map<string, Trade[]> = new Map();

  // Bot Instance Methods
  async createBotInstance(config: BotConfig): Promise<BotInstance> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const instance: BotInstance = {
      id,
      marketSymbol: config.marketSymbol,
      status: 'stopped',
      config,
      sessionStart: now,
      lastUpdate: now,
    };
    this.botInstances.set(id, instance);
    
    // Initialize stats
    await this.updateBotStats(id, {
      botId: id,
      totalVolume: 0,
      totalTrades: 0,
      totalFees: 0,
      currentPnL: 0,
      activeOrders: 0,
      fillRate: 0,
      hourlyVolume: 0,
      hourlyTrades: 0,
      sessionUptime: 0,
      openPositions: 0,
      totalPositionValue: 0,
      unrealizedPnL: 0,
      realizedPnL: 0,
      positionsWithStopLoss: 0,
      positionsWithTakeProfit: 0,
      trailingStopsActive: 0,
      circuitBreakerTriggered: false,
      riskScore: 0,
    });
    
    return instance;
  }

  async getBotInstance(id: string): Promise<BotInstance | undefined> {
    return this.botInstances.get(id);
  }

  async getAllBotInstances(): Promise<BotInstance[]> {
    return Array.from(this.botInstances.values());
  }

  async updateBotInstance(id: string, updates: Partial<BotInstance>): Promise<BotInstance> {
    const instance = this.botInstances.get(id);
    if (!instance) throw new Error(`Bot instance ${id} not found`);
    
    const updated = { ...instance, ...updates, lastUpdate: new Date().toISOString() };
    this.botInstances.set(id, updated);
    return updated;
  }

  async deleteBotInstance(id: string): Promise<void> {
    this.botInstances.delete(id);
    this.botStats.delete(id);
    this.activityLogs.delete(id);
    this.hourlyVolume.delete(id);
  }

  // Bot Statistics Methods
  async getBotStats(botId: string): Promise<BotStats | undefined> {
    return this.botStats.get(botId);
  }

  async updateBotStats(botId: string, stats: Partial<BotStats>): Promise<BotStats> {
    const current = this.botStats.get(botId) || {
      botId,
      totalVolume: 0,
      totalTrades: 0,
      totalFees: 0,
      currentPnL: 0,
      activeOrders: 0,
      fillRate: 0,
      hourlyVolume: 0,
      hourlyTrades: 0,
      sessionUptime: 0,
      openPositions: 0,
      totalPositionValue: 0,
      unrealizedPnL: 0,
      realizedPnL: 0,
      positionsWithStopLoss: 0,
      positionsWithTakeProfit: 0,
      trailingStopsActive: 0,
      circuitBreakerTriggered: false,
      riskScore: 0,
    };
    
    const updated = { ...current, ...stats };
    this.botStats.set(botId, updated);
    return updated;
  }

  // Order Methods
  async createOrder(order: Omit<Order, 'id'>): Promise<Order> {
    const id = randomUUID();
    const newOrder: Order = { ...order, id };
    this.orders.set(id, newOrder);
    return newOrder;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrdersByBot(botId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.botId === botId);
  }

  async getOrders(botId: string): Promise<Order[]> {
    return this.getOrdersByBot(botId);
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
    const order = this.orders.get(id);
    if (!order) throw new Error(`Order ${id} not found`);
    
    const updated = { ...order, ...updates, updatedAt: new Date().toISOString() };
    this.orders.set(id, updated);
    return updated;
  }

  async updateOrderByClientId(clientOrderId: string, updates: Partial<Order>): Promise<Order | undefined> {
    const order = Array.from(this.orders.values()).find(o => o.clientOrderId === clientOrderId);
    if (!order) return undefined;
    
    const updated = { ...order, ...updates, updatedAt: new Date().toISOString() };
    this.orders.set(order.id, updated);
    return updated;
  }

  async deleteOrder(id: string): Promise<void> {
    this.orders.delete(id);
  }

  // Activity Log Methods
  async addActivityLog(log: Omit<ActivityLog, 'id'>): Promise<ActivityLog> {
    const id = randomUUID();
    const newLog: ActivityLog = { ...log, id };
    
    const logs = this.activityLogs.get(log.botId) || [];
    logs.push(newLog);
    this.activityLogs.set(log.botId, logs);
    
    return newLog;
  }

  async getActivityLogs(botId: string, limit: number = 100): Promise<ActivityLog[]> {
    const logs = this.activityLogs.get(botId) || [];
    return logs.slice(-limit);
  }

  // Hourly Volume Methods
  async addHourlyVolume(data: HourlyVolume): Promise<void> {
    const volumes = this.hourlyVolume.get(data.botId) || [];
    volumes.push(data);
    this.hourlyVolume.set(data.botId, volumes);
  }

  async updateHourlyVolume(botId: string, hour: string, volume: number): Promise<void> {
    const volumes = this.hourlyVolume.get(botId) || [];
    const existing = volumes.find(v => v.hour === hour);
    
    if (existing) {
      existing.volume = volume;
    } else {
      volumes.push({
        botId,
        hour,
        volume,
        target: 0,
        trades: 0,
      });
    }
    
    this.hourlyVolume.set(botId, volumes);
  }

  async getHourlyVolume(botId: string): Promise<HourlyVolume[]> {
    return this.hourlyVolume.get(botId) || [];
  }

  // Trade Methods
  async createTrade(trade: Omit<Trade, 'id'>): Promise<Trade> {
    const id = randomUUID();
    const newTrade: Trade = { ...trade, id };
    
    const trades = this.trades.get(trade.botId) || [];
    trades.push(newTrade);
    this.trades.set(trade.botId, trades);
    
    return newTrade;
  }

  async getTradesByBot(botId: string, limit?: number): Promise<Trade[]> {
    const trades = this.trades.get(botId) || [];
    // Return most recent trades first
    const sorted = [...trades].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async calculateRealizedPnL(botId: string): Promise<number> {
    const trades = this.trades.get(botId) || [];
    
    // Simple P&L calculation: Match BUY and SELL trades
    const buys: Trade[] = [];
    const sells: Trade[] = [];
    
    for (const trade of trades) {
      if (trade.side === 'BUY') {
        buys.push(trade);
      } else {
        sells.push(trade);
      }
    }
    
    let totalPnL = 0;
    
    // Match sells with buys (FIFO)
    for (const sell of sells) {
      let remainingQty = sell.quantity;
      
      for (const buy of buys) {
        if (remainingQty <= 0) break;
        
        const matchedQty = Math.min(remainingQty, buy.quantity);
        const pnl = (sell.price - buy.price) * matchedQty;
        totalPnL += pnl;
        
        remainingQty -= matchedQty;
        buy.quantity -= matchedQty; // Update remaining quantity
      }
    }
    
    // Subtract commissions
    const totalCommission = trades.reduce((sum, t) => sum + t.commission, 0);
    totalPnL -= totalCommission;
    
    return totalPnL;
  }
}

export const storage = new MemStorage();
