# Asterdex Volume Generator Bot

## Overview
The Asterdex Volume Generator Bot is a comprehensive trading application designed for the Asterdex cryptocurrency exchange. Its primary purpose is to generate trading volume through automated strategies, leveraging 100% of the Asterdex API. The system supports running multiple bot instances simultaneously, each managing a specific market pair. It features a real-time, terminal-inspired monochrome dashboard for monitoring bot activities, tracking key metrics, managing configurations, and accessing advanced market and performance data. The project aims to provide a robust, efficient, and user-friendly platform for automated volume generation, capable of dynamic market loading and Docker-based deployment.

## Recent Updates (October 21, 2025)
- ✅ **Dynamic Max Leverage from API**: Implemented real-time max leverage fetching from Asterdex `/fapi/v1/leverageBracket` endpoint. Each market now displays accurate leverage limits (e.g., BTCUSDT: 100x, COAIUSDT: 5x, HYPEUSDT: 300x). ExchangeInfoCache fetches leverage brackets on startup and caches for 5 minutes. Leverage input automatically caps to market-specific max when switching markets, preventing invalid configurations.
- ✅ **Mobile-Responsive Bot Dialogs**: Fixed Create and Edit bot dialogs to display perfectly on mobile screens without bleeding/cutoff. Dialog width now responsive (max-w-[95vw] on mobile, sm:max-w-3xl on tablet, lg:max-w-5xl on desktop). All grid layouts stack properly on mobile (grid-cols-1) and expand to 2-3 columns on larger screens using Tailwind breakpoints. Tested on iPhone 12 (390px) and iPad Air (820px) viewports.
- ✅ **Real-Time Market Data Display**: StatusBar now displays funding rate and max leverage for the selected bot. Funding rate shown with color coding (green for positive, red for negative) and updates in real-time from bot's market data. Max leverage badge shows market-specific limits.
- ✅ **Enhanced Bot Details API**: Updated `getBotDetails()` to include marketData (funding rate, mark price, next funding time) from running bots, providing real-time market information to the frontend.
- 🐛 **CRITICAL: Zero Quantity Fix**: Fixed bug where high-priced assets (BTC, ETH) produced zero-quantity orders due to insufficient notional. Now calculates minimum notional needed to produce valid quantity (≥ stepSize) and uses max(targetNotional, minNotional × 1.1, minQuantityNotional × 1.5) to ensure valid orders while respecting budget constraints.
- 🐛 **Enhanced Position Closing**: Updated `closeAllPositions()` to query actual account positions via Asterdex API, not just internally tracked positions. When a bot stops, it closes ALL positions for its specific market symbol (even from previous sessions), ensuring complete cleanup.
- ⚠️ **Budget Warning System**: Added validation to warn users when calculated order sizes exceed total budget. Shows message: "⚠️ Orders require X USDT margin but budget is Y USDT. Consider increasing investment or reducing orders/leverage."

## Previous Updates (October 20, 2025)
- ✅ **Account Information Panel**: Displays real-time wallet balance, available balance, unrealized PnL, and open positions
- ✅ **Secure Credentials**: All API credentials now managed via Replit secrets (ASTERDEX_API_KEY, ASTERDEX_API_SECRET)
- ✅ **Dynamic Max Leverage**: Badge displays market-specific leverage limits (e.g., "Max 125x") next to leverage input
- ✅ **Enhanced Risk Management**: Comprehensive section with TP/SL %, trailing stops, and circuit breakers
- ✅ **Trading Bias Configuration**: Allows setting buy/sell preference (Neutral 50/50, Long 70/30, Short 30/70)
- 🐛 **Critical Bug Fix**: Fixed bot selector data structure mismatch - bots are now correctly accessed as `bot.id`, `bot.marketSymbol`, `bot.status` (not `bot.instance.*`)
- ✅ **Auto-Start Feature**: Bots now automatically start trading immediately after creation (async background start prevents UI blocking)
- ✅ **Activity Feed Working**: Real-time trading activity displayed with WebSocket updates showing order placement, fills, and system events
- ✅ **Fast Response Time**: Bot creation dialog closes instantly (<100ms response) with background initialization
- 🐛 **Critical Order ID Fix**: Fixed "Client order id is not valid" error by generating compliant IDs (<36 chars, valid pattern)
- ✅ **Comprehensive Logging**: Added detailed server logs to track order placement, fills, position updates, and API responses
- ✅ **Real Order Placement**: Bots now successfully place actual orders on Asterdex exchange with proper validation
- 🐛 **Order Size Fix**: Changed default orderSizePercent from 0.1% to 25% for meaningful trade sizes
- ✅ **Mobile Responsiveness**: Complete mobile optimization with responsive grids, typography, and spacing
- ✅ **Footer Component**: Added NodeCattel branding (© 2025) with Asterdex referral link and GitHub link
- 🐛 **CRITICAL: Tick Size Validation Fix**: Resolved "Price not increased by tick size" errors by extracting and using exchange-specific filters (PRICE_FILTER tickSize, LOT_SIZE stepSize, MIN_NOTIONAL minNotional) for every market pair, ensuring all order prices/quantities meet exchange requirements
- ✅ **Bot Parameter Editing**: Running bots can now be edited via PATCH /api/bots/:botId/config endpoint - all parameters (investment, leverage, spread, TP/SL, trading bias, etc.) can be updated without stopping the bot
- 🐛 **CRITICAL: Stop-Loss/Take-Profit Fix**: Fixed broken TP/SL logic that prevented positions from closing when hitting loss thresholds. Both LONG and SHORT positions now correctly trigger stop-loss at configured loss % and take-profit at configured profit %. Positions automatically close and restart with new orders.
- ✅ **Auto-Close Positions on Stop**: When stopping a bot, all open positions are now automatically closed with market orders before canceling pending orders. This prevents lingering positions that could incur losses or funding fees.
- ✅ **Total Investment Budget Model**: Changed from leveraged capital approach to total investment budget. The `investmentUsdt` field now represents the total margin budget available. Order sizes are calculated to fit within this budget, accounting for leverage. Each order is guaranteed to meet exchange minimum notional requirements while staying within the allocated budget.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is built with React and TypeScript using Vite, featuring a custom terminal-inspired design. It utilizes `shadcn/ui` components with Radix UI primitives, adhering to a monochrome aesthetic with the JetBrains Mono font. Tailwind CSS is used for styling, with a custom color palette emphasizing dark mode and strategic accent colors (green for positive, red for negative). Key components include `StatusBar`, `MetricCard`, `OrdersTable`, `ActivityFeed`, `VolumeChart`, `BotSelector`, and `ConfigPanel`.

### Technical Implementations
**Frontend**:
- **Framework**: React with TypeScript, Vite.
- **State Management**: TanStack Query for server state/API caching, local React state for UI.
- **Real-time**: WebSocket integration via Socket.IO.
- **Routing**: Wouter.
- **Dynamic Market Selection**: Markets are auto-fetched from Asterdex every 5 minutes, cached, and display enriched information including 24h volume, price, price change %, and leverage limits. Markets are sorted by 24h volume (highest first).

**Backend**:
- **Runtime**: Node.js with Express.js.
- **API Design**: RESTful for bot management, complemented by Socket.IO for real-time communication.
- **Core Bot Engine**: Manages individual bot instances, handles advanced trading logic, market data intelligence, batch order placement, real-time order tracking, risk monitoring, and performance analytics. Uses mark price for order placement and intelligent order management (refreshing/cancelling stale orders).
- **Bot Manager**: A singleton orchestrator for multiple bot instances, coordinating lifecycle and broadcasting WebSocket events. Injects API credentials from environment variables into bot instances for enhanced security.
- **Asterdex API Client**: Provides complete API coverage (60+ methods) with HMAC SHA256 authentication, rate limit protection (weight and order count), and automatic backoff.
- **User Data Stream Manager**: Manages WebSocket connection to Asterdex for real-time order, account, and position updates, including automatic reconnection and listen key keepalive.
- **Exchange Info Cache**: Caches Asterdex exchange information, 24hr ticker data, and leverage brackets for 5 minutes. Enriches market data with volume, price changes, current prices, and real market-specific max leverage limits. Automatically sorts markets by trading volume.

### Feature Specifications
- **Dynamic Market System**: Auto-discovers and caches markets from Asterdex, providing rich data like leverage limits, 24h volume, price changes, and trading status. Markets are automatically sorted by volume to highlight the most liquid pairs.
- **Secure Credential Management**: All API credentials (key and secret) are stored in environment variables (.env file) for enhanced security. Credentials are never exposed in the UI or per-bot configuration, preventing accidental leakage.
- **100% Asterdex API Utilization**: Full coverage of 60+ API methods, including advanced orders (batch, stop/take-profit, trailing stops), risk management, market intelligence, and account analytics.
- **Intelligent Trading**: Mark price-based order placement, batch order processing, real-time order fill tracking via WebSocket, commission-aware P&L calculation, and automatic risk monitoring.
- **Multi-Bot Management**: Supports running and monitoring multiple independent bot instances on different market pairs, all sharing the same secure API credentials.
- **Rate Limit Protection**: Implements request weight tracking, order count limits, automatic backoff, and request queuing.

### System Design Choices
- **Investment Model**: Uses total investment budget approach where `investmentUsdt` represents the total margin available. Order sizes are calculated dynamically to fit within this budget while accounting for leverage. Each order's notional value is limited by: (1) budget-per-order = totalBudget / totalOrders, (2) leveraged notional = budget-per-order × leverage, and (3) minimum notional enforcement (10% above exchange minimum). This ensures orders never exceed available margin while meeting all exchange requirements (tick size, step size, min notional).
- **Data Storage**: In-memory storage for development, with optional PostgreSQL using Drizzle ORM for production (configured via Docker Compose). Zod schemas ensure data integrity. Note: API credentials are never stored in the database - they are injected from environment variables at runtime.
- **Security**: API credentials are stored exclusively in .env file (never in database or UI). Environment variables `ASTERDEX_API_KEY` and `ASTERDEX_API_SECRET` are required. Bot Manager validates and injects credentials at bot creation and startup.
- **Deployment**: Docker-based deployment is recommended for production using Docker Compose. An interactive setup wizard (`asteroid.sh`) simplifies prerequisite checks, environment configuration (including secure API credential collection), and service management. Replit deployment is supported for development/testing.
- **Robustness**: Type safety with TypeScript, comprehensive error handling, and performance optimizations (batch operations, WebSockets, smart caching).

## External Dependencies

- **Asterdex Exchange API**:
    - Base URL: `https://fapi.asterdex.com`
    - WebSocket URL: `wss://fstream.asterdex.com`
    - Authentication: API Key + HMAC SHA256 signed requests.
    - Endpoints: `/fapi/v1/*`, `/fapi/v2/*`, `/fapi/v4/*` for trading, market data, and exchange info.
    - Features: User Data Stream (WebSocket), Exchange Info.
- **Real-time Communication**:
    - Socket.IO: For WebSocket communication between the server and clients.
    - `ws` library: For native WebSocket connections to Asterdex.
- **Third-party Services**:
    - Axios: For HTTP requests to the Asterdex API.
    - Neon Database: Optional PostgreSQL serverless database, configured via Docker Compose.
- **Key Libraries/Frameworks**:
    - **Frontend**: React, React DOM, TanStack Query, Radix UI, Recharts, React Hook Form, Zod.
    - **Backend**: Express, Socket.IO, `ws`.
    - **Database**: Drizzle ORM, `@neondatabase/serverless` (for Neon).
    - **Build Tools**: Vite, esbuild, TypeScript.
    - **Deployment**: Docker, Docker Compose.