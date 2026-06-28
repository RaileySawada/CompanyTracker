import type { Company, GeoPoint } from "../types";
import { mapsEmbedUrl } from "../lib/geo";

export function MapPanel({
  className = "",
  company,
  placeholder = "Map preview appears here",
  userLocation,
}: {
  className?: string;
  company?: Company;
  placeholder?: string;
  userLocation?: GeoPoint | null;
}) {
  return (
    <div className={`map-panel ${className}`}>
      {company ? (
        <iframe
          title={`Google Map for ${company.name}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={mapsEmbedUrl(company, userLocation)}
        />
      ) : (
        <div className="map-placeholder">
          <span>{placeholder}</span>
        </div>
      )}
    </div>
  );
}
