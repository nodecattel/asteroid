import { z } from "zod";

// Bot Configuration Schema
// Note: API credentials are now stored in .env for security
export const botConfigSchema = z.object({
  baseUrl: z.string().default('https://fapi.asterdex.com'),
  
  // Market & Trading
  marketSymbol: z.string(),
  leverage: z.number().int().positive(),
  marginUsdt: z.number().positive(), // Margin to risk (your capital), not notional value
  
  // Volume Targets
  targetVolume: z.number().positive(),
  maxLoss: z.number().positive(),
  targetHours: z.number().int().positive(),
  
  // Strategy Parameters
  firstOrderSpreadBps: z.number().positive().default(5), // Spread from current price to first buy/sell order
  orderSpacingBps: z.number().positive().default(2), // Spread between subsequent orders
  ordersPerSide: z.number().int().positive(),
  orderSizePercent: z.number().positive().optional(), // DEPRECATED: No longer used, margin is auto-distributed
  cycleTimeSeconds: z.number().min(1).max(300).default(5), // Trading loop cycle time (1-300s, 5s recommended)
  refreshInterval: z.number().min(30).default(60), // Minimum 30s to allow orders to fill
  tradingBias: z.enum(['neutral', 'long', 'short']).default('neutral'), // Side preference
  longBiasPercent: z.number().min(0).max(100).default(50), // % of orders on long side (50 = neutral)
  
  // Rate Limit Protection
  delayBetweenOrders: z.number().nonnegative(),
  delayAfterCancel: z.number().nonnegative(),
  maxOrdersToPlace: z.number().int().positive(),
  
  // Risk Management (NEW)
  enableStopLoss: z.boolean().default(true),
  stopLossPercent: z.number().positive().default(2.0), // % from entry price
  enableTakeProfit: z.boolean().default(true),
  takeProfitPercent: z.number().positive().default(5.0), // % from entry price
  enableTrailingStop: z.boolean().default(false),
  trailingStopCallbackRate: z.number().positive().default(1.0), // % trailing distance
  trailingStopActivationPercent: z.number().positive().default(2.0), // Activate after X% profit
  circuitBreakerEnabled: z.boolean().default(true),
  circuitBreakerThreshold: z.number().positive().default(20.0), // Max unrealized loss in USDT
  earlyWarningThreshold50: z.boolean().default(true), // Warn at 50% of stop-loss
  earlyWarningThreshold75: z.boolean().default(true), // Warn at 75% of stop-loss
  
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
  
  // Position & Risk Metrics (NEW)
  openPositions: z.number().default(0),
  totalPositionValue: z.number().default(0), // Total notional value
  unrealizedPnL: z.number().default(0), // Sum of all position unrealized PnL
  realizedPnL: z.number().default(0), // Sum of all position realized PnL
  positionsWithStopLoss: z.number().default(0),
  positionsWithTakeProfit: z.number().default(0),
  trailingStopsActive: z.number().default(0),
  circuitBreakerTriggered: z.boolean().default(false),
  riskScore: z.number().default(0), // 0-100 risk assessment
});

export type BotStats = z.infer<typeof botStatsSchema>;

// Order Schema - Enhanced with TP/SL order types
export const orderSchema = z.object({
  id: z.string(),
  botId: z.string(),
  clientOrderId: z.string(),
  exchangeOrderId: z.string().optional(), // Exchange-assigned order ID
  symbol: z.string(),
  side: z.enum(['BUY', 'SELL']),
  type: z.enum(['LIMIT', 'MARKET', 'STOP_MARKET', 'TAKE_PROFIT_MARKET', 'TRAILING_STOP_MARKET']),
  price: z.number(),
  quantity: z.number(),
  filledQuantity: z.number().optional(),
  stopPrice: z.number().optional(), // For STOP_MARKET orders
  activationPrice: z.number().optional(), // For TRAILING_STOP_MARKET
  callbackRate: z.number().optional(), // For TRAILING_STOP_MARKET
  workingType: z.enum(['MARK_PRICE', 'CONTRACT_PRICE']).optional().default('MARK_PRICE'),
  positionSide: z.enum(['BOTH', 'LONG', 'SHORT']).optional().default('BOTH'),
  priceProtect: z.boolean().optional().default(false),
  status: z.enum(['PENDING', 'NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED', 'FAILED']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Order = z.infer<typeof orderSchema>;

// Position Schema - Track open positions with TP/SL
export const positionSchema = z.object({
  id: z.string(),
  botId: z.string(),
  symbol: z.string(),
  side: z.enum(['LONG', 'SHORT']),
  entryPrice: z.number(),
  currentPrice: z.number(),
  quantity: z.number(),
  leverage: z.number(),
  unrealizedPnl: z.number(),
  realizedPnl: z.number(),
  
  // TP/SL Protection
  stopLossPrice: z.number().optional(),
  stopLossOrderId: z.string().optional(), // Native exchange order ID
  takeProfitPrice: z.number().optional(),
  takeProfitOrderId: z.string().optional(), // Native exchange order ID
  
  // Trailing Stop
  trailingStopActive: z.boolean().default(false),
  trailingStopOrderId: z.string().optional(),
  peakProfit: z.number().default(0), // Track peak profit for trailing
  
  // Risk Monitoring
  riskLevel: z.enum(['safe', 'warning', 'danger', 'critical']),
  warningTriggered50: z.boolean().default(false),
  warningTriggered75: z.boolean().default(false),
  
  // Timestamps
  openedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
});

export type Position = z.infer<typeof positionSchema>;

// Trade Schema - Track individual filled trades for history
export const tradeSchema = z.object({
  id: z.string(),
  botId: z.string(),
  orderId: z.string(), // Reference to the order that was filled
  symbol: z.string(),
  side: z.enum(['BUY', 'SELL']),
  price: z.number(),
  quantity: z.number(),
  quoteQuantity: z.number(), // price * quantity
  commission: z.number(),
  commissionAsset: z.string().default('USDT'),
  realizedPnl: z.number().default(0), // Calculated when matching buy/sell
  timestamp: z.string().datetime(),
});

export type Trade = z.infer<typeof tradeSchema>;

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

// Note: Markets are now fetched dynamically from Asterdex exchange info endpoint
// and cached for 5 minutes. This provides up-to-date market data including
// leverage limits, precision, and other trading parameters.

// Keep existing user schemas for auth if needed later
export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
});

export type User = z.infer<typeof userSchema>;
export type InsertUser = Omit<User, 'id'>;

// AI Agent Schema
export const aiAgentConfigSchema = z.object({
  // Agent Identity
  modelName: z.string(), // e.g., "Claude 3.5 Sonnet", "GPT-4", "DeepSeek Chat V3.1"
  modelProvider: z.string(), // e.g., "Anthropic", "OpenAI", "DeepSeek"
  
  // Trading Parameters
  startingCapital: z.number().positive(),
  maxPositionSize: z.number().positive(), // Max USDT per position
  maxOpenPositions: z.number().int().positive().default(3),
  allowedSymbols: z.array(z.string()).default(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']),
  defaultLeverage: z.number().int().min(1).max(125).default(10),
  
  // Risk Management
  maxDrawdownPercent: z.number().positive().default(10), // Stop trading if down X%
  stopLossPercent: z.number().positive().default(2.0),
  takeProfitPercent: z.number().positive().default(5.0),
  
  // Agent Behavior
  decisionIntervalSeconds: z.number().int().min(60).default(180), // How often agent makes decisions (3 min default)
  enableAutoTrading: z.boolean().default(true), // If false, agent only analyzes but doesn't trade
  
  // MCP Connection
  mcpEndpoint: z.string().url().optional(), // HTTP MCP server URL (if using remote agent)
  mcpConnectionType: z.enum(['http', 'stdio']).default('http'),
});

export type AIAgentConfig = z.infer<typeof aiAgentConfigSchema>;

// AI Agent Instance Schema
export const aiAgentInstanceSchema = z.object({
  id: z.string(),
  modelName: z.string(),
  modelProvider: z.string(),
  status: z.enum(['running', 'paused', 'stopped', 'error']),
  config: aiAgentConfigSchema,
  
  // Performance Metrics
  currentBalance: z.number(),
  totalPnL: z.number().default(0),
  totalTrades: z.number().int().default(0),
  winningTrades: z.number().int().default(0),
  losingTrades: z.number().int().default(0),
  winRate: z.number().default(0), // Percentage
  sharpeRatio: z.number().optional(),
  maxDrawdown: z.number().default(0),
  
  // Current State
  openPositions: z.number().int().default(0),
  totalPositionValue: z.number().default(0),
  unrealizedPnL: z.number().default(0),
  
  // Timestamps
  sessionStart: z.string().datetime(),
  lastDecision: z.string().datetime().optional(),
  lastUpdate: z.string().datetime(),
});

export type AIAgentInstance = z.infer<typeof aiAgentInstanceSchema>;

// AI Agent Trade Schema
export const aiAgentTradeSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  modelName: z.string(),
  
  // Trade Details
  symbol: z.string(),
  side: z.enum(['BUY', 'SELL']),
  type: z.enum(['LONG', 'SHORT']),
  entryPrice: z.number(),
  exitPrice: z.number().optional(),
  quantity: z.number(),
  leverage: z.number(),
  
  // P&L
  notional: z.number(), // Entry notional value
  realizedPnL: z.number().default(0),
  unrealizedPnL: z.number().default(0),
  
  // Trade Management
  stopLossPrice: z.number().optional(),
  takeProfitPrice: z.number().optional(),
  holdingTime: z.number().optional(), // Seconds
  
  // AI Reasoning
  entryReason: z.string(), // Why the agent entered this trade
  exitReason: z.string().optional(), // Why the agent exited
  confidence: z.number().min(0).max(1).optional(), // Agent's confidence level (0-1)
  
  // Timestamps
  entryTime: z.string().datetime(),
  exitTime: z.string().datetime().optional(),
  
  // Exchange IDs
  entryOrderId: z.string().optional(),
  exitOrderId: z.string().optional(),
  stopLossOrderId: z.string().optional(),
  takeProfitOrderId: z.string().optional(),
});

export type AIAgentTrade = z.infer<typeof aiAgentTradeSchema>;

// AI Agent Reasoning/Commentary Schema
export const aiAgentReasoningSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  modelName: z.string(),
  timestamp: z.string().datetime(),
  
  // Market Analysis
  marketCondition: z.string(), // Agent's view of current market
  
  // Decision
  decision: z.enum(['hold', 'enter_long', 'enter_short', 'close_position', 'no_action']),
  reasoning: z.string(), // Full reasoning text
  
  // Context
  symbols: z.array(z.string()), // Which markets analyzed
  accountBalance: z.number(),
  openPositions: z.number().int(),
  riskLevel: z.enum(['low', 'medium', 'high']),
});

export type AIAgentReasoning = z.infer<typeof aiAgentReasoningSchema>;
