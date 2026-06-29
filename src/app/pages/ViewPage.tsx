import { useEffect, useState } from "react";
import { FaIcon } from "../components/FaIcon";
import { MapPanel } from "../components/MapPanel";
import { StatCard } from "../components/StatCard";
import { tomorrowKey } from "../lib/dates";
import { ARRIVAL_RADIUS_METERS, directionsUrl, formatDistance } from "../lib/geo";
import type { Company, GeoPoint } from "../types";

export function ViewPage({
  deleteCompany,
  distance,
  geoError,
  goToNextCompany,
  isArrived,
  markCompanyApplied,
  markCompanyRejected,
  rescheduleCompany,
  selectedCompany,
  startEditingCompany,
  startNewCompany,
  userLocation,
}: {
  deleteCompany: (id: string) => void;
  distance: number | null;
  geoError: string;
  goToNextCompany: () => void;
  isArrived: boolean;
  markCompanyApplied: (id: string) => void;
  markCompanyRejected: (id: string) => void;
  rescheduleCompany: (id: string, dateKey: string) => void;
  selectedCompany?: Company;
  startEditingCompany: (id: string) => void;
  startNewCompany: () => void;
  userLocation: GeoPoint | null;
}) {
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(tomorrowKey);
  const gpsStatus = geoError || (userLocation ? "GPS connected" : "Requesting GPS");
  const arrivalState = isArrived ? "You're here" : "En route";
  const companyStatus = selectedCompany?.appliedAt
    ? "Applied"
    : selectedCompany?.rejectedAt
      ? "Rejected"
      : "Pending";

  useEffect(() => {
    setIsRescheduling(false);
    setRescheduleDate(tomorrowKey());
  }, [selectedCompany?.id]);

  if (!selectedCompany) {
    return (
      <section className="empty-workspace">
        <p className="eyebrow">No destination</p>
        <h1>Add a company first</h1>
        <p>Save a required map location, then this workspace will track live directions.</p>
        <button className="primary-action" type="button" onClick={startNewCompany}>
          <FaIcon name="plus" />
          Add company
        </button>
      </section>
    );
  }

  return (
    <section className="workspace-panel">
      <div className="content-heading">
        <div>
          <p className="eyebrow">Selected company</p>
          <h2>{selectedCompany.name}</h2>
          <p>{selectedCompany.locationLabel}</p>
        </div>
        <div className="page-actions">
          <button
            className={selectedCompany.appliedAt ? "success-solid" : ""}
            type="button"
            onClick={() => markCompanyApplied(selectedCompany.id)}
          >
            <FaIcon name="check" />
            Applied
          </button>
          <button
            className={selectedCompany.rejectedAt ? "rejected-solid" : ""}
            type="button"
            onClick={() => markCompanyRejected(selectedCompany.id)}
          >
            <FaIcon name="xmark" />
            Rejected
          </button>
          <button
            aria-expanded={isRescheduling}
            aria-label={`Reschedule ${selectedCompany.name}`}
            className="mobile-icon-only"
            type="button"
            onClick={() => setIsRescheduling((current) => !current)}
          >
            <FaIcon name="calendar" />
            <span>Reschedule</span>
          </button>
          <button
            aria-label={`Edit ${selectedCompany.name}`}
            className="mobile-icon-only"
            type="button"
            onClick={() => startEditingCompany(selectedCompany.id)}
          >
            <FaIcon name="pen" />
            <span>Edit</span>
          </button>
          <button
            aria-label={`Delete ${selectedCompany.name}`}
            className="danger-button mobile-icon-only"
            type="button"
            onClick={() => deleteCompany(selectedCompany.id)}
          >
            <FaIcon name="trash" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {isRescheduling ? (
        <form
          className="reschedule-panel"
          onSubmit={(event) => {
            event.preventDefault();
            rescheduleCompany(selectedCompany.id, rescheduleDate);
            setIsRescheduling(false);
          }}
        >
          <label>
            <span>Reschedule to</span>
            <input
              min={tomorrowKey()}
              onChange={(event) => setRescheduleDate(event.target.value)}
              required
              type="date"
              value={rescheduleDate}
            />
          </label>
          <button type="submit">
            <FaIcon name="calendar" />
            Save schedule
          </button>
        </form>
      ) : null}

      <div className="map-stage">
        {isArrived ? (
          <div className="arrival-banner" role="status">
            <span className="arrival-pulse" aria-hidden="true" />
            <div>
              <strong>You're here</strong>
              <small>Within {ARRIVAL_RADIUS_METERS} meters of this company.</small>
            </div>
            <button type="button" onClick={goToNextCompany}>
              <FaIcon name="route" />
              Next
            </button>
          </div>
        ) : null}
        <MapPanel company={selectedCompany} />
        <a
          className="directions-button"
          href={directionsUrl(selectedCompany, userLocation)}
          rel="noreferrer"
          target="_blank"
        >
          <FaIcon name="directions" />
          Open directions
        </a>
        <div className="route-card">
          <p className="eyebrow">Distance</p>
          <strong>{formatDistance(distance)}</strong>
          <span>{arrivalState}</span>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Open roles" value={selectedCompany.positions || "Not specified"} />
        <StatCard
          label="Status"
          value={companyStatus}
          tone={selectedCompany.rejectedAt ? "warn" : selectedCompany.appliedAt ? "good" : undefined}
        />
        <StatCard
          label="Coordinates"
          value={`${selectedCompany.latitude.toFixed(5)}, ${selectedCompany.longitude.toFixed(5)}`}
        />
        <StatCard label="GPS status" value={gpsStatus} tone={geoError ? "warn" : "good"} />
      </div>
    </section>
  );
}
