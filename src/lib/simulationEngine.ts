// Disaster Simulation engine — generates events, drives auto-assignment,
// tracks analytics, and exposes a small reactive store.

import { useSyncExternalStore } from "react";
import { reliefStore, type Priority, type ReliefRequest, type RequestType } from "./reliefStore";

export type DisasterType = "medical" | "fire" | "flood" | "food" | "earthquake";

export interface DisasterEvent {
  id: string;
  type: DisasterType;
  origin: { lat: number; lng: number };
  radiusKm: number;          // current affected radius (fires expand)
  severity: number;          // 0..1
  createdAt: number;
  requestIds: string[];      // associated ReliefRequest ids
  active: boolean;
}

export interface SmsAlert {
  id: string;
  ts: number;
  phone: string;
  message: string;
  type: DisasterType;
  status: "queued" | "sent";
}

export interface SimMetrics {
  totalEvents: number;
  totalRequests: number;
  completed: number;
  assigned: number;
  pending: number;
  avgResponseMs: number;     // first assignment time
  avgResolutionMs: number;   // pending -> completed
  successRate: number;       // completed / totalRequests
  loadByNgo: Record<string, number>;
  alertsSent: number;
}

interface SimState {
  running: boolean;
  speed: number;             // 1x..5x tick multiplier
  tickMs: number;
  events: DisasterEvent[];
  alerts: SmsAlert[];
  metrics: SimMetrics;
  // internal
  responseSamples: number[];
  resolutionSamples: number[];
  requestCreatedAt: Record<string, number>;
  requestAssignedAt: Record<string, number>;
}

const NGO_COORDS_BASE: { lat: number; lng: number } = { lat: 28.6139, lng: 77.209 };

const DISASTER_PRIORITY: Record<DisasterType, Priority> = {
  medical: "high",
  fire: "high",
  flood: "medium",
  food: "low",
  earthquake: "high",
};

const DISASTER_TO_REQ: Record<DisasterType, RequestType> = {
  medical: "medical",
  fire: "rescue",
  flood: "rescue",
  food: "food",
  earthquake: "rescue",
};

const PHONE_PREFIX = "+91 9";

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}
function jitter(c: { lat: number; lng: number }, kmRadius: number) {
  // crude — 1 deg lat ~ 111 km
  const r = (kmRadius / 111) * Math.sqrt(Math.random());
  const t = Math.random() * Math.PI * 2;
  return { lat: c.lat + r * Math.cos(t), lng: c.lng + (r * Math.sin(t)) / Math.cos((c.lat * Math.PI) / 180) };
}
function fakePhone() {
  return PHONE_PREFIX + Math.floor(rand(100, 999)) + " " + Math.floor(rand(10000, 99999));
}

const DISASTER_DESCRIPTIONS: Record<DisasterType, string[]> = {
  medical: ["Cardiac arrest reported", "Multiple injuries on site", "Insulin shortage at shelter", "Pregnant woman in labor"],
  fire: ["Structural fire spreading", "Smoke inhalation casualties", "Industrial fire — toxic plume", "Residential blaze, trapped occupants"],
  flood: ["Water level rising rapidly", "Family stranded on rooftop", "Vehicle submerged", "Low-lying area evacuation needed"],
  food: ["Shelter food supply critical", "Community kitchen capacity exceeded", "Drinking water shortage", "Infant formula needed"],
  earthquake: ["Building collapse — survivors", "Aftershock damage assessment", "Trapped under debris", "Gas leak after tremor"],
};

let state: SimState = {
  running: false,
  speed: 1,
  tickMs: 1500,
  events: [],
  alerts: [],
  metrics: emptyMetrics(),
  responseSamples: [],
  resolutionSamples: [],
  requestCreatedAt: {},
  requestAssignedAt: {},
};

function emptyMetrics(): SimMetrics {
  return {
    totalEvents: 0,
    totalRequests: 0,
    completed: 0,
    assigned: 0,
    pending: 0,
    avgResponseMs: 0,
    avgResolutionMs: 0,
    successRate: 0,
    loadByNgo: {},
    alertsSent: 0,
  };
}

const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

let tickHandle: number | null = null;

function pushAlert(type: DisasterType, message: string) {
  const a: SmsAlert = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    phone: fakePhone(),
    message,
    type,
    status: "sent",
  };
  state.alerts = [a, ...state.alerts].slice(0, 60);
  state.metrics.alertsSent++;
}

function recomputeMetrics() {
  const reqs = reliefStore.getRequests();
  const simReqIds = new Set(state.events.flatMap((e) => e.requestIds));
  const ours = reqs.filter((r) => simReqIds.has(r.id));
  state.metrics.totalRequests = ours.length;
  state.metrics.completed = ours.filter((r) => r.status === "completed").length;
  state.metrics.assigned = ours.filter((r) => r.status === "assigned" || r.status === "in_progress").length;
  state.metrics.pending = ours.filter((r) => r.status === "pending").length;
  state.metrics.successRate = ours.length ? state.metrics.completed / ours.length : 0;
  state.metrics.avgResponseMs = avg(state.responseSamples);
  state.metrics.avgResolutionMs = avg(state.resolutionSamples);
  // load distribution
  const load: Record<string, number> = {};
  ours.forEach((r) => {
    if (r.assignedNgoId) load[r.assignedNgoId] = (load[r.assignedNgoId] ?? 0) + 1;
  });
  state.metrics.loadByNgo = load;
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function nearestNgoId(loc: { lat: number; lng: number }) {
  const ngos = reliefStore.getNGOs();
  return ngos
    .map((n) => ({ id: n.id, d: Math.hypot(n.location.lat - loc.lat, n.location.lng - loc.lng) }))
    .sort((a, b) => a.d - b.d)[0].id;
}

function spawnRequestFor(event: DisasterEvent, location: { lat: number; lng: number }) {
  const desc = DISASTER_DESCRIPTIONS[event.type][randInt(0, DISASTER_DESCRIPTIONS[event.type].length - 1)];
  const r = reliefStore.addRequest({
    type: DISASTER_TO_REQ[event.type],
    priority: DISASTER_PRIORITY[event.type],
    description: `[${event.type.toUpperCase()}] ${desc}`,
    name: "Sim Citizen",
    contact: fakePhone(),
    location,
  });
  state.requestCreatedAt[r.id] = Date.now();
  event.requestIds.push(r.id);
  pushAlert(event.type, `${event.type.toUpperCase()} ALERT — ${desc} near ${location.lat.toFixed(3)},${location.lng.toFixed(3)}`);
  return r;
}

function generateEvent(type: DisasterType, areaCenter: { lat: number; lng: number }): DisasterEvent {
  const origin = jitter(areaCenter, 12);
  const event: DisasterEvent = {
    id: crypto.randomUUID(),
    type,
    origin,
    radiusKm: type === "fire" ? 0.4 : type === "flood" ? 1.2 : type === "earthquake" ? 2.0 : 0.6,
    severity: rand(0.5, 1),
    createdAt: Date.now(),
    requestIds: [],
    active: true,
  };

  // type-specific spawn behavior
  if (type === "earthquake") {
    // simultaneous high volume
    const n = randInt(5, 9);
    for (let i = 0; i < n; i++) spawnRequestFor(event, jitter(origin, event.radiusKm));
  } else if (type === "flood") {
    // tightly clustered
    const n = randInt(3, 5);
    for (let i = 0; i < n; i++) spawnRequestFor(event, jitter(origin, 0.5));
  } else if (type === "fire") {
    // start small, expand on tick
    spawnRequestFor(event, jitter(origin, event.radiusKm));
  } else {
    // medical/food single events
    spawnRequestFor(event, jitter(origin, event.radiusKm));
  }

  state.events = [event, ...state.events];
  state.metrics.totalEvents++;
  return event;
}

function tick() {
  const now = Date.now();
  const reqs = reliefStore.getRequests();
  const reqMap = new Map(reqs.map((r) => [r.id, r]));

  // Auto-assign pending sim requests to nearest NGO
  state.events.forEach((ev) => {
    ev.requestIds.forEach((rid) => {
      const r = reqMap.get(rid);
      if (!r) return;
      if (r.status === "pending") {
        const ngoId = nearestNgoId(r.location);
        reliefStore.assignNgo(r.id, ngoId);
        state.requestAssignedAt[r.id] = now;
        const created = state.requestCreatedAt[r.id] ?? now;
        state.responseSamples.push(now - created);
        if (state.responseSamples.length > 200) state.responseSamples.shift();
      } else if (r.status === "assigned" && Math.random() < 0.55) {
        reliefStore.updateStatus(r.id, "in_progress");
      } else if (r.status === "in_progress" && Math.random() < 0.45) {
        reliefStore.updateStatus(r.id, "completed");
        const created = state.requestCreatedAt[r.id] ?? now;
        state.resolutionSamples.push(now - created);
        if (state.resolutionSamples.length > 200) state.resolutionSamples.shift();
      }
    });

    // Fire expands and spawns new nearby victims
    if (ev.type === "fire" && ev.active) {
      ev.radiusKm = Math.min(3.5, ev.radiusKm + 0.25);
      if (Math.random() < 0.5 && ev.requestIds.length < 12) {
        spawnRequestFor(ev, jitter(ev.origin, ev.radiusKm));
      }
      if (ev.radiusKm >= 3.4) ev.active = false;
    }
  });

  recomputeMetrics();
  emit();
}

export const simStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getState(): SimState {
    return state;
  },
  start(opts?: { count?: number; speed?: number }) {
    if (state.running) return;
    state.running = true;
    state.speed = opts?.speed ?? 1;

    // Generate initial wave of disasters
    const total = opts?.count ?? randInt(20, 50);
    const types: DisasterType[] = ["medical", "fire", "flood", "food", "earthquake"];
    for (let i = 0; i < total; i++) {
      const t = types[randInt(0, types.length - 1)];
      generateEvent(t, NGO_COORDS_BASE);
    }

    recomputeMetrics();
    emit();

    const loop = () => {
      tick();
      // occasionally spawn new events to keep things lively
      if (Math.random() < 0.25) {
        const t: DisasterType = (["medical", "fire", "flood", "food", "earthquake"] as DisasterType[])[randInt(0, 4)];
        generateEvent(t, NGO_COORDS_BASE);
      }
      tickHandle = window.setTimeout(loop, state.tickMs / state.speed);
    };
    tickHandle = window.setTimeout(loop, state.tickMs / state.speed);

    // unsubscribe on stop handled below
    const unsubReq = reliefStore.subscribe(() => {
      recomputeMetrics();
      emit();
    });
    (state as SimState & { _unsub?: () => void })._unsub = unsubReq;
  },
  stop() {
    state.running = false;
    if (tickHandle != null) {
      clearTimeout(tickHandle);
      tickHandle = null;
    }
    const s = state as SimState & { _unsub?: () => void };
    s._unsub?.();
    emit();
  },
  setSpeed(s: number) {
    state.speed = Math.max(1, Math.min(5, s));
    emit();
  },
  reset() {
    this.stop();
    state = {
      running: false,
      speed: 1,
      tickMs: 1500,
      events: [],
      alerts: [],
      metrics: emptyMetrics(),
      responseSamples: [],
      resolutionSamples: [],
      requestCreatedAt: {},
      requestAssignedAt: {},
    };
    emit();
  },
};

export function useSimState(): SimState {
  return useSyncExternalStore<SimState>(
    simStore.subscribe.bind(simStore),
    simStore.getState.bind(simStore),
    simStore.getState.bind(simStore),
  );
}

