# MCP Integration Guide for AI Agents

## Overview

Astroid now includes a **Model Context Protocol (MCP)** server that enables AI agents (Claude, GPT-4, DeepSeek, Grok, Qwen, etc.) to autonomously trade on Aster Dex using real-time market data and decision-making loops.

## What is MCP?

MCP (Model Context Protocol) is an open standard that connects AI assistants to data sources and tools. It allows AI agents to:
- Access real-time market data from Aster Dex
- Execute trading operations (place/cancel orders, manage positions)
- Use pre-built prompts for market analysis and risk assessment
- Make autonomous trading decisions

## Available Interfaces

### 1. **Stdio Server** (for Claude Desktop, local AI agents)
- Uses stdin/stdout communication
- Perfect for Claude Desktop integration
- Runs as a separate process

### 2. **HTTP Server** (for cloud-based AI agents)
- RESTful JSON-RPC API
- Easier to integrate with cloud AI services
- Accessible over network

---

## Quick Start

### Option 1: Stdio Server (Claude Desktop)

**1. Build the MCP server:**
```bash
npm run build:mcp
```

**2. Configure Claude Desktop:**

Edit your Claude Desktop config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this configuration:
```json
{
  "mcpServers": {
    "asterdex-trading": {
      "command": "node",
      "args": ["/absolute/path/to/astroid/build/mcp-server.js"],
      "env": {
        "ASTERDEX_API_KEY": "your_api_key_here",
        "ASTERDEX_API_SECRET": "your_api_secret_here"
      }
    }
  }
}
```

**3. Restart Claude Desktop**

Claude will now have access to all Aster Dex trading tools!

---

### Option 2: HTTP Server (Cloud AI Agents)

**1. Start the HTTP MCP server:**
```bash
npm run mcp:http
```

The server will start on `http://0.0.0.0:3001` by default.

**2. Test the connection:**
```bash
curl http://localhost:3001/health
```

**3. Make MCP requests:**
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

---

## MCP Capabilities

### 🛠️ **Tools** (15 trading operations)

| Tool | Description |
|------|-------------|
| `get_account_balance` | Get current USDT balance and margin |
| `get_market_price` | Get mark price for a symbol |
| `get_orderbook` | Get bid/ask orderbook depth |
| `get_open_positions` | Get all open positions with P&L |
| `get_open_orders` | Get all active orders |
| `place_market_order` | Execute market order immediately |
| `place_limit_order` | Place limit order at specific price |
| `cancel_order` | Cancel a specific order |
| `cancel_all_orders` | Cancel all orders for a symbol |
| `close_position` | Close position with market order |
| `set_leverage` | Set leverage (1-125x) |
| `place_stop_loss` | Place stop-loss protection |
| `place_take_profit` | Place take-profit order |
| `get_24hr_ticker` | Get 24h price statistics |
| `get_funding_rate` | Get current funding rate |

### 📊 **Resources** (real-time market data)

| Resource | URI | Description |
|----------|-----|-------------|
| Account Balance | `market://account/balance` | Balance and margin info |
| Open Positions | `market://positions/all` | All positions with metrics |
| Open Orders | `market://orders/all` | All active orders |

### 💡 **Prompts** (AI decision templates)

| Prompt | Description |
|--------|-------------|
| `market_analysis` | Analyze market conditions and identify opportunities |
| `risk_assessment` | Assess portfolio risk and suggest improvements |
| `position_management` | Evaluate positions and recommend actions |
| `trend_following_strategy` | Generate trend-following strategy |
| `mean_reversion_strategy` | Generate mean-reversion strategy |

---

## Example Usage with Claude

Once configured, you can ask Claude:

> "Analyze the BTCUSDT market and suggest a trade"

Claude will:
1. Use `get_market_price`, `get_24hr_ticker`, `get_orderbook`
2. Apply the `market_analysis` prompt
3. Make a recommendation
4. Optionally execute using `place_limit_order`

> "What's my current risk exposure?"

Claude will:
1. Read `market://account/balance` and `market://positions/all`
2. Apply the `risk_assessment` prompt
3. Provide risk analysis and recommendations

> "Close my ETHUSDT position and take profit"

Claude will:
1. Use `get_open_positions` to find the position
2. Execute `close_position` for ETHUSDT
3. Confirm the closure

---

## AI Agent Decision Loop Example

Here's how an AI agent might use the MCP server for autonomous trading:

```
1. MARKET ANALYSIS LOOP (every 60 seconds)
   ├─ get_24hr_ticker(BTCUSDT)
   ├─ get_orderbook(BTCUSDT)
   ├─ get_funding_rate(BTCUSDT)
   ├─ Apply market_analysis prompt
   └─ Identify: trend=bullish, entry=$65,000, stop=$63,500, target=$68,000

2. POSITION SIZING
   ├─ get_account_balance()
   ├─ Calculate risk: 2% of balance
   └─ Size position: 0.05 BTC with 5x leverage

3. ENTRY EXECUTION
   ├─ set_leverage(BTCUSDT, 5)
   ├─ place_limit_order(symbol=BTCUSDT, side=BUY, price=65000, quantity=0.05)
   └─ Wait for fill confirmation

4. RISK MANAGEMENT
   ├─ place_stop_loss(BTCUSDT, side=SELL, stopPrice=63500, quantity=0.05)
   ├─ place_take_profit(BTCUSDT, side=SELL, stopPrice=68000, quantity=0.05)
   └─ Monitor position

5. MONITORING LOOP (every 30 seconds)
   ├─ get_open_positions()
   ├─ Check unrealized P&L
   ├─ Apply position_management prompt
   └─ Adjust TP/SL if needed

6. EXIT CONDITIONS
   ├─ Stop-loss hit → Position closed automatically
   ├─ Take-profit hit → Position closed automatically
   └─ Manual decision → Use close_position()
```

---

## Integration with OpenAI Agents SDK

```python
from agents import Agent, Runner
from agents.mcp import MCPServerStreamableHttp

async with MCPServerStreamableHttp(
    name="Asterdex Trading",
    params={
        "url": "http://localhost:3001/mcp",
        "timeout": 30
    }
) as mcp_server:
    agent = Agent(
        name="Trading Agent",
        instructions="""You are an expert cryptocurrency trader.
        Use the Asterdex MCP tools to:
        1. Analyze market conditions
        2. Identify high-probability trades
        3. Execute trades with proper risk management
        4. Monitor and adjust positions
        
        Always use stop-losses and take-profits.
        Risk no more than 2% per trade.
        """,
        mcp_servers=[mcp_server]
    )
    
    result = await Runner.run(
        agent,
        "Analyze BTCUSDT and suggest a trade if opportunity exists"
    )
```

---

## Security Considerations

⚠️ **Important Security Notes:**

1. **API Keys**: Never expose API keys in client-side code
2. **Approval Flows**: For production, implement human-in-the-loop approval
3. **Rate Limits**: MCP server respects Aster Dex rate limits automatically
4. **Position Limits**: Set maximum position size limits in your AI agent logic
5. **Testing**: Always test with small amounts first

### Recommended Safety Guards

```javascript
// In your AI agent logic:
const MAX_POSITION_SIZE = 0.1;  // BTC
const MAX_LEVERAGE = 10;
const MAX_RISK_PER_TRADE = 0.02;  // 2% of balance

// Validate before executing
if (quantity > MAX_POSITION_SIZE) {
  throw new Error("Position size exceeds limit");
}
```

---

## Troubleshooting

### Server won't start
```bash
# Check API credentials
echo $ASTERDEX_API_KEY
echo $ASTERDEX_API_SECRET

# Test connection manually
npm run test:api
```

### Claude Desktop can't connect
1. Check absolute path in config (no `~`, use full path)
2. Verify `build/mcp-server.js` exists
3. Check Claude Desktop logs: `~/Library/Logs/Claude/`
4. Restart Claude Desktop completely

### HTTP server connection issues
```bash
# Check if port is in use
lsof -i :3001

# Test health endpoint
curl http://localhost:3001/health
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ASTERDEX_API_KEY` | ✅ Yes | - | Your Aster Dex API key |
| `ASTERDEX_API_SECRET` | ✅ Yes | - | Your Aster Dex API secret |
| `MCP_PORT` | No | 3001 | HTTP server port |

---

## Advanced Usage

### Custom Prompts

You can extend the MCP server with custom trading strategies:

```typescript
// Add to server/mcp-server.ts
prompts.push({
  name: 'scalping_strategy',
  description: 'Generate a scalping strategy for quick profits',
  arguments: [
    { name: 'symbol', required: true },
    { name: 'targetProfit', required: false }
  ]
});
```

### Backtesting

Use the MCP tools to simulate trades:

```
1. Fetch historical data (use get_24hr_ticker across time)
2. Apply your strategy prompts
3. Simulate order execution
4. Calculate hypothetical P&L
```

---

## Resources

- **MCP Official Docs**: https://modelcontextprotocol.info
- **Aster Dex API Docs**: https://fapi.asterdex.com/docs
- **Claude Desktop**: https://claude.ai/download
- **OpenAI Agents SDK**: https://github.com/openai/openai-agents-python

---

## Support

For issues or questions:
1. Check server logs: `npm run mcp:stdio` or `npm run mcp:http`
2. Verify API credentials in `.env`
3. Test individual tools using the health endpoint
4. Review Aster Dex API rate limits

**Happy AI-powered trading! 🤖📈**
