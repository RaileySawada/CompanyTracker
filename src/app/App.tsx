import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import {
  cacheCompanies,
  fetchSharedCompanies,
  loadCompaniesFallback,
  saveSharedCompanies,
} from "./lib/companiesApi";
import { metersBetween } from "./lib/geo";
import { EditPage } from "./pages/EditPage";
import { ViewPage } from "./pages/ViewPage";
import type { Company, GeoPoint, Route } from "./types";

function getInitialRoute(): Route {
  return window.location.pathname.includes("edit") ? "edit" : "view";
}

export default function App() {
  const [route, setRoute] = useState<Route>(getInitialRoute);
  const [companies, setCompanies] = useState<Company[]>(loadCompaniesFallback);
  const [selectedId, setSelectedId] = useState(companies[0]?.id ?? "");
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [geoError, setGeoError] = useState("");
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState("");

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

  useEffect(() => {
    if (!companies.some((company) => company.id === selectedId)) {
      setSelectedId(companies[0]?.id ?? "");
    }
  }, [companies, selectedId]);

  useEffect(() => {
    let isMounted = true;

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
      })
      .catch(() => undefined);

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
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
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

  function persistCompanies(nextCompanies: Company[]) {
    setCompanies(nextCompanies);
    cacheCompanies(nextCompanies);
    void saveSharedCompanies(nextCompanies)
      .then((sharedCompanies) => {
        setCompanies(sharedCompanies);
        cacheCompanies(sharedCompanies);
      })
      .catch(() => {
        cacheCompanies(nextCompanies);
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
    <AppShell route={route} setRoute={handleRouteChange}>
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
