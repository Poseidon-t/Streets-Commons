import { useState, useEffect, useRef } from 'react';
import { searchAddress } from '../../services/nominatim';
import { DEBOUNCE_MS } from '../../constants';
import type { Location } from '../../types';

interface AddressInputProps {
  onSelect: (location: Location) => void;
  placeholder?: string;
  keepValueOnSelect?: boolean; // If true, shows selected location name instead of clearing
}

export default function AddressInput({ onSelect, placeholder, keepValueOnSelect }: AddressInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSelected, setHasSelected] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const debounceTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!query.trim() || hasSelected) {
      setResults([]);
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const locations = await searchAddress(query);
        setResults(locations);
        setSearchedOnce(true);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, hasSelected]);

  const handleSelect = (location: Location) => {
    onSelect(location);
    if (keepValueOnSelect) {
      // Show selected location name in input
      setHasSelected(true);
      setQuery(location.displayName);
    } else {
      // Clear input (default behavior)
      setQuery('');
    }
    setResults([]);
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (hasSelected) setHasSelected(false);
          setSearchedOnce(false);
        }}
        placeholder={placeholder || "Enter any address..."}
        className="w-full px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-orange-500 transition-colors shadow-sm"
      />
      {isLoading && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {results.length > 0 && (
        <div
          role="listbox"
          data-testid="address-suggestions"
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
          style={{ top: '100%' }}
        >
          {results.map((location, index) => {
            const parts = location.displayName.split(', ');
            const primary = parts.slice(0, 2).join(', ');
            const secondary = parts.slice(2, 5).join(', ');
            return (
              <button
                key={index}
                role="option"
                aria-selected={false}
                onClick={() => handleSelect(location)}
                className="w-full px-4 py-2.5 text-left hover:bg-orange-50 transition-colors border-b last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-800 truncate">{primary}</div>
                {secondary && <div className="text-xs text-gray-400 truncate mt-0.5">{secondary}</div>}
              </button>
            );
          })}
        </div>
      )}

      {results.length === 0 && searchedOnce && query.trim().length > 2 && !isLoading && !hasSelected && (
        <div
          data-testid="search-no-results"
          className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl p-4 text-center text-sm"
          style={{ color: '#8a9a8a' }}
        >
          No results found. Try a more specific address.
        </div>
      )}
    </div>
  );
}
