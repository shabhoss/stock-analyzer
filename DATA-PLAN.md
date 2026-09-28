# Data Plan

## Context provenance
- “are you able to build me a stock investing analyzing tool where I will type in a stock ticker and you use whatever important stock parameters including market sentiment and recent news to build a monte carlo probabilities prediction for the future (i guess we can change the date range too? 1 day in the future, 1 week, 1 month, 3 months, 1 year) and their price ranges” (verbatim user request; defines ticker entry, evidence inputs, Monte Carlo output, and the five selectable horizons).

## Tested sources
### Muse Finance ticker tool
**Used by**: `analyzeStock`
**Test command**: `bun /opt/hatch/skills/spaces/ts-runtime/dist/probe-ctx.js < /tmp/stock-analyzer-probe.ts` with `ctx.tool.finance_ticker("AAPL", { interval: "1d", since: "2025-09-27", until: "2026-09-27", timeout_secs: 90 })`
**Sample output**: exact AAPL match; Apple Inc; price 341.07 USD; session change 5.15 / 1.5331%; intraday 334.53–341.67; 52-week 243.42–345.34; beta 1.0948739; market cap 4,977,637,000,000; quote as of 2026-09-28T01:48:19Z; 250 daily OHLCV points from 2025-09-29 through 2026-09-25; source `https://finnhub.io/?q=%22AAPL%22`.
**Processing**: Normalize a single ticker, require an exact/best instrument with a current price and at least 30 valid closes, compute log returns, trailing return, sample annualized realized volatility, and other displayed metrics from structured fields only. Run a deterministic seeded 10,000-path geometric-Brownian Monte Carlo across 1, 5, 21, 63, and 252 trading sessions. Shrink the historical daily mean toward zero and apply a small, disclosed annualized news-sentiment tilt; calculate p10/p25/p50/p75/p90 and probability above spot from simulated terminal prices. Preserve nullable upstream fields instead of inventing replacements.

### Muse web search and bounded inference
**Used by**: `analyzeStock`
**Test command**: same probe, with `ctx.tool.web_search("AAPL stock latest news analyst sentiment September 2026")`, followed by `ctx.inference.complete(...)` over only the top structured search results and a strict Zod sentiment schema.
**Sample output**: 7 results; examples included a 2026-09-25 Bank of America buy-rating article, a 2026-09-27 cautious valuation article, and weekly analyst updates. The bounded inference returned `mixed`, score `0.2`, confidence `0.6`, three source-linked evidence bullets, and three risks.
**Processing**: Search dynamically with ticker, resolved company name, “latest stock news,” and the current year. Keep at most 8 non-index results with their exact returned title, URL, source, snippet, and best-effort date. Infer a cautious label/score/confidence and evidence only from those snippets. Drop any inferred evidence URL that is not byte-for-byte present in the returned search results. If inference fails, keep the news and mark sentiment unclear rather than failing the whole analysis.

## Web-search sources
### Recent company news and analyst sentiment for the entered ticker
**Delivered by**: `analyzeStock`
**Checked with**: the probe above; `ctx.tool.web_search` returned 7 structured rows for AAPL with exact URLs, titles, snippets, sources, and best-effort dates. `ctx.inference.complete` produced a typed, source-linked sentiment assessment from those rows.

## Long-term data behavior
- **Refresh policy**: No schedule. The artifact begins with ticker entry; Analyze fetches current data, a 10-minute cache may serve repeated requests, and a visible Refresh control bypasses that cache. Quote and news timestamps/source freshness are always shown.
- **Growth**: Cache one JSON snapshot per ticker and prune to the 100 most recently updated tickers; no invented watchlist, holdings, or trades.
- **Ordering**: News remains in upstream rank order after index-page filtering; forecast horizons stay 1D, 1W, 1M, 3M, 1Y.
- **Time semantics**: Quote `as_of` is an instant rendered viewer-local. Historical bars retain source dates. Forecast horizons are explicitly modeled as 1, 5, 21, 63, and 252 trading sessions, not guaranteed calendar dates.
- **Imagery not needed**: This is a quantitative analysis utility whose visual subjects are sourced price/history data and deterministic charts; decorative photography would compete with the uncertainty display.

## Rejected approaches
- **Tried**: Public third-party JSON APIs for quote/history.
  **Why rejected**: The platform-native `ctx.tool.finance_ticker` returned the required structured quote, risk fields, source attribution, and 250 daily bars without inventing an API dependency.
- **Tried**: Treating an inferred narrative as a price target.
  **Why rejected**: News inference is used only as a small disclosed drift tilt; the range comes from a reproducible seeded simulation over measured returns, and the UI states that it is a model rather than advice.
- **Tried**: Persisting sample tickers or portfolio records.
  **Why rejected**: The request authorizes user-entered analysis, not fabricated holdings, history, or saved decisions.
