const { getStore } = require("@netlify/blobs");
const { randomUUID } = require("crypto");

const STORE_NAME = "company-tracker";
const STORE_KEY = "companies";

const fallbackCompanies = [
  {
    id: "sample-northstar",
    name: "Northstar Labs",
    positions: "Frontend Developer, QA Analyst",
    locationLabel: "Makati, Metro Manila",
    latitude: 14.5547,
    longitude: 121.0244,
    createdAt: new Date().toISOString(),
  },
  {
    id: "sample-vertex",
    name: "Vertex Cloud",
    positions: "Software Engineer",
    locationLabel: "BGC, Taguig",
    latitude: 14.5503,
    longitude: 121.0507,
    createdAt: new Date().toISOString(),
  },
];

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function normalizeCompany(company) {
  const latitude = Number(company.latitude);
  const longitude = Number(company.longitude);
  const name = String(company.name || "").trim();
  const locationLabel = String(company.locationLabel || "").trim();

  if (
    !name ||
    !locationLabel ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    id: String(company.id || randomUUID()),
    name,
    positions: String(company.positions || "").trim(),
    locationLabel,
    latitude,
    longitude,
    createdAt: String(company.createdAt || new Date().toISOString()),
  };
}

function normalizeCompanies(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeCompany).filter(Boolean);
}

async function readCompanies(store) {
  const companies = await store.get(STORE_KEY, { type: "json" });
  return Array.isArray(companies) ? companies : fallbackCompanies;
}

exports.handler = async (event) => {
  const store = getStore(STORE_NAME);

  if (event.httpMethod === "GET") {
    const companies = await readCompanies(store);
    return json(200, { companies });
  }

  if (event.httpMethod === "PUT") {
    try {
      const payload = JSON.parse(event.body || "{}");
      const companies = normalizeCompanies(payload.companies);

      await store.setJSON(STORE_KEY, companies);
      return json(200, { companies });
    } catch {
      return json(400, { message: "Invalid company payload." });
    }
  }

  return json(405, { message: "Method not allowed." });
};
