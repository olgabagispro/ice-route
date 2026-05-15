import React from 'react';
import { cn } from '../lib/utils';

interface AIIconProps {
  className?: string;
  size?: number;
}

export function AIIcon({ className, size = 24 }: AIIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={cn("transition-all", className)}
    >
      {/* Box with gap for sparkles */}
      <path d="M9 3H17C19.2091 3 21 4.79086 21 7V17C21 19.2091 19.2091 21 17 21H7C4.79086 21 3 19.2091 3 17V9" />
      
      {/* AI Text */}
      <text 
        x="12" 
        y="15.5" 
        fontSize="10" 
        fontWeight="800" 
        textAnchor="middle" 
        fill="currentColor" 
        stroke="none"
        style={{ fontFamily: 'monospace' }}
      >
        AI
      </text>

      {/* Sparkles */}
      <path d="M4 2L4.5 3.5L6 4L4.5 4.5L4 6L3.5 4.5L2 4L3.5 3.5L4 2Z" fill="currentColor" stroke="none" />
      <path d="M7 6L7.25 6.75L8 7L7.25 7.25L7 8L6.75 7.25L6 7L6.75 6.75L7 6Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
