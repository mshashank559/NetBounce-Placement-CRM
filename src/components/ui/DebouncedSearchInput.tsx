import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface DebouncedSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export const DebouncedSearchInput: React.FC<DebouncedSearchInputProps> = ({
  value: externalValue,
  onChange,
  placeholder = 'Search by name, phone, email...',
  className = '',
  debounceMs = 200,
}) => {
  const [localValue, setLocalValue] = useState(externalValue);

  // Sync internal state if external value changes (e.g., reset button)
  useEffect(() => {
    setLocalValue(externalValue);
  }, [externalValue]);

  // Debounce the call to onChange
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== externalValue) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [localValue, externalValue, onChange, debounceMs]);

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="pl-9"
      />
    </div>
  );
};

export default DebouncedSearchInput;
