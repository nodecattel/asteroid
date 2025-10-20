# Asterdex Volume Generator Bot

## Overview
The Asterdex Volume Generator Bot is a fully functional trading bot designed for the Asterdex cryptocurrency exchange, focused on generating trading volume. It leverages 100% of the Asterdex API, allowing users to run multiple bot instances concurrently across different market pairs. The system includes a terminal-inspired, monochrome dashboard for real-time monitoring of bot activities, metrics, hourly volume progress, and managing configurations. Its core purpose is to automate trading strategies and provide comprehensive insights into market data, risk analytics, and performance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React and TypeScript using Vite, featuring a custom terminal-inspired UI designed with shadcn/ui and Radix UI primitives, adhering to a monochrome aesthetic with the JetBrains Mono font. State management is handled by TanStack Query for server state and local React state for UI interactions, complemented by WebSocket integration for real-time updates. Styling is managed with Tailwind CSS, using a dark mode primary palette with strategic accent colors for status indications.

### Backend Architecture
The backend uses Node.js with an Express.js server, implementing RESTful endpoints and WebSocket (Socket.IO) for real-time communication. The core `Bot Engine` manages individual bot instances, handling advanced trading logic, market data intelligence, batch order placement, real-time order tracking, and risk monitoring. A singleton `Bot Manager` orchestrates multiple bot instances. The `Asterdex API Client` provides 100% API coverage (60+ methods), handling HMAC SHA256 authentication, rate limiting, and request queuing. A `User Data Stream Manager` maintains WebSocket connections to Asterdex for real-time order, account, and position updates.

### Trading Strategy
The bot employs a market-making approach using mark price for accurate order placement, configurable spread, and multiple orders per side. It utilizes batch order placement for efficiency, automatic order refreshing, and smart cancellation of stale orders. Real-time order tracking via WebSocket ensures instant fill notifications and accurate P&L/volume tracking. Risk management includes ADL quantile monitoring, position risk tracking, leverage bracket awareness, and margin call event handling.

### Data Storage
The current implementation uses in-memory storage (`MemStorage`) for development, with a schema defined for PostgreSQL via Drizzle ORM, allowing for easy transition to persistent storage. Data models include `BotInstance`, `BotStats`, `Order`, `ActivityLog`, and `HourlyVolume`, with Zod schemas for validation.

## External Dependencies

### Asterdex Exchange API
- **Base URL**: `https://fapi.asterdex.com`
- **WebSocket URL**: `wss://fstream.asterdex.com`
- **Authentication**: API Key + HMAC SHA256 signed requests
- **Endpoints**: Covers `/fapi/v1/*`, `/fapi/v2/*`, `/fapi/v4/*` for comprehensive market data, trading, account, and exchange info.
- **Rate Limits**: Enforces request weight and order count limits.
- **User Data Stream**: WebSocket connection for real-time order, account, and position updates.

### Real-time Communication
- **Socket.IO**: Used for WebSocket communication between the server and frontend clients.
- **Asterdex WebSocket**: Native user data stream for real-time updates from the exchange.

### Third-party Services
- **Axios**: HTTP client for Asterdex API requests.
- **WS (ws)**: Library for WebSocket connections to Asterdex.
- **Neon Database (PostgreSQL)**: Configured for potential future use, currently using in-memory storage.

### Key Dependencies
- **Frontend**: React, React DOM, TanStack Query, Radix UI, Recharts, React Hook Form, Zod.
- **Backend**: Express, Socket.IO, ws.
- **Database**: Drizzle ORM, @neondatabase/serverless.
- **Build Tools**: Vite, esbuild, TypeScript.

### Environment Variables
- `API_KEY`: Asterdex API key.
- `API_SECRET`: Asterdex API secret.
- `DATABASE_URL`: PostgreSQL connection string (optional).
- Bot configuration parameters.