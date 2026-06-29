import { loadCachedCompanies, sampleCompanies, saveCachedCompanies } from "./storage";
import type { Company } from "../types";

const COMPANIES_API = "/api/companies";

type CompaniesResponse = {
  companies: Company[];
  detail?: string;
  message?: string;
};

function normalizeCompany(company: Company): Company {
  return {
    ...company,
    appliedAt: company.appliedAt ?? "",
    rejectedAt: company.rejectedAt ?? "",
  };
}

function normalizeCompanies(companies: Company[]) {
  return companies.map(normalizeCompany);
}

async function readApiError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as CompaniesResponse;
    return data.detail || data.message || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchSharedCompanies() {
  const response = await fetch(COMPANIES_API);

  if (!response.ok) {
    throw new Error(await readApiError(response, "Unable to load shared companies."));
  }

  const data = (await response.json()) as CompaniesResponse;
  return Array.isArray(data.companies) ? normalizeCompanies(data.companies) : sampleCompanies;
}

export async function saveSharedCompanies(companies: Company[]) {
  const response = await fetch(COMPANIES_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ companies }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Unable to save shared companies."));
  }

  const data = (await response.json()) as CompaniesResponse;
  return Array.isArray(data.companies) ? normalizeCompanies(data.companies) : companies;
}

export function loadCompaniesFallback() {
  return loadCachedCompanies();
}

export function cacheCompanies(companies: Company[]) {
  saveCachedCompanies(companies);
}
