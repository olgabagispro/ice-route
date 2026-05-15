import { 
  ChevronLeft, 
  Settings, 
  Zap, 
  Maximize2, 
  ShieldCheck, 
  Thermometer, 
  Gauge, 
  BarChart3, 
  Activity,
  Video,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { cn } from "../lib/utils";
import type { Vessel } from "./SavedVessels";

interface VesselDetailProps {
  vessel: Vessel;
  onBack: () => void;
}

export function VesselDetail({ vessel, onBack }: VesselDetailProps) {
  return (
    <div className="w-full h-full min-h-0 overflow-y-auto bg-background custom-scrollbar">
      <div className="p-6 md:p-10 pb-32 md:pb-16 max-w-7xl mx-auto">
        {/* Breadcrumbs */}
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[10px] font-bold font-mono text-on-surface-variant hover:text-primary transition-colors mb-8 uppercase tracking-[0.2em]"
        >
          <ChevronLeft size={16} /> BACK TO FLEET ARCHIVE
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-2">
            <p className="text-[10px] font-bold font-mono text-secondary tracking-[0.3em] uppercase">VESSEL PROFILE: {vessel.id}</p>
            <h2 className="text-4xl md:text-5xl font-bold text-on-surface uppercase tracking-tighter">{vessel.name}</h2>
            <p className="text-sm md:text-base text-on-surface-variant max-w-xl font-medium leading-relaxed">
              Technical parameters and simulation data for ice-breaking capability assessment.
            </p>
          </div>
          <div className="flex gap-2">
             <div className="h-1.5 w-12 bg-secondary rounded-full"></div>
             <div className="h-1.5 w-12 bg-surface-highest/20 rounded-full"></div>
             <div className="h-1.5 w-12 bg-surface-highest/20 rounded-full"></div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Specs and Simulation */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Technical Input Section */}
            <div className="technical-card bg-surface-highest/5 border-outline/10 p-8 space-y-8">
              <div className="flex items-center gap-3 border-b border-outline/10 pb-4">
                <Settings className="text-secondary" size={20} />
                <h3 className="text-[11px] font-bold font-mono text-on-surface tracking-[0.3em] uppercase">TECHNICAL CONFIGURATION</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold font-mono text-on-surface-variant uppercase tracking-wider">Gross Tonnage (GT)</label>
                  <div className="relative">
                    <input 
                      readOnly 
                      value={vessel.gt} 
                      className="w-full bg-surface-highest/10 border-b border-outline/30 px-4 py-4 font-mono text-lg font-bold text-primary focus:outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono text-outline font-bold">MT</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold font-mono text-on-surface-variant uppercase tracking-wider">Hull Category</label>
                  <div className="relative">
                    <select 
                      disabled
                      className="w-full bg-surface-highest/10 border-b border-outline/30 px-4 py-4 font-mono text-sm font-bold text-on-surface appearance-none focus:outline-none"
                    >
                      <option selected>{vessel.iceClass} - OPTIMIZED</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold font-mono text-on-surface-variant uppercase tracking-wider">Engine Output</label>
                  <div className="relative">
                    <input 
                      readOnly 
                      value={vessel.power.split(' ')[0]} 
                      className="w-full bg-surface-highest/10 border-b border-outline/30 px-4 py-4 font-mono text-lg font-bold text-primary focus:outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono text-outline font-bold">KW</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold font-mono text-on-surface-variant uppercase tracking-wider">Beam Width</label>
                  <div className="relative">
                    <input 
                      readOnly 
                      value="34.5" 
                      className="w-full bg-surface-highest/10 border-b border-outline/30 px-4 py-4 font-mono text-lg font-bold text-primary focus:outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono text-outline font-bold">METERS</span>
                  </div>
                </div>
              </div>

              {/* Hull Reinforcement */}
              <div className="p-6 bg-surface-highest/10 border border-outline/10 relative overflow-hidden">
                <div className="flex justify-between items-center mb-8 relative z-10">
                  <h4 className="text-sm font-bold text-on-surface tracking-tight uppercase flex items-center gap-2">
                    <ShieldCheck size={16} className="text-secondary" /> HULL REINFORCEMENT
                  </h4>
                  <span className="bg-secondary/10 text-secondary px-3 py-1 text-[9px] font-bold font-mono border border-secondary/20 rounded">PREMIUM STEEL GRADE</span>
                </div>
                <div className="space-y-6 relative z-10">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold font-mono text-on-surface-variant uppercase tracking-wider">
                      <span>Bow Strength Index</span>
                      <span className="text-secondary">0.88</span>
                    </div>
                    <div className="h-1.5 bg-surface-highest/20 w-full overflow-hidden">
                      <div className="h-full bg-secondary w-[88%] shadow-[0_0_10px_rgba(253,139,0,0.3)]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold font-mono text-on-surface-variant uppercase tracking-wider">
                      <span>Midship Strength Index</span>
                      <span className="text-secondary">0.72</span>
                    </div>
                    <div className="h-1.5 bg-surface-highest/20 w-full overflow-hidden">
                      <div className="h-full bg-secondary w-[72%] shadow-[0_0_10px_rgba(253,139,0,0.3)]" />
                    </div>
                  </div>
                </div>
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none">
                  <Zap size={128} />
                </div>
              </div>

              <button className="w-full bg-secondary text-background font-bold font-mono tracking-[0.3em] text-xs py-5 hover:bg-secondary-dim active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-secondary/10">
                <Activity size={18} /> RUN BRIDGE SIMULATION
              </button>
            </div>
          </div>

          {/* Right Column: Virtual Feed and Performance */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* Virtual Bridge Feed */}
            <div className="technical-card p-0 bg-surface-highest/10 border-outline/10 overflow-hidden relative group">
              <div className="aspect-video relative overflow-hidden">
                <img 
                  src={vessel.image} 
                  alt="Virtual Bridge Feed" 
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-700" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                
                {/* HUD Overlays */}
                <div className="absolute top-6 left-6 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-secondary">
                    <Video size={14} />
                    <span className="text-[10px] font-bold font-mono tracking-widest uppercase">VIRTUAL BRIDGE FEED : 001</span>
                  </div>
                  <div className="w-32 h-[1px] bg-secondary/50" />
                </div>

                <div className="absolute bottom-6 left-6 right-6 grid grid-cols-3 gap-3">
                  <div className="bg-surface/80 backdrop-blur-md p-3 border border-outline/20">
                    <p className="text-[8px] font-bold font-mono text-on-surface-variant uppercase mb-1">SOG</p>
                    <p className="text-lg font-bold font-mono text-primary">14.2<span className="text-[9px] ml-1">KTS</span></p>
                  </div>
                  <div className="bg-surface/80 backdrop-blur-md p-3 border border-outline/20">
                    <p className="text-[8px] font-bold font-mono text-on-surface-variant uppercase mb-1">ICE THICK</p>
                    <p className="text-lg font-bold font-mono text-secondary">2.8<span className="text-[9px] ml-1">M</span></p>
                  </div>
                  <div className="bg-surface/80 backdrop-blur-md p-3 border border-outline/20">
                    <p className="text-[8px] font-bold font-mono text-on-surface-variant uppercase mb-1">HULL LOAD</p>
                    <p className="text-lg font-bold font-mono text-error">64<span className="text-[9px] ml-1">%</span></p>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="technical-card p-8 bg-surface-highest/10 border-outline/10">
               <div className="flex justify-between items-center mb-8 border-b border-outline/10 pb-4">
                <h3 className="text-[11px] font-bold font-mono text-on-surface-variant tracking-[0.3em] uppercase">CLASS PERFORMANCE</h3>
                <span className="text-secondary font-bold font-mono text-[11px]">{vessel.iceClass} RATING</span>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between group">
                  <span className="text-[11px] font-bold font-mono text-on-surface-variant uppercase tracking-wider group-hover:text-on-surface transition-colors">Multi-year Ice Entry</span>
                  <CheckCircle2 size={16} className="text-green-500" />
                </div>
                <div className="flex items-center justify-between group">
                  <span className="text-[11px] font-bold font-mono text-on-surface-variant uppercase tracking-wider group-hover:text-on-surface transition-colors">Continuous Motion</span>
                  <CheckCircle2 size={16} className="text-green-500" />
                </div>
                <div className="flex items-center justify-between group">
                  <span className="text-[11px] font-bold font-mono text-on-surface-variant uppercase tracking-wider group-hover:text-on-surface transition-colors">Ramming Endurance</span>
                  <AlertTriangle size={16} className="text-secondary" />
                </div>
              </div>

              {/* Emissions Graph Placeholder */}
              <div className="mt-10 pt-8 border-t border-outline/10">
                <h4 className="text-[10px] font-bold font-mono text-on-surface-variant tracking-[0.2em] uppercase mb-6">PREDICTED EMISSIONS PROFILE</h4>
                <div className="h-24 flex items-end gap-1.5">
                  {[20, 45, 75, 55, 35, 15].map((h, i) => (
                    <div 
                      key={i} 
                      style={{ height: `${h}%` }}
                      className={cn(
                        "flex-1 transition-all duration-1000",
                        i === 2 ? "bg-secondary" : "bg-primary/20 hover:bg-primary/40"
                      )}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-3 text-[9px] font-mono font-bold text-on-surface-variant">
                  <span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span><span>Q5</span><span>Q6</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
