import React from 'react';
import { X, Snowflake, Activity, Thermometer, Shield, Info, AlertTriangle } from 'lucide-react';
import { IceFeatureMetadata } from './iceLayerTypes';
import { ICE_CLASS_LABELS, ICE_CLASS_COLORS } from './iceClassification';
import { motion } from 'motion/react';

interface IceMetadataPopupProps {
  metadata: IceFeatureMetadata | null;
  onClose: () => void;
}

export const IceMetadataPopup: React.FC<IceMetadataPopupProps> = ({ metadata, onClose }) => {
  if (!metadata) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute top-24 right-6 w-[320px] bg-[#0c141c]/95 backdrop-blur-xl border border-outline/30 shadow-2xl z-[80] overflow-hidden rounded-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-outline/20 bg-surface-highest/20">
        <div className="flex items-center gap-3">
          <div 
            className="w-3 h-3 border" 
            style={{ 
              backgroundColor: metadata.derivedIceClass ? `${ICE_CLASS_COLORS[metadata.derivedIceClass]}33` : '#bdbdbd33',
              borderColor: metadata.derivedIceClass ? ICE_CLASS_COLORS[metadata.derivedIceClass] : '#bdbdbd'
            }} 
          />
          <h3 className="text-xs font-bold font-mono tracking-widest text-on-surface uppercase">Ice Metadata</h3>
        </div>
        <button onClick={onClose} className="text-outline hover:text-on-surface transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Primary Metric */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold font-mono text-outline uppercase tracking-[0.2em]">Recommended Ice Class</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-primary tracking-tighter">
                {metadata.derivedIceClass ? ICE_CLASS_LABELS[metadata.derivedIceClass].replace('Ice Class ', '').toUpperCase() : 'UNKNOWN'}
              </span>
              <span className="text-[10px] font-mono text-primary/60 font-bold tracking-widest uppercase">
                {metadata.derivedIceClass ? 'Stratum' : 'N/A'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <Snowflake size={12} className="text-secondary" />
                <span className="text-[10px] font-bold font-mono tracking-wider uppercase">Thickness</span>
              </div>
              <p className="text-lg font-mono font-bold text-on-surface">
                {metadata.iceThicknessM !== null ? `${metadata.iceThicknessM.toFixed(2)}m` : 'N/A'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <Activity size={12} className="text-tertiary" />
                <span className="text-[10px] font-bold font-mono tracking-wider uppercase">Concentration</span>
              </div>
              <p className="text-lg font-mono font-bold text-on-surface">
                {metadata.iceConcentrationPct !== null ? `${metadata.iceConcentrationPct}%` : 'N/A'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <Thermometer size={12} className="text-error/70" />
                <span className="text-[10px] font-bold font-mono tracking-wider uppercase">Temperature</span>
              </div>
              <p className="text-lg font-mono font-bold text-on-surface">
                {metadata.surfaceTemperatureC !== null ? `${metadata.surfaceTemperatureC.toFixed(1)}°C` : 'N/A'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <Shield size={12} className="text-primary/70" />
                <span className="text-[10px] font-bold font-mono tracking-wider uppercase">Confidence</span>
              </div>
              <p className="text-lg font-mono font-bold text-on-surface capitalize">
                {metadata.confidence || 'Medium'}
              </p>
            </div>
          </div>
        </div>

        {/* Source Info */}
        <div className="p-3 bg-surface-highest/10 border border-outline/10 space-y-2">
          <div className="flex items-start gap-3">
            <Info size={14} className="text-outline mt-0.5" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold font-mono text-tertiary uppercase tracking-widest">Source Protocol</span>
              <span className="text-[11px] font-mono text-on-surface leading-tight">{metadata.source}</span>
            </div>
          </div>
          {metadata.validTime && (
            <div className="flex flex-col pl-6">
              <span className="text-[9px] font-mono text-outline uppercase tracking-tighter">Valid Until</span>
              <span className="text-[10px] font-mono text-on-surface-variant">
                {new Date(metadata.validTime).toUTCString().replace('GMT', 'UTC')}
              </span>
            </div>
          )}
          {metadata.iceCode && (
            <div className="flex flex-col pl-6 pt-1">
              <span className="text-[9px] font-mono text-outline uppercase tracking-tighter">Raw ICECODE</span>
              <span className="text-[10px] font-mono text-primary font-bold">{metadata.iceCode}</span>
            </div>
          )}
        </div>

        {/* Warning */}
        <div className="p-3 bg-error/5 border border-error/20 flex gap-3">
          <AlertTriangle size={14} className="text-error shrink-0 mt-0.5" />
          <p className="text-[9px] font-mono text-on-surface-variant leading-relaxed uppercase">
            Informational only — not certified navigation guidance. Intelligence Integrity: Procedural.
          </p>
        </div>
      </div>
    </motion.div>
  );
};
