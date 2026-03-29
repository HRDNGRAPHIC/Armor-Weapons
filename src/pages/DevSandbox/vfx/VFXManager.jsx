/**
 * VFXManager.jsx — Orchestratore centrale VFX.
 *
 * Legge vfxQueue e environmentEffect dallo store Zustand.
 * Despaccia gli eventi ai componenti VFX figli appropriati:
 *   - TerrainFloater   → carta terreno fluttuante + effetti ambiente
 *   - SpellProjectile  → impatto fisico oggetti magici
 *   - BuffHolograms    → ologrammi ATK/DEF sui cavalieri
 *   - SmokeLightningClone → fumo + fulmini per Riflesso
 *   - SacrificeVFX     → esplosione mano + bagliore epico
 *
 * Montato come figlio diretto di <Scene> in GameBoard3D.jsx.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import useGameStore from '../useGameStore';
import { VFX_EVENTS } from './vfxConstants';
import TerrainFloater from './TerrainFloater';
import SpellProjectile from './SpellProjectile';
import SmokeLightningClone from './SmokeLightningClone';
import SacrificeVFX from './SacrificeVFX';


export default function VFXManager({ p1KnightRef, p2KnightRef, knightPositions }) {
  const {
    vfxQueue, consumeVfx, environmentEffect, activeTerrain,
    p1, p2, getStats,
  } = useGameStore();

  /* ── Stato locale effetti attivi ── */
  const [activeSpells, setActiveSpells]     = useState([]);
  const [activeClone, setActiveClone]       = useState(null);
  const [activeSacrifice, setActiveSacrifice] = useState(null);

  /* Statistiche con flag buff per ciascun giocatore */
  const p1Stats = getStats(1);
  const p2Stats = getStats(2);

  /* ── Processa eventi dalla coda VFX man mano che arrivano ── */
  const processedIds = useRef(new Set());
  useEffect(() => {
    if (vfxQueue.length === 0) return;
    const event = vfxQueue[0];
    if (processedIds.current.has(event.id)) return;
    processedIds.current.add(event.id);

    switch (event.type) {
      case VFX_EVENTS.SPELL_CAST:
        setActiveSpells(prev => [...prev, { ...event.payload, _key: event.id }]);
        break;

      case VFX_EVENTS.CLONE_INITIATED:
        setActiveClone({ ...event.payload, _key: event.id });
        break;

      case VFX_EVENTS.SACRIFICE_TRIGGERED:
        setActiveSacrifice({ ...event.payload, _key: event.id });
        break;

      case VFX_EVENTS.TERRAIN_ACTIVATED:
      case VFX_EVENTS.TERRAIN_EXPIRED:
      case VFX_EVENTS.BUFF_APPLIED:
        /* Questi sono gestiti reattivamente dallo stato (environmentEffect, getStats) */
        break;

      default:
        break;
    }

    consumeVfx();
  }, [vfxQueue, consumeVfx]);

  /* ── Callback per rimuovere effetti completati ── */
  const handleSpellComplete = useCallback((key) => {
    setActiveSpells(prev => prev.filter(s => s._key !== key));
  }, []);

  const handleCloneComplete = useCallback(() => {
    setActiveClone(null);
  }, []);

  const handleSacrificeComplete = useCallback(() => {
    setActiveSacrifice(null);
  }, []);

  return (
    <group name="vfx-manager">
      {/* ═══════ Terreno Fluttuante + Effetti Ambiente ═══════ */}
      <TerrainFloater
        activeTerrain={activeTerrain}
        environmentEffect={environmentEffect}
      />

      {/* ═══════ Proiettili Spell (Oggetti Magici) ═══════ */}
      {activeSpells.map(spell => (
        <SpellProjectile
          key={spell._key}
          spell={spell}
          startPos={knightPositions?.[`p${spell.playerNum}`] || [0, 0, 0]}
          targetPos={knightPositions?.[`p${spell.targetNum}`] || [0, 0, 0]}
          onComplete={() => handleSpellComplete(spell._key)}
        />
      ))}

      {/* ═══════ Riflesso Oscuro (Fumo + Fulmini + Clone) ═══════ */}
      {activeClone && (
        <SmokeLightningClone
          ownerNum={activeClone.ownerNum}
          targetNum={activeClone.targetNum}
          targetPos={knightPositions?.[`p${activeClone.targetNum}`] || [0, 0, 0]}
          ownerPos={knightPositions?.[`p${activeClone.ownerNum}`] || [0, 0, 0]}
          onComplete={handleCloneComplete}
        />
      )}

      {/* ═══════ Sacrificio (Esplosione Epica) ═══════ */}
      {activeSacrifice && (
        <SacrificeVFX
          playerNum={activeSacrifice.playerNum}
          destroyedSlots={activeSacrifice.destroyedSlots}
          knightPos={knightPositions?.[`p${activeSacrifice.playerNum}`] || [0, 0, 0]}
          knightRef={activeSacrifice.playerNum === 1 ? p1KnightRef : p2KnightRef}
          onComplete={handleSacrificeComplete}
        />
      )}
    </group>
  );
}
