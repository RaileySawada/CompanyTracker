import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/AppShell";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import {
  cacheCompanies,
  fetchSharedCompanies,
  loadCompaniesFallback,
  saveSharedCompanies,
} from "./lib/companiesApi";
import { ARRIVAL_RADIUS_METERS, metersBetween } from "./lib/geo";
import { EditPage } from "./pages/EditPage";
import { ViewPage } from "./pages/ViewPage";
import type { Company, GeoPoint, Route } from "./types";

type SyncStatus = "idle" | "loading" | "saving" | "synced" | "error";

const MAP_ORIGIN_UPDATE_METERS = 35;

function getInitialRoute(): Route {
  return window.location.pathname.includes("edit") ? "edit" : "view";
}

export default function App() {
  const [route, setRoute] = useState<Route>(getInitialRoute);
  const [companies, setCompanies] = useState<Company[]>(loadCompaniesFallback);
  const [selectedId, setSelectedId] = useState(companies[0]?.id ?? "");
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [mapOrigin, setMapOrigin] = useState<GeoPoint | null>(null);
  const [geoError, setGeoError] = useState("");
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState("Local cache ready");
  const selectedCompanyRef = useRef<Company | undefined>(undefined);
  const userLocationRef = useRef<GeoPoint | null>(null);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedId) ?? companies[0],
    [companies, selectedId],
  );

  const editingCompany = useMemo(() => {
    if (editingCompanyId === "") {
      return undefined;
    }

    const companyId = editingCompanyId ?? selectedId;
    return companies.find((company) => company.id === companyId);
  }, [companies, editingCompanyId, selectedId]);

  const pendingDeleteCompany = useMemo(
    () => companies.find((company) => company.id === pendingDeleteId),
    [companies, pendingDeleteId],
  );

  const distance = useMemo(() => {
    if (!selectedCompany || !userLocation) {
      return null;
    }

    return metersBetween(userLocation, selectedCompany);
  }, [selectedCompany, userLocation]);

  const isArrived = distance !== null && distance <= ARRIVAL_RADIUS_METERS;

  useEffect(() => {
    selectedCompanyRef.current = selectedCompany;
  }, [selectedCompany]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    if (!companies.some((company) => company.id === selectedId)) {
      setSelectedId(companies[0]?.id ?? "");
    }
  }, [companies, selectedId]);

  useEffect(() => {
    let isMounted = true;
    setSyncStatus("loading");
    setSyncMessage("Loading shared data");

    fetchSharedCompanies()
      .then((sharedCompanies) => {
        if (!isMounted) {
          return;
        }

        setCompanies(sharedCompanies);
        setSelectedId((currentId) =>
          sharedCompanies.some((company) => company.id === currentId)
            ? currentId
            : (sharedCompanies[0]?.id ?? ""),
        );
        cacheCompanies(sharedCompanies);
        setSyncStatus("synced");
        setSyncMessage("Shared data loaded");
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setSyncStatus("error");
        setSyncMessage("Shared data unavailable");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", route === "view" ? "/view" : "/edit");
  }, [route]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation is not available in this browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setUserLocation(nextLocation);
        setMapOrigin((currentOrigin) => {
          if (!currentOrigin) {
            return nextLocation;
          }

          const currentCompany = selectedCompanyRef.current;
          if (currentCompany && metersBetween(nextLocation, currentCompany) <= ARRIVAL_RADIUS_METERS) {
            return currentOrigin;
          }

          return metersBetween(currentOrigin, nextLocation) >= MAP_ORIGIN_UPDATE_METERS
            ? nextLocation
            : currentOrigin;
        });
        setGeoError("");
      },
      () => {
        setGeoError("Location permission is needed for live directions and arrival status.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    setMapOrigin(userLocationRef.current);
  }, [selectedId]);

  function persistCompanies(nextCompanies: Company[]) {
    const previousCompanies = companies;
    setCompanies(nextCompanies);
    cacheCompanies(nextCompanies);
    setSyncStatus("saving");
    setSyncMessage("Saving shared data");
    void saveSharedCompanies(nextCompanies)
      .then((sharedCompanies) => {
        setCompanies(sharedCompanies);
        cacheCompanies(sharedCompanies);
        setSyncStatus("synced");
        setSyncMessage("Shared data synced");
      })
      .catch(() => {
        setCompanies(previousCompanies);
        cacheCompanies(previousCompanies);
        setSyncStatus("error");
        setSyncMessage("Save failed. Not shared.");
      });
  }

  function upsertCompany(company: Company) {
    const nextCompanies = (() => {
      const exists = companies.some((item) => item.id === company.id);
      return exists
        ? companies.map((item) => (item.id === company.id ? company : item))
        : [company, ...companies];
    })();

    persistCompanies(nextCompanies);
    setSelectedId(company.id);
    setEditingCompanyId(company.id);
    setRoute("view");
  }

  function deleteCompany(id: string) {
    setPendingDeleteId(id);
  }

  function reorderCompanies(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      return;
    }

    const sourceIndex = companies.findIndex((company) => company.id === sourceId);
    const targetIndex = companies.findIndex((company) => company.id === targetId);

    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextCompanies = [...companies];
    const [movedCompany] = nextCompanies.splice(sourceIndex, 1);
    nextCompanies.splice(targetIndex, 0, movedCompany);
    persistCompanies(nextCompanies);
  }

  function selectNextCompany() {
    if (companies.length === 0 || !selectedId) {
      return;
    }

    const currentIndex = companies.findIndex((company) => company.id === selectedId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % companies.length : 0;
    setSelectedId(companies[nextIndex]?.id ?? "");
  }

  function confirmDeleteCompany() {
    if (!pendingDeleteId) {
      return;
    }

    const nextCompanies = companies.filter((company) => company.id !== pendingDeleteId);
    persistCompanies(nextCompanies);
    setPendingDeleteId("");

    if (selectedId === pendingDeleteId) {
      setSelectedId(nextCompanies[0]?.id ?? "");
    }

    if (editingCompanyId === pendingDeleteId) {
      setEditingCompanyId(nextCompanies[0]?.id ?? null);
      setRoute("view");
    }
  }

  function startNewCompany() {
    setEditingCompanyId("");
    setRoute("edit");
  }

  function startEditingCompany(id: string) {
    setSelectedId(id);
    setEditingCompanyId(id);
    setRoute("edit");
  }

  function handleRouteChange(nextRoute: Route) {
    if (nextRoute === "edit" && editingCompanyId === "" && selectedId) {
      setEditingCompanyId(selectedId);
    }

    setRoute(nextRoute);
  }

  return (
    <AppShell
      route={route}
      setRoute={handleRouteChange}
      syncMessage={syncMessage}
      syncStatus={syncStatus}
    >
      {route === "view" ? (
        <ViewPage
          companies={companies}
          deleteCompany={deleteCompany}
          distance={distance}
          geoError={geoError}
          goToNextCompany={selectNextCompany}
          reorderCompanies={reorderCompanies}
          selectedCompany={selectedCompany}
          selectedId={selectedId}
          isArrived={isArrived}
          mapOrigin={mapOrigin}
          setSelectedId={setSelectedId}
          startEditingCompany={startEditingCompany}
          startNewCompany={startNewCompany}
          userLocation={userLocation}
        />
      ) : (
        <EditPage
          onDelete={deleteCompany}
          onSave={upsertCompany}
          selectedCompany={editingCompany}
          userLocation={userLocation}
        />
      )}
      {pendingDeleteCompany ? (
        <DeleteConfirmModal
          company={pendingDeleteCompany}
          onCancel={() => setPendingDeleteId("")}
          onConfirm={confirmDeleteCompany}
        />
      ) : null}
    </AppShell>
  );
}
