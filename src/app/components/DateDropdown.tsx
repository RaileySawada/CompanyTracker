import { useMemo, useState } from "react";
import { formatDateLabel, getRelativeDateLabel } from "../lib/dates";
import { FaIcon } from "./FaIcon";

export function DateDropdown({
  availableDates,
  selectedDate,
  setSelectedDate,
}: {
  availableDates: string[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return availableDates.filter((date) => {
      if (!normalizedQuery) {
        return true;
      }

      return `${date} ${formatDateLabel(date)} ${getRelativeDateLabel(date)}`.toLowerCase().includes(normalizedQuery);
    });
  }, [availableDates, query]);

  function selectDate(date: string) {
    setSelectedDate(date);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div className="date-dropdown">
      <button className="date-trigger" type="button" onClick={() => setIsOpen((current) => !current)}>
        <span>
          <small>Showing date</small>
          <strong>{getRelativeDateLabel(selectedDate) || formatDateLabel(selectedDate)}</strong>
        </span>
        <FaIcon name={isOpen ? "chevronUp" : "chevronDown"} />
      </button>

      {isOpen ? (
        <div className="date-menu">
          <label className="date-search">
            <span className="sr-only">Search dates</span>
            <span className="input-shell">
              <FaIcon name="magnifyingGlass" />
              <input
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search date"
                type="search"
                value={query}
              />
            </span>
          </label>

          <div className="date-options">
            {dates.length ? (
              dates.map((date) => (
                <button
                  className={selectedDate === date ? "active" : ""}
                  key={date}
                  type="button"
                  onClick={() => selectDate(date)}
                >
                  <span>{getRelativeDateLabel(date) || formatDateLabel(date)}</span>
                  <small>{getRelativeDateLabel(date) ? formatDateLabel(date) : date}</small>
                </button>
              ))
            ) : (
              <p>No matching dates</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
