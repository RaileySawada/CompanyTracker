import { useEffect, useRef, useState } from "react";
import type { Company, GeoPoint } from "../types";

declare const __GOOGLE_MAPS_API_KEY__: string;

type GoogleLatLng = {
  lat: number;
  lng: number;
};

type GoogleLeg = {
  distance?: { text?: string; value?: number };
  duration?: { text?: string; value?: number };
};

type GoogleRoute = {
  summary?: string;
  legs?: GoogleLeg[];
};

type GoogleDirectionsResult = {
  routes?: GoogleRoute[];
};

type GoogleDirectionsRenderer = {
  getDirections: () => GoogleDirectionsResult | null;
  setDirections: (directions: GoogleDirectionsResult | null) => void;
  setMap: (map: GoogleMap | null) => void;
  setOptions: (options: Record<string, unknown>) => void;
  setRouteIndex: (index: number) => void;
};

type GoogleDirectionsService = {
  route: (
    request: Record<string, unknown>,
    callback: (result: GoogleDirectionsResult | null, status: string) => void,
  ) => void;
};

type GoogleMap = {
  fitBounds: (bounds: GoogleLatLngBounds) => void;
};

type GoogleMarker = {
  setMap: (map: GoogleMap | null) => void;
  setPosition: (position: GoogleLatLng) => void;
};

type GoogleLatLngBounds = {
  extend: (position: GoogleLatLng) => void;
};

type GoogleMapsApi = {
  DirectionsRenderer: new (options: Record<string, unknown>) => GoogleDirectionsRenderer;
  DirectionsService: new () => GoogleDirectionsService;
  LatLngBounds: new () => GoogleLatLngBounds;
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
  Marker: new (options: Record<string, unknown>) => GoogleMarker;
  TravelMode: { DRIVING: string };
  event: {
    addListener: (
      instance: unknown,
      eventName: string,
      handler: () => void,
    ) => { remove: () => void };
  };
};

declare global {
  interface Window {
    google?: {
      maps?: GoogleMapsApi;
    };
  }
}

type RouteOption = {
  distance: string;
  duration: string;
  label: string;
};

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-directions-script";
let googleMapsPromise: Promise<GoogleMapsApi> | null = null;

function toGoogleLatLng(point: GeoPoint): GoogleLatLng {
  return { lat: point.latitude, lng: point.longitude };
}

function routeKey(origin: GeoPoint, destination: GeoPoint) {
  return `${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)}:${destination.latitude.toFixed(5)},${destination.longitude.toFixed(5)}`;
}

function getRouteOption(route: GoogleRoute, index: number): RouteOption {
  const leg = route.legs?.[0];
  return {
    distance: leg?.distance?.text || "Distance unavailable",
    duration: leg?.duration?.text || "Duration unavailable",
    label: route.summary || (index === 0 ? "Best route" : `Route ${index + 1}`),
  };
}

function loadGoogleMaps() {
  if (!__GOOGLE_MAPS_API_KEY__) {
    return Promise.reject(new Error("Missing Google Maps API key"));
  }

  const currentGoogle = window.google?.maps as GoogleMapsApi | undefined;

  if (currentGoogle) {
    return Promise.resolve(currentGoogle);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        const maps = window.google?.maps as GoogleMapsApi | undefined;
        if (maps) {
          resolve(maps);
        } else {
          reject(new Error("Google Maps loaded without maps API"));
        }
      });
      existingScript.addEventListener("error", () => reject(new Error("Google Maps failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      __GOOGLE_MAPS_API_KEY__,
    )}`;
    script.addEventListener("load", () => {
      const maps = window.google?.maps as GoogleMapsApi | undefined;
      if (maps) {
        resolve(maps);
      } else {
        reject(new Error("Google Maps loaded without maps API"));
      }
    });
    script.addEventListener("error", () => reject(new Error("Google Maps failed to load")));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

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
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<GoogleMapsApi | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const companyMarkerRef = useRef<GoogleMarker | null>(null);
  const userMarkerRef = useRef<GoogleMarker | null>(null);
  const directionsServiceRef = useRef<GoogleDirectionsService | null>(null);
  const directionsRendererRef = useRef<GoogleDirectionsRenderer | null>(null);
  const activeRouteKeyRef = useRef("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(company));
  const [isMapsReady, setIsMapsReady] = useState(false);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  useEffect(() => {
    let isActive = true;

    if (!company || !mapElementRef.current) {
      setIsMapsReady(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    void loadGoogleMaps()
      .then((maps) => {
        if (!isActive || !mapElementRef.current || !company) {
          return;
        }

        const companyPosition = toGoogleLatLng(company);
        mapsRef.current = maps;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapElementRef.current, {
            center: companyPosition,
            clickableIcons: true,
            fullscreenControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            zoom: 15,
          });

          directionsServiceRef.current = new maps.DirectionsService();
          directionsRendererRef.current = new maps.DirectionsRenderer({
            draggable: true,
            map: mapRef.current,
            markerOptions: { visible: false },
            polylineOptions: {
              strokeColor: "#2563eb",
              strokeOpacity: 0.92,
              strokeWeight: 6,
            },
            preserveViewport: true,
            suppressMarkers: true,
          });

          maps.event.addListener(directionsRendererRef.current, "directions_changed", () => {
            const directions = directionsRendererRef.current?.getDirections();
            setRouteOptions((directions?.routes ?? []).map(getRouteOption));
          });
        }

        if (!companyMarkerRef.current) {
          companyMarkerRef.current = new maps.Marker({
            map: mapRef.current,
            position: companyPosition,
            title: company.name,
          });
        } else {
          companyMarkerRef.current.setPosition(companyPosition);
        }

        if (userLocation) {
          const userPosition = toGoogleLatLng(userLocation);
          if (!userMarkerRef.current) {
            userMarkerRef.current = new maps.Marker({
              map: mapRef.current,
              position: userPosition,
              title: "You are here",
            });
          } else {
            userMarkerRef.current.setPosition(userPosition);
            userMarkerRef.current.setMap(mapRef.current);
          }

          const bounds = new maps.LatLngBounds();
          bounds.extend(userPosition);
          bounds.extend(companyPosition);
          mapRef.current?.fitBounds(bounds);
        } else {
          userMarkerRef.current?.setMap(null);
        }

        setIsLoading(false);
        setIsMapsReady(true);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setIsLoading(false);
        setIsMapsReady(false);
        setErrorMessage(error instanceof Error ? error.message : "Google Maps failed to load");
      });

    return () => {
      isActive = false;
    };
  }, [company, userLocation]);

  useEffect(() => {
    const maps = mapsRef.current;
    const service = directionsServiceRef.current;
    const renderer = directionsRendererRef.current;

    if (!isMapsReady || !maps || !service || !renderer || !company || !userLocation) {
      renderer?.setDirections(null);
      activeRouteKeyRef.current = "";
      setRouteOptions([]);
      return;
    }

    const nextRouteKey = routeKey(userLocation, company);
    if (activeRouteKeyRef.current === nextRouteKey) {
      return;
    }

    activeRouteKeyRef.current = nextRouteKey;
    setSelectedRouteIndex(0);

    service.route(
      {
        destination: toGoogleLatLng(company),
        origin: toGoogleLatLng(userLocation),
        provideRouteAlternatives: true,
        travelMode: maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (activeRouteKeyRef.current !== nextRouteKey) {
          return;
        }

        if (status !== "OK" || !result?.routes?.length) {
          setErrorMessage("Directions are unavailable for this route");
          setRouteOptions([]);
          renderer.setDirections(null);
          return;
        }

        setErrorMessage("");
        renderer.setDirections(result);
        renderer.setRouteIndex(0);
        setRouteOptions(result.routes.map(getRouteOption));
      },
    );
  }, [company, isMapsReady, userLocation]);

  function selectRoute(index: number) {
    setSelectedRouteIndex(index);
    directionsRendererRef.current?.setRouteIndex(index);
  }

  return (
    <div className={`map-panel ${className}`}>
      {company ? (
        <>
          <div
            aria-label={`Google directions map for ${company.name}`}
            className="live-map google-map"
            ref={mapElementRef}
            role="application"
          />
          {isLoading ? <div className="map-status">Loading Google Maps...</div> : null}
          {errorMessage ? <div className="map-status error">{errorMessage}</div> : null}
          {routeOptions.length > 1 ? (
            <div className="route-options" aria-label="Available routes">
              {routeOptions.map((route, index) => (
                <button
                  className={selectedRouteIndex === index ? "active" : ""}
                  key={`${route.label}-${index}`}
                  type="button"
                  onClick={() => selectRoute(index)}
                >
                  <strong>{index === 0 ? "Best route" : route.label}</strong>
                  <span>
                    {route.duration} · {route.distance}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="map-placeholder">
          <span>{placeholder}</span>
        </div>
      )}
    </div>
  );
}
