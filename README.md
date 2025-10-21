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

- Docker
- Docker Compose

### Installation

1. Clone or download this repository
2. Run the setup wizard:

```bash
./asteroid.sh
```

The wizard will:
- Check prerequisites
- Configure environment variables
- Set up your chosen database (in-memory or PostgreSQL)
- Build and start the services
- Verify everything is running

### Manual Docker Setup

If you prefer manual setup:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env with your settings
nano .env

# 3. Build and start
docker-compose up -d

# 4. View logs
docker-compose logs -f
```

## Quick Start on Replit

1. Open in Replit
2. Click "Run" button
3. The application will start automatically
4. Access the dashboard in the browser pane

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
# Get these from: https://asterdex.com/settings/api
ASTERDEX_API_KEY=your-api-key-here
ASTERDEX_API_SECRET=your-api-secret-here

# Database (optional - uses in-memory by default)
DATABASE_URL=postgresql://user:pass@localhost:5432/asterdex
```

**Important**: 
- `BOT_PASSWORD` is required to access the dashboard - choose a strong password
- All bots share the same `ASTERDEX_API_KEY` and `ASTERDEX_API_SECRET` for security
- API credentials are stored in environment variables, not in the database or UI
- Get your Aster Dex API credentials from: https://asterdex.com/settings/api

### Bot Configuration

Bot-specific settings (trading pairs, leverage, strategies) are configured through the web dashboard when creating each bot. API credentials are centrally managed via environment variables for enhanced security.

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

## Docker Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose stop

# Restart services
docker-compose restart

# Remove everything
docker-compose down

# Remove with volumes (deletes data)
docker-compose down -v
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
