export type Company = {
  id: string;
  name: string;
  positions: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  createdAt: string;
};

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type Route = "view" | "edit";
