import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Play, Pause, RotateCcw, Activity, Siren, Radio, MessageSquare,
  Flame, Droplets, HeartPulse, Wheat, Mountain, Gauge, ShieldCheck, Timer, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { reliefStore, useReliefRequests } from "@/lib/reliefStore";
import { simStore, useSimState, type DisasterType } from "@/lib/simulationEngine";
import SimulationMap from "@/components/SimulationMap";

const TYPE_META: Record<DisasterType, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  medical:    { icon: HeartPulse, color: "hsl(0 84% 58%)",   label: "Medical" },
  fire:       { icon: Flame,      color: "hsl(15 95% 55%)",  label: "Fire" },
  flood:      { icon: Droplets,   color: "hsl(210 100% 56%)",label: "Flood" },
  food:       { icon: Wheat,      color: "hsl(38 95% 55%)",  label: "Food shortage" },
  earthquake: { icon: Mountain,   color: "hsl(280 80% 60%)", label: "Earthquake" },
};

const Simulation = () => {
  const sim = useSimState();
  const requests = useReliefRequests();
  const ngos = reliefStore.getNGOs();
  const [showHeatmap, setShowHeatmap] = useState(true);

  // stop sim on unmount
  useEffect(() => () => simStore.stop(), []);

  const simRequestIds = useMemo(() => new Set(sim.events.flatMap((e) => e.requestIds)), [sim.events]);
  const simRequests = useMemo(() => requests.filter((r) => simRequestIds.has(r.id)), [requests, simRequestIds]);

  const eventCounts = useMemo(() => {
    const c: Record<DisasterType, number> = { medical: 0, fire: 0, flood: 0, food: 0, earthquake: 0 };
    sim.events.forEach((e) => { c[e.type]++; });
    return c;
  }, [sim.events]);

  return (
    <div className="min-h-screen">
      {/* Top command bar */}
      <header className="sticky top-0 z-40 border-b border-destructive/30 bg-background/90 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-destructive to-transparent" />
        <div className="container flex items-center justify-between py-3 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
            <div className="h-9 w-9 rounded-lg bg-gradient-emergency flex items-center justify-center shadow-emergency shrink-0">
              <Radio className="h-4 w-4 text-destructive-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold leading-none truncate">Disaster Simulation Command</h1>
                <span className="text-[9px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30">
                  Restricted
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
                Government Emergency Operations · Sandbox
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`status-dot ${sim.running ? "text-destructive" : "text-muted-foreground"}`} />
            <span className="ml-1.5 text-xs text-muted-foreground hidden sm:inline">
              {sim.running ? "LIVE · DEFCON" : "Standby"}
            </span>
          </div>
        </div>
      </header>

      <main className="container py-5 space-y-5">
        {/* Controls */}
        <section className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur p-4 sm:p-5 shadow-card">
          <div className="flex flex-wrap items-center gap-4">
            {!sim.running ? (
              <Button onClick={() => simStore.start()} className="bg-gradient-emergency shadow-emergency h-11 px-5 font-semibold">
                <Play className="h-4 w-4 mr-2" /> Initiate Simulation
              </Button>
            ) : (
              <Button onClick={() => simStore.stop()} variant="secondary" className="h-11 px-5 font-semibold">
                <Pause className="h-4 w-4 mr-2" /> Pause
              </Button>
            )}
            <Button onClick={() => simStore.reset()} variant="ghost" className="h-11">
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>

            <div className="flex items-center gap-3 min-w-[200px]">
              <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" /> Speed
              </span>
              <Slider value={[sim.speed]} min={1} max={5} step={1} onValueChange={(v) => simStore.setSpeed(v[0])} className="w-32" />
              <span className="text-sm font-mono">{sim.speed}x</span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Heatmap</span>
              <Switch checked={showHeatmap} onCheckedChange={setShowHeatmap} />
            </div>
          </div>

          {/* Event-type chips */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(Object.keys(TYPE_META) as DisasterType[]).map((t) => {
              const Icon = TYPE_META[t].icon;
              return (
                <div key={t} className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2">
                  <span className="h-7 w-7 rounded-md flex items-center justify-center" style={{ background: `${TYPE_META[t].color}22`, color: TYPE_META[t].color }}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{TYPE_META[t].label}</div>
                    <div className="font-display text-base font-bold leading-tight">{eventCounts[t]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Analytics row */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric icon={<Siren className="h-4 w-4" />} label="Total events" value={sim.metrics.totalEvents} tone="danger" />
          <Metric icon={<Activity className="h-4 w-4" />} label="Active requests" value={sim.metrics.pending + sim.metrics.assigned} tone="primary" />
          <Metric icon={<Timer className="h-4 w-4" />} label="Avg response" value={fmtMs(sim.metrics.avgResponseMs)} tone="warning" />
          <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Success rate" value={`${Math.round(sim.metrics.successRate * 100)}%`} tone="success" />
        </section>

        {/* Map + side stack */}
        <section className="grid lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 rounded-2xl border border-border/60 bg-card/70 backdrop-blur p-3 shadow-card">
            <div className="flex items-center justify-between px-2 pb-3">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Theater of Operations
              </h2>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <Legend color="hsl(0 84% 58%)" label="Critical" />
                <Legend color="hsl(38 95% 55%)" label="Medium" />
                <Legend color="hsl(142 71% 45%)" label="Resolved" />
                <Legend color="hsl(210 100% 56%)" label="NGO" />
              </div>
            </div>
            <div className="h-[440px] sm:h-[560px] rounded-xl overflow-hidden">
              <SimulationMap requests={simRequests} ngos={ngos} events={sim.events} showHeatmap={showHeatmap} />
            </div>
          </div>

          <div className="lg:col-span-2 space-y-5">
            {/* SMS Alert Stream */}
            <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur shadow-card overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border/60">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> SMS Alert Stream
                </h3>
                <span className="text-xs font-mono text-muted-foreground">{sim.metrics.alertsSent} sent</span>
              </div>
              <div className="max-h-[280px] overflow-y-auto p-3 space-y-2">
                <AnimatePresence initial={false}>
                  {sim.alerts.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-8">No alerts yet — start the simulation</p>
                  )}
                  {sim.alerts.slice(0, 25).map((a) => {
                    const meta = TYPE_META[a.type];
                    const Icon = meta.icon;
                    return (
                      <motion.div
                        key={a.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ type: "spring", stiffness: 280, damping: 26 }}
                        className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-secondary/30 p-2.5"
                      >
                        <span className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center mt-0.5" style={{ background: `${meta.color}22`, color: meta.color }}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="font-mono">{a.phone}</span>
                            <span>·</span>
                            <span>{timeAgo(a.ts)}</span>
                          </div>
                          <p className="text-xs mt-0.5 leading-snug">{a.message}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            {/* Load distribution */}
            <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur shadow-card overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border/60">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> NGO Load Distribution
                </h3>
                <span className="text-xs text-muted-foreground">Avg resolve {fmtMs(sim.metrics.avgResolutionMs)}</span>
              </div>
              <div className="p-4 space-y-3">
                {ngos.map((n) => {
                  const load = sim.metrics.loadByNgo[n.id] ?? 0;
                  const max = Math.max(1, ...Object.values(sim.metrics.loadByNgo));
                  const pct = (load / max) * 100;
                  return (
                    <div key={n.id}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium truncate">{n.name}</span>
                        <span className="font-mono text-muted-foreground">{load}</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className="h-full bg-gradient-ngo"
                        />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(sim.metrics.loadByNgo).length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-4">No assignments yet</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

function Metric({
  icon, label, value, tone,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  tone: "danger" | "primary" | "success" | "warning";
}) {
  const toneClasses = {
    danger: "from-destructive/20 to-destructive/5 text-destructive border-destructive/30",
    primary: "from-primary/20 to-primary/5 text-primary border-primary/30",
    success: "from-success/20 to-success/5 text-success border-success/30",
    warning: "from-warning/20 to-warning/5 text-warning border-warning/30",
  }[tone];
  return (
    <motion.div
      layout
      className={`rounded-xl border bg-gradient-to-br ${toneClasses} p-4`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider font-medium opacity-90">{label}</span>
        <span className="opacity-80">{icon}</span>
      </div>
      <motion.div
        key={String(value)}
        initial={{ scale: 0.95, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mt-3 font-display text-2xl sm:text-3xl font-bold text-foreground tabular-nums"
      >
        {value}
      </motion.div>
    </motion.div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      {label}
    </span>
  );
}

function fmtMs(ms: number) {
  if (!ms) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${(s / 60).toFixed(1)}m`;
}
function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export default Simulation;
