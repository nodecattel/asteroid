# Asterdex Volume Generator Bot

## Overview

A sophisticated volume generation trading bot for Asterdex cryptocurrency exchange with real-time monitoring dashboard. The application enables users to run multiple bot instances simultaneously (one per market pair), each executing automated trading strategies to generate trading volume while monitoring performance metrics, P&L, and maintaining rate limit compliance.

The system features a terminal-inspired monochrome dashboard for monitoring bot activities, viewing real-time metrics, tracking hourly volume progress, and managing multiple bot configurations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, built using Vite for fast development and optimized production builds.

**UI Component System**: Custom terminal-inspired design using shadcn/ui components with Radix UI primitives. The design follows a monochrome aesthetic with JetBrains Mono font for a professional trading terminal appearance.

**State Management**: 
- TanStack Query (React Query) for server state management and API data caching
- Local React state for UI interactions
- WebSocket integration for real-time updates

**Routing**: Wouter for lightweight client-side routing

**Design System**: 
- Tailwind CSS for utility-first styling
- Custom color palette focused on terminal aesthetics (dark mode primary)
- Monochrome design with minimal strategic accent colors (green for profits/active, red for losses/errors)

**Key UI Components**:
- `StatusBar`: Real-time bot status indicator with market info and session time
- `MetricCard`: Displays key performance metrics (volume, trades, P&L)
- `OrdersTable`: Live order book display with cancel functionality
- `ActivityFeed`: Real-time activity log stream
- `VolumeChart`: Hourly volume progress visualization using Recharts
- `BotSelector`: Multi-bot management interface
- `ConfigPanel`: Collapsible configuration viewer

### Backend Architecture

**Runtime**: Node.js with Express.js server

**API Design**: RESTful endpoints for bot management, complemented by WebSocket (Socket.IO) for real-time bidirectional communication

**Core Bot Engine**:
- `BotEngine`: Individual bot instance manager handling trading logic, order placement/cancellation, and statistics tracking
- `BotManager`: Singleton orchestrator managing multiple bot instances, event forwarding, and lifecycle coordination
- `AsterdexClient`: API client wrapper handling HMAC SHA256 authentication, rate limiting, and request queuing

**Trading Strategy**:
- Market-making approach with configurable spread (basis points)
- Multiple orders per side for order book depth
- Automatic order refresh based on configurable intervals
- Smart cancellation of stale orders
- Rate limit protection with request queuing and exponential backoff

**Rate Limit Protection**:
- Request weight tracking and enforcement
- Order count limits per time window
- Automatic backoff on 429 responses
- Request queue with prioritization
- Configurable delays between operations

**Authentication**: HMAC SHA256 signature-based API authentication following Asterdex API standards

### Data Storage

**Storage Strategy**: In-memory storage implementation (MemStorage) for development/testing

**Data Models**:
- `BotInstance`: Bot configuration and runtime state
- `BotStats`: Performance metrics (volume, trades, P&L, fill rates)
- `Order`: Individual order records with status tracking
- `ActivityLog`: Timestamped event logs
- `HourlyVolume`: Time-series volume tracking

**Database Configuration**: Drizzle ORM configured for PostgreSQL (via Neon serverless) with schema defined but using in-memory storage currently. The application is architected to easily swap to persistent PostgreSQL storage when needed.

**Schema Validation**: Zod schemas for runtime type validation and data integrity

### External Dependencies

**Asterdex Exchange API**:
- Base URL: `https://fapi.asterdex.com`
- Authentication: API Key + HMAC SHA256 signed requests
- Endpoints: `/fapi/v1/*` for trading, market data, and exchange info
- Rate Limits: Request weight limits and order count limits enforced per minute

**Real-time Communication**:
- Socket.IO for WebSocket communication between server and clients
- Event-based architecture for order updates, activity logs, and statistics

**Third-party Services**:
- Axios for HTTP requests to Asterdex API
- Neon Database (PostgreSQL serverless) - configured but not actively used (in-memory storage current)

**Key Dependencies**:
- React ecosystem: React, React DOM, TanStack Query
- UI: Radix UI primitives, Recharts for visualizations
- Forms: React Hook Form with Zod resolvers
- Backend: Express, Socket.IO
- Database: Drizzle ORM, @neondatabase/serverless
- Build tools: Vite, esbuild, TypeScript

**Environment Variables Required**:
- `API_KEY`: Asterdex API key
- `API_SECRET`: Asterdex API secret
- `DATABASE_URL`: PostgreSQL connection string (optional, in-memory storage used by default)
- Bot configuration parameters (market, leverage, targets, strategy settings)