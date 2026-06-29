import { useEffect, useMemo, useState } from "react";
import type { DragEvent, PointerEvent } from "react";
import { FaIcon } from "./FaIcon";
import logo from "../../assets/images/logo.png";
import type { Company, Route } from "../types";

type AccordionGroup = "companies" | "management" | null;
type DropPlacement = "before" | "after";

export function CompanySidebar({
  companies,
  isOpen,
  onClose,
  reorderCompanies,
  route,
  selectedId,
  setRoute,
  startNewCompany,
  setSelectedId,
}: {
  companies: Company[];
  isOpen: boolean;
  onClose: () => void;
  reorderCompanies: (sourceId: string, targetId: string, placement?: DropPlacement) => void;
  route: Route;
  selectedId: string;
  setRoute: (route: Route) => void;
  startNewCompany: () => void;
  setSelectedId: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [dragId, setDragId] = useState("");
  const [dropTargetId, setDropTargetId] = useState("");
  const [dropPlacement, setDropPlacement] = useState<DropPlacement>("before");
  const [openGroup, setOpenGroup] = useState<AccordionGroup>("companies");
  const visibleCompanies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return companies;
    }

    return companies.filter((company) =>
      [company.name, company.locationLabel, company.positions]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [companies, query]);

  useEffect(() => {
    if (route === "view") {
      setOpenGroup("companies");
      return;
    }

    if (route === "add" || route === "bulk-add") {
      setOpenGroup("management");
      return;
    }

    setOpenGroup(null);
  }, [route]);

  function getDropData(event: DragEvent<HTMLElement> | PointerEvent<HTMLElement>) {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const companyElement = target?.closest<HTMLElement>("[data-company-id]");
    const targetId = companyElement?.dataset.companyId ?? "";

    if (!companyElement) {
      return { targetId: "", placement: "before" as DropPlacement };
    }

    const rect = companyElement.getBoundingClientRect();
    const placement: DropPlacement = event.clientY > rect.top + rect.height / 2 ? "after" : "before";
    return { targetId, placement };
  }

  function updateDropTarget(event: DragEvent<HTMLElement> | PointerEvent<HTMLElement>) {
    const nextDrop = getDropData(event);
    setDropTargetId(nextDrop.targetId);
    setDropPlacement(nextDrop.placement);
  }

  function clearDragState() {
    setDragId("");
    setDropTargetId("");
    setDropPlacement("before");
  }

  function commitReorder(sourceId: string, targetId: string, placement: DropPlacement) {
    if (sourceId && targetId && sourceId !== targetId) {
      reorderCompanies(sourceId, targetId, placement);
    }

    clearDragState();
  }

  function startPointerDrag(event: PointerEvent<HTMLElement>, companyId: string) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragId(companyId);
  }

  function movePointerDrag(event: PointerEvent<HTMLElement>) {
    if (!dragId) {
      return;
    }

    updateDropTarget(event);
  }

  function endPointerDrag(event: PointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    commitReorder(dragId, dropTargetId, dropPlacement);
  }

  function toggleGroup(group: Exclude<AccordionGroup, null>) {
    setOpenGroup((currentGroup) => (currentGroup === group ? null : group));
  }

  function openRoute(nextRoute: Route) {
    setRoute(nextRoute);
  }

  return (
    <aside className={`side-nav ${isOpen ? "open" : ""}`}>
      <div className="sidebar-topbar">
        <button className="sidebar-brand" type="button" onClick={() => openRoute("view")}>
          <img src={logo} alt="" aria-hidden="true" />
          <span>
            <strong>Company Tracker</strong>
            <small>Application manager</small>
          </span>
        </button>
        <button className="sidebar-close" type="button" aria-label="Close navigation" onClick={onClose}>
          <FaIcon name="xmark" />
        </button>
      </div>

      <nav className="sidebar-menu" aria-label="Primary">
        <section className="nav-group">
          <button
            className={`nav-parent ${route === "view" ? "active" : ""}`}
            type="button"
            onClick={() => toggleGroup("companies")}
          >
            <span>
              <FaIcon name="building" />
              Companies
            </span>
            <FaIcon name={openGroup === "companies" ? "chevronUp" : "chevronDown"} />
          </button>

          {openGroup === "companies" ? (
            <div className="nav-children company-accordion">
              <label className="company-search">
                <span className="sr-only">Search companies</span>
                <span className="input-shell">
                  <FaIcon name="magnifyingGlass" />
                  <input
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search companies"
                    type="search"
                    value={query}
                  />
                </span>
              </label>

              <div className="company-list">
                {companies.length === 0 ? (
                  <EmptySidebar startNewCompany={startNewCompany} />
                ) : visibleCompanies.length === 0 ? (
                  <div className="empty-sidebar compact">
                    <h3>No matches</h3>
                    <p>Try another name, role, or location.</p>
                  </div>
                ) : (
                  visibleCompanies.map((company) => {
                    const isDropTarget = dropTargetId === company.id && dragId !== company.id;

                    return (
                      <article
                        className={`company-item ${selectedId === company.id && route === "view" ? "active" : ""} ${
                          dragId === company.id ? "dragging" : ""
                        } ${isDropTarget ? `drop-${dropPlacement}` : ""}`}
                        data-company-id={company.id}
                        draggable
                        key={company.id}
                        onDragEnd={clearDragState}
                        onDragEnter={updateDropTarget}
                        onDragOver={(event) => {
                          event.preventDefault();
                          updateDropTarget(event);
                        }}
                        onDragStart={(event) => {
                          setDragId(company.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", company.id);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const nextDrop = getDropData(event);
                          commitReorder(
                            event.dataTransfer.getData("text/plain"),
                            nextDrop.targetId || company.id,
                            nextDrop.placement,
                          );
                        }}
                      >
                        <button className="company-main" type="button" onClick={() => setSelectedId(company.id)}>
                          <span
                            className="drag-handle"
                            title="Drag to reorder"
                            onPointerCancel={clearDragState}
                            onPointerDown={(event) => startPointerDrag(event, company.id)}
                            onPointerMove={movePointerDrag}
                            onPointerUp={endPointerDrag}
                          >
                            <FaIcon name="grip" />
                          </span>
                          <span className="company-copy">
                            <strong>{company.name}</strong>
                            <small>{company.locationLabel}</small>
                          </span>
                          {company.appliedAt ? <span className="applied-dot">Applied</span> : null}
                        </button>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </section>

        <section className="nav-group">
          <button
            className={`nav-parent ${route === "add" || route === "bulk-add" ? "active" : ""}`}
            type="button"
            onClick={() => toggleGroup("management")}
          >
            <span>
              <FaIcon name="tools" />
              Management
            </span>
            <FaIcon name={openGroup === "management" ? "chevronUp" : "chevronDown"} />
          </button>

          {openGroup === "management" ? (
            <div className="nav-children page-links">
              <button className={route === "add" ? "active" : ""} type="button" onClick={startNewCompany}>
                <FaIcon name="plus" />
                Add company
              </button>
              <button
                className={route === "bulk-add" ? "active" : ""}
                type="button"
                onClick={() => openRoute("bulk-add")}
              >
                <FaIcon name="upload" />
                Bulk add
              </button>
            </div>
          ) : null}
        </section>

        <button className={`nav-link ${route === "analytics" ? "active" : ""}`} type="button" onClick={() => openRoute("analytics")}>
          <FaIcon name="chart" />
          Analytics
        </button>
        <button className={`nav-link ${route === "about" ? "active" : ""}`} type="button" onClick={() => openRoute("about")}>
          <FaIcon name="circleInfo" />
          About
        </button>
      </nav>
    </aside>
  );
}

function EmptySidebar({ startNewCompany }: { startNewCompany: () => void }) {
  return (
    <div className="empty-sidebar">
      <h3>No companies yet</h3>
      <p>Add a map location to start tracking applications.</p>
      <button type="button" onClick={startNewCompany}>
        <FaIcon name="plus" />
        Add company
      </button>
    </div>
  );
}
