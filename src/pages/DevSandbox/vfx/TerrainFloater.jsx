/**
 * TerrainFloater.jsx — Carta terreno fluttuante + effetti ambiente globali.
 *
 * Quando un terreno è attivo:
 *   1. Una mini-carta 3D vola nell'angolo in alto a sinistra dello screen space
 *      e fluttua morbidamente (GSAP yoyo).
 *   2. Effetti ambiente condizionali:
 *      - RAIN:   particelle che cadono dall'alto (Sparkles con gravità negativa)
 *      - SLEEP:  scurisce la scena del 40% (luci ambientali ridotte)
 *      - QUAKE:  shake subtile (gruppo globale oscillante)
 *      - CHAINS: tinta scura (nessun particellare, solo atmosfera)
 *      - MIRROR: riflesso ambientale (nessun extra visivo sul terreno)
 */
import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { gsap } from 'gsap';
import * as THREE from 'three';
import { VFX_TIMING } from './vfxConstants';


/* ── Particelle Pioggia — punti che cadono dall'alto ── */
function RainParticles() {
  const ptsRef = useRef();
  const COUNT  = 200;

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 16;   // X: larghezza tavolo
      pos[i * 3 + 1] = Math.random() * 6 + 2;         // Y: altezza iniziale
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;   // Z: profondità tavolo
      vel[i] = 2.0 + Math.random() * 3.0;             // velocità caduta
    }
    return { positions: pos, velocities: vel };
  }, []);

  useFrame((_, delta) => {
    const pts = ptsRef.current;
    if (!pts) return;
    const arr = pts.geometry.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] -= velocities[i] * delta;
      if (arr[i * 3 + 1] < -0.5) {
        arr[i * 3 + 1] = 6 + Math.random() * 2;
        arr[i * 3]     = (Math.random() - 0.5) * 16;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 10;
      }
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ptsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#88ccff" size={0.03} transparent opacity={0.5}
        depthWrite={false} blending={THREE.AdditiveBlending}
      />
    </points>
  );
}


/* ── Shake Terremoto — oscillazione continua su un gruppo ── */
function QuakeShake({ children }) {
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.position.x = Math.sin(t * 15) * 0.015;
    groupRef.current.position.z = Math.cos(t * 12) * 0.01;
  });

  return <group ref={groupRef}>{children}</group>;
}


/* ── Effetto Sonno — riduce intensità luci via useFrame ── */
function SleepDarkness() {
  const { scene } = useThree();
  const origIntensities = useRef(null);

  useEffect(() => {
    /* Salva le intensità originali e diminuisci del 40% */
    const lights = [];
    scene.traverse((child) => {
      if (child.isLight && !child.userData._vfxIgnore) {
        lights.push({ light: child, orig: child.intensity });
      }
    });
    origIntensities.current = lights;
    lights.forEach(l => {
      gsap.to(l.light, { intensity: l.orig * 0.6, duration: 1.2, ease: 'power2.inOut' });
    });

    return () => {
      /* Ripristina alla smontatura */
      lights.forEach(l => {
        gsap.to(l.light, { intensity: l.orig, duration: 0.8, ease: 'power2.inOut' });
      });
    };
  }, [scene]);

  return null;
}


/* ── Carta Terreno Fluttuante (angolo in alto a sinistra) ── */
function FloatingTerrainCard({ terrainCard }) {
  const groupRef = useRef();
  const matRef   = useRef();

  /* Posizione fissa nell'angolo superiore sinistro del tavolo (world space) */
  const floatPos = useMemo(() => [-6.5, 2.5, -3.5], []);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;

    /* Appari con fade-in + volo dalla posizione centrale */
    g.position.set(0, 4, 0);
    g.scale.setScalar(0.01);

    const tl = gsap.timeline();
    /* Volo verso l'angolo */
    tl.to(g.position, {
      x: floatPos[0], y: floatPos[1], z: floatPos[2],
      duration: VFX_TIMING.TERRAIN_FLY_DUR, ease: 'power2.out',
    });
    tl.to(g.scale, {
      x: 0.8, y: 0.8, z: 0.8,
      duration: VFX_TIMING.TERRAIN_FLY_DUR, ease: 'power2.out',
    }, 0);

    /* Fluttuazione continua (yoyo) */
    tl.to(g.position, {
      y: floatPos[1] + VFX_TIMING.TERRAIN_FLOAT_AMP,
      duration: VFX_TIMING.TERRAIN_FLOAT_DUR,
      ease: 'sine.inOut', yoyo: true, repeat: -1,
    });

    return () => { tl.kill(); };
  }, [floatPos]);

  /* Rotazione lenta costante */
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  /* Colore bordo in base al terreno */
  const borderColor = '#9b59b6';

  return (
    <group ref={groupRef}>
      {/* Corpo carta semplificato */}
      <mesh castShadow>
        <boxGeometry args={[0.7, 1.0, 0.02]} />
        <meshStandardMaterial
          ref={matRef}
          color="#1a0033"
          emissive="#4a1a6b"
          emissiveIntensity={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Bordo */}
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[0.74, 1.04, 0.012]} />
        <meshStandardMaterial color={borderColor} emissive={borderColor} emissiveIntensity={0.2} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}


/* ═══════ COMPONENTE PRINCIPALE ═══════ */
export default function TerrainFloater({ activeTerrain, environmentEffect }) {
  return (
    <group name="terrain-floater">
      {/* Effetti ambiente condizionali — la carta terreno è gestita da TerrainDisplayCard in GameBoard3D */}
      {environmentEffect === 'RAIN' && <RainParticles />}
      {environmentEffect === 'SLEEP' && <SleepDarkness />}
      {environmentEffect === 'QUAKE' && <QuakeShake><></></QuakeShake>}
    </group>
  );
}
