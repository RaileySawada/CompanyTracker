import { get, onDisconnect, onValue, ref, remove, set } from "firebase/database";
import { getRealtimeDatabase } from "./firebase";

const VISITOR_STORAGE_KEY = "company-tracker-visitor-id";
const PRESENCE_PATH = "presence";
const ACTIVE_WINDOW_MS = 30000;

export type VisitorPresence = {
  count: number;
  visitors: Array<{
    id: string;
    color: string;
    initials: string;
  }>;
};

function createVisitorId() {
  if ("crypto" in window && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function visitorColor(visitorId: string) {
  const palette = ["#2563eb", "#059669", "#e11d48", "#7c3aed", "#0891b2", "#f59e0b"];
  const total = [...visitorId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[total % palette.length];
}

function visitorInitials(visitorId: string) {
  const compactId = visitorId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return compactId.slice(0, 2) || "CT";
}

export function getVisitorId() {
  const savedId = window.localStorage.getItem(VISITOR_STORAGE_KEY);

  if (savedId) {
    return savedId;
  }

  const visitorId = createVisitorId();
  window.localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
  return visitorId;
}

function parsePresence(value: unknown): VisitorPresence {
  const now = Date.now();
  const visitors = value && typeof value === "object" ? Object.values(value) : [];
  const activeVisitors = visitors
    .filter((visitor): visitor is VisitorPresence["visitors"][number] & { lastSeen: number } => {
      if (!visitor || typeof visitor !== "object") {
        return false;
      }

      const lastSeen = Number((visitor as { lastSeen?: number }).lastSeen || 0);
      return now - lastSeen <= ACTIVE_WINDOW_MS;
    })
    .sort((left, right) => right.lastSeen - left.lastSeen);

  return {
    count: activeVisitors.length,
    visitors: activeVisitors.slice(0, 4).map((visitor) => ({
      id: String(visitor.id || ""),
      color: String(visitor.color || "#2563eb"),
      initials: String(visitor.initials || "CT"),
    })),
  };
}

export async function updateVisitorPresence(visitorId: string) {
  const database = getRealtimeDatabase();

  if (!database) {
    throw new Error("Firebase Realtime Database config is missing.");
  }

  const visitorRef = ref(database, `${PRESENCE_PATH}/${visitorId}`);
  await onDisconnect(visitorRef).remove();
  await set(visitorRef, {
    id: visitorId,
    color: visitorColor(visitorId),
    initials: visitorInitials(visitorId),
    lastSeen: Date.now(),
  });

  const snapshot = await get(ref(database, PRESENCE_PATH));
  return parsePresence(snapshot.val());
}

export function subscribeVisitorPresence(onPresence: (presence: VisitorPresence) => void) {
  const database = getRealtimeDatabase();

  if (!database) {
    return () => undefined;
  }

  return onValue(ref(database, PRESENCE_PATH), (snapshot) => {
    onPresence(parsePresence(snapshot.val()));
  });
}

export async function removeVisitorPresence(visitorId: string) {
  const database = getRealtimeDatabase();

  if (!database) {
    return;
  }

  await remove(ref(database, `${PRESENCE_PATH}/${visitorId}`));
}
