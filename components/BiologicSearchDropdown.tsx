'use client';

import { useState, useMemo } from 'react';
import { getBiologicOptions } from '@/lib/biologics-data';

interface BiologicSearchDropdownProps {
  selectedBiologics: string[];
  onAdd: (drugName: string) => void;
  placeholder?: string;
  label?: string;
}

export default function BiologicSearchDropdown({
  selectedBiologics,
  onAdd,
  placeholder = 'Type to search biologics...',
  label = 'Select a biologic',
}: BiologicSearchDropdownProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const biologicOptions = useMemo(() => getBiologicOptions(), []);

  // Filter options based on search term and exclude already selected
  const filteredOptions = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return biologicOptions
      .filter(opt => !selectedBiologics.includes(opt.value))
      .filter(opt =>
        !searchTerm ||
        opt.label.toLowerCase().includes(term) ||
        opt.value.toLowerCase().includes(term) ||
        opt.generic.toLowerCase().includes(term)
      );
  }, [searchTerm, biologicOptions, selectedBiologics]);

  const handleBiologicSelect = (drugName: string) => {
    onAdd(drugName);
    setSearchTerm('');
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type="text"
          className="input w-full pr-8"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => {
            // Delay to allow click on dropdown item
            setTimeout(() => setShowDropdown(false), 200);
          }}
          placeholder={placeholder}
          autoComplete="off"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-primary-500 rounded-lg shadow-xl max-h-80 overflow-auto">
          <div className="py-1">
            {filteredOptions.slice(0, 20).map((option) => (
              <button
                key={option.value}
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-primary-50 focus:bg-primary-50 focus:outline-none border-b border-gray-100 last:border-b-0 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent input blur
                  handleBiologicSelect(option.value);
                }}
              >
                <div className="font-semibold text-gray-900">{option.value}</div>
                <div className="text-sm text-gray-600">{option.generic}</div>
              </button>
            ))}
            {filteredOptions.length > 20 && (
              <div className="px-4 py-2 text-xs text-gray-500 text-center bg-gray-50">
                Showing 20 of {filteredOptions.length} results
              </div>
            )}
          </div>
        </div>
      )}

      {searchTerm && filteredOptions.length === 0 && showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-yellow-400 rounded-lg shadow-xl p-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>No biologics found matching &quot;{searchTerm}&quot;</span>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-1">
        {filteredOptions.length} biologic{filteredOptions.length !== 1 ? 's' : ''} available
      </p>
    </div>
  );
}
