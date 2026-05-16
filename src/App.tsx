import { useState, useCallback, useEffect, useRef } from "react";
import { 
  Anchor, 
  Map as MapIcon, 
  Navigation, 
  Settings, 
  Bell, 
  User, 
  Route, 
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
  Loader2,
  Plus,
  Minus,
  GripVertical,
  Trash2,
  MapPin
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents, Tooltip, Polygon } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
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
import { dictionaries, type Language, type TranslationKey } from "./i18n";

/**
 * Utility for Tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getInitialLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }

  const savedLanguage = window.localStorage.getItem("ice-route-language");
  if (savedLanguage === "ru" || savedLanguage === "en") {
    return savedLanguage;
  }

  return window.navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
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

interface MapNavigationTarget {
  id: string;
  lat: number;
  lng: number;
  zoom?: number;
  name?: string;
}

interface LegAnalysis {
  from: string;
  to: string;
  fromPoint?: GeoPoint;
  toPoint?: GeoPoint;
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

interface SeaRouteFeature {
  type: "Feature";
  geometry?: {
    type: "LineString";
    coordinates?: [number, number][];
  };
  properties?: {
    length?: number;
    units?: string;
    duration_hours?: number;
  };
}

interface SeaRouteLeg {
  legIndex: number;
  coordinates: [number, number][];
  lengthKm?: number;
  durationHours?: number;
}

interface OpenAIResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
}

interface IceClassAIResponse {
  legs: Array<{
    iceClass: string;
    thickness: string;
    risk: "LOW" | "MODERATE" | "HIGH";
    integrity: number;
    demandingSegment: string;
    advisories: Array<{
      type: "ice" | "seasonal" | "warning";
      title: string;
      description: string;
    }>;
  }>;
}

type WidgetAction =
  | { type: "navigate"; lng: number; lat: number; zoom?: number }
  | { type: "add_waypoint"; lng: number; lat: number; name?: string }
  | { type: "insert_waypoint"; lng: number; lat: number; afterLeg: number; name?: string }
  | { type: "delete_leg"; leg: number }
  | { type: "set_navigation_period"; startDate: string; endDate: string }
  | { type: "get_navigation_period" }
  | { type: "calculate_route" }
  | { type: "generate_report" };

const FURBOATS_WIDGET_SCRIPT_ID = "furboats-voice-widget-script";
const FURBOATS_WIDGET_ELEMENT_ID = "furboats-voice-agent-widget";
const FURBOATS_WIDGET_URL = "https://furboats-openai-live-dev.denslov.workers.dev/widget/v1/furboats-voice-widget.js";
const FURBOATS_WIDGET_BACKEND_URL = "https://furboats-openai-live-dev.denslov.workers.dev";
const SEA_ROUTE_API_URL = "https://usvmz35vpfuf3qaympixjlbfbe0dqian.lambda-url.eu-north-1.on.aws/route";
const ICE_ANALYSIS_SYSTEM_INSTRUCTION = "You are Ice Route AI, a polar maritime route analyst. Return conservative advisory ice-class estimates for each route leg. Use only the supplied route coordinates and dates. This is planning guidance, not an authoritative navigation order.";

const SUPPORTED_WIDGET_ACTIONS = [
  "/action navigate lng,lat,zoom",
  "/action add_waypoint lng,lat,name",
  "/action insert_waypoint lng,lat,after_leg,name",
  "/action delete_leg leg_number",
  "/action set_navigation_period start_date,end_date",
  "/action get_navigation_period",
  "/action calculate_route",
  "/action generate_report",
] as const;

const ICE_ANALYSIS_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["legs"],
  properties: {
    legs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["iceClass", "thickness", "risk", "integrity", "demandingSegment", "advisories"],
        properties: {
          iceClass: {
            type: "string",
            description: "Recommended minimum ice class for this leg, for example Ice3, Arc4, Arc7, Arc9, or Open Water.",
          },
          thickness: {
            type: "string",
            description: "Estimated ice thickness label such as 0.4m, 1.2m, or Unknown.",
          },
          risk: {
            type: "string",
            enum: ["LOW", "MODERATE", "HIGH"],
          },
          integrity: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description: "Confidence/integrity score for this advisory estimate.",
          },
          demandingSegment: {
            type: "string",
            description: "Short description of the most demanding part of this leg.",
          },
          advisories: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["type", "title", "description"],
              properties: {
                type: {
                  type: "string",
                  enum: ["ice", "seasonal", "warning"],
                },
                title: {
                  type: "string",
                },
                description: {
                  type: "string",
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

function getOpenAIResponseText(response: OpenAIResponse) {
  if (response.output_text) {
    return response.output_text;
  }

  return response.output
    ?.flatMap((item) => item.content || [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

function parseOpenAIJson<T>(response: OpenAIResponse): T {
  const text = getOpenAIResponseText(response);
  if (!text) {
    throw new Error("AI response did not include structured output.");
  }

  return JSON.parse(text) as T;
}

function buildIceAnalysisPrompt(waypoints: GeoPoint[], startDate: string, endDate: string) {
  const legs = waypoints.slice(0, -1).map((from, index) => {
    const to = waypoints[index + 1];
    return {
      index: index + 1,
      from: {
        name: from.name || `Waypoint ${index + 1}`,
        lat: from.lat,
        lng: from.lng,
      },
      to: {
        name: to.name || `Waypoint ${index + 2}`,
        lat: to.lat,
        lng: to.lng,
      },
      distanceNm: calculateRouteDistance([from, to]),
    };
  });

  return JSON.stringify({
    task: "Estimate the worst expected ice load, required ice class, and route risk for every route leg across the supplied navigation period.",
    outputRules: [
      "Return exactly one legs item for each input leg, in the same order.",
      "Use concise maritime wording suitable for UI cards.",
      "The navigation period is mandatory. Use it as a primary factor because worst-case ice load depends strongly on season.",
      "Estimate the worst expected ice condition within the entire startDate-to-endDate interval, not an average condition.",
      "If public ice data is not available in this prompt, make a conservative planning estimate from latitude, season, navigation period, and segment length.",
    ],
    navigationWindow: {
      startDate,
      endDate,
    },
    legs,
  });
}

function hasNavigationPeriod(startDate: string, endDate: string) {
  return Boolean(startDate && endDate);
}

function getRouteSignature(waypoints: GeoPoint[]) {
  return waypoints
    .map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`)
    .join("|");
}

async function requestSeaRoute(from: GeoPoint, to: GeoPoint, signal: AbortSignal): Promise<SeaRouteFeature> {
  const response = await fetch(SEA_ROUTE_API_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      origin: [from.lng, from.lat],
      destination: [to.lng, to.lat],
    }),
  });

  if (!response.ok) {
    throw new Error(`Sea-route service failed with ${response.status}`);
  }

  const data = await response.json() as SeaRouteFeature;
  if (data.geometry?.type !== "LineString" || !data.geometry.coordinates?.length) {
    throw new Error("Sea-route service returned no LineString coordinates.");
  }

  return data;
}

async function requestIceClassAnalysis(waypoints: GeoPoint[], startDate: string, endDate: string): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local and restart the dev server.");
  }

  if (!hasNavigationPeriod(startDate, endDate)) {
    throw new Error("Navigation period is required for ice-load calculation.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions: ICE_ANALYSIS_SYSTEM_INSTRUCTION,
      input: buildIceAnalysisPrompt(waypoints, startDate, endDate),
      text: {
        format: {
          type: "json_schema",
          name: "ice_route_analysis",
          strict: true,
          schema: ICE_ANALYSIS_RESPONSE_SCHEMA,
        },
      },
    }),
  });

  const data = await response.json() as OpenAIResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI ice-class analysis failed");
  }

  const parsed = parseOpenAIJson<IceClassAIResponse>(data);
  const legs = waypoints.slice(0, -1).map((fromPoint, index): LegAnalysis => {
    const toPoint = waypoints[index + 1];
    const aiLeg = parsed.legs[index];

    return {
      from: fromPoint.name?.split(",")[0] || `Waypoint ${index + 1}`,
      to: toPoint.name?.split(",")[0] || `Waypoint ${index + 2}`,
      fromPoint,
      toPoint,
      iceClass: aiLeg?.iceClass || "Unknown",
      thickness: aiLeg?.thickness || "Unknown",
      risk: aiLeg?.risk || "MODERATE",
      integrity: Math.max(0, Math.min(100, Number(aiLeg?.integrity ?? 50))),
      distance: calculateRouteDistance([fromPoint, toPoint]),
      demandingSegment: aiLeg?.demandingSegment || `Section ${index + 1}: ${fromPoint.name || "Waypoint"} to ${toPoint.name || "Waypoint"}`,
      advisories: aiLeg?.advisories?.length ? aiLeg.advisories : [
        {
          type: "warning",
          title: "Manual Review",
          description: "AI response did not include advisories for this segment.",
        },
      ],
    };
  });

  return { legs };
}

function isValidCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function parseWidgetActionText(text: string): WidgetAction | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^\/action\s+([a-z_]+)(?:\s+(.+))?$/i);
  if (!match) {
    return null;
  }

  const [, actionName, rawArgs] = match;
  if (actionName === "calculate_route") {
    return { type: "calculate_route" };
  }

  if (actionName === "generate_report") {
    return { type: "generate_report" };
  }

  if (actionName === "get_navigation_period") {
    return { type: "get_navigation_period" };
  }

  if (!rawArgs) {
    return null;
  }

  if (actionName === "set_navigation_period") {
    const [startDate, endDate] = rawArgs.split(",").map((part) => part.trim());
    return startDate && endDate ? { type: "set_navigation_period", startDate, endDate } : null;
  }

  if (actionName === "delete_leg") {
    const leg = Number(rawArgs.trim());
    return Number.isInteger(leg) && leg >= 1 ? { type: "delete_leg", leg } : null;
  }

  const [rawLng, rawLat, rawThird, ...rest] = rawArgs.split(",").map((part) => part.trim());
  const lng = Number(rawLng);
  const lat = Number(rawLat);

  if (!isValidCoordinate(lat, lng)) {
    return null;
  }

  if (actionName === "navigate") {
    const zoom = rawThird ? Number(rawThird) : undefined;
    return {
      type: "navigate",
      lng,
      lat,
      zoom: Number.isFinite(zoom) ? Math.max(2, Math.min(18, zoom as number)) : undefined,
    };
  }

  if (actionName === "add_waypoint") {
    return {
      type: "add_waypoint",
      lng,
      lat,
      name: [rawThird, ...rest].filter(Boolean).join(", ") || undefined,
    };
  }

  if (actionName === "insert_waypoint") {
    const afterLeg = Number(rawThird);
    return Number.isInteger(afterLeg) && afterLeg >= 1 ? {
      type: "insert_waypoint",
      lng,
      lat,
      afterLeg,
      name: rest.filter(Boolean).join(", ") || undefined,
    } : null;
  }

  return null;
}

function parseWidgetActionDetail(detail: any): WidgetAction | null {
  const action = detail?.action || detail?.type;
  const params = detail?.params || detail;

  if (action === "calculate_route") {
    return { type: "calculate_route" };
  }

  if (action === "generate_report") {
    return { type: "generate_report" };
  }

  if (action === "get_navigation_period") {
    return { type: "get_navigation_period" };
  }

  if (action === "set_navigation_period") {
    const startDate = params?.startDate ?? params?.start_date ?? params?.from;
    const endDate = params?.endDate ?? params?.end_date ?? params?.to;
    return startDate && endDate ? {
      type: "set_navigation_period",
      startDate,
      endDate,
    } : null;
  }

  if (action === "delete_leg") {
    const leg = Number(params?.leg ?? params?.legNumber ?? params?.index);
    return Number.isInteger(leg) && leg >= 1 ? { type: "delete_leg", leg } : null;
  }

  const lng = Number(params?.lng ?? params?.lon ?? params?.longitude);
  const lat = Number(params?.lat ?? params?.latitude);

  if (!isValidCoordinate(lat, lng)) {
    return null;
  }

  if (action === "navigate") {
    const zoom = Number(params?.zoom);
    return {
      type: "navigate",
      lng,
      lat,
      zoom: Number.isFinite(zoom) ? Math.max(2, Math.min(18, zoom)) : undefined,
    };
  }

  if (action === "add_waypoint") {
    return {
      type: "add_waypoint",
      lng,
      lat,
      name: params?.name,
    };
  }

  if (action === "insert_waypoint") {
    const afterLeg = Number(params?.afterLeg ?? params?.after_leg ?? params?.betweenLeg ?? params?.leg);
    return Number.isInteger(afterLeg) && afterLeg >= 1 ? {
      type: "insert_waypoint",
      lng,
      lat,
      afterLeg,
      name: params?.name,
    } : null;
  }

  return null;
}

function calculateRouteDistance(pts: GeoPoint[]) {
  let total = 0;
  const R = 3440.065;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += R * c;
  }
  return Math.round(total);
}

function buildWidgetRouteContext(waypoints: GeoPoint[], analysisResult: AnalysisResult | null, startDate = "", endDate = "") {
  return {
    waypointCount: waypoints.length,
    totalDistanceNm: calculateRouteDistance(waypoints),
    waypoints: waypoints.map(({ id, lat, lng, name }) => ({ id, lat, lng, name })),
    navigationPeriod: buildNavigationPeriodPayload(startDate, endDate),
    analyzed: Boolean(analysisResult),
    legs: waypoints.slice(0, -1).map((fromPoint, index) => {
      const toPoint = waypoints[index + 1];
      const analysis = analysisResult?.legs[index];
      return {
        index: index + 1,
        from: {
          id: fromPoint.id,
          lat: fromPoint.lat,
          lng: fromPoint.lng,
          name: fromPoint.name,
        },
        to: {
          id: toPoint.id,
          lat: toPoint.lat,
          lng: toPoint.lng,
          name: toPoint.name,
        },
        distanceNm: calculateRouteDistance([fromPoint, toPoint]),
        iceClass: analysis?.iceClass || null,
        thickness: analysis?.thickness || null,
        risk: analysis?.risk || null,
        integrity: analysis?.integrity || null,
        demandingSegment: analysis?.demandingSegment || null,
        advisories: analysis?.advisories || [],
      };
    }),
  };
}

function buildNavigationPeriodPayload(startDate: string, endDate: string) {
  return {
    startDate: startDate || null,
    endDate: endDate || null,
    complete: hasNavigationPeriod(startDate, endDate),
  };
}

function normalizePdfText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapPdfText(value: string, maxLength: number) {
  const words = normalizePdfText(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    if (!current) {
      current = word;
      return;
    }

    if (`${current} ${word}`.length > maxLength) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [""];
}

function formatCoordinate(point?: GeoPoint) {
  if (!point) {
    return "n/a";
  }

  return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
}

function buildReportLines(waypoints: GeoPoint[], analysisResult: AnalysisResult, startDate: string, endDate: string) {
  const lines: string[] = [
    "ICE ROUTE FULL REPORT",
    `Generated: ${new Date().toLocaleString("en-GB")}`,
    `Navigation window: ${startDate || "not set"}${endDate ? ` to ${endDate}` : ""}`,
    `Waypoints: ${waypoints.length} | Legs: ${analysisResult.legs.length} | Total distance: ${calculateRouteDistance(waypoints)} NM`,
    "",
    "LEG | FROM -> TO | COORDINATES | DIST NM | ICE CLASS | THICKNESS | RISK | INTEGRITY",
    "----|------------|-------------|---------|-----------|-----------|------|----------",
  ];

  analysisResult.legs.forEach((leg, index) => {
    const routeLabel = `${normalizePdfText(leg.from)} -> ${normalizePdfText(leg.to)}`;
    const coordinates = `${formatCoordinate(leg.fromPoint)} -> ${formatCoordinate(leg.toPoint)}`;
    lines.push(`${index + 1} | ${routeLabel} | ${coordinates} | ${leg.distance} | ${leg.iceClass} | ${leg.thickness} | ${leg.risk} | ${leg.integrity}%`);
    lines.push(`    Demanding segment: ${normalizePdfText(leg.demandingSegment)}`);
    leg.advisories.forEach((advisory) => {
      lines.push(`    ${advisory.type.toUpperCase()}: ${normalizePdfText(advisory.title)} - ${normalizePdfText(advisory.description)}`);
    });
    lines.push("");
  });

  return lines.flatMap((line) => wrapPdfText(line, 104));
}

function createPdfBlob(lines: string[]) {
  const pageLineLimit = 46;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += pageLineLimit) {
    pages.push(lines.slice(i, i + pageLineLimit));
  }

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");

  const pageObjectStart = 4;
  const pageRefs = pages.map((_, index) => `${pageObjectStart + index * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

  pages.forEach((pageLines, pageIndex) => {
    const pageObjectNumber = pageObjectStart + pageIndex * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const stream = [
      "BT",
      "/F1 9 Tf",
      "12 TL",
      ...pageLines.map((line, index) => `1 0 0 1 36 ${780 - index * 14} Tm (${escapePdfText(line)}) Tj`),
      "ET",
    ].join("\n");

    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function positionFurboatsWidget(widget: HTMLElement) {
  const style = document.createElement("style");
  style.textContent = `
    .root {
      bottom: 104px;
      right: 24px;
    }

    @media (max-width: 767px) {
      .root {
        bottom: 88px;
        right: 16px;
      }
    }
  `;
  widget.shadowRoot?.append(style);
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

const MobileNav = ({ activeTab, setActiveTab, t }: { activeTab: string; setActiveTab: (s: string) => void; t: (key: TranslationKey) => string }) => {
  const tabs = [
    { id: "command", icon: Activity, label: t("command") },
    { id: "fleet", icon: Ship, label: t("fleet") },
    { id: "routing", icon: Route, label: t("missionRouting") },
    { id: "data", icon: Info, label: t("technicalData") },
    { id: "archive", icon: Bookmark, label: t("savedRoutes") },
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
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoveredWaypointId, setHoveredWaypointId] = useState<string | null>(null);
  const previousWaypointCountRef = useRef(0);

  // Geocoding states
  const [newWaypointSearch, setNewWaypointSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [flyToPoint, setFlyToPoint] = useState<MapNavigationTarget | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisRouteSignature, setAnalysisRouteSignature] = useState<string | null>(null);
  const [seaRouteLegs, setSeaRouteLegs] = useState<SeaRouteLeg[]>([]);
  const [isSeaRouting, setIsSeaRouting] = useState(false);
  const [seaRouteError, setSeaRouteError] = useState<string | null>(null);
  const t = useCallback((key: TranslationKey) => dictionaries[language][key], [language]);

  const sendWidgetCommand = useCallback((command: string, payload: Record<string, unknown>) => {
    const widget = document.getElementById(FURBOATS_WIDGET_ELEMENT_ID);
    const detail = {
      command,
      payload,
      source: "ice-route",
      sentAt: new Date().toISOString(),
    };

    widget?.dispatchEvent(new CustomEvent("ice-route.command", { detail, bubbles: true, composed: true }));
    window.dispatchEvent(new CustomEvent("ice-route.command", { detail }));
  }, []);

  const requestNavigationPeriodFromWidget = useCallback((reason: string) => {
    const payload = {
      reason,
      message: t("navigationPeriodRequiredWidget"),
      currentPeriod: buildNavigationPeriodPayload(startDate, endDate),
    };

    sendWidgetCommand("navigation_period.required", payload);
    alert(t("navigationPeriodRequiredAlert"));
  }, [endDate, sendWidgetCommand, startDate, t]);

  const runIceAnalysis = useCallback(async () => {
    const routeSignature = getRouteSignature(waypoints);
    const result = await requestIceClassAnalysis(waypoints, startDate, endDate);
    setAnalysisResult(result);
    setAnalysisRouteSignature(routeSignature);
    setShowAnalysis(true);
    sendWidgetCommand("ice_class.updated", buildWidgetRouteContext(waypoints, result, startDate, endDate));
  }, [endDate, sendWidgetCommand, startDate, waypoints]);

  useEffect(() => {
    let cancelled = false;

    const mountWidget = async () => {
      await customElements.whenDefined("furboats-voice-widget");
      if (cancelled || document.getElementById(FURBOATS_WIDGET_ELEMENT_ID)) {
        return;
      }

      const furboatsVoice = (window as any).FurboatsVoice;
      const widget = furboatsVoice?.init?.({
        backendUrl: FURBOATS_WIDGET_BACKEND_URL,
        siteKey: "pk_test_furboats_arc",
        agentId: "arc-yacht-advisor",
        language,
      }) as HTMLElement | undefined;

      if (widget) {
        widget.id = FURBOATS_WIDGET_ELEMENT_ID;
        positionFurboatsWidget(widget);
      }
    };

    const existingScript = document.getElementById(FURBOATS_WIDGET_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      mountWidget();
    } else {
      const script = document.createElement("script");
      script.id = FURBOATS_WIDGET_SCRIPT_ID;
      script.async = true;
      script.src = FURBOATS_WIDGET_URL;
      script.dataset.siteKey = "pk_test_furboats_arc";
      script.dataset.agentId = "arc-yacht-advisor";
      script.dataset.language = language;
      script.dataset.autoInit = "false";
      script.addEventListener("load", mountWidget);
      document.body.append(script);
    }

    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    localStorage.setItem("ice-route-language", language);
    document.documentElement.lang = language;
    const widget = document.getElementById(FURBOATS_WIDGET_ELEMENT_ID);
    widget?.setAttribute("data-language", language);
    sendWidgetCommand("language.updated", { language });
  }, [language, sendWidgetCommand]);

  useEffect(() => {
    if (waypoints.length > previousWaypointCountRef.current) {
      const waypoint = waypoints[waypoints.length - 1];
      sendWidgetCommand("waypoint.added", {
        waypoint: {
          id: waypoint.id,
          lat: waypoint.lat,
          lng: waypoint.lng,
          name: waypoint.name,
        },
      });
    }

    previousWaypointCountRef.current = waypoints.length;

    const currentRouteSignature = getRouteSignature(waypoints);
    const currentAnalysis = analysisRouteSignature === currentRouteSignature ? analysisResult : null;
    sendWidgetCommand("route.updated", buildWidgetRouteContext(waypoints, currentAnalysis, startDate, endDate));
  }, [analysisResult, analysisRouteSignature, endDate, sendWidgetCommand, startDate, waypoints]);

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

  // Auto-open sidebar when points are selected
  useEffect(() => {
    if (waypoints.length >= 2) {
      setIsSidebarOpen(true);
    }
  }, [waypoints.length]);

  useEffect(() => {
    if (analysisRouteSignature && analysisRouteSignature !== getRouteSignature(waypoints)) {
      setAnalysisResult(null);
      setAnalysisRouteSignature(null);
      setShowAnalysis(false);
    }
  }, [analysisRouteSignature, waypoints]);

  useEffect(() => {
    if (waypoints.length < 2) {
      setSeaRouteLegs([]);
      setSeaRouteError(null);
      setIsSeaRouting(false);
      return;
    }

    const controller = new AbortController();
    setIsSeaRouting(true);
    setSeaRouteError(null);

    const loadSeaRoutes = async () => {
      const results = await Promise.allSettled(
        waypoints.slice(0, -1).map(async (fromPoint, index) => {
          const feature = await requestSeaRoute(fromPoint, waypoints[index + 1], controller.signal);
          return {
            legIndex: index,
            coordinates: feature.geometry!.coordinates!,
            lengthKm: feature.properties?.length,
            durationHours: feature.properties?.duration_hours,
          } satisfies SeaRouteLeg;
        })
      );

      if (controller.signal.aborted) {
        return;
      }

      const loadedRoutes = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      const failedCount = results.length - loadedRoutes.length;
      setSeaRouteLegs(loadedRoutes);
      setSeaRouteError(failedCount ? `${failedCount} sea-route leg${failedCount === 1 ? "" : "s"} failed to load.` : null);
      setIsSeaRouting(false);
    };

    void loadSeaRoutes().catch((error) => {
      if (controller.signal.aborted) {
        return;
      }

      console.error("Sea-route loading failed", error);
      setSeaRouteLegs([]);
      setSeaRouteError(error instanceof Error ? error.message : "Sea-route loading failed.");
      setIsSeaRouting(false);
    });

    return () => {
      controller.abort();
    };
  }, [waypoints]);

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

  const handleNavigationPeriodChange = useCallback((start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    sendWidgetCommand("navigation_period.updated", {
      navigationPeriod: buildNavigationPeriodPayload(start, end),
    });
  }, [sendWidgetCommand]);

  const handleAnalyze = useCallback(async () => {
    if (waypoints.length < 2) return;
    if (!hasNavigationPeriod(startDate, endDate)) {
      requestNavigationPeriodFromWidget("calculate_route");
      return;
    }

    setIsAnalyzing(true);
    setShowAnalysis(false);

    try {
      await runIceAnalysis();
    } catch (error) {
      console.error("Ice class analysis failed", error);
      const message = error instanceof Error ? error.message : t("iceClassFailed");
      sendWidgetCommand("ice_class.failed", { reason: message });
      alert(message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [endDate, requestNavigationPeriodFromWidget, runIceAnalysis, sendWidgetCommand, startDate, t, waypoints.length]);

  const handleGenerateFullReport = useCallback(() => {
    if (!analysisResult) {
      sendWidgetCommand("report.unavailable", {
        reason: t("reportUnavailable"),
      });
      return;
    }

    const lines = buildReportLines(waypoints, analysisResult, startDate, endDate);
    const pdf = createPdfBlob(lines);
    const datestamp = new Date().toISOString().slice(0, 10);
    downloadBlob(pdf, `ice-route-report-${datestamp}.pdf`);
    sendWidgetCommand("report.generated", {
      filename: `ice-route-report-${datestamp}.pdf`,
      legCount: analysisResult.legs.length,
    });
  }, [analysisResult, endDate, sendWidgetCommand, startDate, t, waypoints]);

  const executeWidgetAction = useCallback((action: WidgetAction) => {
    if (action.type === "navigate") {
      setFlyToPoint({
        id: `widget-navigation-${Date.now()}`,
        lat: action.lat,
        lng: action.lng,
        zoom: action.zoom,
        name: "Widget navigation target",
      });
      setActiveTab("command");
      return;
    }

    if (action.type === "add_waypoint" || action.type === "insert_waypoint") {
      const waypoint: GeoPoint = {
        id: `widget-waypoint-${Date.now()}`,
        lat: action.lat,
        lng: action.lng,
        name: action.name || `Widget waypoint ${action.lat.toFixed(4)}, ${action.lng.toFixed(4)}`,
      };

      if (action.type === "insert_waypoint") {
        if (waypoints.length < 2 || action.afterLeg < 1 || action.afterLeg >= waypoints.length) {
          sendWidgetCommand("insert_waypoint.rejected", {
            reason: t("insertWaypointRejected"),
            afterLeg: action.afterLeg,
            waypointCount: waypoints.length,
          });
          return;
        }

        setWaypoints(prev => {
          const insertAt = Math.max(1, Math.min(prev.length, action.afterLeg));
          return [...prev.slice(0, insertAt), waypoint, ...prev.slice(insertAt)];
        });
      } else {
        setWaypoints(prev => [...prev, waypoint]);
      }

      setFlyToPoint({ ...waypoint, zoom: 8 });
      setActiveTab("command");
      return;
    }

    if (action.type === "delete_leg") {
      if (waypoints.length < 2 || action.leg < 1 || action.leg >= waypoints.length) {
        sendWidgetCommand("delete_leg.rejected", {
          reason: t("deleteLegRejected"),
          leg: action.leg,
          legCount: Math.max(0, waypoints.length - 1),
        });
        return;
      }

      setWaypoints(prev => {
        const waypointIndexToRemove = action.leg;
        return prev.filter((_, index) => index !== waypointIndexToRemove);
      });
      setActiveTab("command");
      return;
    }

    if (action.type === "set_navigation_period") {
      handleNavigationPeriodChange(action.startDate, action.endDate);
      return;
    }

    if (action.type === "get_navigation_period") {
      sendWidgetCommand("navigation_period.current", {
        navigationPeriod: buildNavigationPeriodPayload(startDate, endDate),
      });
      return;
    }

    if (action.type === "calculate_route") {
      if (!hasNavigationPeriod(startDate, endDate)) {
        requestNavigationPeriodFromWidget("calculate_route");
      } else if (waypoints.length >= 2 && !isAnalyzing) {
        void handleAnalyze();
      } else {
        sendWidgetCommand("calculate_route.rejected", {
          reason: waypoints.length < 2 ? t("atLeastTwoWaypoints") : t("calculationRunning"),
        });
      }
      return;
    }

    if (action.type === "generate_report") {
      handleGenerateFullReport();
    }
  }, [endDate, handleAnalyze, handleGenerateFullReport, handleNavigationPeriodChange, isAnalyzing, requestNavigationPeriodFromWidget, sendWidgetCommand, startDate, t, waypoints]);

  useEffect(() => {
    const handleWidgetText = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text;
      if (!text) {
        return;
      }

      const action = parseWidgetActionText(text);
      if (action) {
        executeWidgetAction(action);
      }
    };

    const handleWidgetAction = (event: Event) => {
      const action = parseWidgetActionDetail((event as CustomEvent).detail);
      if (action) {
        executeWidgetAction(action);
      }
    };

    window.addEventListener("assistant.text", handleWidgetText);
    window.addEventListener("furboats.action", handleWidgetAction);

    return () => {
      window.removeEventListener("assistant.text", handleWidgetText);
      window.removeEventListener("furboats.action", handleWidgetAction);
    };
  }, [executeWidgetAction]);

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

  const calculateTotalDistance = (pts: GeoPoint[]) => {
    return calculateRouteDistance(pts);
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
    alert(t("missionRouteSaved"));
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
            <h1 className="text-xl font-bold tracking-tighter text-on-surface">{t("appName")}</h1>
            <span className="text-[10px] font-mono text-tertiary px-1 border border-tertiary/30 tracking-widest hidden sm:inline">{t("proVersion")}</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-4 font-mono text-[10px] tracking-widest text-on-surface-variant">
          <div className="flex flex-col items-end">
            <span className="text-secondary font-bold">{t("signalOptimal")}</span>
            <span>78.2° N, 15.6° E</span>
          </div>
          <div className="h-8 w-[1px] bg-outline/20 mx-2" />
          <nav className="flex items-center gap-6 text-xs font-semibold">
            <button onClick={() => setActiveTab("command")} className={cn("hover:text-primary transition-colors", activeTab === "command" && "text-primary border-b border-primary")}>{t("command")}</button>
            <button onClick={() => { setActiveTab("fleet"); setSelectedVessel(null); }} className={cn("hover:text-primary transition-colors", activeTab === "fleet" && "text-primary border-b border-primary")}>{t("fleet")}</button>
            <button onClick={() => setActiveTab("routing")} className={cn("hover:text-primary transition-colors", activeTab === "routing" && "text-primary border-b border-primary")}>{t("charts")}</button>
            <button onClick={() => setActiveTab("data")} className={cn("hover:text-primary transition-colors", activeTab === "data" && "text-primary border-b border-primary")}>{t("environmental")}</button>
            <button onClick={() => setActiveTab("archive")} className={cn("hover:text-primary transition-colors", activeTab === "archive" && "text-primary border-b border-primary")}>{t("savedRoutes")}</button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex border border-outline/20 bg-background/30 font-mono text-[10px] font-bold">
            {(["en", "ru"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setLanguage(option)}
                className={cn(
                  "px-2 py-1 transition-colors uppercase",
                  language === option ? "bg-primary text-background" : "text-on-surface-variant hover:text-primary"
                )}
              >
                {option}
              </button>
            ))}
          </div>
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
                    <h2 className="text-lg font-semibold tracking-tight text-on-surface">{t("commandPanel")}</h2>
                  </div>
                  <button 
                    className="md:hidden text-on-surface-variant"
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">{t("vesselReadiness")}</p>
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
                    <span className="text-[10px] font-bold font-mono tracking-[0.2em] uppercase">{t("missionCommand")}</span>
                  </button>
                  <button 
                    onClick={() => { setActiveTab("fleet"); setSelectedVessel(null); }}
                    className={cn(
                      "px-6 py-4 flex items-center gap-4 transition-all border-l-4",
                      activeTab === "fleet" ? "border-secondary bg-surface-highest/20 text-secondary" : "border-transparent text-on-surface-variant hover:bg-surface-highest/10 hover:text-on-surface"
                    )}
                  >
                    <Ship size={18} />
                    <span className="text-[10px] font-bold font-mono tracking-[0.2em] uppercase">{t("fleetArchive")}</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab("archive")}
                    className={cn(
                      "px-6 py-4 flex items-center gap-4 transition-all border-l-4",
                      activeTab === "archive" ? "border-secondary bg-surface-highest/20 text-secondary" : "border-transparent text-on-surface-variant hover:bg-surface-highest/10 hover:text-on-surface"
                    )}
                  >
                    <Bookmark size={18} />
                    <span className="text-[10px] font-bold font-mono tracking-[0.2em] uppercase">{t("savedRoutes")}</span>
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
                                {t("analyzing")}
                              </>
                            ) : (
                              <>
                                <Activity size={16} />
                                {t("calculateIceClass")}
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
                            {t("saveMissionRoute")}
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Route size={16} className="text-primary" />
                          <h3 className="text-xs font-bold font-mono tracking-widest text-on-surface-variant">{t("missionParameters")}</h3>
                        </div>
	                        {waypoints.length > 0 && (
	                          <button 
	                            onClick={() => {
                              setWaypoints([]);
                              setNewWaypointSearch("");
                              handleNavigationPeriodChange("", "");
                              setAnalysisResult(null);
                              setAnalysisRouteSignature(null);
                              setShowAnalysis(false);
                            }}
	                            className="text-[10px] font-mono text-error hover:text-error/80 flex items-center gap-1 transition-colors"
	                          >
                            <X size={12} />
                            {t("resetMission")}
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {/* Add Waypoint Input */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <MapPin size={12} className="text-outline" />
                            <label className="text-[10px] font-bold font-mono text-on-surface-variant uppercase tracking-wider">{t("addMissionWaypoint")}</label>
                          </div>
                          <div className="relative group">
                            <input 
                              type="text" 
                              value={newWaypointSearch}
                              onChange={(e) => setNewWaypointSearch(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleGeocode(newWaypointSearch)}
                              placeholder={t("waypointSearchPlaceholder")}
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
                                      labels={{
                                        departure: t("departure"),
                                        arrival: t("arrival"),
                                        waypoint: t("waypoint"),
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                          </SortableContext>
                        </DndContext>

                        {waypoints.length === 0 && (
                          <div className="p-4 border border-dashed border-outline/30 text-center">
                            <p className="text-[10px] font-mono text-on-surface-variant uppercase">{t("noWaypoints")}</p>
                          </div>
                        )}

                        <div className="pt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-outline" />
                            <label className="text-[10px] font-bold font-mono text-on-surface-variant uppercase tracking-wider">{t("navigationPeriod")}</label>
                          </div>
                          <DateRangePicker 
                            startDate={startDate} 
                            endDate={endDate} 
                            onRangeChange={handleNavigationPeriodChange}
                            language={language}
                            labels={{
                              selectDateOrPeriod: t("selectDateOrPeriod"),
                              selectDateOrPeriodUpper: t("selectDateOrPeriodUpper"),
                              singleDate: t("singleDate"),
                              period: t("period"),
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
                      <h4 className="text-xs font-bold font-mono text-tertiary mb-2">{t("navigationWindow")}</h4>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        {t("navigationWindowHelp")}
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
                        <h2 className="text-[10px] font-bold font-mono text-primary tracking-[0.2em] uppercase">{t("routeIntelligence")}</h2>
                        <span className="text-[9px] font-mono text-outline">{analysisResult.legs.length} {t("segments")}</span>
                      </div>

                      {analysisResult.legs.map((leg, idx) => (
                        <div key={idx} className="technical-card p-4 rounded-none bg-surface-highest/10 border-outline/10 relative group">
                          <TechnicalBorder />
                          
                          <div className="flex justify-between items-start mb-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] font-bold font-mono text-tertiary mb-1 tracking-tighter uppercase truncate">
                                {t("leg")} {idx + 1}: {leg.from} → {leg.to}
                              </p>
                              <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-primary tracking-tighter">{leg.iceClass}</span>
                                <span className="text-[8px] font-mono text-on-surface-variant">{t("pc")}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[8px] font-bold font-mono text-on-surface-variant">{t("thickness")}</div>
                              <div className="text-lg font-mono text-secondary font-bold">{leg.thickness}</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-3 pt-2 border-t border-outline/5">
                            <div className="space-y-1">
                              <span className="text-[8px] font-bold font-mono text-on-surface-variant block uppercase">{t("risk")}</span>
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
                              <span className="text-[8px] font-bold font-mono text-on-surface-variant block uppercase">{t("distanceShort")}</span>
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
                            <span className="text-[10px] font-bold font-mono text-on-surface-variant">{t("totalMissionDistance")}</span>
                            <span className="text-sm font-mono font-bold text-primary">{calculateTotalDistance(waypoints)} NM</span>
                         </div>
                         <button
                            onClick={handleGenerateFullReport}
                            className="w-full py-2 bg-primary text-background text-[10px] font-bold font-mono tracking-widest hover:bg-primary-dim transition-colors uppercase flex items-center justify-center gap-2"
                         >
                            <Download size={14} />
                            {t("generateFullReport")}
                         </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

              <footer className="p-4 border-t border-outline/20 bg-background/50 flex flex-col items-center gap-1">
                <p className="text-[9px] font-mono text-outline uppercase tracking-widest">{t("internalUseOnly")}</p>
                <p className="text-[8px] font-mono text-outline opacity-50">{t("proprietaryProtocol")}</p>
              </footer>
            </motion.aside>
          )}
        </AnimatePresence>

        {activeTab === "fleet" ? (
          <main className="flex-1 h-full min-h-0 overflow-hidden">
            {selectedVessel ? (
              <VesselDetail vessel={selectedVessel} onBack={() => setSelectedVessel(null)} t={t} />
            ) : (
              <SavedVessels onSelectVessel={setSelectedVessel} t={t} />
            )}
          </main>
        ) : activeTab === "archive" ? (
          <main className="flex-1 h-full min-h-0 overflow-hidden">
            <SavedRoutes onSwitchToFleet={() => setActiveTab("fleet")} t={t} />
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
                  labels={{
                    fullscreen: t("fullscreen"),
                    layers: t("layers"),
                    iceLayers: t("iceLayers"),
                    centerOnVessel: t("centerOnVessel"),
                    zoomIn: t("zoomIn"),
                    zoomOut: t("zoomOut"),
                  }}
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
                      labels={{
                        satelliteLive: t("satelliteLive"),
                        standardCharts: t("standardCharts"),
                      }}
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
                          {index === 0 ? t("departureMap") : index === waypoints.length - 1 ? t("arrivalMap") : `${t("waypointMap")} ${index}`}
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

                {seaRouteLegs.map((route) => (
                  <Polyline
                    key={`sea-route-${route.legIndex}`}
                    positions={route.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
                    color="#fd8b00"
                    opacity={0.95}
                    weight={3}
                  />
                ))}
              </MapContainer>
            </div>

            {/* Map Legend */}
            <Legend showIceClasses={showIceLayers} t={t} />

            <div className="absolute bottom-6 left-6 z-30 hidden md:block">
              {(isSeaRouting || seaRouteError) && (
                <p className={cn(
                  "mb-2 text-[9px] font-mono uppercase tracking-[0.2em] max-w-[300px] leading-relaxed",
                  seaRouteError ? "text-error" : "text-secondary"
                )}>
                  {seaRouteError || "SEA ROUTE LOADING..."}
                </p>
              )}
              <p className="text-[9px] font-mono text-outline uppercase tracking-[0.2em] max-w-[300px] leading-relaxed opacity-60">
                 {t("caution")}
              </p>
            </div>
          </main>
        )}
      </div>

      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} t={t} />

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
              <span className="font-bold tracking-tighter text-on-surface">{t("mainNavigation")}</span>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-on-surface-variant"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 p-8 flex flex-col gap-6">
              {[
                { id: "command", icon: Activity, label: t("commandControl") },
                { id: "fleet", icon: Ship, label: t("fleetArchive") },
                { id: "routing", icon: Route, label: t("missionRouting") },
                { id: "data", icon: Info, label: t("technicalData") },
                { id: "archive", icon: Bookmark, label: t("savedRoutes") },
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
                    <span className="text-[10px] opacity-50 uppercase font-mono">{t("systemProtocolAccess")}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-8 border-t border-outline/10 bg-surface-low">
              <div className="flex items-center justify-between text-xs font-mono text-outline">
                 <span>{t("version")}</span>
                 <span>{t("polarOpsReady")}</span>
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

function SortableWaypointItem({ waypoint, index, isLast, isHovered, onRemove, labels }: { 
  waypoint: GeoPoint; 
  index: number; 
  isLast: boolean;
  isHovered?: boolean;
  onRemove: () => void;
  labels?: {
    departure: string;
    arrival: string;
    waypoint: string;
  };
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
          {index === 0 ? labels?.departure || "Departure" : isLast ? labels?.arrival || "Arrival" : `${labels?.waypoint || "Waypoint"} ${index}`}
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

function LayerPopup({ mapLayer, setMapLayer, onClose, labels }: { 
  mapLayer: string; 
  setMapLayer: (l: any) => void; 
  onClose: () => void;
  labels?: {
    satelliteLive: string;
    standardCharts: string;
  };
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
        { id: "satellite", label: labels?.satelliteLive || "Satellite (Live)", icon: MapIcon },
        { id: "standard", label: labels?.standardCharts || "Standard Charts", icon: Navigation }
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

const Legend = ({ showIceClasses, t }: { showIceClasses?: boolean; t: (key: TranslationKey) => string }) => (
  <div 
    onMouseDown={(e) => e.stopPropagation()}
    className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0c141c]/90 backdrop-blur-xl border border-outline/30 p-4 flex flex-col gap-4 items-center z-30 shadow-2xl rounded-none max-w-[95vw]"
  >
    <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-start md:items-center">
      <div className="flex items-center gap-2 border-r border-outline/20 pr-4">
        <Shield size={14} className="text-secondary" />
        <span className="text-[10px] font-bold font-mono text-on-surface uppercase tracking-widest whitespace-nowrap">{t("vesselRequirements")}</span>
      </div>
      
      <div className="grid grid-cols-2 md:flex items-center gap-4 md:gap-6">
        {ICE_ZONES.slice().reverse().map(zone => (
          <div key={zone.id} className="flex items-center gap-2 group cursor-help">
            <div className="w-3 h-3 border transition-transform group-hover:scale-110" style={{ backgroundColor: `${zone.color}33`, borderColor: zone.color }} />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold font-mono text-on-surface tracking-tighter">{zone.id.split('-')[1].toUpperCase()}</span>
              <span className="text-[8px] font-mono text-outline uppercase tracking-tight hidden md:block">{t("required")}</span>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-4 h-[1px] border-t border-dashed border-primary" />
          <span className="text-[10px] font-mono text-on-surface tracking-tighter">{t("plannedRoute")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-[2px] bg-secondary" />
          <span className="text-[10px] font-mono text-on-surface tracking-tighter">{t("maritimeRoute")}</span>
        </div>
      </div>
    </div>

    {showIceClasses && (
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-start md:items-center pt-3 border-t border-outline/10 w-full justify-center">
        <div className="flex items-center gap-2 border-r border-outline/20 pr-4">
          <Snowflake size={14} className="text-primary" />
          <span className="text-[10px] font-bold font-mono text-on-surface uppercase tracking-widest whitespace-nowrap">{t("seaIceData")}</span>
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

function FlyToHandler({ point, onComplete }: { point: MapNavigationTarget; onComplete: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (point) {
      map.flyTo([point.lat, point.lng], point.zoom || 8, { animate: true, duration: 1.5 });
      onComplete();
    }
  }, [point, map, onComplete]);
  return null;
}

function MapControls({ onCenter, onToggleLayers, onToggleIceLayers, labels }: {
  onCenter: () => void;
  onToggleLayers: () => void;
  onToggleIceLayers: () => void;
  labels?: {
    fullscreen: string;
    layers: string;
    iceLayers: string;
    centerOnVessel: string;
    zoomIn: string;
    zoomOut: string;
  };
}) {
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
          <button title={labels?.fullscreen || "Fullscreen"} className="p-3 text-on-surface hover:text-primary transition-colors border-b border-outline/20 focus:outline-none">
            <Maximize2 size={18} />
          </button>
          <button 
            title={labels?.layers || "Layers"}
            onClick={onToggleLayers}
            className="p-3 text-on-surface hover:text-primary transition-colors border-b border-outline/20 focus:outline-none"
          >
            <Layers size={18} />
          </button>
          <button 
            title={labels?.iceLayers || "Ice Layers"}
            onClick={onToggleIceLayers}
            className="p-3 text-on-surface hover:text-primary transition-colors focus:outline-none"
          >
            <Snowflake size={18} />
          </button>
        </div>
        
        <button 
          title={labels?.centerOnVessel || "Center on Vessel"}
          onClick={onCenter}
          className="bg-surface border border-outline/20 p-3 text-on-surface hover:text-primary hover:border-primary shadow-2xl transition-all active:scale-90 flex items-center justify-center"
        >
          <Crosshair size={18} />
        </button>

        <div className="flex flex-col bg-surface border border-outline/20 shadow-2xl">
          <button title={labels?.zoomIn || "Zoom In"} onClick={() => map.zoomIn()} className="p-3 text-on-surface hover:text-primary transition-colors border-b border-outline/20 focus:outline-none flex items-center justify-center">
            <Plus size={18} />
          </button>
          <button title={labels?.zoomOut || "Zoom Out"} onClick={() => map.zoomOut()} className="p-3 text-on-surface hover:text-primary transition-colors focus:outline-none flex items-center justify-center">
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
