/**
 * SmokeLightningClone.jsx — VFX per Riflesso (terreno specchio).
 *
 * Flusso animazione:
 *   1. Fumo denso (grigio/viola) si accumula sulla posizione del bersaglio
 *   2. Fulmini violacei lampeggiano dentro il fumo (PointLight intermittenti)
 *   3. Il fumo si dirada lentamente
 *   4. Callback onComplete()
 *
 * Tutto controllato via GSAP timeline.
 */
import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { gsap } from 'gsap';
import * as THREE from 'three';
import { VFX_TIMING } from './vfxConstants';


/* ── Sistema Particellare Fumo ── */
function SmokeCloud({ position, phase }) {
  const ptsRef   = useRef();
  const COUNT    = 80;
  const alphaRef = useRef(0);

  const { positions, velocities, sizes } = useMemo(() => {
    const pos  = new Float32Array(COUNT * 3);
    const vel  = new Float32Array(COUNT * 3);
    const sz   = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      /* Posizione iniziale concentrata */
      pos[i * 3]     = (Math.random() - 0.5) * 0.1;
      pos[i * 3 + 1] = Math.random() * 0.2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
      /* Velocità di espansione lenta */
      vel[i * 3]     = (Math.random() - 0.5) * 0.3;
      vel[i * 3 + 1] = Math.random() * 0.15 + 0.05;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      sz[i] = 0.04 + Math.random() * 0.05;
    }
    return { positions: pos, velocities: vel, sizes: sz };
  }, []);

  /* Fade in durante buildup, fade out durante fade */
  useEffect(() => {
    if (phase === 'buildup') {
      gsap.to(alphaRef, { current: 0.7, duration: VFX_TIMING.SMOKE_BUILDUP_DUR, ease: 'power2.in' });
    } else if (phase === 'fade') {
      gsap.to(alphaRef, { current: 0.0, duration: VFX_TIMING.SMOKE_FADE_DUR, ease: 'power2.out' });
    }
  }, [phase]);

  useFrame((_, delta) => {
    const pts = ptsRef.current;
    if (!pts) return;
    const arr = pts.geometry.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3]     += velocities[i * 3]     * delta * 0.3;
      arr[i * 3 + 1] += velocities[i * 3 + 1] * delta * 0.2;
      arr[i * 3 + 2] += velocities[i * 3 + 2] * delta * 0.3;
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.material.opacity = alphaRef.current;
  });

  return (
    <points ref={ptsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#5a3d6b"
        size={0.06}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}


/* ── Fulmini (PointLight intermittenti viola) ── */
function LightningFlashes({ position, active }) {
  const light1 = useRef();
  const light2 = useRef();
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    if (!active || !light1.current || !light2.current) return;
    elapsedRef.current += delta * 1000;

    if (elapsedRef.current > VFX_TIMING.LIGHTNING_INTERVAL) {
      elapsedRef.current = 0;
      /* Flash casuale */
      const flash  = Math.random() > 0.3;
      light1.current.intensity = flash ? 3 + Math.random() * 4 : 0;
      light2.current.intensity = flash ? 2 + Math.random() * 3 : 0;
      /* Sposta leggermennente la posizione del flash */
      light1.current.position.x = (Math.random() - 0.5) * 0.3;
      light1.current.position.y = 0.2 + Math.random() * 0.3;
      light2.current.position.x = (Math.random() - 0.5) * 0.3;
      light2.current.position.z = (Math.random() - 0.5) * 0.2;
    }
  });

  return (
    <group position={position}>
      <pointLight ref={light1} color="#9b59b6" intensity={0} distance={2.5} decay={2} />
      <pointLight ref={light2} color="#bb77ff" intensity={0} distance={1.5} decay={2} />
    </group>
  );
}


/* ═══════ COMPONENTE PRINCIPALE ═══════ */
export default function SmokeLightningClone({
  targetPos,
  onComplete,
}) {
  const [phase, setPhase] = useState('buildup');   // buildup | hold | fade | done

  useEffect(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        setPhase('done');
        if (onComplete) onComplete();
      },
    });

    /* Fase 1: Buildup fumo */
    tl.call(() => setPhase('buildup'));
    tl.addPause(`+=${VFX_TIMING.SMOKE_BUILDUP_DUR}`);

    /* Fase 2: Hold (fulmini attivi) */
    tl.call(() => setPhase('hold'));
    tl.addPause(`+=${VFX_TIMING.SMOKE_HOLD_DUR}`);

    /* Fase 3: Fade-out */
    tl.call(() => setPhase('fade'));
    tl.addPause(`+=${VFX_TIMING.SMOKE_FADE_DUR}`);

    /* Forza completamento timeline */
    tl.play();

    return () => { tl.kill(); };
  }, [onComplete]);

  if (phase === 'done') return null;

  return (
    <group name="smoke-lightning-clone">
      <SmokeCloud position={targetPos} phase={phase} />
      <LightningFlashes
        position={targetPos}
        active={phase === 'buildup' || phase === 'hold'}
      />
    </group>
  );
}
