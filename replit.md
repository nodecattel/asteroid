# Astroid

## Overview
Astroid is a trading bot designed for the Aster Dex cryptocurrency exchange, automating trading volume generation. It supports multiple bot instances, each managing a specific market pair, and features a real-time, terminal-inspired dashboard for monitoring and configuration. Key capabilities include password-based authentication, centralized API credential management, dynamic market loading, and Docker-based deployment, aiming to provide a robust, efficient, and user-friendly platform for automated volume generation.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React and TypeScript with Vite, featuring a custom terminal-inspired monochrome design built with `shadcn/ui` components (Radix UI primitives) and Tailwind CSS. It emphasizes dark mode with strategic accent colors and is mobile-responsive. The Astroid logo is integrated into the login page, dashboard header, and as a favicon. A modern tabbed interface displays Aster Dex trading pairs with "Favorites" and "All markets" views, search, and multi-field sorting, designed for consistency with Aster Dex's native interface.

### Technical Implementations
**Frontend**: Built with React, TypeScript, and Vite, using TanStack Query for state management and API caching. It includes protected routes with an authentication hook, Socket.IO for real-time updates, and Wouter for routing. Dynamic market selection automatically fetches and caches market data from Aster Dex.

**Backend**: Developed with Node.js and Express.js, providing a RESTful API for bot management and Socket.IO for real-time communication. Authentication is password-based using an environment variable (`BOT_PASSWORD`) and `express-session` with HttpOnly cookies. API credentials (`ASTERDEX_API_KEY`, `ASTERDEX_API_SECRET`) are stored securely in environment variables. The core bot engine manages individual bot instances, trading logic, market data, order placement, and risk monitoring. A singleton Bot Manager orchestrates instances and broadcasts WebSocket events. An Aster Dex API Client provides comprehensive API coverage with HMAC SHA256 authentication, rate limit protection, and automatic backoff. A User Data Stream Manager handles real-time updates from Aster Dex, and an Exchange Info Cache stores market data for freshness.

### Feature Specifications
- **Market Pairs Overview**: Tabbed interface with Favorites/All markets, search, multi-field sorting, and crypto icons.
- **Quick Bot Creation**: "+" action button on market rows to quickly initiate bot creation for that market.
- **Dual Spread System**: Separate controls for `firstOrderSpreadBps` and `orderSpacingBps` for precise order placement.
- **Mobile-Responsive Bot Dialog**: Optimized Create/Edit Bot dialogs for mobile screens.
- **Dynamic Market System**: Auto-discovers, caches, and sorts markets from Aster Dex.
- **Secure Credential Management**: API keys are environment variables, never exposed.
- **100% Aster Dex API Utilization**: Full coverage of over 60 API methods.
- **Intelligent Trading**: Mark price-based orders, batch processing, real-time fill tracking, commission-aware P&L, and risk monitoring.
- **Multi-Bot Management**: Supports multiple independent bot instances across different market pairs.
- **Rate Limit Protection**: Implements request weight tracking, order count limits, and automatic backoff.
- **Password Authentication**: Secures bot management endpoints.
- **Dynamic Max Leverage**: Fetches and applies real-time max leverage per market.
- **Budget Warning System**: Validates order sizes against total budget.
- **Auto-Start Feature**: Bots automatically begin trading upon creation.
- **Bot Parameter Editing**: Allows editing running bots without stopping.
- **Auto-Close Positions on Stop**: Automatically closes open positions when a bot is stopped.
- **Trading Bias System**: Fully respects `tradingBias` ('neutral', 'long', 'short') and `longBiasPercent` settings.
- **Smart Order Management**: Minimizes cancellations by only replacing orders when price moves significantly or orders are filled/cancelled externally.
- **TP/SL Protection Orders**: Uses `reduceOnly: true` with explicit quantity for fixed Take-Profit/Stop-Loss orders.
- **Robust Precision Handling**: Calculates price and quantity precision from exchange's tickSize and stepSize filters.
- **Configurable Cycle Time**: `cycleTimeSeconds` setting (1-300s) to balance volume generation and trade quality.
- **Maximum Margin Utilization**: Bot automatically distributes margin budget equally across all orders.
- **TP/SL Update Cooldown**: 30-second cooldown between TP/SL updates to prevent exchange rate limits.
- **Auto-Recalculate TP/SL on Side Change**: Detects position side changes, cancels old protection orders, and schedules new TP/SL recalculation.
- **Auto-Scroll Pause**: Activity Feed includes a Pause/Resume toggle for reviewing logs.
- **Enhanced Recent Orders**: Real-time WebSocket updates, auto-scroll with pause/resume, and increased limit to 20 orders.
- **MCP Server Integration**: Integrates Model Context Protocol server for autonomous AI agent trading, exposing trading tools, real-time resources, and AI decision prompts.
- **AI Agent Trading Platform** (Completed Oct 22, 2025): 
  - Full-featured `/agents` page with agent management UI
  - Create, start, pause, and delete AI trading agents
  - Independent capital allocation and risk parameters per agent
  - Real-time performance tracking (balance, P&L, win rate, Sharpe ratio)
  - Agent trade history feed with reasoning/commentary
  - Multi-model support (Claude, GPT-4, DeepSeek, Grok, Qwen)
  - Navigation integration via StatusBar (AI Agents / Bots toggle)
  - Complete CRUD API routes for agent lifecycle
  - WebSocket integration for real-time updates
  - MCP protocol ready for autonomous AI trading

### System Design Choices
- **Investment Model**: Margin-based risk model (`marginUsdt`) where capital is distributed across orders for maximum utilization.
- **Data Storage**: In-memory for development, with optional PostgreSQL using Drizzle ORM for production. Zod schemas ensure data integrity.
- **Security**: Password-based access, API credentials in `.env`, and `express-session` with HttpOnly cookies.
- **Port Configuration**: Supports `PORT` environment variable.
- **Deployment**: Docker-based deployment (Docker Compose) recommended for production; Replit supported for development.
- **Robustness**: Type safety with TypeScript, error handling, and performance optimizations.

## External Dependencies

- **Aster Dex Exchange API**:
    - Base URL: `https://fapi.asterdex.com`
    - WebSocket URL: `wss://fstream.asterdex.com`
    - Authentication: API Key + HMAC SHA256.
    - Endpoints: `/fapi/v1/*`, `/fapi/v2/*`, `/fapi/v4/*`.
- **Real-time Communication**:
    - Socket.IO: For server-client WebSocket communication.
    - `ws`: For native WebSocket connections to Asterdex.
- **Third-party Services**:
    - Axios: For HTTP requests to Asterdex API.
    - Neon Database: Optional PostgreSQL serverless database.
    - MCP SDK (`@modelcontextprotocol/sdk`): For AI agent integration.
- **Key Libraries/Frameworks**:
    - **Frontend**: React, TanStack Query, Radix UI, Recharts, React Hook Form, Zod.
    - **Backend**: Express, Socket.IO, `ws`.
    - **Database**: Drizzle ORM, `@neondatabase/serverless`.
    - **Build Tools**: Vite, esbuild, TypeScript.
    - **Deployment**: Docker.