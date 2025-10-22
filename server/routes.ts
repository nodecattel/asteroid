import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { botManager } from "./bot-manager";
import { botConfigSchema } from "@shared/schema";
import { AsterdexClient } from "./asterdex-client";
import { ExchangeInfoCache } from "./exchange-info-cache";
import { UserDataStreamManager } from "./user-data-stream";
import { AgentMonitor } from "./agent-monitor";
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

  // Initialize global UserDataStreamManager for real-time position updates
  let globalUserDataStream: UserDataStreamManager | null = null;
  const initGlobalUserDataStream = async () => {
    const apiKey = process.env.ASTERDEX_API_KEY;
    const apiSecret = process.env.ASTERDEX_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      console.warn('[UserDataStream] API credentials not configured, real-time position updates disabled');
      return;
    }

    try {
      const client = new AsterdexClient(apiKey, apiSecret);
      globalUserDataStream = new UserDataStreamManager(client);
      
      // Listen for ACCOUNT_UPDATE events and broadcast to all clients
      globalUserDataStream.on('ACCOUNT_UPDATE', (event) => {
        const updateData = event.data.a;
        
        // Extract balance updates
        if (updateData.B && Array.isArray(updateData.B)) {
          const balanceUpdate = updateData.B.find((b: any) => b.a === 'USDT');
          if (balanceUpdate) {
            io.emit('balanceUpdate', {
              totalWalletBalance: balanceUpdate.wb,
              availableBalance: balanceUpdate.cw,
            });
          }
        }
        
        // Extract position updates
        if (updateData.P && Array.isArray(updateData.P)) {
          const positions = updateData.P
            .filter((p: any) => Math.abs(parseFloat(p.pa)) > 0)
            .map((p: any) => ({
              symbol: p.s,
              positionAmt: p.pa,
              entryPrice: p.ep,
              unrealizedProfit: p.up,
            }));
          
          io.emit('positionUpdate', positions);
        }
      });
      
      await globalUserDataStream.start();
      console.log('[UserDataStream] Global user data stream started for real-time position updates');
    } catch (error) {
      console.error('[UserDataStream] Failed to start global user data stream:', error);
    }
  };

  // Start global user data stream
  initGlobalUserDataStream();

  // Initialize and start Agent Monitor for percentage targets
  const agentMonitor = new AgentMonitor(storage, new AsterdexClient(
    process.env.ASTERDEX_API_KEY || '',
    process.env.ASTERDEX_API_SECRET || ''
  ));
  agentMonitor.start();
  
  // Listen for agent auto-stop events
  agentMonitor.on('agentStopped', (data) => {
    io.emit('agentUpdated', data);
    console.log(`[AgentMonitor] Agent ${data.agentId} stopped: ${data.reason}`);
  });

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

  // Get open orders (protected)
  app.get('/api/account/orders', requireAuth, async (req, res) => {
    try {
      const { symbol } = req.query;
      const apiKey = process.env.ASTERDEX_API_KEY;
      const apiSecret = process.env.ASTERDEX_API_SECRET;

      if (!apiKey || !apiSecret) {
        return res.status(400).json({
          success: false,
          error: 'ASTERDEX_API_KEY and ASTERDEX_API_SECRET must be set in environment variables'
        });
      }

      const client = new AsterdexClient(apiKey, apiSecret);
      const orders = await client.getOpenOrders(symbol as string);
      
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
        quantity: quantity,
        reduceOnly: true, // Important: ensures we're closing, not opening new position
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

  // ===== AI AGENT ROUTES =====

  // Get available AI models based on configured API keys (protected)
  app.get('/api/agents/available-models', requireAuth, async (req, res) => {
    try {
      const availableModels = [];
      
      // Check which API keys are configured
      if (process.env.ANTHROPIC_API_KEY) {
        availableModels.push({
          provider: 'Anthropic',
          models: ['Claude 3.5 Sonnet', 'Claude 3 Opus', 'Claude 3 Sonnet', 'Claude 3 Haiku'],
          defaultModel: 'Claude 3.5 Sonnet',
          icon: '🤖',
        });
      }
      
      if (process.env.OPENAI_API_KEY) {
        availableModels.push({
          provider: 'OpenAI',
          models: ['GPT-4', 'GPT-4 Turbo', 'GPT-4o', 'GPT-3.5 Turbo'],
          defaultModel: 'GPT-4',
          icon: '🧠',
        });
      }
      
      if (process.env.DEEPSEEK_API_KEY) {
        availableModels.push({
          provider: 'DeepSeek',
          models: ['DeepSeek Chat V3.1', 'DeepSeek Coder V2'],
          defaultModel: 'DeepSeek Chat V3.1',
          icon: '🔍',
        });
      }
      
      if (process.env.XAI_API_KEY) {
        availableModels.push({
          provider: 'xAI',
          models: ['Grok 2', 'Grok 1.5'],
          defaultModel: 'Grok 2',
          icon: '⚡',
        });
      }
      
      if (process.env.QWEN_API_KEY) {
        availableModels.push({
          provider: 'Alibaba',
          models: ['Qwen Max', 'Qwen Plus', 'Qwen Turbo'],
          defaultModel: 'Qwen Max',
          icon: '🌐',
        });
      }
      
      res.json({
        success: true,
        data: availableModels,
        hasAnyKeys: availableModels.length > 0,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get all AI agents (protected)
  app.get('/api/agents', requireAuth, async (req, res) => {
    try {
      const agents = await storage.getAllAIAgents();
      res.json({
        success: true,
        data: agents
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Create new AI agent (protected)
  app.post('/api/agents', requireAuth, async (req, res) => {
    try {
      const agent = await storage.createAIAgent(req.body);
      
      // Broadcast to all clients
      io.emit('agentCreated', agent);
      
      res.json({
        success: true,
        data: agent
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get specific AI agent (protected)
  app.get('/api/agents/:id', requireAuth, async (req, res) => {
    try {
      const agent = await storage.getAIAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      }
      res.json({
        success: true,
        data: agent
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Update AI agent (start/stop/pause) (protected)
  app.patch('/api/agents/:id', requireAuth, async (req, res) => {
    try {
      const agent = await storage.updateAIAgent(req.params.id, req.body);
      
      // Broadcast to all clients
      io.emit('agentUpdated', agent);
      
      res.json({
        success: true,
        data: agent
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Delete AI agent (protected)
  app.delete('/api/agents/:id', requireAuth, async (req, res) => {
    try {
      await storage.deleteAIAgent(req.params.id);
      
      // Broadcast to all clients
      io.emit('agentDeleted', req.params.id);
      
      res.json({
        success: true
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get agent trades (protected)
  app.get('/api/agents/:id/trades', requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const trades = await storage.getAIAgentTrades(req.params.id, limit);
      res.json({
        success: true,
        data: trades
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get agent reasoning/commentary (protected)
  app.get('/api/agents/:id/reasoning', requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const reasoning = await storage.getAIAgentReasoning(req.params.id, limit);
      res.json({
        success: true,
        data: reasoning
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get all agent trades (global feed) (protected)
  app.get('/api/agents/trades/all', requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const trades = await storage.getAllAIAgentTrades(limit);
      res.json({
        success: true,
        data: trades
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get all agent reasoning (global chat feed) (protected)
  app.get('/api/agents/reasoning/all', requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const reasoning = await storage.getAllAIAgentReasoning(limit);
      res.json({
        success: true,
        data: reasoning
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get balance history (protected)
  app.get('/api/balance-history', requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const history = await storage.getBalanceHistory(limit);
      res.json({
        success: true,
        data: history
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get unified overview (bots + agents) (protected)
  app.get('/api/overview', requireAuth, async (req, res) => {
    try {
      const bots = await storage.getAllBots();
      const agents = await storage.getAllAIAgents();
      
      // Calculate aggregate stats
      const totalBots = bots.length;
      const activeBots = bots.filter(b => b.status === 'running').length;
      const totalAgents = agents.length;
      const activeAgents = agents.filter(a => a.status === 'running').length;
      
      // Get account balance
      const apiKey = process.env.ASTERDEX_API_KEY || '';
      const apiSecret = process.env.ASTERDEX_API_SECRET || '';
      const client = new AsterdexClient(apiKey, apiSecret);
      
      let accountBalance = 0;
      let availableBalance = 0;
      try {
        const accountInfo = await client.getAccountInformation();
        const usdtBalance = accountInfo.assets?.find((a: any) => a.asset === 'USDT');
        if (usdtBalance) {
          accountBalance = parseFloat(usdtBalance.walletBalance || '0');
          availableBalance = parseFloat(usdtBalance.availableBalance || '0');
        }
      } catch (error) {
        console.error('Failed to fetch account balance:', error);
      }
      
      // Get total P&L from all bots
      let totalBotPnL = 0;
      for (const bot of bots) {
        const stats = await storage.getBotStats(bot.id);
        if (stats) {
          totalBotPnL += stats.currentPnL || 0;
        }
      }
      
      // Get total P&L from all agents
      const totalAgentPnL = agents.reduce((sum, agent) => sum + (agent.performance.totalPnL || 0), 0);
      
      res.json({
        success: true,
        data: {
          bots: {
            total: totalBots,
            active: activeBots,
            totalPnL: totalBotPnL,
          },
          agents: {
            total: totalAgents,
            active: activeAgents,
            totalPnL: totalAgentPnL,
          },
          account: {
            balance: accountBalance,
            availableBalance,
            totalPnL: totalBotPnL + totalAgentPnL,
          },
          activeItems: [
            ...bots.filter(b => b.status === 'running').map(b => ({
              id: b.id,
              type: 'bot' as const,
              name: b.marketSymbol,
              icon: '🤖',
            })),
            ...agents.filter(a => a.status === 'running').map(a => ({
              id: a.id,
              type: 'agent' as const,
              name: a.modelName,
              icon: a.modelName.includes('claude') ? '🤖' : 
                    a.modelName.includes('gpt') ? '🧠' : 
                    a.modelName.includes('deepseek') ? '🔍' : 
                    a.modelName.includes('grok') ? '⚡' : 
                    a.modelName.includes('qwen') ? '🌐' : '🔮',
            })),
          ],
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
