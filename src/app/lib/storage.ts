import type { Company } from "../types";

const STORAGE_KEY = "company-tracker-companies";

export const sampleCompanies: Company[] = [
  {
    id: "sample-northstar",
    name: "Northstar Labs",
    positions: "Frontend Developer, QA Analyst",
    locationLabel: "Makati, Metro Manila",
    latitude: 14.5547,
    longitude: 121.0244,
    createdAt: new Date().toISOString(),
    appliedAt: "",
    rejectedAt: "",
  },
  {
    id: "sample-vertex",
    name: "Vertex Cloud",
    positions: "Software Engineer",
    locationLabel: "BGC, Taguig",
    latitude: 14.5503,
    longitude: 121.0507,
    createdAt: new Date().toISOString(),
    appliedAt: "",
    rejectedAt: "",
  },
];

function normalizeCompany(company: Company): Company {
  return {
    ...company,
    appliedAt: company.appliedAt ?? "",
    rejectedAt: company.rejectedAt ?? "",
  };
}

export function loadCachedCompanies() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return sampleCompanies;
    }

    const parsed = JSON.parse(stored) as Company[];
    return Array.isArray(parsed) ? parsed.map(normalizeCompany) : sampleCompanies;
  } catch {
    return sampleCompanies;
  }
}

export function saveCachedCompanies(companies: Company[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
}
