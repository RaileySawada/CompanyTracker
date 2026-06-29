import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { FaIcon } from "../components/FaIcon";
import { toDateKey } from "../lib/dates";
import type { Company } from "../types";

type AnalyticsMode = "daily" | "overall";

const VB_W = 200;
const VB_H = 80;

const CHART = {
  x0: 10,
  x1: 192,
  yTop: 8,
  yBot: 58,
  yLabel: 70,
};
const Y_RANGE = CHART.yBot - CHART.yTop;

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
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
  const todayAdded = companies.filter((company) =>
    sameDay(new Date(company.createdAt), today),
  ).length;
  const todayApplied = appliedCompanies.filter((company) =>
    sameDay(new Date(company.appliedAt || ""), today),
  ).length;
  const appliedPercent = companies.length
    ? Math.round((appliedCompanies.length / companies.length) * 100)
    : 0;
  const pendingPercent = companies.length ? 100 - appliedPercent : 0;

  const chartData = useMemo(() => {
    const dayMap = new Map<
      string,
      { label: string; added: number; applied: number }
    >();

    for (let dayOffset = 5; dayOffset >= 0; dayOffset -= 1) {
      const date = new Date();
      date.setDate(today.getDate() - dayOffset);
      const key = toDateKey(date);
      dayMap.set(key, {
        label: formatShortDate(date.toISOString()),
        added: 0,
        applied: 0,
      });
    }

    companies.forEach((company) => {
      const createdKey = toDateKey(company.createdAt);
      const createdBucket = dayMap.get(createdKey);
      if (createdBucket) createdBucket.added += 1;

      if (company.appliedAt) {
        const appliedKey = toDateKey(company.appliedAt);
        const appliedBucket = dayMap.get(appliedKey);
        if (appliedBucket) appliedBucket.applied += 1;
      }
    });

    return Array.from(dayMap.values());
  }, [companies, today]);

  const maxChartValue = Math.max(
    1,
    ...chartData.map((item) => Math.max(item.added, item.applied)),
  );

  const dailyCards = [
    { label: "Added today", value: todayAdded, icon: "plus" as const },
    { label: "Applied today", value: todayApplied, icon: "check" as const },
    {
      label: "Pending targets",
      value: pendingCompanies,
      icon: "building" as const,
    },
  ];
  const overallCards = [
    {
      label: "Total companies",
      value: companies.length,
      icon: "building" as const,
    },
    {
      label: "Applied companies",
      value: appliedCompanies.length,
      icon: "check" as const,
    },
    {
      label: "Application rate",
      value: `${appliedPercent}%`,
      icon: "chart" as const,
    },
  ];
  const visibleCards = mode === "daily" ? dailyCards : overallCards;

  const linePoints = chartData.map((item, index) => {
    const x =
      CHART.x0 +
      index * ((CHART.x1 - CHART.x0) / Math.max(1, chartData.length - 1));
    const value = mode === "daily" ? item.added + item.applied : item.applied;
    const y = CHART.yBot - (value / maxChartValue) * (Y_RANGE - 4) - 2;
    return { ...item, x, y, value };
  });

  const linePath = buildSmoothPath(linePoints);
  const lastPoint = linePoints[linePoints.length - 1];
  const firstPoint = linePoints[0];

  const areaPath = linePoints.length
    ? `${linePath} L ${lastPoint.x.toFixed(2)} ${CHART.yBot} L ${firstPoint.x.toFixed(2)} ${CHART.yBot} Z`
    : "";

  const clip = {
    x: CHART.x0,
    y: CHART.yTop - 4,
    w: CHART.x1 - CHART.x0,
    h: CHART.yBot - CHART.yTop + 8,
  };

  const gridYs = [
    CHART.yTop + Y_RANGE * 0.0,
    CHART.yTop + Y_RANGE * 0.33,
    CHART.yTop + Y_RANGE * 0.66,
    CHART.yTop + Y_RANGE * 1.0,
  ];

  return (
    <section className="analytics-page">
      <div className="content-heading">
        <div>
          <p className="eyebrow">Analytics</p>
          <h2>Application dashboard</h2>
          <p>Daily activity, total progress, and applied company records.</p>
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
              <p>
                Companies added and marked as applied over the last six days.
              </p>
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
            </div>
          </div>

          <div
            className="forecast-chart"
            aria-label="Recent company activity chart"
          >
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              role="img"
              aria-label="Line chart of companies added and applied over the last 6 days"
              style={{ width: "100%", height: "100%", display: "block" }}
            >
              <defs>
                <linearGradient id="activityFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity="0.06" />
                </linearGradient>
                <clipPath id="chartClip">
                  <rect x={clip.x} y={clip.y} width={clip.w} height={clip.h} />
                </clipPath>
              </defs>

              <g className="chart-grid-lines">
                {gridYs.map((y) => (
                  <line key={y} x1={CHART.x0} x2={CHART.x1} y1={y} y2={y} />
                ))}
              </g>

              <g clipPath="url(#chartClip)">
                <path className="forecast-area" d={areaPath} />
                <path className="forecast-line" d={linePath} />
              </g>

              {linePoints.map((point) => (
                <g key={point.label} className="forecast-point-group">
                  <rect
                    x={point.x - 10}
                    y={CHART.yTop}
                    width="20"
                    height={CHART.yBot - CHART.yTop + 4}
                    fill="transparent"
                  />

                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="2.2"
                    className="forecast-dot"
                  />

                  <text
                    x={point.x}
                    y={point.y - 4}
                    textAnchor="middle"
                    className="forecast-value-label"
                  >
                    {point.value}
                  </text>

                  <text
                    x={point.x}
                    y={CHART.yLabel}
                    textAnchor="middle"
                    className="forecast-date-label"
                  >
                    {point.label}
                  </text>

                  <g
                    className="chart-tooltip-group"
                    style={{ pointerEvents: "none" }}
                  >
                    <foreignObject
                      x={point.x - 18}
                      y={point.y - 30}
                      width="36"
                      height="26"
                      style={{ overflow: "visible" }}
                    >
                      <span className="chart-tooltip svg-tooltip">
                        <strong>{point.label}</strong>
                        <small>Added: {point.added}</small>
                        <small>Applied: {point.applied}</small>
                        <small>Total: {point.value}</small>
                      </span>
                    </foreignObject>
                  </g>
                </g>
              ))}
            </svg>
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
                <small>
                  Applied: {appliedCompanies.length} ({appliedPercent}%)
                </small>
                <small>
                  Pending: {pendingCompanies} ({pendingPercent}%)
                </small>
              </span>
            </div>
            <div className="donut-list">
              <span>
                <i className="legend-green" />
                Applied <strong>{appliedCompanies.length}</strong>
                <em>{appliedPercent}% of companies</em>
              </span>
              <span>
                <i className="legend-orange" />
                Pending <strong>{pendingCompanies}</strong>
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
                <span>
                  <FaIcon name="check" />
                </span>
                <div>
                  <strong>{company.name}</strong>
                  <small>{company.locationLabel}</small>
                </div>
                <time>
                  {company.appliedAt ? formatShortDate(company.appliedAt) : ""}
                </time>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-sidebar compact">
            <h3>No applied companies yet</h3>
            <p>
              Use Mark as applied on a selected company to populate this list.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}
