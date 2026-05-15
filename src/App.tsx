import { useState, useCallback, useEffect, useRef } from "react";
import { 
  Anchor, 
  Map as MapIcon, 
  Navigation, 
  Settings, 
  Bell, 
  User, 
  Route, 
  Brain, 
  Activity, 
  History,
  Ship,
  Search,
  Maximize2,
  Layers,
  Crosshair,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Info,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Snowflake,
  Calendar,
  Download,
  Menu,
  X,
  Send,
  Loader2,
  Plus,
  Minus,
  GripVertical,
  Trash2,
  Mic,
  MicOff,
  MapPin
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents, Tooltip, Polygon } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { GoogleGenAI } from "@google/genai";
import { useIceLayers } from "./features/iceLayers/useIceLayers";
import { IceLayerToggle } from "./features/iceLayers/IceLayerToggle";
import { IceMetadataPopup } from "./features/iceLayers/IceMetadataPopup";
import { ICE_CLASS_LABELS, ICE_CLASS_COLORS } from "./features/iceLayers/iceClassification";
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SavedRoutes } from "./components/SavedRoutes";
import { SavedVessels, type Vessel } from "./components/SavedVessels";
import { VesselDetail } from "./components/VesselDetail";
import { DateRangePicker } from "./components/DateRangePicker";
import { AIIcon } from "./components/AIIcon";

/**
 * Utility for Tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fix Leaflet Default Icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// --- Types ---

interface GeoPoint {
  id: string;
  lat: number;
  lng: number;
  name?: string;
}

interface LegAnalysis {
  from: string;
  to: string;
  iceClass: string;
  thickness: string;
  risk: "LOW" | "MODERATE" | "HIGH";
  integrity: number;
  distance: number;
  demandingSegment: string;
  advisories: { type: "ice" | "seasonal" | "warning"; title: string; description: string }[];
}

interface AnalysisResult {
  legs: LegAnalysis[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// --- Components ---

const TechnicalBorder = () => (
  <>
    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-tertiary" />
    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-tertiary" />
    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-tertiary" />
    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-tertiary" />
  </>
);

const MobileNav = ({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (s: string) => void }) => {
  const tabs = [
    { id: "command", icon: Activity, label: "COMMAND" },
    { id: "fleet", icon: Ship, label: "FLEET" },
    { id: "routing", icon: Route, label: "ROUTING" },
    { id: "data", icon: Info, label: "DATA" },
    { id: "archive", icon: Bookmark, label: "SAVED" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-high border-t border-outline/20 flex justify-around items-center z-[100]">
      {tabs.map((tab) => (
        <button 
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === tab.id ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
          <span className="text-[10px] font-mono tracking-wider">{tab.label}</span>
          {activeTab === tab.id && (
            <motion.div layoutId="mobileTab" className="absolute -top-[1px] w-8 h-[2px] bg-primary" />
          )}
        </button>
      ))}
    </nav>
  );
};

// --- Main Application ---

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Regions and Zones ---
const ICE_ZONES = [
  {
    name: "Arc9 Extreme Pack",
    id: "zone-9",
    coords: [[78, 60], [85, 60], [85, 150], [78, 150]] as [number, number][],
    color: "#ef4444", // Red-500
    description: "Multi-year ice. PC3/ARC9 Required."
  },
  {
    name: "Arc7 Consolidation",
    id: "zone-7",
    coords: [[72, 40], [78, 40], [78, 160], [72, 160]] as [number, number][],
    color: "#f59e0b", // Amber-500
    description: "Consolidated first-year ice. ARC7 Required."
  },
  {
    name: "Arc5 Seasonal Corridor",
    id: "zone-5",
    coords: [[66, 10], [72, 10], [72, 170], [66, 170]] as [number, number][],
    color: "#eab308", // Yellow-500
    description: "First-year ice. ARC5/ARC4 allowed."
  },
  {
    name: "Ice3 Open Drift",
    id: "zone-3",
    coords: [[60, -10], [66, -10], [66, 180], [60, 180]] as [number, number][],
    color: "#06b6d4", // Cyan-500
    description: "Open pack ice. Ice1-Ice3 Class."
  }
];

export default function App() {
  const [waypoints, setWaypoints] = useState<GeoPoint[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [activeTab, setActiveTab] = useState("command");
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "I am an expert in Arctic navigation. How can I assist with your trajectory today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [hoveredWaypointId, setHoveredWaypointId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Geocoding states
  const [newWaypointSearch, setNewWaypointSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [flyToPoint, setFlyToPoint] = useState<GeoPoint | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle Dark Mode Class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const [mapLayer, setMapLayer] = useState<"satellite" | "standard">("standard");
  const [showLayers, setShowLayers] = useState(false);
  const [showIceLayers, setShowIceLayers] = useState(false);

  // Mock analysis result
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const calculateDistance = (p1: GeoPoint, p2: GeoPoint) => {
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      
      // Try to determine language from browser or default to en-US
      // The user is Russian, so we could try to support multiple, but let's stick to browser default or en/ru
      recognitionRef.current.lang = navigator.language || 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  // Auto-open sidebar when points are selected
  useEffect(() => {
    if (waypoints.length >= 2) {
      setIsSidebarOpen(true);
    }
  }, [waypoints.length]);

  const handleGeocode = async (query: string) => {
    if (!query) return;
    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const point: GeoPoint = { 
          id: Math.random().toString(36).substr(2, 9),
          lat: parseFloat(data[0].lat), 
          lng: parseFloat(data[0].lon), 
          name: data[0].display_name 
        };
        setWaypoints(prev => [...prev, point]);
        setNewWaypointSearch("");
        setFlyToPoint(point);
      }
    } catch (error) {
      console.error("Geocoding failed", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleReverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      return data?.display_name || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    } catch (error) {
      console.error("Reverse geocoding failed", error);
      return `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    }
  };

  const addWaypointAtPos = async (lat: number, lng: number) => {
    const name = await handleReverseGeocode(lat, lng);
    const newPoint: GeoPoint = {
      id: Math.random().toString(36).substr(2, 9),
      lat,
      lng,
      name
    };
    setWaypoints(prev => [...prev, newPoint]);
  };

  const removeWaypoint = (id: string) => {
    setWaypoints(prev => prev.filter(p => p.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setWaypoints((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleChat = async () => {
    if (!input.trim() || isLoadingChat) return;
    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoadingChat(true);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [...messages, userMsg].map(m => m.content).join("\n"),
        config: {
          systemInstruction: "You are 'Ice Route AI', a specialized advisor for polar corridor navigation. You provide technical feedback on ice classes (Ice1-Ice3, Arc4-Arc9), sea states, and maritime security. Keep responses concise, professional, and slightly technical.",
        }
      });
      const content = response.text || "I'm having trouble retrieving data from the satellite. Please try again.";
      setMessages(prev => [...prev, { role: "assistant", content }]);
    } catch (error) {
      console.error("AI failed", error);
      setMessages(prev => [...prev, { role: "assistant", content: "Communication blackout. Check your satellite connection." }]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const calculateTotalDistance = (pts: GeoPoint[]) => {
    let total = 0;
    const R = 3440.065; // Earth radius in nautical miles
    for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i+1];
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLon = (p2.lng - p1.lng) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        total += R * c;
    }
    return Math.round(total);
  };

  const handleSaveRoute = () => {
    if (waypoints.length < 2) return;
    
    const newRoute = {
      id: "ARC-" + Math.floor(Math.random() * 9000 + 1000) + "-S",
      vessel: "CUSTOM VESSEL",
      date: startDate && endDate ? `${startDate} to ${endDate}` : startDate || new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + " UTC",
      iceClass: "TBD",
      distance: `${calculateTotalDistance(waypoints)} NM`,
      waypoints: waypoints,
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDnlE2uPeL-l--LezbPMBMhr_M3ScRCEgVUNGZB3OA-apCn7CUHZueMQaWXYy6CGKEjjo5c_e3Zv4YtLEfDg9-grLQC5X1_RbZeMxSVvtysr1MdFkVgMvBW4zqR6ySlhwfqaD6upVxWb_SsVc7JamofAjfDy-JqQj1KaEXIMlCulWci78PGYZkWYamYOQvNaRQx4R3iBPl3Z5PRL9NfpfnwYmGqzo-ST50c57kgus2cE1fWxVOz1c4vfJKKxdvF2ss3ac9ri1gGPpzs"
    };

    const saved = JSON.parse(localStorage.getItem('saved_routes') || '[]');
    localStorage.setItem('saved_routes', JSON.stringify([newRoute, ...saved]));
    alert("Mission Route Saved to Archive");
  };

  const handleAnalyze = () => {
    if (waypoints.length < 2) return;
    setIsAnalyzing(true);
    
    // Simulate API call processing each leg
    setTimeout(() => {
      const legs: LegAnalysis[] = [];
      for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i];
        const p2 = waypoints[i+1];
        const dist = calculateDistance(p1, p2);
        
        legs.push({
          from: p1.name?.split(',')[0] || "Waypoint " + i,
          to: p2.name?.split(',')[0] || "Waypoint " + (i + 1),
          iceClass: i % 2 === 0 ? "Ice3" : "Arc4",
          thickness: i % 2 === 0 ? "1.2m" : "0.8m",
          risk: dist > 500 ? "HIGH" : i % 2 === 1 ? "MODERATE" : "LOW",
          integrity: 96 - (i * 3),
          distance: dist,
          demandingSegment: `Section ${i + 1}: ${p1.name?.split(',')[0]} to ${p2.name?.split(',')[0]}`,
          advisories: [
            { type: "ice", title: "Ice Compression", description: `Segment ${i+1} shows moderate drift patterns.` },
            { type: "warning", title: "Thermal Shift", description: "Projected drop in ambient sea temperature." }
          ]
        });
      }
      
      setAnalysisResult({ legs });
      setIsAnalyzing(false);
      setShowAnalysis(true);
    }, 1500);
  };

  const generateGeodeticPath = (p1: GeoPoint, p2: GeoPoint, segments = 50) => {
    const coords: [number, number][] = [];
    for (let i = 0; i <= segments; i++) {
        const f = i / segments;
        const lat = p1.lat + (p2.lat - p1.lat) * f;
        const lng = p1.lng + (p2.lng - p1.lng) * f;
        coords.push([lat, lng]);
    }
    return coords;
  };

  return (
    <div className={cn("h-screen flex flex-col bg-background selection:bg-primary/30", isDarkMode ? "dark" : "")}>
      {/* Top Header */}
      <header className="h-16 border-b border-outline/20 bg-surface/50 backdrop-blur-xl flex items-center justify-between px-6 z-50 fixed top-0 w-full">
        <div className="flex items-center gap-4">
          <button 
            className="md:hidden text-on-surface-variant hover:text-on-surface p-2"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={24} />
          </button>
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-bold tracking-tighter text-on-surface">ICE ROUTE</h1>
            <span className="text-[10px] font-mono text-tertiary px-1 border border-tertiary/30 tracking-widest hidden sm:inline">PRO version</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-4 font-mono text-[10px] tracking-widest text-on-surface-variant">
          <div className="flex flex-col items-end">
            <span className="text-secondary font-bold">SIGNAL: OPTIMAL</span>
            <span>78.2° N, 15.6° E</span>
          </div>
          <div className="h-8 w-[1px] bg-outline/20 mx-2" />
          <nav className="flex items-center gap-6 text-xs font-semibold">
            <button onClick={() => setActiveTab("command")} className={cn("hover:text-primary transition-colors", activeTab === "command" && "text-primary border-b border-primary")}>COMMAND</button>
            <button onClick={() => { setActiveTab("fleet"); setSelectedVessel(null); }} className={cn("hover:text-primary transition-colors", activeTab === "fleet" && "text-primary border-b border-primary")}>FLEET</button>
            <button onClick={() => setActiveTab("routing")} className={cn("hover:text-primary transition-colors", activeTab === "routing" && "text-primary border-b border-primary")}>CHARTS</button>
            <button onClick={() => setActiveTab("data")} className={cn("hover:text-primary transition-colors", activeTab === "data" && "text-primary border-b border-primary")}>ENVIRONMENTAL</button>
            <button onClick={() => setActiveTab("archive")} className={cn("hover:text-primary transition-colors", activeTab === "archive" && "text-primary border-b border-primary")}>SAVED ROUTES</button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 text-on-surface-variant hover:text-primary rounded-full transition-colors"
          >
            {isDarkMode ? <Zap size={18} fill="currentColor" /> : <Snowflake size={18} />}
          </button>
          <button className="p-2 text-on-surface-variant hover:text-primary rounded-full relative">
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-secondary rounded-full border-2 border-surface" />
          </button>
          <div className="w-8 h-8 rounded-none bg-surface-highest border border-outline/20 flex items-center justify-center overflow-hidden">
             <User size={18} className="text-primary" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16 overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {(isSidebarOpen || window.innerWidth >= 768) && (
            <motion.aside 
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              className={cn(
                "w-[340px] lg:w-[400px] border-r border-outline/20 bg-surface-low/50 backdrop-blur-md flex flex-col z-40 fixed md:static inset-y-0 left-0 pt-16 md:pt-0 h-full",
                !isSidebarOpen && "hidden"
              )}
            >
              <div className="p-6 border-b border-outline/20">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <Activity size={20} className="text-primary" />
                    <h2 className="text-lg font-semibold tracking-tight text-on-surface">Command Panel</h2>
                  </div>
                  <button 
                    className="md:hidden text-on-surface-variant"
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">Vessel Alpha-7 | Polar Class Readiness</p>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-0 space-y-0 pb-32 md:pb-8">
                {/* Main Navigation links */}
                <nav className="flex flex-col mb-6 border-b border-outline/10">
                  <button 
                    onClick={() => setActiveTab("command")}
                    className={cn(
                      "px-6 py-4 flex items-center gap-4 transition-all border-l-4",
                      activeTab === "command" ? "border-secondary bg-surface-highest/20 text-secondary" : "border-transparent text-on-surface-variant hover:bg-surface-highest/10 hover:text-on-surface"
                    )}
                  >
                    <Activity size={18} />
                    <span className="text-[10px] font-bold font-mono tracking-[0.2em] uppercase">MISSION COMMAND</span>
                  </button>
                  <button 
                    onClick={() => { setActiveTab("fleet"); setSelectedVessel(null); }}
                    className={cn(
                      "px-6 py-4 flex items-center gap-4 transition-all border-l-4",
                      activeTab === "fleet" ? "border-secondary bg-surface-highest/20 text-secondary" : "border-transparent text-on-surface-variant hover:bg-surface-highest/10 hover:text-on-surface"
                    )}
                  >
                    <Ship size={18} />
                    <span className="text-[10px] font-bold font-mono tracking-[0.2em] uppercase">FLEET ARCHIVE</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab("archive")}
                    className={cn(
                      "px-6 py-4 flex items-center gap-4 transition-all border-l-4",
                      activeTab === "archive" ? "border-secondary bg-surface-highest/20 text-secondary" : "border-transparent text-on-surface-variant hover:bg-surface-highest/10 hover:text-on-surface"
                    )}
                  >
                    <Bookmark size={18} />
                    <span className="text-[10px] font-bold font-mono tracking-[0.2em] uppercase">SAVED ROUTES</span>
                  </button>
                </nav>

                <div className="px-6 space-y-8 uppercase">
                  {/* Mission Parameters - Only show on Command/Routing tabs */}
                  {(activeTab === "command" || activeTab === "routing") && (
                    <section className="space-y-4">
                      {activeTab === "command" && (
                        <div className="flex flex-col gap-2 mb-4">
                          <button 
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || waypoints.length < 2}
                            className={cn(
                              "w-full py-4 bg-primary text-background font-bold font-mono tracking-widest text-xs uppercase transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary/10",
                              (isAnalyzing || waypoints.length < 2) ? "opacity-50 cursor-not-allowed" : "hover:bg-primary-dim active:scale-[0.98]"
                            )}
                          >
                            {isAnalyzing ? (
                              <>
                                <Loader2 size={16} className="animate-spin" />
                                ANALYZING...
                              </>
                            ) : (
                              <>
                                <Activity size={16} />
                                CALCULATE ICE CLASS
                              </>
                            )}
                          </button>

                          <button 
                            onClick={handleSaveRoute}
                            disabled={waypoints.length < 2}
                            className={cn(
                              "w-full py-4 border border-outline/30 text-on-surface font-bold font-mono tracking-widest text-xs uppercase transition-all flex items-center justify-center gap-3 hover:bg-surface-highest/50",
                              waypoints.length < 2 ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98]"
                            )}
                          >
                            <Bookmark size={16} />
                            SAVE MISSION ROUTE
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Route size={16} className="text-primary" />
                          <h3 className="text-xs font-bold font-mono tracking-widest text-on-surface-variant">MISSION PARAMETERS</h3>
                        </div>
                        {waypoints.length > 0 && (
                          <button 
                            onClick={() => {
                              setWaypoints([]);
                              setNewWaypointSearch("");
                              setStartDate("");
                              setEndDate("");
                              setShowAnalysis(false);
                            }}
                            className="text-[10px] font-mono text-error hover:text-error/80 flex items-center gap-1 transition-colors"
                          >
                            <X size={12} />
                            RESET MISSION
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {/* Add Waypoint Input */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <MapPin size={12} className="text-outline" />
                            <label className="text-[10px] font-bold font-mono text-on-surface-variant uppercase tracking-wider">ADD MISSION WAYPOINT</label>
                          </div>
                          <div className="relative group">
                            <input 
                              type="text" 
                              value={newWaypointSearch}
                              onChange={(e) => setNewWaypointSearch(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleGeocode(newWaypointSearch)}
                              placeholder="Search Port or Coordinates..."
                              className="w-full bg-background/50 border border-outline/30 p-3 text-xs font-mono font-medium text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-outline rounded-none text-[11px]"
                            />
                            <button 
                              onClick={() => handleGeocode(newWaypointSearch)}
                              className="absolute right-3 top-3 text-outline group-focus-within:text-primary"
                            >
                              {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            </button>
                          </div>
                        </div>

                        {/* Waypoints List */}
                        <DndContext 
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext 
                            items={waypoints.map(p => p.id)}
                            strategy={verticalListSortingStrategy}
                          >
                              <div className="space-y-2">
                                {waypoints.map((wp: GeoPoint, index: number) => (
                                  <div
                                    key={wp.id}
                                    onMouseEnter={() => setHoveredWaypointId(wp.id)}
                                    onMouseLeave={() => setHoveredWaypointId(null)}
                                  >
                                    <SortableWaypointItem 
                                      waypoint={wp} 
                                      index={index} 
                                      isLast={index === waypoints.length - 1}
                                      isHovered={hoveredWaypointId === wp.id}
                                      onRemove={() => removeWaypoint(wp.id)}
                                    />
                                  </div>
                                ))}
                              </div>
                          </SortableContext>
                        </DndContext>

                        {waypoints.length === 0 && (
                          <div className="p-4 border border-dashed border-outline/30 text-center">
                            <p className="text-[10px] font-mono text-on-surface-variant uppercase">No waypoints defined. Click map to add legs.</p>
                          </div>
                        )}

                        <div className="pt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-outline" />
                            <label className="text-[10px] font-bold font-mono text-on-surface-variant uppercase tracking-wider">NAVIGATION PERIOD</label>
                          </div>
                          <DateRangePicker 
                            startDate={startDate} 
                            endDate={endDate} 
                            onRangeChange={(start, end) => {
                              setStartDate(start);
                              setEndDate(end);
                            }} 
                          />
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Info Card */}
                  {activeTab === "command" && (
                    <div className="technical-card p-6 rounded-none">
                      <TechnicalBorder />
                      <div className="absolute right-0 top-0 p-2 opacity-10">
                        <Navigation size={48} className="-rotate-12 outline-none" />
                      </div>
                      <h4 className="text-xs font-bold font-mono text-tertiary mb-2">NAVIGATION WINDOW</h4>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Select two coordinates on the nautical chart or enter port names to initialize ice-class stratification intelligence.
                      </p>
                    </div>
                  )}


                  {/* Analysis Results in Sidebar */}
                  <AnimatePresence>
                    {activeTab === "command" && showAnalysis && analysisResult && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden pt-4 pb-8"
                    >
                      <div className="flex items-center justify-between px-2 mb-2">
                        <h2 className="text-[10px] font-bold font-mono text-primary tracking-[0.2em] uppercase">Route Intelligence</h2>
                        <span className="text-[9px] font-mono text-outline">{analysisResult.legs.length} SEGMENTS</span>
                      </div>

                      {analysisResult.legs.map((leg, idx) => (
                        <div key={idx} className="technical-card p-4 rounded-none bg-surface-highest/10 border-outline/10 relative group">
                          <TechnicalBorder />
                          
                          <div className="flex justify-between items-start mb-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] font-bold font-mono text-tertiary mb-1 tracking-tighter uppercase truncate">
                                LEG {idx + 1}: {leg.from} → {leg.to}
                              </p>
                              <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-primary tracking-tighter">{leg.iceClass}</span>
                                <span className="text-[8px] font-mono text-on-surface-variant">PC</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[8px] font-bold font-mono text-on-surface-variant">THICKNESS</div>
                              <div className="text-lg font-mono text-secondary font-bold">{leg.thickness}</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-3 pt-2 border-t border-outline/5">
                            <div className="space-y-1">
                              <span className="text-[8px] font-bold font-mono text-on-surface-variant block uppercase">Risk</span>
                              <div className="flex items-center gap-1.5">
                                <div className={cn(
                                  "px-1.5 py-0.5 text-[8px] font-bold font-mono rounded-none",
                                  leg.risk === "LOW" ? "bg-secondary/20 text-secondary" : 
                                  leg.risk === "MEDIUM" ? "bg-tertiary/20 text-tertiary" : "bg-error/20 text-error"
                                )}>
                                  {leg.risk}
                                </div>
                                <span className="text-[9px] font-mono text-on-surface">{leg.integrity}%</span>
                              </div>
                            </div>
                            <div className="text-right space-y-1">
                              <span className="text-[8px] font-bold font-mono text-on-surface-variant block uppercase">Dist.</span>
                              <span className="text-xs font-mono font-bold text-on-surface">{leg.distance} NM</span>
                            </div>
                          </div>

                          <div className="space-y-1.5 mb-2">
                            {leg.advisories.map((adv, i) => (
                              <div key={i} className="flex gap-2 items-start text-left">
                                <div className="mt-0.5 p-0.5 bg-surface-highest">
                                  {adv.type === "ice" ? <Snowflake size={10} className="text-primary" /> : <AlertTriangle size={10} className="text-tertiary" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[9px] text-on-surface-variant leading-tight truncate font-medium">{adv.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="technical-card p-4 rounded-none bg-primary/5 border-primary/20">
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold font-mono text-on-surface-variant">TOTAL MISSION DISTANCE</span>
                            <span className="text-sm font-mono font-bold text-primary">{calculateTotalDistance(waypoints)} NM</span>
                         </div>
                         <button className="w-full py-2 bg-primary text-background text-[10px] font-bold font-mono tracking-widest hover:bg-primary-dim transition-colors uppercase">
                            Generate Full Report
                         </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

              <footer className="p-4 border-t border-outline/20 bg-background/50 flex flex-col items-center gap-1">
                <p className="text-[9px] font-mono text-outline uppercase tracking-widest">INTERNAL MARITIME USE ONLY</p>
                <p className="text-[8px] font-mono text-outline opacity-50">PROPRIETARY INTEL PROTOCOL 7.2</p>
              </footer>
            </motion.aside>
          )}
        </AnimatePresence>

        {activeTab === "fleet" ? (
          <main className="flex-1 h-full min-h-0 overflow-hidden">
            {selectedVessel ? (
              <VesselDetail vessel={selectedVessel} onBack={() => setSelectedVessel(null)} />
            ) : (
              <SavedVessels onSelectVessel={setSelectedVessel} />
            )}
          </main>
        ) : activeTab === "archive" ? (
          <main className="flex-1 h-full min-h-0 overflow-hidden">
            <SavedRoutes onSwitchToFleet={() => setActiveTab("fleet")} />
          </main>
        ) : (
          <main className="flex-1 relative bg-[#050A0F] overflow-hidden">
            {/* Sidebar Toggle Button (Inside Map) */}
            {!isSidebarOpen && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSidebarOpen(true);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute top-6 left-6 z-40 bg-surface border border-outline/20 p-3 text-on-surface hover:text-primary shadow-2xl transition-all active:scale-90"
              >
                <ChevronRight size={20} />
              </motion.button>
            )}

            {/* Subtle Grid */}
            <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#869399 0.5px, transparent 0.5px)", backgroundSize: "40px 40px" }} />
            
            {/* Leaflet Map */}
            <div className="absolute inset-0 z-0 h-full w-full">
               <MapContainer 
                center={[65, -20]} 
                zoom={3} 
                style={{ height: "100%", width: "100%" }}
                zoomControl={false}
                attributionControl={false}
              >
                <TileLayer
                  url={
                    mapLayer === "satellite"
                      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  }
                />
                <MapEvents 
                  onAddWaypoint={addWaypointAtPos}
                />
                {flyToPoint && <FlyToHandler point={flyToPoint} onComplete={() => setFlyToPoint(null)} />}
                
                <MapControls 
                  onCenter={() => waypoints.length > 0 && setFlyToPoint(waypoints[0])} 
                  onToggleLayers={() => setShowLayers(!showLayers)}
                  onToggleIceLayers={() => setShowIceLayers(!showIceLayers)}
                />

                <IceLayerManager 
                  showIceToggles={showIceLayers} 
                  setShowIceToggles={setShowIceLayers} 
                />

                {/* Layers Selection Popup */}
                {showLayers && (
                  <div 
                    className="leaflet-top leaflet-right" 
                    style={{ marginTop: "80px", marginRight: "80px" }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LayerPopup 
                      mapLayer={mapLayer} 
                      setMapLayer={setMapLayer} 
                      onClose={() => setShowLayers(false)} 
                    />
                  </div>
                )}
                
                {ICE_ZONES.map(zone => (
                  <Polygon 
                    key={zone.id}
                    positions={zone.coords}
                    pathOptions={{
                      fillColor: zone.color,
                      fillOpacity: 0.15,
                      color: zone.color,
                      weight: 1,
                      dashArray: "5, 5"
                    }}
                  >
                    <Tooltip sticky>
                      <div className="p-1 font-mono">
                        <p className="text-xs font-bold" style={{ color: zone.color }}>{zone.name}</p>
                        <p className="text-[10px] opacity-70">{zone.description}</p>
                      </div>
                    </Tooltip>
                  </Polygon>
                ))}

                {waypoints.map((wp, index) => (
                  <Marker 
                    key={wp.id} 
                    position={[wp.lat, wp.lng]}
                    eventHandlers={{
                      mouseover: () => setHoveredWaypointId(wp.id),
                      mouseout: () => setHoveredWaypointId(null),
                    }}
                    icon={L.divIcon({
                      className: 'marker-container',
                      html: `
                        <div class="relative flex items-center justify-center">
                          <div class="marker-dot ${hoveredWaypointId === wp.id ? 'marker-dot-hovered' : ''}"></div>
                          <div class="marker-pulse ${hoveredWaypointId === wp.id ? 'block' : 'hidden'}"></div>
                        </div>
                      `,
                      iconSize: [24, 24],
                      iconAnchor: [12, 12],
                    })}
                  >
                    {(hoveredWaypointId === wp.id) && (
                      <Tooltip 
                        permanent 
                        direction="top" 
                        offset={[0, -10]}
                        className="technical-tooltip"
                      >
                        <div className="px-2 py-1 bg-surface-highest border border-primary/50 text-[10px] font-mono font-bold text-primary uppercase tracking-widest">
                          {index === 0 ? "DEPARTURE" : index === waypoints.length - 1 ? "ARRIVAL" : `WAYPOINT ${index}`}
                        </div>
                      </Tooltip>
                    )}
                  </Marker>
                ))}
                
                {waypoints.length >= 2 && waypoints.slice(0, -1).map((wp, i) => (
                  <Polyline 
                    key={`leg-${i}`}
                    positions={generateGeodeticPath(wp, waypoints[i+1])} 
                    color="#90e0ff" 
                    dashArray="8, 12"
                    weight={2}
                  />
                ))}
              </MapContainer>
            </div>

            {/* Map Legend */}
            <Legend showIceClasses={showIceLayers} />

            {/* AI Advisor Modal */}
            <AnimatePresence>
              {chatOpen && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, x: 20, y: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 20, y: 20 }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute bottom-28 right-6 w-[320px] md:w-[400px] z-[60]"
                >
                  <div className="technical-card glass-panel shadow-2xl flex flex-col h-[500px]">
                    <TechnicalBorder />
                    <div className="p-4 border-b border-outline/20 flex justify-between items-center bg-surface-highest/50">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Brain size={18} className="text-tertiary" />
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-secondary rounded-full animate-pulse" />
                        </div>
                        <span className="text-xs font-bold font-mono tracking-widest">ICE ROUTE ADVISOR</span>
                      </div>
                      <button onClick={() => setChatOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                        <X size={18} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-background/20">
                      {messages.map((m, i) => (
                        <div key={i} className={cn(
                          "flex flex-col gap-1 max-w-[85%]",
                          m.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                        )}>
                          <span className="text-[10px] font-mono text-outline uppercase">{m.role}</span>
                          <div className={cn(
                            "p-3 text-[11px] leading-relaxed border",
                            m.role === "user" 
                              ? "bg-primary/10 border-primary/30 text-on-surface rounded-l-lg rounded-tr-lg" 
                              : "bg-surface-highest/30 border-outline/30 text-on-surface rounded-r-lg rounded-tl-lg"
                          )}>
                            {m.content}
                          </div>
                        </div>
                      ))}
                      {isLoadingChat && (
                        <div className="flex gap-1 mr-auto items-start max-w-[85%]">
                          <div className="p-3 bg-surface-highest/30 border border-outline/30 rounded-r-lg rounded-tl-lg">
                            <div className="flex gap-1">
                              <span className="w-1 h-1 bg-primary rounded-full animate-bounce" />
                              <span className="w-1 h-1 bg-primary rounded-full animate-bounce delay-100" />
                              <span className="w-1 h-1 bg-primary rounded-full animate-bounce delay-200" />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 border-t border-outline/20">
                      <div className="relative group">
                        <input 
                          type="text" 
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleChat()}
                          placeholder={isRecording ? "Listening..." : "Inquire about polar navigation..."}
                          className={cn(
                            "w-full bg-background/50 border border-outline/30 p-3 pr-24 text-[11px] font-mono focus:border-primary focus:ring-0 outline-none placeholder:text-outline transition-all",
                            isRecording && "border-secondary ring-1 ring-secondary/20"
                          )}
                        />
                        <div className="absolute right-2 top-2 flex items-center gap-1">
                          <button 
                            onClick={toggleRecording}
                            className={cn(
                              "p-1.5 transition-colors",
                              isRecording ? "text-secondary animate-pulse" : "text-outline hover:text-primary"
                            )}
                            title={isRecording ? "Stop Recording" : "Voice Input"}
                          >
                            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                          </button>
                          <button 
                            onClick={handleChat}
                            disabled={isLoadingChat || (!input.trim() && !isRecording)}
                            className="p-1.5 text-primary hover:text-primary-dim disabled:opacity-50"
                          >
                            <Send size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

      <div className="absolute bottom-24 md:bottom-12 right-6 z-50">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setChatOpen(!chatOpen);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            "w-16 h-16 technical-card border-tertiary flex items-center justify-center group active:scale-95 transition-all shadow-2xl relative",
            chatOpen && "bg-surface-highest"
          )}
        >
          <div className="absolute inset-0 bg-tertiary/5 animate-pulse" />
          <AIIcon className={cn(chatOpen ? "text-tertiary" : "text-primary group-hover:text-tertiary")} size={32} />
          <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-tertiary/50" />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-tertiary/50" />
        </button>
      </div>

            <div className="absolute bottom-6 left-6 z-30 hidden md:block">
              <p className="text-[9px] font-mono text-outline uppercase tracking-[0.2em] max-w-[300px] leading-relaxed opacity-60">
                 Caution: Route simulations are advisory. Local ice observation remains mandatory for vessel safety. Intelligence Integrity: 99.8%.
              </p>
            </div>
          </main>
        )}
      </div>

      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Global Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-background/90 backdrop-blur-xl md:hidden flex flex-col pt-16"
          >
            <div className="flex justify-between items-center px-6 h-16 border-b border-outline/10">
              <span className="font-bold tracking-tighter text-on-surface">MAIN NAVIGATION</span>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-on-surface-variant"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 p-8 flex flex-col gap-6">
              {[
                { id: "command", icon: Activity, label: "COMMAND & CONTROL" },
                { id: "fleet", icon: Ship, label: "SAVED VESSELS" },
                { id: "routing", icon: Route, label: "MISSION ROUTING" },
                { id: "data", icon: Info, label: "TECHNICAL DATA" },
                { id: "archive", icon: Bookmark, label: "SAVED ROUTES" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                    if (item.id === "command" || item.id === "routing") setIsSidebarOpen(true);
                  }}
                  className={cn(
                    "flex items-center gap-6 p-4 border border-outline/10 text-left transition-colors",
                    activeTab === item.id ? "bg-primary/10 border-primary text-primary" : "text-on-surface-variant hover:bg-surface-highest"
                  )}
                >
                  <item.icon size={28} />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold font-mono tracking-widest">{item.label}</span>
                    <span className="text-[10px] opacity-50 uppercase font-mono">System Protocol Access</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-8 border-t border-outline/10 bg-surface-low">
              <div className="flex items-center justify-between text-xs font-mono text-outline">
                 <span>VERSION 7.2.4</span>
                 <span>POLAR OPS READY</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Background grain texture */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] z-[100] mix-blend-overlay" style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />
    </div>
  );
}

// --- Helper Components ---

function SortableWaypointItem({ waypoint, index, isLast, isHovered, onRemove }: { 
  waypoint: GeoPoint; 
  index: number; 
  isLast: boolean;
  isHovered?: boolean;
  onRemove: () => void;
  key?: string | number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: waypoint.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "relative flex items-center gap-3 p-3 transition-all duration-300 border",
        isHovered 
          ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(0,229,255,0.15)] z-10" 
          : "bg-surface-highest/30 border-outline/20"
      )}
    >
      <div 
        {...attributes} 
        {...listeners} 
        className={cn(
          "cursor-grab active:cursor-grabbing transition-colors",
          isHovered ? "text-primary" : "text-outline hover:text-primary"
        )}
      >
        <GripVertical size={16} />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[10px] font-bold font-mono uppercase flex items-center gap-2 transition-colors",
          isHovered ? "text-primary" : "text-tertiary"
        )}>
          {index === 0 ? "Departure" : isLast ? "Arrival" : `Waypoint ${index}`}
        </p>
        <p className={cn(
          "text-[11px] font-mono truncate pr-2 transition-colors",
          isHovered ? "text-on-surface" : "text-on-surface/80"
        )}>
          {waypoint.name || `Lat: ${waypoint.lat.toFixed(4)}, Lng: ${waypoint.lng.toFixed(4)}`}
        </p>
      </div>

      <button 
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="text-outline hover:text-error transition-colors p-1"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function LayerPopup({ mapLayer, setMapLayer, onClose }: { 
  mapLayer: string; 
  setMapLayer: (l: any) => void; 
  onClose: () => void 
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);

  return (
    <motion.div 
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.9, x: 10 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      className="leaflet-control technical-card glass-panel p-2 flex flex-col gap-1 min-w-[160px] shadow-2xl"
    >
      {[
        { id: "satellite", label: "Satellite (Live)", icon: MapIcon },
        { id: "standard", label: "Standard Charts", icon: Navigation }
      ].map((layer) => (
        <button
          key={layer.id}
          onClick={(e) => {
            e.stopPropagation();
            setMapLayer(layer.id as any);
            onClose();
          }}
          className={cn(
            "flex items-center gap-2 px-3 py-2 text-[10px] font-mono tracking-wider transition-colors",
            mapLayer === layer.id ? "text-primary bg-primary/10" : "text-on-surface-variant hover:bg-surface-highest"
          )}
        >
          <layer.icon size={14} />
          {layer.label.toUpperCase()}
        </button>
      ))}
    </motion.div>
  );
}

const Legend = ({ showIceClasses }: { showIceClasses?: boolean }) => (
  <div 
    onMouseDown={(e) => e.stopPropagation()}
    className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0c141c]/90 backdrop-blur-xl border border-outline/30 p-4 flex flex-col gap-4 items-center z-30 shadow-2xl rounded-none max-w-[95vw]"
  >
    <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-start md:items-center">
      <div className="flex items-center gap-2 border-r border-outline/20 pr-4">
        <Shield size={14} className="text-secondary" />
        <span className="text-[10px] font-bold font-mono text-on-surface uppercase tracking-widest whitespace-nowrap">Vessel Requirements</span>
      </div>
      
      <div className="grid grid-cols-2 md:flex items-center gap-4 md:gap-6">
        {ICE_ZONES.slice().reverse().map(zone => (
          <div key={zone.id} className="flex items-center gap-2 group cursor-help">
            <div className="w-3 h-3 border transition-transform group-hover:scale-110" style={{ backgroundColor: `${zone.color}33`, borderColor: zone.color }} />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold font-mono text-on-surface tracking-tighter">{zone.id.split('-')[1].toUpperCase()}</span>
              <span className="text-[8px] font-mono text-outline uppercase tracking-tight hidden md:block">REQUIRED</span>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-4 h-[1px] border-t border-dashed border-primary" />
          <span className="text-[10px] font-mono text-on-surface tracking-tighter">PLANNED ROUTE</span>
        </div>
      </div>
    </div>

    {showIceClasses && (
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-start md:items-center pt-3 border-t border-outline/10 w-full justify-center">
        <div className="flex items-center gap-2 border-r border-outline/20 pr-4">
          <Snowflake size={14} className="text-primary" />
          <span className="text-[10px] font-bold font-mono text-on-surface uppercase tracking-widest whitespace-nowrap">Sea Ice Data</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          {Object.entries(ICE_CLASS_COLORS).map(([id, color]) => (
            <div key={id} className="flex items-center gap-2">
              <div className="w-3 h-3 border" style={{ backgroundColor: `${color}33`, borderColor: color }} />
              <span className="text-[9px] font-mono font-bold text-on-surface tracking-tight uppercase">
                {ICE_CLASS_LABELS[id as keyof typeof ICE_CLASS_LABELS].replace('Ice Class ', '')}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

function FlyToHandler({ point, onComplete }: { point: GeoPoint; onComplete: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (point) {
      map.flyTo([point.lat, point.lng], 8, { animate: true, duration: 1.5 });
      onComplete();
    }
  }, [point, map, onComplete]);
  return null;
}

function MapControls({ onCenter, onToggleLayers, onToggleIceLayers }: { onCenter: () => void, onToggleLayers: () => void, onToggleIceLayers: () => void }) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);

  return (
    <div ref={containerRef} className="leaflet-top leaflet-right" style={{ marginTop: "24px", marginRight: "24px" }}>
      <div className="leaflet-control flex flex-col gap-3 pointer-events-auto">
        <div className="flex flex-col bg-surface border border-outline/20 shadow-2xl">
          <button title="Fullscreen" className="p-3 text-on-surface hover:text-primary transition-colors border-b border-outline/20 focus:outline-none">
            <Maximize2 size={18} />
          </button>
          <button 
            title="Layers" 
            onClick={onToggleLayers}
            className="p-3 text-on-surface hover:text-primary transition-colors border-b border-outline/20 focus:outline-none"
          >
            <Layers size={18} />
          </button>
          <button 
            title="Ice Layers" 
            onClick={onToggleIceLayers}
            className="p-3 text-on-surface hover:text-primary transition-colors focus:outline-none"
          >
            <Snowflake size={18} />
          </button>
        </div>
        
        <button 
          title="Center on Vessel"
          onClick={onCenter}
          className="bg-surface border border-outline/20 p-3 text-on-surface hover:text-primary hover:border-primary shadow-2xl transition-all active:scale-90 flex items-center justify-center"
        >
          <Crosshair size={18} />
        </button>

        <div className="flex flex-col bg-surface border border-outline/20 shadow-2xl">
          <button title="Zoom In" onClick={() => map.zoomIn()} className="p-3 text-on-surface hover:text-primary transition-colors border-b border-outline/20 focus:outline-none flex items-center justify-center">
            <Plus size={18} />
          </button>
          <button title="Zoom Out" onClick={() => map.zoomOut()} className="p-3 text-on-surface hover:text-primary transition-colors focus:outline-none flex items-center justify-center">
            <Minus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MapEvents({ 
  onAddWaypoint
}: { 
  onAddWaypoint: (lat: number, lng: number) => void
}) {
  const map = useMap();
  useMapEvents({
    click(e) {
      onAddWaypoint(e.latlng.lat, e.latlng.lng);
      map.flyTo([e.latlng.lat, e.latlng.lng], map.getZoom(), { animate: true });
    },
  });
  return null;
}

function IceLayerManager({ showIceToggles, setShowIceToggles }: { showIceToggles: boolean, setShowIceToggles: (v: boolean) => void }) {
  const {
    layers,
    visibleLayerIds,
    loadingLayerIds,
    errorByLayerId,
    selectedIceFeature,
    toggleLayer,
    setLayerOpacity,
    clearSelectedIceFeature
  } = useIceLayers();

  return (
    <>
      {showIceToggles && (
        <div 
          className="leaflet-top leaflet-right" 
          style={{ marginTop: "160px", marginRight: "80px" }}
        >
          <div className="leaflet-control" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
             <IceLayerToggle 
                layers={layers}
                visibleLayerIds={visibleLayerIds}
                onToggleLayer={toggleLayer}
                onOpacityChange={setLayerOpacity}
                loadingLayerIds={loadingLayerIds}
                errorByLayerId={errorByLayerId}
             />
          </div>
        </div>
      )}
      
      <AnimatePresence>
        {selectedIceFeature && (
          <div className="absolute top-0 right-0 z-[1000] h-full pointer-events-none">
            <div className="pointer-events-auto">
              <IceMetadataPopup 
                metadata={selectedIceFeature}
                onClose={clearSelectedIceFeature}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
