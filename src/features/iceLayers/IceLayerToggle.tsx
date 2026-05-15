import React from 'react';
import { Layers, Info, Loader2, AlertCircle, Snowflake } from 'lucide-react';
import { IceLayerSourceConfig } from './iceLayerTypes';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface IceLayerToggleProps {
  layers: IceLayerSourceConfig[];
  visibleLayerIds: string[];
  onToggleLayer: (layerId: string, visible: boolean) => void;
  onOpacityChange?: (layerId: string, opacity: number) => void;
  loadingLayerIds?: string[];
  errorByLayerId?: Record<string, string>;
}

export const IceLayerToggle: React.FC<IceLayerToggleProps> = ({
  layers,
  visibleLayerIds,
  onToggleLayer,
  onOpacityChange,
  loadingLayerIds = [],
  errorByLayerId = {},
}) => {
  return (
    <div className="flex flex-col gap-3 p-4 bg-[#0c141c]/90 backdrop-blur-xl border border-outline/30 shadow-2xl min-w-[280px]">
      <div className="flex items-center gap-2 border-b border-outline/10 pb-2 mb-1">
        <Snowflake size={16} className="text-primary" />
        <h3 className="text-xs font-bold font-mono tracking-[0.2em] text-on-surface uppercase">Ice Information Layers</h3>
      </div>
      
      <div className="space-y-3">
        {layers.map((layer) => {
          const isVisible = visibleLayerIds.includes(layer.id);
          const isLoading = loadingLayerIds.includes(layer.id);
          const error = errorByLayerId[layer.id];
          
          return (
            <div key={layer.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-3 cursor-pointer group flex-1">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={(e) => onToggleLayer(layer.id, e.target.checked)}
                      className="sr-only"
                    />
                    <div className={cn(
                      "w-4 h-4 border transition-colors flex items-center justify-center",
                      isVisible ? "bg-primary border-primary" : "border-outline/50 group-hover:border-primary"
                    )}>
                      {isVisible && <div className="w-2 h-2 bg-background" />}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className={cn(
                      "text-[11px] font-mono font-bold transition-colors uppercase tracking-tight",
                      isVisible ? "text-primary" : "text-on-surface-variant group-hover:text-on-surface"
                    )}>
                      {layer.label}
                    </span>
                    <span className="text-[9px] font-mono text-outline uppercase tracking-tighter">
                      {layer.metadata?.sourceName || layer.providerType}
                    </span>
                  </div>
                </label>
                
                <div className="flex items-center gap-2 shrink-0">
                  {isLoading && <Loader2 size={12} className="animate-spin text-primary" />}
                  {error && (
                    <div className="group relative">
                      <AlertCircle size={14} className="text-error" />
                      <div className="absolute bottom-full right-0 mb-2 invisible group-hover:visible w-48 p-2 bg-error text-on-error text-[10px] font-mono leading-tight z-[100]">
                        {error}
                      </div>
                    </div>
                  )}
                  {layer.metadata?.notes && (
                    <div className="group relative">
                      <Info size={14} className="text-outline hover:text-on-surface transition-colors cursor-help" />
                      <div className="absolute bottom-full right-0 mb-2 invisible group-hover:visible w-56 p-3 bg-surface-highest border border-outline/30 text-on-surface text-[10px] font-mono leading-relaxed z-[100] shadow-2xl">
                        <p className="font-bold text-primary mb-1 uppercase tracking-widest">About this layer</p>
                        {layer.metadata.notes}
                        <div className="mt-2 text-[8px] text-outline border-t border-outline/10 pt-1">
                          Source: {layer.attribution}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {isVisible && onOpacityChange && (
                <div className="flex items-center gap-3 pl-7">
                  <span className="text-[9px] font-mono text-outline uppercase tracking-tighter">Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={layer.opacity ?? 0.7}
                    onChange={(e) => onOpacityChange(layer.id, parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-surface-highest rounded-full appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-[9px] font-mono text-on-surface-variant w-6">
                    {Math.round((layer.opacity ?? 0.7) * 100)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 pt-2 border-t border-outline/10 text-[9px] font-mono text-outline leading-tight">
        <p className="uppercase tracking-widest opacity-50">Experimental Overlay Protocol</p>
      </div>
    </div>
  );
};
