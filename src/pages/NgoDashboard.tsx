import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Siren, Activity, CheckCircle2, Clock, MapPin, Radio,
  Heart, UtensilsCrossed, LifeBuoy, HelpCircle, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { reliefStore, useReliefRequests, type ReliefRequest, type RequestStatus } from "@/lib/reliefStore";
import ReliefMap from "@/components/ReliefMap";
import { toast } from "sonner";

const typeIcon = {
  medical: Heart,
  food: UtensilsCrossed,
  rescue: LifeBuoy,
  other: HelpCircle,
};

const NgoDashboard = () => {
  const requests = useReliefRequests();
  const ngos = reliefStore.getNGOs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");

  const stats = useMemo(() => {
    const high = requests.filter((r) => r.priority === "high" && r.status !== "completed").length;
    const active = requests.filter((r) => r.status !== "completed").length;
    const completed = requests.filter((r) => r.status === "completed").length;
    return { high, active, completed, total: requests.length };
  }, [requests]);

  const filtered = useMemo(() => {
    const sorted = [...requests].sort((a, b) => {
      const pr = (p: ReliefRequest["priority"]) => (p === "high" ? 0 : p === "medium" ? 1 : 2);
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (b.status === "completed" && a.status !== "completed") return -1;
      const p = pr(a.priority) - pr(b.priority);
      if (p !== 0) return p;
      return b.createdAt - a.createdAt;
    });
    if (filter === "active") return sorted.filter((r) => r.status !== "completed");
    if (filter === "completed") return sorted.filter((r) => r.status === "completed");
    return sorted;
  }, [requests, filter]);

  const visibleOnMap = filter === "completed" ? requests.filter((r) => r.status === "completed") : requests;

  const advance = (req: ReliefRequest) => {
    const next: Record<RequestStatus, RequestStatus> = {
      pending: "assigned",
      assigned: "in_progress",
      in_progress: "completed",
      completed: "completed",
    };
    const nextStatus = next[req.status];
    let ngoId = req.assignedNgoId;
    if (req.status === "pending" && !ngoId) {
      // auto-assign nearest NGO
      ngoId = ngos
        .map((n) => ({ id: n.id, d: dist(n.location, req.location) }))
        .sort((a, b) => a.d - b.d)[0].id;
    }
    reliefStore.updateStatus(req.id, nextStatus, ngoId);
    if (nextStatus === "assigned") toast.success("NGO dispatched", { description: ngos.find((n) => n.id === ngoId)?.name });
    else if (nextStatus === "in_progress") toast.info("Marked en route");
    else if (nextStatus === "completed") toast.success("Request completed");
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container flex items-center justify-between py-3 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="h-8 w-8 rounded-lg bg-gradient-ngo flex items-center justify-center shadow-ngo shrink-0">
              <Radio className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold leading-none truncate">NGO Operations Center</h1>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">Live · Coordinated response</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="status-dot text-success" />
            <span className="ml-2 text-muted-foreground">Stream live</span>
          </div>
        </div>
      </header>

      <main className="container py-6">
        {/* Stat row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Critical" value={stats.high} tone="danger" icon={<Siren className="h-4 w-4" />} />
          <StatCard label="Active requests" value={stats.active} tone="primary" icon={<Activity className="h-4 w-4" />} />
          <StatCard label="Completed" value={stats.completed} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
          <StatCard label="Field NGOs" value={ngos.length} tone="muted" icon={<MapPin className="h-4 w-4" />} />
        </div>

        {/* Map + Feed */}
        <div className="mt-6 grid lg:grid-cols-5 gap-5">
          <section className="lg:col-span-3 rounded-2xl border border-border/60 bg-card/70 backdrop-blur p-3 shadow-card">
            <div className="flex items-center justify-between px-2 pt-1 pb-3">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Live Map</h2>
              <MapLegend />
            </div>
            <div className="h-[420px] sm:h-[520px] rounded-xl overflow-hidden">
              <ReliefMap requests={visibleOnMap} ngos={ngos} selectedId={selectedId} />
            </div>
          </section>

          <section className="lg:col-span-2 rounded-2xl border border-border/60 bg-card/70 backdrop-blur shadow-card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/60">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Request Feed</h2>
              <div className="flex items-center gap-1 text-xs bg-secondary/60 rounded-full p-1">
                {(["active", "all", "completed"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-full capitalize transition-colors ${
                      filter === f ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[520px] p-3 space-y-2">
              <AnimatePresence initial={false}>
                {filtered.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-center text-sm text-muted-foreground py-12"
                  >
                    No requests in this view.
                  </motion.div>
                )}
                {filtered.map((r) => (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, x: 20, scale: 0.98 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -20, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 280, damping: 26 }}
                    onMouseEnter={() => setSelectedId(r.id)}
                    onMouseLeave={() => setSelectedId(null)}
                  >
                    <FeedCard request={r} onAdvance={() => advance(r)} ngoName={ngos.find((n) => n.id === r.assignedNgoId)?.name} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

function StatCard({
  label, value, tone, icon,
}: {
  label: string; value: number; tone: "danger" | "primary" | "success" | "muted"; icon: React.ReactNode;
}) {
  const toneClasses = {
    danger: "from-destructive/20 to-destructive/5 text-destructive border-destructive/30",
    primary: "from-primary/20 to-primary/5 text-primary border-primary/30",
    success: "from-success/20 to-success/5 text-success border-success/30",
    muted: "from-muted/40 to-muted/10 text-muted-foreground border-border",
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-gradient-to-br ${toneClasses} p-4`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider font-medium opacity-90">{label}</span>
        <span className="opacity-80">{icon}</span>
      </div>
      <div className="mt-3 font-display text-3xl font-bold text-foreground">{value}</div>
    </motion.div>
  );
}

function MapLegend() {
  const items = [
    { color: "hsl(0 84% 58%)", label: "Critical" },
    { color: "hsl(38 95% 55%)", label: "Medium" },
    { color: "hsl(142 71% 45%)", label: "Completed" },
    { color: "hsl(210 100% 56%)", label: "NGO" },
  ];
  return (
    <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: i.color, boxShadow: `0 0 8px ${i.color}` }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function FeedCard({
  request, onAdvance, ngoName,
}: {
  request: ReliefRequest; onAdvance: () => void; ngoName?: string;
}) {
  const Icon = typeIcon[request.type];
  const priority =
    request.priority === "high"
      ? { ring: "ring-destructive/40", chip: "bg-destructive text-destructive-foreground", label: "HIGH" }
      : request.priority === "medium"
      ? { ring: "ring-warning/40", chip: "bg-warning text-warning-foreground", label: "MED" }
      : { ring: "ring-success/40", chip: "bg-success text-success-foreground", label: "LOW" };

  const status = {
    pending: { label: "Pending", color: "text-warning", action: "Assign" },
    assigned: { label: "Assigned", color: "text-primary", action: "Mark en route" },
    in_progress: { label: "En route", color: "text-primary", action: "Complete" },
    completed: { label: "Completed", color: "text-success", action: "Done" },
  }[request.status];

  return (
    <div className={`group rounded-xl border border-border/70 bg-secondary/40 hover:bg-secondary/70 ring-1 ring-transparent hover:${priority.ring} p-3 transition-all`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${
          request.status === "completed" ? "bg-success/15 text-success" : "bg-background text-foreground"
        }`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${priority.chip}`}>{priority.label}</span>
            <span className="text-xs uppercase tracking-wider font-medium">{request.type}</span>
            <span className={`text-xs flex items-center gap-1 ${status.color}`}>
              <span className="status-dot" /> <span className="ml-1.5">{status.label}</span>
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> {timeAgo(request.createdAt)}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-snug text-foreground/90">{request.description}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{request.name}</span>
            <span>·</span>
            <span>{request.contact}</span>
            {ngoName && (<><span>·</span><span className="text-primary">{ngoName}</span></>)}
          </div>
        </div>
      </div>

      {request.status !== "completed" && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="secondary" onClick={onAdvance} className="h-8 text-xs">
            {status.action} <ArrowRight className="h-3 w-3 ml-1.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dx = a.lat - b.lat;
  const dy = a.lng - b.lng;
  return Math.sqrt(dx * dx + dy * dy);
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

export default NgoDashboard;
