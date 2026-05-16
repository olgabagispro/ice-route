import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { Calendar as CalendarIcon, X, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { DayPicker, DateRange } from 'react-day-picker';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  language?: 'en' | 'ru';
  labels?: {
    selectDateOrPeriod: string;
    selectDateOrPeriodUpper: string;
    singleDate: string;
    period: string;
  };
}

export function DateRangePicker({ startDate, endDate, onRangeChange, language = 'en', labels }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'single' | 'range'>(endDate ? 'range' : 'single');
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert string dates to Date objects
  const selectedRange: DateRange | undefined = {
    from: startDate ? new Date(startDate) : undefined,
    to: endDate ? new Date(endDate) : undefined,
  };

  const selectedDate: Date | undefined = startDate ? new Date(startDate) : undefined;
  const dateLocale = language === 'ru' ? ru : enUS;

  const handleSelectRange = (range: DateRange | undefined) => {
    if (range) {
      const startStr = range.from ? format(range.from, 'yyyy-MM-dd') : '';
      const endStr = range.to ? format(range.to, 'yyyy-MM-dd') : '';
      onRangeChange(startStr, endStr);
      
      // Auto-close if both dates are selected
      if (range.from && range.to) {
        setTimeout(() => setIsOpen(false), 300);
      }
    } else {
      onRangeChange('', '');
    }
  };

  const handleSelectSingle = (date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      onRangeChange(dateStr, '');
      // Auto-close in single mode
      setTimeout(() => setIsOpen(false), 200);
    } else {
      onRangeChange('', '');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const displayValue = () => {
    if (startDate && endDate) {
      return `${format(new Date(startDate), 'dd MMM yyyy', { locale: dateLocale })} — ${format(new Date(endDate), 'dd MMM yyyy', { locale: dateLocale })}`;
    } else if (startDate) {
      return format(new Date(startDate), 'dd MMM yyyy', { locale: dateLocale });
    }
    return labels?.selectDateOrPeriod || 'Select date or period...';
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative group">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full h-11 bg-background/50 border border-outline/30 px-3 flex items-center justify-between text-xs font-mono font-medium transition-all outline-none rounded-none",
            isOpen ? "border-primary ring-1 ring-primary/20" : "hover:border-outline/50 focus:border-primary focus:ring-1 focus:ring-primary/20",
            startDate ? "text-on-surface" : "text-outline"
          )}
        >
          {startDate ? (
            <span className="truncate">{displayValue()}</span>
          ) : (
            <span className="truncate text-outline text-[11px] font-medium">{labels?.selectDateOrPeriodUpper || 'Select Date or Period...'}</span>
          )}
          <div className="flex items-center gap-2 shrink-0">
            {startDate && (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  onRangeChange('', '');
                }}
                className="text-outline hover:text-error transition-colors p-1 cursor-pointer"
              >
                <X size={14} />
              </span>
            )}
            <CalendarIcon size={14} className={cn("text-outline", isOpen && "text-primary")} />
          </div>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-[100] mt-2 left-0 md:left-auto md:right-0 min-w-[270px] bg-[#0c141c] border border-outline/30 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_20px_rgba(0,229,255,0.05)] overflow-hidden rounded-none"
          >
            {/* Mode Switcher */}
            <div className="flex p-2 gap-2 border-b border-outline/10 bg-surface-lowest/50">
              <button
                onClick={() => {
                  setPickerMode('single');
                  if (endDate) onRangeChange(startDate, '');
                }}
                className={cn(
                  "flex-1 py-1.5 text-[10px] font-bold font-mono tracking-widest transition-all rounded-none",
                  pickerMode === 'single' 
                    ? "bg-primary text-background shadow-lg shadow-primary/30" 
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-highest/50"
                )}
              >
                {labels?.singleDate || 'SINGLE DATE'}
              </button>
              <button
                onClick={() => setPickerMode('range')}
                className={cn(
                  "flex-1 py-1.5 text-[10px] font-bold font-mono tracking-widest transition-all rounded-none flex items-center justify-center gap-2",
                  pickerMode === 'range' 
                    ? "bg-primary text-background shadow-lg shadow-primary/30" 
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-highest/50"
                )}
              >
                {pickerMode === 'range' && <ArrowRight size={10} />}
                {labels?.period || 'PERIOD'}
              </button>
            </div>

            <div className="p-4 pt-2">
              <style>{`
                .rdp {
                  --rdp-accent-color: #00E5FF;
                  --rdp-background-color: rgba(0, 229, 255, 0.15);
                  margin: 0;
                }
                .rdp-day_range_middle {
                  background-color: rgba(0, 229, 255, 0.25) !important;
                  color: #ffffff !important;
                  border-radius: 0 !important;
                }
              `}</style>
              <DayPicker
                mode={pickerMode as any}
                selected={(pickerMode === 'range' ? selectedRange : selectedDate) as any}
                onSelect={(pickerMode === 'range' ? handleSelectRange : handleSelectSingle) as any}
                locale={dateLocale}
                showOutsideDays
                className="p-0"
                classNames={{
                  months: "flex flex-col",
                  month: "space-y-1 relative",
                  month_caption: "flex justify-center items-center h-8 mb-2",
                  caption_label: "text-[11px] font-bold font-mono text-on-surface tracking-[0.1em] uppercase",
                  nav: "absolute top-0 left-0 right-0 flex items-center justify-between h-8 pointer-events-none px-0",
                  button_previous: "pointer-events-auto relative z-20 h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 flex items-center justify-center border border-outline/20 rounded-none transition-all hover:bg-surface-highest",
                  button_next: "pointer-events-auto relative z-20 h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 flex items-center justify-center border border-outline/20 rounded-none transition-all hover:bg-surface-highest",
                  month_grid: "w-full border-collapse",
                  weekdays: "flex mb-1",
                  weekday: "text-outline rounded-none w-9 font-bold text-[9px] uppercase tracking-wider text-center",
                  week: "flex w-full mt-0",
                  day: "h-9 w-9 p-0 font-mono text-[10px] font-medium rounded-none transition-colors hover:bg-primary/20 hover:text-primary flex items-center justify-center cursor-pointer relative",
                  day_button: "w-full h-full flex items-center justify-center",
                  range_start: "bg-primary text-background hover:bg-primary hover:text-background rounded-none",
                  range_end: "bg-primary text-background hover:bg-primary hover:text-background rounded-none",
                  selected: "bg-primary text-background hover:bg-primary hover:text-background focus:bg-primary",
                  today: "text-primary font-extrabold border border-primary/30 rounded-none",
                  outside: "text-on-surface opacity-25",
                  disabled: "text-outline/20 opacity-50 cursor-not-allowed",
                  range_middle: "aria-selected:bg-primary/20 aria-selected:text-primary rounded-none",
                  hidden: "invisible",
                }}
                components={{
                  Chevron: ({ orientation }) => (
                    orientation === 'left' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />
                  )
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
