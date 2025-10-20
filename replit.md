# Asterdex Volume Generator Bot

## Overview
The Asterdex Volume Generator Bot is a comprehensive trading application designed for the Asterdex cryptocurrency exchange. Its primary purpose is to generate trading volume through automated strategies, leveraging 100% of the Asterdex API. The system supports running multiple bot instances simultaneously, each managing a specific market pair. It features a real-time, terminal-inspired monochrome dashboard for monitoring bot activities, tracking key metrics, managing configurations, and accessing advanced market and performance data. The project aims to provide a robust, efficient, and user-friendly platform for automated volume generation, capable of dynamic market loading and Docker-based deployment.

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
- **Dynamic Market Selection**: Markets are auto-fetched from Asterdex every 5 minutes, cached, and display leverage information.

**Backend**:
- **Runtime**: Node.js with Express.js.
- **API Design**: RESTful for bot management, complemented by Socket.IO for real-time communication.
- **Core Bot Engine**: Manages individual bot instances, handles advanced trading logic, market data intelligence, batch order placement, real-time order tracking, risk monitoring, and performance analytics. Uses mark price for order placement and intelligent order management (refreshing/cancelling stale orders).
- **Bot Manager**: A singleton orchestrator for multiple bot instances, coordinating lifecycle and broadcasting WebSocket events.
- **Asterdex API Client**: Provides complete API coverage (60+ methods) with HMAC SHA256 authentication, rate limit protection (weight and order count), and automatic backoff.
- **User Data Stream Manager**: Manages WebSocket connection to Asterdex for real-time order, account, and position updates, including automatic reconnection and listen key keepalive.
- **Exchange Info Cache**: Caches Asterdex exchange information for 5 minutes, providing market data and filtering for active trading pairs.

### Feature Specifications
- **Dynamic Market System**: Auto-discovers and caches markets from Asterdex, providing rich data like leverage limits and trading status.
- **100% Asterdex API Utilization**: Full coverage of 60+ API methods, including advanced orders (batch, stop/take-profit, trailing stops), risk management, market intelligence, and account analytics.
- **Intelligent Trading**: Mark price-based order placement, batch order processing, real-time order fill tracking via WebSocket, commission-aware P&L calculation, and automatic risk monitoring.
- **Multi-Bot Management**: Supports running and monitoring multiple independent bot instances on different market pairs.
- **Rate Limit Protection**: Implements request weight tracking, order count limits, automatic backoff, and request queuing.

### System Design Choices
- **Data Storage**: In-memory storage for development, with optional PostgreSQL using Drizzle ORM for production (configured via Docker Compose). Zod schemas ensure data integrity.
- **Deployment**: Docker-based deployment is recommended for production using Docker Compose. An interactive setup wizard (`asteroid.sh`) simplifies prerequisite checks, environment configuration, and service management. Replit deployment is supported for development/testing.
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