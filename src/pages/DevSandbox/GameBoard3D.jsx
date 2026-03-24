/**
 * GameBoard3D.jsx — 3D game board with GSAP-only animations.
 *
 * Architecture:
 *   1. True isometric BoardAlignedGroup (X + Y rotation)
 *   2. Auto knight draw at mount → GSAP flight to knight slots
 *   3. Weapon draw: click P1 deck → staggered flight to hand
 *   4. Hand: FIXED fan positions (no repositioning on add/remove)
 *   5. Play card: separate PlayingCard component (no R3F prop conflicts)
 *   6. Height-reactive FlightShadow via GSAP onUpdate
 *   7. Deck hover lift (P1 weapon deck)
 */
import { useMemo, useRef, useEffect, Suspense, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, useTexture, ContactShadows } from '@react-three/drei';
import { gsap } from 'gsap';
import * as THREE from 'three';
import Card3D, { animatePlayCard } from './Card3D';
import boardImg from '../../assets/gameboard_test.png';

/* ═══════════════════════════════════════════════════════════════════
   LAYOUT CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */

/* ── Table ── */
const TABLE_W  = 16;
const TABLE_H  = TABLE_W / (3615 / 2018);   // update if new image has different aspect

/* ── Camera ── */
const CAM_HEIGHT = 10;
const CAM_ZOOM   = 100;

/* ═══════════════════════════════════════════════════════════════════
   BOARD TILT — Isometric Perspective Control
   ═══════════════════════════════════════════════════════════════════
   Combined X + Y rotations create true isometric foreshortening.

   BOARD_TILT_X: Forward tilt (how much the board "falls away")
     • More negative → steeper, more edge-on
     • Less negative → flatter, more top-down
     • -77° (current) gives strong perspective foreshortening

   BOARD_TILT_Y: Lateral skew (isometric side perspective)
     • 0° = no side perspective
     • Positive → right-side appears nearer
     • ~8° gives subtle 3/4 view matching the background art

   Change these to calibrate the board plane to your gameboard PNG.
   ═══════════════════════════════════════════════════════════════════ */
const BOARD_TILT_X = Math.PI * (-77 / 180);     // ≈ -77° forward tilt
const BOARD_TILT_Y = Math.PI * (8 / 180);       // ≈ +8° lateral isometric skew
const BOARD_SCALE  = 1.50;

/* ── Main Weapon Decks (LEFT, horizontal) ── */
const P1_DECK    = [-4.2, 0.10,  0.6];
const P2_DECK    = [-4.2, 0.10, -0.6];
const DECK_H_ROT = [-Math.PI / 2, 0, Math.PI / 2];

/* ── Knight Decks (RIGHT, vertical) ── */
const P1_KDECK   = [ 4.0, 0.10,  0.6];
const P2_KDECK   = [ 4.0, 0.10, -0.6];
const DECK_V_ROT = [-Math.PI / 2, 0, 0];

/* ── Active Knight slots (centre) ── */
const P1_KNIGHT  = [ 1.5, 0.10,  0.6];
const P2_KNIGHT  = [ 1.5, 0.10, -0.6];

/* ── Equip Slot ── */
const P1_EQUIP   = [ 0.0, 0.10,  0.6];

/* ── Clash Zone ring ── */
const CLASH_POS  = [ 1.5, 0.003, 0];
const CLASH_R_IN = 0.4;
const CLASH_R_OUT= 0.5;

/* ── Player Hand (screen-space, OUTSIDE BoardAlignedGroup) ── */
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
const DRAW_COUNT        = 3;
const CARD_ANIM_DUR     = 0.75;
const FLIGHT_DUR        = 0.65;
const FLIP_DUR          = 0.10;
const ARC_PEAK          = 1.8;
const STACK_TOP         = 0.30;
const OPP_DRAW_DELAY    = 0.6;

/* ── Knight Auto-Draw timings ── */
const KNIGHT_DRAW_DELAY  = 0.5;   // delay after mount before P1 knight draw
const KNIGHT_STAGGER     = 0.5;   // delay between P1 and P2 knight draws
const KNIGHT_FLIGHT_DUR  = 0.75;

/* ── Shadows ── */
const SHADOW_CONTACT_OP = 0.20;
const SHADOW_BLUR       = 3.5;
const SHADOW_GROUND_OP  = 0.30;
const SHADOW_SKY_OP     = 0.03;
const SHADOW_GROUND_SC  = 0.8;
const SHADOW_SKY_SC     = 2.0;
const SHADOW_MAX_H      = 5.0;

/* ── Deck Hover ── */
const DECK_HOVER_LIFT = 0.15;
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

/* ── Helper: compute world-space rotation for a card at a given local
   rotation inside the BoardAlignedGroup ── */
function boardWorldEuler(localEuler) {
  const localQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(...localEuler));
  const groupQ = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(BOARD_TILT_X, BOARD_TILT_Y, 0),
  );
  const worldQ = groupQ.multiply(localQ);
  return new THREE.Euler().setFromQuaternion(worldQ);
}


/* ═══════════════════════════════════════════
   STATIC COMPONENTS
   ═══════════════════════════════════════════ */

function Table() {
  const texture = useTexture(boardImg);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[TABLE_W, TABLE_H]} />
      <meshStandardMaterial map={texture} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

function DeckStack({ position, count, cardRotation = DECK_V_ROT, onClick, hoverLift = 0 }) {
  const groupRef = useRef();
  const layers = Math.min(count, 8);
  const cards = useMemo(() =>
    Array.from({ length: layers }, (_, i) => ({
      key: i,
      pos: [position[0], position[1] + i * 0.03, position[2]],
    })), [position[0], position[1], position[2], layers]);

  const handleOver = useCallback(() => {
    if (!onClick) return;
    document.body.style.cursor = 'pointer';
    if (hoverLift > 0 && groupRef.current) {
      gsap.to(groupRef.current.position, {
        y: hoverLift, duration: DECK_HOVER_DUR, ease: 'power2.out', overwrite: true,
      });
    }
  }, [onClick, hoverLift]);

  const handleOut = useCallback(() => {
    if (!onClick) return;
    document.body.style.cursor = 'default';
    if (hoverLift > 0 && groupRef.current) {
      gsap.to(groupRef.current.position, {
        y: 0, duration: DECK_HOVER_DUR, ease: 'power2.inOut', overwrite: true,
      });
    }
  }, [onClick, hoverLift]);

  return (
    <group ref={groupRef} onClick={onClick} onPointerOver={handleOver} onPointerOut={handleOut}>
      {cards.map(c => (
        <Card3D key={c.key} position={c.pos} rotation={cardRotation} type="back" faceDown />
      ))}
      {count > 0 && (
        <Card3D
          position={[position[0], position[1] + layers * 0.03 + 0.01, position[2]]}
          rotation={cardRotation} type="deck" name={`${count}`}
        />
      )}
    </group>
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

  /* Fixed slot: card._drawIdx determines fan position in a DRAW_COUNT-wide fan */
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
   ═══════════════════════════════════════════ */
function DrawingCard({ card, index, deckWorldPos, deckWorldRot, isOpponent, absoluteDelay, onLanded }) {
  const groupRef  = useRef();
  const shadowRef = useRef();
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
    if (!g || !deckWorldPos) return;

    /* Reset to deck top in world space */
    g.position.set(deckWorldPos.x, deckWorldPos.y, deckWorldPos.z);
    if (deckWorldRot) {
      g.rotation.set(deckWorldRot.x, deckWorldRot.y, deckWorldRot.z);
    } else {
      g.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    }
    g.scale.set(BOARD_SCALE, BOARD_SCALE, BOARD_SCALE);
    g.renderOrder = 20 + index;
    g.visible = true;
    syncShadow(s, g);

    const scaleProxy = { x: BOARD_SCALE };
    const shadowUp   = () => syncShadow(s, g);

    const tl = gsap.timeline({ delay: absoluteDelay });
    tl.addLabel('fly', 0);

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
  }, [index, deckWorldPos, absoluteDelay]);

  return (
    <>
      <group ref={groupRef} visible={false}>
        <Card3D
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
   deck to knight slot (inside BoardAlignedGroup)
   ═══════════════════════════════════════════ */
function KnightDrawCard({ knightData, deckPos, targetPos, delay, onLanded }) {
  const groupRef  = useRef();
  const shadowRef = useRef();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const g = groupRef.current;
    const s = shadowRef.current;
    if (!g) return;

    /* Start face-down at deck top */
    g.position.set(deckPos[0], deckPos[1] + STACK_TOP, deckPos[2]);
    g.rotation.set(-Math.PI / 2, 0, 0);
    g.scale.set(1.2, 1.2, 1.2);
    g.visible = true;
    syncShadow(s, g);

    const scaleProxy = { x: 1.2 };
    const shadowUp = () => syncShadow(s, g);

    const tl = gsap.timeline({ delay });
    tl.addLabel('fly', 0);

    /* XZ: glide to knight slot */
    tl.to(g.position, {
      x: targetPos[0], z: targetPos[2],
      duration: KNIGHT_FLIGHT_DUR, ease: 'power2.inOut', onUpdate: shadowUp,
    }, 'fly');

    /* Y: arc up then land */
    tl.to(g.position, {
      keyframes: [
        { y: 1.2,            duration: KNIGHT_FLIGHT_DUR * 0.4, ease: 'power2.out' },
        { y: targetPos[1],   duration: KNIGHT_FLIGHT_DUR * 0.6, ease: 'power2.in'  },
      ],
      onUpdate: shadowUp,
    }, 'fly');

    /* Face flip via scaleX squish → reveal → unsquish */
    tl.to(scaleProxy, {
      x: 0.02, duration: KNIGHT_FLIGHT_DUR * 0.2, ease: 'power2.in',
      onUpdate: () => g.scale.setX(scaleProxy.x),
    }, `fly+=${KNIGHT_FLIGHT_DUR * 0.35}`);
    tl.add(() => setRevealed(true));
    tl.to(scaleProxy, {
      x: 1.2, duration: KNIGHT_FLIGHT_DUR * 0.2, ease: 'power1.out',
      onUpdate: () => g.scale.setX(scaleProxy.x),
    });

    /* Wobble on landing */
    tl.to(g.rotation, {
      keyframes: [
        { y: 0.08, duration: 0.06, ease: 'sine.out' },
        { y: -0.04, duration: 0.06, ease: 'sine.inOut' },
        { y: 0, duration: 0.06, ease: 'sine.in' },
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
          faceDown={!revealed}
          type={revealed ? 'knight' : 'back'}
          name={revealed ? knightData.name : ''}
          atk={revealed ? knightData.atk : undefined}
          def={revealed ? knightData.def : undefined}
          pa={revealed ? knightData.pa : undefined}
          scale={1.2}
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

  /* ── Refs ── */
  const boardGroupRef = useRef();

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
    const iso = boardGroupRef.current;
    if (!iso) return;
    iso.updateMatrixWorld();

    const p1Top = new THREE.Vector3(P1_DECK[0], P1_DECK[1] + STACK_TOP, P1_DECK[2]);
    p1Top.applyMatrix4(iso.matrixWorld);

    const p2Top = new THREE.Vector3(P2_DECK[0], P2_DECK[1] + STACK_TOP, P2_DECK[2]);
    p2Top.applyMatrix4(iso.matrixWorld);

    /* Pre-compute world rotation for cards sitting on the deck */
    const wr = boardWorldEuler(DECK_H_ROT);

    setDrawData({
      cards: SAMPLE_DRAW.slice(0, DRAW_COUNT),
      p1World: p1Top,
      p2World: p2Top,
      deckWorldRot: { x: wr.x, y: wr.y, z: wr.z },
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

  /* ── Play card from hand → equip slot ──
     Removes card from hand IMMEDIATELY, then mounts a PlayingCard
     which runs the GSAP animation independently (no R3F prop conflict). */
  const handlePlayCard = useCallback((drawIdx, cardGroup) => {
    if (!cardGroup) return;

    /* Capture position before React unmounts the HandCard */
    const startPos = {
      x: cardGroup.position.x,
      y: cardGroup.position.y,
      z: cardGroup.position.z,
    };
    const card = playerHand.find(c => c._drawIdx === drawIdx);

    /* Compute world-space equip target */
    const iso = boardGroupRef.current;
    const target = { x: 0, y: 0.1, z: 0, rotX: -Math.PI / 2, rotY: 0, rotZ: 0 };
    if (iso) {
      iso.updateMatrixWorld();
      const v = new THREE.Vector3(...P1_EQUIP).applyMatrix4(iso.matrixWorld);
      target.x = v.x; target.y = v.y; target.z = v.z;
      const wr = boardWorldEuler(DECK_V_ROT);
      target.rotX = wr.x; target.rotY = wr.y; target.rotZ = wr.z;
    }

    /* Remove from hand immediately → mount PlayingCard */
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

  return (
    <>
      {/* ── Camera ── */}
      <OrthographicCamera
        makeDefault
        position={[0, CAM_HEIGHT, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        zoom={CAM_ZOOM}
        near={0.1} far={100}
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

      {/* ── BoardAlignedGroup ──
          True isometric: combined X + Y rotation.
          ALL board-level objects (decks, knights, clash) go inside. */}
      <group
        ref={boardGroupRef}
        rotation={[BOARD_TILT_X, BOARD_TILT_Y, 0]}
        scale={BOARD_SCALE}
      >
        {/* Main Weapon Decks (LEFT) — P1 has hover lift */}
        <DeckStack
          position={P1_DECK} count={p1?.weaponsLeft ?? 45}
          cardRotation={DECK_H_ROT} onClick={handleDraw}
          hoverLift={DECK_HOVER_LIFT}
        />
        <DeckStack
          position={P2_DECK} count={p2?.weaponsLeft ?? 45}
          cardRotation={DECK_H_ROT}
        />

        {/* Knight Decks (RIGHT) — count decreases after knight draw */}
        <DeckStack
          position={P1_KDECK}
          count={(p1?.cardsLeft ?? 5) - (knightsPhase !== 'idle' ? 1 : 0)}
        />
        <DeckStack
          position={P2_KDECK}
          count={(p2?.cardsLeft ?? 5) - (p2KnightReady || knightsPhase === 'drawing' ? 1 : 0)}
        />

        {/* ── Knight Auto-Draw Animations ── */}
        {knightsPhase === 'drawing' && !p1KnightReady && (
          <KnightDrawCard
            knightData={SAMPLE_KNIGHTS.p1}
            deckPos={P1_KDECK}
            targetPos={P1_KNIGHT}
            delay={0}
            onLanded={() => setP1KnightReady(true)}
          />
        )}
        {knightsPhase === 'drawing' && !p2KnightReady && (
          <KnightDrawCard
            knightData={SAMPLE_KNIGHTS.p2}
            deckPos={P2_KDECK}
            targetPos={P2_KNIGHT}
            delay={KNIGHT_STAGGER}
            onLanded={() => setP2KnightReady(true)}
          />
        )}

        {/* ── Landed Knights (static, face up, always visible) ── */}
        {p1KnightReady && (
          <Card3D position={P1_KNIGHT} rotation={DECK_V_ROT} type="knight"
                  name={SAMPLE_KNIGHTS.p1.name} atk={SAMPLE_KNIGHTS.p1.atk}
                  def={SAMPLE_KNIGHTS.p1.def} pa={SAMPLE_KNIGHTS.p1.pa} scale={1.2} />
        )}
        {p2KnightReady && (
          <Card3D position={P2_KNIGHT} rotation={DECK_V_ROT} type="knight"
                  name={SAMPLE_KNIGHTS.p2.name} atk={SAMPLE_KNIGHTS.p2.atk}
                  def={SAMPLE_KNIGHTS.p2.def} pa={SAMPLE_KNIGHTS.p2.pa} scale={1.2} />
        )}

        {/* Clash Zone ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={CLASH_POS}>
          <ringGeometry args={[CLASH_R_IN, CLASH_R_OUT, 32]} />
          <meshStandardMaterial
            color="#8a0303" emissive="#8a0303" emissiveIntensity={0.5}
            transparent opacity={0.45} side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* ── Player Drawing Cards ── */}
      {drawData && drawData.cards.map((card, i) =>
        !landedP1.has(i) && (
          <DrawingCard
            key={`p1draw-${i}`}
            card={card} index={i}
            deckWorldPos={drawData.p1World}
            deckWorldRot={drawData.deckWorldRot}
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
            deckWorldPos={drawData.p2World}
            deckWorldRot={drawData.deckWorldRot}
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
