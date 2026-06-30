export type Company = {
  id: string;
  name: string;
  positions: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  appliedAt?: string;
  rejectedAt?: string;
};

export type GeoPoint = {
  latitude: number;
  longitude: number;
  heading?: number | null;
};

export type Route = "view" | "add" | "bulk-add" | "analytics" | "about";
