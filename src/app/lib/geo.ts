import type { Company, GeoPoint } from "../types";

export const ARRIVAL_RADIUS_METERS = 90;

export function metersBetween(a: GeoPoint, b: GeoPoint) {
  const earthRadius = 6371e3;
  const latA = (a.latitude * Math.PI) / 180;
  const latB = (b.latitude * Math.PI) / 180;
  const deltaLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const deltaLng = ((b.longitude - a.longitude) * Math.PI) / 180;

  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(latA) *
      Math.cos(latB) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistance(distance: number | null) {
  if (distance === null) {
    return "Waiting for GPS";
  }

  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)} km away`;
  }

  return `${Math.round(distance)} m away`;
}

export function parseCoordinates(value: string): GeoPoint | null {
  const trimmed = value.trim();
  const atMatch = trimmed.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const queryMatch = trimmed.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const plainMatch = trimmed.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  const match = atMatch ?? queryMatch ?? plainMatch;

  if (!match) {
    return null;
  }

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);

  if (
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

export function mapsEmbedUrl(company: Company, userLocation?: GeoPoint | null) {
  const destination = `${company.latitude},${company.longitude}`;

  if (userLocation) {
    return `https://www.google.com/maps?output=embed&saddr=${userLocation.latitude},${userLocation.longitude}&daddr=${destination}`;
  }

  return `https://www.google.com/maps?q=${destination}&z=15&output=embed`;
}

export function directionsUrl(company: Company, userLocation?: GeoPoint | null) {
  const destination = `${company.latitude},${company.longitude}`;

  if (userLocation) {
    return `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${destination}&travelmode=driving`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${destination}`;
}
