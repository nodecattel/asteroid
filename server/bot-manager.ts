import { BotEngine } from './bot-engine';
import { storage } from './storage';
import { BotConfig } from '@shared/schema';
import { EventEmitter } from 'events';

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
    // Validate config
    if (!config.apiKey || !config.apiSecret) {
      throw new Error('API key and secret are required');
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

    // Create bot engine
    const bot = new BotEngine(instance.id, config);

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

      const newBot = new BotEngine(instance.id, instance.config);
      
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
