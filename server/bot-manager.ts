import { BotEngine } from './bot-engine';
import { storage } from './storage';
import { BotConfig } from '@shared/schema';
import { EventEmitter } from 'events';

// Internal config type that includes credentials from environment
type BotEngineConfig = BotConfig & {
  apiKey: string;
  apiSecret: string;
};

export class BotManager extends EventEmitter {
  private bots: Map<string, BotEngine> = new Map();
  private static instance: BotManager;

  private constructor() {
    super();
  }

  static getInstance(): BotManager {
    if (!BotManager.instance) {
      BotManager.instance = new BotManager();
    }
    return BotManager.instance;
  }

  async createBot(config: BotConfig): Promise<string> {
    // Validate environment variables
    const apiKey = process.env.ASTERDEX_API_KEY;
    const apiSecret = process.env.ASTERDEX_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      throw new Error('ASTERDEX_API_KEY and ASTERDEX_API_SECRET must be set in environment variables');
    }

    // Check if bot with same market already exists and is running
    const existingBots = await storage.getAllBotInstances();
    const runningBot = existingBots.find(
      bot => bot.marketSymbol === config.marketSymbol && 
             (bot.status === 'running' || bot.status === 'paused')
    );

    if (runningBot) {
      throw new Error(`Bot for ${config.marketSymbol} is already running`);
    }

    // Create bot instance in storage
    const instance = await storage.createBotInstance(config);

    // Create bot engine with env credentials
    const engineConfig: BotEngineConfig = { ...config, apiKey, apiSecret };
    const bot = new BotEngine(instance.id, engineConfig);

    // Set up event forwarding
    bot.on('orderPlaced', (data) => this.emit('orderPlaced', data));
    bot.on('log', (data) => this.emit('log', data));
    bot.on('statsUpdated', (data) => this.emit('statsUpdated', data));

    // Initialize bot
    await bot.initialize();

    this.bots.set(instance.id, bot);

    return instance.id;
  }

  async startBot(botId: string): Promise<void> {
    const bot = this.bots.get(botId);
    if (!bot) {
      // Try to load from storage and recreate
      const instance = await storage.getBotInstance(botId);
      if (!instance) {
        throw new Error(`Bot ${botId} not found`);
      }

      const apiKey = process.env.ASTERDEX_API_KEY;
      const apiSecret = process.env.ASTERDEX_API_SECRET;
      
      if (!apiKey || !apiSecret) {
        throw new Error('ASTERDEX_API_KEY and ASTERDEX_API_SECRET must be set in environment variables');
      }

      const engineConfig: BotEngineConfig = { ...instance.config, apiKey, apiSecret };
      const newBot = new BotEngine(instance.id, engineConfig);
      
      // Set up event forwarding
      newBot.on('orderPlaced', (data) => this.emit('orderPlaced', data));
      newBot.on('log', (data) => this.emit('log', data));
      newBot.on('statsUpdated', (data) => this.emit('statsUpdated', data));

      await newBot.initialize();
      this.bots.set(botId, newBot);
      await newBot.start();
    } else {
      await bot.start();
    }
  }

  async pauseBot(botId: string): Promise<void> {
    const bot = this.bots.get(botId);
    if (!bot) {
      throw new Error(`Bot ${botId} not found`);
    }
    await bot.pause();
  }

  async stopBot(botId: string): Promise<void> {
    const bot = this.bots.get(botId);
    if (!bot) {
      throw new Error(`Bot ${botId} not found`);
    }
    await bot.stop();
    this.bots.delete(botId);
  }

  async deleteBot(botId: string): Promise<void> {
    const bot = this.bots.get(botId);
    if (bot) {
      await bot.stop();
      this.bots.delete(botId);
    }
    await storage.deleteBotInstance(botId);
  }

  async getAllBots(): Promise<any[]> {
    const instances = await storage.getAllBotInstances();
    return Promise.all(
      instances.map(async (instance) => {
        const stats = await storage.getBotStats(instance.id);
        return {
          ...instance,
          stats,
        };
      })
    );
  }

  async getBotDetails(botId: string): Promise<any> {
    const instance = await storage.getBotInstance(botId);
    if (!instance) {
      throw new Error(`Bot ${botId} not found`);
    }

    const stats = await storage.getBotStats(botId);
    const orders = await storage.getOrdersByBot(botId);
    const logs = await storage.getActivityLogs(botId, 100);
    const hourlyVolume = await storage.getHourlyVolume(botId);

    return {
      instance,
      stats,
      orders,
      logs,
      hourlyVolume,
    };
  }

  getActiveBot(botId: string): BotEngine | undefined {
    return this.bots.get(botId);
  }
}

export const botManager = BotManager.getInstance();
