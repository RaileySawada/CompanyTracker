import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import {
  cacheCompanies,
  fetchSharedCompanies,
  loadCompaniesFallback,
  saveSharedCompanies,
} from "./lib/companiesApi";
import { timestampForDateKey, todayKey, tomorrowKey, toDateKey } from "./lib/dates";
import { ARRIVAL_RADIUS_METERS, metersBetween } from "./lib/geo";
import { AboutPage } from "./pages/AboutPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { EditPage } from "./pages/EditPage";
import { ViewPage } from "./pages/ViewPage";
import type { Company, GeoPoint, Route } from "./types";

type SyncStatus = "idle" | "loading" | "saving" | "synced" | "error";

function getInitialRoute(): Route {
  const pathname = window.location.pathname;

  if (pathname.includes("bulk-add")) {
    return "bulk-add";
  }

  if (pathname.includes("add")) {
    return "add";
  }

  if (pathname.includes("analytics")) {
    return "analytics";
  }

  if (pathname.includes("about")) {
    return "about";
  }

  return "view";
}

export default function App() {
  const [route, setRoute] = useState<Route>(getInitialRoute);
  const [companies, setCompanies] = useState<Company[]>(loadCompaniesFallback);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const visibleCompanies = useMemo(
    () => companies.filter((company) => toDateKey(company.createdAt) === selectedDate),
    [companies, selectedDate],
  );
  const [selectedId, setSelectedId] = useState(visibleCompanies[0]?.id ?? "");
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [geoError, setGeoError] = useState("");
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState("Local cache ready");

  const selectedCompany = useMemo(
    () => visibleCompanies.find((company) => company.id === selectedId) ?? visibleCompanies[0],
    [visibleCompanies, selectedId],
  );

  const availableDates = useMemo(() => {
    const dateSet = new Set(companies.map((company) => toDateKey(company.createdAt)));
    dateSet.add(todayKey());
    dateSet.add(tomorrowKey());
    return [...dateSet].sort((left, right) => right.localeCompare(left));
  }, [companies]);

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
    if (!visibleCompanies.some((company) => company.id === selectedId)) {
      setSelectedId(visibleCompanies[0]?.id ?? "");
    }
  }, [visibleCompanies, selectedId]);

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
          sharedCompanies.some(
            (company) => company.id === currentId && toDateKey(company.createdAt) === selectedDate,
          )
            ? currentId
            : (sharedCompanies.find((company) => toDateKey(company.createdAt) === selectedDate)?.id ?? ""),
        );
        cacheCompanies(sharedCompanies);
        setSyncStatus("synced");
        setSyncMessage("Shared data loaded");
      })
      .catch((error: Error) => {
        if (!isMounted) {
          return;
        }

        setSyncStatus("error");
        setSyncMessage(error.message || "Shared data unavailable");
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  useEffect(() => {
    window.history.replaceState(null, "", `/${route}`);
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
      .catch((error: Error) => {
        setCompanies(previousCompanies);
        cacheCompanies(previousCompanies);
        setSyncStatus("error");
        setSyncMessage(error.message || "Save failed. Not shared.");
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
    setSelectedDate(toDateKey(company.createdAt));
    setSelectedId(company.id);
    setEditingCompanyId(company.id);
    setRoute("view");
  }

  function addCompanies(newCompanies: Company[]) {
    if (newCompanies.length === 0) {
      return;
    }

    persistCompanies([...newCompanies, ...companies]);
    setSelectedDate(toDateKey(newCompanies[0]?.createdAt));
    setSelectedId(newCompanies[0]?.id ?? "");
    setEditingCompanyId(newCompanies[0]?.id ?? "");
    setRoute("view");
  }

  function deleteCompany(id: string) {
    setPendingDeleteId(id);
  }

  function markCompanyApplied(id: string) {
    const nextCompanies = companies.map((company) =>
      company.id === id
        ? {
            ...company,
            appliedAt: company.appliedAt || new Date().toISOString(),
            rejectedAt: "",
          }
        : company,
    );

    persistCompanies(nextCompanies);
  }

  function markCompanyRejected(id: string) {
    const nextCompanies = companies.map((company) =>
      company.id === id
        ? {
            ...company,
            appliedAt: "",
            rejectedAt: company.rejectedAt || new Date().toISOString(),
          }
        : company,
    );

    persistCompanies(nextCompanies);
  }

  function rescheduleCompany(id: string, dateKey: string) {
    const nextCompanies = companies.map((company) =>
      company.id === id
        ? {
            ...company,
            createdAt: timestampForDateKey(dateKey),
            appliedAt: "",
            rejectedAt: "",
          }
        : company,
    );

    persistCompanies(nextCompanies);
    setSelectedDate(dateKey);
    setSelectedId(id);
    setRoute("view");
  }

  function reorderCompanies(sourceId: string, targetId: string, placement: "before" | "after" = "before") {
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
    const nextTargetIndex = nextCompanies.findIndex((company) => company.id === targetId);
    const insertIndex = placement === "after" ? nextTargetIndex + 1 : nextTargetIndex;
    nextCompanies.splice(insertIndex, 0, movedCompany);
    persistCompanies(nextCompanies);
  }

  function selectNextCompany() {
    if (visibleCompanies.length === 0 || !selectedId) {
      return;
    }

    const currentIndex = visibleCompanies.findIndex((company) => company.id === selectedId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % visibleCompanies.length : 0;
    setSelectedId(visibleCompanies[nextIndex]?.id ?? "");
  }

  function confirmDeleteCompany() {
    if (!pendingDeleteId) {
      return;
    }

    const nextCompanies = companies.filter((company) => company.id !== pendingDeleteId);
    persistCompanies(nextCompanies);
    setPendingDeleteId("");

    if (selectedId === pendingDeleteId) {
      setSelectedId(
        nextCompanies.find((company) => toDateKey(company.createdAt) === selectedDate)?.id ?? "",
      );
    }

    if (editingCompanyId === pendingDeleteId) {
      setEditingCompanyId(nextCompanies[0]?.id ?? null);
      setRoute("view");
    }
  }

  function startNewCompany() {
    setEditingCompanyId("");
    setRoute("add");
  }

  function startEditingCompany(id: string) {
    setSelectedId(id);
    setEditingCompanyId(id);
    setRoute("add");
  }

  function handleRouteChange(nextRoute: Route) {
    if (nextRoute === "add" && editingCompanyId === "" && selectedId) {
      setEditingCompanyId(selectedId);
    }

    setRoute(nextRoute);
  }

  return (
    <AppShell
      availableDates={availableDates}
      companies={visibleCompanies}
      reorderCompanies={reorderCompanies}
      route={route}
      selectedId={selectedId}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      setRoute={handleRouteChange}
      setSelectedId={setSelectedId}
      startNewCompany={startNewCompany}
      syncMessage={syncMessage}
      syncStatus={syncStatus}
    >
      {route === "view" ? (
        <ViewPage
          deleteCompany={deleteCompany}
          distance={distance}
          geoError={geoError}
          goToNextCompany={selectNextCompany}
          selectedCompany={selectedCompany}
          isArrived={isArrived}
          markCompanyApplied={markCompanyApplied}
          markCompanyRejected={markCompanyRejected}
          rescheduleCompany={rescheduleCompany}
          startEditingCompany={startEditingCompany}
          startNewCompany={startNewCompany}
          userLocation={userLocation}
        />
      ) : route === "add" ? (
        <EditPage
          mode="single"
          onDelete={deleteCompany}
          onSave={upsertCompany}
          onSaveMany={addCompanies}
          selectedDate={selectedDate}
          selectedCompany={editingCompany}
          userLocation={userLocation}
        />
      ) : route === "bulk-add" ? (
        <EditPage
          mode="bulk"
          onDelete={deleteCompany}
          onSave={upsertCompany}
          onSaveMany={addCompanies}
          selectedDate={selectedDate}
          userLocation={userLocation}
        />
      ) : route === "analytics" ? (
        <AnalyticsPage companies={companies} />
      ) : (
        <AboutPage />
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
