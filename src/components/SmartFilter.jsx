import { useState, useRef, useEffect } from 'react';

/**
 * SmartFilter — Dropdown multi-select filter for type and/or rarity.
 * @param {Object} props
 * @param {Object} [props.typeOptions] — e.g. { knight: 'Cavalieri', weapon: 'Armi', ... }
 * @param {Array}  [props.rarityOptions] — e.g. [{ id: 'comune', label: 'Comune', color: '#8a8a9a' }, ...]
 * @param {Set}    props.selectedTypes — currently selected type keys
 * @param {Set}    props.selectedRarities — currently selected rarity ids
 * @param {(types: Set, rarities: Set) => void} props.onChange
 */
export default function SmartFilter({
  typeOptions,
  rarityOptions,
  selectedTypes,
  selectedRarities,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasTypes = typeOptions && Object.keys(typeOptions).length > 0;
  const hasRarities = rarityOptions && rarityOptions.length > 0;
  const activeCount = (selectedTypes?.size ?? 0) + (selectedRarities?.size ?? 0);

  function toggleType(key) {
    const next = new Set(selectedTypes);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next, new Set(selectedRarities));
  }

  function toggleRarity(id) {
    const next = new Set(selectedRarities);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(new Set(selectedTypes), next);
  }

  function clearAll() {
    onChange(new Set(), new Set());
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
          ${activeCount > 0
            ? 'border-fantasy-gold text-fantasy-gold bg-fantasy-gold/10'
            : 'border-fantasy-border text-fantasy-silver hover:text-white hover:bg-white/5'
          }`}
      >
        Filtri{activeCount > 0 && ` (${activeCount})`}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 left-0 min-w-[220px] bg-fantasy-card border border-fantasy-border rounded-xl shadow-2xl p-4 space-y-3">
          {/* Type filters */}
          {hasTypes && (
            <div>
              <p className="text-fantasy-silver text-xs font-bold mb-2 uppercase tracking-wider">Tipo</p>
              <div className="space-y-1">
                {Object.entries(typeOptions).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedTypes.has(key)}
                      onChange={() => toggleType(key)}
                      className="accent-[#c9a84c] w-3.5 h-3.5"
                    />
                    <span className="text-sm text-fantasy-silver group-hover:text-white transition">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Rarity filters */}
          {hasRarities && (
            <div>
              <p className="text-fantasy-silver text-xs font-bold mb-2 uppercase tracking-wider">Rarità</p>
              <div className="space-y-1">
                {rarityOptions.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedRarities.has(r.id)}
                      onChange={() => toggleRarity(r.id)}
                      className="accent-[#c9a84c] w-3.5 h-3.5"
                    />
                    <span className="text-sm transition" style={{ color: r.color }}>
                      {r.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Clear button */}
          {activeCount > 0 && (
            <button
              onClick={clearAll}
              className="w-full text-center text-xs text-fantasy-red hover:text-red-400 transition pt-1"
            >
              Rimuovi filtri
            </button>
          )}
        </div>
      )}
    </div>
  );
}
