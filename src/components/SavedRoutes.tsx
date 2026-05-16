import { 
  Bookmark, 
  Snowflake, 
  Navigation, 
  ChevronRight, 
  PlusCircle, 
  Star, 
  BarChart3, 
  History,
  Activity,
  Sliders,
  Layers,
  User,
  Trash2
} from "lucide-react";
import { cn } from "../lib/utils";
import { useState, useEffect } from "react";
import type { Translate } from "../i18n";

const INITIAL_ROUTES = [
  {
    id: "ARC-2940-B",
    vessel: "NS NORDIC SPIRIT",
    date: "2023-11-12",
    time: "08:42 UTC",
    iceClass: "1A",
    distance: "1,240 NM",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCnzUCWwPsikkSvdqKz38t1dn88Ps7iVIPL-0YCrvIvNX3NeNOj--h4bGlVgeMT3zi6qrZVJBZ2RK5AjCQnuDLGel8d68P5W5x2tUzTcHzvLFShRqb5E7tDnTWb146IDQEKB83t0M7mYahp8Q1Mg8FmEX0nJ3SonAYOK5wjPy_XyxqeP4t1SglTqlfx_pcMvMByuXdRMOcQwc81ZRynLrLE4PRV5Z03F0aJVBJY662aC1gfPzPvRlVSjKHAPKoUM9UvDGiVwQC1HieK"
  },
  {
    id: "ARC-2811-A",
    vessel: "MT POLARIS REACH",
    date: "2023-11-08",
    time: "14:15 UTC",
    iceClass: "1B",
    distance: "892 NM",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCaV3Vflh45BhjgDzQ4R4RZFH4Kisq_YZPtRlzmjUqW6_2mPb31kP6dBVNnkcPfNtXzFt85Nw_v0diCbVrUtKVDZBxxoM778pSVG-MohP1beHkDkzbX4BD6h5-4pAzmCv5SKDN7h8ruGXOT8tETtBm2Pujhz9OnuLEx-GSklGyNosMF0f2ALiJNuZ4CsjaMEGeMmRXk7AiP41m9FAorLXKW5wPqyD2z0SZf8mWZNfVJFq-gupV5cK8zWeTkbX4HB1JCQ7h3LSbILz-D"
  },
  {
    id: "ARC-2705-D",
    vessel: "CCGS AMUNDSEN",
    date: "2023-10-30",
    time: "22:00 UTC",
    iceClass: "PC3",
    distance: "2,105 NM",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDnlE2uPeL-l--LezbPMBMhr_M3ScRCEgVUNGZB3OA-apCn7CUHZueMQaWXYy6CGKEjjo5c_e3Zv4YtLEfDg9-grLQC5X1_RbZeMxSVvtysr1MdFkVgMvBW4zqR6ySlhwfqaD6upVxWb_SsVc7JamofAjfDy-JqQj1KaEXIMlCulWci78PGYZkWYamYOQvNaRQx4R3iBPl3Z5PRL9NfpfnwYmGqzo-ST50c57kgus2cE1fWxVOz1c4vfJKKxdvF2ss3ac9ri1gGPpzs"
  },
  {
    id: "ARC-2612-E",
    vessel: "NB ARCTIC EXPLORER",
    date: "2023-10-15",
    time: "03:15 UTC",
    iceClass: "1A",
    distance: "1,520 NM",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCaV3Vflh45BhjgDzQ4R4RZFH4Kisq_YZPtRlzmjUqW6_2mPb31kP6dBVNnkcPfNtXzFt85Nw_v0diCbVrUtKVDZBxxoM778pSVG-MohP1beHkDkzbX4BD6h5-4pAzmCv5SKDN7h8ruGXOT8tETtBm2Pujhz9OnuLEx-GSklGyNosMF0f2ALiJNuZ4CsjaMEGeMmRXk7AiP41m9FAorLXKW5wPqyD2z0SZf8mWZNfVJFq-gupV5cK8zWeTkbX4HB1JCQ7h3LSbILz-D"
  },
  {
    id: "ARC-2501-F",
    vessel: "VLCC NORTHERN LIGHT",
    date: "2023-09-28",
    time: "11:45 UTC",
    iceClass: "1B",
    distance: "3,100 NM",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCnzUCWwPsikkSvdqKz38t1dn88Ps7iVIPL-0YCrvIvNX3NeNOj--h4bGlVgeMT3zi6qrZVJBZ2RK5AjCQnuDLGel8d68P5W5x2tUzTcHzvLFShRqb5E7tDnTWb146IDQEKB83t0M7mYahp8Q1Mg8FmEX0nJ3SonAYOK5wjPy_XyxqeP4t1SglTqlfx_pcMvMByuXdRMOcQwc81ZRynLrLE4PRV5Z03F0aJVBJY662aC1gfPzPvRlVSjKHAPKoUM9UvDGiVwQC1HieK"
  },
  {
    id: "ARC-2402-G",
    vessel: "MS ARCTIC STAR",
    date: "2023-09-12",
    time: "09:20 UTC",
    iceClass: "PC2",
    distance: "1,850 NM",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCaV3Vflh45BhjgDzQ4R4RZFH4Kisq_YZPtRlzmjUqW6_2mPb31kP6dBVNnkcPfNtXzFt85Nw_v0diCbVrUtKVDZBxxoM778pSVG-MohP1beHkDkzbX4BD6h5-4pAzmCv5SKDN7h8ruGXOT8tETtBm2Pujhz9OnuLEx-GSklGyNosMF0f2ALiJNuZ4CsjaMEGeMmRXk7AiP41m9FAorLXKW5wPqyD2z0SZf8mWZNfVJFq-gupV5cK8zWeTkbX4HB1JCQ7h3LSbILz-D"
  },
  {
    id: "ARC-2309-H",
    vessel: "SS ICE BREAKER",
    date: "2023-08-05",
    time: "16:10 UTC",
    iceClass: "PC1",
    distance: "4,200 NM",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDnlE2uPeL-l--LezbPMBMhr_M3ScRCEgVUNGZB3OA-apCn7CUHZueMQaWXYy6CGKEjjo5c_e3Zv4YtLEfDg9-grLQC5X1_RbZeMxSVvtysr1MdFkVgMvBW4zqR6ySlhwfqaD6upVxWb_SsVc7JamofAjfDy-JqQj1KaEXIMlCulWci78PGYZkWYamYOQvNaRQx4R3iBPl3Z5PRL9NfpfnwYmGqzo-ST50c57kgus2cE1fWxVOz1c4vfJKKxdvF2ss3ac9ri1gGPpzs"
  }
];

const VESSELS = [
  {
    name: "NS NORDIC SPIRIT",
    status: "ACTIVE PROFILE",
    hull: "Ice-Reinforced",
    draft: "12.5m",
    active: true
  },
  {
    name: "MT POLARIS REACH",
    status: "RESERVE",
    hull: "Double Hull",
    draft: "14.2m",
    active: false
  },
  {
    name: "CCGS AMUNDSEN",
    status: "GOVERNMENT",
    hull: "Icebreaker",
    draft: "10.1m",
    active: false
  }
];

interface SavedRoutesProps {
  onSwitchToFleet?: () => void;
  t: Translate;
}

export function SavedRoutes({ onSwitchToFleet, t }: SavedRoutesProps) {
  const [routes, setRoutes] = useState<any[]>([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('saved_routes') || '[]');
    setRoutes([...saved, ...INITIAL_ROUTES]);
  }, []);

  const deleteRoute = (id: string) => {
    const saved = JSON.parse(localStorage.getItem('saved_routes') || '[]');
    const updated = saved.filter((r: any) => r.id !== id);
    localStorage.setItem('saved_routes', JSON.stringify(updated));
    setRoutes(updated.concat(INITIAL_ROUTES));
  };

  return (
    <div className="w-full h-full min-h-0 overflow-y-auto bg-background custom-scrollbar">
      <div className="p-6 md:p-10 pb-32 md:pb-16 max-w-7xl mx-auto">
        {/* Context Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-2">
            <h2 className="text-4xl md:text-5xl font-bold text-on-surface uppercase tracking-tighter">{t("savedRoutesTitle")}</h2>
            <p className="text-sm md:text-base text-on-surface-variant max-w-xl font-medium leading-relaxed">
              {t("savedRoutesDescription")}
            </p>
          </div>
          <div className="flex gap-2 p-1 bg-surface-highest/20 border border-outline/20 backdrop-blur-md">
            <button className="px-6 py-2 bg-secondary text-on-secondary font-bold font-mono text-[10px] tracking-widest transition-all">
              {t("routeHistory")}
            </button>
            <button 
              onClick={onSwitchToFleet}
              className="px-6 py-2 text-on-surface-variant hover:text-on-surface font-bold font-mono text-[10px] tracking-widest transition-all"
            >
              {t("savedVesselsTitle")}
            </button>
          </div>
        </div>

        {/* Dashboard Content: Grid Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Left Column: Route History List */}
          <div className="xl:col-span-2 space-y-6">
            {routes.map((route) => (
              <div 
                key={route.id} 
                className="group technical-card p-0 bg-surface-highest/10 hover:bg-surface-highest/20 border-outline/20 hover:border-secondary transition-all overflow-hidden relative"
              >
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-56 h-40 md:h-auto overflow-hidden relative grayscale group-hover:grayscale-0 transition-all duration-500">
                    <img 
                      src={route.image} 
                      alt={route.vessel}
                      className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-primary/20 group-hover:bg-transparent transition-colors" />
                  </div>
                  
                  <div className="flex-1 p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-bold font-mono text-secondary mb-1 tracking-[0.2em] uppercase">{t("routeId")}: {route.id}</p>
                        <h3 className="text-xl font-bold text-on-surface tracking-tight">{route.vessel}</h3>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <div className="text-right">
                          <p className="text-xs font-mono font-bold text-on-surface">{route.date}</p>
                          <p className="text-[9px] font-bold font-mono text-on-surface-variant tracking-wider">{route.time}</p>
                        </div>
                        {route.id.endsWith('-S') && (
                          <button 
                            onClick={() => deleteRoute(route.id)}
                            className="p-1.5 text-outline hover:text-error transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-6 items-center pt-4 border-t border-outline/10">
                      <div className="flex items-center gap-2">
                        <Snowflake size={14} className="text-primary" />
                        <span className="text-[10px] font-bold font-mono text-on-surface-variant uppercase">{t("iceClass")}: {route.iceClass}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Navigation size={14} className="text-primary" />
                        <span className="text-[10px] font-bold font-mono text-on-surface-variant uppercase">{route.distance}</span>
                      </div>
                      <div className="ml-auto">
                        <button className="py-2 px-6 bg-secondary text-background font-bold font-mono text-[10px] tracking-widest hover:bg-secondary-dim transition-colors flex items-center gap-2 shadow-lg shadow-secondary/10">
                          {t("replayRoute")} <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Technical Corner Accents */}
                <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-tertiary/40" />
                <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-tertiary/40" />
                <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-tertiary/40" />
                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-tertiary/40" />
              </div>
            ))}
          </div>

          {/* Right Column: Sidebar */}
          <div className="space-y-8">
            <div className="technical-card p-6 bg-surface-highest/10 border-outline/20">
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-outline/10">
                <h3 className="text-[11px] font-bold font-mono text-on-surface tracking-[0.3em] uppercase">{t("savedVesselsTitle")}</h3>
                <button className="text-primary hover:text-secondary transition-colors">
                  <PlusCircle size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                {VESSELS.map((vessel, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "p-4 bg-surface-highest/20 border-l-4 group hover:bg-surface-highest/40 transition-all cursor-pointer relative",
                      vessel.active ? "border-secondary" : "border-outline/30"
                    )}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[9px] font-bold font-mono text-on-surface-variant tracking-wider">{vessel.status}</span>
                      <Star size={14} className={cn(vessel.active ? "text-secondary fill-secondary" : "text-outline/30")} />
                    </div>
                    <h4 className="text-lg font-bold text-on-surface group-hover:text-secondary transition-colors tracking-tight">{vessel.name}</h4>
                    
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[8px] font-bold font-mono text-on-surface-variant uppercase tracking-wider mb-1">{t("hullType")}</p>
                        <p className="text-[10px] font-bold font-mono text-primary truncate">{vessel.hull}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold font-mono text-on-surface-variant uppercase tracking-wider mb-1">{t("maxDraft")}</p>
                        <p className="text-[10px] font-bold font-mono text-primary">{vessel.draft}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                onClick={onSwitchToFleet}
                className="w-full mt-8 py-3 border border-outline/30 border-dashed text-on-surface-variant font-bold font-mono text-[9px] tracking-[0.2em] hover:bg-surface-highest/30 transition-colors uppercase"
              >
                {t("manageAllVessels")}
              </button>
            </div>

            {/* Archive Stats Card */}
            <div className="technical-card p-8 bg-primary/10 border-primary/20 relative overflow-hidden group">
              <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <BarChart3 size={160} />
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/20 rounded">
                  <Activity size={20} className="text-primary" />
                </div>
                <h3 className="text-[11px] font-bold font-mono text-primary tracking-[0.3em] uppercase">{t("archiveStats")}</h3>
              </div>
              
              <div className="space-y-5 relative z-10">
                <div className="flex justify-between items-center border-b border-primary/20 pb-2">
                  <span className="text-xs font-semibold text-on-surface-variant tracking-tight font-body-md uppercase text-[10px]">{t("totalCalculated")}</span>
                  <span className="text-lg font-bold font-mono text-primary">124</span>
                </div>
                <div className="flex justify-between items-center border-b border-primary/20 pb-2">
                  <span className="text-xs font-semibold text-on-surface-variant tracking-tight font-body-md uppercase text-[10px]">{t("activeFleet")}</span>
                  <span className="text-lg font-bold font-mono text-primary">12</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-on-surface-variant tracking-tight font-body-md uppercase text-[10px]">{t("dataRetention")}</span>
                  <span className="text-lg font-bold font-mono text-primary">180D</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
