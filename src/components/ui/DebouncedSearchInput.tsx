import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';

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
  debounceMs = 350,
}) => {
  const [localValue, setLocalValue] = useState(externalValue || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const isTypingRef = useRef(false);

  // Sync internal state only if external value changed from outside and user is not actively typing
  useEffect(() => {
    if (!isTypingRef.current && externalValue !== localValue) {
      setLocalValue(externalValue || '');
    }
  }, [externalValue]);

  // Debounce the call to onChange
  useEffect(() => {
    const handler = setTimeout(() => {
      isTypingRef.current = false;
      if (localValue !== externalValue) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [localValue, externalValue, onChange, debounceMs]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isTypingRef.current = true;
    setLocalValue(e.target.value);
  };

  const handleClear = () => {
    isTypingRef.current = false;
    setLocalValue('');
    onChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      isTypingRef.current = false;
      onChange(localValue);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="pl-9 pr-8"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
          title="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default DebouncedSearchInput;

