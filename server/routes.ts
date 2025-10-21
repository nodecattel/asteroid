import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { botManager } from "./bot-manager";
import { botConfigSchema } from "@shared/schema";
import { AsterdexClient } from "./asterdex-client";
import { ExchangeInfoCache } from "./exchange-info-cache";
import { setupAuth, requireAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Setup authentication
  setupAuth(app);
  
  // Initialize Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Initialize exchange info cache (will be created per request with auth for leverage data)
  let exchangeInfoCache: ExchangeInfoCache | null = null;

  // Helper to get or create exchange info cache with auth
  const getExchangeInfoCache = () => {
    const apiKey = process.env.ASTERDEX_API_KEY || '';
    const apiSecret = process.env.ASTERDEX_API_SECRET || '';
    const client = new AsterdexClient(apiKey, apiSecret);
    if (!exchangeInfoCache) {
      exchangeInfoCache = new ExchangeInfoCache(client);
    }
    return exchangeInfoCache;
  };

  // Forward bot events to connected clients
  botManager.on('orderPlaced', (data) => {
    io.emit('orderPlaced', data);
  });

  botManager.on('log', (data) => {
    io.emit('activityLog', data);
  });

  botManager.on('statsUpdated', (data) => {
    io.emit('statsUpdated', data);
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // API Routes
  
  // Authentication routes
  app.post('/api/auth/login', async (req, res) => {
    const { password } = req.body;
    const botPassword = process.env.BOT_PASSWORD;

    if (!botPassword) {
      return res.status(500).json({
        success: false,
        error: 'BOT_PASSWORD not configured in environment'
      });
    }

    if (password === botPassword) {
      const session = req.session as any;
      session.authenticated = true;
      return res.json({
        success: true,
        data: { message: 'Login successful' }
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid password'
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({
        success: true,
        data: { message: 'Logout successful' }
      });
    });
  });

  app.get('/api/auth/status', (req, res) => {
    const session = req.session as any;
    res.json({
      authenticated: !!session.authenticated
    });
  });

  // Get available markets from exchange info (public route)
  app.get('/api/markets', async (req, res) => {
    try {
      const cache = getExchangeInfoCache();
      const markets = await cache.getAvailableMarkets();
      res.json({
        success: true,
        data: markets
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get account balance (protected)
  app.get('/api/account/balance', requireAuth, async (req, res) => {
    try {
      const apiKey = process.env.ASTERDEX_API_KEY;
      const apiSecret = process.env.ASTERDEX_API_SECRET;

      if (!apiKey || !apiSecret) {
        return res.status(400).json({
          success: false,
          error: 'ASTERDEX_API_KEY and ASTERDEX_API_SECRET must be set in environment variables'
        });
      }

      const client = new AsterdexClient(apiKey, apiSecret);
      const accountInfo = await client.getAccountInfo();
      
      res.json({
        success: true,
        data: {
          totalWalletBalance: accountInfo.totalWalletBalance,
          availableBalance: accountInfo.availableBalance,
          totalUnrealizedProfit: accountInfo.totalUnrealizedProfit,
          totalMarginBalance: accountInfo.totalMarginBalance,
          assets: accountInfo.assets,
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get open positions (protected)
  app.get('/api/account/positions', requireAuth, async (req, res) => {
    try {
      const apiKey = process.env.ASTERDEX_API_KEY;
      const apiSecret = process.env.ASTERDEX_API_SECRET;

      if (!apiKey || !apiSecret) {
        return res.status(400).json({
          success: false,
          error: 'ASTERDEX_API_KEY and ASTERDEX_API_SECRET must be set in environment variables'
        });
      }

      const client = new AsterdexClient(apiKey, apiSecret);
      const positions = await client.getPositionRisk();
      
      // Filter out positions with no quantity
      const activePositions = positions.filter((p: any) => Math.abs(parseFloat(p.positionAmt)) > 0);
      
      res.json({
        success: true,
        data: activePositions
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Close position manually (protected)
  app.post('/api/account/close-position', requireAuth, async (req, res) => {
    try {
      const { symbol, side } = req.body;

      if (!symbol || !side) {
        return res.status(400).json({
          success: false,
          error: 'symbol and side are required'
        });
      }

      const apiKey = process.env.ASTERDEX_API_KEY;
      const apiSecret = process.env.ASTERDEX_API_SECRET;

      if (!apiKey || !apiSecret) {
        return res.status(400).json({
          success: false,
          error: 'ASTERDEX_API_KEY and ASTERDEX_API_SECRET must be set in environment variables'
        });
      }

      const client = new AsterdexClient(apiKey, apiSecret);
      
      // Get current position to determine quantity
      const positions = await client.getPositionRisk(symbol);
      const position = positions.find((p: any) => p.symbol === symbol);
      
      if (!position || Math.abs(parseFloat(position.positionAmt)) === 0) {
        return res.status(400).json({
          success: false,
          error: 'No open position found for this symbol'
        });
      }

      const posAmt = parseFloat(position.positionAmt);
      const quantity = Math.abs(posAmt);
      
      // Determine the side to close: opposite of current position
      const closeSide = posAmt > 0 ? 'SELL' : 'BUY';
      
      // Place market order to close position
      const order = await client.placeOrder({
        symbol,
        side: closeSide,
        type: 'MARKET',
        quantity: quantity.toString(),
        reduceOnly: 'true', // Important: ensures we're closing, not opening new position
      });
      
      res.json({
        success: true,
        data: order
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get all bot instances (protected)
  app.get('/api/bots', requireAuth, async (req, res) => {
    try {
      const bots = await botManager.getAllBots();
      res.json({
        success: true,
        data: bots
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get specific bot details (protected)
  app.get('/api/bots/:botId', requireAuth, async (req, res) => {
    try {
      const { botId } = req.params;
      const details = await botManager.getBotDetails(botId);
      res.json({
        success: true,
        data: details
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  });

  // Create new bot instance (protected)
  app.post('/api/bots', requireAuth, async (req, res) => {
    try {
      const config = botConfigSchema.parse(req.body);
      const botId = await botManager.createBot(config);
      
      // Send response immediately
      res.json({
        success: true,
        data: { botId }
      });
      
      // Start the bot asynchronously after responding
      setTimeout(async () => {
        try {
          await botManager.startBot(botId);
          console.log(`Bot ${botId} auto-started successfully`);
        } catch (error: any) {
          console.error(`Failed to auto-start bot ${botId}:`, error.message);
        }
      }, 100);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Start bot (protected)
  app.post('/api/bots/:botId/start', requireAuth, async (req, res) => {
    try {
      const { botId } = req.params;
      await botManager.startBot(botId);
      res.json({
        success: true,
        data: { message: 'Bot started' }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Pause bot (protected)
  app.post('/api/bots/:botId/pause', requireAuth, async (req, res) => {
    try {
      const { botId } = req.params;
      await botManager.pauseBot(botId);
      res.json({
        success: true,
        data: { message: 'Bot paused' }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Stop bot (protected)
  app.post('/api/bots/:botId/stop', requireAuth, async (req, res) => {
    try {
      const { botId } = req.params;
      await botManager.stopBot(botId);
      res.json({
        success: true,
        data: { message: 'Bot stopped' }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Update bot configuration (protected)
  app.patch('/api/bots/:botId/config', requireAuth, async (req, res) => {
    try {
      const { botId } = req.params;
      const updates = req.body;
      await botManager.updateBotConfig(botId, updates);
      res.json({
        success: true,
        data: { message: 'Bot configuration updated' }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Delete bot (protected)
  app.delete('/api/bots/:botId', requireAuth, async (req, res) => {
    try {
      const { botId } = req.params;
      await botManager.deleteBot(botId);
      res.json({
        success: true,
        data: { message: 'Bot deleted' }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get bot orders (protected)
  app.get('/api/bots/:botId/orders', requireAuth, async (req, res) => {
    try {
      const { botId } = req.params;
      const orders = await storage.getOrdersByBot(botId);
      res.json({
        success: true,
        data: orders
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get bot activity logs (protected)
  app.get('/api/bots/:botId/logs', requireAuth, async (req, res) => {
    try {
      const { botId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getActivityLogs(botId, limit);
      res.json({
        success: true,
        data: logs
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get bot hourly volume (protected)
  app.get('/api/bots/:botId/volume', requireAuth, async (req, res) => {
    try {
      const { botId } = req.params;
      const volume = await storage.getHourlyVolume(botId);
      res.json({
        success: true,
        data: volume
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get bot trade history (protected)
  app.get('/api/bots/:botId/trades', requireAuth, async (req, res) => {
    try {
      const { botId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const trades = await storage.getTradesByBot(botId, limit);
      const realizedPnL = await storage.calculateRealizedPnL(botId);
      res.json({
        success: true,
        data: {
          trades,
          realizedPnL
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return httpServer;
}
