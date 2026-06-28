import { useMemo, useState } from "react";
import type { PointerEvent } from "react";
import type { Company } from "../types";

export function CompanySidebar({
  companies,
  deleteCompany,
  reorderCompanies,
  startNewCompany,
  selectedId,
  startEditingCompany,
  setSelectedId,
}: {
  companies: Company[];
  deleteCompany: (id: string) => void;
  reorderCompanies: (sourceId: string, targetId: string) => void;
  startNewCompany: () => void;
  selectedId: string;
  startEditingCompany: (id: string) => void;
  setSelectedId: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [touchDragId, setTouchDragId] = useState("");
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

  function getDropTargetId(event: PointerEvent<HTMLElement>) {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    return target?.closest<HTMLElement>("[data-company-id]")?.dataset.companyId ?? "";
  }

  function startPointerDrag(event: PointerEvent<HTMLElement>, companyId: string) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setTouchDragId(companyId);
  }

  function movePointerDrag(event: PointerEvent<HTMLElement>) {
    if (!touchDragId) {
      return;
    }

    const targetId = getDropTargetId(event);
    if (targetId && targetId !== touchDragId) {
      reorderCompanies(touchDragId, targetId);
    }
  }

  function endPointerDrag(event: PointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setTouchDragId("");
  }

  return (
    <aside className="sidebar-panel">
      <div className="sidebar-top">
        <div>
          <p className="eyebrow">Companies</p>
          <h2>{companies.length} tracked</h2>
        </div>
        <button className="square-action" type="button" onClick={startNewCompany} title="Add company">
          +
        </button>
      </div>

      <label className="company-search">
        <span>Search companies</span>
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, role, location"
          type="search"
          value={query}
        />
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
          visibleCompanies.map((company) => (
            <article
              className={`company-item ${selectedId === company.id ? "active" : ""} ${
                touchDragId === company.id ? "dragging" : ""
              }`}
              data-company-id={company.id}
              draggable
              key={company.id}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", company.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                reorderCompanies(event.dataTransfer.getData("text/plain"), company.id);
              }}
            >
              <button className="company-main" type="button" onClick={() => setSelectedId(company.id)}>
                <span
                  className="drag-handle"
                  title="Drag to reorder"
                  onPointerCancel={endPointerDrag}
                  onPointerDown={(event) => startPointerDrag(event, company.id)}
                  onPointerMove={movePointerDrag}
                  onPointerUp={endPointerDrag}
                >
                  ::
                </span>
                <span className="company-icon">{company.name.slice(0, 2).toUpperCase()}</span>
                <span className="company-copy">
                  <strong>{company.name}</strong>
                  <small>{company.locationLabel}</small>
                  <em>{company.positions || "Position optional"}</em>
                </span>
              </button>
              <span className="company-actions">
                <button type="button" onClick={() => startEditingCompany(company.id)}>
                  Edit
                </button>
                <button className="danger-button" type="button" onClick={() => deleteCompany(company.id)}>
                  Delete
                </button>
              </span>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

function EmptySidebar({ startNewCompany }: { startNewCompany: () => void }) {
  return (
    <div className="empty-sidebar">
      <h3>No companies yet</h3>
      <p>Add a required map location to start tracking directions.</p>
      <button type="button" onClick={startNewCompany}>
        Add company
      </button>
    </div>
  );
}
