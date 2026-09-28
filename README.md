# Stock Analyzer

A Muse web artifact for exploring probabilistic stock-price ranges. Enter a ticker to combine recent market data, historical volatility, and a cautious news-sentiment signal into a deterministic 10,000-path Monte Carlo model.

## What it includes

- Current quote, session move, market cap, beta, volume, and 52-week range
- One year of daily price history
- Source-linked recent news with bounded sentiment analysis
- Selectable 1-day, 1-week, 1-month, 3-month, and 1-year horizons
- P10, P25, median, P75, and P90 terminal-price estimates
- Probability of finishing above the current price
- Distribution and historical-price charts
- Ten-minute per-ticker cache with manual refresh
- Responsive light and dark themes

## Model

The server calculates daily log returns from source price history, annualizes realized volatility, shrinks historical drift toward zero, and applies a small disclosed sentiment tilt. A seeded geometric Brownian motion simulation generates 10,000 paths across 1, 5, 21, 63, and 252 trading sessions.

The output is a model of uncertainty, not a price target or investment advice. It does not account for every market regime, jump event, liquidity constraint, or company-specific development.

## Stack

- TypeScript
- React 19
- TanStack Query
- Recharts
- Drizzle ORM
- Muse web artifact SDK
- Bun

## Project structure

```text
client/src/        React interface and styling
server/src/        Typed actions, data retrieval, and simulation logic
drizzle/           Database migrations
DATA-PLAN.md       Source provenance and data behavior
space.json         Muse web artifact metadata
```

## Development

This repository is the source of a Muse web artifact and depends on the managed Muse runtime and `@hatch/space-sdk`. In that environment:

```bash
bun install
bun run typecheck
bun run build
```

The artifact fetches current market/news inputs at analysis time through runtime-provided tools. Local database files and generated build artifacts are intentionally excluded from version control.
