/**
 * SpellProjectile.jsx — Proiettile fisico per oggetti magici.
 *
 * Flusso animazione:
 *   1. Sfera luminosa sale al centro (SPELL_RISE)
 *   2. Breve stallo con pulsazione (SPELL_STALL)
 *   3. Si scaglia sul Cavaliere bersaglio (SPELL_SMASH)
 *   4. Impatto → 40 particelle esplosive con colori da ITEM_PARTICLE_COLORS
 *   5. Particelle svaniscono e il componente chiama onComplete()
 */
import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { gsap } from 'gsap';
import * as THREE from 'three';
import { VFX_TIMING } from './vfxConstants';


/* ── Esplosione Particellare post-impatto ── */
function ParticleExplosion({ position, particleColor, onComplete }) {
  const groupRef = useRef();
  const COUNT    = VFX_TIMING.SPELL_PARTICLE_CNT;

  /* Genera posizioni e velocità iniziali per ogni frammento */
  const particles = useMemo(() => {
    const list = [];
    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI;
      const speed = 1.5 + Math.random() * 3.0;
      list.push({
        velocity: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.abs(Math.cos(phi)) * speed * 0.6 + 0.5,
          Math.sin(phi) * Math.sin(theta) * speed,
        ),
        scale: 0.02 + Math.random() * 0.03,
        rotSpeed: (Math.random() - 0.5) * 10,
      });
    }
    return list;
  }, [COUNT]);

  /* Stato opacity per fade-out */
  const opacityRef = useRef(1.0);
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    elapsedRef.current += delta;

    const t = Math.min(elapsedRef.current / VFX_TIMING.SPELL_EXPLODE_DUR, 1.0);
    opacityRef.current = 1.0 - t;

    g.children.forEach((mesh, idx) => {
      const p = particles[idx];
      if (!p) return;
      /* Fisica base: gravità + attrito */
      p.velocity.y -= 4.0 * delta;
      mesh.position.addScaledVector(p.velocity, delta);
      mesh.rotation.z += p.rotSpeed * delta;
      mesh.material.opacity = opacityRef.current;
    });

    if (t >= 1.0 && onComplete) onComplete();
  });

  return (
    <group ref={groupRef} position={position}>
      {particles.map((p, i) => (
        <mesh key={i} scale={p.scale}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? particleColor.primary : particleColor.secondary}
            emissive={particleColor.emissive}
            emissiveIntensity={0.8}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}


/* ═══════ COMPONENTE PRINCIPALE ═══════ */
export default function SpellProjectile({ spell, startPos, targetPos, onComplete }) {
  const sphereRef  = useRef();
  const trailRef   = useRef();
  const lightRef   = useRef();
  const [phase, setPhase]       = useState('RISING');   // RISING | STALLING | SMASHING | EXPLODING | DONE
  const [impactPos, setImpactPos] = useState(null);

  const centerY = 3.2;
  const color = spell.particleColor || { primary: '#ffffff', secondary: '#cccccc', emissive: '#888888' };

  useEffect(() => {
    const obj = sphereRef.current;
    if (!obj) return;

    /* Posizione iniziale: slot del giocatore che lancia */
    obj.position.set(startPos[0], startPos[1] + 0.3, startPos[2]);
    obj.scale.setScalar(0.06);

    const tl = gsap.timeline({
      onComplete: () => {
        setImpactPos([targetPos[0], targetPos[1] + 0.3, targetPos[2]]);
        setPhase('EXPLODING');
      },
    });

    /* 1. Sale al centro */
    tl.to(obj.position, {
      x: (startPos[0] + targetPos[0]) / 2,
      y: centerY,
      z: (startPos[2] + targetPos[2]) / 2,
      duration: VFX_TIMING.SPELL_RISE_DUR,
      ease: 'power2.out',
    });
    tl.to(obj.scale, {
      x: 0.12, y: 0.12, z: 0.12,
      duration: VFX_TIMING.SPELL_RISE_DUR,
      ease: 'power2.out',
    }, 0);

    /* 2. Stallo pulsante */
    tl.addLabel('stall');
    tl.to(obj.scale, {
      x: 0.16, y: 0.16, z: 0.16,
      duration: VFX_TIMING.SPELL_STALL_DUR * 0.5,
      ease: 'sine.inOut', yoyo: true, repeat: 1,
    }, 'stall');
    tl.call(() => setPhase('SMASHING'), null, `stall+=${VFX_TIMING.SPELL_STALL_DUR}`);

    /* 3. Si scaglia sul bersaglio */
    tl.to(obj.position, {
      x: targetPos[0], y: targetPos[1] + 0.3, z: targetPos[2],
      duration: VFX_TIMING.SPELL_SMASH_DUR,
      ease: 'power3.in',
    });
    tl.to(obj.scale, {
      x: 0.04, y: 0.04, z: 0.04,
      duration: VFX_TIMING.SPELL_SMASH_DUR,
      ease: 'power2.in',
    }, `-=${VFX_TIMING.SPELL_SMASH_DUR}`);

    return () => { tl.kill(); };
  }, [startPos, targetPos, centerY]);

  /* Luce puntuale che segue la sfera */
  useFrame(() => {
    if (lightRef.current && sphereRef.current && phase !== 'EXPLODING' && phase !== 'DONE') {
      lightRef.current.position.copy(sphereRef.current.position);
    }
  });

  /* Gestione completamento esplosione */
  const handleExplosionDone = () => {
    setPhase('DONE');
    if (onComplete) onComplete();
  };

  if (phase === 'DONE') return null;

  return (
    <group name="spell-projectile">
      {/* Sfera luminosa (nascosta durante esplosione) */}
      {phase !== 'EXPLODING' && (
        <>
          <mesh ref={sphereRef}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial
              color={color.primary}
              emissive={color.emissive}
              emissiveIntensity={2.0}
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <pointLight
            ref={lightRef}
            color={color.primary}
            intensity={2.0}
            distance={4}
            decay={2}
          />
        </>
      )}

      {/* Esplosione particellare */}
      {phase === 'EXPLODING' && impactPos && (
        <ParticleExplosion
          position={impactPos}
          particleColor={color}
          onComplete={handleExplosionDone}
        />
      )}
    </group>
  );
}
