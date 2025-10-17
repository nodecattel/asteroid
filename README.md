# Asterdex Volume Generator Bot 🤖

A sophisticated volume generation bot for Asterdex with real-time monitoring dashboard. Features a sleek monochrome terminal aesthetic and supports running multiple market pairs simultaneously per account.

## 🎯 Features

- **Multi-Market Support**: Run multiple bot instances simultaneously, one per market pair
- **Real-Time Dashboard**: Monitor all your bots with live updates via WebSocket
- **Terminal Aesthetic**: Sleek monochrome design with JetBrains Mono font
- **Rate Limit Protection**: Smart request queuing and backoff to avoid API bans
- **HMAC SHA256 Authentication**: Secure API signing following Asterdex best practices
- **Volume Tracking**: Real-time volume charts and hourly progress monitoring
- **Activity Feed**: Live feed of all bot actions and order fills

## 🚀 Quick Start

### 1. Clone and Install

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your Asterdex API credentials:

```bash
cp .env.example .env
```

**Important**: Get your API credentials from [Asterdex API Settings](https://asterdex.com/settings/api)

### 3. Start the Application

```bash
npm run dev
```

The dashboard will be available at the URL shown in the console.

## 📊 Dashboard Overview

### Status Bar
- Total volume across all bots
- Total trades count
- Cumulative P&L
- Active bots count

### Bot Management
- Create new bot instances for different market pairs
- Start/Stop/Pause individual bots
- Monitor each bot's performance independently

### Real-Time Metrics
- **Volume Chart**: Hourly volume vs targets
- **Orders Table**: Live order book with fill tracking
- **Activity Feed**: Real-time bot actions and events

## 🔧 Configuration

### Bot Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `MARKET_SYMBOL` | Trading pair | `ETHUSDT` |
| `LEVERAGE` | Position leverage | `10` |
| `INVESTMENT_USDT` | Capital per bot | `10` |
| `TARGET_VOLUME` | 24h volume target | `100000` |
| `SPREAD_BPS` | Order spread (basis points) | `2` |
| `ORDERS_PER_SIDE` | Orders per side | `10` |
| `REFRESH_INTERVAL` | Order refresh rate (seconds) | `2.0` |

### Rate Limit Settings

| Parameter | Description | Default |
|-----------|-------------|---------|
| `DELAY_BETWEEN_ORDERS` | Delay between orders (sec) | `0.05` |
| `DELAY_AFTER_CANCEL` | Delay after cancel (sec) | `0.3` |
| `MAX_ORDERS_TO_PLACE` | Max orders per refresh | `10` |

### Available Markets

- BTCUSDT
- ETHUSDT
- SOLUSDT
- DOGEUSDT
- HYPEUSDT
- ASTERUSDT
- WLDUSDT
- XPLUSDT
- LINKUSDT
- AVAXUSDT

## 🏗️ Architecture

### Backend
- **Asterdex Client**: HMAC SHA256 signing, rate limit tracking
- **Bot Engine**: Order management, spread calculations, position tracking
- **Bot Manager**: Multi-instance coordination with shared rate limits
- **WebSocket Server**: Real-time updates to dashboard

### Frontend
- **React + Wouter**: Modern routing and state management
- **TanStack Query**: Efficient data fetching and caching
- **Socket.io Client**: Real-time WebSocket communication
- **Recharts**: Volume visualization

## 📡 API Endpoints

### Bot Management
- `GET /api/markets` - Get available markets
- `GET /api/bots` - List all bot instances
- `POST /api/bots` - Create new bot
- `POST /api/bots/:id/start` - Start bot
- `POST /api/bots/:id/pause` - Pause bot
- `POST /api/bots/:id/stop` - Stop bot
- `DELETE /api/bots/:id` - Delete bot

### Bot Data
- `GET /api/bots/:id` - Get bot details
- `GET /api/bots/:id/orders` - Get bot orders
- `GET /api/bots/:id/logs` - Get activity logs
- `GET /api/bots/:id/volume` - Get hourly volume

## 🎨 Design System

### Colors
- Background: `#0a0a0a` (Near black)
- Terminal Green: `#8BC34A`
- Text: `#d4d4d4`
- Borders: `#262626`

### Typography
- Font: JetBrains Mono
- Monospace aesthetic throughout

## ⚠️ Important Notes

### Rate Limits
- Request Weight: 2400/minute
- Orders: 1200/minute
- Rate limits are **per IP**, shared across all bots
- The system automatically backs off at 80% capacity

### Multi-Pair Trading
- ✅ Run multiple market pairs simultaneously
- ✅ Each market gets its own bot instance
- ✅ Shared rate limit coordination
- ⚠️ Cannot run multiple bots on same market pair

### Safety Features
- Automatic order cancellation on stop
- IP ban detection and prevention
- HMAC signature validation
- Post-only orders option (GTX)

## 🐛 Debugging

Check workflow logs for bot activity:
```bash
# Logs available in Replit workspace panel
```

Enable verbose logging by setting log level in bot-engine.ts

## 📝 License

MIT

## 🔗 Resources

- [Asterdex API Documentation](https://github.com/asterdex/api-docs)
- [Replit Deployment Guide](https://docs.replit.com)
