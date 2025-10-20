# Asterdex Volume Generator Bot

A fully functional, feature-complete trading bot for the Asterdex cryptocurrency exchange with real-time monitoring dashboard and **100% API utilization**.

## Features

- ✅ **100% Asterdex API Coverage** - 60+ endpoints for complete market control
- 🤖 **Multi-Bot Support** - Run multiple bots simultaneously on different pairs
- 📊 **Real-Time Dashboard** - Terminal-inspired monochrome design
- 🔄 **WebSocket Integration** - Instant order and position updates
- 📈 **Advanced Trading** - Batch orders, stop-loss, take-profit, trailing stops
- ⚡ **Market Intelligence** - Mark price, funding rates, 24hr ticker, order book
- 🛡️ **Risk Management** - ADL quantile, position risk, leverage monitoring
- 📉 **Performance Analytics** - Trade history, income tracking, commission rates
- 🎯 **Dynamic Markets** - Auto-fetched from exchange (cached for 5 min)
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
SESSION_SECRET=your-secret-here

# Database (optional - uses in-memory by default)
DATABASE_URL=postgresql://user:pass@localhost:5432/asterdex
```

### Bot Configuration

Bot-specific settings (API keys, trading pairs, strategies) are configured through the web dashboard when creating each bot.

## Usage

### Access the Dashboard

Open your browser and navigate to:
- Docker: `http://localhost:5000`
- Replit: Click the preview URL

### Create a Bot

1. Click "New Bot" button
2. Enter your Asterdex API credentials
3. Select market pair from the dropdown (auto-populated from exchange)
4. Configure trading parameters:
   - Leverage (1-125x based on market)
   - Investment amount
   - Target volume
   - Max loss limit
   - Spread and order configuration
5. Click "Create Bot"

### Monitor Performance

The dashboard displays:
- Real-time trading metrics
- Active orders
- P&L tracking
- Hourly volume charts
- Activity feed with all bot events
- Risk indicators (ADL quantile warnings)

### Available Markets

Markets are automatically fetched from Asterdex exchange info endpoint and refreshed every 5 minutes. Each market displays:
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
- Complete Asterdex API client (60+ methods)
- User data stream manager for WebSocket
- Exchange info caching system (5-min refresh)

### Frontend
- React + TypeScript
- TanStack Query for state management
- Shadcn/ui + Radix UI components
- Terminal-inspired monochrome design
- Real-time WebSocket updates

## API Integration

The bot utilizes 100% of the Asterdex API:

**Market Data**: Mark price, funding rates, ticker, order book, klines, trades, exchange info

**Trading**: Batch orders, stop/take-profit, trailing stops, auto-cancel

**Account**: Balance, positions, leverage, margin management

**Risk**: ADL quantile, position risk, leverage brackets, force orders

**Analytics**: Trade history, income tracking, commission rates

**WebSocket**: Real-time order updates, position changes, margin calls

## Security

- API credentials stored securely per bot
- HMAC SHA256 request signing
- Session management with secure cookies
- Environment variable configuration
- Rate limit protection

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
- `server/asterdex-client.ts` - Complete Asterdex API client (60+ methods)
- `server/user-data-stream.ts` - WebSocket user data stream manager
- `server/bot-engine.ts` - Core trading bot logic
- `client/src/components/BotSelector.tsx` - Dynamic market selector

## License

MIT

## Support

For issues and questions:
- Check the troubleshooting section
- Review logs with `docker-compose logs -f`
- Consult Asterdex API documentation

## Credits

Built with modern web technologies and 100% Asterdex API integration.
