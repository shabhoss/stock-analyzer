import { useMemo, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import {
Area,
AreaChart,
Bar,
BarChart,
CartesianGrid,
ResponsiveContainer,
Tooltip,
XAxis,
YAxis,
} from "recharts";
import { api, type ApiResponse } from "./api";

type AnalyzeResult = ApiResponse<typeof api, "analyzeStock">;
type Analysis = Extract<AnalyzeResult, { ok: true }> ["analysis"];
type Horizon = Analysis["forecasts"][number]["key"];

const horizonNames: Record<Horizon, string> = {
  "1D": "1 day",
  "1W": "1 week",
  "1M": "1 month",
  "3M": "3 months",
  "1Y": "1 year",
};

function formatMoney(value: number, currency: string, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(value);
}

function formatCompact(value: number | null, currency?: string): string {
  if (value === null) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
    ...(currency ? { style: "currency", currency } : {}),
  }).format(value);
}

function formatPercent(value: number | null, signed = false): string {
  if (value === null) return "—";
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatTime(value: string | null): string {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function RangeRail({ analysis, horizon }: { analysis: Analysis; horizon: Analysis["forecasts"][number] }) {
  const low = horizon.p10;
  const high = horizon.p90;
  const span = high - low || 1;
  const spotPosition = Math.max(0, Math.min(100, ((analysis.price - low) / span) * 100));
  const medianPosition = Math.max(0, Math.min(100, ((horizon.median - low) / span) * 100));
  const innerLeft = Math.max(0, Math.min(100, ((horizon.p25 - low) / span) * 100));
  const innerWidth = Math.max(0, Math.min(100 - innerLeft, ((horizon.p75 - horizon.p25) / span) * 100));
  return (
    <div className="range-block" aria-label={`${horizon.key} modeled price range`}>
      <div className="range-labels">
        <span><small>P10</small>{formatMoney(low, analysis.currency)}</span>
        <span className="range-median"><small>Median</small>{formatMoney(horizon.median, analysis.currency)}</span>
        <span><small>P90</small>{formatMoney(high, analysis.currency)}</span>
      </div>
      <div className="range-rail">
        <span className="range-inner" style={{ left: `${innerLeft}%`, width: `${innerWidth}%` }} />
        <span className="range-tick median" style={{ left: `${medianPosition}%` }} aria-hidden="true" />
        <span className="range-tick spot" style={{ left: `${spotPosition}%` }} aria-hidden="true" />
      </div>
      <div className="range-key"><span><i className="key-spot" />Current</span><span><i className="key-median" />Median</span><span>80% modeled interval</span></div>
    </div>
  );
}

export function App() {
  const [ticker, setTicker] = useState("");
  const [selected, setSelected] = useState<Horizon>("1M");
  const [result, setResult] = useState<Analysis | null>(null);
  const [wasCached, setWasCached] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const analyze = useMutation({
    mutationFn: ({ symbol, force }: { symbol: string; force: boolean }) => api.analyzeStock({ ticker: symbol, force }),
    onSuccess: (data) => {
      if (data.ok) {
        setResult(data.analysis);
        setWasCached(data.cached);
        setMessage(null);
      } else {
        setMessage(data.error);
      }
    },
    onError: () => setMessage("The analysis could not be completed. Try again in a moment."),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const symbol = ticker.trim();
    if (!symbol) {
      setMessage("Enter a ticker first.");
      return;
    }
    analyze.mutate({ symbol, force: false });
  };

  const activeForecast = result?.forecasts.find((item) => item.key === selected) ?? result?.forecasts[0];
  const historyData = useMemo(() => result?.history.slice(-126) ?? [], [result]);
  const sentimentTone = result?.sentiment.label ?? "unclear";

  return (
    <div className="app-shell">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <main>
        <section className="search-stage" aria-labelledby="search-heading">
          <div className="search-copy">
            <p className="section-index">Probability, not prophecy</p>
            <h1 id="search-heading">Model the range.</h1>
            <p>Enter one ticker to test possible outcomes against recent price behavior and the current news signal.</p>
          </div>
          <form className="ticker-form" onSubmit={submit}>
            <label htmlFor="ticker">Stock ticker</label>
            <div className="ticker-row">
              <span className="ticker-prefix" aria-hidden="true">$</span>
              <input
                id="ticker"
                value={ticker}
                onChange={(event) => setTicker(event.target.value.toUpperCase())}
                placeholder="AAPL"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={12}
              />
              <button type="submit" disabled={analyze.isPending}>{analyze.isPending ? "Running…" : "Analyze"}</button>
            </div>
          </form>
          {message && <div className="error-message" role="alert">{message}</div>}
        </section>

        {!result && !analyze.isPending && (
          <section className="empty-state" aria-label="How the model works">
            <div><span>01</span><strong>Price history</strong><p>One year of daily closes estimates realized volatility and recent return.</p></div>
            <div><span>02</span><strong>News signal</strong><p>Recent headlines are distilled into a cautious, source-linked sentiment tilt.</p></div>
            <div><span>03</span><strong>10,000 paths</strong><p>Deterministic simulations turn those inputs into ranges, not a single target.</p></div>
          </section>
        )}

        {analyze.isPending && (
          <section className="loading-panel" aria-live="polite">
            <div className="loader" />
            <div><strong>Building the probability field</strong><p>Pulling price history, recent news, and running 10,000 paths.</p></div>
          </section>
        )}

        {result && activeForecast && (
          <div className="results">
            <section className="quote-strip">
              <div>
                <div className="ticker-name"><strong>{result.ticker}</strong><span>{result.name}</span></div>
                <div className="spot-price">{formatMoney(result.price, result.currency)}</div>
                <div className={`session-change ${(result.changePercent ?? 0) >= 0 ? "positive" : "negative"}`}>
                  {formatPercent(result.changePercent, true)} today
                </div>
              </div>
              <div className="quote-meta">
                <span>{result.marketStatus ? result.marketStatus.replaceAll("_", " ") : "Latest quote"}</span>
                <time dateTime={result.quoteAsOf ?? result.fetchedAt}>{formatTime(result.quoteAsOf ?? result.fetchedAt)}</time>
                {wasCached && <em>Cached under 10 min</em>}
                <button
                  type="button"
                  onClick={() => analyze.mutate({ symbol: result.ticker, force: true })}
                  disabled={analyze.isPending}
                  aria-label={`Refresh ${result.ticker} analysis`}
                >Refresh</button>
              </div>
            </section>

            <section className="forecast-stage" aria-labelledby="forecast-title">
              <div className="horizon-tabs" role="group" aria-label="Forecast horizon">
                {result.forecasts.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={selected === item.key ? "active" : ""}
                    aria-pressed={selected === item.key}
                    onClick={() => setSelected(item.key)}
                  >{item.key}</button>
                ))}
              </div>

              <div className="forecast-grid">
                <div className="forecast-summary">
                  <p className="section-index" id="forecast-title">{horizonNames[activeForecast.key]} · {activeForecast.tradingDays} trading {activeForecast.tradingDays === 1 ? "session" : "sessions"}</p>
                  <div className="probability-number">{Math.round(activeForecast.probabilityAboveSpot * 100)}<span>%</span></div>
                  <p className="probability-label">of simulated paths finish above the current price</p>
                  <RangeRail analysis={result} horizon={activeForecast} />
                </div>
                <div className="distribution-chart" aria-label={`${activeForecast.key} simulated terminal price distribution`}>
                  <div className="chart-heading"><strong>Terminal price distribution</strong><span>10,000 paths</span></div>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={activeForecast.histogram} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--grid)" />
                      <XAxis dataKey="midpoint" tickFormatter={(v: number) => formatMoney(v, result.currency, 0)} tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
                      <YAxis tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={{ fill: "var(--dim)", fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                      <Tooltip
                        cursor={{ fill: "var(--hover)" }}
                        contentStyle={{ background: "var(--surface-strong)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8 }}
                        formatter={(value: number) => [`${(value * 100).toFixed(1)}% of paths`, "Probability"]}
                        labelFormatter={(value: number) => `Around ${formatMoney(value, result.currency)}`}
                      />
                      <Bar dataKey="probability" fill="var(--accent)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="range-table" aria-labelledby="ranges-title">
              <div className="section-heading"><div><p className="section-index">Across time</p><h2 id="ranges-title">Modeled price ranges</h2></div><span>P10–P90 interval</span></div>
              <div className="range-rows">
                {result.forecasts.map((item) => (
                  <button key={item.key} type="button" onClick={() => setSelected(item.key)} className={selected === item.key ? "selected" : ""} aria-label={`Show ${horizonNames[item.key]} forecast`}>
                    <span className="range-horizon"><b>{item.key}</b><small>{item.tradingDays}d</small></span>
                    <span className="range-low">{formatMoney(item.p10, result.currency)}</span>
                    <span className="mini-rail"><i style={{ left: `${Math.max(0, Math.min(100, ((result.price - item.p10) / ((item.p90 - item.p10) || 1)) * 100))}%` }} /></span>
                    <span className="range-high">{formatMoney(item.p90, result.currency)}</span>
                    <span className="range-chance">{Math.round(item.probabilityAboveSpot * 100)}% ↑</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="evidence-grid">
              <div className="market-panel">
                <div className="section-heading"><div><p className="section-index">Model inputs</p><h2>Market profile</h2></div><span>{result.history.length} sessions</span></div>
                <dl className="metrics-grid">
                  <Metric label="Realized volatility" value={formatPercent(result.realizedVolatilityPct)} />
                  <Metric label="Trailing return" value={formatPercent(result.trailingReturnPct, true)} />
                  <Metric label="Beta" value={result.beta?.toFixed(2) ?? "—"} />
                  <Metric label="Market cap" value={formatCompact(result.marketCap, result.currency)} />
                  <Metric label="52-week low" value={result.week52Low === null ? "—" : formatMoney(result.week52Low, result.currency)} />
                  <Metric label="52-week high" value={result.week52High === null ? "—" : formatMoney(result.week52High, result.currency)} />
                  <Metric label="30-day avg volume" value={formatCompact(result.averageDailyVolume)} />
                  <Metric label="Model annual drift" value={formatPercent(result.modelAnnualDriftPct, true)} />
                </dl>
                <div className="history-chart" aria-label={`${result.ticker} recent closing price history`}>
                  <ResponsiveContainer width="100%" height={170}>
                    <AreaChart data={historyData} margin={{ top: 16, right: 2, left: 0, bottom: 0 }}>
                      <defs><linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
                      <XAxis dataKey="date" hide />
                      <YAxis domain={["dataMin", "dataMax"]} hide />
                      <Tooltip
                        contentStyle={{ background: "var(--surface-strong)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8 }}
                        formatter={(value: number) => [formatMoney(value, result.currency), "Close"]}
                        labelFormatter={(value) => String(value)}
                      />
                      <Area type="monotone" dataKey="close" stroke="var(--accent)" strokeWidth={2} fill="url(#priceFill)" dot={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="chart-foot"><span>{result.historySince ?? "Start"}</span><span>Daily close</span><span>{result.historyUntil ?? "Latest"}</span></div>
                </div>
              </div>

              <div className="sentiment-panel">
                <div className="section-heading"><div><p className="section-index">Recent signal</p><h2>News sentiment</h2></div><span className={`sentiment-pill ${sentimentTone}`}>{sentimentTone}</span></div>
                <div className="sentiment-score">
                  <span>−1</span><div><i style={{ left: `${(result.sentiment.score + 1) * 50}%` }} /></div><span>+1</span>
                </div>
                <p className="confidence">Confidence {Math.round(result.sentiment.confidence * 100)}% · sentiment contributes a limited tilt to drift.</p>
                {result.sentiment.evidence.length > 0 ? (
                  <ul className="evidence-list">
                    {result.sentiment.evidence.map((item, index) => <li key={`${item.sourceUrl}-${index}`}><p>{item.summary}</p><a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceTitle}</a></li>)}
                  </ul>
                ) : <p className="empty-copy">No clear source-backed sentiment signal was available. The model used a neutral news tilt.</p>}
                {result.sentiment.risks.length > 0 && <div className="risk-list"><strong>Watch items</strong>{result.sentiment.risks.map((risk, index) => <p key={index}>{risk}</p>)}</div>}
              </div>
            </section>

            <section className="news-section" aria-labelledby="news-title">
              <div className="section-heading"><div><p className="section-index">Source trail</p><h2 id="news-title">Recent coverage</h2></div><span>{result.news.length} results</span></div>
              {result.news.length > 0 ? (
                <div className="news-list">
                  {result.news.map((item) => (
                    <article key={item.url}>
                      <div><span>{item.source}</span>{(item.publishedAt || item.freshness) && <time>{item.publishedAt ?? item.freshness}</time>}</div>
                      <h3><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></h3>
                      <p>{item.snippet.replace(/^Last Updated:.*\n|^Last Crawl:.*\n/gm, "").slice(0, 280)}</p>
                    </article>
                  ))}
                </div>
              ) : <p className="empty-copy">Recent coverage was unavailable for this run. Price-based forecasts are shown with a neutral news tilt.</p>}
            </section>

            <details className="methodology">
              <summary>How to read this model</summary>
              <div>
                <p>The model estimates daily log-return volatility from the available one-year history, shrinks the historical mean return 70% toward zero, and adds a sentiment adjustment of at most ±8 percentage points annualized.</p>
                <p>It then runs {result.simulationCount.toLocaleString()} seeded geometric-Brownian paths. P10–P90 contains the middle 80% of simulated terminal prices; it is not an 80% guarantee. Earnings, gaps, regime changes, dilution, and other discontinuities can fall outside the model.</p>
                <p>Use this as a research aid, not financial advice or a promise of future performance.</p>
                {result.sources.length > 0 && <p className="sources">Quote source: {result.sources.map((source, index) => <span key={source.url}>{index > 0 ? ", " : ""}<a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></span>)}</p>}
              </div>
            </details>
          </div>
        )}
      </main>
    </div>
  );
}
