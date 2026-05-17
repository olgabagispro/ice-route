import { 
  Ship, 
  ChevronRight, 
  PlusCircle, 
  Star, 
  Search,
  LayoutGrid,
  List as ListIcon,
  Filter
} from "lucide-react";
import { cn } from "../lib/utils";
import { useState } from "react";
import type { Translate } from "../i18n";

export interface Vessel {
  id: string;
  name: string;
  type: string;
  status: string;
  hull: string;
  draft: string;
  gt: string;
  power: string;
  iceClass: string;
  image: string;
  active?: boolean;
}

export const INITIAL_VESSELS: Vessel[] = [
  {
    id: "V-001",
    name: "NS NORDIC SPIRIT",
    type: "Ice-Reinforced Cargo",
    status: "ACTIVE PROFILE",
    hull: "Ice-Reinforced",
    draft: "12.5m",
    gt: "125,000",
    power: "45,000 kW",
    iceClass: "PC 1",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBHWzSDBXgS2XOwC5whANf4VfQatQ_WG_nkX3FcUfcuVJSug5zO_sMRRmS1Ja3mycyBkQa_uarBG5HjA1XZjeYmA8Zyp90SXQu4TaA7VF8KAhZ8gZUULJL0scoO4TteyujWcXRIFqIBPu45EN6BTbbf9ZVfabB6_APIj4YYpTuG5hnJ-is7V0ql32QhAlG8Asplm2aprqBsLfR5ldgOYSiD3sdbBYIYxDJOhYZqbToXJMCOmkcAHlHim411cAc8whDMGEs9DVQ6a-73",
    active: true
  },
  {
    id: "V-002",
    name: "MT POLARIS REACH",
    type: "Double Hull Tanker",
    status: "RESERVE",
    hull: "Double Hull",
    draft: "14.2m",
    gt: "85,000",
    power: "32,000 kW",
    iceClass: "PC 4",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAqjJuGk1LXs0IDuuTjtPDZCOqyzN1SPrGxYHp7hxHO3WH5S3TAgvgcqc-lzuMKFO_Ww02KutsGgYvvce0OskAWmBlil306464KlS7vBNS8z1Q29P-ak1gjNzToyO18YYKH0mRaMrEnQda-NXAe2EakyagTE38XevdEuAIhVaSnodY4EUw0qqZmDCCTPnH_-eK8nW5ieb3_2lxgxZPH5y5zayYwbFMMvjBo9Z5mZXjO_kGFBs5-0ezZC57x1TdQmJ_S4FE2BYY--xZq",
    active: false
  },
  {
    id: "V-003",
    name: "CCGS AMUNDSEN",
    type: "Heavy Icebreaker",
    status: "GOVERNMENT",
    hull: "Icebreaker",
    draft: "10.1m",
    gt: "10,500",
    power: "28,000 kW",
    iceClass: "PC 3",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAqjJuGk1LXs0IDuuTjtPDZCOqyzN1SPrGxYHp7hxHO3WH5S3TAgvgcqc-lzuMKFO_Ww02KutsGgYvvce0OskAWmBlil306464KlS7vBNS8z1Q29P-ak1gjNzToyO18YYKH0mRaMrEnQda-NXAe2EakyagTE38XevdEuAIhVaSnodY4EUw0qqZmDCCTPnH_-eK8nW5ieb3_2lxgxZPH5y5zayYwbFMMvjBo9Z5mZXjO_kGFBs5-0ezZC57x1TdQmJ_S4FE2BYY--xZq",
    active: false
  }
];

interface SavedVesselsProps {
  onSelectVessel: (vessel: Vessel) => void;
  t: Translate;
}

export function SavedVessels({ onSelectVessel, t }: SavedVesselsProps) {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="w-full h-full min-h-0 overflow-y-auto bg-background custom-scrollbar">
      <div className="p-6 md:p-10 pb-32 md:pb-16 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-2">
            <p className="text-[10px] font-bold font-mono text-primary tracking-[0.3em] uppercase">{t("fleetCommand")}</p>
            <h2 className="text-4xl md:text-5xl font-bold text-on-surface uppercase tracking-tighter">{t("savedVesselsTitle")}</h2>
            <p className="text-sm md:text-base text-on-surface-variant max-w-xl font-medium leading-relaxed">
              {t("savedVesselsDescription")}
            </p>
          </div>
          <button className="px-8 py-3 bg-primary text-background font-bold font-mono text-[10px] tracking-widest hover:bg-primary-dim transition-all flex items-center gap-2 shadow-lg shadow-primary/10">
            <PlusCircle size={16} /> {t("registerNewVessel")}
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={18} />
            <input 
              type="text" 
              placeholder={t("vesselSearchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-highest/10 border border-outline/20 p-4 pl-12 text-sm font-mono focus:border-primary focus:ring-0 outline-none placeholder:text-outline/50"
            />
          </div>
          <div className="flex gap-2">
            <button className="p-4 bg-surface-highest/10 border border-outline/20 text-on-surface-variant hover:text-primary transition-colors">
              <Filter size={18} />
            </button>
            <div className="flex bg-surface-highest/10 border border-outline/20 p-1">
              <button className="p-3 bg-primary text-background">
                <LayoutGrid size={18} />
              </button>
              <button className="p-3 text-on-surface-variant hover:text-primary transition-colors">
                <ListIcon size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {INITIAL_VESSELS.map((vessel) => (
            <div 
              key={vessel.id}
              onClick={() => onSelectVessel(vessel)}
              className="group technical-card p-0 bg-surface-highest/10 hover:bg-surface-highest/20 border-outline/20 hover:border-secondary transition-all overflow-hidden cursor-pointer relative"
            >
              <div className="h-48 overflow-hidden relative grayscale group-hover:grayscale-0 transition-all duration-500">
                <img 
                  src={vessel.image} 
                  alt={vessel.name}
                  className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-primary/20 group-hover:bg-transparent transition-colors" />
                <div className="absolute top-4 left-4 px-2 py-1 bg-surface/80 backdrop-blur-md border border-outline/20 text-[9px] font-bold font-mono text-secondary tracking-widest uppercase">
                  {vessel.iceClass} {t("rating")}
                </div>
              </div>
              
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-bold font-mono text-on-surface-variant mb-1 tracking-wider uppercase">{vessel.type}</p>
                    <h3 className="text-xl font-bold text-on-surface group-hover:text-secondary transition-colors tracking-tight">{vessel.name}</h3>
                  </div>
                  {vessel.active && <Star size={16} className="text-secondary fill-secondary" />}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline/10">
                  <div>
                    <p className="text-[8px] font-bold font-mono text-on-surface-variant uppercase tracking-wider mb-1">{t("grossTonnage")}</p>
                    <p className="text-sm font-bold font-mono text-primary">{vessel.gt} MT</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold font-mono text-on-surface-variant uppercase tracking-wider mb-1">{t("seaDraft")}</p>
                    <p className="text-sm font-bold font-mono text-primary">{vessel.draft}</p>
                  </div>
                </div>

                <div className="mt-6">
                   <button className="w-full py-2 bg-surface-highest/20 hover:bg-surface-highest/40 text-[10px] font-bold font-mono tracking-[0.2em] uppercase transition-colors flex items-center justify-center gap-2">
                    {t("viewSpecifications")} <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Accents */}
              <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-secondary/20 group-hover:border-secondary/50 transition-colors" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-secondary/20 group-hover:border-secondary/50 transition-colors" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
