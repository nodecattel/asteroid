import { z } from "zod";

// Bot Configuration Schema
export const botConfigSchema = z.object({
  apiKey: z.string(),
  apiSecret: z.string(),
  baseUrl: z.string().default('https://fapi.asterdex.com'),
  
  // Market & Trading
  marketSymbol: z.string(),
  leverage: z.number().int().positive(),
  investmentUsdt: z.number().positive(),
  
  // Volume Targets
  targetVolume: z.number().positive(),
  maxLoss: z.number().positive(),
  targetHours: z.number().int().positive(),
  
  // Strategy Parameters
  spreadBps: z.number().positive(),
  ordersPerSide: z.number().int().positive(),
  orderSizePercent: z.number().positive(),
  refreshInterval: z.number().positive(),
  
  // Rate Limit Protection
  delayBetweenOrders: z.number().nonnegative(),
  delayAfterCancel: z.number().nonnegative(),
  maxOrdersToPlace: z.number().int().positive(),
  
  // Advanced
  usePostOnly: z.boolean().default(false),
  tradingFeePercent: z.number().nonnegative().default(0.2),
});

export type BotConfig = z.infer<typeof botConfigSchema>;

// Bot Instance Schema
export const botInstanceSchema = z.object({
  id: z.string(),
  marketSymbol: z.string(),
  status: z.enum(['running', 'paused', 'stopped', 'error']),
  config: botConfigSchema,
  sessionStart: z.string().datetime(),
  lastUpdate: z.string().datetime(),
});

export type BotInstance = z.infer<typeof botInstanceSchema>;

// Bot Statistics Schema
export const botStatsSchema = z.object({
  botId: z.string(),
  totalVolume: z.number(),
  totalTrades: z.number(),
  totalFees: z.number(),
  currentPnL: z.number(),
  activeOrders: z.number(),
  fillRate: z.number(),
  hourlyVolume: z.number(),
  hourlyTrades: z.number(),
  sessionUptime: z.number(), // in seconds
});

export type BotStats = z.infer<typeof botStatsSchema>;

// Order Schema
export const orderSchema = z.object({
  id: z.string(),
  botId: z.string(),
  clientOrderId: z.string(),
  symbol: z.string(),
  side: z.enum(['BUY', 'SELL']),
  type: z.enum(['LIMIT', 'MARKET']),
  price: z.number(),
  quantity: z.number(),
  filledQuantity: z.number().optional(),
  status: z.enum(['PENDING', 'NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED', 'FAILED']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Order = z.infer<typeof orderSchema>;

// Activity Log Schema
export const activityLogSchema = z.object({
  id: z.string(),
  botId: z.string(),
  timestamp: z.string().datetime(),
  type: z.enum(['fill', 'error', 'info', 'cancel', 'warning', 'success']),
  message: z.string(),
});

export type ActivityLog = z.infer<typeof activityLogSchema>;

// Hourly Volume Data Schema
export const hourlyVolumeSchema = z.object({
  botId: z.string(),
  hour: z.string(),
  volume: z.number(),
  target: z.number(),
  trades: z.number(),
});

export type HourlyVolume = z.infer<typeof hourlyVolumeSchema>;

// API Response Schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export type ApiResponse = z.infer<typeof apiResponseSchema>;

// Market Info Schema (from Asterdex API)
export const marketInfoSchema = z.object({
  symbol: z.string(),
  status: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  pricePrecision: z.number(),
  quantityPrecision: z.number(),
  filters: z.array(z.any()),
});

export type MarketInfo = z.infer<typeof marketInfoSchema>;

// Available Markets constant
export const AVAILABLE_MARKETS = [
  "BTCUSDT",
  "ETHUSDT", 
  "SOLUSDT",
  "DOGEUSDT",
  "HYPEUSDT",
  "ASTERUSDT",
  "WLDUSDT",
  "XPLUSDT",
  "LINKUSDT",
  "AVAXUSDT"
] as const;

export type MarketSymbol = typeof AVAILABLE_MARKETS[number];

// Keep existing user schemas for auth if needed later
export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
});

export type User = z.infer<typeof userSchema>;
export type InsertUser = Omit<User, 'id'>;
