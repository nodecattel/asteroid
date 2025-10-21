# Astroid

## Overview
Astroid is a trading bot for Aster Dex cryptocurrency exchange, designed to automate trading volume generation. It supports multiple bot instances, each managing a specific market pair, and features a real-time, terminal-inspired dashboard for monitoring and configuration. The project includes password-based authentication, centralized API credential management, and comprehensive security measures. It aims to be a robust, efficient, and user-friendly platform for automated volume generation, with dynamic market loading and Docker-based deployment.

**Branding**: Features custom Astroid logo (white asteroid with rings) prominently displayed on login page, dashboard header, and as favicon. Logo file: `attached_assets/asteroid_1761014274709.png`.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React and TypeScript with Vite, featuring a custom terminal-inspired monochrome design. It leverages `shadcn/ui` components based on Radix UI primitives, styled with Tailwind CSS, emphasizing dark mode and strategic accent colors (green for positive, red for negative). Key components include `StatusBar`, `MetricCard`, `OrdersTable`, `ActivityFeed`, `VolumeChart`, `BotSelector`, `ConfigPanel`, and `MarketPairs`. The interface is designed to be mobile-responsive.

**Logo Integration**: Astroid logo appears on login page (large, centered above title), dashboard StatusBar (small, left side), and as favicon. Logo is a white asteroid/planet with rings on transparent background, perfectly matching the dark monochrome theme.

**Market Pairs Display**: Modern tabbed interface showing all 250+ Aster Dex trading pairs with "Favorites" and "All markets" tabs, search functionality, and multi-field sorting. Desktop layout displays 4 columns: Symbols/Volume (with crypto icon, star for favorites, symbol, leverage badge, and volume), Last price, 24h change (color-coded), and Funding Rate. Mobile layout uses 2 columns: Symbols/Volume on left, Price/24h change stacked on right. Favorites stored in localStorage and can be filtered via dedicated tab. Market data cached for 1 minute on backend and frontend. Updates every 60 seconds. Design inspired by Aster Dex's native interface for consistency.

### Technical Implementations
**Frontend**:
- **Framework**: React with TypeScript, Vite.
- **State Management**: TanStack Query for server state/API caching.
- **Authentication**: Protected routes using `useAuth` hook that queries `/api/auth/status`. Login component invalidates auth query cache after successful login to trigger re-authentication check.
- **Real-time**: WebSocket integration via Socket.IO.
- **Routing**: Wouter with authentication guard in App.tsx.
- **Dynamic Market Selection**: Markets are auto-fetched from Aster Dex, cached, and display enriched information including 24h volume, price, price change %, and leverage limits. Markets are sorted by 24h volume.

**Backend**:
- **Runtime**: Node.js with Express.js.
- **API Design**: RESTful for bot management, complemented by Socket.IO for real-time communication.
- **Authentication**: Password-based authentication using `BOT_PASSWORD` environment variable (required). Session management via `express-session` with memory store. HttpOnly cookies for security. Three endpoints: `/api/auth/login`, `/api/auth/logout`, `/api/auth/status`.
- **API Credentials**: Centralized `ASTERDEX_API_KEY` and `ASTERDEX_API_SECRET` stored in environment variables (not database). All bots share these credentials for security.
- **Core Bot Engine**: Manages individual bot instances, handles trading logic, market data intelligence, batch order placement, real-time order tracking, risk monitoring, and performance analytics.
- **Bot Manager**: A singleton orchestrator for multiple bot instances, coordinating lifecycle and broadcasting WebSocket events.
- **Aster Dex API Client**: Provides complete API coverage with HMAC SHA256 authentication, rate limit protection, and automatic backoff.
- **User Data Stream Manager**: Manages WebSocket connections to Aster Dex for real-time updates, including automatic reconnection and listen key keepalive.
- **Exchange Info Cache**: Caches Aster Dex exchange information, 24hr ticker data, leverage brackets, and funding rates. Cache duration: 1 minute for fresh market data.

### Feature Specifications
- **Market Pairs Overview**: Modern tabbed interface (Favorites/All markets) displaying all 250+ trading pairs. Features search, multi-field sorting (symbol, price, 24h change, funding rate), and crypto icons for each asset. Desktop: 4-column layout (Symbols/Volume, Last price, 24h change, Funding Rate). Mobile: Responsive 2-column layout (Symbols/Volume left, Price/24h change right stacked). Favorites persisted in localStorage with dedicated tab filter. Market data cached 1 minute for freshness. Auto-refreshes every 60 seconds. Layout matches Aster Dex's native design for professional consistency.
- **Dynamic Market System**: Auto-discovers and caches markets from Aster Dex, providing rich data and sorting by volume.
- **Secure Credential Management**: API credentials are stored in environment variables and are never exposed in the UI or per-bot configuration.
- **100% Aster Dex API Utilization**: Full coverage of 60+ API methods for advanced orders, risk management, market intelligence, and account analytics.
- **Intelligent Trading**: Mark price-based order placement, batch order processing, real-time order fill tracking, commission-aware P&L, and automatic risk monitoring.
- **Multi-Bot Management**: Supports running and monitoring multiple independent bot instances on different market pairs.
- **Rate Limit Protection**: Implements request weight tracking, order count limits, automatic backoff, and request queuing.
- **Password Authentication**: Implemented for all bot management and account endpoints.
- **Dynamic Max Leverage**: Fetches and displays real-time max leverage from Aster Dex API for each market.
- **Budget Warning System**: Validates order sizes against total budget.
- **Auto-Start Feature**: Bots automatically start trading after creation.
- **Bot Parameter Editing**: Running bots can be edited without stopping them.
- **Auto-Close Positions on Stop**: Open positions are automatically closed when a bot is stopped.

### System Design Choices
- **Investment Model**: Uses a total investment budget approach (`investmentUsdt`) where order sizes are dynamically calculated to fit within this budget, accounting for leverage and meeting exchange minimum notional requirements.
- **Data Storage**: In-memory for development, with optional PostgreSQL using Drizzle ORM for production. Zod schemas ensure data integrity. API credentials are not stored in the database.
- **Security**: Password-based access control, API credentials stored exclusively in `.env` files, and Express-session for session management with HttpOnly cookies.
- **Port Configuration**: Supports `PORT` environment variable.
- **Deployment**: Docker-based deployment recommended for production using Docker Compose. Replit deployment is supported for development/testing.
- **Robustness**: Type safety with TypeScript, comprehensive error handling, and performance optimizations.

## External Dependencies

- **Aster Dex Exchange API**:
    - Base URL: `https://fapi.asterdex.com`
    - WebSocket URL: `wss://fstream.asterdex.com`
    - Authentication: API Key + HMAC SHA256 signed requests.
    - Endpoints: `/fapi/v1/*`, `/fapi/v2/*`, `/fapi/v4/*` for trading, market data, and exchange info.
- **Real-time Communication**:
    - Socket.IO: For WebSocket communication between the server and clients.
    - `ws` library: For native WebSocket connections to Asterdex.
- **Third-party Services**:
    - Axios: For HTTP requests to the Asterdex API.
    - Neon Database: Optional PostgreSQL serverless database.
- **Key Libraries/Frameworks**:
    - **Frontend**: React, React DOM, TanStack Query, Radix UI, Recharts, React Hook Form, Zod.
    - **Backend**: Express, Socket.IO, `ws`.
    - **Database**: Drizzle ORM, `@neondatabase/serverless`.
    - **Build Tools**: Vite, esbuild, TypeScript.
    - **Deployment**: Docker, Docker Compose.