import { CompanySidebar } from "../components/CompanySidebar";
import { MapPanel } from "../components/MapPanel";
import { StatCard } from "../components/StatCard";
import { ARRIVAL_RADIUS_METERS, directionsUrl, formatDistance } from "../lib/geo";
import type { Company, GeoPoint } from "../types";

export function ViewPage({
  companies,
  deleteCompany,
  distance,
  geoError,
  goToNextCompany,
  isArrived,
  mapOrigin,
  reorderCompanies,
  selectedCompany,
  selectedId,
  setSelectedId,
  startEditingCompany,
  startNewCompany,
  userLocation,
}: {
  companies: Company[];
  deleteCompany: (id: string) => void;
  distance: number | null;
  geoError: string;
  goToNextCompany: () => void;
  isArrived: boolean;
  mapOrigin: GeoPoint | null;
  reorderCompanies: (sourceId: string, targetId: string) => void;
  selectedCompany?: Company;
  selectedId: string;
  setSelectedId: (id: string) => void;
  startEditingCompany: (id: string) => void;
  startNewCompany: () => void;
  userLocation: GeoPoint | null;
}) {
  const gpsStatus = geoError || (userLocation ? "GPS connected" : "Requesting GPS");
  const arrivalState = isArrived ? "You're here" : "En route";

  return (
    <section className="tracker-layout">
      <CompanySidebar
        companies={companies}
        deleteCompany={deleteCompany}
        reorderCompanies={reorderCompanies}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        startEditingCompany={startEditingCompany}
        startNewCompany={startNewCompany}
      />

      <section className="workspace-panel">
        {selectedCompany ? (
          <>
            <div className="workspace-hero">
              <div>
                <p className="eyebrow">Destination</p>
                <h1>{selectedCompany.name}</h1>
                <p>{selectedCompany.locationLabel}</p>
              </div>
              <div className="hero-actions">
                <div className="terminal-status">
                  <span className="window-dot red" />
                  <span className="window-dot yellow" />
                  <span className="window-dot green" />
                  <code>gps: live</code>
                </div>
                <a
                  className="icon-link"
                  href={directionsUrl(selectedCompany, userLocation)}
                  rel="noreferrer"
                  target="_blank"
                  title="Open directions"
                  aria-label="Open directions in Google Maps"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M7 17 17 7" />
                    <path d="M9 7h8v8" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="map-stage">
              {isArrived ? (
                <div className="arrival-banner" role="status">
                  <span className="arrival-pulse" aria-hidden="true" />
                  <div>
                    <strong>You're here</strong>
                    <small>Within {ARRIVAL_RADIUS_METERS} meters of this company.</small>
                  </div>
                  <button type="button" onClick={goToNextCompany}>
                    Next
                  </button>
                </div>
              ) : null}
              <MapPanel company={selectedCompany} userLocation={mapOrigin} />
              <div className="route-card">
                <p className="eyebrow">Distance</p>
                <strong>{formatDistance(distance)}</strong>
                <span>{arrivalState}</span>
              </div>
            </div>

            <div className="stats-grid">
              <StatCard label="Open roles" value={selectedCompany.positions || "Not specified"} />
              <StatCard
                label="Coordinates"
                value={`${selectedCompany.latitude.toFixed(5)}, ${selectedCompany.longitude.toFixed(5)}`}
              />
              <StatCard label="GPS status" value={gpsStatus} tone={geoError ? "warn" : "good"} />
            </div>
          </>
        ) : (
          <div className="empty-workspace">
            <p className="eyebrow">No destination</p>
            <h1>Add a company first</h1>
            <p>Save a required map location, then this workspace will track live directions.</p>
            <button className="primary-action" type="button" onClick={startNewCompany}>
              Add company
            </button>
          </div>
        )}
      </section>

    </section>
  );
}
