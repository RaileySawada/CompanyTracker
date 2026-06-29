import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { FaIcon } from "../components/FaIcon";
import { MapPanel } from "../components/MapPanel";
import { geocodeLocation, parseCoordinates } from "../lib/geo";
import type { Company, GeoPoint } from "../types";

export function EditPage({
  mode = "single",
  onDelete,
  onSave,
  onSaveMany,
  selectedCompany,
  userLocation,
}: {
  mode?: "single" | "bulk";
  onDelete: (id: string) => void;
  onSave: (company: Company) => void;
  onSaveMany: (companies: Company[]) => void;
  selectedCompany?: Company;
  userLocation: GeoPoint | null;
}) {
  const [name, setName] = useState("");
  const [positions, setPositions] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkDrafts, setBulkDrafts] = useState<Company[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [isGeneratingLocation, setIsGeneratingLocation] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  const coordinates = parseCoordinates(locationInput);
  const selectedDraft = useMemo(
    () => bulkDrafts.find((company) => company.id === selectedDraftId) ?? bulkDrafts[0],
    [bulkDrafts, selectedDraftId],
  );
  const previewCompany: Company | undefined = coordinates
    ? {
        id: editingId || "preview",
        name: name || "Company preview",
        positions,
        locationLabel: locationLabel || "Selected location",
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        createdAt: selectedCompany?.createdAt ?? new Date().toISOString(),
        appliedAt: selectedCompany?.appliedAt ?? "",
        rejectedAt: selectedCompany?.rejectedAt ?? "",
      }
    : mode === "bulk"
      ? selectedDraft
      : undefined;

  useEffect(() => {
    if (mode === "bulk" || !selectedCompany) {
      setName("");
      setPositions("");
      setLocationLabel("");
      setLocationInput("");
      setEditingId("");
      setError("");
      return;
    }

    setName(selectedCompany.name);
    setPositions(selectedCompany.positions);
    setLocationLabel(selectedCompany.locationLabel);
    setLocationInput(`${selectedCompany.latitude}, ${selectedCompany.longitude}`);
    setEditingId(selectedCompany.id);
  }, [mode, selectedCompany]);

  function useCurrentLocation() {
    if (!userLocation) {
      setError("Allow location permission first, then try using your current location.");
      return;
    }

    setLocationInput(`${userLocation.latitude}, ${userLocation.longitude}`);
    setLocationLabel((current) => current || "Current location");
    setError("");
  }

  async function generateLocation() {
    const query = name.trim() || locationLabel.trim();

    if (!query) {
      setError("Add a company name or location label before generating coordinates.");
      return;
    }

    setIsGeneratingLocation(true);
    setError("");

    try {
      const result = await geocodeLocation(query, {
        locationHint: locationLabel,
        userLocation,
      });

      if (!result) {
        setError("No matching location found. Try a more specific branch, city, or address.");
        return;
      }

      setLocationInput(`${result.latitude}, ${result.longitude}`);
      setLocationLabel((current) => current || result.label);
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "Location lookup failed. Try pasting coordinates instead.",
      );
    } finally {
      setIsGeneratingLocation(false);
    }
  }

  function resetForm() {
    setName("");
    setPositions("");
    setLocationLabel("");
    setLocationInput("");
    setEditingId("");
    setError("");
  }

  function buildCompany(): Company | null {
    const parsed = parseCoordinates(locationInput);

    if (!name.trim()) {
      setError("Company name is required.");
      return null;
    }

    if (!locationLabel.trim()) {
      setError("Location label is required.");
      return null;
    }

    if (!parsed) {
      setError("Add coordinates or paste a Google Maps link that contains latitude and longitude.");
      return null;
    }

    return {
      id: editingId || crypto.randomUUID(),
      name: name.trim(),
      positions: positions.trim(),
      locationLabel: locationLabel.trim(),
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      createdAt: selectedCompany?.createdAt ?? new Date().toISOString(),
      appliedAt: selectedCompany?.appliedAt ?? "",
      rejectedAt: selectedCompany?.rejectedAt ?? "",
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const company = buildCompany();

    if (!company) {
      return;
    }

    onSave(company);
  }

  function addPendingCompany() {
    const company = buildCompany();

    if (!company) {
      return;
    }

    setBulkDrafts((currentDrafts) => [company, ...currentDrafts]);
    setSelectedDraftId(company.id);
    setBulkMessage("");
    resetForm();
  }

  function removePendingCompany(id: string) {
    setBulkDrafts((currentDrafts) => currentDrafts.filter((company) => company.id !== id));
    setSelectedDraftId((currentId) => (currentId === id ? "" : currentId));
  }

  function savePendingCompanies() {
    if (bulkDrafts.length === 0) {
      setBulkMessage("Add at least one pending company first.");
      return;
    }

    setIsBulkAdding(true);
    onSaveMany(bulkDrafts);
    setBulkDrafts([]);
    setSelectedDraftId("");
    setBulkMessage(`Added ${bulkDrafts.length} companies.`);
    setIsBulkAdding(false);
  }

  return (
    <section className={`edit-workspace ${mode === "bulk" ? "bulk-mode" : ""}`}>
      <div className="editor-stack">
        <form className={mode === "bulk" ? "editor-panel bulk-builder" : "editor-panel"} onSubmit={handleSubmit}>
          <div className="section-heading">
            <p className="eyebrow">{mode === "bulk" ? "Bulk builder" : "Company editor"}</p>
            <h1>
              <FaIcon name={editingId ? "pen" : "plus"} />
              {mode === "bulk" ? "Add to pending" : editingId ? "Edit company" : "Single add"}
            </h1>
          </div>

          <label>
            <span>Company name</span>
            <input
              autoComplete="organization"
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: Acme Digital"
              required={mode === "single"}
              value={name}
            />
          </label>

          <label>
            <span>Open roles</span>
            <textarea
              onChange={(event) => setPositions(event.target.value)}
              placeholder="Optional: React Developer, Product Designer"
              rows={3}
              value={positions}
            />
          </label>

          <label>
            <span>Location label</span>
            <input
              onChange={(event) => setLocationLabel(event.target.value)}
              placeholder="Office name, city, or branch"
              required={mode === "single"}
              value={locationLabel}
            />
          </label>

          <label>
            <span>Google Maps link or coordinates</span>
            <input
              onChange={(event) => {
                setLocationInput(event.target.value);
                setError("");
              }}
              placeholder="14.5547, 121.0244 or a Google Maps URL"
              required={mode === "single"}
              value={locationInput}
            />
          </label>

          <div className="form-tools">
            <button type="button" disabled={isGeneratingLocation} onClick={generateLocation}>
              <FaIcon name="locationDot" />
              {isGeneratingLocation ? "Finding..." : "Generate location"}
            </button>
            <button type="button" onClick={useCurrentLocation}>
              <FaIcon name="crosshairs" />
              Use my GPS
            </button>
            <button className="ghost-button" type="button" onClick={resetForm}>
              <FaIcon name="broom" />
              Clear form
            </button>
            {editingId && mode === "single" ? (
              <button className="danger-button" type="button" onClick={() => onDelete(editingId)}>
                <FaIcon name="trash" />
                Delete this
              </button>
            ) : null}
            <span className={coordinates ? "valid-hint" : "muted-hint"}>
              {coordinates
                ? `Parsed ${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`
                : "Coordinates required"}
            </span>
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          {mode === "bulk" ? (
            <button className="primary-action" type="button" onClick={addPendingCompany}>
              <FaIcon name="plus" />
              Add to pending
            </button>
          ) : (
            <button className="primary-action" type="submit">
              <FaIcon name={editingId ? "pen" : "plus"} />
              {editingId ? "Update company" : "Add company"}
            </button>
          )}
        </form>

        {mode === "bulk" ? (
          <section className="bulk-panel pending-panel">
            <div className="section-heading compact-heading">
              <p className="eyebrow">Pending bulk add</p>
              <h1>{bulkDrafts.length} companies</h1>
            </div>

            {bulkDrafts.length ? (
              <div className="pending-list">
                {bulkDrafts.map((company) => (
                  <article className={selectedDraft?.id === company.id ? "active" : ""} key={company.id}>
                    <button type="button" onClick={() => setSelectedDraftId(company.id)}>
                      <strong>{company.name}</strong>
                      <small>{company.locationLabel}</small>
                    </button>
                    <button
                      aria-label={`Remove ${company.name}`}
                      className="danger-button"
                      type="button"
                      onClick={() => removePendingCompany(company.id)}
                    >
                      <FaIcon name="trash" />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-sidebar compact">
                <h3>No pending companies</h3>
                <p>Fill out the form above, then add each company to the pending list.</p>
              </div>
            )}

            <div className="form-tools">
              <button type="button" disabled={isBulkAdding || bulkDrafts.length === 0} onClick={savePendingCompanies}>
                <FaIcon name="upload" />
                {isBulkAdding ? "Adding..." : "Save pending companies"}
              </button>
              <button className="ghost-button" type="button" onClick={() => setBulkDrafts([])}>
                <FaIcon name="broom" />
                Clear pending
              </button>
            </div>
            {bulkMessage ? <p className="bulk-message">{bulkMessage}</p> : null}
          </section>
        ) : null}
      </div>

      <aside className="preview-panel">
        <div className="terminal-titlebar">
          <span className="window-dot red" />
          <span className="window-dot yellow" />
          <span className="window-dot green" />
          <code>{mode === "bulk" ? "bulk.preview" : "company.preview"}</code>
        </div>
        <div className="preview-copy">
          <p className="eyebrow">Map preview</p>
          <h2>{previewCompany?.name || "Company location"}</h2>
          <p>
            {previewCompany?.locationLabel ||
              "Paste a map URL or coordinates to preview the required location."}
          </p>
        </div>
        <MapPanel
          className="compact"
          company={previewCompany}
          placeholder="Map preview appears after coordinates"
        />
      </aside>
    </section>
  );
}
