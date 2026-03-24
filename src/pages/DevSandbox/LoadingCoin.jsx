/**
 * LoadingCoin.jsx — 3D spinning coin intro for /dev-game.
 *
 * GSAP timeline: fast spin → pause face A → fast spin → pause face B → fade out.
 * Total duration: exactly 6 seconds.
 */
import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';

/* ── Coin geometry ── */
const COIN_RADIUS  = 1.2;
const COIN_HEIGHT  = 0.08;
const COIN_SEGMENTS = 48;

/* ── Colors ── */
const GOLD_MAIN   = '#b8860b';  // dark goldenrod
const GOLD_RIM    = '#8b6914';  // aged/rusted gold edge
const GOLD_FACE   = '#daa520';  // goldenrod highlight

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

    /* Phase 1: fast spin (0 → 1.2s) — ~3 full rotations */
    tl.to(g.rotation, {
      y: Math.PI * 6,
      duration: 1.2,
      ease: 'power2.inOut',
    });

    /* Phase 2: dramatic pause on face A (1.2 → 3.2s) */
    tl.to(g.rotation, {
      y: Math.PI * 6,       // hold position
      duration: 2.0,
    });

    /* Phase 3: fast spin again (3.2 → 4.0s) — 2 rotations to flip side */
    tl.to(g.rotation, {
      y: Math.PI * 6 + Math.PI * 3, // land on opposite face
      duration: 0.8,
      ease: 'power2.inOut',
    });

    /* Phase 4: dramatic pause on face B (4.0 → 5.2s) */
    tl.to(g.rotation, {
      y: Math.PI * 6 + Math.PI * 3,
      duration: 1.2,
    });

    /* Phase 5: fade out + zoom (5.2 → 6.0s) */
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
      {/* Main coin body */}
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

      {/* Face A — embossed spade symbol */}
      <mesh position={[0, COIN_HEIGHT / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[COIN_RADIUS * 0.85, COIN_SEGMENTS]} />
        <meshStandardMaterial
          color={GOLD_FACE}
          roughness={0.3}
          metalness={0.9}
          transparent
        />
      </mesh>

      {/* Face B — embossed shield */}
      <mesh position={[0, -COIN_HEIGHT / 2 - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[COIN_RADIUS * 0.85, COIN_SEGMENTS]} />
        <meshStandardMaterial
          color={GOLD_FACE}
          roughness={0.3}
          metalness={0.9}
          transparent
        />
      </mesh>

      {/* Rim highlight ring */}
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
