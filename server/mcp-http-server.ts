import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { AsterdexClient } from './asterdex-client.js';

type OrderSide = 'BUY' | 'SELL';
type OrderType = 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
type TimeInForce = 'GTC' | 'IOC' | 'FOK';

const API_KEY = process.env.ASTERDEX_API_KEY || '';
const API_SECRET = process.env.ASTERDEX_API_SECRET || '';
const PORT = parseInt(process.env.MCP_PORT || '3001');

if (!API_KEY || !API_SECRET) {
  console.error('ERROR: ASTERDEX_API_KEY and ASTERDEX_API_SECRET must be set');
  process.exit(1);
}

const apiClient = new AsterdexClient(API_KEY, API_SECRET);

/**
 * HTTP-based MCP Server for AI Agent Trading
 * 
 * This server exposes the same capabilities as the stdio version but over HTTP,
 * making it easier to integrate with cloud-based AI agents.
 */

const app = express();
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    await apiClient.ping();
    const balance = await apiClient.getAccountBalance();
    res.json({
      status: 'healthy',
      connected: true,
      balance: balance.totalWalletBalance,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      connected: false,
      error: error.message,
    });
  }
});

// MCP JSON-RPC endpoint
app.post('/mcp', async (req, res) => {
  const { method, params, id } = req.body;

  try {
    let result: any;

    switch (method) {
      case 'tools/list':
        result = await handleListTools();
        break;
      case 'tools/call':
        result = await handleCallTool(params);
        break;
      case 'resources/list':
        result = await handleListResources();
        break;
      case 'resources/read':
        result = await handleReadResource(params);
        break;
      case 'prompts/list':
        result = await handleListPrompts();
        break;
      case 'prompts/get':
        result = await handleGetPrompt(params);
        break;
      default:
        throw new Error(`Unknown method: ${method}`);
    }

    res.json({
      jsonrpc: '2.0',
      id,
      result,
    });
  } catch (error: any) {
    res.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message: error.message,
        data: error.response?.data,
      },
    });
  }
});

// Import handlers from main MCP server logic
async function handleListTools() {
  // Same tools as in mcp-server.ts
  return {
    tools: [
      { name: 'get_account_balance', description: 'Get current account balance and available margin', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'get_market_price', description: 'Get current mark price for a trading pair', inputSchema: { type: 'object', properties: { symbol: { type: 'string', description: 'Trading pair symbol' } }, required: ['symbol'] } },
      { name: 'get_orderbook', description: 'Get orderbook depth', inputSchema: { type: 'object', properties: { symbol: { type: 'string' }, limit: { type: 'number' } }, required: ['symbol'] } },
      { name: 'get_open_positions', description: 'Get all open positions', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: [] } },
      { name: 'get_open_orders', description: 'Get all open orders', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: [] } },
      { name: 'place_market_order', description: 'Place a market order', inputSchema: { type: 'object', properties: { symbol: { type: 'string' }, side: { type: 'string', enum: ['BUY', 'SELL'] }, quantity: { type: 'number' }, leverage: { type: 'number' } }, required: ['symbol', 'side', 'quantity', 'leverage'] } },
      { name: 'place_limit_order', description: 'Place a limit order', inputSchema: { type: 'object', properties: { symbol: { type: 'string' }, side: { type: 'string', enum: ['BUY', 'SELL'] }, price: { type: 'number' }, quantity: { type: 'number' }, leverage: { type: 'number' } }, required: ['symbol', 'side', 'price', 'quantity', 'leverage'] } },
      { name: 'cancel_order', description: 'Cancel an order', inputSchema: { type: 'object', properties: { symbol: { type: 'string' }, orderId: { type: 'number' } }, required: ['symbol', 'orderId'] } },
      { name: 'cancel_all_orders', description: 'Cancel all orders', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
      { name: 'close_position', description: 'Close a position', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
      { name: 'set_leverage', description: 'Set leverage', inputSchema: { type: 'object', properties: { symbol: { type: 'string' }, leverage: { type: 'number' } }, required: ['symbol', 'leverage'] } },
      { name: 'place_stop_loss', description: 'Place stop-loss order', inputSchema: { type: 'object', properties: { symbol: { type: 'string' }, side: { type: 'string', enum: ['BUY', 'SELL'] }, stopPrice: { type: 'number' }, quantity: { type: 'number' } }, required: ['symbol', 'side', 'stopPrice', 'quantity'] } },
      { name: 'place_take_profit', description: 'Place take-profit order', inputSchema: { type: 'object', properties: { symbol: { type: 'string' }, side: { type: 'string', enum: ['BUY', 'SELL'] }, stopPrice: { type: 'number' }, quantity: { type: 'number' } }, required: ['symbol', 'side', 'stopPrice', 'quantity'] } },
      { name: 'get_24hr_ticker', description: 'Get 24hr ticker stats', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
      { name: 'get_funding_rate', description: 'Get funding rate', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
    ],
  };
}

async function handleCallTool(params: any) {
  const { name, arguments: args } = params;

  switch (name) {
    case 'get_account_balance':
      return { content: [{ type: 'text', text: JSON.stringify(await apiClient.getAccountBalance(), null, 2) }] };
    
    case 'get_market_price': {
      const price = await apiClient.getMarkPrice(args.symbol);
      return { content: [{ type: 'text', text: JSON.stringify({ symbol: args.symbol, markPrice: price }, null, 2) }] };
    }
    
    case 'get_orderbook':
      return { content: [{ type: 'text', text: JSON.stringify(await apiClient.getOrderBook(args.symbol, args.limit || 20), null, 2) }] };
    
    case 'get_open_positions':
      return { content: [{ type: 'text', text: JSON.stringify(await apiClient.getPositionRisk(args.symbol), null, 2) }] };
    
    case 'get_open_orders':
      return { content: [{ type: 'text', text: JSON.stringify(await apiClient.getOpenOrders(args.symbol), null, 2) }] };
    
    case 'place_market_order': {
      await apiClient.setLeverage(args.symbol, args.leverage);
      const order = await apiClient.newOrder({ symbol: args.symbol, side: args.side, type: 'MARKET' as OrderType, quantity: args.quantity });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, order }, null, 2) }] };
    }
    
    case 'place_limit_order': {
      await apiClient.setLeverage(args.symbol, args.leverage);
      const order = await apiClient.newOrder({ symbol: args.symbol, side: args.side, type: 'LIMIT' as OrderType, price: args.price, quantity: args.quantity, timeInForce: 'GTC' as TimeInForce });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, order }, null, 2) }] };
    }
    
    case 'cancel_order':
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, result: await apiClient.cancelOrder(args.symbol, args.orderId) }, null, 2) }] };
    
    case 'cancel_all_orders':
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, result: await apiClient.cancelAllOpenOrders(args.symbol) }, null, 2) }] };
    
    case 'close_position': {
      const positions = await apiClient.getPositionRisk(args.symbol);
      const position = positions.find((p: any) => p.symbol === args.symbol);
      if (!position || parseFloat(position.positionAmt) === 0) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'No open position' }) }] };
      }
      const side: OrderSide = parseFloat(position.positionAmt) > 0 ? 'SELL' : 'BUY';
      const order = await apiClient.newOrder({ symbol: args.symbol, side, type: 'MARKET' as OrderType, quantity: Math.abs(parseFloat(position.positionAmt)), reduceOnly: true });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, closedPosition: position, order }, null, 2) }] };
    }
    
    case 'set_leverage':
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, result: await apiClient.setLeverage(args.symbol, args.leverage) }, null, 2) }] };
    
    case 'place_stop_loss': {
      const order = await apiClient.newOrder({ symbol: args.symbol, side: args.side, type: 'STOP_MARKET' as OrderType, stopPrice: args.stopPrice, quantity: args.quantity, reduceOnly: true });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, stopLoss: order }, null, 2) }] };
    }
    
    case 'place_take_profit': {
      const order = await apiClient.newOrder({ symbol: args.symbol, side: args.side, type: 'TAKE_PROFIT_MARKET' as OrderType, stopPrice: args.stopPrice, quantity: args.quantity, reduceOnly: true });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, takeProfit: order }, null, 2) }] };
    }
    
    case 'get_24hr_ticker':
      return { content: [{ type: 'text', text: JSON.stringify(await apiClient.get24hrTicker(args.symbol), null, 2) }] };
    
    case 'get_funding_rate':
      return { content: [{ type: 'text', text: JSON.stringify(await apiClient.getFundingRate(args.symbol), null, 2) }] };
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleListResources() {
  return {
    resources: [
      { uri: 'market://account/balance', name: 'Account Balance', description: 'Current account balance', mimeType: 'application/json' },
      { uri: 'market://positions/all', name: 'All Positions', description: 'All open positions', mimeType: 'application/json' },
      { uri: 'market://orders/all', name: 'All Orders', description: 'All active orders', mimeType: 'application/json' },
    ],
  };
}

async function handleReadResource(params: any) {
  const { uri } = params;
  
  let data: any;
  if (uri === 'market://account/balance') data = await apiClient.getAccountBalance();
  else if (uri === 'market://positions/all') data = await apiClient.getPositionRisk();
  else if (uri === 'market://orders/all') data = await apiClient.getOpenOrders();
  else throw new Error(`Unknown resource: ${uri}`);
  
  return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] };
}

async function handleListPrompts() {
  return {
    prompts: [
      { name: 'market_analysis', description: 'Analyze market and find opportunities', arguments: [{ name: 'symbol', description: 'Trading pair', required: true }] },
      { name: 'risk_assessment', description: 'Assess portfolio risk', arguments: [] },
      { name: 'position_management', description: 'Manage open positions', arguments: [{ name: 'symbol', description: 'Trading pair', required: true }] },
      { name: 'trend_following_strategy', description: 'Trend following strategy', arguments: [{ name: 'symbol', required: true }, { name: 'timeframe', required: false }] },
      { name: 'mean_reversion_strategy', description: 'Mean reversion strategy', arguments: [{ name: 'symbol', required: true }] },
    ],
  };
}

async function handleGetPrompt(params: any) {
  const { name, arguments: args } = params;
  
  // Simplified prompt generation (full version in mcp-server.ts)
  let promptText = '';
  
  if (name === 'market_analysis') {
    const [ticker, orderbook, fundingRate] = await Promise.all([
      apiClient.get24hrTicker(args.symbol),
      apiClient.getOrderBook(args.symbol, 20),
      apiClient.getFundingRate(args.symbol),
    ]);
    promptText = `Analyze ${args.symbol}: Price ${ticker.lastPrice}, 24h Change ${ticker.priceChangePercent}%, Funding ${fundingRate.fundingRate}`;
  } else if (name === 'risk_assessment') {
    const [balance, positions] = await Promise.all([apiClient.getAccountBalance(), apiClient.getPositionRisk()]);
    promptText = `Assess risk: Balance ${balance.totalWalletBalance} USDT, ${positions.length} positions`;
  }
  
  return { messages: [{ role: 'user', content: { type: 'text', text: promptText } }] };
}

// Start server
async function main() {
  console.log('🤖 Asterdex AI Trading MCP HTTP Server');
  console.log('📊 Connecting to Aster Dex API...');
  
  try {
    await apiClient.ping();
    const balance = await apiClient.getAccountBalance();
    console.log(`✅ Connected! Balance: ${balance.totalWalletBalance} USDT`);
  } catch (error: any) {
    console.error(`❌ Connection failed: ${error.message}`);
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MCP HTTP Server running on http://0.0.0.0:${PORT}`);
    console.log(`📍 Endpoints:`);
    console.log(`   - Health: GET  http://0.0.0.0:${PORT}/health`);
    console.log(`   - MCP:    POST http://0.0.0.0:${PORT}/mcp`);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
