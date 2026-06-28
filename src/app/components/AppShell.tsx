import type { ReactNode } from "react";
import logo from "../../assets/images/logo.png";
import type { Route } from "../types";

export function AppShell({
  children,
  route,
  setRoute,
}: {
  children: ReactNode;
  route: Route;
  setRoute: (route: Route) => void;
}) {
  return (
    <main className="app-shell">
      <div className="space-grid" aria-hidden="true" />
      <header className="app-header">
        <button className="brand-lockup" type="button" onClick={() => setRoute("view")}>
          <img className="brand-logo" src={logo} alt="" aria-hidden="true" />
          <span>
            <strong>Company Tracker</strong>
            <small>Shared route planner</small>
          </span>
        </button>

        <nav className="nav-tabs" aria-label="Primary">
          <button
            className={route === "view" ? "active" : ""}
            type="button"
            onClick={() => setRoute("view")}
          >
            View
          </button>
          <button
            className={route === "edit" ? "active" : ""}
            type="button"
            onClick={() => setRoute("edit")}
          >
            Edit
          </button>
        </nav>
      </header>

      {children}

      <footer className="app-footer">
        <div>
          <strong>Company Tracker</strong>
          <span>Shared maps, live GPS, and route ordering.</span>
        </div>
        <div className="footer-meta">
          <span>Serverless on Netlify</span>
          <span>Shared with Netlify Blobs</span>
        </div>
      </footer>
    </main>
  );
}
