# Trading Bot Monitoring Dashboard - Design Guidelines

## Design Approach

**Selected Approach**: Custom Terminal-Inspired Design System  
**Rationale**: Trading bot dashboard requires high information density, real-time data clarity, and professional aesthetic. The terminal theme provides familiarity for technical users while maintaining exceptional readability for numerical data and status indicators.

**Core Principles**:
- Terminal-inspired minimalism with modern refinements
- Information hierarchy through typography and spacing, not color
- Monochrome palette with strategic accent usage
- Maximum data density without visual clutter

---

## Color Palette

### Dark Mode (Primary)
- **Background**: `0 0% 8%` - Deep charcoal base
- **Surface**: `0 0% 12%` - Elevated panels/cards
- **Border**: `0 0% 20%` - Subtle dividers
- **Text Primary**: `0 0% 95%` - High contrast text
- **Text Secondary**: `0 0% 60%` - Muted labels
- **Text Tertiary**: `0 0% 40%` - Timestamps, metadata

### Accent Colors (Minimal Usage)
- **Success/Positive**: `142 70% 45%` - Terminal green for profits, active states
- **Error/Negative**: `0 65% 51%` - Critical alerts, losses  
- **Warning**: `45 93% 47%` - Caution states
- **Info/Accent**: `142 70% 45%` - Links, interactive elements

### Light Mode (Optional)
- **Background**: `0 0% 98%`
- **Surface**: `0 0% 100%`
- **Border**: `0 0% 85%`
- **Text Primary**: `0 0% 10%`

---

## Typography

**Primary Font**: `'JetBrains Mono', 'Fira Code', 'Consolas', monospace`  
**Fallback**: System monospace stack for terminal authenticity

### Type Scale
- **Display (Metrics)**: 3rem (48px), font-weight: 600, tracking: -0.02em
- **Heading 1**: 2rem (32px), font-weight: 600
- **Heading 2**: 1.5rem (24px), font-weight: 500
- **Body**: 0.875rem (14px), font-weight: 400, line-height: 1.6
- **Caption/Labels**: 0.75rem (12px), font-weight: 500, uppercase, tracking: 0.05em
- **Code/Data**: 0.875rem (14px), font-weight: 400, tabular-nums

---

## Layout System

**Spacing Primitives**: Use Tailwind units `2, 4, 6, 8, 12, 16` for consistent rhythm

### Grid Structure
- **Container**: `max-w-[1600px]` with `px-6 lg:px-8`
- **Dashboard Grid**: 12-column responsive grid
- **Card Spacing**: `gap-4 lg:gap-6`
- **Section Padding**: `py-6 lg:py-8`

### Key Layouts
- **Metrics Cards**: 3-4 column grid on desktop, stack on mobile
- **Live Orders Table**: Full-width scrollable data table
- **Control Panel**: Sticky header with status bar
- **Chart Area**: 2:1 aspect ratio for volume visualization

---

## Component Library

### Core Components

**Status Bar** (Sticky Top)
- Bot status indicator (Running/Paused/Error)
- Session timer, current market, connection status
- Quick controls (Pause/Resume)
- Border bottom with subtle glow effect

**Metric Cards**
- Large numeric display with unit label
- Trend indicator (↑↓ with percentage)
- Minimal border with hover state (border brightens)
- Background: surface color with subtle inset shadow

**Data Tables**
- Monospaced columns for numerical alignment
- Alternating row background (0% vs 2% opacity)
- Fixed header with sticky positioning
- Hover row highlight (5% opacity increase)
- Compact cell padding: `py-2 px-4`

**Live Feed/Terminal Output**
- Scrollable container with `max-h-[400px]`
- Each line prefixed with timestamp in muted color
- Color-coded by event type (green: fill, red: error, white: info)
- Bottom-sticky for auto-scroll to latest

**Control Buttons**
- Primary: Filled with accent color
- Secondary: Outline with border-2
- Danger: Outline red with hover fill
- Icon-only buttons for compact actions
- Size: `h-10 px-4` for standard, `h-8 px-3` for compact

**Charts/Visualizations**
- Line charts for volume over time using subtle grid
- Bar charts for hourly breakdown
- Minimal axes, clean typography
- Single accent color (terminal green) for data
- Transparent background, white/gray gridlines

### Interactive States
- **Hover**: Border brightness +10%, subtle scale 1.01
- **Active**: Border brightness +20%, scale 0.99
- **Focus**: Ring with accent color, offset 2px
- **Disabled**: Opacity 40%, cursor-not-allowed

---

## Dashboard Sections

### Header
- Full-width status bar with bot name, market, session info
- Controls aligned right (Pause/Resume, Settings, Logs)
- Border bottom with terminal green accent line (1px)

### Metrics Overview (3-column grid)
- Total Volume Generated (with target progress bar)
- Total Trades (with hourly rate)
- Current P&L (with percentage change)
- Active Orders Count
- Session Uptime
- Fill Rate

### Activity Feed (2-column layout)
**Left**: Live order book updates, fills, cancellations (terminal-style log)  
**Right**: Volume chart (hourly breakdown bar chart)

### Active Orders Table
- Columns: Time, Side, Price, Quantity, Status
- Real-time updates with subtle flash animation on new orders
- Action buttons (Cancel) inline

### Configuration Panel (Collapsible)
- Display current .env settings in read-only format
- Spread, leverage, investment shown as labeled values
- Target metrics and projections

---

## Animations

**Principle**: Subtle, purposeful motion only

- **Data Updates**: Fade in new values (200ms ease)
- **Number Changes**: Count-up animation for metrics (300ms)
- **New Orders**: Slide in from top with fade (150ms)
- **Status Changes**: Pulse border glow (500ms)
- **Loading States**: Minimal spinner or skeleton screens

**Avoid**: Page transitions, parallax, decorative animations

---

## Images

**Image Strategy**: No hero images or decorative visuals. This is a data-focused dashboard.

**Icon Usage**:
- Use Lucide React icons via CDN
- Status indicators: Circle icons (filled for active, outline for inactive)
- Trend arrows: TrendingUp/TrendingDown icons
- Actions: Play, Pause, Settings, ExternalLink icons
- Size: 16px for inline, 20px for standalone

---

## Accessibility & Polish

- Maintain 4.5:1 contrast ratio minimum for all text
- Tabular numbers for all metrics (font-feature-settings: "tnum")
- Keyboard navigation with visible focus states
- ARIA labels for icon-only buttons
- Real-time updates announced to screen readers
- Persistent dark mode (no toggle needed per requirements)
- Monospaced fonts ensure data alignment across viewport sizes