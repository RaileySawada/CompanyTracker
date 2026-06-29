import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { CompanySidebar } from "./CompanySidebar";
import { FaIcon } from "./FaIcon";
import logo from "../../assets/images/logo.png";
import type { Company, Route } from "../types";

export function AppShell({
  children,
  availableDates,
  companies,
  reorderCompanies,
  route,
  selectedId,
  selectedDate,
  setSelectedDate,
  setRoute,
  setSelectedId,
  startNewCompany,
  syncMessage,
  syncStatus,
}: {
  children: ReactNode;
  availableDates: string[];
  companies: Company[];
  reorderCompanies: (sourceId: string, targetId: string, placement?: "before" | "after") => void;
  route: Route;
  selectedId: string;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  setRoute: (route: Route) => void;
  setSelectedId: (id: string) => void;
  startNewCompany: () => void;
  syncMessage: string;
  syncStatus: "idle" | "loading" | "saving" | "synced" | "error";
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [route, selectedId]);

  function handleRouteChange(nextRoute: Route) {
    setRoute(nextRoute);
    setIsSidebarOpen(false);
  }

  function handleSelectCompany(id: string) {
    setSelectedId(id);
    handleRouteChange("view");
  }

  function handleStartNewCompany() {
    startNewCompany();
    setIsSidebarOpen(false);
  }

  const routeLabel =
    route === "view"
      ? "Companies"
      : route === "add"
        ? "Management"
        : route === "bulk-add"
          ? "Bulk add"
          : route === "analytics"
            ? "Analytics"
            : "About";

  return (
    <main className="app-frame">
      <button
        aria-label="Open navigation"
        className="mobile-nav-toggle"
        type="button"
        onClick={() => setIsSidebarOpen(true)}
      >
        <FaIcon name="bars" />
      </button>
      {isSidebarOpen ? (
        <button
          aria-label="Close navigation"
          className="mobile-nav-backdrop"
          type="button"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}
      <CompanySidebar
        availableDates={availableDates}
        companies={companies}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        reorderCompanies={reorderCompanies}
        route={route}
        selectedId={selectedId}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        setRoute={handleRouteChange}
        setSelectedId={handleSelectCompany}
        startNewCompany={handleStartNewCompany}
      />

      <section className="main-stage">
        <header className="dashboard-hero">
          <div className="hero-pattern" aria-hidden="true" />
          <div>
            <p className="eyebrow">{routeLabel}</p>
            <h1>Company Tracker</h1>
          </div>
          <div className="hero-status">
            <span className={`sync-pill ${syncStatus}`}>{syncMessage}</span>
            <button type="button" onClick={handleStartNewCompany}>
              <FaIcon name="plus" />
              Add company
            </button>
          </div>
        </header>

        {children}

        <footer className="page-footer">
          <div>
            <img src={logo} alt="" aria-hidden="true" />
            <span>Company Tracker</span>
          </div>
          <span>Copyright &copy; {new Date().getFullYear()} Company Tracker. All rights reserved.</span>
        </footer>
      </section>
    </main>
  );
}
