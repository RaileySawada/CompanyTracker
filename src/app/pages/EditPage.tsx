import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { MapPanel } from "../components/MapPanel";
import { parseCoordinates } from "../lib/geo";
import type { Company, GeoPoint } from "../types";

export function EditPage({
  onDelete,
  onSave,
  selectedCompany,
  userLocation,
}: {
  onDelete: (id: string) => void;
  onSave: (company: Company) => void;
  selectedCompany?: Company;
  userLocation: GeoPoint | null;
}) {
  const [name, setName] = useState("");
  const [positions, setPositions] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");

  const coordinates = parseCoordinates(locationInput);
  const previewCompany: Company | undefined = coordinates
    ? {
        id: editingId || "preview",
        name: name || "Company preview",
        positions,
        locationLabel: locationLabel || "Selected location",
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        createdAt: selectedCompany?.createdAt ?? new Date().toISOString(),
      }
    : undefined;

  useEffect(() => {
    if (!selectedCompany) {
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
  }, [selectedCompany]);

  function useCurrentLocation() {
    if (!userLocation) {
      setError("Allow location permission first, then try using your current location.");
      return;
    }

    setLocationInput(`${userLocation.latitude}, ${userLocation.longitude}`);
    setLocationLabel((current) => current || "Current location");
    setError("");
  }

  function resetForm() {
    setName("");
    setPositions("");
    setLocationLabel("");
    setLocationInput("");
    setEditingId("");
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseCoordinates(locationInput);

    if (!name.trim()) {
      setError("Company name is required.");
      return;
    }

    if (!locationLabel.trim()) {
      setError("Location label is required.");
      return;
    }

    if (!parsed) {
      setError("Add coordinates or paste a Google Maps link that contains latitude and longitude.");
      return;
    }

    onSave({
      id: editingId || crypto.randomUUID(),
      name: name.trim(),
      positions: positions.trim(),
      locationLabel: locationLabel.trim(),
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      createdAt: selectedCompany?.createdAt ?? new Date().toISOString(),
    });
  }

  return (
    <section className="edit-workspace">
      <form className="editor-panel" onSubmit={handleSubmit}>
        <div className="section-heading">
          <p className="eyebrow">Company editor</p>
          <h1>{editingId ? "Edit company" : "Add company"}</h1>
          <p>
            Save a company name, optional hiring roles, and a required map location.
          </p>
        </div>

        <label>
          <span>Company name</span>
          <input
            autoComplete="organization"
            onChange={(event) => setName(event.target.value)}
            placeholder="Example: Acme Digital"
            required
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
            required
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
            required
            value={locationInput}
          />
        </label>

        <div className="form-tools">
          <button type="button" onClick={useCurrentLocation}>
            Use my GPS
          </button>
          <button className="ghost-button" type="button" onClick={resetForm}>
            Clear form
          </button>
          {editingId ? (
            <button className="danger-button" type="button" onClick={() => onDelete(editingId)}>
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

        <button className="primary-action" type="submit">
          {editingId ? "Update company" : "Add company"}
        </button>
      </form>

      <aside className="preview-panel">
        <div className="terminal-titlebar">
          <span className="window-dot red" />
          <span className="window-dot yellow" />
          <span className="window-dot green" />
          <code>company.preview</code>
        </div>
        <div className="preview-copy">
          <p className="eyebrow">Map preview</p>
          <h2>{name || "Company location"}</h2>
          <p>{locationLabel || "Paste a map URL or coordinates to preview the required location."}</p>
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
