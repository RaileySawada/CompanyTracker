import type { Company, GeoPoint } from "../types";

export const ARRIVAL_RADIUS_METERS = 90;

type GeocodeSearchResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

type GeocodeCandidate = {
  query: string;
  label?: string;
};

type GeocodeLocationOptions = {
  locationHint?: string;
  userLocation?: GeoPoint | null;
};

type GeocodeResult = GeoPoint & {
  label: string;
};

const LOCATION_ALIASES: Array<{ terms: string[]; candidate: GeocodeCandidate }> = [
  {
    terms: ["avon products manufacturing", "avon products mfg"],
    candidate: {
      query: "Calamba Premiere International Park, Batino, Calamba, Laguna, Philippines",
      label: "Avon Products Manufacturing Inc., Calamba Premiere International Park, Calamba, Laguna",
    },
  },
];

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

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function simplifyBusinessName(value: string) {
  return value
    .replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd)\b\.?/gi, "")
    .replace(/\b(manufacturing|mfg)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildGeocodeCandidates(query: string, locationHint = ""): GeocodeCandidate[] {
  const normalizedQuery = normalizeSearchText(query);
  const alias = LOCATION_ALIASES.find(({ terms }) =>
    terms.some((term) => normalizedQuery.includes(normalizeSearchText(term))),
  );
  const simplifiedQuery = simplifyBusinessName(query);
  const trimmedHint = locationHint.trim();
  const candidates: GeocodeCandidate[] = [
    ...(trimmedHint ? [{ query: `${query}, ${trimmedHint}` }] : []),
    ...(trimmedHint && simplifiedQuery && simplifiedQuery !== query
      ? [{ query: `${simplifiedQuery}, ${trimmedHint}` }]
      : []),
    ...(alias ? [alias.candidate] : []),
    { query },
    { query: `${query}, Philippines` },
    ...(simplifiedQuery && simplifiedQuery !== query
      ? [{ query: `${simplifiedQuery}, Philippines` }]
      : []),
  ];
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = normalizeSearchText(candidate.query);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function addUserLocationBias(
  params: URLSearchParams,
  userLocation?: GeoPoint | null,
  bounded = false,
) {
  if (!userLocation) {
    return;
  }

  const radiusDegrees = bounded ? 0.28 : 0.45;
  const left = userLocation.longitude - radiusDegrees;
  const right = userLocation.longitude + radiusDegrees;
  const top = userLocation.latitude + radiusDegrees;
  const bottom = userLocation.latitude - radiusDegrees;

  params.set("viewbox", `${left},${top},${right},${bottom}`);

  if (bounded) {
    params.set("bounded", "1");
  }
}

function toGeocodeResult(result: GeocodeSearchResult, fallbackLabel: string): GeocodeResult | null {
  if (!result.lat || !result.lon) {
    return null;
  }

  const latitude = Number(result.lat);
  const longitude = Number(result.lon);

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

  return {
    latitude,
    longitude,
    label: result.display_name || fallbackLabel,
  };
}

function pickBestResult(results: GeocodeResult[], userLocation?: GeoPoint | null) {
  if (!userLocation) {
    return results[0] ?? null;
  }

  return (
    [...results].sort(
      (firstResult, secondResult) =>
        metersBetween(userLocation, firstResult) - metersBetween(userLocation, secondResult),
    )[0] ?? null
  );
}

export async function geocodeLocation(
  query: string,
  options: GeocodeLocationOptions = {},
): Promise<GeocodeResult | null> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return null;
  }

  const candidates = buildGeocodeCandidates(normalizedQuery, options.locationHint);
  const searchPasses = options.userLocation ? [true, false] : [false];

  for (const bounded of searchPasses) {
    for (const candidate of candidates) {
      const params = new URLSearchParams({
        addressdetails: "1",
        countrycodes: "ph",
        format: "jsonv2",
        limit: bounded ? "10" : "5",
        q: candidate.query,
      });
      addUserLocationBias(params, options.userLocation, bounded);

      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Location lookup failed. Try a more specific address or paste coordinates.");
      }

      const results = (await response.json()) as GeocodeSearchResult[];
      const validResults = results
        .map((result) => toGeocodeResult(result, candidate.label || candidate.query))
        .filter((result): result is GeocodeResult => result !== null);
      const bestResult = pickBestResult(validResults, options.userLocation);

      if (!bestResult) {
        continue;
      }

      return candidate.label ? { ...bestResult, label: candidate.label } : bestResult;
    }
  }

  return null;
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
