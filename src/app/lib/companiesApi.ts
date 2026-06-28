import { loadCachedCompanies, sampleCompanies, saveCachedCompanies } from "./storage";
import type { Company } from "../types";

const COMPANIES_API = "/api/companies";

type CompaniesResponse = {
  companies: Company[];
};

export async function fetchSharedCompanies() {
  const response = await fetch(COMPANIES_API);

  if (!response.ok) {
    throw new Error("Unable to load shared companies.");
  }

  const data = (await response.json()) as CompaniesResponse;
  return Array.isArray(data.companies) ? data.companies : sampleCompanies;
}

export async function saveSharedCompanies(companies: Company[]) {
  const response = await fetch(COMPANIES_API, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ companies }),
  });

  if (!response.ok) {
    throw new Error("Unable to save shared companies.");
  }

  const data = (await response.json()) as CompaniesResponse;
  return Array.isArray(data.companies) ? data.companies : companies;
}

export function loadCompaniesFallback() {
  return loadCachedCompanies();
}

export function cacheCompanies(companies: Company[]) {
  saveCachedCompanies(companies);
}
