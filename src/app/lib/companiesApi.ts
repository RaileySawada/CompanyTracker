import { get, ref, set } from "firebase/database";
import { getRealtimeDatabase } from "./firebase";
import { loadCachedCompanies, saveCachedCompanies } from "./storage";
import type { Company } from "../types";

const COMPANIES_PATH = "companies";

function normalizeCompany(company: Company): Company {
  return {
    ...company,
    appliedAt: (company.appliedAt ?? "").trim(),
    rejectedAt: (company.rejectedAt ?? "").trim(),
  };
}

function normalizeCompanies(companies: Company[]) {
  return companies.map(normalizeCompany);
}

function parseCompanies(value: unknown) {
  if (Array.isArray(value)) {
    return normalizeCompanies(value.filter(Boolean) as Company[]);
  }

  if (value && typeof value === "object") {
    return normalizeCompanies(Object.values(value) as Company[]);
  }

  return [];
}

export async function fetchSharedCompanies() {
  const database = getRealtimeDatabase();

  if (!database) {
    throw new Error("Firebase Realtime Database config is missing.");
  }

  const snapshot = await get(ref(database, COMPANIES_PATH));
  return parseCompanies(snapshot.val());
}

export async function saveSharedCompanies(companies: Company[]) {
  const database = getRealtimeDatabase();

  if (!database) {
    throw new Error("Firebase Realtime Database config is missing.");
  }

  const nextCompanies = normalizeCompanies(companies);
  await set(ref(database, COMPANIES_PATH), nextCompanies);
  return nextCompanies;
}

export function loadCompaniesFallback() {
  return loadCachedCompanies();
}

export function cacheCompanies(companies: Company[]) {
  saveCachedCompanies(companies);
}
