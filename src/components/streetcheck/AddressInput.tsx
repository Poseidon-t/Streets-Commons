import { useState, useEffect, useRef } from 'react';
import { searchAddress } from '../../services/nominatim';
import { googleAutocomplete, googlePlaceDetails } from '../../services/googlePlaces';
import type { PlaceSuggestion } from '../../services/googlePlaces';
import { DEBOUNCE_MS } from '../../constants';
import type { Location } from '../../types';

interface AddressInputProps {
  onSelect: (location: Location) => void;
  placeholder?: string;
  keepValueOnSelect?: boolean;
}

type Suggestion =
  | { source: 'nominatim'; location: Location }
  | { source: 'google'; suggestion: PlaceSuggestion };

export default function AddressInput({ onSelect, placeholder, keepValueOnSelect }: AddressInputProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSelected, setHasSelected] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const debounceTimer = useRef<number | null>(null);
  // Track whether Google is available (set to false on first 501 response)
  const googleAvailable = useRef(true);

  useEffect(() => {
    if (!query.trim() || hasSelected) {
      setSuggestions([]);
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        // Try Google Places first if available
        if (googleAvailable.current) {
          try {
            const googleResults = await googleAutocomplete(query);
            if (googleResults.length > 0) {
              setSuggestions(googleResults.map(s => ({ source: 'google' as const, suggestion: s })));
              setSearchedOnce(true);
              return;
            }
          } catch {
            // Google failed — disable for rest of session and fall through
            googleAvailable.current = false;
          }
        }

        // Fallback to Nominatim
        const locations = await searchAddress(query);
        setSuggestions(locations.map(l => ({ source: 'nominatim' as const, location: l })));
        setSearchedOnce(true);
      } catch (error) {
        console.error('Search failed:', error);
        setSuggestions([]);
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

  const handleSelect = async (suggestion: Suggestion) => {
    if (suggestion.source === 'nominatim') {
      finishSelect(suggestion.location);
      return;
    }

    // Google suggestion — resolve placeId to lat/lon
    setIsLoading(true);
    setSuggestions([]);
    try {
      const location = await googlePlaceDetails(suggestion.suggestion.placeId);
      if (location) {
        finishSelect(location);
      } else {
        // Place Details failed — fall back to Nominatim search with the description
        const fallback = await searchAddress(suggestion.suggestion.description);
        if (fallback.length > 0) {
          finishSelect(fallback[0]);
        }
      }
    } catch {
      // Last resort — Nominatim
      const fallback = await searchAddress(suggestion.suggestion.description);
      if (fallback.length > 0) {
        finishSelect(fallback[0]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const finishSelect = (location: Location) => {
    onSelect(location);
    if (keepValueOnSelect) {
      setHasSelected(true);
      setQuery(location.displayName);
    } else {
      setQuery('');
    }
    setSuggestions([]);
  };

  const getDisplayText = (suggestion: Suggestion) => {
    if (suggestion.source === 'nominatim') {
      const parts = suggestion.location.displayName.split(', ');
      return {
        primary: parts.slice(0, 2).join(', '),
        secondary: parts.slice(2, 5).join(', '),
      };
    }
    return {
      primary: suggestion.suggestion.primaryText,
      secondary: suggestion.suggestion.secondaryText,
    };
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

      {suggestions.length > 0 && (
        <div
          role="listbox"
          data-testid="address-suggestions"
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
          style={{ top: '100%' }}
        >
          {suggestions.map((suggestion, index) => {
            const { primary, secondary } = getDisplayText(suggestion);
            return (
              <button
                key={index}
                role="option"
                aria-selected={false}
                onClick={() => handleSelect(suggestion)}
                className="w-full px-4 py-2.5 text-left hover:bg-orange-50 transition-colors border-b last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-800 truncate">{primary}</div>
                {secondary && <div className="text-xs text-gray-400 truncate mt-0.5">{secondary}</div>}
              </button>
            );
          })}
        </div>
      )}

      {suggestions.length === 0 && searchedOnce && query.trim().length > 2 && !isLoading && !hasSelected && (
        <div
          data-testid="search-no-results"
          className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl p-4 text-center text-sm"
          style={{ color: '#5a6a5a' }}
        >
          No results found. Try a more specific address.
        </div>
      )}
    </div>
  );
}
