# Astroid

A fully functional, feature-complete trading platform for Aster Dex cryptocurrency exchange with **traditional volume bots** and **AI-powered autonomous trading agents**. Features real-time monitoring dashboard, mobile-responsive design, and 100% API utilization.

## Features

### Core Trading Platform
- ✅ **100% Aster Dex API Coverage** - 60+ endpoints for complete market control
- 🤖 **Multi-Bot Support** - Run multiple traditional bots simultaneously on different pairs
- 📊 **Real-Time Dashboard** - Terminal-inspired monochrome design, mobile-optimized
- 🔄 **WebSocket Integration** - Instant order and position updates
- 📈 **Advanced Trading** - Batch orders, stop-loss, take-profit, trailing stops
- ⚡ **Market Intelligence** - Mark price, funding rates, 24hr ticker, order book
- 🛡️ **Risk Management** - ADL quantile, position risk, leverage monitoring
- 📉 **Performance Analytics** - Trade history, income tracking, commission rates
- 🎯 **Dynamic Markets** - Auto-fetched from exchange (cached for 5 min)
- 🔐 **Password Authentication** - Dashboard protected with configurable password
- 🐳 **Docker Support** - Easy deployment with Docker Compose
- 🪐 **Setup Wizard** - asteroid.sh for streamlined first-time setup

### AI Agent Trading Platform (NEW)
- 🧠 **Autonomous AI Trading Agents** - Create AI-powered trading agents with multiple model support
- 🎯 **Dual Target System** - Set both USDT-based and percentage-based profit/loss targets
- 📊 **Automatic Position Management** - Agents automatically close positions when targets are met
- 🔍 **Multi-Model Support** - Claude (Anthropic), GPT-4 (OpenAI), DeepSeek, Grok (xAI), Qwen (Alibaba)
- ⚙️ **Simplified Configuration** - Focus on investment goals, not technical parameters
- 📈 **Real-Time Performance Tracking** - Balance, P&L, win rate, Sharpe ratio
- 🔄 **Agent Monitoring System** - Background monitoring checks targets every 30 seconds
- 🎨 **Intuitive UI** - Multi-select market selector, dynamic model detection
- 🔑 **Optional API Key Override** - Per-agent API key configuration
- 🌐 **MCP Protocol Ready** - Model Context Protocol integration for autonomous trading

## Quick Start with Docker

### Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)

### Method 1: Automated Setup (Recommended)

The easiest way to get started is using the `asteroid.sh` setup wizard:

```bash
# Make the script executable
chmod +x asteroid.sh

# Run the setup wizard
./asteroid.sh
```

The wizard will:
- ✓ Check that Docker and Docker Compose are installed
- ✓ Guide you through configuration (API keys, password, database choice)
- ✓ Optionally configure AI provider API keys for autonomous trading agents
- ✓ Generate a secure `.env` file with all required settings
- ✓ Build and start the Docker containers
- ✓ Verify that everything is running correctly

**What you'll need:**
- A strong password for dashboard access
- Aster Dex API credentials ([Get them here](https://www.asterdex.com/en/api-management))
- (Optional) AI provider API keys for autonomous agents (Anthropic, OpenAI, DeepSeek, xAI, Qwen)
- Choice of database: in-memory (no persistence) or PostgreSQL (persistent storage)

### Method 2: Manual Docker Setup

If you prefer manual setup or want more control:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env with your settings
nano .env

# 3. (Optional) Enable PostgreSQL for persistent storage
#    Uncomment the postgres service in docker-compose.yml

# 4. Build and start all services
docker-compose up -d

# 5. View logs to confirm everything is working
docker-compose logs -f asterdex-bot

# 6. Access dashboard at http://localhost:5000
```

### Environment Variables Reference

Your `.env` file must include:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | No | Application port | `5000` (default) |
| `SESSION_SECRET` | Yes | Session encryption key | Generate with `openssl rand -hex 32` |
| `BOT_PASSWORD` | Yes | Dashboard login password | Your secure password |
| `ASTERDEX_API_KEY` | Yes | Aster Dex API key | From your Aster Dex account |
| `ASTERDEX_API_SECRET` | Yes | Aster Dex API secret | From your Aster Dex account |
| `DATABASE_URL` | No | PostgreSQL connection string | `postgresql://asterdex:pass@postgres:5432/asterdex` |
| `POSTGRES_PASSWORD` | No* | PostgreSQL password | Auto-generated or custom |
| `POSTGRES_PORT` | No | PostgreSQL external port | `5432` (default) |
| **AI Provider API Keys** | **Optional** | **For AI Trading Agents** | |
| `ANTHROPIC_API_KEY` | No | Claude models API key | From console.anthropic.com |
| `OPENAI_API_KEY` | No | GPT-4 models API key | From platform.openai.com |
| `DEEPSEEK_API_KEY` | No | DeepSeek models API key | From platform.deepseek.com |
| `XAI_API_KEY` | No | Grok models API key | From x.ai |
| `QWEN_API_KEY` | No | Qwen models API key | From dashscope.aliyun.com |
| `MCP_PORT` | No | MCP server port | `3001` (default) |

*Required only if using PostgreSQL

### Using PostgreSQL for Persistent Storage

Astroid now uses PostgreSQL by default in Docker deployments for data persistence. The database service is automatically started with the application.

**Database Configuration** (already in docker-compose.yml):
- PostgreSQL 15 Alpine image for minimal footprint
- Automatic health checks to ensure database is ready
- Persistent volume storage at `postgres-data`
- Default credentials: `asterdex` user with password from `.env`

**To customize PostgreSQL settings**, update your `.env` file:
```env
DATABASE_URL=postgresql://asterdex:your_password@postgres:5432/asterdex
POSTGRES_PASSWORD=your_password
POSTGRES_PORT=5432  # External port (change if 5432 is already in use)
```

**Note:** If you previously used in-memory storage and uncommented the postgres service manually, the latest `docker-compose.yml` already has PostgreSQL enabled by default.

### Port Configuration

**Changing the application port:**
```env
# In .env file
PORT=8080
```

Then restart: `docker-compose restart asterdex-bot`

**Changing PostgreSQL port:**
```env
# In .env file
POSTGRES_PORT=5433
```

This only affects external access to PostgreSQL. Internal communication between containers uses the default port 5432.

## Quick Start on Replit

1. Open in Replit
2. Set up your environment variables in Secrets:
   - `BOT_PASSWORD` - Your dashboard password
   - `ASTERDEX_API_KEY` - Get from https://www.asterdex.com/en/api-management
   - `ASTERDEX_API_SECRET` - Get from https://www.asterdex.com/en/api-management
   - `SESSION_SECRET` - Generate with `openssl rand -hex 32`
   - (Optional) AI provider API keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.
3. Click "Run" button
4. The application will start automatically
5. Access the dashboard in the browser pane

## Usage

### Access the Dashboard

1. Open your browser and navigate to:
   - Docker: `http://localhost:5000`
   - Replit: Click the preview URL

2. **Login** with the password you set in `BOT_PASSWORD` environment variable

3. You'll be redirected to the dashboard where you can manage your bots and AI agents

### Traditional Volume Bots

#### Create a Bot

1. Click "New Bot" button in the Bots tab
2. Select market pair from the dropdown (auto-populated from Aster Dex exchange)
3. Configure trading parameters:
   - Leverage (1-300x based on market limits)
   - Investment amount (total margin budget)
   - Target volume and duration
   - Max loss limit
   - Spread and order configuration
   - Risk management (stop-loss, take-profit, trailing stops)
   - Trading bias (neutral, long, or short)
4. Click "Create Bot"

Astroid will automatically start trading immediately after creation.

#### Monitor Performance

The dashboard displays:
- Real-time trading metrics
- Active orders
- P&L tracking
- Hourly volume charts
- Activity feed with all bot events
- Risk indicators (ADL quantile warnings)

### AI Trading Agents

#### Create an AI Agent

1. Navigate to the "AI Agents" tab
2. Click "Create Agent" button
3. Configure agent parameters:
   - **Name**: Descriptive name for your agent
   - **AI Model**: Choose from available models (Claude, GPT-4, DeepSeek, Grok, Qwen)
   - **Markets**: Select one or more trading pairs via checkbox interface
   - **Starting Capital**: Initial USDT balance for the agent
   - **Max Position Size**: Maximum USDT per individual position
   - **Profit Targets**: Set BOTH USDT amount AND percentage goals
     - Example: `$500 USDT OR 25%` - whichever is reached first
   - **Loss Limits**: Set BOTH USDT amount AND percentage limits
     - Example: `-$200 USDT OR -10%` - whichever is reached first
   - (Optional) **Custom API Key**: Override default AI provider key
4. Click "Create Agent"

The agent will start trading autonomously using AI decision-making.

#### How AI Agents Work

- **Autonomous Decision Making**: AI analyzes market conditions and makes trading decisions
- **Dual Target System**: Monitors both USDT and percentage-based profit/loss targets
- **Automatic Position Closure**: When either target is met, all positions are closed via market orders
- **Agent Monitoring**: Background system checks every 30 seconds
- **Real-Time Updates**: Performance metrics update in real-time via WebSocket

#### Monitor AI Agent Performance

The AI Agents dashboard displays:
- Current balance and P&L (USDT and percentage)
- Win rate and Sharpe ratio
- Trade history with AI reasoning/commentary
- Active positions
- Progress toward profit/loss targets
- Balance history charts showing performance over time

### Available Markets

Markets are automatically fetched from Aster Dex exchange info endpoint and refreshed every 5 minutes. Each market displays:
- Trading pair symbol with crypto icon
- Maximum leverage available
- 24-hour price change and volume
- Price and quantity precision

The market selector includes:
- **Favorites Tab**: Quick access to frequently traded pairs
- **All Markets Tab**: Complete list of available markets
- **Search**: Filter markets by symbol
- **Multi-field Sorting**: Sort by volume, price change, or symbol

## Docker Management Commands

### Basic Commands

```bash
# Start all services in background
docker-compose up -d

# View logs (follow mode)
docker-compose logs -f

# View logs for specific service
docker-compose logs -f asterdex-bot
docker-compose logs -f postgres

# Stop services (keeps containers)
docker-compose stop

# Start stopped services
docker-compose start

# Restart services
docker-compose restart

# Restart specific service
docker-compose restart asterdex-bot
```

### Maintenance Commands

```bash
# Rebuild images (after code changes)
docker-compose build --no-cache

# Remove all containers (keeps volumes/data)
docker-compose down

# Remove everything including data
docker-compose down -v

# View running containers
docker-compose ps

# Execute command in running container
docker-compose exec asterdex-bot sh

# View resource usage
docker stats asterdex-volume-bot
```

### Database Management

```bash
# Access PostgreSQL CLI
docker-compose exec postgres psql -U asterdex -d asterdex

# Backup database
docker-compose exec postgres pg_dump -U asterdex asterdex > backup.sql

# Restore database
docker-compose exec -T postgres psql -U asterdex -d asterdex < backup.sql

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
```

## Architecture

### Backend
- Node.js + Express
- WebSocket (Socket.IO) for real-time updates
- In-memory or PostgreSQL storage
- Complete Aster Dex API client (60+ methods)
- User data stream manager for WebSocket
- Exchange info caching system (5-min refresh)
- AI agent monitoring system (30-second checks)
- MCP server for autonomous AI trading

### Frontend
- React + TypeScript
- TanStack Query for state management
- Shadcn/ui + Radix UI components
- Terminal-inspired monochrome design
- Real-time WebSocket updates
- Mobile-responsive interface
- Unified dashboard for bots and AI agents

## API Integration

Astroid utilizes 100% of the Aster Dex API:

**Market Data**: Mark price, funding rates, ticker, order book, klines, trades, exchange info

**Trading**: Batch orders, stop/take-profit, trailing stops, auto-cancel

**Account**: Balance, positions, leverage, margin management

**Risk**: ADL quantile, position risk, leverage brackets, force orders

**Analytics**: Trade history, income tracking, commission rates

**WebSocket**: Real-time order updates, position changes, margin calls

## AI Agent Features

### Dual Target System
Set both USDT-based and percentage-based profit/loss targets. The agent automatically stops when **either** target is reached:
- **Profit**: `targetProfitUsdt` OR `targetProfitPercent` (whichever comes first)
- **Loss**: `maxLossUsdt` OR `maxLossPercent` (whichever comes first)

### Agent Monitoring
Background `AgentMonitor` service:
- Checks all running agents every 30 seconds
- Compares current balance against starting capital
- Calculates both USDT and percentage P&L
- Automatically closes all positions when targets are met
- Stops the agent and broadcasts updates via WebSocket

### Supported AI Models
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- **OpenAI**: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- **DeepSeek**: DeepSeek Chat, DeepSeek Coder
- **xAI**: Grok
- **Alibaba**: Qwen models

Model availability depends on configured API keys in your `.env` file.

### Simplified Configuration
Unlike traditional bots, AI agents require minimal configuration:
- **Investment Goals**: Starting capital, position size, profit/loss targets
- **No Technical Parameters**: AI handles leverage, stop-loss, take-profit, decision timing automatically
- **Focus on Outcomes**: Tell the AI what you want to achieve, not how to trade

## Security

- **Password Authentication**: Dashboard protected with `BOT_PASSWORD` environment variable
- **Centralized API Credentials**: All bots use shared `ASTERDEX_API_KEY` and `ASTERDEX_API_SECRET` from environment variables
- **Per-Agent API Keys**: Optional custom AI provider keys per agent
- **No Data Leakage**: API credentials never stored in database or exposed in UI
- **HMAC SHA256**: All Aster Dex API requests are cryptographically signed
- **Session Management**: Secure HttpOnly cookies prevent XSS attacks
- **Rate Limit Protection**: Automatic request throttling and backoff
- **HTTPS**: Automatic when deployed on Replit (published apps)

## Troubleshooting

### "tsx: not found" error in Docker logs
If you see errors like `sh: tsx: not found` when running `docker-compose logs -f`:

**This has been fixed in the latest version!** To resolve:

```bash
# Stop and remove existing containers and images
docker-compose down
docker rmi astroid-asterdex-bot 2>/dev/null || true

# Rebuild with the fixed Dockerfile (uses multi-stage build)
docker-compose build --no-cache

# Start the services
docker-compose up -d

# Verify it's working
docker-compose logs -f asterdex-bot
```

**What was fixed:** The Dockerfile now uses a multi-stage build that properly installs all dependencies (including build tools like tsx), builds the TypeScript application, then creates a lean production image with only the compiled code and runtime dependencies.

### Services won't start
```bash
# Check Docker is running
docker ps

# View detailed logs
docker-compose logs

# Rebuild images
docker-compose build --no-cache
```

### Can't access dashboard
```bash
# Check if port is in use
netstat -an | grep 5000

# Change port in .env file
PORT=8080
docker-compose restart
```

### Database connection issues
```bash
# Check PostgreSQL is running
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d
```

### AI agents not available
```bash
# Check if AI provider API keys are configured
grep "ANTHROPIC_API_KEY\|OPENAI_API_KEY" .env

# Verify API keys are valid by checking logs
docker-compose logs -f asterdex-bot | grep "available-models"

# Add API keys to .env file and restart
docker-compose restart
```

## Development

### Running Locally (without Docker)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Building

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Configuration Reference

### Traditional Bot Parameters
- **Market Symbol**: Trading pair (e.g., BTCUSDT, ETHUSDT)
- **Leverage**: 1x to 300x (depending on market limits)
- **Margin**: Your capital at risk (USDT)
- **Target Volume**: Trading volume goal over target timeframe
- **First Order Spread**: Distance from current price to first buy/sell order (in basis points)
- **Order Spacing**: Spacing between subsequent orders (in basis points)
- **Cycle Time**: Trading loop frequency (1-300 seconds, default 5s)
- **Risk Management**: Stop-loss, take-profit percentages
- **Trading Bias**: Neutral (50/50), Long (more buy orders), or Short (more sell orders)

### AI Agent Parameters
- **Name**: Descriptive identifier
- **AI Model**: Claude, GPT-4, DeepSeek, Grok, or Qwen
- **Markets**: One or more trading pairs
- **Starting Capital**: Initial USDT balance
- **Max Position Size**: Maximum USDT per position
- **Target Profit (USDT)**: USDT profit goal
- **Target Profit (%)**: Percentage profit goal
- **Max Loss (USDT)**: Maximum acceptable USDT loss
- **Max Loss (%)**: Maximum acceptable percentage loss
- **Custom API Key**: (Optional) Override default AI provider key

## Files Overview

- `asteroid.sh` - Interactive setup wizard for first-time users
- `docker-compose.yml` - Docker Compose configuration
- `Dockerfile` - Docker image definition
- `.dockerignore` - Files to exclude from Docker build
- `.env.example` - Environment variable template with AI provider keys
- `server/exchange-info-cache.ts` - Exchange info caching with 5-min refresh
- `server/asterdex-client.ts` - Complete Aster Dex API client (60+ methods)
- `server/user-data-stream.ts` - WebSocket user data stream manager
- `server/bot-engine.ts` - Core trading bot logic
- `server/agent-monitor.ts` - AI agent monitoring with dual target system
- `client/src/pages/Dashboard.tsx` - Unified dashboard for bots and agents
- `client/src/pages/agents.tsx` - AI agent management interface
- `client/src/components/MarketPairs.tsx` - Dynamic market selector with favorites
- `client/src/components/UnifiedBotCreation.tsx` - Mobile-responsive bot/agent creation dialog
- `client/src/components/BalanceChart.tsx` - Balance history visualization

## License

MIT

## Support

For issues and questions:
- Check the troubleshooting section
- Review logs with `docker-compose logs -f`
- Consult Aster Dex API documentation at https://asterdex.com
- AI Agent documentation: [Model Context Protocol](https://modelcontextprotocol.io)

## Credits

**Astroid** - Built with modern web technologies, 100% Aster Dex API integration, and autonomous AI trading capabilities by NodeCattel.
