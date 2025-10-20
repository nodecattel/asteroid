import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { botManager } from "./bot-manager";
import { botConfigSchema } from "@shared/schema";
import { AsterdexClient } from "./asterdex-client";
import { ExchangeInfoCache } from "./exchange-info-cache";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Initialize exchange info cache with a temporary client (no auth needed for public endpoints)
  const tempClient = new AsterdexClient('', '');
  const exchangeInfoCache = new ExchangeInfoCache(tempClient);

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

  // Get available markets from exchange info
  app.get('/api/markets', async (req, res) => {
    try {
      const markets = await exchangeInfoCache.getAvailableMarkets();
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

  // Get all bot instances
  app.get('/api/bots', async (req, res) => {
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

  // Get specific bot details
  app.get('/api/bots/:botId', async (req, res) => {
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

  // Create new bot instance
  app.post('/api/bots', async (req, res) => {
    try {
      const config = botConfigSchema.parse(req.body);
      const botId = await botManager.createBot(config);
      res.json({
        success: true,
        data: { botId }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Start bot
  app.post('/api/bots/:botId/start', async (req, res) => {
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

  // Pause bot
  app.post('/api/bots/:botId/pause', async (req, res) => {
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

  // Stop bot
  app.post('/api/bots/:botId/stop', async (req, res) => {
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

  // Delete bot
  app.delete('/api/bots/:botId', async (req, res) => {
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

  // Get bot orders
  app.get('/api/bots/:botId/orders', async (req, res) => {
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

  // Get bot activity logs
  app.get('/api/bots/:botId/logs', async (req, res) => {
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

  // Get bot hourly volume
  app.get('/api/bots/:botId/volume', async (req, res) => {
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

  return httpServer;
}
