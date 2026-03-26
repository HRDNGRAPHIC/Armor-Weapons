/**
 * SacrificeVFX.jsx — Effetto visivo per la carta Sacrificio.
 *
 * Flusso animazione:
 *   1. Le carte della mano si frantumano in frammenti 3D (debris physics)
 *   2. Il Cavaliere si illumina con un bagliore epico (emissive intenso)
 *   3. Scintille di evaporazione lungo i bordi del cavaliere
 *   4. Fade-out e callback onComplete()
 */
import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { gsap } from 'gsap';
import * as THREE from 'three';
import { VFX_TIMING } from './vfxConstants';


/* ── Frammenti Debris (carte distrutte) ── */
function DebrisExplosion({ knightPos, onComplete }) {
  const groupRef   = useRef();
  const COUNT      = 24;

  const fragments = useMemo(() => {
    const list = [];
    for (let i = 0; i < COUNT; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const speed  = 1.5 + Math.random() * 3;
      const ySpeed = 1 + Math.random() * 2;
      list.push({
        position: new THREE.Vector3(
          knightPos[0] + (Math.random() - 0.5) * 0.4,
          knightPos[1] + 0.2 + Math.random() * 0.3,
          knightPos[2] + (Math.random() - 0.5) * 0.3,
        ),
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          ySpeed,
          Math.sin(angle) * speed,
        ),
        rotation: new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        ),
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
        ),
        scale: 0.02 + Math.random() * 0.03,
      });
    }
    return list;
  }, [knightPos]);

  const elapsedRef  = useRef(0);
  const opacityRef  = useRef(1);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    elapsedRef.current += delta;

    const t = Math.min(elapsedRef.current / VFX_TIMING.SACRIFICE_SHATTER_DUR, 1.0);
    opacityRef.current = 1.0 - t * 0.8;

    g.children.forEach((mesh, idx) => {
      const frag = fragments[idx];
      if (!frag || !mesh.isMesh) return;
      /* Gravità */
      frag.velocity.y -= 6 * delta;
      mesh.position.addScaledVector(frag.velocity, delta);
      mesh.rotation.x += frag.rotSpeed.x * delta;
      mesh.rotation.y += frag.rotSpeed.y * delta;
      mesh.rotation.z += frag.rotSpeed.z * delta;
      mesh.material.opacity = opacityRef.current;
    });

    if (t >= 1.0 && onComplete) onComplete();
  });

  return (
    <group ref={groupRef}>
      {fragments.map((frag, i) => (
        <mesh key={i} position={frag.position} rotation={frag.rotation} scale={frag.scale}>
          <boxGeometry args={[1, 1.4, 0.1]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#2a1a0a' : '#44220a'}
            emissive="#ff4400"
            emissiveIntensity={0.4}
            transparent
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}


/* ── Bagliore Epico sul Cavaliere ── */
function EpicGlow({ knightPos }) {
  const lightRef  = useRef();
  const sphereRef = useRef();
  const proxy     = useRef({ intensity: 0, scale: 0 });

  useEffect(() => {
    const tl = gsap.timeline();
    tl.to(proxy.current, {
      intensity: 5, scale: 0.6,
      duration: VFX_TIMING.SACRIFICE_GLOW_DUR * 0.4,
      ease: 'power2.in',
    });
    tl.to(proxy.current, {
      intensity: 0, scale: 0,
      duration: VFX_TIMING.SACRIFICE_GLOW_DUR * 0.6,
      ease: 'power2.out',
    });
    return () => tl.kill();
  }, []);

  useFrame(() => {
    if (lightRef.current) {
      lightRef.current.intensity = proxy.current.intensity;
    }
    if (sphereRef.current) {
      const s = proxy.current.scale;
      sphereRef.current.scale.set(s, s, s);
      sphereRef.current.material.opacity = proxy.current.intensity / 5 * 0.3;
    }
  });

  return (
    <group position={knightPos}>
      <pointLight
        ref={lightRef}
        color="#ff6600"
        intensity={0}
        distance={4}
        decay={2}
      />
      <mesh ref={sphereRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color="#ff4400"
          emissive="#ff2200"
          emissiveIntensity={1.5}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}


/* ── Scintille Evaporazione Bordo ── */
function EdgeSparkles({ knightPos }) {
  const ptsRef  = useRef();
  const COUNT   = 40;

  const { positions, velocities, lifetimes } = useMemo(() => {
    const pos  = new Float32Array(COUNT * 3);
    const vel  = new Float32Array(COUNT * 3);
    const life = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      /* Posizionati lungo i bordi della carta (rettangolo) */
      const side = Math.floor(Math.random() * 4);
      const t    = Math.random() * 2 - 1;
      const hw   = 0.35;  // metà larghezza
      const hh   = 0.5;   // metà altezza
      switch (side) {
        case 0: pos[i*3] =  hw; pos[i*3+1] = t * hh; break;  // destra
        case 1: pos[i*3] = -hw; pos[i*3+1] = t * hh; break;  // sinistra
        case 2: pos[i*3] = t * hw; pos[i*3+1] =  hh; break;  // alto
        case 3: pos[i*3] = t * hw; pos[i*3+1] = -hh; break;  // basso
      }
      pos[i*3+2] = 0;
      vel[i*3]   = (Math.random() - 0.5) * 0.5;
      vel[i*3+1] = 0.3 + Math.random() * 0.5;
      vel[i*3+2] = (Math.random() - 0.5) * 0.3;
      life[i]    = Math.random();
    }
    return { positions: pos, velocities: vel, lifetimes: life };
  }, []);

  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    const pts = ptsRef.current;
    if (!pts) return;
    elapsedRef.current += delta;
    const globalFade = Math.max(0, 1 - elapsedRef.current / VFX_TIMING.SACRIFICE_EDGE_DUR);

    const arr = pts.geometry.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      lifetimes[i] += delta * 0.6;
      arr[i*3]   += velocities[i*3]   * delta;
      arr[i*3+1] += velocities[i*3+1] * delta;
      arr[i*3+2] += velocities[i*3+2] * delta;
      if (lifetimes[i] > 1.5) {
        lifetimes[i] = 0;
        arr[i*3]   = (Math.random() - 0.5) * 0.7;
        arr[i*3+1] = (Math.random() - 0.5) * 1.0;
        arr[i*3+2] = 0;
      }
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.material.opacity = globalFade * 0.8;
  });

  return (
    <points ref={ptsRef} position={knightPos}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.02}
        transparent
        opacity={0.8}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}


/* ═══════ COMPONENTE PRINCIPALE ═══════ */
export default function SacrificeVFX({ knightPos, onComplete }) {
  const [phase, setPhase] = useState('shatter');   // shatter | glow | sparkle | done

  useEffect(() => {
    const timeouts = [];
    timeouts.push(setTimeout(() => setPhase('glow'), VFX_TIMING.SACRIFICE_SHATTER_DUR * 1000));
    timeouts.push(setTimeout(() => setPhase('sparkle'),
      (VFX_TIMING.SACRIFICE_SHATTER_DUR + VFX_TIMING.SACRIFICE_GLOW_DUR) * 1000));
    timeouts.push(setTimeout(() => {
      setPhase('done');
      if (onComplete) onComplete();
    }, (VFX_TIMING.SACRIFICE_SHATTER_DUR + VFX_TIMING.SACRIFICE_GLOW_DUR + VFX_TIMING.SACRIFICE_EDGE_DUR) * 1000));

    return () => timeouts.forEach(clearTimeout);
  }, [onComplete]);

  if (phase === 'done') return null;

  return (
    <group name="sacrifice-vfx">
      {/* Frammenti debris */}
      {phase === 'shatter' && (
        <DebrisExplosion knightPos={knightPos} onComplete={() => {}} />
      )}

      {/* Bagliore epico */}
      {(phase === 'glow' || phase === 'sparkle') && (
        <EpicGlow knightPos={knightPos} />
      )}

      {/* Scintille di evaporazione */}
      {phase === 'sparkle' && (
        <EdgeSparkles knightPos={knightPos} />
      )}
    </group>
  );
}
