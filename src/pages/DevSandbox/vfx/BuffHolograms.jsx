/**
 * BuffHolograms.jsx — Ologrammi ATK (spada) e DEF (scudo) sui Cavalieri.
 *
 * Quando isAtkBuffed è true → spada olografica rossa/fuoco con rotazione
 * Quando isDefBuffed è true → scudo olografico blu/energia con pulsazione
 *
 * Ogni ologramma ha:
 *   - Geometria 3D semi-trasparente (ConeGeometry spada, CircleGeometry scudo)
 *   - Rotazione continua useFrame
 *   - Particelle ambientali (fuoco per ATK, energia per DEF)
 *   - Emissive glow intenso
 */
import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { gsap } from 'gsap';
import * as THREE from 'three';
import { VFX_TIMING } from './vfxConstants';


/* ── Particelle Fuoco (ATK) — punti che salgono e svaniscono ── */
function FireParticles({ basePos }) {
  const ptsRef = useRef();
  const COUNT  = 30;

  const { positions, velocities, lifetimes } = useMemo(() => {
    const pos   = new Float32Array(COUNT * 3);
    const vel   = new Float32Array(COUNT);
    const life  = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 0.15;
      pos[i * 3 + 1] = Math.random() * 0.3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
      vel[i]  = 0.3 + Math.random() * 0.5;
      life[i] = Math.random();
    }
    return { positions: pos, velocities: vel, lifetimes: life };
  }, []);

  useFrame((_, delta) => {
    const pts = ptsRef.current;
    if (!pts) return;
    const arr = pts.geometry.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      lifetimes[i] += delta * 0.8;
      arr[i * 3 + 1] += velocities[i] * delta;
      if (lifetimes[i] > 1.0) {
        lifetimes[i] = 0;
        arr[i * 3]     = (Math.random() - 0.5) * 0.15;
        arr[i * 3 + 1] = 0;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
      }
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ptsRef} position={[basePos[0], basePos[1] + 0.5, basePos[2]]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ff4400" size={0.025} transparent opacity={0.6}
        depthWrite={false} blending={THREE.AdditiveBlending}
      />
    </points>
  );
}


/* ── Particelle Energia (DEF) — orbita circolare attorno allo scudo ── */
function EnergyParticles({ basePos }) {
  const ptsRef = useRef();
  const COUNT  = 20;

  const positions = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2;
      pos[i * 3]     = Math.cos(angle) * 0.25;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
      pos[i * 3 + 2] = Math.sin(angle) * 0.25;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    const pts = ptsRef.current;
    if (!pts) return;
    const t   = clock.getElapsedTime();
    const arr = pts.geometry.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2 + t * 1.2;
      arr[i * 3]     = Math.cos(angle) * 0.25;
      arr[i * 3 + 2] = Math.sin(angle) * 0.25;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ptsRef} position={[basePos[0], basePos[1] + 0.6, basePos[2]]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#00aaff" size={0.018} transparent opacity={0.7}
        depthWrite={false} blending={THREE.AdditiveBlending}
      />
    </points>
  );
}


/* ── Spada Olografica (ATK Buff) ── */
function HoloSword({ basePos }) {
  const groupRef = useRef();
  const matRef   = useRef();

  /* Animazione entrata */
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.scale.setScalar(0.01);
    gsap.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(2)' });
    return () => gsap.killTweensOf(g.scale);
  }, []);

  /* Rotazione + fluttuazione continua */
  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    g.rotation.y = t * VFX_TIMING.HOLO_SPIN_SPEED;
    g.position.y = basePos[1] + 0.7 + Math.sin(t * VFX_TIMING.HOLO_FLOAT_SPEED) * VFX_TIMING.HOLO_FLOAT_AMP;

    /* Pulsazione emissiva */
    if (matRef.current) {
      matRef.current.emissiveIntensity = 0.6 + Math.sin(t * 3) * 0.2;
    }
  });

  return (
    <group ref={groupRef} position={[basePos[0] + 0.3, basePos[1], basePos[2]]}>
      {/* Lama */}
      <mesh rotation={[0, 0, Math.PI / 8]}>
        <coneGeometry args={[0.03, 0.4, 4]} />
        <meshStandardMaterial
          ref={matRef}
          color="#ff3300"
          emissive="#ff2200"
          emissiveIntensity={0.6}
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Impugnatura */}
      <mesh position={[0, -0.22, 0]} rotation={[0, 0, Math.PI / 8]}>
        <cylinderGeometry args={[0.015, 0.015, 0.08, 6]} />
        <meshStandardMaterial
          color="#ffaa00"
          emissive="#ff8800"
          emissiveIntensity={0.4}
          transparent opacity={0.5}
        />
      </mesh>
      <pointLight color="#ff4400" intensity={0.6} distance={1.5} decay={2} />
    </group>
  );
}


/* ── Scudo Olografico (DEF Buff) ── */
function HoloShield({ basePos }) {
  const groupRef = useRef();
  const matRef   = useRef();

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.scale.setScalar(0.01);
    gsap.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(2)' });
    return () => gsap.killTweensOf(g.scale);
  }, []);

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    g.rotation.y = t * VFX_TIMING.HOLO_SPIN_SPEED * 0.6;
    g.position.y = basePos[1] + 0.7 + Math.sin(t * VFX_TIMING.HOLO_FLOAT_SPEED + 1.0) * VFX_TIMING.HOLO_FLOAT_AMP;

    if (matRef.current) {
      matRef.current.emissiveIntensity = 0.5 + Math.sin(t * 2.5) * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={[basePos[0] - 0.3, basePos[1], basePos[2]]}>
      {/* Pannello scudo esagonale */}
      <mesh>
        <circleGeometry args={[0.18, 6]} />
        <meshStandardMaterial
          ref={matRef}
          color="#0088ff"
          emissive="#0066cc"
          emissiveIntensity={0.5}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Bordo scudo */}
      <mesh>
        <ringGeometry args={[0.16, 0.19, 6]} />
        <meshStandardMaterial
          color="#00ccff"
          emissive="#00aaff"
          emissiveIntensity={0.6}
          transparent opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight color="#0088ff" intensity={0.4} distance={1.2} decay={2} />
    </group>
  );
}


/* ═══════ COMPONENTE PRINCIPALE ═══════ */
export default function BuffHolograms({ position, isAtkBuffed, isDefBuffed }) {
  const pos = position || [0, 0, 0];

  return (
    <group name="buff-holograms">
      {/* Spada olografica ATK */}
      {isAtkBuffed && (
        <>
          <HoloSword basePos={pos} />
          <FireParticles basePos={pos} />
        </>
      )}

      {/* Scudo olografico DEF */}
      {isDefBuffed && (
        <>
          <HoloShield basePos={pos} />
          <EnergyParticles basePos={pos} />
        </>
      )}
    </group>
  );
}
