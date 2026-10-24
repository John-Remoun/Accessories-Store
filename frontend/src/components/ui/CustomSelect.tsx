import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  searchable?: boolean;
  searchPlaceholder?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'اختر...',
  icon,
  disabled = false,
  className = '',
  triggerClassName = '',
  dropdownClassName = '',
  size = 'md',
  searchable = false,
  searchPlaceholder = 'بحث...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    if (isOpen && searchable) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
    }
  }, [isOpen, searchable]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) => {
      // Don't show default empty placeholder when actively filtering
      if (!opt.value) return false;
      const matchLabel = opt.label.toLowerCase().includes(q);
      const matchSublabel = opt.sublabel ? opt.sublabel.toLowerCase().includes(q) : false;
      return matchLabel || matchSublabel;
    });
  }, [options, searchQuery, searchable]);

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
    sm: 'h-9 text-xs px-2 rounded-xl',
    md: 'h-11 text-xs px-2.5 rounded-xl',
    lg: 'h-12 text-sm px-3.5 rounded-2xl',
  }[size];

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} dir="rtl">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        title={selectedOption ? `${selectedOption.label}${selectedOption.sublabel ? ` (${selectedOption.sublabel})` : ''}` : placeholder}
        className={`w-full flex items-center justify-between border border-border/80 bg-background text-foreground font-bold transition-all shadow-2xs hover:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${triggerClassName} ${
          isOpen ? 'border-amber-500 ring-2 ring-amber-500/20' : ''
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {(selectedOption?.icon || icon) && (
            <span className="shrink-0 text-amber-500">{selectedOption?.icon || icon}</span>
          )}
          {selectedOption ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="whitespace-nowrap font-bold text-xs truncate">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-[10px] text-muted-foreground opacity-80 font-normal shrink-0 whitespace-nowrap">
                  ({selectedOption.sublabel})
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground font-normal whitespace-nowrap truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-muted-foreground shrink-0 transition-transform duration-200 mr-auto ml-0.5 ${
            isOpen ? 'rotate-180 text-amber-500' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute z-[110] top-full mt-1.5 right-0 left-0 bg-card/98 backdrop-blur-xl border border-amber-500/30 rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 max-h-64 overflow-y-auto scrollbar-thin ${dropdownClassName}`}
        >
          {searchable && (
            <div className="sticky top-0 z-20 pb-1.5 pt-0.5 bg-card/98 backdrop-blur-xl border-b border-border/40">
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsOpen(false);
                    } else if (e.key === 'Enter' && filteredOptions.length > 0) {
                      e.preventDefault();
                      onChange(filteredOptions[0].value);
                      setIsOpen(false);
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full h-8 pr-8 pl-7 text-xs rounded-xl bg-muted/40 border border-border/80 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 text-foreground placeholder:text-muted-foreground"
                  onClick={(e) => e.stopPropagation()}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {filteredOptions.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">لا توجد نتائج مطابقة للبحث</div>
          ) : (
            filteredOptions.map((opt) => {
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
                  <div className="flex items-center gap-2 truncate min-w-0">
                    {opt.icon && (
                      <span className={`shrink-0 ${isSelected ? 'text-amber-500' : 'text-muted-foreground'}`}>
                        {opt.icon}
                      </span>
                    )}
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

