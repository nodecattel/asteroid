import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  type Tool,
  type Resource,
  type Prompt,
} from '@modelcontextprotocol/sdk/types.js';
import { AsterdexClient } from './asterdex-client.js';

type OrderSide = 'BUY' | 'SELL';
type OrderType = 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
type TimeInForce = 'GTC' | 'IOC' | 'FOK';

const API_KEY = process.env.ASTERDEX_API_KEY || '';
const API_SECRET = process.env.ASTERDEX_API_SECRET || '';

if (!API_KEY || !API_SECRET) {
  console.error('ERROR: ASTERDEX_API_KEY and ASTERDEX_API_SECRET must be set');
  process.exit(1);
}

const apiClient = new AsterdexClient(API_KEY, API_SECRET);

/**
 * MCP Server for AI Agent Trading on Aster Dex
 * 
 * Exposes real-time market data, trading tools, and decision-making prompts
 * for autonomous AI agents (Claude, GPT-4, DeepSeek, Grok, Qwen, etc.)
 */
const server = new Server(
  {
    name: 'asterdex-trading-agent',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// ============================================================================
// TOOLS - Trading Operations
// ============================================================================

const tools: Tool[] = [
  {
    name: 'get_account_balance',
    description: 'Get current account balance and available margin',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_market_price',
    description: 'Get current mark price for a trading pair',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol (e.g., BTCUSDT, ETHUSDT)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_orderbook',
    description: 'Get orderbook depth for a trading pair',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        limit: {
          type: 'number',
          description: 'Number of price levels (default: 20)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_open_positions',
    description: 'Get all open positions with P&L and risk metrics',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Filter by symbol (optional)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_open_orders',
    description: 'Get all open orders',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Filter by symbol (optional)',
        },
      },
      required: [],
    },
  },
  {
    name: 'place_market_order',
    description: 'Place a market order (executes immediately at current price)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        side: {
          type: 'string',
          enum: ['BUY', 'SELL'],
          description: 'Order side (BUY or SELL)',
        },
        quantity: {
          type: 'number',
          description: 'Order quantity in base asset',
        },
        leverage: {
          type: 'number',
          description: 'Leverage (1-125)',
        },
      },
      required: ['symbol', 'side', 'quantity', 'leverage'],
    },
  },
  {
    name: 'place_limit_order',
    description: 'Place a limit order at a specific price',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        side: {
          type: 'string',
          enum: ['BUY', 'SELL'],
          description: 'Order side (BUY or SELL)',
        },
        price: {
          type: 'number',
          description: 'Limit price',
        },
        quantity: {
          type: 'number',
          description: 'Order quantity',
        },
        leverage: {
          type: 'number',
          description: 'Leverage (1-125)',
        },
      },
      required: ['symbol', 'side', 'price', 'quantity', 'leverage'],
    },
  },
  {
    name: 'cancel_order',
    description: 'Cancel an open order',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        orderId: {
          type: 'number',
          description: 'Order ID to cancel',
        },
      },
      required: ['symbol', 'orderId'],
    },
  },
  {
    name: 'cancel_all_orders',
    description: 'Cancel all open orders for a symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'close_position',
    description: 'Close an open position completely (market order)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'set_leverage',
    description: 'Set leverage for a trading pair',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        leverage: {
          type: 'number',
          description: 'Leverage (1-125)',
        },
      },
      required: ['symbol', 'leverage'],
    },
  },
  {
    name: 'place_stop_loss',
    description: 'Place a stop-loss order to limit losses',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        side: {
          type: 'string',
          enum: ['BUY', 'SELL'],
          description: 'Order side (opposite of position)',
        },
        stopPrice: {
          type: 'number',
          description: 'Stop trigger price',
        },
        quantity: {
          type: 'number',
          description: 'Order quantity',
        },
      },
      required: ['symbol', 'side', 'stopPrice', 'quantity'],
    },
  },
  {
    name: 'place_take_profit',
    description: 'Place a take-profit order to lock in gains',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        side: {
          type: 'string',
          enum: ['BUY', 'SELL'],
          description: 'Order side (opposite of position)',
        },
        stopPrice: {
          type: 'number',
          description: 'Take profit trigger price',
        },
        quantity: {
          type: 'number',
          description: 'Order quantity',
        },
      },
      required: ['symbol', 'side', 'stopPrice', 'quantity'],
    },
  },
  {
    name: 'get_24hr_ticker',
    description: 'Get 24-hour price statistics for a symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_funding_rate',
    description: 'Get current funding rate for a perpetual contract',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
      },
      required: ['symbol'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_account_balance': {
        const balance = await apiClient.getAccountBalance();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(balance, null, 2),
            },
          ],
        };
      }

      case 'get_market_price': {
        const { symbol } = args as { symbol: string };
        const price = await apiClient.getMarkPrice(symbol);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ symbol, markPrice: price }, null, 2),
            },
          ],
        };
      }

      case 'get_orderbook': {
        const { symbol, limit = 20 } = args as { symbol: string; limit?: number };
        const orderbook = await apiClient.getOrderBook(symbol, limit);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(orderbook, null, 2),
            },
          ],
        };
      }

      case 'get_open_positions': {
        const { symbol } = args as { symbol?: string };
        const positions = await apiClient.getPositionRisk(symbol);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(positions, null, 2),
            },
          ],
        };
      }

      case 'get_open_orders': {
        const { symbol } = args as { symbol?: string };
        const orders = await apiClient.getOpenOrders(symbol);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(orders, null, 2),
            },
          ],
        };
      }

      case 'place_market_order': {
        const { symbol, side, quantity, leverage } = args as {
          symbol: string;
          side: OrderSide;
          quantity: number;
          leverage: number;
        };
        
        // Set leverage first
        await apiClient.setLeverage(symbol, leverage);
        
        // Place market order
        const order = await apiClient.newOrder({
          symbol,
          side,
          type: 'MARKET' as OrderType,
          quantity,
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, order }, null, 2),
            },
          ],
        };
      }

      case 'place_limit_order': {
        const { symbol, side, price, quantity, leverage } = args as {
          symbol: string;
          side: OrderSide;
          price: number;
          quantity: number;
          leverage: number;
        };
        
        // Set leverage first
        await apiClient.setLeverage(symbol, leverage);
        
        // Place limit order
        const order = await apiClient.newOrder({
          symbol,
          side,
          type: 'LIMIT' as OrderType,
          price,
          quantity,
          timeInForce: 'GTC' as TimeInForce,
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, order }, null, 2),
            },
          ],
        };
      }

      case 'cancel_order': {
        const { symbol, orderId } = args as { symbol: string; orderId: number };
        const result = await apiClient.cancelOrder(symbol, orderId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, result }, null, 2),
            },
          ],
        };
      }

      case 'cancel_all_orders': {
        const { symbol } = args as { symbol: string };
        const result = await apiClient.cancelAllOpenOrders(symbol);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, result }, null, 2),
            },
          ],
        };
      }

      case 'close_position': {
        const { symbol } = args as { symbol: string };
        const positions = await apiClient.getPositionRisk(symbol);
        const position = positions.find((p: any) => p.symbol === symbol);
        
        if (!position || parseFloat(position.positionAmt) === 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'No open position for this symbol' }),
              },
            ],
          };
        }
        
        const positionSize = Math.abs(parseFloat(position.positionAmt));
        const side: OrderSide = parseFloat(position.positionAmt) > 0 ? 'SELL' : 'BUY';
        
        const order = await apiClient.newOrder({
          symbol,
          side,
          type: 'MARKET' as OrderType,
          quantity: positionSize,
          reduceOnly: true,
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, closedPosition: position, order }, null, 2),
            },
          ],
        };
      }

      case 'set_leverage': {
        const { symbol, leverage } = args as { symbol: string; leverage: number };
        const result = await apiClient.setLeverage(symbol, leverage);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, result }, null, 2),
            },
          ],
        };
      }

      case 'place_stop_loss': {
        const { symbol, side, stopPrice, quantity } = args as {
          symbol: string;
          side: OrderSide;
          stopPrice: number;
          quantity: number;
        };
        
        const order = await apiClient.newOrder({
          symbol,
          side,
          type: 'STOP_MARKET' as OrderType,
          stopPrice,
          quantity,
          reduceOnly: true,
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, stopLoss: order }, null, 2),
            },
          ],
        };
      }

      case 'place_take_profit': {
        const { symbol, side, stopPrice, quantity } = args as {
          symbol: string;
          side: OrderSide;
          stopPrice: number;
          quantity: number;
        };
        
        const order = await apiClient.newOrder({
          symbol,
          side,
          type: 'TAKE_PROFIT_MARKET' as OrderType,
          stopPrice,
          quantity,
          reduceOnly: true,
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, takeProfit: order }, null, 2),
            },
          ],
        };
      }

      case 'get_24hr_ticker': {
        const { symbol } = args as { symbol: string };
        const ticker = await apiClient.get24hrTicker(symbol);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(ticker, null, 2),
            },
          ],
        };
      }

      case 'get_funding_rate': {
        const { symbol } = args as { symbol: string };
        const fundingRate = await apiClient.getFundingRate(symbol);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(fundingRate, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message || 'Unknown error',
            details: error.response?.data || error.toString(),
          }),
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// RESOURCES - Real-time Market Data
// ============================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources: Resource[] = [
    {
      uri: 'market://account/balance',
      name: 'Account Balance',
      description: 'Current account balance and margin information',
      mimeType: 'application/json',
    },
    {
      uri: 'market://positions/all',
      name: 'All Open Positions',
      description: 'All open positions with P&L and risk metrics',
      mimeType: 'application/json',
    },
    {
      uri: 'market://orders/all',
      name: 'All Open Orders',
      description: 'All active orders across all symbols',
      mimeType: 'application/json',
    },
  ];
  
  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    if (uri === 'market://account/balance') {
      const balance = await apiClient.getAccountBalance();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(balance, null, 2),
          },
        ],
      };
    }

    if (uri === 'market://positions/all') {
      const positions = await apiClient.getPositionRisk();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(positions, null, 2),
          },
        ],
      };
    }

    if (uri === 'market://orders/all') {
      const orders = await apiClient.getOpenOrders();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(orders, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  } catch (error: any) {
    throw new Error(`Failed to read resource: ${error.message}`);
  }
});

// ============================================================================
// PROMPTS - AI Decision Making Templates
// ============================================================================

const prompts: Prompt[] = [
  {
    name: 'market_analysis',
    description: 'Analyze market conditions and identify trading opportunities',
    arguments: [
      {
        name: 'symbol',
        description: 'Trading pair to analyze (e.g., BTCUSDT)',
        required: true,
      },
    ],
  },
  {
    name: 'risk_assessment',
    description: 'Assess risk for current portfolio and open positions',
    arguments: [],
  },
  {
    name: 'position_management',
    description: 'Evaluate and suggest position management actions (TP/SL, sizing)',
    arguments: [
      {
        name: 'symbol',
        description: 'Trading pair to manage',
        required: true,
      },
    ],
  },
  {
    name: 'trend_following_strategy',
    description: 'Generate a trend-following trading strategy',
    arguments: [
      {
        name: 'symbol',
        description: 'Trading pair',
        required: true,
      },
      {
        name: 'timeframe',
        description: 'Timeframe (short/medium/long)',
        required: false,
      },
    ],
  },
  {
    name: 'mean_reversion_strategy',
    description: 'Generate a mean-reversion trading strategy',
    arguments: [
      {
        name: 'symbol',
        description: 'Trading pair',
        required: true,
      },
    ],
  },
];

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'market_analysis': {
      const symbol = args?.symbol as string;
      const [ticker, orderbook, fundingRate] = await Promise.all([
        apiClient.get24hrTicker(symbol),
        apiClient.getOrderBook(symbol, 20),
        apiClient.getFundingRate(symbol),
      ]);

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze the market for ${symbol} and identify potential trading opportunities.

**Market Data:**
- 24h Price Change: ${ticker.priceChangePercent}%
- Current Price: ${ticker.lastPrice}
- 24h High: ${ticker.highPrice}
- 24h Low: ${ticker.lowPrice}
- 24h Volume: ${ticker.volume}
- Funding Rate: ${fundingRate.fundingRate}

**Orderbook:**
Top 5 Bids: ${orderbook.bids.slice(0, 5).map((b: any) => `${b[0]} (${b[1]})`).join(', ')}
Top 5 Asks: ${orderbook.asks.slice(0, 5).map((a: any) => `${a[0]} (${a[1]})`).join(', ')}

Based on this data:
1. Identify the current trend (bullish/bearish/neutral)
2. Assess orderbook imbalance and liquidity
3. Consider funding rate implications
4. Suggest entry points, stop-loss, and take-profit levels
5. Recommend position size and leverage`,
            },
          },
        ],
      };
    }

    case 'risk_assessment': {
      const [balance, positions] = await Promise.all([
        apiClient.getAccountBalance(),
        apiClient.getPositionRisk(),
      ]);

      const totalExposure = positions.reduce((sum: number, p: any) => {
        return sum + Math.abs(parseFloat(p.notional));
      }, 0);

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Assess the risk of my current portfolio:

**Account:**
- Total Wallet Balance: ${balance.totalWalletBalance} USDT
- Available Balance: ${balance.availableBalance} USDT
- Total Unrealized P&L: ${balance.totalUnrealizedProfit} USDT

**Positions:**
${positions.map((p: any) => `
- ${p.symbol}: ${p.positionAmt} (Notional: ${p.notional} USDT)
  Entry: ${p.entryPrice}, Mark: ${p.markPrice}
  Leverage: ${p.leverage}x
  Unrealized P&L: ${p.unRealizedProfit} USDT
`).join('\n')}

**Risk Metrics:**
- Total Exposure: ${totalExposure.toFixed(2)} USDT
- Exposure/Balance Ratio: ${(totalExposure / parseFloat(balance.totalWalletBalance) * 100).toFixed(2)}%

Analyze:
1. Overall portfolio risk level (low/medium/high)
2. Concentration risk
3. Leverage usage
4. Recommend risk reduction strategies if needed
5. Suggest portfolio adjustments`,
            },
          },
        ],
      };
    }

    case 'position_management': {
      const symbol = args?.symbol as string;
      const positions = await apiClient.getPositionRisk(symbol);
      const position = positions.find((p: any) => p.symbol === symbol);

      if (!position || parseFloat(position.positionAmt) === 0) {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `No open position for ${symbol}`,
              },
            },
          ],
        };
      }

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Manage the open position for ${symbol}:

**Position Details:**
- Size: ${position.positionAmt}
- Side: ${parseFloat(position.positionAmt) > 0 ? 'LONG' : 'SHORT'}
- Entry Price: ${position.entryPrice}
- Current Mark Price: ${position.markPrice}
- Unrealized P&L: ${position.unRealizedProfit} USDT (${((parseFloat(position.unRealizedProfit) / (parseFloat(position.notional) / parseFloat(position.leverage))) * 100).toFixed(2)}%)
- Leverage: ${position.leverage}x
- Liquidation Price: ${position.liquidationPrice}

Provide recommendations:
1. Should I hold, reduce, or increase position?
2. Optimal stop-loss price
3. Optimal take-profit levels (multiple targets if appropriate)
4. Should I adjust leverage?
5. Risk management actions to take now`,
            },
          },
        ],
      };
    }

    case 'trend_following_strategy': {
      const symbol = args?.symbol as string;
      const timeframe = (args?.timeframe as string) || 'medium';
      const ticker = await apiClient.get24hrTicker(symbol);

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Design a ${timeframe}-term trend-following strategy for ${symbol}:

**Current Market:**
- Price: ${ticker.lastPrice}
- 24h Change: ${ticker.priceChangePercent}%
- Volume: ${ticker.volume}

Generate a complete strategy including:
1. Trend identification criteria
2. Entry rules (when to open LONG/SHORT)
3. Position sizing formula
4. Stop-loss placement
5. Take-profit targets (trailing or fixed)
6. Exit conditions
7. Risk per trade
8. Maximum concurrent positions`,
            },
          },
        ],
      };
    }

    case 'mean_reversion_strategy': {
      const symbol = args?.symbol as string;
      const [ticker, orderbook] = await Promise.all([
        apiClient.get24hrTicker(symbol),
        apiClient.getOrderBook(symbol, 50),
      ]);

      const midPrice = (parseFloat(orderbook.bids[0][0]) + parseFloat(orderbook.asks[0][0])) / 2;

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Design a mean-reversion strategy for ${symbol}:

**Market Data:**
- Current Price: ${ticker.lastPrice}
- Mid Price: ${midPrice}
- 24h High: ${ticker.highPrice}
- 24h Low: ${ticker.lowPrice}
- Price Range: ${((parseFloat(ticker.highPrice) - parseFloat(ticker.lowPrice)) / parseFloat(ticker.lowPrice) * 100).toFixed(2)}%

Create a strategy with:
1. Overbought/oversold detection method
2. Mean price calculation (e.g., VWAP, moving average proxy)
3. Entry triggers (price deviation from mean)
4. Position sizing based on deviation magnitude
5. Exit conditions (return to mean)
6. Stop-loss for failed reversions
7. Maximum hold time`,
            },
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  console.error('🤖 Asterdex AI Trading Agent MCP Server');
  console.error('📊 Connecting to Aster Dex API...');
  
  // Test connection
  try {
    await apiClient.ping();
    const balance = await apiClient.getAccountBalance();
    console.error(`✅ Connected! Balance: ${balance.totalWalletBalance} USDT`);
  } catch (error: any) {
    console.error(`❌ Connection failed: ${error.message}`);
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 MCP Server ready for AI agents');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
