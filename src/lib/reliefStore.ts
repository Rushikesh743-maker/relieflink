// Lightweight in-memory pub/sub "socket" simulation + localStorage sync.
// Provides the shared state between the User app and the NGO Dashboard.

export type Priority = "high" | "medium" | "low";
export type RequestType = "medical" | "food" | "rescue" | "other";
export type RequestStatus = "pending" | "assigned" | "in_progress" | "completed";

export interface ReliefRequest {
  id: string;
  type: RequestType;
  priority: Priority;
  status: RequestStatus;
  description: string;
  name: string;
  contact: string;
  location: { lat: number; lng: number };
  createdAt: number;
  assignedNgoId?: string;
  syncedOffline?: boolean;
}

export interface NGO {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  capacity: number;
  active: number;
}

const STORAGE_KEY = "relieflink:requests";
const PENDING_KEY = "relieflink:pending-offline";

type Listener = () => void;
const listeners = new Set<Listener>();

const seedNGOs: NGO[] = [
  { id: "ngo-1", name: "Red Crescent — Central", location: { lat: 28.6139, lng: 77.209 }, capacity: 12, active: 4 },
  { id: "ngo-2", name: "Mercy Corps Field Unit", location: { lat: 28.6304, lng: 77.2177 }, capacity: 8, active: 2 },
  { id: "ngo-3", name: "Direct Relief North", location: { lat: 28.5977, lng: 77.1934 }, capacity: 10, active: 3 },
];

function loadRequests(): ReliefRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // Seed with a few demo requests around Delhi
  const seed: ReliefRequest[] = [
    {
      id: crypto.randomUUID(),
      type: "medical",
      priority: "high",
      status: "pending",
      description: "Insulin needed urgently for elderly resident",
      name: "Anonymous",
      contact: "+91 90000 11111",
      location: { lat: 28.6219, lng: 77.2089 },
      createdAt: Date.now() - 1000 * 60 * 4,
    },
    {
      id: crypto.randomUUID(),
      type: "food",
      priority: "medium",
      status: "assigned",
      description: "Family of 5 displaced, needs meals for 24h",
      name: "R. Kumar",
      contact: "+91 90000 22222",
      location: { lat: 28.6042, lng: 77.2275 },
      createdAt: Date.now() - 1000 * 60 * 18,
      assignedNgoId: "ngo-2",
    },
    {
      id: crypto.randomUUID(),
      type: "rescue",
      priority: "high",
      status: "in_progress",
      description: "Trapped on second floor, water rising",
      name: "S. Patel",
      contact: "+91 90000 33333",
      location: { lat: 28.6358, lng: 77.215 },
      createdAt: Date.now() - 1000 * 60 * 9,
      assignedNgoId: "ngo-1",
    },
    {
      id: crypto.randomUUID(),
      type: "other",
      priority: "low",
      status: "completed",
      description: "Blanket distribution complete",
      name: "M. Singh",
      contact: "—",
      location: { lat: 28.5985, lng: 77.2 },
      createdAt: Date.now() - 1000 * 60 * 60,
      assignedNgoId: "ngo-3",
    },
  ];
  persist(seed);
  return seed;
}

function persist(reqs: ReliefRequest[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reqs));
  } catch {}
}

let requests: ReliefRequest[] = [];
let initialized = false;

function ensureInit() {
  if (!initialized && typeof window !== "undefined") {
    requests = loadRequests();
    initialized = true;
    // Cross-tab sync
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          requests = JSON.parse(e.newValue);
          emit();
        } catch {}
      }
    });
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export const reliefStore = {
  subscribe(l: Listener) {
    ensureInit();
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getRequests(): ReliefRequest[] {
    ensureInit();
    return requests;
  },
  getNGOs(): NGO[] {
    return seedNGOs;
  },
  addRequest(r: Omit<ReliefRequest, "id" | "createdAt" | "status">) {
    ensureInit();
    const newReq: ReliefRequest = {
      ...r,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      status: "pending",
    };
    requests = [newReq, ...requests];
    persist(requests);
    emit();
    return newReq;
  },
  updateStatus(id: string, status: RequestStatus, ngoId?: string) {
    ensureInit();
    requests = requests.map((r) =>
      r.id === id ? { ...r, status, assignedNgoId: ngoId ?? r.assignedNgoId } : r
    );
    persist(requests);
    emit();
  },
  assignNgo(id: string, ngoId: string) {
    this.updateStatus(id, "assigned", ngoId);
  },
  // Offline queue
  queueOffline(r: Omit<ReliefRequest, "id" | "createdAt" | "status">) {
    try {
      const existing: typeof r[] = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
      existing.push(r);
      localStorage.setItem(PENDING_KEY, JSON.stringify(existing));
    } catch {}
  },
  flushOffline() {
    try {
      const existing: Omit<ReliefRequest, "id" | "createdAt" | "status">[] = JSON.parse(
        localStorage.getItem(PENDING_KEY) || "[]"
      );
      if (!existing.length) return 0;
      existing.forEach((r) => this.addRequest({ ...r, syncedOffline: true }));
      localStorage.removeItem(PENDING_KEY);
      return existing.length;
    } catch {
      return 0;
    }
  },
  pendingOfflineCount(): number {
    try {
      return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]").length;
    } catch {
      return 0;
    }
  },
};

// React hook
import { useSyncExternalStore } from "react";
export function useReliefRequests() {
  return useSyncExternalStore(
    reliefStore.subscribe.bind(reliefStore),
    reliefStore.getRequests.bind(reliefStore),
    () => []
  );
}
