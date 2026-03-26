/**
 * LoadingCoin.jsx — Moneta 3D rotante come intro per /dev-game.
 *
 * Timeline GSAP: rotazione veloce → pausa faccia A → rotazione veloce → pausa faccia B → dissolvenza.
 * Durata totale: esattamente 6 secondi.
 */
import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';

/* ── Coin geometry ── */
const COIN_RADIUS  = 1.2;
const COIN_HEIGHT  = 0.08;
const COIN_SEGMENTS = 48;

/* ── Colors ── */
const GOLD_MAIN   = '#b8860b';  // oro scuro brunito
const GOLD_RIM    = '#8b6914';  // bordo oro invecchiato/arrugginito
const GOLD_FACE   = '#daa520';  // riflesso oro

export default function LoadingCoin({ onComplete }) {
  const groupRef = useRef();
  const matRef   = useRef();

  useEffect(() => {
    const g = groupRef.current;
    const mat = matRef.current;
    if (!g || !mat) return;

    /* Reset */
    g.rotation.set(0, 0, 0);
    mat.opacity = 1;

    const tl = gsap.timeline({
      onComplete: () => onComplete?.(),
    });

    /* Fase 1: rotazione veloce (0 → 1.2s) — ~3 giri completi */
    tl.to(g.rotation, {
      y: Math.PI * 6,
      duration: 1.2,
      ease: 'power2.inOut',
    });

    /* Fase 2: pausa drammatica sulla faccia A (1.2 → 3.2s) */
    tl.to(g.rotation, {
      y: Math.PI * 6,       // mantieni posizione
      duration: 2.0,
    });

    /* Fase 3: rotazione veloce di nuovo (3.2 → 4.0s) — 2 giri per girare lato */
    tl.to(g.rotation, {
      y: Math.PI * 6 + Math.PI * 3, // atterra sulla faccia opposta
      duration: 0.8,
      ease: 'power2.inOut',
    });

    /* Fase 4: pausa drammatica sulla faccia B (4.0 → 5.2s) */
    tl.to(g.rotation, {
      y: Math.PI * 6 + Math.PI * 3,
      duration: 1.2,
    });

    /* Fase 5: dissolvenza + zoom (5.2 → 6.0s) */
    tl.to(g.scale, {
      x: 0.01, y: 0.01, z: 0.01,
      duration: 0.8,
      ease: 'power3.in',
    });
    tl.to(mat, {
      opacity: 0,
      duration: 0.8,
      ease: 'power2.in',
    }, '<');

    return () => { tl.kill(); };
  }, [onComplete]);

  return (
    <group ref={groupRef}>
      {/* Corpo principale della moneta */}
      <mesh castShadow>
        <cylinderGeometry args={[COIN_RADIUS, COIN_RADIUS, COIN_HEIGHT, COIN_SEGMENTS]} />
        <meshStandardMaterial
          ref={matRef}
          color={GOLD_MAIN}
          roughness={0.45}
          metalness={0.85}
          transparent
        />
      </mesh>

      {/* Faccia A — simbolo picca in rilievo */}
      <mesh position={[0, COIN_HEIGHT / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[COIN_RADIUS * 0.85, COIN_SEGMENTS]} />
        <meshStandardMaterial
          color={GOLD_FACE}
          roughness={0.3}
          metalness={0.9}
          transparent
        />
      </mesh>

      {/* Faccia B — scudo in rilievo */}
      <mesh position={[0, -COIN_HEIGHT / 2 - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[COIN_RADIUS * 0.85, COIN_SEGMENTS]} />
        <meshStandardMaterial
          color={GOLD_FACE}
          roughness={0.3}
          metalness={0.9}
          transparent
        />
      </mesh>

      {/* Anello di riflesso sul bordo */}
      <mesh>
        <torusGeometry args={[COIN_RADIUS, COIN_HEIGHT * 0.35, 8, COIN_SEGMENTS]} />
        <meshStandardMaterial
          color={GOLD_RIM}
          roughness={0.6}
          metalness={0.7}
          transparent
        />
      </mesh>
    </group>
  );
}
