import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'اختر...',
  disabled = false,
  className = '',
  triggerClassName = '',
  dropdownClassName = '',
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sizeClasses = {
    sm: 'h-9 text-xs px-2.5 rounded-xl',
    md: 'h-11 text-xs px-3.5 rounded-xl',
    lg: 'h-12 text-sm px-4 rounded-2xl',
  }[size];

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} dir="rtl">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between border border-border/80 bg-background text-foreground font-bold transition-all shadow-2xs hover:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${triggerClassName} ${
          isOpen ? 'border-amber-500 ring-2 ring-amber-500/20' : ''
        }`}
      >
        <span className="truncate">
          {selectedOption ? (
            <span className="flex items-center gap-1.5 truncate">
              <span>{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-[10px] text-muted-foreground opacity-80 font-normal">
                  ({selectedOption.sublabel})
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground font-normal">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`text-muted-foreground shrink-0 transition-transform duration-200 ml-1 ${
            isOpen ? 'rotate-180 text-amber-500' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute z-50 top-full mt-1.5 right-0 left-0 bg-card border border-border/90 rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 max-h-60 overflow-y-auto ${dropdownClassName}`}
        >
          {options.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">لا توجد خيارات</div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-right p-2.5 rounded-xl text-xs flex items-center justify-between transition-all font-bold disabled:opacity-40 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30 shadow-2xs'
                      : 'hover:bg-muted/60 text-foreground hover:text-amber-500'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check size={14} className="text-amber-500 shrink-0 mr-1" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
