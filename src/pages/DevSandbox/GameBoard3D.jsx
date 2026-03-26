/**
 * GameBoard3D.jsx — 3D game board with GSAP-only animations.
 *
 * Architecture:
 *   1. CONFIG_3D dictionary: per-element position / rotation / scale
 *      No global board-group rotation — every mesh is independently placed.
 *   2. Auto knight draw at mount → GSAP flight from deck to central slot
 *   3. Weapon draw: click P1 deck → staggered flight to hand
 *   4. Hand: FIXED fan positions (no repositioning on add/remove)
 *   5. Play card: separate PlayingCard component (no R3F prop conflicts)
 *   6. Height-reactive FlightShadow via GSAP onUpdate
 *   7. Deck hover lift (P1 weapon deck)
 */
import { useMemo, useRef, useEffect, Suspense, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, useTexture, ContactShadows } from '@react-three/drei';
import { gsap } from 'gsap';
import * as THREE from 'three';
import Card3D, { animatePlayCard } from './Card3D';
import boardImg from '../../assets/gameboard_test.png';


/* ╔═══════════════════════════════════════════════════════════════════╗
   ║  CONFIG_3D — Spatial Configuration Dictionary                     ║
   ║                                                                   ║
   ║  Every board element reads position / rotation / scale from here. ║
   ║  Tweak any value for millimetre-precise placement.                ║
   ║                                                                   ║
   ║  Coordinate system (OrthographicCamera looking down Y):           ║
   ║    X → right          positive = right on screen                  ║
   ║    Y → up             positive = toward camera (height/lift)      ║
   ║    Z → toward player  positive = bottom of screen                 ║
   ║                                                                   ║
   ║  Rotation is [rx, ry, rz] in radians.                             ║
   ║    • Cards lying flat on table: rotation = [-π/2, 0, 0]           ║
   ║    • Cards lying flat sideways: rotation = [-π/2, 0, π/2]         ║
   ║                                                                   ║
   ║  perspX / perspY — Per-Element Perspective Tilt                   ║
   ║    Tilts the element to reveal its edge / thickness — like the    ║
   ║    old global board tilt, but independently per object.           ║
   ║    Values are in RADIANS, added to the element's base rotation.   ║
   ║      perspX: 0  → tilt forward / backward  (added to rotation[0])║
   ║      perspY: 0  → tilt left / right         (added to rotation[2])║
   ║    Try ±0.1 – ±0.5 for a visible 3D edge effect.                 ║
   ╚═══════════════════════════════════════════════════════════════════╝ */
const CONFIG_3D = {

  /* ─────────────────────────────────────────────────
     Table / Background image
     ───────────────────────────────────────────────── */
  table: {
    width:    16,
    height:   16 / (3615 / 2018),            // matches gameboard_test.png aspect
    position: [0, -0.01, 0],
    rotation: [-Math.PI / 2, 0, 0],
    scale:    [1, 1, 1],
    perspX:   0,
    perspY:   0,
    shadowConfig: null,                       // table has no per-element shadow
    topSkew:    [0, 0],                       // XY translation of top-half vertices  (Y > 0); [0,0] = no deformation
    bottomSkew: [0, 0],                       // XY translation of bottom-half vertices (Y < 0); [0,0] = no deformation
  },

  /* ─────────────────────────────────────────────────
     Player Main Weapon Deck (zona sinistra sotto)
     Cards stacked horizontally (rotated 90° on Z).
     ───────────────────────────────────────────────── */
  playerMainDeck: {
    position: [-5.74, 0, 0.6],
    rotation: [-Math.PI / 2, 0, Math.PI / 2],
    scale:    [1.46, 1.46, 1.46],
    perspX:   -0.32,
    perspY:   0,
    shadowConfig: { opacity: 0.55, blur: 2.0, scale: 3.5, offset: [0, 0], far: 1.5 },
    topSkew:    [0, 0],
    bottomSkew: [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Opponent Main Weapon Deck (top-left area, mirrored)
     ───────────────────────────────────────────────── */
  opponentMainDeck: {
    position: [-5.36, 0, -1.90],
    rotation: [-Math.PI / 2, 0, Math.PI / 2],
    scale:    [1.40, 1.40, 1.40],
    perspX:   -0.32,
    perspY:   0,
    shadowConfig: { opacity: 1, blur: 2.0, scale: 10, offset: [10, 10], far: 1.5 },
    topSkew:    [0, 0],
    bottomSkew: [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Player Knight Deck (bottom-right area)
     Cards stacked vertically (no Z rotation).
     ───────────────────────────────────────────────── */
  playerKnightDeck: {
    position: [5.6, 0.10, 0.3],
    rotation: [-Math.PI / 2, 0, Math.PI / 2],
    scale:    [1.45, 1.45, 1.45],
    perspX:   -0.14,
    perspY:   0,
    shadowConfig: { opacity: 0.30, blur: 1, scale: 3.2, offset: [0, 0], far: 1.2 },
    topSkew:    [0, 0],
    bottomSkew: [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Opponent Knight Deck (top-right area, mirrored)
     ───────────────────────────────────────────────── */
  opponentKnightDeck: {
    position: [5.6, 0.10, -1.2],
    rotation: [-Math.PI / 2, 0, Math.PI / 2],
    scale:    [1.45, 1.45, 1.45],
    perspX:   -0.2,
    perspY:   0,
    shadowConfig: { opacity: 0.50, blur: 2.5, scale: 3.2, offset: [0, 0], far: 1.2 },
    topSkew:    [0, 0],
    bottomSkew: [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Player Knight Slot (centre, slightly LEFT)
     Where the player's knight card lands after draw.
     Rotation = [-π/2, 0, 0] → flat, face-up, readable.
     ───────────────────────────────────────────────── */
  playerKnightSlot: {
    position: [-1.26, 0.10, -0.45],
    rotation: [-Math.PI / 2, 0, 0],
    scale:    [1.6, 1.6, 1.6],
    perspX:   0,
    perspY:   0,
    shadowConfig: { opacity: 0.35, blur: 4.0, scale: 4.0, offset: [0, 0], far: 2.0 },
    topSkew:    [0.03, 0],
    bottomSkew: [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Opponent Knight Slot (centre, slightly RIGHT)
     ───────────────────────────────────────────────── */
  opponentKnightSlot: {
    position: [1.26, 0.10, -0.45],
    rotation: [-Math.PI / 2, 0, 0],
    scale:    [1.6, 1.6, 1.6],
    perspX:   0,
    perspY:   0,
    shadowConfig: { opacity: 0.35, blur: 4.0, scale: 4.0, offset: [0, 0], far: 2.0 },
    topSkew:    [-0.03, 0],
    bottomSkew: [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Clash Zone — red ring between the two knights.
     Sits at the exact geometric centre [0, 0, 0].
     ───────────────────────────────────────────────── */
  clashZone: {
    position: [0, 0.003, -0.45],
    rotation: [-Math.PI / 2, 0, 0],
    scale:    [1, 1, 1],
    innerRadius: 0.25,
    outerRadius: 0.35,
    perspX:   0,
    perspY:   0,
    shadowConfig: null,
    topSkew:    [0, 0],
    bottomSkew: [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Player Equip Slot (where weapon cards land after play)
     ───────────────────────────────────────────────── */
  playerEquipSlot: {
    position: [-1.5, 0.10, 0],
    rotation: [-Math.PI / 2, 0, 0],
    scale:    [1, 1, 1],
    perspX:   0,
    perspY:   0,
    shadowConfig: { opacity: 0.40, blur: 3.5, scale: 3.8, offset: [0, 0], far: 1.5 },
    topSkew:    [0, 0],
    bottomSkew: [0, 0],
  },
};

/**
 * perspPos — Returns cfg.position as a plain array.
 * Use instead of cfg.position directly so all positioning goes through a central resolver.
 */
function perspPos(cfg) {
  return [...cfg.position];
}

/**
 * perspRot — Resolves the final [rx, ry, rz] rotation for a CONFIG_3D element.
 * perspX is added to rotation[0] (forward/backward tilt → shows Z-edge thickness).
 * perspY is added to rotation[2] (left/right tilt → shows X-edge thickness).
 * Values are in radians. Use ±0.1 – ±0.5 for a visible 3D depth effect.
 */
function perspRot(cfg) {
  return [
    cfg.rotation[0] + (cfg.perspX || 0),
    cfg.rotation[1],
    cfg.rotation[2] + (cfg.perspY || 0),
  ];
}


/* ═══════════════════════════════════════════════════════════════════
   GAMEPLAY CONSTANTS (non-spatial)
   ═══════════════════════════════════════════════════════════════════ */

/* ── Camera ── */
const CAM_HEIGHT = 14;
const CAM_FOV    = 35;

/* ── Player Hand (screen-space, outside any board group) ── */
const HAND_Y       = 0.12;
const HAND_Z       = 4.0;
const HAND_CARD_SC = 2.2;
const HAND_SPREAD  = 1.3;
const HAND_FAN_ROT = 0.03;
const HAND_Z_STEP  = 0.008;

/* ── Opponent Hand ── */
const OPP_HAND_Y  = 0.12;
const OPP_HAND_Z  = -4.0;
const OPP_HAND_SC = 1.4;
const OPP_SPREAD  = 0.80;
const OPP_FAN_ROT = 0.03;
const OPP_Z_STEP  = 0.005;

/* ── Draw Phase timings ── */
const DRAW_COUNT     = 3;
const CARD_ANIM_DUR  = 0.75;
const FLIGHT_DUR     = 0.65;
const FLIP_DUR       = 0.10;
const ARC_PEAK       = 1.8;
const STACK_TOP      = 0.30;
const OPP_DRAW_DELAY = 0.6;

/* ── Knight Auto-Draw timings ── */
const KNIGHT_DRAW_DELAY = 0.5;    // seconds after mount before P1 knight draw
const KNIGHT_STAGGER    = 0.5;    // seconds between P1 and P2 knight draws
const KNIGHT_FLIGHT_DUR = 0.80;   // total flight duration
const KNIGHT_ARC_PEAK   = 1.6;    // Y height at apex of the arc

/* ── Shadows ── */
const SHADOW_CONTACT_OP = 0.20;
const SHADOW_BLUR       = 1.5;
const SHADOW_GROUND_OP  = 0.30;
const SHADOW_SKY_OP     = 0.03;
const SHADOW_GROUND_SC  = 0.8;
const SHADOW_SKY_SC     = 2.0;
const SHADOW_MAX_H      = 5.0;

/* ── Deck Hover ── */
const DECK_HOVER_LIFT = 0.04;
const DECK_HOVER_DUR  = 0.25;

/* ── Sample data ── */
const SAMPLE_DRAW = [
  { name: 'Spada Lunga',    type: 'arma',  bonus: 3 },
  { name: 'Scudo di Ferro', type: 'scudo', bonus: 2 },
  { name: 'Ascia Bipenne',  type: 'arma',  bonus: 5 },
];
const SAMPLE_KNIGHTS = {
  p1: { name: 'Vanguard', type: 'knight', atk: 10, def: 10, pa: 3 },
  p2: { name: 'Sentinel', type: 'knight', atk: 7,  def: 7,  pa: 3 },
};


/* ═══════════════════════════════════════════
   STATIC COMPONENTS
   ═══════════════════════════════════════════ */

function Table() {
  const texture = useTexture(boardImg);
  const { width, height } = CONFIG_3D.table;
  return (
    <mesh rotation={perspRot(CONFIG_3D.table)} position={perspPos(CONFIG_3D.table)} receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

/* ── Effetto particelle bianche ── */
function DeckParticles({ active, topY = 0.25 }) {
  const ptsRef = useRef();
  const tlRef  = useRef(null);
  const COUNT  = 10;

  const positions = useMemo(() => {
    const buf = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      buf[i * 3]     = (Math.random() - 0.5) * 0.55;
      buf[i * 3 + 1] = 0;
      buf[i * 3 + 2] = (Math.random() - 0.5) * 0.80;
    }
    return buf;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pts = ptsRef.current;
    if (!pts) return;
    tlRef.current?.kill();
    if (active) {
      const arr = pts.geometry.attributes.position.array;
      for (let i = 0; i < COUNT; i++) arr[i * 3 + 1] = 0;
      pts.geometry.attributes.position.needsUpdate = true;
      pts.material.opacity = 0;
      const prx = { t: 0 };
      tlRef.current = gsap.to(prx, {
        t: 1, duration: 2.2, ease: 'power1.out', repeat: -1,
        onUpdate: () => {
          const a = pts.geometry.attributes.position.array;
          for (let i = 0; i < COUNT; i++) {
            a[i * 3 + 1] = prx.t * 0.9 * (0.5 + 0.5 * Math.sin(i * 0.85));
          }
          pts.geometry.attributes.position.needsUpdate = true;
          pts.material.opacity = prx.t < 0.15
            ? (prx.t / 0.15) * 0.65
            : (1 - prx.t) * 0.65;
        },
      });
    } else {
      if (pts.material) pts.material.opacity = 0;
      tlRef.current?.kill();
    }
    return () => tlRef.current?.kill();
  }, [active]);

  return (
    <group position={[0, topY, 0]}>
      <points ref={ptsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff" size={0.035} transparent opacity={0}
          depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function DeckStack({ configKey, countOverride, onClick, hoverLift = 0 }) {
  const cfg      = CONFIG_3D[configKey];
  const groupRef = useRef();
  const count    = countOverride ?? 0;
  const layers   = Math.min(count, 8);
  const [hovered, setHovered] = useState(false);

  const [baseX, baseY, baseZ] = perspPos(cfg);
  const sc = cfg.shadowConfig;

  const cards = useMemo(() =>
    Array.from({ length: layers }, (_, i) => ({
      key: i,
      pos: [0, i * 0.03, 0],
    })), [layers]);

  /* topY = just above the highest card, in local group space */
  const topY = layers * 0.03 + 0.06;

  const handleOver = useCallback(() => {
    setHovered(true);
    if (!onClick) return;
    document.body.style.cursor = 'pointer';
    if (hoverLift > 0 && groupRef.current) {
      gsap.to(groupRef.current.position, {
        y: baseY + hoverLift, duration: DECK_HOVER_DUR, ease: 'power2.out', overwrite: true,
      });
    }
  }, [onClick, hoverLift, baseY]);

  const handleOut = useCallback(() => {
    setHovered(false);
    if (!onClick) return;
    document.body.style.cursor = 'default';
    if (hoverLift > 0 && groupRef.current) {
      gsap.to(groupRef.current.position, {
        y: baseY, duration: DECK_HOVER_DUR, ease: 'power2.inOut', overwrite: true,
      });
    }
  }, [onClick, hoverLift, baseY]);

  return (
    <>
      {/* Per-deck ContactShadows — flat in world space, must live outside any rotated group */}
      {sc && (
        <ContactShadows
          position={[baseX + (sc.offset?.[0] ?? 0), 0.001, baseZ + (sc.offset?.[1] ?? 0)]}
          opacity={sc.opacity ?? 0.4}
          blur={sc.blur ?? 2.5}
          scale={sc.scale ?? 3}
          far={sc.far ?? 1.5}
          resolution={sc.resolution ?? 256}
          color="#000000"
        />
      )}
      <group
        ref={groupRef}
        position={[baseX, baseY, baseZ]}
        scale={cfg.scale}
        onClick={onClick}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
      >
        {cards.map(c => (
          <Card3D key={c.key} position={c.pos} rotation={perspRot(cfg)} type="back" faceDown
            topSkew={cfg.topSkew ?? [0, 0]} bottomSkew={cfg.bottomSkew ?? [0, 0]} />
        ))}
        {count > 0 && (
          <Card3D
            position={[0, layers * 0.03 + 0.01, 0]}
            rotation={perspRot(cfg)} type="deck" name={`${count}`}
            topSkew={cfg.topSkew ?? [0, 0]} bottomSkew={cfg.bottomSkew ?? [0, 0]}
          />
        )}
        {/* Ethereal hover particles, floating above the top card */}
        <DeckParticles active={hovered} topY={topY} />
      </group>
    </>
  );
}


/* ═══════════════════════════════════════════
   FLIGHT SHADOW
   ═══════════════════════════════════════════ */
function FlightShadow({ shadowRef }) {
  return (
    <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} renderOrder={-1}>
      <circleGeometry args={[0.45, 24]} />
      <meshBasicMaterial
        color="#000000" transparent opacity={0} depthWrite={false}
        blending={THREE.MultiplyBlending}
      />
    </mesh>
  );
}

function syncShadow(shadow, card) {
  if (!shadow || !card) return;
  const h = Math.max(0, card.position.y);
  shadow.position.set(card.position.x, 0.002, card.position.z);
  const t = Math.min(h / SHADOW_MAX_H, 1);
  const s = SHADOW_GROUND_SC + t * (SHADOW_SKY_SC - SHADOW_GROUND_SC);
  shadow.scale.set(s, s * 0.7, 1);
  shadow.material.opacity = SHADOW_GROUND_OP - t * (SHADOW_GROUND_OP - SHADOW_SKY_OP);
}


/* ═══════════════════════════════════════════
   HAND CARD — FIXED fan position based on _drawIdx.
   Cards never reposition when others arrive or leave.
   ═══════════════════════════════════════════ */
function HandCard({ card, onPlay }) {
  const groupRef = useRef();

  const offset = card._drawIdx - (DRAW_COUNT - 1) / 2;
  const posX   = offset * HAND_SPREAD;
  const posY   = HAND_Y + card._drawIdx * HAND_Z_STEP;
  const posZ   = HAND_Z;
  const rotZ   = -offset * HAND_FAN_ROT;

  const handleClick = useCallback(() => {
    if (!groupRef.current || !onPlay) return;
    if (groupRef.current.userData?.isPlaying) return;
    onPlay(card._drawIdx, groupRef.current);
  }, [card._drawIdx, onPlay]);

  return (
    <Card3D
      ref={groupRef}
      position={[posX, posY, posZ]}
      rotation={[-Math.PI / 2, 0, rotZ]}
      scale={HAND_CARD_SC}
      type={card?.type || 'arma'}
      name={card?.name || '?'}
      bonus={card?.bonus}
      hoverable
      renderOrder={10 + card._drawIdx}
      onClick={handleClick}
    />
  );
}

function OppHandCard({ index }) {
  const offset = index - (DRAW_COUNT - 1) / 2;
  return (
    <Card3D
      position={[offset * OPP_SPREAD, OPP_HAND_Y + index * OPP_Z_STEP, OPP_HAND_Z]}
      rotation={[-Math.PI / 2, 0, offset * OPP_FAN_ROT]}
      scale={OPP_HAND_SC}
      type="back" faceDown
      renderOrder={10 + index}
    />
  );
}


/* ═══════════════════════════════════════════
   DRAWING CARD — direct flight, deck → hand
   (world-space, no parent group transform)
   ═══════════════════════════════════════════ */
function DrawingCard({ card, index, deckPos, deckRot, deckTopSkew = [0, 0], deckBottomSkew = [0, 0], isOpponent, absoluteDelay, onLanded }) {
  const groupRef  = useRef();
  const shadowRef = useRef();
  const card3dRef = useRef();
  const [revealed, setRevealed] = useState(false);

  /* Fixed fan slot (same formula as HandCard / OppHandCard) */
  const offset   = index - (DRAW_COUNT - 1) / 2;
  const targetX  = isOpponent ? offset * OPP_SPREAD  : offset * HAND_SPREAD;
  const targetY  = isOpponent ? OPP_HAND_Y + index * OPP_Z_STEP : HAND_Y + index * HAND_Z_STEP;
  const targetZ  = isOpponent ? OPP_HAND_Z : HAND_Z;
  const targetRZ = isOpponent ? offset * OPP_FAN_ROT : -offset * HAND_FAN_ROT;
  const targetSc = isOpponent ? OPP_HAND_SC : HAND_CARD_SC;

  useEffect(() => {
    const g = groupRef.current;
    const s = shadowRef.current;
    if (!g) return;

    /* Start at deck top position (directly from CONFIG_3D) */
    g.position.set(deckPos[0], deckPos[1] + STACK_TOP, deckPos[2]);
    g.rotation.set(deckRot[0], deckRot[1], deckRot[2]);
    g.scale.set(1, 1, 1);
    g.renderOrder = 20 + index;
    g.visible = true;
    syncShadow(s, g);

    const scaleProxy = { x: 1 };
    const shadowUp   = () => syncShadow(s, g);

    const tl = gsap.timeline({ delay: absoluteDelay });
    tl.addLabel('fly', 0);

    /* Skew: interpolate deck topSkew/bottomSkew → [0,0] (hand cards are always rectangular) */
    const skewStart = { tx: deckTopSkew[0], ty: deckTopSkew[1], bx: deckBottomSkew[0], by: deckBottomSkew[1] };
    if (skewStart.tx !== 0 || skewStart.ty !== 0 || skewStart.bx !== 0 || skewStart.by !== 0) {
      tl.to(skewStart, {
        tx: 0, ty: 0, bx: 0, by: 0, duration: FLIGHT_DUR, ease: 'power2.inOut',
        onUpdate: () => card3dRef.current?.userData?._setSkew?.(skewStart.tx, skewStart.ty, skewStart.bx, skewStart.by),
      }, 'fly');
    }

    tl.to(g.position, {
      x: targetX, z: targetZ,
      duration: FLIGHT_DUR, ease: 'power2.inOut', onUpdate: shadowUp,
    }, 'fly');

    tl.to(g.position, {
      keyframes: [
        { y: ARC_PEAK, duration: FLIGHT_DUR * 0.4, ease: 'power2.out' },
        { y: targetY,  duration: FLIGHT_DUR * 0.6, ease: 'power2.in'  },
      ],
      onUpdate: shadowUp,
    }, 'fly');

    tl.to(g.rotation, {
      x: -Math.PI / 2, y: 0, z: targetRZ,
      duration: FLIGHT_DUR, ease: 'sine.inOut',
    }, 'fly');

    tl.to(g.scale, {
      x: targetSc, y: targetSc, z: targetSc,
      duration: FLIGHT_DUR, ease: 'power2.inOut',
    }, 'fly');

    if (!isOpponent) {
      tl.to(g.rotation, {
        keyframes: [
          { y:  0.10, duration: FLIGHT_DUR * 0.25, ease: 'sine.out'   },
          { y: -0.06, duration: FLIGHT_DUR * 0.25, ease: 'sine.inOut' },
          { y:  0.03, duration: FLIGHT_DUR * 0.25, ease: 'sine.inOut' },
          { y:  0,    duration: FLIGHT_DUR * 0.25, ease: 'sine.in'    },
        ],
      }, 'fly');

      tl.to(scaleProxy, {
        x: targetSc, duration: FLIGHT_DUR * 0.35, ease: 'power2.in',
        onUpdate: () => g.scale.setX(scaleProxy.x),
      }, 'fly');
      tl.to(scaleProxy, {
        x: 0.02, duration: FLIP_DUR, ease: 'power1.in',
        onUpdate: () => g.scale.setX(scaleProxy.x),
      });
      tl.add(() => setRevealed(true));
      tl.to(scaleProxy, {
        x: targetSc, duration: FLIP_DUR, ease: 'power1.out',
        onUpdate: () => g.scale.setX(scaleProxy.x),
      });
    } else {
      tl.to(g.scale, {
        x: targetSc, duration: FLIGHT_DUR, ease: 'power2.inOut',
      }, 'fly');
    }

    if (s) {
      tl.to(s.material, { opacity: 0, duration: 0.2, ease: 'power1.out' });
    }

    tl.add(() => onLanded?.(index));
    return () => { tl.kill(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, absoluteDelay]);

  return (
    <>
      <group ref={groupRef} visible={false}>
        <Card3D
          ref={card3dRef}
          topSkew={deckTopSkew}
          bottomSkew={deckBottomSkew}
          faceDown={isOpponent || !revealed}
          type={!isOpponent && revealed ? (card?.type || 'arma') : 'back'}
          name={!isOpponent && revealed ? (card?.name || '?') : ''}
          bonus={!isOpponent && revealed ? card?.bonus : undefined}
          renderOrder={20 + index}
        />
      </group>
      <FlightShadow shadowRef={shadowRef} />
    </>
  );
}


/* ═══════════════════════════════════════════
   KNIGHT DRAW CARD — auto-draws from knight
   deck to central knight slot.
   
   Animation:
     1. Starts face-down at deck top position
     2. Lifts on Y axis (arc peak)
     3. Glides on XZ to the knight slot
     4. Y-axis rotation = flip from back to face
     5. Lands at CONFIG_3D slot rotation → perfectly
        flat and readable for the player
   ═══════════════════════════════════════════ */
function KnightDrawCard({ knightData, deckConfigKey, slotConfigKey, delay, onLanded }) {
  const groupRef  = useRef();
  const shadowRef = useRef();
  const card3dRef = useRef();
  const [revealed, setRevealed] = useState(false);

  const deckCfg = CONFIG_3D[deckConfigKey];
  const slotCfg = CONFIG_3D[slotConfigKey];

  useEffect(() => {
    const g = groupRef.current;
    const s = shadowRef.current;
    if (!g) return;

    /* ── Start: face-down at deck top ── */
    const [dX, dY, dZ] = perspPos(deckCfg);
    g.position.set(dX, dY + STACK_TOP, dZ);
    const dr = perspRot(deckCfg);
    g.rotation.set(dr[0], dr[1], dr[2]);
    g.scale.set(deckCfg.scale[0], deckCfg.scale[1], deckCfg.scale[2]);
    g.visible = true;
    syncShadow(s, g);

    /* ── Target: slot position + perspective tilt ── */
    const targetPos = perspPos(slotCfg);
    const targetRot = perspRot(slotCfg);
    const targetSc  = slotCfg.scale;

    const shadowUp = () => syncShadow(s, g);

    const startTopSkew    = deckCfg.topSkew    ?? [0, 0];
    const startBottomSkew = deckCfg.bottomSkew ?? [0, 0];
    const endTopSkew      = slotCfg.topSkew    ?? [0, 0];
    const endBottomSkew   = slotCfg.bottomSkew ?? [0, 0];

    const tl = gsap.timeline({ delay });
    tl.addLabel('fly', 0);

    /* Skew: interpolate deck skew → slot skew during flight */
    const skewProxy = { tx: startTopSkew[0], ty: startTopSkew[1], bx: startBottomSkew[0], by: startBottomSkew[1] };
    const needsSkewAnim = skewProxy.tx !== endTopSkew[0] || skewProxy.ty !== endTopSkew[1] ||
                          skewProxy.bx !== endBottomSkew[0] || skewProxy.by !== endBottomSkew[1];
    if (needsSkewAnim) {
      tl.to(skewProxy, {
        tx: endTopSkew[0], ty: endTopSkew[1], bx: endBottomSkew[0], by: endBottomSkew[1],
        duration: KNIGHT_FLIGHT_DUR, ease: 'power2.inOut',
        onUpdate: () => card3dRef.current?.userData?._setSkew?.(skewProxy.tx, skewProxy.ty, skewProxy.bx, skewProxy.by),
      }, 'fly');
    }

    /* XZ: glide from deck to knight slot */
    tl.to(g.position, {
      x: targetPos[0], z: targetPos[2],
      duration: KNIGHT_FLIGHT_DUR, ease: 'power2.inOut', onUpdate: shadowUp,
    }, 'fly');

    /* Y: arc up then land at slot height */
    tl.to(g.position, {
      keyframes: [
        { y: KNIGHT_ARC_PEAK, duration: KNIGHT_FLIGHT_DUR * 0.4, ease: 'power2.out' },
        { y: targetPos[1],    duration: KNIGHT_FLIGHT_DUR * 0.6, ease: 'power2.in'  },
      ],
      onUpdate: shadowUp,
    }, 'fly');

    /* Rotation: interpolate from deck rotation to slot rotation.
       The Y-axis rotation sweeps through π to create the face-flip. */
    tl.to(g.rotation, {
      x: targetRot[0],
      z: targetRot[2],
      duration: KNIGHT_FLIGHT_DUR, ease: 'power2.inOut',
    }, 'fly');

    /* Y-axis flip: sinuous rotation that reveals the face mid-flight */
    tl.to(g.rotation, {
      keyframes: [
        { y: Math.PI * 0.5,  duration: KNIGHT_FLIGHT_DUR * 0.35, ease: 'power2.in'  },
        { y: Math.PI,         duration: KNIGHT_FLIGHT_DUR * 0.15, ease: 'none'       },
        { y: targetRot[1],    duration: KNIGHT_FLIGHT_DUR * 0.50, ease: 'power2.out' },
      ],
    }, 'fly');

    /* Reveal the face at the midpoint of the Y flip */
    tl.add(() => setRevealed(true), `fly+=${KNIGHT_FLIGHT_DUR * 0.45}`);

    /* Scale: interpolate from deck scale to slot scale */
    tl.to(g.scale, {
      x: targetSc[0], y: targetSc[1], z: targetSc[2],
      duration: KNIGHT_FLIGHT_DUR, ease: 'power2.inOut',
    }, 'fly');

    /* Wobble on landing */
    tl.to(g.rotation, {
      keyframes: [
        { z: targetRot[2] + 0.06, duration: 0.06, ease: 'sine.out'   },
        { z: targetRot[2] - 0.03, duration: 0.06, ease: 'sine.inOut' },
        { z: targetRot[2],        duration: 0.06, ease: 'sine.in'    },
      ],
    });

    /* Fade shadow */
    if (s) {
      tl.to(s.material, { opacity: 0, duration: 0.15, ease: 'power1.out' }, '-=0.15');
    }

    tl.add(() => onLanded?.());
    return () => { tl.kill(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <group ref={groupRef} visible={false}>
        <Card3D
          ref={card3dRef}
          topSkew={deckCfg.topSkew ?? [0, 0]}
          bottomSkew={deckCfg.bottomSkew ?? [0, 0]}
          faceDown={!revealed}
          type={revealed ? 'knight' : 'back'}
          name={revealed ? knightData.name : ''}
          atk={revealed ? knightData.atk : undefined}
          def={revealed ? knightData.def : undefined}
          pa={revealed ? knightData.pa : undefined}
          renderOrder={30}
        />
      </group>
      <FlightShadow shadowRef={shadowRef} />
    </>
  );
}


/* ═══════════════════════════════════════════
   PLAYING CARD — flies from hand to equip slot.
   Mounted SEPARATELY from HandCard to avoid
   R3F prop conflicts during GSAP animation.
   ═══════════════════════════════════════════ */
function PlayingCard({ card, startPos, target, onComplete }) {
  const groupRef = useRef();

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;

    g.position.set(startPos.x, startPos.y, startPos.z);
    g.rotation.set(-Math.PI / 2, 0, 0);
    g.scale.set(HAND_CARD_SC, HAND_CARD_SC, HAND_CARD_SC);
    g.visible = true;

    const tl = animatePlayCard(g, target, onComplete);
    return () => { tl.kill(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <group ref={groupRef} visible={false}>
      <Card3D
        type={card?.type || 'arma'}
        name={card?.name || '?'}
        bonus={card?.bonus}
        renderOrder={50}
      />
    </group>
  );
}


/* ═══════════════════════════════════════════
   MAIN SCENE
   ═══════════════════════════════════════════ */
function Scene({ gameState }) {
  const p1 = gameState?.p1;
  const p2 = gameState?.p2;

  /* ── Knight Auto-Draw state ── */
  const [knightsPhase, setKnightsPhase] = useState('idle');  // 'idle' | 'drawing' | 'done'
  const [p1KnightReady, setP1KnightReady] = useState(false);
  const [p2KnightReady, setP2KnightReady] = useState(false);

  /* ── Weapon Draw state ── */
  const [drawData, setDrawData]       = useState(null);
  const [landedP1, setLandedP1]       = useState(new Set());
  const [landedP2, setLandedP2]       = useState(new Set());
  const [playerHand, setPlayerHand]   = useState([]);
  const [oppHand, setOppHand]         = useState([]);
  const [playedCards, setPlayedCards]  = useState(new Set());
  const [oppDrawStarted, setOppDrawStarted] = useState(false);

  /* ── Play card (detached animation) ── */
  const [playingCard, setPlayingCard] = useState(null);

  /* ── Auto-trigger knight draw on mount ── */
  useEffect(() => {
    const timer = setTimeout(() => setKnightsPhase('drawing'), KNIGHT_DRAW_DELAY * 1000);
    return () => clearTimeout(timer);
  }, []);

  /* When both knights landed → mark done */
  useEffect(() => {
    if (p1KnightReady && p2KnightReady) setKnightsPhase('done');
  }, [p1KnightReady, p2KnightReady]);

  /* ── Click P1 Main Deck → trigger weapon draw ── */
  const handleDraw = useCallback(() => {
    if (drawData) return;
    setDrawData({
      cards: SAMPLE_DRAW.slice(0, DRAW_COUNT),
    });
  }, [drawData]);

  /* ── Player card lands ── */
  const handleP1Landed = useCallback((idx) => {
    setLandedP1(prev => {
      const next = new Set(prev).add(idx);
      if (next.size === DRAW_COUNT) {
        setTimeout(() => setOppDrawStarted(true), OPP_DRAW_DELAY * 1000);
      }
      return next;
    });
    setPlayerHand(prev => {
      if (prev.some(c => c._drawIdx === idx)) return prev;
      return [...prev, { ...SAMPLE_DRAW[idx], _drawIdx: idx }];
    });
  }, []);

  /* ── Opponent card lands ── */
  const handleP2Landed = useCallback((idx) => {
    setLandedP2(prev => new Set(prev).add(idx));
    setOppHand(prev => {
      if (prev.some(c => c._drawIdx === idx)) return prev;
      return [...prev, { _drawIdx: idx }];
    });
  }, []);

  /* ── Play card from hand → equip slot ── */
  const handlePlayCard = useCallback((drawIdx, cardGroup) => {
    if (!cardGroup) return;

    const startPos = {
      x: cardGroup.position.x,
      y: cardGroup.position.y,
      z: cardGroup.position.z,
    };
    const card = playerHand.find(c => c._drawIdx === drawIdx);

    const equipCfg = CONFIG_3D.playerEquipSlot;
    const [eqX, eqY, eqZ] = perspPos(equipCfg);
    const eqRot = perspRot(equipCfg);
    const target = {
      x: eqX,
      y: eqY,
      z: eqZ,
      rotX: eqRot[0],
      rotY: eqRot[1],
      rotZ: eqRot[2],
    };

    setPlayedCards(prev => new Set(prev).add(drawIdx));
    setPlayingCard({ card, startPos, target });
  }, [playerHand]);

  /* PlayingCard finishes → unmount it */
  const handlePlayComplete = useCallback(() => {
    setPlayingCard(null);
  }, []);

  /* Visible hand = landed minus played */
  const visibleHand = useMemo(
    () => playerHand.filter(c => !playedCards.has(c._drawIdx)),
    [playerHand, playedCards],
  );

  /* Shorthand refs to CONFIG_3D for the clash zone */
  const clash = CONFIG_3D.clashZone;

  return (
    <>
      {/* ── Camera ── */}
      <PerspectiveCamera
        makeDefault
        fov={CAM_FOV}
        position={[0, CAM_HEIGHT, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        near={0.1} far={200}
      />

      {/* ── Lighting ── */}
      <ambientLight intensity={0.35} color="#ffffff" />
      <directionalLight
        position={[0.5, 10, 0.5]}
        intensity={1.4}
        color="#ffeedd"
        castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-near={0.5}    shadow-camera-far={30}
        shadow-camera-left={-10}    shadow-camera-right={10}
        shadow-camera-top={8}       shadow-camera-bottom={-8}
        shadow-bias={-0.0005}
      />
      <pointLight position={[-6, 4, -4]} intensity={0.25} color="#8a0303" />
      <pointLight position={[ 6, 3, -3]} intensity={0.18} color="#4400aa" />

      {/* ══════ GAME BOARD ══════ */}
      <Table />

      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={SHADOW_CONTACT_OP}
        scale={20}
        blur={SHADOW_BLUR}
        far={8}
        resolution={512}
        color="#000000"
      />

      {/* ── Decks — each reads its own transform from CONFIG_3D ── */}

      {/* Player Main Weapon Deck — clickable with hover lift */}
      <DeckStack
        configKey="playerMainDeck"
        countOverride={p1?.weaponsLeft ?? 45}
        onClick={handleDraw}
        hoverLift={DECK_HOVER_LIFT}
      />

      {/* Opponent Main Weapon Deck */}
      <DeckStack
        configKey="opponentMainDeck"
        countOverride={p2?.weaponsLeft ?? 45}
      />

      {/* Player Knight Deck — count decreases after knight drawn */}
      <DeckStack
        configKey="playerKnightDeck"
        countOverride={(p1?.cardsLeft ?? 5) - (knightsPhase !== 'idle' ? 1 : 0)}
      />

      {/* Opponent Knight Deck */}
      <DeckStack
        configKey="opponentKnightDeck"
        countOverride={(p2?.cardsLeft ?? 5) - (p2KnightReady || knightsPhase === 'drawing' ? 1 : 0)}
      />

      {/* ── Knight Auto-Draw Animations ── */}
      {knightsPhase === 'drawing' && !p1KnightReady && (
        <KnightDrawCard
          knightData={SAMPLE_KNIGHTS.p1}
          deckConfigKey="playerKnightDeck"
          slotConfigKey="playerKnightSlot"
          delay={0}
          onLanded={() => setP1KnightReady(true)}
        />
      )}
      {knightsPhase === 'drawing' && !p2KnightReady && (
        <KnightDrawCard
          knightData={SAMPLE_KNIGHTS.p2}
          deckConfigKey="opponentKnightDeck"
          slotConfigKey="opponentKnightSlot"
          delay={KNIGHT_STAGGER}
          onLanded={() => setP2KnightReady(true)}
        />
      )}

      {/* ── Landed Knights (static, face up) ── */}
      {p1KnightReady && (
        <Card3D
          position={perspPos(CONFIG_3D.playerKnightSlot)}
          rotation={perspRot(CONFIG_3D.playerKnightSlot)}
          scale={CONFIG_3D.playerKnightSlot.scale}
          topSkew={CONFIG_3D.playerKnightSlot.topSkew ?? [0, 0]}
          bottomSkew={CONFIG_3D.playerKnightSlot.bottomSkew ?? [0, 0]}
          type="knight"
          name={SAMPLE_KNIGHTS.p1.name}
          atk={SAMPLE_KNIGHTS.p1.atk}
          def={SAMPLE_KNIGHTS.p1.def}
          pa={SAMPLE_KNIGHTS.p1.pa}
        />
      )}
      {p2KnightReady && (
        <Card3D
          position={perspPos(CONFIG_3D.opponentKnightSlot)}
          rotation={perspRot(CONFIG_3D.opponentKnightSlot)}
          scale={CONFIG_3D.opponentKnightSlot.scale}
          topSkew={CONFIG_3D.opponentKnightSlot.topSkew ?? [0, 0]}
          bottomSkew={CONFIG_3D.opponentKnightSlot.bottomSkew ?? [0, 0]}
          type="knight"
          name={SAMPLE_KNIGHTS.p2.name}
          atk={SAMPLE_KNIGHTS.p2.atk}
          def={SAMPLE_KNIGHTS.p2.def}
          pa={SAMPLE_KNIGHTS.p2.pa}
        />
      )}

      {/* ── Clash Zone ring (dead centre between the two knights) ── */}
      <mesh rotation={perspRot(clash)} position={perspPos(clash)} scale={clash.scale}>
        <ringGeometry args={[clash.innerRadius, clash.outerRadius, 32]} />
        <meshStandardMaterial
          color="#8a0303" emissive="#8a0303" emissiveIntensity={0.5}
          transparent opacity={0.45} side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Player Drawing Cards ── */}
      {drawData && drawData.cards.map((card, i) =>
        !landedP1.has(i) && (
          <DrawingCard
            key={`p1draw-${i}`}
            card={card} index={i}
            deckPos={perspPos(CONFIG_3D.playerMainDeck)}
            deckRot={perspRot(CONFIG_3D.playerMainDeck)}
            deckTopSkew={CONFIG_3D.playerMainDeck.topSkew ?? [0, 0]}
            deckBottomSkew={CONFIG_3D.playerMainDeck.bottomSkew ?? [0, 0]}
            isOpponent={false}
            absoluteDelay={i * CARD_ANIM_DUR}
            onLanded={handleP1Landed}
          />
        )
      )}

      {/* ── Opponent Drawing Cards ── */}
      {oppDrawStarted && drawData && drawData.cards.map((_, i) =>
        !landedP2.has(i) && (
          <DrawingCard
            key={`p2draw-${i}`}
            card={null} index={i}
            deckPos={perspPos(CONFIG_3D.opponentMainDeck)}
            deckRot={perspRot(CONFIG_3D.opponentMainDeck)}
            deckTopSkew={CONFIG_3D.opponentMainDeck.topSkew ?? [0, 0]}
            deckBottomSkew={CONFIG_3D.opponentMainDeck.bottomSkew ?? [0, 0]}
            isOpponent
            absoluteDelay={i * CARD_ANIM_DUR}
            onLanded={handleP2Landed}
          />
        )
      )}

      {/* ── Player Hand (fixed fan, screen-space) ── */}
      {visibleHand.map(card => (
        <HandCard
          key={`hand-${card._drawIdx}`}
          card={card}
          onPlay={handlePlayCard}
        />
      ))}

      {/* ── Playing Card (animation from hand to equip slot) ── */}
      {playingCard && (
        <PlayingCard
          card={playingCard.card}
          startPos={playingCard.startPos}
          target={playingCard.target}
          onComplete={handlePlayComplete}
        />
      )}

      {/* ── Opponent Hand (fixed fan, face-down) ── */}
      {oppHand.map((_, i) => (
        <OppHandCard key={`opp-${i}`} index={i} />
      ))}
    </>
  );
}


/* ─── Exported Canvas wrapper ─── */
export default function GameBoard3D({ gameState }) {
  return (
    <Canvas
      frameloop="always"
      shadows
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      style={{ width: '100%', height: '100%', background: '#050505' }}
    >
      <Suspense fallback={null}>
        <Scene gameState={gameState} />
      </Suspense>
    </Canvas>
  );
}
