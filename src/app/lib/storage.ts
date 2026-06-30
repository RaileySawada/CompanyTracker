import type { Company } from "../types";

export function loadCachedCompanies() {
  return [] as Company[];
}

export function saveCachedCompanies(_companies: Company[]) {
  return;
}
