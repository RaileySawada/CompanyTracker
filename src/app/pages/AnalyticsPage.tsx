import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { FaIcon } from "../components/FaIcon";
import type { Company } from "../types";

type AnalyticsMode = "daily" | "overall";

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }

  return points.reduce((path, point, index, allPoints) => {
    if (index === 0) {
      return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    const previous = allPoints[index - 1];
    const controlX = previous.x + (point.x - previous.x) / 2;
    return `${path} C ${controlX.toFixed(2)} ${previous.y.toFixed(2)}, ${controlX.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, "");
}

export function AnalyticsPage({ companies }: { companies: Company[] }) {
  const [mode, setMode] = useState<AnalyticsMode>("daily");
  const today = useMemo(() => new Date(), []);
  const appliedCompanies = companies.filter((company) => company.appliedAt);
  const pendingCompanies = companies.length - appliedCompanies.length;
  const todayAdded = companies.filter((company) => sameDay(new Date(company.createdAt), today)).length;
  const todayApplied = appliedCompanies.filter((company) => sameDay(new Date(company.appliedAt || ""), today)).length;
  const appliedPercent = companies.length ? Math.round((appliedCompanies.length / companies.length) * 100) : 0;
  const pendingPercent = companies.length ? 100 - appliedPercent : 0;

  const chartData = useMemo(() => {
    const dayMap = new Map<string, { label: string; added: number; applied: number }>();

    for (let dayOffset = 5; dayOffset >= 0; dayOffset -= 1) {
      const date = new Date();
      date.setDate(today.getDate() - dayOffset);
      const key = date.toISOString().slice(0, 10);
      dayMap.set(key, { label: formatShortDate(date.toISOString()), added: 0, applied: 0 });
    }

    companies.forEach((company) => {
      const createdKey = new Date(company.createdAt).toISOString().slice(0, 10);
      const createdBucket = dayMap.get(createdKey);
      if (createdBucket) {
        createdBucket.added += 1;
      }

      if (company.appliedAt) {
        const appliedKey = new Date(company.appliedAt).toISOString().slice(0, 10);
        const appliedBucket = dayMap.get(appliedKey);
        if (appliedBucket) {
          appliedBucket.applied += 1;
        }
      }
    });

    return Array.from(dayMap.values());
  }, [companies, today]);

  const maxChartValue = Math.max(1, ...chartData.map((item) => Math.max(item.added, item.applied)));
  const dailyCards = [
    { label: "Added today", value: todayAdded, icon: "plus" as const },
    { label: "Applied today", value: todayApplied, icon: "check" as const },
    { label: "Pending targets", value: pendingCompanies, icon: "building" as const },
  ];
  const overallCards = [
    { label: "Total companies", value: companies.length, icon: "building" as const },
    { label: "Applied companies", value: appliedCompanies.length, icon: "check" as const },
    { label: "Application rate", value: `${appliedPercent}%`, icon: "chart" as const },
  ];
  const visibleCards = mode === "daily" ? dailyCards : overallCards;
  const linePoints = chartData.map((item, index) => {
    const x = 8 + index * (84 / Math.max(1, chartData.length - 1));
    const value = mode === "daily" ? item.added + item.applied : item.applied;
    const y = 82 - (value / maxChartValue) * 64;
    return { ...item, x, y, value };
  });
  const linePath = buildSmoothPath(linePoints);
  const lastPoint = linePoints[linePoints.length - 1];
  const firstPoint = linePoints[0];
  const areaPath = linePoints.length
    ? `${linePath} L ${lastPoint.x.toFixed(2)} 92 L ${firstPoint.x.toFixed(2)} 92 Z`
    : "";

  return (
    <section className="analytics-page">
      <div className="content-heading">
        <div>
          <p className="eyebrow">Analytics</p>
          <h2>Application dashboard</h2>
          <p>Daily activity, total progress, and applied company records.</p>
        </div>
        <div className="segmented-control" aria-label="Analytics period">
          <button className={mode === "daily" ? "active" : ""} type="button" onClick={() => setMode("daily")}>
            Daily
          </button>
          <button className={mode === "overall" ? "active" : ""} type="button" onClick={() => setMode("overall")}>
            Overall
          </button>
        </div>
      </div>

      <div className="summary-grid">
        {visibleCards.map((card) => (
          <article className="summary-card" key={card.label}>
            <span>
              <FaIcon name={card.icon} />
            </span>
            <div>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
            </div>
          </article>
        ))}
      </div>

      <div className="analytics-grid">
        <section className="chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Recent activity</h3>
              <p>Companies added and marked as applied over the last six days.</p>
            </div>
            <div className="chart-legend">
              <span><i className="legend-blue" />Added</span>
              <span><i className="legend-green" />Applied</span>
            </div>
          </div>
          <div className="forecast-chart" aria-label="Recent company activity chart">
            <svg viewBox="0 0 100 100" role="img" aria-hidden="true" preserveAspectRatio="none">
              <defs>
                <linearGradient id="activityFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.54" />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity="0.08" />
                </linearGradient>
              </defs>
              <g className="chart-grid-lines">
                <line x1="8" x2="94" y1="18" y2="18" />
                <line x1="8" x2="94" y1="38" y2="38" />
                <line x1="8" x2="94" y1="58" y2="58" />
                <line x1="8" x2="94" y1="78" y2="78" />
              </g>
              <path className="forecast-area" d={areaPath} />
              <path className="forecast-line" d={linePath} />
            </svg>
            <div className="forecast-points" aria-hidden="true">
              {linePoints.map((point) => (
                <span
                  className="forecast-point"
                  key={point.label}
                  style={{ left: `${point.x}%`, top: `${point.y}%` } as CSSProperties}
                >
                  <span className="chart-tooltip">
                    <strong>{point.label}</strong>
                    <small>Added: {point.added}</small>
                    <small>Applied: {point.applied}</small>
                    <small>Total: {point.value}</small>
                  </span>
                </span>
              ))}
            </div>
            <div className="forecast-labels">
              {linePoints.map((point) => (
                <span key={point.label}>
                  <strong>{point.value}</strong>
                  <small>{point.label}</small>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="chart-panel donut-panel">
          <div className="panel-heading">
            <div>
              <h3>Application status</h3>
              <p>Overall applied versus pending companies.</p>
            </div>
          </div>
          <div className="donut-wrap">
            <div
              className="donut-chart"
              style={{ "--applied": `${appliedPercent}%` } as CSSProperties}
              tabIndex={0}
            >
              <span className="donut-center">
                <strong>{appliedPercent}%</strong>
                <span>applied</span>
              </span>
              <span className="chart-tooltip donut-tooltip">
                <strong>Application status</strong>
                <small>Applied: {appliedCompanies.length} ({appliedPercent}%)</small>
                <small>Pending: {pendingCompanies} ({pendingPercent}%)</small>
              </span>
            </div>
            <div className="donut-list">
              <span>
                <i className="legend-green" />Applied <strong>{appliedCompanies.length}</strong>
                <em>{appliedPercent}% of companies</em>
              </span>
              <span>
                <i className="legend-orange" />Pending <strong>{pendingCompanies}</strong>
                <em>{pendingPercent}% of companies</em>
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="applied-panel">
        <div className="panel-heading">
          <div>
            <h3>Applied companies</h3>
            <p>Companies marked as applied from the sidebar or detail page.</p>
          </div>
        </div>
        {appliedCompanies.length ? (
          <div className="applied-list">
            {appliedCompanies.map((company) => (
              <article key={company.id}>
                <span><FaIcon name="check" /></span>
                <div>
                  <strong>{company.name}</strong>
                  <small>{company.locationLabel}</small>
                </div>
                <time>{company.appliedAt ? formatShortDate(company.appliedAt) : ""}</time>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-sidebar compact">
            <h3>No applied companies yet</h3>
            <p>Use Mark as applied on a selected company to populate this list.</p>
          </div>
        )}
      </section>
    </section>
  );
}
