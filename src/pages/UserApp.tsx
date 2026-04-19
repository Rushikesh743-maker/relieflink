import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Siren, ArrowLeft, MapPin, Loader2, Heart, UtensilsCrossed,
  LifeBuoy, HelpCircle, WifiOff, CloudUpload, CheckCircle2, Clock, UserRound, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { reliefStore, useReliefRequests, type RequestType, type Priority } from "@/lib/reliefStore";
import { useOnlineStatus } from "@/hooks/use-online-status";

const requestTypes: { value: RequestType; label: string; icon: React.ComponentType<{ className?: string }>; priority: Priority }[] = [
  { value: "medical", label: "Medical", icon: Heart, priority: "high" },
  { value: "rescue", label: "Rescue", icon: LifeBuoy, priority: "high" },
  { value: "food", label: "Food / Water", icon: UtensilsCrossed, priority: "medium" },
  { value: "other", label: "Other", icon: HelpCircle, priority: "low" },
];

const UserApp = () => {
  const online = useOnlineStatus();
  const allRequests = useReliefRequests();
  const [myRequestIds, setMyRequestIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("relieflink:my-requests") || "[]"); } catch { return []; }
  });
  const [locating, setLocating] = useState(false);
  const [pendingOffline, setPendingOffline] = useState(reliefStore.pendingOfflineCount());

  const myRequests = useMemo(
    () => allRequests.filter((r) => myRequestIds.includes(r.id)).sort((a, b) => b.createdAt - a.createdAt),
    [allRequests, myRequestIds]
  );

  // Flush offline queue when back online
  useEffect(() => {
    if (online) {
      const flushed = reliefStore.flushOffline();
      setPendingOffline(0);
      if (flushed > 0) {
        toast.success(`${flushed} offline request${flushed > 1 ? "s" : ""} synced`);
      }
    }
  }, [online]);

  const trackRequest = (id: string) => {
    const next = [id, ...myRequestIds].slice(0, 20);
    setMyRequestIds(next);
    localStorage.setItem("relieflink:my-requests", JSON.stringify(next));
  };

  const submit = (type: RequestType, opts: { description?: string; name?: string; contact?: string; priority?: Priority }) => {
    setLocating(true);
    const fallback = { lat: 28.6139 + (Math.random() - 0.5) * 0.04, lng: 77.209 + (Math.random() - 0.5) * 0.04 };

    const finalize = (location: { lat: number; lng: number }) => {
      const payload = {
        type,
        priority: opts.priority ?? requestTypes.find((t) => t.value === type)!.priority,
        description: opts.description || "Emergency assistance requested via SOS",
        name: opts.name || "Anonymous",
        contact: opts.contact || "—",
        location,
      };

      if (!online) {
        reliefStore.queueOffline(payload);
        setPendingOffline(reliefStore.pendingOfflineCount());
        toast.warning("Offline — saved locally, will sync when reconnected");
        setLocating(false);
        return;
      }

      const created = reliefStore.addRequest(payload);
      trackRequest(created.id);
      toast.success("Request broadcast to nearby NGOs", { description: "You'll see live status updates below." });
      setLocating(false);
    };

    if (!navigator.geolocation) { finalize(fallback); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => finalize({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => finalize(fallback),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container flex items-center justify-between py-3">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Link>
          <div className="flex items-center gap-2 text-xs">
            <span className={`status-dot ${online ? "text-success" : "text-warning"}`} />
            <span className="ml-2 text-muted-foreground">{online ? "Connected" : "Offline mode"}</span>
          </div>
        </div>
      </header>

      {/* Offline banner */}
      <AnimatePresence>
        {!online && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-warning/15 border-b border-warning/30"
          >
            <div className="container py-3 flex items-center gap-3 text-sm">
              <WifiOff className="h-4 w-4 text-warning shrink-0" />
              <span className="text-warning-foreground/90">
                You're offline. Requests are saved on your device and will sync the moment you reconnect.
              </span>
              {pendingOffline > 0 && (
                <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-warning/20 text-warning flex items-center gap-1.5">
                  <CloudUpload className="h-3 w-3" /> {pendingOffline} queued
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="container pt-8">
        <div className="max-w-2xl mx-auto">
          {/* SOS hero */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Emergency SOS</p>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold">
              One tap. We share your location.
            </h1>
            <p className="mt-2 text-muted-foreground text-sm">
              Sends your live GPS and a high-priority alert to the nearest NGO unit.
            </p>
          </motion.div>

          <div className="mt-10 flex justify-center">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => submit("rescue", { priority: "high", description: "SOS — immediate assistance needed" })}
              disabled={locating}
              className="relative h-44 w-44 sm:h-52 sm:w-52 rounded-full bg-gradient-emergency text-destructive-foreground shadow-emergency flex flex-col items-center justify-center font-display font-bold text-2xl tracking-wide disabled:opacity-90 disabled:cursor-wait"
            >
              <span className="pulse-ring" aria-hidden />
              <span className="pulse-ring" style={{ animationDelay: "1s" }} aria-hidden />
              {locating ? (
                <Loader2 className="h-10 w-10 animate-spin" />
              ) : (
                <>
                  <Siren className="h-10 w-10 mb-2" />
                  <span>SOS</span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.2em] mt-1 opacity-90">
                    Tap to alert
                  </span>
                </>
              )}
            </motion.button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> Your GPS is shared only with assigned responders
          </div>

          {/* Detailed request */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-14 rounded-2xl border border-border/60 bg-card/70 backdrop-blur p-6 sm:p-8 shadow-card"
          >
            <h2 className="font-display text-xl font-semibold">Detailed request</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pick a category and add context — helps responders prepare the right resources.
            </p>
            <DetailedForm onSubmit={submit} disabled={locating} />
          </motion.section>

          {/* Status tracker */}
          <section className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Your requests
              </h2>
              <span className="text-xs text-muted-foreground">{myRequests.length} active</span>
            </div>

            {myRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
                No requests yet. Submit one above and you'll see live status here.
              </div>
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {myRequests.map((r) => (
                    <motion.li
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 260, damping: 24 }}
                    >
                      <RequestStatusCard request={r} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

function DetailedForm({
  onSubmit, disabled,
}: {
  onSubmit: (type: RequestType, opts: { description?: string; name?: string; contact?: string; priority?: Priority }) => void;
  disabled?: boolean;
}) {
  const [type, setType] = useState<RequestType>("medical");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [description, setDescription] = useState("");

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(type, { name, contact, description });
    setDescription("");
  };

  return (
    <form onSubmit={handle} className="mt-5 space-y-5">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type of help</Label>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {requestTypes.map((t) => {
            const active = t.value === type;
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 transition-all ${
                  active
                    ? "border-primary bg-primary/10 shadow-ngo"
                    : "border-border/60 bg-secondary/40 hover:bg-secondary"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground">Name (optional)</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Anonymous" className="mt-2" />
        </div>
        <div>
          <Label htmlFor="contact" className="text-xs uppercase tracking-wider text-muted-foreground">Contact</Label>
          <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or radio call sign" className="mt-2" />
        </div>
      </div>

      <div>
        <Label htmlFor="desc" className="text-xs uppercase tracking-wider text-muted-foreground">Describe the situation</Label>
        <Textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="E.g. 3 people, one with chest pain, no road access from the north side."
          className="mt-2 min-h-[100px]"
          required
        />
      </div>

      <Button type="submit" disabled={disabled} className="w-full bg-gradient-ngo hover:opacity-95 shadow-ngo h-12 text-base font-semibold">
        {disabled ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserRound className="h-4 w-4 mr-2" />}
        Submit request
      </Button>
    </form>
  );
}

function RequestStatusCard({ request }: { request: ReturnType<typeof useReliefRequests>[number] }) {
  const steps: { key: typeof request.status; label: string }[] = [
    { key: "pending", label: "Received" },
    { key: "assigned", label: "NGO Assigned" },
    { key: "in_progress", label: "En route" },
    { key: "completed", label: "Completed" },
  ];
  const idx = steps.findIndex((s) => s.key === request.status);
  const ngo = reliefStore.getNGOs().find((n) => n.id === request.assignedNgoId);

  const priorityStyles =
    request.priority === "high"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : request.priority === "medium"
      ? "bg-warning/15 text-warning border-warning/30"
      : "bg-success/15 text-success border-success/30";

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border ${priorityStyles}`}>
              {request.priority}
            </span>
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{request.type}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> {timeAgo(request.createdAt)}
            </span>
          </div>
          <p className="mt-2 text-sm">{request.description}</p>
          {ngo && (
            <p className="mt-2 text-xs text-primary flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Assigned to {ngo.name}
            </p>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="mt-5 grid grid-cols-4 gap-2">
        {steps.map((s, i) => {
          const reached = i <= idx;
          const current = i === idx && request.status !== "completed";
          return (
            <div key={s.key} className="flex flex-col items-center text-center">
              <div className="relative h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: reached ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`absolute inset-y-0 left-0 ${
                    request.status === "completed" ? "bg-success" : "bg-primary"
                  }`}
                />
              </div>
              <span className={`mt-2 text-[10px] uppercase tracking-wider ${
                reached ? "text-foreground font-medium" : "text-muted-foreground"
              }`}>
                {s.label}
              </span>
              {current && <span className="status-dot text-primary mt-1" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default UserApp;
