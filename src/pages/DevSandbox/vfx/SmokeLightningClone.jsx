/**
 * SmokeLightningClone.jsx — VFX per Riflesso (terreno specchio).
 *
 * Flusso animazione (10 secondi totali):
 *   1. Fulmini reali animati cadono dall'alto sul cavaliere bersaglio (2.5s buildup)
 *   2. Fulmini intensi + carta ghost risucchiata verso il clonatore (4.5s hold)
 *   3. Fulmini si diradano + ghost scompare (3.0s fade)
 *   4. Callback onComplete()
 *
 * Bug fix: timeline usa to({},{duration}) come dummy waiter — addPause() blocca senza auto-resume.
 */
import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { gsap } from 'gsap';
import * as THREE from 'three';
import fronteImg from '../../../assets/fronte_carta.png';

const BUILDUP_DUR    = 2.5;
const HOLD_DUR       = 4.5;
const FADE_DUR       = 3.0;
const GHOST_MOVE_DUR = BUILDUP_DUR + HOLD_DUR;  // 7s

const CARD_W = 1.0 * (1610 / 2449);
const CARD_H = 1.0;

/* ─── parametri fulmini ─── */
const BOLT_COUNT    = 6;        // quanti fulmini simultanei
const BOLT_SEGS     = 16;       // segmenti per fulmine
const BOLT_HEIGHT   = 3.8;      // altezza da cui cadono (sopra il bersaglio)
const BOLT_JITTER   = 0.22;     // ampiezza deviazione laterale dei segmenti
const BOLT_SPREAD_X = 0.55;     // spread orizzontale dei punti di partenza
const UPDATE_EVERY  = 2;        // rigenera ogni N frame


/* ── genera i vertici di un fulmine zigzag dall'alto verso il basso ── */
function makeBoltPositions(cx, targetY, cz, boltIdx, seed) {
  const arr = new Float32Array((BOLT_SEGS + 1) * 3);
  const startY = targetY + BOLT_HEIGHT;
  let px = cx + (boltIdx / (BOLT_COUNT - 1) - 0.5) * BOLT_SPREAD_X + Math.sin(seed + boltIdx) * 0.06;
  let pz = cz + Math.cos(seed * 2 + boltIdx) * 0.12;

  for (let i = 0; i <= BOLT_SEGS; i++) {
    const t = i / BOLT_SEGS;
    arr[i * 3]     = px;
    arr[i * 3 + 1] = startY + (targetY - startY) * t;
    arr[i * 3 + 2] = pz;
    if (i < BOLT_SEGS) {
      px += (Math.random() - 0.5) * BOLT_JITTER * (1 + t);  // più jitter verso il basso
      pz += (Math.random() - 0.5) * BOLT_JITTER * 0.4;
    }
  }
  return arr;
}


/* ── Sistema fulmini reali (LineSegments animati) ── */
function RealLightning({ targetPos, active }) {
  const groupRef  = useRef();
  const frameRef  = useRef(0);
  const opRef     = useRef(0);

  /* Crea oggetti THREE.Line una volta sola */
  const lines = useMemo(() => {
    return Array.from({ length: BOLT_COUNT }, (_, i) => {
      const positions = makeBoltPositions(
        targetPos[0], targetPos[1], targetPos[2], i, i * 1.3
      );
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xdd99ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      return new THREE.Line(geo, mat);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Branche secondarie — ogni fulmine ha 2 rami corti */
  const branches = useMemo(() => {
    return Array.from({ length: BOLT_COUNT * 2 }, (_, i) => {
      const geo = new THREE.BufferGeometry();
      const pts = new Float32Array(6);  // 2 punti → 1 segmento
      geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xee88ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      return new THREE.Line(geo, mat);
    });
  }, []);

  /* Fade opacity ref */
  useEffect(() => {
    if (active) {
      gsap.to(opRef, { current: 1.0, duration: 0.4, ease: 'power2.in' });
    } else {
      gsap.to(opRef, { current: 0.0, duration: 1.2, ease: 'power2.out' });
    }
  }, [active]);

  useFrame(() => {
    if (!active && opRef.current < 0.01) return;

    frameRef.current++;
    if (frameRef.current % UPDATE_EVERY !== 0) return;

    const seed = Math.random() * 100;
    const baseOp = opRef.current;

    lines.forEach((line, i) => {
      /* ~30% chance ogni fulmine è invisibile → effetto sfarfallio */
      const visible = Math.random() > 0.28;
      line.visible = visible;
      if (!visible) return;

      const newPts = makeBoltPositions(
        targetPos[0], targetPos[1], targetPos[2], i, seed + i
      );
      line.geometry.attributes.position.array.set(newPts);
      line.geometry.attributes.position.needsUpdate = true;
      line.material.opacity = baseOp * (0.6 + Math.random() * 0.4);
    });

    /* Aggiorna branche */
    lines.forEach((mainLine, i) => {
      const b1 = branches[i * 2];
      const b2 = branches[i * 2 + 1];
      if (!mainLine.visible) { b1.visible = false; b2.visible = false; return; }

      const mArr = mainLine.geometry.attributes.position.array;
      /* Scegli un punto a metà del fulmine principale come origine del ramo */
      const branchSeg = Math.floor(BOLT_SEGS * (0.3 + Math.random() * 0.4));
      const ox = mArr[branchSeg * 3];
      const oy = mArr[branchSeg * 3 + 1];
      const oz = mArr[branchSeg * 3 + 2];
      const bLen = 0.18 + Math.random() * 0.22;
      const angle = Math.random() * Math.PI * 2;

      [b1, b2].forEach((branch, bi) => {
        const bArr = branch.geometry.attributes.position.array;
        bArr[0] = ox; bArr[1] = oy; bArr[2] = oz;
        bArr[3] = ox + Math.cos(angle + bi * 1.4) * bLen;
        bArr[4] = oy - bLen * 0.6;
        bArr[5] = oz + Math.sin(angle + bi * 1.4) * bLen;
        branch.geometry.attributes.position.needsUpdate = true;
        branch.visible = Math.random() > 0.4;
        branch.material.opacity = baseOp * 0.45;
      });
    });
  });

  return (
    <group ref={groupRef}>
      {lines.map((l, i)    => <primitive key={`bolt-${i}`}   object={l} />)}
      {branches.map((b, i) => <primitive key={`branch-${i}`} object={b} />)}
    </group>
  );
}


/* ── Fulmini PointLight intermittenti viola (glow) ── */
function LightningFlashes({ position, active }) {
  const light1 = useRef();
  const light2 = useRef();
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    if (!active || !light1.current || !light2.current) return;
    elapsed.current += delta * 1000;
    if (elapsed.current > 120) {
      elapsed.current = 0;
      const flash = Math.random() > 0.25;
      light1.current.intensity = flash ? 5 + Math.random() * 6 : 0;
      light2.current.intensity = flash ? 3 + Math.random() * 4 : 0;
      light1.current.position.x = (Math.random() - 0.5) * 0.5;
      light1.current.position.y = 0.3 + Math.random() * 0.6;
      light2.current.position.x = (Math.random() - 0.5) * 0.5;
      light2.current.position.z = (Math.random() - 0.5) * 0.3;
    }
  });

  return (
    <group position={position}>
      <pointLight ref={light1} color="#bb77ff" intensity={0} distance={3.5} decay={2} />
      <pointLight ref={light2} color="#ee99ff" intensity={0} distance={2.0} decay={2} />
    </group>
  );
}


/* ── Carta Ghost — parte dal bersaglio e viene risucchiata verso il clonatore ── */
function GhostCard({ fromPos, toPos }) {
  const groupRef    = useRef();
  const bodyMatRef  = useRef();
  const frameMatRef = useRef();
  const opacityRef  = useRef(0);
  const fronteTex   = useTexture(fronteImg);
  const { camera }  = useThree();

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;

    /* Posizione iniziale: dove si trova il cavaliere clonato */
    g.position.set(fromPos[0], fromPos[1] + 0.3, fromPos[2]);
    g.scale.set(1.6, 1.6, 1.6);
    g.visible = true;

    const tl = gsap.timeline();

    /* Fade-in rapido */
    tl.to(opacityRef, { current: 0.35, duration: 0.8, ease: 'power2.in' });

    /* Deriva verso il clonatore per tutta la durata buildup+hold */
    tl.to(g.position, {
      x: toPos[0],
      y: toPos[1] + 0.8,
      z: toPos[2],
      duration: GHOST_MOVE_DUR,
      ease: 'power2.inOut',
    }, 0);

    /* Si rimpicciolisce man mano che si avvicina (assorbimento) */
    tl.to(g.scale, {
      x: 0.1, y: 0.1, z: 0.1,
      duration: GHOST_MOVE_DUR * 0.55,
      ease: 'power3.in',
    }, GHOST_MOVE_DUR * 0.45);

    /* Fade-out mentre viene assorbita */
    tl.to(opacityRef, { current: 0, duration: 1.2, ease: 'power2.in' }, GHOST_MOVE_DUR - 0.9);

    return () => { tl.kill(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Tremito d'interferenza sull'asse Y e rotazione per effetto glitch — billboard verso camera */
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    /* Allinea la carta verso la camera (fronte sempre visibile) */
    groupRef.current.lookAt(camera.position);
    /* Aggiungi piccole oscillazioni glitch sopra il lookAt */
    groupRef.current.rotation.y += Math.sin(t * 9) * 0.06;
    groupRef.current.rotation.z += Math.cos(t * 14) * 0.04;
    const op = opacityRef.current;
    if (bodyMatRef.current)  bodyMatRef.current.opacity  = op;
    if (frameMatRef.current) frameMatRef.current.opacity = op * 0.7;
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Corpo card viola traslucido */}
      <mesh>
        <boxGeometry args={[CARD_W, CARD_H, 0.02]} />
        <meshStandardMaterial
          ref={bodyMatRef}
          color="#1a0033"
          emissive="#bb77ff"
          emissiveIntensity={1.8}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      {/* Cornice fronte con tint viola */}
      <mesh position={[0, 0, 0.014]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial
          ref={frameMatRef}
          map={fronteTex}
          transparent
          alphaTest={0.01}
          opacity={0}
          emissive="#9b59b6"
          emissiveIntensity={1.2}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}


/* ═══════ COMPONENTE PRINCIPALE ═══════ */
export default function SmokeLightningClone({
  targetPos,
  ownerPos,
  onComplete,
}) {
  const [phase, setPhase] = useState('buildup');   // buildup | hold | fade | done

  /* Usa ref per onComplete per evitare riavvio dell'effetto su re-render */
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        setPhase('done');
        onCompleteRef.current?.();
      },
    });

    /* Fix critico: addPause() blocca la timeline senza auto-resume.
       Usiamo to({},{duration}) come dummy waiter che avanza automaticamente. */
    tl.call(() => setPhase('buildup'));
    tl.to({}, { duration: BUILDUP_DUR });    // attendi buildup

    tl.call(() => setPhase('hold'));
    tl.to({}, { duration: HOLD_DUR });       // attendi hold

    tl.call(() => setPhase('fade'));
    tl.to({}, { duration: FADE_DUR });       // attendi fade

    return () => { tl.kill(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'done') return null;

  const tp = targetPos || [0, 0, 0];
  const op = ownerPos  || [0, 0, 0];

  return (
    <group name="smoke-lightning-clone">
      <RealLightning targetPos={tp} active={phase === 'buildup' || phase === 'hold'} />
      <LightningFlashes position={tp} active={phase === 'buildup' || phase === 'hold'} />
      <GhostCard fromPos={tp} toPos={op} />
    </group>
  );
}

