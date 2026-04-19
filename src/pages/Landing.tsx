import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Siren, LayoutDashboard, Radio, ShieldCheck, MapPin, Activity } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background grid + glow */}
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-destructive/10 blur-3xl" />

      <header className="relative z-10 container flex items-center justify-between py-6">
        <div className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 rounded-lg bg-gradient-emergency flex items-center justify-center shadow-emergency">
            <Siren className="h-5 w-5 text-destructive-foreground" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold leading-none">ReliefLink</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">Crisis Response Network</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="status-dot text-success" />
          <span className="ml-2">Network online</span>
        </div>
      </header>

      <main className="relative z-10 container pt-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl mx-auto text-center"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/60 backdrop-blur border border-border/60 text-xs font-medium">
            <Radio className="h-3 w-3 text-success" />
            Real-time coordination · Offline-resilient
          </span>
          <h2 className="mt-6 font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.05] tracking-tight">
            When seconds matter,<br />
            <span className="text-gradient-emergency">we close the gap.</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
            One tap connects people in crisis with the closest verified NGO field unit. Built for
            low connectivity, designed for clarity under pressure.
          </p>
        </motion.div>

        <div className="mt-14 grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          <RoleCard
            to="/user"
            title="I need help"
            subtitle="Request emergency assistance"
            description="One-tap SOS with your live GPS, or submit a detailed request for medical, food, rescue, or other aid."
            icon={<Siren className="h-6 w-6" />}
            tone="emergency"
            cta="Open SOS"
            delay={0.1}
          />
          <RoleCard
            to="/ngo"
            title="NGO Dashboard"
            subtitle="Coordinate field response"
            description="See live requests on the map, triage by priority, dispatch units, and track completions in real time."
            icon={<LayoutDashboard className="h-6 w-6" />}
            tone="ngo"
            cta="Open Dashboard"
            delay={0.2}
          />
        </div>

        <div className="mt-6 max-w-4xl mx-auto">
          <Link
            to="/simulation"
            className="group flex items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 backdrop-blur p-5 transition-all"
          >
            <div className="h-11 w-11 rounded-xl bg-gradient-emergency shadow-emergency flex items-center justify-center">
              <Radio className="h-5 w-5 text-destructive-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30">
                  Restricted
                </span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Government Sandbox</span>
              </div>
              <h3 className="mt-1.5 font-display text-lg font-bold">Disaster Simulation Command</h3>
              <p className="text-sm text-muted-foreground">Stress-test response with live multi-event crisis scenarios.</p>
            </div>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">→</span>
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          <Stat icon={<MapPin className="h-4 w-4" />} label="Coverage" value="Global" />
          <Stat icon={<Activity className="h-4 w-4" />} label="Avg dispatch" value="< 90 sec" />
          <Stat icon={<ShieldCheck className="h-4 w-4" />} label="Verified NGOs" value="12,400+" />
        </div>
      </main>
    </div>
  );
};

function RoleCard({
  to, title, subtitle, description, icon, tone, cta, delay,
}: {
  to: string; title: string; subtitle: string; description: string;
  icon: React.ReactNode; tone: "emergency" | "ngo"; cta: string; delay: number;
}) {
  const isEmergency = tone === "emergency";
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={to}
        className="group relative block overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-7 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1"
      >
        <div
          className={`absolute -top-24 -right-24 h-56 w-56 rounded-full blur-3xl opacity-40 group-hover:opacity-70 transition-opacity ${
            isEmergency ? "bg-destructive" : "bg-primary"
          }`}
        />
        <div className="relative">
          <div
            className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${
              isEmergency ? "bg-gradient-emergency shadow-emergency" : "bg-gradient-ngo shadow-ngo"
            } text-primary-foreground`}
          >
            {icon}
          </div>
          <p className="mt-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">{subtitle}</p>
          <h3 className="mt-2 font-display text-3xl font-bold">{title}</h3>
          <p className="mt-3 text-muted-foreground text-sm leading-relaxed">{description}</p>
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-foreground/90 group-hover:gap-3 transition-all">
            {cta}
            <span aria-hidden>→</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 backdrop-blur px-4 py-3">
      <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-display font-semibold">{value}</div>
      </div>
    </div>
  );
}

export default Landing;
