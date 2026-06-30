import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLocationArrow, faMap } from "@fortawesome/free-solid-svg-icons";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Company, GeoPoint } from "../types";

declare const __GOOGLE_MAPS_API_KEY__: string;

type GoogleLatLng = {
  lat: number;
  lng: number;
};

type GoogleDirectionsResult = {
  routes?: Array<{
    overview_path?: Array<{
      lat: () => number;
      lng: () => number;
    }>;
  }>;
};

type GoogleDirectionsRenderer = {
  setDirections: (directions: GoogleDirectionsResult | null) => void;
  setRouteIndex: (index: number) => void;
};

type GoogleDirectionsService = {
  route: (
    request: Record<string, unknown>,
    callback: (result: GoogleDirectionsResult | null, status: string) => void,
  ) => void;
};

type GoogleMap = {
  addListener: (eventName: string, handler: () => void) => GoogleMapsEventListener;
  fitBounds: (bounds: GoogleLatLngBounds) => void;
  setCenter: (position: GoogleLatLng) => void;
};

type GoogleMarker = {
  setMap: (map: GoogleMap | null) => void;
  setPosition: (position: GoogleLatLng) => void;
};

type GoogleMapsEventListener = {
  remove: () => void;
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
};

declare global {
  interface Window {
    google?: {
      maps?: GoogleMapsApi;
    };
  }
}

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-directions-script";
const USER_VIEWPORT_GRACE_MS = 15000;
const MAPLIBRE_ROUTE_SOURCE_ID = "route";
const MAPLIBRE_ROUTE_SHADOW_LAYER_ID = "route-shadow";
const MAPLIBRE_ROUTE_LAYER_ID = "route-line";
let googleMapsPromise: Promise<GoogleMapsApi> | null = null;

function toGoogleLatLng(point: GeoPoint): GoogleLatLng {
  return { lat: point.latitude, lng: point.longitude };
}

function routeKey(origin: GeoPoint, destination: GeoPoint) {
  return `${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)}:${destination.latitude.toFixed(5)},${destination.longitude.toFixed(5)}`;
}

function headingToDestination(origin: GeoPoint, destination: GeoPoint) {
  const originLat = (origin.latitude * Math.PI) / 180;
  const destinationLat = (destination.latitude * Math.PI) / 180;
  const longitudeDelta = ((destination.longitude - origin.longitude) * Math.PI) / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(destinationLat);
  const x =
    Math.cos(originLat) * Math.sin(destinationLat) -
    Math.sin(originLat) * Math.cos(destinationLat) * Math.cos(longitudeDelta);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeBearing(value: number) {
  return ((value % 360) + 360) % 360;
}

function distanceToSegmentSquared(point: number[], start: number[], end: number[]) {
  const segmentLongitude = end[0] - start[0];
  const segmentLatitude = end[1] - start[1];
  const segmentLengthSquared = segmentLongitude * segmentLongitude + segmentLatitude * segmentLatitude;

  if (segmentLengthSquared === 0) {
    const longitudeDelta = point[0] - start[0];
    const latitudeDelta = point[1] - start[1];
    return longitudeDelta * longitudeDelta + latitudeDelta * latitudeDelta;
  }

  const rawProgress =
    ((point[0] - start[0]) * segmentLongitude + (point[1] - start[1]) * segmentLatitude) /
    segmentLengthSquared;
  const progress = Math.max(0, Math.min(1, rawProgress));
  const projectedLongitude = start[0] + progress * segmentLongitude;
  const projectedLatitude = start[1] + progress * segmentLatitude;
  const longitudeDelta = point[0] - projectedLongitude;
  const latitudeDelta = point[1] - projectedLatitude;

  return longitudeDelta * longitudeDelta + latitudeDelta * latitudeDelta;
}

function headingToRoute(coordinates: number[][] | null, origin: GeoPoint, destination: GeoPoint) {
  if (!coordinates || coordinates.length < 2) {
    return headingToDestination(origin, destination);
  }

  const trackerCoordinate = [origin.longitude, origin.latitude];
  let nearestStart = coordinates[0];
  let nearestEnd = coordinates[1];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index];
    const end = coordinates[index + 1];
    const segmentDistance = distanceToSegmentSquared(trackerCoordinate, start, end);

    if (segmentDistance < nearestDistance) {
      nearestStart = start;
      nearestEnd = end;
      nearestDistance = segmentDistance;
    }
  }

  if (!nearestStart || !nearestEnd) {
    return headingToDestination(origin, destination);
  }

  return headingToDestination(
    { latitude: nearestStart[1], longitude: nearestStart[0] },
    { latitude: nearestEnd[1], longitude: nearestEnd[0] },
  );
}

function travelBearing(origin: GeoPoint | null | undefined, coordinates: number[][] | null, destination: GeoPoint) {
  if (!origin) {
    return 0;
  }

  return headingToRoute(coordinates, origin, destination);
}

function userMarkerRotation(origin: GeoPoint | null | undefined, mapBearing: number) {
  if (!origin || !isFiniteNumber(origin.heading)) {
    return 0;
  }

  return normalizeBearing(origin.heading - mapBearing);
}

function toRouteCoordinates(result: GoogleDirectionsResult | null, origin: GeoPoint, destination: GeoPoint) {
  const path = result?.routes?.[0]?.overview_path;
  if (!path?.length) {
    return [
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
    ];
  }

  return path.map((point) => [point.lng(), point.lat()]);
}

function createMapLibreStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "&copy; OpenStreetMap contributors",
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "osm",
        type: "raster",
        source: "osm",
        paint: {
          "raster-saturation": -0.18,
          "raster-contrast": 0.08,
        },
      },
    ],
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
  const travelMapElementRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<GoogleMapsApi | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const travelMapRef = useRef<maplibregl.Map | null>(null);
  const travelUserMarkerRef = useRef<maplibregl.Marker | null>(null);
  const travelDestinationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const companyMarkerRef = useRef<GoogleMarker | null>(null);
  const userMarkerRef = useRef<GoogleMarker | null>(null);
  const directionsServiceRef = useRef<GoogleDirectionsService | null>(null);
  const directionsRendererRef = useRef<GoogleDirectionsRenderer | null>(null);
  const mapListenersRef = useRef<GoogleMapsEventListener[]>([]);
  const activeRouteKeyRef = useRef("");
  const lastManualViewportChangeRef = useRef(0);
  const lastAutoViewportFitRef = useRef(0);
  const isProgrammaticViewportChangeRef = useRef(false);
  const viewportKeyRef = useRef("");
  const [mapMode, setMapMode] = useState<"top" | "travel">("top");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(company));
  const [isMapsReady, setIsMapsReady] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<number[][] | null>(null);

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
            draggable: false,
            map: mapRef.current,
            markerOptions: { visible: false },
            polylineOptions: {
              strokeColor: "#6236ff",
              strokeOpacity: 0.94,
              strokeWeight: 8,
            },
            preserveViewport: true,
            suppressMarkers: true,
          });

          mapListenersRef.current = ["zoom_changed", "dragstart", "tilt_changed"].map((eventName) =>
            mapRef.current!.addListener(eventName, () => {
              if (isProgrammaticViewportChangeRef.current) {
                return;
              }

              lastManualViewportChangeRef.current = Date.now();
            }),
          );
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
          const nextViewportKey = `${company.id}:with-user`;
          const now = Date.now();
          const hasNewViewport = viewportKeyRef.current !== nextViewportKey;
          const shouldRestoreAfterManualChange =
            lastManualViewportChangeRef.current > lastAutoViewportFitRef.current &&
            now - lastManualViewportChangeRef.current > USER_VIEWPORT_GRACE_MS;

          if (hasNewViewport || shouldRestoreAfterManualChange) {
            isProgrammaticViewportChangeRef.current = true;
            mapRef.current?.fitBounds(bounds);
            viewportKeyRef.current = nextViewportKey;
            lastAutoViewportFitRef.current = now;
            window.setTimeout(() => {
              isProgrammaticViewportChangeRef.current = false;
            }, 800);
          }
        } else {
          userMarkerRef.current?.setMap(null);
          const nextViewportKey = `${company.id}:company-only`;
          if (viewportKeyRef.current !== nextViewportKey) {
            isProgrammaticViewportChangeRef.current = true;
            mapRef.current?.setCenter(companyPosition);
            viewportKeyRef.current = nextViewportKey;
            lastAutoViewportFitRef.current = Date.now();
            window.setTimeout(() => {
              isProgrammaticViewportChangeRef.current = false;
            }, 800);
          }
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
    return () => {
      mapListenersRef.current.forEach((listener) => listener.remove());
      mapListenersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const maps = mapsRef.current;
    const service = directionsServiceRef.current;
    const renderer = directionsRendererRef.current;

    if (!isMapsReady || !maps || !service || !renderer || !company || !userLocation) {
      renderer?.setDirections(null);
      activeRouteKeyRef.current = "";
      return;
    }

    const nextRouteKey = routeKey(userLocation, company);
    if (activeRouteKeyRef.current === nextRouteKey) {
      return;
    }

    activeRouteKeyRef.current = nextRouteKey;

    service.route(
      {
        destination: toGoogleLatLng(company),
        origin: toGoogleLatLng(userLocation),
        provideRouteAlternatives: false,
        travelMode: maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (activeRouteKeyRef.current !== nextRouteKey) {
          return;
        }

        if (status !== "OK" || !result?.routes?.length) {
          setErrorMessage("Directions are unavailable for this route");
          renderer.setDirections(null);
          setRouteCoordinates(null);
          return;
        }

        setErrorMessage("");
        setRouteCoordinates(toRouteCoordinates(result, userLocation, company));
        renderer.setDirections(result);
        renderer.setRouteIndex(0);
      },
    );
  }, [company, isMapsReady, userLocation]);

  useEffect(() => {
    if (!company || !travelMapElementRef.current) {
      return;
    }

    if (!travelMapRef.current) {
      travelMapRef.current = new maplibregl.Map({
        attributionControl: { compact: true },
        center: [userLocation?.longitude ?? company.longitude, userLocation?.latitude ?? company.latitude],
        container: travelMapElementRef.current,
        bearing: travelBearing(userLocation, routeCoordinates, company),
        pitch: 64,
        style: createMapLibreStyle(),
        zoom: userLocation ? 16 : 15,
      });
    }

    const travelMap = travelMapRef.current;
    if (!travelMap) {
      return;
    }
    const destinationElement = document.createElement("span");
    destinationElement.className = "travel-destination-marker";
    const userElement = document.createElement("span");
    userElement.className = "travel-user-marker";
    userElement.innerHTML = '<span class="travel-user-arrow"></span>';
    const routeBearing = travelBearing(userLocation, routeCoordinates, company);
    const markerRotation = userMarkerRotation(userLocation, routeBearing);

    if (!travelDestinationMarkerRef.current) {
      travelDestinationMarkerRef.current = new maplibregl.Marker({ element: destinationElement })
        .setLngLat([company.longitude, company.latitude])
        .addTo(travelMap);
    } else {
      travelDestinationMarkerRef.current.setLngLat([company.longitude, company.latitude]);
    }

    if (userLocation) {
      if (!travelUserMarkerRef.current) {
        travelUserMarkerRef.current = new maplibregl.Marker({
          element: userElement,
          rotation: markerRotation,
          rotationAlignment: "viewport",
        })
          .setLngLat([userLocation.longitude, userLocation.latitude])
          .addTo(travelMap);
      } else {
        travelUserMarkerRef.current.setLngLat([userLocation.longitude, userLocation.latitude]);
        travelUserMarkerRef.current.setRotation(markerRotation);
      }
    } else {
      travelUserMarkerRef.current?.remove();
      travelUserMarkerRef.current = null;
    }
  }, [company, routeCoordinates, userLocation]);

  useEffect(() => {
    const travelMap = travelMapRef.current;
    if (!travelMap || !company) {
      return;
    }
    const activeCompany = company;
    const activeTravelMap = travelMap;

    const coordinates =
      routeCoordinates && routeCoordinates.length > 1
        ? routeCoordinates
        : [
            [userLocation?.longitude ?? activeCompany.longitude, userLocation?.latitude ?? activeCompany.latitude],
            [activeCompany.longitude, activeCompany.latitude],
          ];

    function syncTravelMap() {
      const routeData = {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates,
        },
      };

      const existingSource = activeTravelMap.getSource(MAPLIBRE_ROUTE_SOURCE_ID) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (existingSource) {
        existingSource.setData(routeData);
      } else {
        activeTravelMap.addSource(MAPLIBRE_ROUTE_SOURCE_ID, {
          type: "geojson",
          data: routeData,
        });
        activeTravelMap.addLayer({
          id: MAPLIBRE_ROUTE_SHADOW_LAYER_ID,
          type: "line",
          source: MAPLIBRE_ROUTE_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#2e1065",
            "line-opacity": 0.42,
            "line-width": 13,
            "line-translate": [0, 3],
          },
        });
        activeTravelMap.addLayer({
          id: MAPLIBRE_ROUTE_LAYER_ID,
          type: "line",
          source: MAPLIBRE_ROUTE_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#6d28d9",
            "line-width": 8,
          },
        });
      }

      const cameraTarget: GeoPoint = userLocation ?? activeCompany;
      const cameraBearing = travelBearing(userLocation, coordinates, activeCompany);
      activeTravelMap.easeTo({
        bearing: cameraBearing,
        center: [cameraTarget.longitude, cameraTarget.latitude],
        duration: 500,
        padding: userLocation
          ? {
              bottom: 96,
              left: 32,
              right: 32,
              top: 260,
            }
          : undefined,
        pitch: 64,
        zoom: userLocation ? 17.5 : 15,
      });
    }

    if (activeTravelMap.isStyleLoaded()) {
      syncTravelMap();
    } else {
      activeTravelMap.once("load", syncTravelMap);
    }
  }, [company, routeCoordinates, userLocation]);

  useEffect(() => {
    if (mapMode === "travel") {
      window.setTimeout(() => travelMapRef.current?.resize(), 50);
    }
  }, [mapMode]);

  useEffect(() => {
    return () => {
      travelUserMarkerRef.current?.remove();
      travelDestinationMarkerRef.current?.remove();
      travelMapRef.current?.remove();
      travelUserMarkerRef.current = null;
      travelDestinationMarkerRef.current = null;
      travelMapRef.current = null;
    };
  }, []);

  return (
    <div className={`map-panel ${className}`}>
      {company ? (
        <>
          <div
            aria-label={`Google directions map for ${company.name}`}
            className={`live-map google-map ${mapMode === "top" ? "active" : ""}`}
            ref={mapElementRef}
            role="application"
          />
          <div
            aria-label={`Travel map for ${company.name}`}
            className={`live-map travel-map ${mapMode === "travel" ? "active" : ""}`}
            ref={travelMapElementRef}
            role="application"
          />
          <div className="map-mode-switch" aria-label="Map mode">
            <button
              aria-label="Top view"
              className={mapMode === "top" ? "active" : ""}
              type="button"
              onClick={() => setMapMode("top")}
            >
              <FontAwesomeIcon aria-hidden="true" className="mode-icon" icon={faMap} />
              <span className="mode-label">Top</span>
            </button>
            <button
              aria-label="Travel view"
              className={mapMode === "travel" ? "active" : ""}
              type="button"
              onClick={() => setMapMode("travel")}
            >
              <FontAwesomeIcon aria-hidden="true" className="mode-icon" icon={faLocationArrow} />
              <span className="mode-label">Travel</span>
            </button>
          </div>
          {isLoading ? <div className="map-status">Loading Google Maps...</div> : null}
          {errorMessage ? <div className="map-status error">{errorMessage}</div> : null}
        </>
      ) : (
        <div className="map-placeholder">
          <span>{placeholder}</span>
        </div>
      )}
    </div>
  );
}
