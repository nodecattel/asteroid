# Astroid

A fully functional, feature-complete trading bot for Aster Dex cryptocurrency exchange with real-time monitoring dashboard and **100% API utilization**.

## Features

- ✅ **100% Aster Dex API Coverage** - 60+ endpoints for complete market control
- 🤖 **Multi-Bot Support** - Run multiple bots simultaneously on different pairs
- 📊 **Real-Time Dashboard** - Terminal-inspired monochrome design
- 🔄 **WebSocket Integration** - Instant order and position updates
- 📈 **Advanced Trading** - Batch orders, stop-loss, take-profit, trailing stops
- ⚡ **Market Intelligence** - Mark price, funding rates, 24hr ticker, order book
- 🛡️ **Risk Management** - ADL quantile, position risk, leverage monitoring
- 📉 **Performance Analytics** - Trade history, income tracking, commission rates
- 🎯 **Dynamic Markets** - Auto-fetched from exchange (cached for 5 min)
- 🔐 **Password Authentication** - Dashboard protected with configurable password
- 🐳 **Docker Support** - Easy deployment with Docker Compose
- 🪐 **Setup Wizard** - asteroid.sh for streamlined first-time setup

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
- ✓ Generate a secure `.env` file with all required settings
- ✓ Build and start the Docker containers
- ✓ Verify that everything is running correctly

**What you'll need:**
- A strong password for dashboard access
- Aster Dex API credentials ([Get them here](https://www.asterdex.com/en/api-management))
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

*Required only if using PostgreSQL

### Using PostgreSQL for Persistent Storage

By default, Astroid uses in-memory storage (data is lost on restart). To enable PostgreSQL:

**Option 1: During `asteroid.sh` setup**
- Select option 2 when asked about database type
- The wizard will automatically configure everything

**Option 2: Manual configuration**
1. Uncomment the `postgres` service in `docker-compose.yml`:
   ```bash
   sed -i 's/^  # postgres:/  postgres:/g; s/^  #   /    /g' docker-compose.yml
   ```

2. Update your `.env` file:
   ```env
   DATABASE_URL=postgresql://asterdex:your_password@postgres:5432/asterdex
   POSTGRES_PASSWORD=your_password
   POSTGRES_PORT=5432  # External port (change if 5432 is already in use)
   ```

3. Rebuild and restart:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

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
3. Click "Run" button
4. The application will start automatically
5. Access the dashboard in the browser pane

## Configuration

### Environment Variables

Create a `.env` file with the following:

```env
# Application Port
PORT=5000

# Session Secret (generate with: openssl rand -hex 32)
SESSION_SECRET=your-session-secret-here

# Bot Password Authentication (REQUIRED)
# This password protects access to the dashboard
BOT_PASSWORD=your-secure-password-here

# Aster Dex API Credentials (REQUIRED)
# Get your API keys from: https://www.asterdex.com/en/api-management
ASTERDEX_API_KEY=your-api-key-here
ASTERDEX_API_SECRET=your-api-secret-here

# Database (optional - uses in-memory by default)
DATABASE_URL=postgresql://user:pass@localhost:5432/asterdex
```

**Important**: 
- `BOT_PASSWORD` is required to access the dashboard - choose a strong password
- All bots share the same `ASTERDEX_API_KEY` and `ASTERDEX_API_SECRET` for security
- API credentials are stored in environment variables, not in the database or UI
- **Get your Aster Dex API keys from: https://www.asterdex.com/en/api-management**
  - Each account can create up to 30 API keys
  - Do not disclose your API Key to anyone to avoid asset losses
  - Enable permissions for futures trading when creating the API key

### Bot Configuration

Bot-specific settings (trading pairs, leverage, strategies) are configured through the web dashboard when creating each bot. API credentials are centrally managed via environment variables for enhanced security.

**Key Configuration Parameters:**
- **Market Symbol**: Trading pair (e.g., BTCUSDT, ETHUSDT)
- **Leverage**: 1x to 300x (depending on market limits)
- **Margin**: Your capital at risk (USDT)
- **Target Volume**: Trading volume goal over target timeframe
- **First Order Spread**: Distance from current price to first buy/sell order (in basis points)
- **Order Spacing**: Spacing between subsequent orders (in basis points)
- **Cycle Time**: Trading loop frequency (1-300 seconds, default 5s)
- **Risk Management**: Stop-loss, take-profit percentages
- **Trading Bias**: Neutral (50/50), Long (more buy orders), or Short (more sell orders)

## Usage

### Access the Dashboard

1. Open your browser and navigate to:
   - Docker: `http://localhost:5000`
   - Replit: Click the preview URL

2. **Login** with the password you set in `BOT_PASSWORD` environment variable

3. You'll be redirected to the dashboard where you can manage your bots

### Create a Bot

1. Click "New Bot" button
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

### Monitor Performance

The dashboard displays:
- Real-time trading metrics
- Active orders
- P&L tracking
- Hourly volume charts
- Activity feed with all bot events
- Risk indicators (ADL quantile warnings)

### Available Markets

Markets are automatically fetched from Aster Dex exchange info endpoint and refreshed every 5 minutes. Each market displays:
- Trading pair symbol
- Maximum leverage available
- Price and quantity precision

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

### Frontend
- React + TypeScript
- TanStack Query for state management
- Shadcn/ui + Radix UI components
- Terminal-inspired monochrome design
- Real-time WebSocket updates

## API Integration

Astroid utilizes 100% of the Aster Dex API:

**Market Data**: Mark price, funding rates, ticker, order book, klines, trades, exchange info

**Trading**: Batch orders, stop/take-profit, trailing stops, auto-cancel

**Account**: Balance, positions, leverage, margin management

**Risk**: ADL quantile, position risk, leverage brackets, force orders

**Analytics**: Trade history, income tracking, commission rates

**WebSocket**: Real-time order updates, position changes, margin calls

## Security

- **Password Authentication**: Dashboard protected with `BOT_PASSWORD` environment variable
- **Centralized API Credentials**: All bots use shared `ASTERDEX_API_KEY` and `ASTERDEX_API_SECRET` from environment variables
- **No Data Leakage**: API credentials never stored in database or exposed in UI
- **HMAC SHA256**: All Aster Dex API requests are cryptographically signed
- **Session Management**: Secure HttpOnly cookies prevent XSS attacks
- **Rate Limit Protection**: Automatic request throttling and backoff
- **HTTPS**: Automatic when deployed on Replit (published apps)

## Troubleshooting

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

## Files Overview

- `asteroid.sh` - Interactive setup wizard for first-time users
- `docker-compose.yml` - Docker Compose configuration
- `Dockerfile` - Docker image definition
- `.dockerignore` - Files to exclude from Docker build
- `server/exchange-info-cache.ts` - Exchange info caching with 5-min refresh
- `server/asterdex-client.ts` - Complete Aster Dex API client (60+ methods)
- `server/user-data-stream.ts` - WebSocket user data stream manager
- `server/bot-engine.ts` - Core trading bot logic
- `client/src/components/BotSelector.tsx` - Dynamic market selector

## License

MIT

## Support

For issues and questions:
- Check the troubleshooting section
- Review logs with `docker-compose logs -f`
- Consult Aster Dex API documentation at https://asterdex.com

## Credits

**Astroid** - Built with modern web technologies and 100% Aster Dex API integration by NodeCattel.
