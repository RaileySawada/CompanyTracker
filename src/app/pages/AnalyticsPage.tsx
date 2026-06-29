import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { FaIcon } from "../components/FaIcon";
import { formatDateLabel, todayKey, toDateKey } from "../lib/dates";
import type { Company } from "../types";

type AnalyticsMode = "daily" | "overall";
type CompanyStatus = "applied" | "rejected" | "rescheduled" | "pending";
type ChartMetric = "added" | "applied" | "rejected" | "rescheduled";
type ChartBucket = Record<ChartMetric, number> & {
  label: string;
};

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function dateFromKey(value: string) {
  return new Date(`${value}T00:00:00`);
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
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

function hasValue(value?: string) {
  return Boolean(value?.trim());
}

function getCompanyStatus(company: Company, currentDateKey: string): CompanyStatus {
  if (hasValue(company.appliedAt)) {
    return "applied";
  }

  if (hasValue(company.rejectedAt)) {
    return "rejected";
  }

  if (toDateKey(company.createdAt) > currentDateKey) {
    return "rescheduled";
  }

  return "pending";
}

function getPercent(count: number, total: number) {
  return total ? (count / total) * 100 : 0;
}

function formatPercent(value: number) {
  return Math.round(value);
}

function createBucket(date: Date): ChartBucket {
  return {
    label: formatShortDate(date.toISOString()),
    added: 0,
    applied: 0,
    rejected: 0,
    rescheduled: 0,
  };
}

function addEvent(bucket: ChartBucket | undefined, metric: ChartMetric) {
  if (bucket) {
    bucket[metric] += 1;
  }
}

function buildChartData(companies: Company[], mode: AnalyticsMode, today: Date, todayDateKey: string) {
  const dayMap = new Map<string, ChartBucket>();
  const todayKeyValue = toDateKey(today);
  const eventKeys = companies
    .flatMap((company) => [company.createdAt, company.appliedAt, company.rejectedAt])
    .filter((value): value is string => hasValue(value))
    .map(toDateKey)
    .filter((key) => key <= todayKeyValue);

  if (mode === "daily" || eventKeys.length === 0) {
    for (let dayOffset = 5; dayOffset >= 0; dayOffset -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - dayOffset);
      dayMap.set(toDateKey(date), createBucket(date));
    }
  } else {
    const startDate = dateFromKey([...eventKeys].sort()[0]);
    const endDate = dateFromKey(todayKeyValue);

    for (const date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      dayMap.set(toDateKey(date), createBucket(date));
    }
  }

  companies.forEach((company) => {
    const status = getCompanyStatus(company, todayDateKey);
    const createdKey = toDateKey(company.createdAt);

    addEvent(dayMap.get(createdKey), status === "rescheduled" ? "rescheduled" : "added");

    if (status === "applied") {
      addEvent(dayMap.get(toDateKey(company.appliedAt)), "applied");
    }

    if (status === "rejected") {
      addEvent(dayMap.get(toDateKey(company.rejectedAt)), "rejected");
    }
  });

  const buckets = Array.from(dayMap.values());

  if (mode === "daily") {
    return buckets;
  }

  let added = 0;
  let applied = 0;
  let rejected = 0;
  let rescheduled = 0;

  return buckets.map((bucket) => {
    added += bucket.added;
    applied += bucket.applied;
    rejected += bucket.rejected;
    rescheduled += bucket.rescheduled;

    return {
      ...bucket,
      added,
      applied,
      rejected,
      rescheduled,
    };
  });
}

export function AnalyticsPage({ companies }: { companies: Company[] }) {
  const [mode, setMode] = useState<AnalyticsMode>("daily");
  const today = useMemo(() => new Date(), []);
  const todayDateKey = todayKey();
  const companiesByStatus = companies.reduce<Record<CompanyStatus, Company[]>>(
    (groups, company) => {
      groups[getCompanyStatus(company, todayDateKey)].push(company);
      return groups;
    },
    {
      applied: [],
      pending: [],
      rejected: [],
      rescheduled: [],
    },
  );
  const appliedCompanies = companiesByStatus.applied;
  const rejectedCompanies = companiesByStatus.rejected;
  const rescheduledCompanies = companiesByStatus.rescheduled;
  const pendingCompanies = companiesByStatus.pending;
  const todayAdded = companies.filter((company) => sameDay(new Date(company.createdAt), today)).length;
  const todayApplied = appliedCompanies.filter((company) =>
    sameDay(new Date(company.appliedAt || ""), today),
  ).length;
  const todayRejected = rejectedCompanies.filter((company) =>
    sameDay(new Date(company.rejectedAt || ""), today),
  ).length;
  const appliedPercent = getPercent(appliedCompanies.length, companies.length);
  const rejectedPercent = getPercent(rejectedCompanies.length, companies.length);
  const rescheduledPercent = getPercent(rescheduledCompanies.length, companies.length);
  const pendingPercent = getPercent(pendingCompanies.length, companies.length);
  const rejectedStop = appliedPercent + rejectedPercent;
  const rescheduledStop = rejectedStop + rescheduledPercent;
  const chartData = useMemo(
    () => buildChartData(companies, mode, today, todayDateKey),
    [companies, mode, today, todayDateKey],
  );
  const chartCopy =
    mode === "daily"
      ? "Companies added, applied, rejected, and rescheduled over the last six days."
      : "Cumulative company activity from the first record through today.";
  const chartValues = chartData.map(
    (item) => item.added + item.applied + item.rejected + item.rescheduled,
  );
  const maxChartValue = Math.max(1, ...chartValues);
  const visibleCards =
    mode === "daily"
      ? [
          { label: "Added today", value: todayAdded, icon: "plus" as const },
          { label: "Applied today", value: todayApplied, icon: "check" as const },
          { label: "Rejected today", value: todayRejected, icon: "xmark" as const },
          { label: "Scheduled future", value: rescheduledCompanies.length, icon: "building" as const },
        ]
      : [
          { label: "Total companies", value: companies.length, icon: "building" as const },
          { label: "Applied companies", value: appliedCompanies.length, icon: "check" as const },
          { label: "Rejected companies", value: rejectedCompanies.length, icon: "xmark" as const },
          { label: "Pending companies", value: pendingCompanies.length, icon: "building" as const },
        ];
  const linePoints = chartData.map((item, index) => {
    const x = 8 + index * (84 / Math.max(1, chartData.length - 1));
    const value = chartValues[index] ?? 0;
    const y = 78 - (value / maxChartValue) * 58;
    return { ...item, x, y, value };
  });
  const linePath = buildSmoothPath(linePoints);
  const lastPoint = linePoints[linePoints.length - 1];
  const firstPoint = linePoints[0];
  const areaPath = linePoints.length
    ? `${linePath} L ${lastPoint.x.toFixed(2)} 88 L ${firstPoint.x.toFixed(2)} 88 Z`
    : "";
  const labelIndexes = new Set(
    linePoints
      .map((_, index) => index)
      .filter((index) => {
        if (linePoints.length <= 6 || index === 0 || index === linePoints.length - 1) {
          return true;
        }

        const interval = Math.ceil((linePoints.length - 2) / 4);
        return (index - 1) % interval === 0;
      }),
  );
  const visibleLineLabels = linePoints.filter((_, index) => labelIndexes.has(index));

  return (
    <section className="analytics-page">
      <div className="content-heading">
        <div>
          <p className="eyebrow">Analytics</p>
          <h2>Application dashboard</h2>
          <p>Daily activity, all-time progress, rejected records, and rescheduled companies.</p>
        </div>
        <div className="segmented-control" aria-label="Analytics period">
          <button
            className={mode === "daily" ? "active" : ""}
            type="button"
            onClick={() => setMode("daily")}
          >
            Daily
          </button>
          <button
            className={mode === "overall" ? "active" : ""}
            type="button"
            onClick={() => setMode("overall")}
          >
            Overall
          </button>
        </div>
      </div>

      <div className="summary-grid analytics-summary-grid">
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
              <h3>{mode === "daily" ? "Recent activity" : "Overall activity"}</h3>
              <p>{chartCopy}</p>
            </div>
            <div className="chart-legend">
              <span>
                <i className="legend-blue" />
                Added
              </span>
              <span>
                <i className="legend-green" />
                Applied
              </span>
              <span>
                <i className="legend-red" />
                Rejected
              </span>
              <span>
                <i className="legend-cyan" />
                Rescheduled
              </span>
            </div>
          </div>
          <div className="forecast-chart" aria-label={`${mode} company activity chart`}>
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
                  className={`forecast-point ${
                    point.x < 14 ? "edge-start" : point.x > 86 ? "edge-end" : ""
                  } ${point.y < 30 ? "tooltip-below" : ""}`}
                  key={`${point.label}-${point.x}`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` } as CSSProperties}
                >
                  <span className="chart-tooltip">
                    <strong>{point.label}</strong>
                    <small>Added: {point.added}</small>
                    <small>Applied: {point.applied}</small>
                    <small>Rejected: {point.rejected}</small>
                    <small>Rescheduled: {point.rescheduled}</small>
                    <small>Total: {point.value}</small>
                  </span>
                </span>
              ))}
            </div>
            <div className="forecast-labels">
              {visibleLineLabels.map((point) => (
                <span key={`${point.label}-${point.x}`}>
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
              <p>Overall applied, rejected, pending, and rescheduled companies.</p>
            </div>
          </div>
          <div className="donut-wrap">
            <div
              className="donut-chart"
              style={
                {
                  background: `conic-gradient(
                    #67e8f9 0 ${appliedPercent}%,
                    #fb7185 ${appliedPercent}% ${rejectedStop}%,
                    #38bdf8 ${rejectedStop}% ${rescheduledStop}%,
                    #155e75 ${rescheduledStop}% 100%
                  )`,
                } as CSSProperties
              }
              tabIndex={0}
            >
              <span className="donut-center">
                <strong>{formatPercent(appliedPercent)}%</strong>
                <span>applied</span>
              </span>
              <span className="chart-tooltip donut-tooltip">
                <strong>Application status</strong>
                <small>
                  Applied: {appliedCompanies.length} ({formatPercent(appliedPercent)}%)
                </small>
                <small>
                  Rejected: {rejectedCompanies.length} ({formatPercent(rejectedPercent)}%)
                </small>
                <small>
                  Rescheduled: {rescheduledCompanies.length} ({formatPercent(rescheduledPercent)}%)
                </small>
                <small>
                  Pending: {pendingCompanies.length} ({formatPercent(pendingPercent)}%)
                </small>
              </span>
            </div>
            <div className="donut-list">
              <span>
                <i className="legend-green" />
                Applied <strong>{appliedCompanies.length}</strong>
                <em>{formatPercent(appliedPercent)}% of companies</em>
              </span>
              <span>
                <i className="legend-red" />
                Rejected <strong>{rejectedCompanies.length}</strong>
                <em>{formatPercent(rejectedPercent)}% of companies</em>
              </span>
              <span>
                <i className="legend-cyan" />
                Rescheduled <strong>{rescheduledCompanies.length}</strong>
                <em>{formatPercent(rescheduledPercent)}% of companies</em>
              </span>
              <span>
                <i className="legend-orange" />
                Pending <strong>{pendingCompanies.length}</strong>
                <em>{formatPercent(pendingPercent)}% of companies</em>
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
                <span>
                  <FaIcon name="check" />
                </span>
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

      <section className="applied-panel">
        <div className="panel-heading">
          <div>
            <h3>Rejected companies</h3>
            <p>Companies marked as rejected from the detail page.</p>
          </div>
        </div>
        {rejectedCompanies.length ? (
          <div className="applied-list status-list rejected-list">
            {rejectedCompanies.map((company) => (
              <article key={company.id}>
                <span>
                  <FaIcon name="xmark" />
                </span>
                <div>
                  <strong>{company.name}</strong>
                  <small>{company.locationLabel}</small>
                </div>
                <time>{company.rejectedAt ? formatShortDate(company.rejectedAt) : ""}</time>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-sidebar compact">
            <h3>No rejected companies</h3>
            <p>Rejected companies will appear here.</p>
          </div>
        )}
      </section>

      <section className="applied-panel">
        <div className="panel-heading">
          <div>
            <h3>Rescheduled companies</h3>
            <p>Companies moved to tomorrow or another future date.</p>
          </div>
        </div>
        {rescheduledCompanies.length ? (
          <div className="applied-list status-list rescheduled-list">
            {rescheduledCompanies.map((company) => (
              <article key={company.id}>
                <span>
                  <FaIcon name="calendar" />
                </span>
                <div>
                  <strong>{company.name}</strong>
                  <small>{company.locationLabel}</small>
                </div>
                <time>{formatDateLabel(toDateKey(company.createdAt))}</time>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-sidebar compact">
            <h3>No rescheduled companies</h3>
            <p>Future-dated companies will appear here.</p>
          </div>
        )}
      </section>
    </section>
  );
}
