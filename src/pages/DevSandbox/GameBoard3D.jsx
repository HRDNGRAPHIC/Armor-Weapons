/**
 * GameBoard3D.jsx — Tavolo di gioco 3D con animazioni solo GSAP.
 *
 * Architettura:
 *   1. Dizionario CONFIG_3D: posizione / rotazione / scala per ogni elemento
 *      Nessuna rotazione globale del gruppo — ogni mesh è posizionata in modo indipendente.
 *   2. Estrazione automatica del cavaliere al mount → volo GSAP dal mazzo allo slot centrale
 *   3. Estrazione armi: click sul mazzo G1 → volo scalato verso la mano
 *   4. Mano: posizioni a ventaglio FISSE (nessun riposizionamento all'aggiunta/rimozione)
 *   5. Giocata carta: componente PlayingCard separato (nessun conflitto di props R3F)
 *   6. FlightShadow reattiva all'altezza tramite onUpdate di GSAP
 *   7. Sollevamento al hover del mazzo (mazzo armi G1)
 */
import { useMemo, useRef, useEffect, Suspense, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerspectiveCamera, useTexture, Html } from '@react-three/drei';
import { gsap } from 'gsap';
import * as THREE from 'three';
import Card3D from './Card3D';
import useGameStore from './useGameStore';
import VFXManager from './vfx/VFXManager';
import boardImg from '../../assets/gameboard_test.png';

/* Pre-caricamento texture board — previene Suspense remount */
useTexture.preload(boardImg);


/* ╔═══════════════════════════════════════════════════════════════════╗
   ║  CONFIG_3D — Dizionario di Configurazione Spaziale                ║
   ║                                                                   ║
   ║  Ogni elemento del tabellone legge posizione/rotazione/scala qui. ║
   ║  Modifica qualsiasi valore per un posizionamento al millimetro.   ║
   ║                                                                   ║
   ║  Sistema di coordinate (PerspectiveCamera che guarda verso Y):    ║
   ║    X → destra          positivo = destra sullo schermo            ║
   ║    Y → su              positivo = verso la telecamera (altezza)   ║
   ║    Z → verso giocatore positivo = in basso sullo schermo          ║
   ║                                                                   ║
   ║  La rotazione è [rx, ry, rz] in radianti.                         ║
   ║    • Carte piatte sul tavolo:  rotation = [-π/2, 0, 0]            ║
   ║    • Carte piatte di lato:     rotation = [-π/2, 0, π/2]          ║
   ║                                                                   ║
   ║  perspX / perspY — Inclinazione Prospettica per Elemento          ║
   ║    Inclina l'elemento per mostrarne il bordo/spessore — come      ║
   ║    la vecchia inclinazione globale, ma indipendente per oggetto.  ║
   ║    Valori in RADIANTI, aggiunti alla rotazione base dell'elemento. ║
   ║      perspX: 0  → inclinazione avanti/indietro (a rotation[0])    ║
   ║      perspY: 0  → inclinazione sinistra/destra (a rotation[2])    ║
   ║    Prova ±0.1 – ±0.5 per un effetto di profondità 3D visibile.   ║
   ╚═══════════════════════════════════════════════════════════════════╝ */
const CONFIG_3D = {

  /* ─────────────────────────────────────────────────
     Tavolo / Immagine di sfondo
     ───────────────────────────────────────────────── */
  table: {
    width:    16,
    height:   16 / (3615 / 2018),            // corrisponde al formato di gameboard_test.png
    position: [0, -0.01, 0],
    rotation: [-Math.PI / 2, 0, 0],
    scale:    [1, 1, 1],
    perspX:   0,
    perspY:   0,
    shadowConfig: null,                      
    topSkew:    [0, 0],                       // traslazione XY dei vertici della metà superiore (Y > 0); [0,0] = nessuna deformazione
    bottomSkew: [0, 0],                       // traslazione XY dei vertici della metà inferiore (Y < 0); [0,0] = nessuna deformazione
  },

  /* ─────────────────────────────────────────────────
     Mazzo Principale Armi del Giocatore (zona sinistra sotto)
     Carte impilate orizzontalmente (ruotate 90° su Z).
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
    leftSkew:   [0, 0],
    rightSkew:  [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Mazzo Principale Armi Avversario (area in alto a sinistra, specchiato)
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
    leftSkew:   [0, 0],
    rightSkew:  [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Mazzo Cavalieri del Giocatore (area in basso a destra)
     Carte impilate verticalmente (nessuna rotazione su Z).
     ───────────────────────────────────────────────── */
  playerKnightDeck: {
    position: [5.66, 0.10, 0.3],
    rotation: [-Math.PI / 2, 0, Math.PI / 2],
    scale:    [1.45, 1.45, 1.45],
    perspX:   -0.14,
    perspY:   0,
    shadowConfig: { opacity: 0.30, blur: 1, scale: 3.2, offset: [0, 0], far: 1.2, rightSkew:  [0, 0.03], leftSkew:   [0, -0.03] },
    topSkew:    [0, 0],
    bottomSkew: [0, 0],
    leftSkew:   [0, -0.03],
    rightSkew:  [0, 0.03],
  },

  /* ─────────────────────────────────────────────────
     Mazzo Cavalieri Avversario (area in alto a destra, specchiato)
     ───────────────────────────────────────────────── */
  opponentKnightDeck: {
    position: [5.48, 0.10, -1.2],
    rotation: [-Math.PI / 2, 0, Math.PI / 2],
    scale:    [1.45, 1.45, 1.45],
    perspX:   -0.2,
    perspY:   0,
    shadowConfig: { opacity: 0.50, blur: 2.5, scale: 3.2, offset: [0, 0], far: 1.2 },
    topSkew:    [0, 0],
    bottomSkew: [0, 0],
    leftSkew:   [0, -0.03],
    rightSkew:  [0, 0.03],
  },

  /* ─────────────────────────────────────────────────
     Slot Cavaliere del Giocatore (centro, leggermente a SINISTRA)
     Dove la carta cavaliere attertra dopo l'estrazione.
     Rotazione = [-π/2, 0, 0] → piatta, faccia in su, leggibile.
     ───────────────────────────────────────────────── */
  playerKnightSlot: {
    position: [-1.26, 0.10, -0.45],
    rotation: [-Math.PI / 2, 0, 0],
    scale:    [1.6, 1.6, 1.6],
    perspX:   0,
    perspY:   0,
    shadowConfig: null,
    topSkew:    [0.03, 0],
    bottomSkew: [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Slot Cavaliere Avversario (centro, leggermente a DESTRA)
     ───────────────────────────────────────────────── */
  opponentKnightSlot: {
    position: [1.26, 0.10, -0.45],
    rotation: [-Math.PI / 2, 0, 0],
    scale:    [1.6, 1.6, 1.6],
    perspX:   0,
    perspY:   0,
    shadowConfig: null,
    topSkew:    [-0.03, 0],
    bottomSkew: [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Zona di Scontro — anello rosso tra i due cavalieri.
     Si trova nell'esatto centro geometrico [0, 0, 0].
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
     Slot Equipaggiamento Giocatore (dove le carte arma atterrano dopo la giocata)
     ───────────────────────────────────────────────── */
  playerEquipSlot: {
    position: [-2.8, 0.10, 0],
    rotation: [-Math.PI / 2, 0, 0],
    scale:    [1, 1, 1],
    perspX:   0,
    perspY:   0,
    shadowConfig: null,
    topSkew:    [0.03, 0],
    bottomSkew: [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Slot Azione Giocatore (a sinistra del cavaliere)
     Dove le carte arma atterrano prima della dissoluzione.
     Scala uguale a playerKnightSlot.
     ───────────────────────────────────────────────── */
  playerActionSlot: {
    position: [-3.5, 0.10, -0.45],
    rotation: [-Math.PI / 2, 0, 0],
    scale:    [1.6, 1.6, 1.6],
    perspX:   0,
    perspY:   0,
    shadowConfig: null,
    topSkew:    [0, 0],
    bottomSkew: [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Slot Azione Avversario (a destra del cavaliere avversario)
     Controparte specchiata.
     ───────────────────────────────────────────────── */
  opponentActionSlot: {
    position: [3.5, 0.10, -0.45],
    rotation: [-Math.PI / 2, 0, 0],
    scale:    [1.6, 1.6, 1.6],
    perspX:   0,
    perspY:   0,
    shadowConfig: null,
    topSkew:    [0, 0],
    bottomSkew: [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Terreno Attivo — slot visuale per la carta terreno
     Posizione fisso in alto a sinistra, frontale alla camera.
     ───────────────────────────────────────────────── */
  activeTerrain: {
    position: [-7.5, 0.12, -3.2],
    rotation: [-Math.PI / 2, 0, 0],
    scale:    [1.8, 1.8, 1.8],
    perspX:   0,
    perspY:   0,
    topSkew:    [0, 0],
    bottomSkew: [0, 0],
  },

  /* ─────────────────────────────────────────────────
     Mano del Giocatore — parametri globali del ventaglio
     ───────────────────────────────────────────────── */
  playerHandConfig: {
    baseY:   0.03,
    baseZ:   4.0,
    scale:   2.4,
    gap:     1.4,
    fanRot:  0.03,
    zStep:   0.003,
    hoverLiftY:      0.35,    // sollevamento Y al hover
    hoverLiftZ:     -0.5,     // avvicinamento Z al hover (negativo = verso camera)
    hoverScale:      1.12,    // fattore scala al hover (moltiplicato per scale)
    hoverDuration:   0.18,    // durata animazione hover in (secondi)
    hoverOutDuration: 0.22,   // durata animazione hover out (secondi)
  },

  /* ─────────────────────────────────────────────────
     Hotzone Scarto — stato della carta quando entra nell'area
     ───────────────────────────────────────────────── */
  hotzoneCardState: {
    rotation: [0, 0, Math.PI / 2],        // rotazione XYZ applicata alla carta in hotzone
    scaleFactor: 0.85,                     // fattore scala (moltiplicato per HAND_CARD_SC)
    tintColor: '#ff4444',                  // colore tinta bordo (futuro)
  },

  /* ─────────────────────────────────────────────────
     Mano dell'Avversario — parametri globali del ventaglio
     Modifica 'scale' per ingrandire/rimpicciolire le carte nemiche.
     ───────────────────────────────────────────────── */
  opponentHandConfig: {
    baseY:         0.12,
    baseZ:        -4.0,
    scale:         1.8,
    gap:           0.72,
    fanRot:        0.065,
    yCurve:        0.06,
    zStep:         0.005,
    hoverYOffset:  0.30,
  },
};

/**
 * perspPos — Restituisce cfg.position come array semplice.
 * Usare al posto di cfg.position direttamente, così tutto il posizionamento passa per un resolver centrale.
 */
function perspPos(cfg) {
  return [...cfg.position];
}

/**
 * perspRot — Risolve la rotazione finale [rx, ry, rz] per un elemento CONFIG_3D.
 * perspX viene aggiunto a rotation[0] (inclinazione avanti/indietro → mostra lo spessore sul bordo Z).
 * perspY viene aggiunto a rotation[2] (inclinazione sinistra/destra → mostra lo spessore sul bordo X).
 * I valori sono in radianti. Usare ±0.1 – ±0.5 per un effetto di profondità 3D visibile.
 */
function perspRot(cfg) {
  return [
    cfg.rotation[0] + (cfg.perspX || 0),
    cfg.rotation[1],
    cfg.rotation[2] + (cfg.perspY || 0),
  ];
}


/* ═══════════════════════════════════════════════════════════════════
   COSTANTI DI GIOCO (non spaziali)
   ═══════════════════════════════════════════════════════════════════ */

/* ── Camera ── */
const CAM_HEIGHT = 14;
const CAM_FOV    = 35;

/* ── Mano del Giocatore (spazio-schermo, fuori da qualsiasi gruppo del tabellone) ── */
const HAND_Y       = CONFIG_3D.playerHandConfig.baseY;
const HAND_Z       = CONFIG_3D.playerHandConfig.baseZ;
const HAND_CARD_SC = CONFIG_3D.playerHandConfig.scale;
const HAND_SPREAD  = CONFIG_3D.playerHandConfig.gap;
const HAND_FAN_ROT = CONFIG_3D.playerHandConfig.fanRot;
const HAND_Z_STEP  = CONFIG_3D.playerHandConfig.zStep;

/* ── Mano dell'Avversario ── */
const OPP_HAND_BASE_Y = CONFIG_3D.opponentHandConfig.baseY;
const OPP_HAND_HOVER_Y_OFFSET = CONFIG_3D.opponentHandConfig.hoverYOffset;
const OPP_HAND_Z  = CONFIG_3D.opponentHandConfig.baseZ;
const OPP_HAND_SC = CONFIG_3D.opponentHandConfig.scale;
const OPP_SPREAD  = CONFIG_3D.opponentHandConfig.gap;
const OPP_FAN_ROT = CONFIG_3D.opponentHandConfig.fanRot;
const OPP_Y_CURVE = CONFIG_3D.opponentHandConfig.yCurve;
const OPP_Z_STEP  = CONFIG_3D.opponentHandConfig.zStep;

/* ── Tempi della Fase di Pesca ── */
const MAX_HAND_SIZE  = 3;
const CARD_ANIM_DUR  = 0.75;
const FLIGHT_DUR     = 0.65;
const FLIP_DUR       = 0.10;
const ARC_PEAK       = 1.8;
const STACK_TOP      = 0.30;
const OPP_DRAW_DELAY = 0.15;

/* ── Tempi Estrazione Automatica Cavaliere ── */
const KNIGHT_DRAW_DELAY = 0.5;    // secondi dopo il mount prima dell'estrazione cavaliere G1
const KNIGHT_STAGGER    = 0.5;    // secondi tra le estrazioni del cavaliere G1 e G2
const KNIGHT_FLIGHT_DUR = 0.80;   // durata totale del volo
const KNIGHT_ARC_PEAK   = 1.6;    // altezza Y all'apice dell'arco

/* ── Ombre in volo (FlightShadow) ── */
const SHADOW_GROUND_OP  = 0.30;
const SHADOW_SKY_OP     = 0.03;
const SHADOW_GROUND_SC  = 0.8;
const SHADOW_SKY_SC     = 2.0;
const SHADOW_MAX_H      = 5.0;

/* ── Hover Mazzo ── */
const DECK_HOVER_LIFT = 0.04;
const DECK_HOVER_DUR  = 0.25;

/* ── Hover Mano Giocatore ── */
const HAND_HOVER_LIFT_Y  = CONFIG_3D.playerHandConfig.hoverLiftY;
const HAND_HOVER_LIFT_Z  = CONFIG_3D.playerHandConfig.hoverLiftZ;
const HAND_HOVER_SC_MULT = CONFIG_3D.playerHandConfig.hoverScale;
const HAND_HOVER_IN_DUR  = CONFIG_3D.playerHandConfig.hoverDuration;
const HAND_HOVER_OUT_DUR = CONFIG_3D.playerHandConfig.hoverOutDuration;

/* ── Hotzone Scarto (area rettangolare tra i due mazzi principali) ── */
const HOTZONE_X_MIN = CONFIG_3D.playerMainDeck.position[0] - 1.5;
const HOTZONE_X_MAX = CONFIG_3D.playerMainDeck.position[0] + 1.5;
const HOTZONE_Z_MIN = CONFIG_3D.opponentMainDeck.position[2] - 0.5;
const HOTZONE_Z_MAX = CONFIG_3D.playerMainDeck.position[2] + 0.5;
const HOTZONE_W     = HOTZONE_X_MAX - HOTZONE_X_MIN;
const HOTZONE_H     = HOTZONE_Z_MAX - HOTZONE_Z_MIN;
const HOTZONE_CX    = (HOTZONE_X_MIN + HOTZONE_X_MAX) / 2;
const HOTZONE_CZ    = (HOTZONE_Z_MIN + HOTZONE_Z_MAX) / 2;

/* ── Hotzone Card State (from CONFIG_3D) ── */
const HZ_ROT          = CONFIG_3D.hotzoneCardState.rotation;
const HZ_SCALE_FACTOR = CONFIG_3D.hotzoneCardState.scaleFactor;

/* ── Debug: impostare a true per visualizzare la hotzone ── */
const DEBUG_HOTZONE = false;

/* ── Animazione Rivelazione Terreno ── */
const TERRAIN_REVEAL_RISE_DUR  = 0.50;  // volo dal mazzo al centro
const TERRAIN_REVEAL_STALL     = 1.00;  // pausa a mezz'aria per leggere
const TERRAIN_REVEAL_FLY_DUR   = 0.45;  // volo dal centro alla posizione finale
const TERRAIN_REVEAL_ARC_PEAK  = 2.5;   // altezza massima durante il volo
const TERRAIN_REVEAL_STALL_SC  = 2.8;   // scala durante lo stallo

/* ── Tempi sequenza giocata carta ── */
const RISE_DUR         = 0.40;   // mano → centro schermo
const STALL_DUR        = 0.60;   // pausa a mezz'aria
const SWOOP_DUR        = 0.30;   // centro schermo → slot azione
const STALL_SC         = 2.2;    // scala della carta durante lo stallo
const STALL_Y          = 3.5;    // altezza Y durante lo stallo (sopra il tavolo)
const STALL_Z          = 0.5;    // posizione Z durante lo stallo (vicino al centro)
const DISSOLVE_DELAY   = 0.3;    // attesa dopo l'atterraggio prima della combustione
const DISSOLVE_DUR     = 1.5;    // durata dell'animazione di combustione
const ARC_DUR          = 1.3;    // tempo di percorrenza dell'arco energetico magico
const ARC_DELAY_IN_DIS = 0.5;    // l'arco si avvia a questi secondi dall'inizio della dissoluzione

/* ── Tempi attacco fisico cavaliere ── */
const ATTACK_LIFT_Y    = 0.35;   // quanto il cavaliere si solleva prima dell'affondo
const ATTACK_LIFT_DUR  = 0.18;   // durata fase di sollevamento
const ATTACK_LUNGE_DUR = 0.14;   // durata dello scatto verso il bersaglio
const ATTACK_FLASH_CNT = 3;      // numero di lampeggi emissivi rossi sul bersaglio
const ATTACK_FLASH_DUR = 0.18;   // durata di ogni lampeggio
const ATTACK_RETURN_DUR = 0.40;  // durata del ritorno alla posizione di riposo

/* ── Sample data rimosso — il motore usa useGameStore ── */


/* ═══════════════════════════════════════════
   COMPONENTI STATICI
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
      <points ref={ptsRef} raycast={() => null}>
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

  const cards = useMemo(() =>
    Array.from({ length: layers }, (_, i) => ({
      key: i,
      pos: [0, i * 0.03, 0],
    })), [layers]);

  /* topY = just above the highest card, in local group space */
  const topY = layers * 0.03 + 0.06;

  const handleOver = useCallback((e) => {
    e?.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
    if (onClick && hoverLift > 0 && groupRef.current) {
      gsap.to(groupRef.current.position, {
        y: baseY + hoverLift, duration: DECK_HOVER_DUR, ease: 'power2.out', overwrite: true,
      });
    }
  }, [onClick, hoverLift, baseY]);

  const handleOut = useCallback((e) => {
    e?.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'default';
    if (onClick && hoverLift > 0 && groupRef.current) {
      gsap.to(groupRef.current.position, {
        y: baseY, duration: DECK_HOVER_DUR, ease: 'power2.inOut', overwrite: true,
      });
    }
  }, [onClick, hoverLift, baseY]);

  return (
    <>
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
            topSkew={cfg.topSkew ?? [0, 0]} bottomSkew={cfg.bottomSkew ?? [0, 0]}
            leftSkew={cfg.leftSkew ?? [0, 0]} rightSkew={cfg.rightSkew ?? [0, 0]} />
        ))}
        {count > 0 && (
          <Card3D
            position={[0, layers * 0.03 + 0.01, 0]}
            rotation={perspRot(cfg)} type="deck" name={`${count}`}
            topSkew={cfg.topSkew ?? [0, 0]} bottomSkew={cfg.bottomSkew ?? [0, 0]}
            leftSkew={cfg.leftSkew ?? [0, 0]} rightSkew={cfg.rightSkew ?? [0, 0]}
          />
        )}
        {/* Ethereal hover particles, floating above the top card */}
        <DeckParticles active={hovered} topY={topY} />
      </group>
    </>
  );
}


/* ═══════════════════════════════════════════
   OMBRA IN VOLO
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
   CARTA IN MANO — posizioni centrate dinamicamente + Drag & Drop per scarto.
   Trascinare nella Hotzone (tra i due mazzi) → ruota + rilascio = burn + scarto.
   ═══════════════════════════════════════════ */

/* ── Flag globale: qualcuno sta trascinando → disabilita hover su tutte le HandCard ── */
let _anyDragging = false;

/* Piano di riferimento per il drag (Y=0, il tavolo) */
const _dragPlane   = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _dragInter   = new THREE.Vector3();
const _dragPointer = new THREE.Vector2();

function HandCard({ card, onPlay, onDiscard, visibleIndex, visibleCount }) {
  const groupRef   = useRef();
  const initialSet = useRef(false);
  const dragging   = useRef(false);
  const dragStart  = useRef(null);        // { worldX, worldZ, gx, gz } al pointerDown
  const inHotzone  = useRef(false);
  const didDrag    = useRef(false);        // true se il trascinamento ha superato la soglia
  const isHovered  = useRef(false);
  const { camera, gl } = useThree();

  /* Calcolo posizione centrata in base all'indice visibile */
  const offset = visibleIndex - (visibleCount - 1) / 2;
  const posX   = offset * HAND_SPREAD;
  const posY   = HAND_Y + visibleIndex * HAND_Z_STEP;
  const posZ   = HAND_Z + visibleIndex * 0.005;
  const rotZ   = -offset * HAND_FAN_ROT;

  /* Rest position ref — aggiornato quando cambiano i target */
  const restPos = useRef({ x: posX, y: posY, z: posZ, rz: rotZ });
  restPos.current = { x: posX, y: posY, z: posZ, rz: rotZ };

  /* GSAP lerp verso la nuova posizione quando cambia visibleIndex/visibleCount */
  useEffect(() => {
    const g = groupRef.current;
    if (!g || dragging.current) return;
    if (!initialSet.current) {
      g.position.set(posX, posY, posZ);
      g.rotation.set(-Math.PI / 2, 0, rotZ);
      g.scale.set(HAND_CARD_SC, HAND_CARD_SC, HAND_CARD_SC);
      initialSet.current = true;
    } else {
      gsap.to(g.position, { x: posX, y: posY, z: posZ, duration: 0.35, ease: 'power2.out', overwrite: true });
      gsap.to(g.rotation, { z: rotZ, duration: 0.35, ease: 'power2.out', overwrite: true });
    }
  }, [posX, posY, posZ, rotZ]);

  /* ── Hover In: solleva + ingrandisci (solo se nessuno sta trascinando) ── */
  const handlePointerOver = useCallback((e) => {
    e.stopPropagation();
    if (_anyDragging || dragging.current || isHovered.current) return;
    const g = groupRef.current;
    if (!g || g.userData?.isPlaying) return;
    isHovered.current = true;
    document.body.style.cursor = 'pointer';
    g.renderOrder = 100;
    const hoverSc = HAND_CARD_SC * HAND_HOVER_SC_MULT;
    gsap.to(g.position, {
      y: restPos.current.y + HAND_HOVER_LIFT_Y,
      z: restPos.current.z + HAND_HOVER_LIFT_Z,
      duration: HAND_HOVER_IN_DUR, ease: 'power2.out', overwrite: true,
    });
    gsap.to(g.scale, {
      x: hoverSc, y: hoverSc, z: hoverSc,
      duration: HAND_HOVER_IN_DUR, ease: 'power2.out', overwrite: true,
    });
  }, []);

  /* ── Hover Out: torna a riposo ── */
  const handlePointerOut = useCallback(() => {
    if (!isHovered.current || dragging.current) return;
    isHovered.current = false;
    document.body.style.cursor = 'default';
    const g = groupRef.current;
    if (!g) return;
    g.renderOrder = 10 + visibleIndex;
    gsap.to(g.position, {
      y: restPos.current.y, z: restPos.current.z,
      duration: HAND_HOVER_OUT_DUR, ease: 'power2.inOut', overwrite: true,
    });
    gsap.to(g.scale, {
      x: HAND_CARD_SC, y: HAND_CARD_SC, z: HAND_CARD_SC,
      duration: HAND_HOVER_OUT_DUR, ease: 'power2.inOut', overwrite: true,
    });
  }, [visibleIndex]);

  /* ── Raycast dal puntatore al piano Y=0 ── */
  const worldFromEvent = useCallback((e) => {
    const rect = gl.domElement.getBoundingClientRect();
    const nativeEvt = e.nativeEvent ?? e;
    _dragPointer.set(
      ((nativeEvt.clientX - rect.left) / rect.width)  * 2 - 1,
      -((nativeEvt.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(_dragPointer, camera);
    ray.ray.intersectPlane(_dragPlane, _dragInter);
    return { x: _dragInter.x, z: _dragInter.z };
  }, [camera, gl]);

  /* ── Pointer Down: inizia drag ── */
  const handlePointerDown = useCallback((e) => {
    e.stopPropagation();
    const g = groupRef.current;
    if (!g) return;
    const hit = worldFromEvent(e);
    dragStart.current = { worldX: hit.x, worldZ: hit.z, gx: g.position.x, gz: g.position.z };
    dragging.current = true;
    _anyDragging = true;
    didDrag.current = false;
    inHotzone.current = false;
    /* Annulla hover attivo */
    if (isHovered.current) {
      isHovered.current = false;
    }
    gsap.killTweensOf(g.position);
    gsap.killTweensOf(g.rotation);
    gsap.killTweensOf(g.scale);
    /* Ripristina scala base (cancella eventuale hover scale) */
    g.scale.set(HAND_CARD_SC, HAND_CARD_SC, HAND_CARD_SC);
    g.renderOrder = 100;
    /* Cattura il pointer a livello DOM per ricevere eventi fuori dal canvas/mesh */
    (e.target ?? gl.domElement).setPointerCapture?.(e.pointerId);
  }, [worldFromEvent, gl]);

  /* ── Pointer Move: trascina ── */
  const handlePointerMove = useCallback((e) => {
    if (!dragging.current || !dragStart.current) return;
    e.stopPropagation();
    const g = groupRef.current;
    if (!g) return;
    const hit = worldFromEvent(e);
    const dx = hit.x - dragStart.current.worldX;
    const dz = hit.z - dragStart.current.worldZ;
    /* Soglia minima per considerare "drag" (evita click accidentali) */
    if (!didDrag.current && Math.abs(dx) + Math.abs(dz) > 0.15) {
      didDrag.current = true;
    }
    const newX = dragStart.current.gx + dx;
    const newZ = dragStart.current.gz + dz;
    g.position.x = newX;
    g.position.z = newZ;

    /* Controlla Hotzone */
    const inside = newX >= HOTZONE_X_MIN && newX <= HOTZONE_X_MAX &&
                   newZ >= HOTZONE_Z_MIN && newZ <= HOTZONE_Z_MAX;
    if (inside && !inHotzone.current) {
      inHotzone.current = true;
      gsap.to(g.rotation, { z: HZ_ROT[2], duration: 0.2, ease: 'power2.out', overwrite: true });
      const hzSc = HAND_CARD_SC * HZ_SCALE_FACTOR;
      gsap.to(g.scale, { x: hzSc, y: hzSc, z: hzSc, duration: 0.2, ease: 'power2.out', overwrite: true });
    } else if (!inside && inHotzone.current) {
      inHotzone.current = false;
      gsap.to(g.rotation, { z: restPos.current.rz, duration: 0.2, ease: 'power2.out', overwrite: true });
      gsap.to(g.scale, { x: HAND_CARD_SC, y: HAND_CARD_SC, z: HAND_CARD_SC, duration: 0.2, ease: 'power2.out', overwrite: true });
    }
  }, [worldFromEvent]);

  /* ── Pointer Up: rilascia ── */
  const handlePointerUp = useCallback((e) => {
    if (!dragging.current) return;
    e.stopPropagation();
    dragging.current = false;
    _anyDragging = false;
    dragStart.current = null;
    const g = groupRef.current;
    if (!g) return;
    g.renderOrder = 10 + visibleIndex;
    (e.target ?? gl.domElement).releasePointerCapture?.(e.pointerId);

    if (inHotzone.current && didDrag.current) {
      /* ── Scarta: la carta è nella hotzone → lancia burn ── */
      inHotzone.current = false;
      if (onDiscard) onDiscard(card._drawIdx, card._slotIdx, g);
    } else {
      /* ── Snap back: torna alla posizione di riposo ── */
      inHotzone.current = false;
      gsap.to(g.position, {
        x: restPos.current.x, y: restPos.current.y, z: restPos.current.z,
        duration: 0.4, ease: 'elastic.out(1, 0.5)', overwrite: true,
      });
      gsap.to(g.rotation, {
        z: restPos.current.rz,
        duration: 0.3, ease: 'power2.out', overwrite: true,
      });
      gsap.to(g.scale, {
        x: HAND_CARD_SC, y: HAND_CARD_SC, z: HAND_CARD_SC,
        duration: 0.3, ease: 'power2.out', overwrite: true,
      });
    }
  }, [visibleIndex, gl, onDiscard, card._drawIdx, card._slotIdx]);

  /* Click singolo = gioca carta (solo se non c'è stato un drag significativo) */
  const handleClick = useCallback(() => {
    if (didDrag.current) return;
    if (!groupRef.current || !onPlay) return;
    if (groupRef.current.userData?.isPlaying) return;
    onPlay(card._drawIdx, groupRef.current);
  }, [card._drawIdx, onPlay]);

  return (
    <group
      ref={groupRef}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      renderOrder={10 + visibleIndex}
    >
      <Card3D
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
        scale={1}
        type={card?.type || 'arma'}
        name={card?.name || '?'}
        bonus={card?.bonus}
        desc={card?.desc}
        cu={card?.cu}
        renderOrder={10 + visibleIndex}
      />
    </group>
  );
}

function OppHandCard({ visibleIndex, visibleCount, card }) {
  const groupRef  = useRef();
  const [revealed, setRevealed] = useState(false);
  const hoverTl   = useRef(null);
  const initialSet = useRef(false);

  const offset = visibleIndex - (visibleCount - 1) / 2;
  const restX  = offset * OPP_SPREAD;
  /* Arco parabolico Y: le carte ai lati scendono leggermente */
  const restY  = OPP_HAND_BASE_Y + visibleIndex * OPP_Z_STEP - OPP_Y_CURVE * offset * offset;
  const restZ  = OPP_HAND_Z - visibleIndex * 0.005;
  const rotZ   = offset * OPP_FAN_ROT;

  /* Posizionamento dinamico con GSAP lerp quando indice/conteggio cambia */
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    if (!initialSet.current) {
      g.position.set(restX, restY, restZ);
      g.rotation.set(-Math.PI / 2, 0, rotZ);
      g.scale.set(OPP_HAND_SC, OPP_HAND_SC, OPP_HAND_SC);
      initialSet.current = true;
    } else {
      gsap.to(g.position, { x: restX, y: restY, duration: 0.35, ease: 'power2.out', overwrite: true });
      gsap.to(g.rotation, { z: rotZ, duration: 0.35, ease: 'power2.out', overwrite: true });
    }
  }, [restX, restY, restZ, rotZ]);

  /* ── Hover In: Scale-X flip (squash→reveal→unsquash) + avvicinamento camera ── */
  const handleOver = useCallback((e) => {
    e.stopPropagation();
    const g = groupRef.current;
    if (!g || !card) return;
    hoverTl.current?.kill();
    document.body.style.cursor = 'pointer';

    const scFull = OPP_HAND_SC * 1.15;
    const proxy = { sx: OPP_HAND_SC };
    const tl = gsap.timeline();
    /* Squash X a 0 → rivela la faccia → unsquash */
    tl.to(proxy, {
      sx: 0.02, duration: 0.15, ease: 'power1.in',
      onUpdate: () => g.scale.setX(proxy.sx),
    }, 0);
    tl.add(() => setRevealed(true), 0.15);
    tl.to(proxy, {
      sx: scFull, duration: 0.2, ease: 'power1.out',
      onUpdate: () => g.scale.setX(proxy.sx),
    });
    /* Ingrandimento Y/Z + avvicinamento camera */
    tl.to(g.scale, {
      y: scFull, z: scFull,
      duration: 0.35, ease: 'power2.out',
    }, 0);
    tl.to(g.position, {
      y: restY + OPP_HAND_HOVER_Y_OFFSET,
      z: restZ + 0.5,
      duration: 0.35, ease: 'power2.out',
    }, 0);

    hoverTl.current = tl;
  }, [card, restY, restZ]);

  /* ── Hover Out: kill qualunque tween, forza posizione di riposo ── */
  const handleOut = useCallback(() => {
    const g = groupRef.current;
    if (!g) return;
    hoverTl.current?.kill();
    hoverTl.current = null;
    document.body.style.cursor = 'default';
    setRevealed(false);

    /* Ripristino immediato (nessun tween → nessun artefatto) */
    gsap.killTweensOf(g.position);
    gsap.killTweensOf(g.rotation);
    gsap.killTweensOf(g.scale);

    g.position.set(restX, restY, restZ);
    g.rotation.set(-Math.PI / 2, 0, rotZ);
    g.scale.set(OPP_HAND_SC, OPP_HAND_SC, OPP_HAND_SC);
  }, [restX, restY, restZ, rotZ]);

  useEffect(() => () => hoverTl.current?.kill(), []);

  const showFace = revealed && !!card;

  return (
    <group
      ref={groupRef}
      renderOrder={10 + visibleIndex}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      <Card3D
        type={showFace ? (card.type || 'arma') : 'back'}
        name={showFace ? (card.name || '?') : ''}
        bonus={showFace ? card.bonus : undefined}
        desc={showFace ? card.desc : undefined}
        cu={showFace ? card.cu : undefined}
        faceDown={!showFace}
        renderOrder={10 + visibleIndex}
      />
    </group>
  );
}


/* ═══════════════════════════════════════════
   CARTA IN PESCA — volo diretto, mazzo → mano
   (spazio-mondo, senza trasformazione del gruppo padre)
   ═══════════════════════════════════════════ */
function DrawingCard({ card, index, totalCount, deckPos, deckRot, deckTopSkew = [0, 0], deckBottomSkew = [0, 0], isOpponent, absoluteDelay, onLanded }) {
  const groupRef  = useRef();
  const shadowRef = useRef();
  const card3dRef = useRef();
  const [revealed, setRevealed] = useState(false);

  /* Slot a ventaglio fisso (stessa formula di HandCard / OppHandCard) */
  const offset   = index - (totalCount - 1) / 2;
  const targetX  = isOpponent ? offset * OPP_SPREAD  : offset * HAND_SPREAD;
  const targetY  = isOpponent ? OPP_HAND_BASE_Y + index * OPP_Z_STEP : HAND_Y + index * HAND_Z_STEP;
  const targetZ  = isOpponent ? OPP_HAND_Z - index * 0.005 : HAND_Z + index * 0.005;
  const targetRZ = isOpponent ? offset * OPP_FAN_ROT : -offset * HAND_FAN_ROT;
  const targetSc = isOpponent ? OPP_HAND_SC : HAND_CARD_SC;

  useEffect(() => {
    const g = groupRef.current;
    const s = shadowRef.current;
    if (!g) return;

    /* Inizia alla posizione in cima al mazzo (direttamente da CONFIG_3D) */
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

    /* Skew: interpola deck topSkew/bottomSkew → [0,0] (le carte in mano sono sempre rettangolari) */
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
          desc={!isOpponent && revealed ? card?.desc : undefined}
          cu={!isOpponent && revealed ? card?.cu : undefined}
          renderOrder={20 + index}
        />
      </group>
      <FlightShadow shadowRef={shadowRef} />
    </>
  );
}


/* ═══════════════════════════════════════════
   CARTA SCARTATA — volo dalla mano al punto intermedio tra i mazzi,
   rotazione Z π/2 e dissoluzione con combustione.
   ═══════════════════════════════════════════ */
const DISCARD_FLY_DUR    = 0.55;
const DISCARD_DISSOLVE   = 1.0;

function DiscardingCard({ card, startPos, onComplete }) {
  const groupRef  = useRef();
  const card3dRef = useRef();
  const shadowRef = useRef();

  /* Punto intermedio tra mazzo G1 e mazzo G2 */
  const midX = (CONFIG_3D.playerMainDeck.position[0] + CONFIG_3D.opponentMainDeck.position[0]) / 2;
  const midZ = (CONFIG_3D.playerMainDeck.position[2] + CONFIG_3D.opponentMainDeck.position[2]) / 2;
  const midY = 0.15;

  useEffect(() => {
    const g  = groupRef.current;
    const sh = shadowRef.current;
    if (!g) return;

    g.position.set(startPos.x, startPos.y, startPos.z);
    g.rotation.set(-Math.PI / 2, 0, 0);
    g.scale.set(HAND_CARD_SC, HAND_CARD_SC, HAND_CARD_SC);
    g.visible = true;

    const master = gsap.timeline();

    /* Fase 1: vola al punto intermedio + ruota Z di π/2 + rimpicciolisci */
    master.to(g.position, {
      x: midX, y: midY + 1.5, z: midZ,
      duration: DISCARD_FLY_DUR, ease: 'power2.inOut',
      onUpdate: () => syncShadow(sh, g),
    }, 0);
    master.to(g.rotation, {
      z: Math.PI / 2,
      duration: DISCARD_FLY_DUR, ease: 'power2.inOut',
    }, 0);
    master.to(g.scale, {
      x: 1.2, y: 1.2, z: 1.2,
      duration: DISCARD_FLY_DUR, ease: 'power2.inOut',
    }, 0);

    /* Fase 2: atterra al punto intermedio */
    master.to(g.position, {
      y: midY,
      duration: 0.2, ease: 'power2.in',
      onUpdate: () => syncShadow(sh, g),
    });

    /* Fase 3: dissoluzione con combustione */
    master.addLabel('burn');
    const dUni = card3dRef.current?.userData?._dissolveUni;
    const fUni = card3dRef.current?.userData?._fadeOpacityUni;
    if (dUni) {
      dUni.value = -0.05;
      master.to(dUni, { value: 1.5, duration: DISCARD_DISSOLVE, ease: 'power1.in' }, 'burn');
    }
    if (fUni) {
      fUni.value = 1.0;
      master.to(fUni, { value: 0, duration: DISCARD_DISSOLVE * 0.8, ease: 'power2.in' }, 'burn');
    }
    const fadeProxy = { v: 1 };
    master.to(fadeProxy, {
      v: 0, duration: DISCARD_DISSOLVE * 0.8, ease: 'power2.in',
      onUpdate: () => card3dRef.current?.userData?._fadeAll?.(fadeProxy.v),
    }, 'burn');
    if (sh) {
      master.to(sh.material, { opacity: 0, duration: DISCARD_DISSOLVE * 0.5, ease: 'power1.in' }, 'burn');
    }

    master.add(() => onComplete?.());
    return () => { master.kill(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <group ref={groupRef} visible={false}>
        <Card3D
          ref={card3dRef}
          type={card?.type || 'arma'}
          name={card?.name || '?'}
          bonus={card?.bonus}
          desc={card?.desc}
          cu={card?.cu}
          renderOrder={55}
        />
      </group>
      <FlightShadow shadowRef={shadowRef} />
    </>
  );
}


/* ═══════════════════════════════════════════
   CARTA CAVALIERE ESTRATTA — estrazione automatica dal mazzo
   cavalieri allo slot cavaliere centrale.
   
   Animazione:
     1. Parte a faccia in giù in cima al mazzo
     2. Si solleva sull'asse Y (apice dell'arco)
     3. Scivola su XZ verso lo slot cavaliere
     4. Rotazione sull'asse Y = ribaltamento da retro a fronte
     5. Atterra alla rotazione CONFIG_3D dello slot → piatta
        e leggibile per il giocatore
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

    /* ── Inizio: faccia in giù in cima al mazzo ── */
    const [dX, dY, dZ] = perspPos(deckCfg);
    g.position.set(dX, dY + STACK_TOP, dZ);
    const dr = perspRot(deckCfg);
    g.rotation.set(dr[0], dr[1], dr[2]);
    g.scale.set(deckCfg.scale[0], deckCfg.scale[1], deckCfg.scale[2]);
    g.visible = true;
    syncShadow(s, g);

    /* ── Destinazione: posizione slot + inclinazione prospettica ── */
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

    /* Skew: interpola lo skew del mazzo → skew dello slot durante il volo */
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

    /* XZ: scivola dal mazzo allo slot cavaliere */
    tl.to(g.position, {
      x: targetPos[0], z: targetPos[2],
      duration: KNIGHT_FLIGHT_DUR, ease: 'power2.inOut', onUpdate: shadowUp,
    }, 'fly');

    /* Y: sale ad arco poi atterra all'altezza dello slot */
    tl.to(g.position, {
      keyframes: [
        { y: KNIGHT_ARC_PEAK, duration: KNIGHT_FLIGHT_DUR * 0.4, ease: 'power2.out' },
        { y: targetPos[1],    duration: KNIGHT_FLIGHT_DUR * 0.6, ease: 'power2.in'  },
      ],
      onUpdate: shadowUp,
    }, 'fly');

    /* Rotazione: interpola dalla rotazione del mazzo a quella dello slot.
       La rotazione sull'asse Y spazza π per creare il ribaltamento della carta. */
    tl.to(g.rotation, {
      x: targetRot[0],
      z: targetRot[2],
      duration: KNIGHT_FLIGHT_DUR, ease: 'power2.inOut',
    }, 'fly');

    /* Ribaltamento asse Y: rotazione sinuosa che rivela la fronte a metà volo */
    tl.to(g.rotation, {
      keyframes: [
        { y: Math.PI * 0.5,  duration: KNIGHT_FLIGHT_DUR * 0.35, ease: 'power2.in'  },
        { y: Math.PI,         duration: KNIGHT_FLIGHT_DUR * 0.15, ease: 'none'       },
        { y: targetRot[1],    duration: KNIGHT_FLIGHT_DUR * 0.50, ease: 'power2.out' },
      ],
    }, 'fly');

    /* Rivela la fronte a metà del ribaltamento Y */
    tl.add(() => setRevealed(true), `fly+=${KNIGHT_FLIGHT_DUR * 0.45}`);

    /* Scala: interpola dalla scala del mazzo a quella dello slot */
    tl.to(g.scale, {
      x: targetSc[0], y: targetSc[1], z: targetSc[2],
      duration: KNIGHT_FLIGHT_DUR, ease: 'power2.inOut',
    }, 'fly');

    /* Rimbalzo all'atterraggio */
    tl.to(g.rotation, {
      keyframes: [
        { z: targetRot[2] + 0.06, duration: 0.06, ease: 'sine.out'   },
        { z: targetRot[2] - 0.03, duration: 0.06, ease: 'sine.inOut' },
        { z: targetRot[2],        duration: 0.06, ease: 'sine.in'    },
      ],
    });

    /* Dissolvenza ombra */
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
   ARCO MAGICO — sciame di 20 particelle lucciola lungo
   una curva di Bézier piatta. Ogni sfera ha offset
   laterale/verticale oscillante, dimensione variabile
   e sfasamento massivo per un effetto "mucchio di scintille".
   ═══════════════════════════════════════════ */
function MagicArc({ startPos, endPos, active, onImpact }) {
  const meshRef  = useRef();
  const COUNT    = 20;
  const TRAIL    = 0.10;            // sfasamento maggiore → sciame distinto
  const SPHERE_R = 0.055;
  const dummy    = useMemo(() => new THREE.Object3D(), []);

  /* Dati casuali per ogni particella — generati una sola volta */
  const particleData = useMemo(() => {
    const arr = [];
    for (let i = 0; i < COUNT; i++) {
      arr.push({
        latAmp:  (Math.random() - 0.5) * 0.35,   // ampiezza offset laterale
        vertAmp: (Math.random() - 0.5) * 0.20,   // ampiezza offset verticale
        phase:   Math.random() * Math.PI * 2,     // fase iniziale oscillazione
        freq:    2.5 + Math.random() * 3.0,       // frequenza oscillazione
        sz:      0.7 + Math.random() * 0.6,       // moltiplicatore dimensione
      });
    }
    return arr;
  }, []);

  const curve = useMemo(() => {
    const s  = new THREE.Vector3(startPos[0], startPos[1], startPos[2]);
    const e  = new THREE.Vector3(endPos[0], endPos[1], endPos[2]);
    const dx = e.x - s.x;
    const dz = e.z - s.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    /* Direzione perpendicolare sul piano XZ → arco piatto visibile */
    const perpX = -dz / len;
    const perpZ =  dx / len;
    const mid = new THREE.Vector3(
      (s.x + e.x) / 2 + perpX * 1.5,
      Math.max(s.y, e.y) + 0.3,
      (s.z + e.z) / 2 + perpZ * 1.5,
    );
    return new THREE.QuadraticBezierCurve3(s, mid, e);
  }, [startPos, endPos]);

  /* Vettore perpendicolare alla curva per l'offset laterale */
  const perpDir = useMemo(() => {
    const s = new THREE.Vector3(startPos[0], startPos[1], startPos[2]);
    const e = new THREE.Vector3(endPos[0], endPos[1], endPos[2]);
    const dir = new THREE.Vector3().subVectors(e, s).normalize();
    return new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  }, [startPos, endPos]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!active || !mesh) return;

    /* Inizializza tutte le istanze all'avvio, invisibili */
    for (let i = 0; i < COUNT; i++) {
      dummy.position.set(startPos[0], startPos[1], startPos[2]);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.material.opacity = 0;

    const prx = { t: 0 };
    const tl = gsap.to(prx, {
      t: 1 + COUNT * TRAIL,
      duration: ARC_DUR,
      ease: 'none',
      onUpdate: () => {
        for (let i = 0; i < COUNT; i++) {
          const pd = particleData[i];
          const ti = Math.max(0, Math.min(1, prx.t - i * TRAIL));
          const eased = ti * ti;
          const pt = curve.getPoint(eased);

          /* Oscillazione lucciola: offset laterale + verticale lungo il volo */
          const osc = Math.sin(eased * pd.freq * Math.PI + pd.phase);
          const spread = 1 - Math.abs(eased - 0.5) * 2;  // massimo a metà arco
          pt.x += perpDir.x * osc * pd.latAmp * spread;
          pt.z += perpDir.z * osc * pd.latAmp * spread;
          pt.y += osc * pd.vertAmp;

          dummy.position.copy(pt);
          let sc = pd.sz;
          if (ti < 0.08) sc *= ti / 0.08;
          else if (ti > 0.88) sc *= (1 - ti) / 0.12;
          else sc *= 0.8 + 0.2 * Math.sin(eased * 8 + pd.phase);  // pulsazione dimensione
          dummy.scale.setScalar(Math.max(0.001, sc) * SPHERE_R);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        const head = Math.min(1, prx.t);
        mesh.material.opacity = head < 0.06
          ? (head / 0.06) * 0.95
          : head > 0.88 ? ((1 - head) / 0.12) * 0.95 : 0.95;
      },
      onComplete: () => onImpact?.(),
    });
    return () => tl.kill();
  }, [active, curve, onImpact, startPos, perpDir, particleData]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial
        color="#ffffff" transparent opacity={0}
        depthWrite={false} blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}


/* ═══════════════════════════════════════════
   CARTA GIOCATA — sequenza completa: mano → centro schermo
   (stallo) → slot azione → dissoluzione → arco magico → impatto cavaliere.
   ═══════════════════════════════════════════ */
function PlayingCard({ card, startPos, startScale = HAND_CARD_SC, actionConfigKey, knightGroupRef, onComplete }) {
  const groupRef  = useRef();
  const card3dRef = useRef();
  const shadowRef = useRef();
  const flashRef  = useRef();
  const [arcActive, setArcActive] = useState(false);

  const actionCfg = CONFIG_3D[actionConfigKey];
  const knightKey = actionConfigKey === 'playerActionSlot' ? 'playerKnightSlot' : 'opponentKnightSlot';
  const knightCfg = CONFIG_3D[knightKey];

  const actionPos = useMemo(() => perspPos(actionCfg), [actionCfg]);
  const actionRot = useMemo(() => perspRot(actionCfg), [actionCfg]);
  const knightPos = useMemo(() => perspPos(knightCfg), [knightCfg]);

  useEffect(() => {
    const g  = groupRef.current;
    const sh = shadowRef.current;
    if (!g) return;

    /* Inizia alla posizione in mano */
    g.position.set(startPos.x, startPos.y, startPos.z);
    g.rotation.set(-Math.PI / 2, 0, 0);
    g.scale.set(startScale, startScale, startScale);
    g.visible = true;

    /* Helper ombra — mappa l'altezza della carta su opacità e scala */
    const syncPlayShadow = () => {
      if (!sh) return;
      sh.position.set(g.position.x, 0.002, g.position.z);
      const h    = Math.max(0, g.position.y - actionPos[1]);
      const maxH = STALL_Y - actionPos[1];
      const t    = Math.min(h / maxH, 1);        // 1 = high, 0 = landed
      const s    = 0.8 + t * 1.4;
      sh.scale.set(s, s * 0.7, 1);
      sh.material.opacity = 0.35 - t * 0.27;     // 0.08 allo stallo → 0.35 a terra
    };

    const tSc   = actionCfg.scale;
    const master = gsap.timeline();

    /* ── Fase 1: Salita verso il centro schermo ── */
    master.addLabel('rise', 0);
    if (sh) {
      sh.material.opacity = 0;
      master.to(sh.material, { opacity: 0.08, duration: 0.15 }, 'rise');
    }
    master.to(g.position, {
      x: 0, y: STALL_Y, z: STALL_Z,
      duration: RISE_DUR, ease: 'power2.out', onUpdate: syncPlayShadow,
    }, 'rise');
    master.to(g.rotation, {
      x: -Math.PI / 2, y: 0, z: 0,
      duration: RISE_DUR, ease: 'power2.out',
    }, 'rise');
    master.to(g.scale, {
      x: STALL_SC, y: STALL_SC, z: STALL_SC,
      duration: RISE_DUR, ease: 'power2.out',
    }, 'rise');

    /* ── Fase 2: Stallo a mezz'aria con sottile fluttuazione ── */
    master.addLabel('stall');
    master.to(g.position, {
      y: STALL_Y + 0.12, z: STALL_Z - 0.03,
      duration: STALL_DUR / 2, ease: 'sine.inOut', yoyo: true, repeat: 1,
      onUpdate: syncPlayShadow,
    }, 'stall');

    /* ── Fase 3: Atterraggio lineare allo slot azione (senza rimbalzo/easing) ── */
    master.addLabel('swoop');
    master.to(g.position, {
      x: actionPos[0], y: actionPos[1], z: actionPos[2],
      duration: SWOOP_DUR, ease: 'none', onUpdate: syncPlayShadow,
    }, 'swoop');
    master.to(g.rotation, {
      x: actionRot[0], y: actionRot[1], z: actionRot[2],
      duration: SWOOP_DUR, ease: 'power2.inOut',
    }, 'swoop');
    master.to(g.scale, {
      x: tSc[0], y: tSc[1], z: tSc[2],
      duration: SWOOP_DUR, ease: 'power2.in',
    }, 'swoop');

    /* ── Impatto: overshoot skew (schiacciamento prospettico, NESSUN wobble su rotazione Z) ── */
    const targetTS = actionCfg.topSkew ?? [0, 0];
    const targetBS = actionCfg.bottomSkew ?? [0, 0];
    const skewPr   = { tx: targetTS[0], ty: targetTS[1], bx: targetBS[0], by: targetBS[1] };
    /* Forza skew iniziale allo slot PRIMA dell'overshoot (fix bug reset da re-render React) */
    card3dRef.current?.userData?._setSkew?.(targetTS[0], targetTS[1], targetBS[0], targetBS[1]);
    const OV = 0.04;
    master.to(skewPr, {
      tx: targetTS[0] + OV, ty: targetTS[1] + 0.015,
      bx: targetBS[0] - OV, by: targetBS[1] - 0.015,
      duration: 0.08, ease: 'power2.out',
      onUpdate: () => card3dRef.current?.userData?._setSkew?.(skewPr.tx, skewPr.ty, skewPr.bx, skewPr.by),
    }, '<');
    master.to(skewPr, {
      tx: targetTS[0], ty: targetTS[1], bx: targetBS[0], by: targetBS[1],
      duration: 0.35, ease: 'elastic.out(1, 0.4)',
      onUpdate: () => card3dRef.current?.userData?._setSkew?.(skewPr.tx, skewPr.ty, skewPr.bx, skewPr.by),
    });

    /* Ancora di sicurezza: forza lo skew CONFIG_3D dopo l'overshoot (previene reset da React) */
    master.add(() => {
      card3dRef.current?.userData?._setSkew?.(targetTS[0], targetTS[1], targetBS[0], targetBS[1]);
    });

    /* ── Attesa prima della dissoluzione ── */
    master.to({}, { duration: DISSOLVE_DELAY });

    /* ── Dissoluzione (corrosione concentrica + fade-out morbido) ── */
    master.addLabel('dissolve');
    const dUni = card3dRef.current?.userData?._dissolveUni;
    const fUni = card3dRef.current?.userData?._fadeOpacityUni;
    if (dUni) {
      dUni.value = -0.05;
      master.to(dUni, { value: 1.5, duration: DISSOLVE_DUR, ease: 'power1.in' }, 'dissolve');
    }
    /* Fade-out opacità globale: parte insieme alla dissoluzione */
    if (fUni) {
      fUni.value = 1.0;
      master.to(fUni, { value: 0, duration: DISSOLVE_DUR * 0.8, ease: 'power2.in' }, 'dissolve');
    }
    /* Dissolvi anche testi/icone figli */
    const fadeProxy = { v: 1 };
    master.to(fadeProxy, {
      v: 0, duration: DISSOLVE_DUR * 0.8, ease: 'power2.in',
      onUpdate: () => card3dRef.current?.userData?._fadeAll?.(fadeProxy.v),
    }, 'dissolve');

    /* Dissolvenza ombra durante la dissoluzione */
    if (sh) {
      master.to(sh.material, { opacity: 0, duration: DISSOLVE_DUR * 0.6, ease: 'power1.in' }, 'dissolve');
    }

    /* ── L'arco parte a metà della dissoluzione ── */
    master.add(() => setArcActive(true), `dissolve+=${ARC_DELAY_IN_DIS}`);

    /* Smonta completamente il componente al termine della dissoluzione (nessun fantasma) */
    master.add(() => onComplete?.(), `dissolve+=${DISSOLVE_DUR}`);

    return () => { master.kill(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Impatto arco: skew squash sul cavaliere + pulsazione scala + flash ── */
  const handleArcImpact = useCallback(() => {
    const kg = knightGroupRef?.current;
    if (kg) {
      const kCfg = CONFIG_3D[knightKey];
      const tTS  = kCfg.topSkew    ?? [0, 0];
      const tBS  = kCfg.bottomSkew ?? [0, 0];
      const sp   = { tx: tTS[0], ty: tTS[1], bx: tBS[0], by: tBS[1] };
      const skTl = gsap.timeline();
      skTl.to(sp, {
        tx: tTS[0] + 0.03, bx: tBS[0] - 0.03,
        duration: 0.06, ease: 'power2.out',
        onUpdate: () => kg.userData?._setSkew?.(sp.tx, sp.ty, sp.bx, sp.by),
      });
      skTl.to(sp, {
        tx: tTS[0], ty: tTS[1], bx: tBS[0], by: tBS[1],
        duration: 0.3, ease: 'elastic.out(1, 0.3)',
        onUpdate: () => kg.userData?._setSkew?.(sp.tx, sp.ty, sp.bx, sp.by),
      });
      gsap.to(kg.scale, {
        keyframes: [
          { x: kg.scale.x * 1.08, y: kg.scale.y * 1.08, z: kg.scale.z * 1.08, duration: 0.08, ease: 'power2.out' },
          { x: kg.scale.x, y: kg.scale.y, z: kg.scale.z, duration: 0.15, ease: 'power2.inOut' },
        ],
      });
    }
    if (flashRef.current) {
      flashRef.current.visible = true;
      flashRef.current.material.opacity = 0.8;
      gsap.to(flashRef.current.material, {
        opacity: 0, duration: 0.4, ease: 'power2.out',
        onComplete: () => { if (flashRef.current) flashRef.current.visible = false; },
      });
    }
  }, [knightGroupRef, knightKey]);

  return (
    <>
      <group ref={groupRef} visible={false}>
        <Card3D
          ref={card3dRef}
          type={card?.type || 'arma'}
          name={card?.name || '?'}
          bonus={card?.bonus}
          desc={card?.desc}
          cu={card?.cu}
          topSkew={actionCfg.topSkew ?? [0, 0]}
          bottomSkew={actionCfg.bottomSkew ?? [0, 0]}
          renderOrder={50}
        />
      </group>

      {/* Ombra dinamica della giocata */}
      <FlightShadow shadowRef={shadowRef} />

      {/* Arco di energia magica (curva piatta sul piano del tavolo) */}
      <MagicArc
        startPos={actionPos}
        endPos={knightPos}
        active={arcActive}
        onImpact={handleArcImpact}
      />

      {/* Disco flash d'impatto */}
      <mesh ref={flashRef} visible={false}
        position={[knightPos[0], knightPos[1] + 0.01, knightPos[2]]}
        rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 32]} />
        <meshBasicMaterial
          color="#ffd700" transparent opacity={0}
          depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}


/* ═══════════════════════════════════════════
   ICONE BUFF — piccole icone Html sopra al cavaliere (top-left)
   ═══════════════════════════════════════════ */
function BuffIcons({ position, isAtkBuffed, isDefBuffed }) {
  if (!isAtkBuffed && !isDefBuffed) return null;
  return (
    <group position={position}>
      <Html
        position={[0.3, 5.9, -0.45]}
        center
        distanceFactor={6}
        style={{ pointerEvents: 'none', userSelect: 'none', display: 'flex', gap: 4 }}
      >
        {isAtkBuffed && (
          <span style={{
            fontSize: 16, lineHeight: 1,
            filter: 'drop-shadow(0 0 4px #ff3300)',
            animation: 'pulse-icon 1.5s ease-in-out infinite',
          }}>⚔️</span>
        )}
        {isDefBuffed && (
          <span style={{
            fontSize: 16, lineHeight: 1,
            filter: 'drop-shadow(0 0 4px #00aaff)',
            animation: 'pulse-icon 1.5s ease-in-out infinite 0.3s',
          }}>🛡️</span>
        )}
      </Html>
    </group>
  );
}


/* ═══════════════════════════════════════════
   RIVELAZIONE TERRENO — volo dal mazzo → centro schermo (rivelazione) → alto-sinistra.
   Questa animazione blocca visualmente il ciclo di gioco per 1s di stallo al centro.
   ═══════════════════════════════════════════ */
function TerrainRevealCard({ terrainData, deckConfigKey, onComplete }) {
  const groupRef  = useRef();
  const shadowRef = useRef();
  const card3dRef = useRef();
  const [revealed, setRevealed] = useState(false);

  const deckCfg   = CONFIG_3D[deckConfigKey] || CONFIG_3D.playerMainDeck;
  const finalCfg  = CONFIG_3D.activeTerrain;
  const deckPos   = perspPos(deckCfg);
  const deckRot   = perspRot(deckCfg);
  const finalPos  = perspPos(finalCfg);
  const finalRot  = perspRot(finalCfg);
  const finalSc   = Array.isArray(finalCfg.scale) ? finalCfg.scale[0] : finalCfg.scale;

  useEffect(() => {
    const g = groupRef.current;
    const s = shadowRef.current;
    if (!g) return;

    /* Start: at deck position */
    g.position.set(deckPos[0], deckPos[1] + STACK_TOP, deckPos[2]);
    g.rotation.set(deckRot[0], deckRot[1], deckRot[2]);
    const deckSc = Array.isArray(deckCfg.scale) ? deckCfg.scale[0] : deckCfg.scale;
    g.scale.set(deckSc, deckSc, deckSc);
    g.visible = true;
    if (s) syncShadow(s, g);

    /* Centro schermo (sopra il tavolo) */
    const centerX = 0;
    const centerY = TERRAIN_REVEAL_ARC_PEAK;
    const centerZ = 0;
    const stallSc = TERRAIN_REVEAL_STALL_SC;

    const scaleProxy = { x: deckSc };
    const shadowUp   = () => { if (s) syncShadow(s, g); };

    const tl = gsap.timeline();

    /* ── Fase 1: Volo dal mazzo al centro schermo ── */
    tl.addLabel('rise', 0);
    tl.to(g.position, {
      x: centerX, y: centerY, z: centerZ,
      duration: TERRAIN_REVEAL_RISE_DUR, ease: 'power2.out',
      onUpdate: shadowUp,
    }, 'rise');
    tl.to(g.rotation, {
      x: -Math.PI / 2, y: 0, z: 0,
      duration: TERRAIN_REVEAL_RISE_DUR, ease: 'sine.inOut',
    }, 'rise');
    tl.to(g.scale, {
      x: stallSc, y: stallSc, z: stallSc,
      duration: TERRAIN_REVEAL_RISE_DUR, ease: 'power2.out',
    }, 'rise');

    /* Flip: squash → reveal → unsquash */
    tl.to(scaleProxy, {
      x: 0.02, duration: 0.10, ease: 'power1.in',
      onUpdate: () => g.scale.setX(scaleProxy.x),
    });
    tl.add(() => setRevealed(true));
    tl.to(scaleProxy, {
      x: stallSc, duration: 0.10, ease: 'power1.out',
      onUpdate: () => g.scale.setX(scaleProxy.x),
    });

    /* ── Fase 2: Stallo al centro (pausa drammatica per leggere l'effetto) ── */
    tl.to({}, { duration: TERRAIN_REVEAL_STALL });

    /* ── Fase 3: Volo dal centro alla posizione finale (alto-sinistra) ── */
    tl.addLabel('fly');
    tl.to(g.position, {
      x: finalPos[0], y: finalPos[1], z: finalPos[2],
      duration: TERRAIN_REVEAL_FLY_DUR, ease: 'power2.inOut',
      onUpdate: shadowUp,
    }, 'fly');
    tl.to(g.rotation, {
      x: finalRot[0], y: finalRot[1], z: finalRot[2],
      duration: TERRAIN_REVEAL_FLY_DUR, ease: 'sine.inOut',
    }, 'fly');
    tl.to(g.scale, {
      x: finalSc, y: finalSc, z: finalSc,
      duration: TERRAIN_REVEAL_FLY_DUR, ease: 'power2.inOut',
    }, 'fly');

    /* Shadow fade out */
    if (s) {
      tl.to(s.material, { opacity: 0, duration: 0.2, ease: 'power1.out' });
    }

    tl.add(() => onComplete?.());

    return () => tl.kill();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = terrainData?.card;
  if (!card) return null;

  return (
    <>
      <group ref={groupRef} visible={false}>
        <Card3D
          ref={card3dRef}
          faceDown={!revealed}
          type={revealed ? (card.type || 'terreno') : 'back'}
          name={revealed ? (card.name || '?') : ''}
          desc={revealed ? card.desc : undefined}
          cu={revealed ? card.cu : undefined}
          renderOrder={60}
        />
      </group>
      <FlightShadow shadowRef={shadowRef} />
    </>
  );
}


/* ═══════════════════════════════════════════
   TERRENO ATTIVO — carta fissa in alto a sinistra,
   frontale alla camera, con lento respiro.
   ═══════════════════════════════════════════ */
/* ── Terrain Hover Lift: aumenta o diminuisci per regolare l'intensità del sollevamento ── */
const TERRAIN_HOVER_LIFT = 0.25;

function TerrainDisplayCard({ terrainData }) {
  const groupRef     = useRef();
  const breathRef    = useRef(null);
  const isHoveredRef = useRef(false);
  const cfg  = CONFIG_3D.activeTerrain;
  const baseY = cfg.position[1];

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    const tl = gsap.to(g.position, {
      y: baseY + 0.08,
      duration: 3,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
    breathRef.current = tl;
    return () => tl.kill();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOver = useCallback((e) => {
    e.stopPropagation();
    const g = groupRef.current;
    if (!g || isHoveredRef.current) return;
    isHoveredRef.current = true;
    document.body.style.cursor = 'pointer';
    breathRef.current?.pause();
    gsap.to(g.position, { y: baseY + TERRAIN_HOVER_LIFT, duration: 0.2, ease: 'power2.out', overwrite: true });
  }, [baseY]);

  const handleOut = useCallback(() => {
    const g = groupRef.current;
    if (!g || !isHoveredRef.current) return;
    isHoveredRef.current = false;
    document.body.style.cursor = 'default';
    gsap.to(g.position, {
      y: baseY, duration: 0.25, ease: 'power2.inOut', overwrite: true,
      onComplete: () => breathRef.current?.resume(),
    });
  }, [baseY]);

  const card = terrainData?.card;
  if (!card) return null;

  return (
    <group
      ref={groupRef}
      position={perspPos(cfg)}
      rotation={perspRot(cfg)}
      scale={cfg.scale}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      <Card3D
        type={card.type || 'terreno'}
        name={card.name || '?'}
        desc={card.desc}
        cu={card.cu}
        renderOrder={5}
      />
    </group>
  );
}


/* ═══════════════════════════════════════════
   SCENA PRINCIPALE
   ═══════════════════════════════════════════ */
function Scene() {
  /* ── Zustand Game Store ── */
  const {
    p1, p2, turn, hasAttacked, gameOver, activeTerrain, isInitializing,
    lastAttackResult, lastEquipResult,
    initGame, drawCard, drawWeapon, equipWeapon, endTurn, playAITurn, finishInit,
    attack, confirmKnightDeath, clearLastAttack, clearLastEquip, discardWeapon,
    getStats,
  } = useGameStore();

  /* ── Statistiche buffo per cavalieri (VFX) ── */
  const p1Stats = getStats(1);
  const p2Stats = getStats(2);
  const knightPositions = useMemo(() => ({
    p1: perspPos(CONFIG_3D.playerKnightSlot),
    p2: perspPos(CONFIG_3D.opponentKnightSlot),
  }), []);

  /* ── Stato Estrazione Automatica Cavaliere ── */
  const [knightsPhase, setKnightsPhase] = useState('idle');  // 'idle' | 'drawing' | 'done'
  const [p1KnightReady, setP1KnightReady] = useState(false);
  const [p2KnightReady, setP2KnightReady] = useState(false);

  /* ── Stato Pesca Armi ── */
  const [drawData, setDrawData]       = useState(null);
  const [landedP1, setLandedP1]       = useState(new Set());
  const [landedP2, setLandedP2]       = useState(new Set());
  const [playerHand, setPlayerHand]   = useState([]);
  const [oppHand, setOppHand]         = useState([]);
  const [playedCards, setPlayedCards]  = useState(new Set());
  const [oppDrawStarted, setOppDrawStarted] = useState(false);

  /* ── Lock interazione: impedisce azioni mentre un'animazione è in corso ── */
  const isAnimatingRef = useRef(false);

  /* ── Conteggio carte decorative pesca avversario ── */
  const oppDrawCountRef = useRef(MAX_HAND_SIZE);

  /* ── Carta in gioco (animazione separata) ── */
  const [playingCard, setPlayingCard] = useState(null);
  const [aiPlayingCard, setAiPlayingCard] = useState(null);
  const [oppPlayedCards, setOppPlayedCards] = useState(new Set());
  const p1KnightRef = useRef();
  const p2KnightRef = useRef();
  const pendingEquipRef = useRef(null);

  /* ── Rivelazione Terreno: animazione dal mazzo al centro → posizione finale ── */
  const [terrainReveal, setTerrainReveal] = useState(null);  // { data, deckKey }
  const prevTerrainRef = useRef(null);

  /* ── Attacco: arco magico tra cavalieri ── */
  const [attackAnim, setAttackAnim] = useState(null);
  const attackFlashRef = useRef();

  /* ── Scarto carta: animazione DiscardingCard ── */
  const [discardingCard, setDiscardingCard] = useState(null);
  /* slot index dell'ultima carta scartata — serve per sincronizzare il free-redraw */
  const discardSlotRef = useRef(null);

  /* ── Morte cavaliere: dissoluzione + redraw ── */
  const [p1KnightDying, setP1KnightDying] = useState(false);
  const [p2KnightDying, setP2KnightDying] = useState(false);
  const p1LastKnight = useRef(null);
  const p2LastKnight = useRef(null);

  /* ── Init: estrazione cavalieri — safe con React StrictMode ──────────────────
     isInitializing diventa true solo dopo che initGame() è stato chiamato.
     Il reset del ref nel cleanup permette al secondo run di StrictMode
     (simulated remount) di rischedulare correttamente il timer.                 */
  const initScheduled = useRef(false);
  useEffect(() => {
    /* Attende che initGame() sia stato invocato (isInitializing = true) */
    if (!isInitializing) return;
    if (initScheduled.current) return;
    initScheduled.current = true;
    const timer = setTimeout(() => {
      drawCard(1);
      drawCard(2);
      setKnightsPhase('drawing');
    }, KNIGHT_DRAW_DELAY * 1000);
    return () => {
      clearTimeout(timer);
      /* Reset esplicito per StrictMode: il cleanup permette al remount
         di rischedulare senza che il ref rimanga "consumato". */
      initScheduled.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitializing]);

  /* Quando entrambi i cavalieri sono atterrati → segna come completato + auto-deal round 1 */
  const initialDealDone = useRef(false);
  useEffect(() => {
    if (p1KnightReady && p2KnightReady && knightsPhase === 'drawing') {
      setKnightsPhase('done');
      finishInit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p1KnightReady, p2KnightReady, knightsPhase]);

  /* ── Auto-deal Round 1: appena finishInit() → distribuisci 3 carte ciascuno ── */
  useEffect(() => {
    if (knightsPhase !== 'done' || isInitializing || initialDealDone.current) return;
    initialDealDone.current = true;
    const timer = setTimeout(() => {
      /* Pesca armi per il giocatore */
      const s = useGameStore.getState();
      if (s.p1.weaponsLeft > 0 && !s.p1.hasDrawnWeapon) {
        const drawn = s.drawWeapon(1);
        if (drawn.length > 0) {
          const newCards = drawn.map(d => ({
            ...d.card, _drawIdx: d.slotIdx, _slotIdx: d.slotIdx, _landed: false,
          }));
          setPlayerHand(prev => {
            const kept = prev.filter(c => newCards.every(n => n._drawIdx !== c._drawIdx));
            return [...kept, ...newCards];
          });
          setDrawData({
            cards: drawn.map((d) => ({ ...d.card, _drawIdx: d.slotIdx, _slotIdx: d.slotIdx, _totalCount: MAX_HAND_SIZE })),
          });
        }
      }
    }, 500);
    return () => { clearTimeout(timer); initialDealDone.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knightsPhase, isInitializing]);

  /* ── Cache dati cavaliere per dissoluzione (serve dopo che lo store annulla activeCard) ── */
  useEffect(() => { if (p1.activeCard) p1LastKnight.current = { ...p1.activeCard }; }, [p1.activeCard]);
  useEffect(() => { if (p2.activeCard) p2LastKnight.current = { ...p2.activeCard }; }, [p2.activeCard]);

  /* ── Watcher Terreno: quando activeTerrain cambia → lancia animazione di rivelazione ── */
  useEffect(() => {
    const prevId = prevTerrainRef.current?.id;
    const curId  = activeTerrain?.id;
    if (curId && curId !== prevId) {
      /* Determina il mazzo di origine in base al proprietario del terreno */
      const owner = activeTerrain.owner;
      const deckKey = owner === 2 ? 'opponentMainDeck' : 'playerMainDeck';
      setTerrainReveal({ data: activeTerrain, deckKey });
    }
    prevTerrainRef.current = activeTerrain;
  }, [activeTerrain]);

  /* ── Reset COMPLETO stato pesca quando torna il turno del giocatore ── */
  const prevTurnRef    = useRef(null);
  const roundDealTimer = useRef(null);
  useEffect(() => {
    if (prevTurnRef.current !== null && turn === 1 && !isInitializing) {
      /* 1. Sblocca qualsiasi animazione residua */
      isAnimatingRef.current = false;

      /* 2. Smonta eventuali carte in giocata/scarto ancora animate */
      setPlayingCard(null);
      setDiscardingCard(null);

      /* 3. Svuota gli slot arma del G1 nello store → drawWeapon ripesca 3 carte */
      useGameStore.setState(s => ({
        p1: { ...s.p1, weaponSlots: [null, null, null], hasDrawnWeapon: false },
      }));

      /* 4. Pulisci lo stato visuale della pesca del G1 */
      setDrawData(null);
      setLandedP1(new Set());
      setLandedP2(new Set());
      setPlayerHand([]);
      setPlayedCards(new Set());
      setAiPlayingCard(null);

      /* 4b. Mano avversario: MANTIENI le carte rimaste (non giocate).
             Ricostruisci oppHand dai weaponSlots sopravvissuti di p2.          */
      {
        const st = useGameStore.getState();
        const surviving = st.p2.weaponSlots
          .map((slot, i) => slot ? { _drawIdx: i, _slotIdx: i, _landed: true } : null)
          .filter(Boolean);
        setOppHand(surviving);
        setOppPlayedCards(new Set());
        setOppDrawStarted(false);
      }

      /* 5. Auto-deal round 2+: pesca automatica dopo 500ms (come round 1) */
      if (roundDealTimer.current) clearTimeout(roundDealTimer.current);
      roundDealTimer.current = setTimeout(() => {
        const st = useGameStore.getState();
        if (st.turn !== 1 || st.gameOver) return;
        if (st.p1.weaponsLeft > 0) {
          const drawn = st.drawWeapon(1);
          if (drawn.length > 0) {
            const newCards = drawn.map(d => ({
              ...d.card, _drawIdx: d.slotIdx, _slotIdx: d.slotIdx, _landed: false,
            }));
            setPlayerHand(prev => {
              const kept = prev.filter(c => newCards.every(n => n._drawIdx !== c._drawIdx));
              return [...kept, ...newCards];
            });
            setDrawData({
              cards: drawn.map(d => ({
                ...d.card, _drawIdx: d.slotIdx, _slotIdx: d.slotIdx, _totalCount: MAX_HAND_SIZE,
              })),
            });
          }
        }
      }, 500);
    }
    prevTurnRef.current = turn;
    return () => {
      if (roundDealTimer.current) clearTimeout(roundDealTimer.current);
    };
  }, [turn, isInitializing]);

  /* ═══════ Gestione morte cavaliere + redraw ═══════ */
  const handleKnightDeath = useCallback((targetPlayer) => {
    const targetRef = targetPlayer === 1 ? p1KnightRef : p2KnightRef;
    const setDying  = targetPlayer === 1 ? setP1KnightDying : setP2KnightDying;
    const setReady  = targetPlayer === 1 ? setP1KnightReady : setP2KnightReady;

    setDying(true);
    targetRef.current?.userData?._startDissolve?.(1.2, () => {
      setDying(false);
      confirmKnightDeath(targetPlayer);
      /* Se ci sono cavalieri rimasti → pesca e lancia animazione KnightDrawCard */
      setTimeout(() => {
        const s = useGameStore.getState();
        const p = targetPlayer === 1 ? s.p1 : s.p2;
        if (p.cardsLeft > 0 && !s.gameOver) {
          s.drawCard(targetPlayer);
          setReady(false);
        }
      }, 200);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ═══════ Reazione a lastAttackResult (giocatore O AI) — attacco fisico ═══════ */
  const lastResultProcessed = useRef(null);
  useEffect(() => {
    if (!lastAttackResult || lastAttackResult === lastResultProcessed.current) return;
    lastResultProcessed.current = lastAttackResult;
    const { playerNum, knightDied } = lastAttackResult;
    const targetPlayer = playerNum === 1 ? 2 : 1;

    const attackerRef  = playerNum === 1 ? p1KnightRef : p2KnightRef;
    const targetRef    = targetPlayer === 1 ? p1KnightRef : p2KnightRef;
    const attackerKey  = playerNum === 1 ? 'playerKnightSlot' : 'opponentKnightSlot';
    const targetKey    = targetPlayer === 1 ? 'playerKnightSlot' : 'opponentKnightSlot';

    const ag = attackerRef.current;
    const tg = targetRef.current;
    if (!ag) { clearLastAttack(); return; }

    const origPos = perspPos(CONFIG_3D[attackerKey]);
    const targetPos = perspPos(CONFIG_3D[targetKey]);

    const tl = gsap.timeline({
      onComplete: () => {
        if (knightDied) {
          setTimeout(() => {
            handleKnightDeath(targetPlayer);
            setAttackAnim(null);
            clearLastAttack();
          }, 200);
        } else {
          setAttackAnim(null);
          clearLastAttack();
        }
      },
    });

    /* Centro esatto dello schermo (world space, sopra il tavolo) */
    const centerX = 0;
    const centerY = STALL_Y * 0.7;
    const centerZ = (origPos[2] + targetPos[2]) / 2;

    /* Rotazione di riposo completa (dalla CONFIG_3D dello slot) */
    const origRot = perspRot(CONFIG_3D[attackerKey]);
    const origRotX = origRot[0];
    const origRotY = origRot[1];
    const origRotZ = origRot[2];

    /* Tilt: 15 gradi (π/12). Player → −15° (fendente alto-destro), AI → +15° (alto-sinistro) */
    const tiltAngle = playerNum === 1 ? -Math.PI / 12 : Math.PI / 12;
    /* Wind-up: -12° nella direzione opposta al colpo (carica il fendente) */
    const windUpAngle = playerNum === 1 ? (12 * Math.PI / 180) : -(12 * Math.PI / 180);

    /* 1a. Sollevamento + volo al centro + wind-up rotazione (carica) */
    tl.to(ag.position, {
      x: centerX, y: centerY, z: centerZ,
      duration: ATTACK_LIFT_DUR + 0.12, ease: 'power2.out',
    }, 0);
    tl.to(ag.rotation, {
      x: origRotX, y: origRotY, z: origRotZ + windUpAngle,
      duration: ATTACK_LIFT_DUR + 0.12, ease: 'power2.out',
    }, 0);

    /* 1b. Pausa breve al carico (held pose) */
    tl.to({}, { duration: 0.06 });

    /* 1c. Scatto rapido del jab — snap dalla carica al colpo */
    tl.to(ag.rotation, {
      x: origRotX, y: origRotY, z: origRotZ + tiltAngle,
      duration: 0.08, ease: 'power3.in',
    });

    /* 2. Flash emissivo rosso sul bersaglio */
    tl.add(() => {
      if (!tg) return;
      const materials = [];
      tg.traverse((child) => {
        if (child.material && child.material.emissive) {
          materials.push({ mat: child.material, origEmissive: child.material.emissive.clone() });
        }
      });
      if (materials.length === 0) return;

      const flashTl = gsap.timeline();
      const flashColor = new THREE.Color('#ff1100');
      for (let i = 0; i < ATTACK_FLASH_CNT; i++) {
        flashTl.add(() => {
          materials.forEach(m => m.mat.emissive.copy(flashColor));
          materials.forEach(m => { m.mat.emissiveIntensity = 0.9; });
        });
        flashTl.to({}, { duration: ATTACK_FLASH_DUR * 0.5 });
        flashTl.add(() => {
          materials.forEach(m => m.mat.emissive.copy(m.origEmissive));
          materials.forEach(m => { m.mat.emissiveIntensity = 0; });
        });
        flashTl.to({}, { duration: ATTACK_FLASH_DUR * 0.5 });
      }

      /* Skew squash sul bersaglio */
      const kCfg = CONFIG_3D[targetKey];
      const tTS  = kCfg.topSkew ?? [0, 0];
      const tBS  = kCfg.bottomSkew ?? [0, 0];
      const sp   = { tx: tTS[0], ty: tTS[1], bx: tBS[0], by: tBS[1] };
      gsap.timeline()
        .to(sp, {
          tx: tTS[0] + 0.04, bx: tBS[0] - 0.04,
          duration: 0.06, ease: 'power2.out',
          onUpdate: () => tg.userData?._setSkew?.(sp.tx, sp.ty, sp.bx, sp.by),
        })
        .to(sp, {
          tx: tTS[0], ty: tTS[1], bx: tBS[0], by: tBS[1],
          duration: 0.35, ease: 'elastic.out(1, 0.3)',
          onUpdate: () => tg.userData?._setSkew?.(sp.tx, sp.ty, sp.bx, sp.by),
        });

      /* Pulsazione scala */
      const origSc = [...tg.scale.toArray()];
      gsap.to(tg.scale, {
        keyframes: [
          { x: origSc[0] * 1.12, y: origSc[1] * 1.12, z: origSc[2] * 1.12, duration: 0.08, ease: 'power2.out' },
          { x: origSc[0], y: origSc[1], z: origSc[2], duration: 0.2, ease: 'power2.inOut' },
        ],
      });
    });

    /* Tempo per i flash */
    tl.to({}, { duration: ATTACK_FLASH_CNT * ATTACK_FLASH_DUR });

    /* Flash disco a terra sul bersaglio */
    if (attackFlashRef.current) {
      const knPos = perspPos(CONFIG_3D[targetKey]);
      attackFlashRef.current.position.set(knPos[0], knPos[1] + 0.01, knPos[2]);
      attackFlashRef.current.visible = true;
      attackFlashRef.current.material.opacity = 0.8;
      gsap.to(attackFlashRef.current.material, {
        opacity: 0, duration: 0.5, ease: 'power2.out',
        onComplete: () => { if (attackFlashRef.current) attackFlashRef.current.visible = false; },
      });
    }

    /* 3. Ritorno alla posizione e rotazione di riposo (fluido, tutti gli assi bloccati) */
    tl.to(ag.rotation, {
      x: origRotX, y: origRotY, z: origRotZ,
      duration: 0.15, ease: 'power2.out',
    });
    tl.to(ag.position, {
      x: origPos[0], y: origPos[1], z: origPos[2],
      duration: ATTACK_RETURN_DUR, ease: 'power2.out',
    }, '<');

    /* Segna l'animazione come attiva (per il guard dello smontaggio) */
    setAttackAnim({ targetPlayer, knightDied });

    return () => { tl.kill(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAttackResult]);

  /* ── Click Mazzo Principale G1 → pesca armi dallo store ── */
  const handleDraw = useCallback(() => {
    if (drawData || isAnimatingRef.current || turn !== 1 || gameOver || isInitializing) return;
    if (p1.weaponsLeft <= 0) return;
    const cardsInHand = playerHand.filter(c => !playedCards.has(c._drawIdx)).length;
    if (cardsInHand >= MAX_HAND_SIZE) return;
    const drawn = drawWeapon(1);
    if (drawn.length === 0) return;
    /* Pulisci i playedCards per gli slot che verranno riempiti */
    setPlayedCards(prev => {
      const next = new Set(prev);
      drawn.forEach(d => next.delete(d.slotIdx));
      return next;
    });
    /* Inserisci TUTTE le carte in playerHand subito (_landed: false) → la mano
       conosce fin da ora la dimensione finale e calcola posizioni corrette */
    const newCards = drawn.map(d => ({
      ...d.card, _drawIdx: d.slotIdx, _slotIdx: d.slotIdx, _landed: false,
    }));
    setPlayerHand(prev => {
      const kept = prev.filter(c => newCards.every(n => n._drawIdx !== c._drawIdx));
      return [...kept, ...newCards];
    });
    /* _drawIdx = slotIdx reale (0/1/2) per posizionare in fan corretto */
    setDrawData({
      cards: drawn.map((d) => ({
        ...d.card, _drawIdx: d.slotIdx, _slotIdx: d.slotIdx, _totalCount: MAX_HAND_SIZE,
      })),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawData, turn, gameOver, isInitializing, p1.weaponsLeft, playerHand, playedCards]);

  /* ── Carta del giocatore atterra ── */
  const handleP1Landed = useCallback((idx) => {
    /* Marca la carta come atterrata → HandCard la renderizza */
    setPlayerHand(prev => prev.map(c =>
      c._drawIdx === idx ? { ...c, _landed: true } : c
    ));
    setLandedP1(prev => {
      const next = new Set(prev).add(idx);
      const totalCards = drawData?.cards?.length ?? MAX_HAND_SIZE;
      /* Avvia la pesca visuale avversaria quando la penultima carta atterra */
      if (next.size >= Math.max(1, totalCards - 1)) {
        setTimeout(() => {
          const st = useGameStore.getState();
          const emptyCount = st.p2.weaponSlots.filter(s => s === null).length;
          oppDrawCountRef.current = Math.min(emptyCount || MAX_HAND_SIZE, st.p2.weaponsLeft, MAX_HAND_SIZE);
          if (st.p2.weaponsLeft > 0 && emptyCount > 0) {
            /* Salva gli slot vuoti PRIMA di pescare */
            const emptySlots = st.p2.weaponSlots
              .map((s, i) => s === null ? i : -1).filter(i => i !== -1);
            st.drawWeapon(2);
            /* Pre-popola oppHand con le carte appena pescate (_landed: false) */
            oppDrawCountRef.current = emptySlots.length;
            setOppHand(prev => {
              const newEntries = emptySlots.map(slotIdx => ({
                _drawIdx: slotIdx, _slotIdx: slotIdx, _landed: false,
              }));
              const kept = prev.filter(c => newEntries.every(n => n._drawIdx !== c._drawIdx));
              return [...kept, ...newEntries];
            });
          }
          setOppDrawStarted(true);
        }, OPP_DRAW_DELAY * 1000);
      }
      /* Quando TUTTE le carte di questa pesca sono atterrate, sblocca drawData */
      if (next.size >= totalCards) {
        setTimeout(() => {
          setDrawData(null);
          setLandedP1(new Set());
        }, 100);
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawData]);

  /* ── Carta avversario atterra ── */
  const handleP2Landed = useCallback((idx) => {
    setLandedP2(prev => new Set(prev).add(idx));
    /* Marca come atterrata (oppHand è già pre-popolato) */
    setOppHand(prev => prev.map(c =>
      c._drawIdx === idx ? { ...c, _landed: true } : c
    ));
  }, []);

  /* ── Gioca carta dalla mano → slot azione → dissoluzione → arco → buff cavaliere ── */
  const handlePlayCard = useCallback((drawIdx, cardGroup) => {
    if (!cardGroup || isAnimatingRef.current) return;

    /* Trova la carta e lo slotIdx reale */
    const card = playerHand.find(c => c._drawIdx === drawIdx);
    if (!card) return;
    const slotIdx = card._slotIdx ?? drawIdx;

    /* Pre-validazione PA */
    const weapon = p1.weaponSlots[slotIdx];
    if (!weapon || !p1.activeCard) return;
    if (p1.activeCard.pa < weapon.cu) return;

    const startPos = {
      x: cardGroup.position.x,
      y: cardGroup.position.y,
      z: cardGroup.position.z,
    };

    isAnimatingRef.current = true;
    pendingEquipRef.current = slotIdx;
    setPlayedCards(prev => new Set(prev).add(drawIdx));
    setPlayingCard({ card, startPos });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerHand, p1.weaponSlots, p1.activeCard]);

  /* PlayingCard termina → equipaggia nello store */
  const handlePlayComplete = useCallback(() => {
    setPlayingCard(null);
    isAnimatingRef.current = false;
    if (pendingEquipRef.current !== null) {
      equipWeapon(1, pendingEquipRef.current);
      pendingEquipRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ═══════ Scarto carta dalla mano (drag nella Hotzone) ═══════ */
  const handleDiscardCard = useCallback((drawIdx, slotIdx, cardGroup) => {
    if (turn !== 1 || gameOver || isInitializing || isAnimatingRef.current) return;
    const card = playerHand.find(c => c._drawIdx === drawIdx);
    if (!card || !cardGroup) return;

    const startPos = {
      x: cardGroup.position.x,
      y: cardGroup.position.y,
      z: cardGroup.position.z,
    };

    /* Nascondi dalla mano e lancia animazione */
    isAnimatingRef.current = true;
    setPlayedCards(prev => new Set(prev).add(drawIdx));
    setDiscardingCard({ card, startPos });
    discardSlotRef.current = slotIdx;   // traccia lo slot per il free-redraw
    discardWeapon(1, slotIdx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerHand, turn, gameOver, isInitializing]);

  /* DiscardingCard termina → pulisci stato + sincronizza free-redraw in playerHand */
  const handleDiscardComplete = useCallback(() => {
    setDiscardingCard(null);
    isAnimatingRef.current = false;

    const slotIdx = discardSlotRef.current;
    discardSlotRef.current = null;
    if (slotIdx == null) return;

    /* Se il free-redraw ha già piazzato una nuova carta nello slot, 
       aggiungila con _landed: false e lancia l'animazione di volo */
    const newCard = useGameStore.getState().p1.weaponSlots[slotIdx];
    if (newCard) {
      /* Inserisci subito in playerHand (non atterrata) → il conteggio è aggiornato */
      setPlayerHand(prev => {
        const without = prev.filter(c => c._slotIdx !== slotIdx);
        return [...without, { ...newCard, _drawIdx: slotIdx, _slotIdx: slotIdx, _landed: false }];
      });
      setPlayedCards(prev => { const next = new Set(prev); next.delete(slotIdx); return next; });
      /* Lancia DrawingCard per la singola carta pescata dal free-redraw */
      setDrawData({
        cards: [{ ...newCard, _drawIdx: slotIdx, _slotIdx: slotIdx, _totalCount: MAX_HAND_SIZE }],
      });
      setLandedP1(new Set());
    }
  }, []);

  /* ═══════ AI equip → animazione PlayingCard per l'avversario ═══════ */
  const lastEquipProcessed = useRef(null);
  useEffect(() => {
    if (!lastEquipResult || lastEquipResult === lastEquipProcessed.current) return;
    lastEquipProcessed.current = lastEquipResult;
    const { playerNum, slotIdx, weapon } = lastEquipResult;

    /* Solo per l'AI — il giocatore usa handlePlayCard direttamente */
    if (playerNum === 1) {
      clearLastEquip();
      return;
    }

    /* Calcola posizione di partenza dalla mano avversario */
    const tc = oppHand.length || MAX_HAND_SIZE;
    const offset = slotIdx - (tc - 1) / 2;
    const startPos = {
      x: offset * OPP_SPREAD,
      y: OPP_HAND_BASE_Y + slotIdx * OPP_Z_STEP,
      z: OPP_HAND_Z,
    };

    /* Nascondi la carta dalla mano visuale dell'avversario */
    setOppPlayedCards(prev => new Set(prev).add(slotIdx));

    setAiPlayingCard({ card: weapon, startPos });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEquipResult]);

  /* AI PlayingCard termina → pulisci stato */
  const handleAiPlayComplete = useCallback(() => {
    setAiPlayingCard(null);
    clearLastEquip();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Mano completa = tutte le carte non giocate (include _landed: false per il conteggio) */
  const fullHand = useMemo(
    () => playerHand.filter(c => !playedCards.has(c._drawIdx)),
    [playerHand, playedCards],
  );

  /* Riferimenti rapidi a CONFIG_3D per la zona di scontro */
  const clash = CONFIG_3D.clashZone;

  return (
    <>
      {/* ── Telecamera ── */}
      <PerspectiveCamera
        makeDefault
        fov={CAM_FOV}
        position={[0, CAM_HEIGHT, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        near={0.1} far={200}
      />

      {/* ── Illuminazione ── */}
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

      {/* ── Mazzi — ognuno legge la propria trasformazione da CONFIG_3D ── */}

      {/* Mazzo Principale Armi Giocatore — cliccabile con sollevamento al hover */}
      <DeckStack
        configKey="playerMainDeck"
        countOverride={p1?.weaponsLeft ?? 45}
        onClick={handleDraw}
        hoverLift={DECK_HOVER_LIFT}
      />

      {/* Mazzo Principale Armi Avversario */}
      <DeckStack
        configKey="opponentMainDeck"
        countOverride={p2?.weaponsLeft ?? 45}
      />

      {/* Mazzo Cavalieri Giocatore — conta cavalieri rimasti nel deck */}
      <DeckStack
        configKey="playerKnightDeck"
        countOverride={p1?.cardsLeft ?? 0}
      />

      {/* Mazzo Cavalieri Avversario */}
      <DeckStack
        configKey="opponentKnightDeck"
        countOverride={p2?.cardsLeft ?? 0}
      />

      {/* ── Animazioni Estrazione Cavalieri (iniziale + redraw dopo morte) ── */}
      {!p1KnightReady && p1.activeCard && (
        <KnightDrawCard
          knightData={p1.activeCard}
          deckConfigKey="playerKnightDeck"
          slotConfigKey="playerKnightSlot"
          delay={knightsPhase === 'drawing' ? 0 : 0}
          onLanded={() => setP1KnightReady(true)}
        />
      )}
      {!p2KnightReady && p2.activeCard && (
        <KnightDrawCard
          knightData={p2.activeCard}
          deckConfigKey="opponentKnightDeck"
          slotConfigKey="opponentKnightSlot"
          delay={knightsPhase === 'drawing' ? KNIGHT_STAGGER : 0}
          onLanded={() => setP2KnightReady(true)}
        />
      )}

      {/* ── Cavalieri atterrati ── */}
      {/* Il guard p*KnightDying impedisce lo smontaggio durante la dissoluzione */}
      {p1KnightReady && (p1.activeCard || p1KnightDying) && (
        <Card3D
          ref={p1KnightRef}
          position={perspPos(CONFIG_3D.playerKnightSlot)}
          rotation={perspRot(CONFIG_3D.playerKnightSlot)}
          scale={CONFIG_3D.playerKnightSlot.scale}
          topSkew={CONFIG_3D.playerKnightSlot.topSkew ?? [0, 0]}
          bottomSkew={CONFIG_3D.playerKnightSlot.bottomSkew ?? [0, 0]}
          type="knight"
          name={(p1.activeCard ?? p1LastKnight.current)?.name ?? '?'}
          atk={(p1.activeCard ?? p1LastKnight.current)?.atk ?? 0}
          def={(p1.activeCard ?? p1LastKnight.current)?.def ?? 0}
          pa={(p1.activeCard ?? p1LastKnight.current)?.pa ?? 0}
          isAtkBuffed={p1Stats.isAtkBuffed}
          isDefBuffed={p1Stats.isDefBuffed}
          hoverable
          hoverLift={0}
        />
      )}
      {p1KnightReady && p1.activeCard && (
        <BuffIcons
          position={perspPos(CONFIG_3D.playerKnightSlot)}
          isAtkBuffed={p1Stats.isAtkBuffed}
          isDefBuffed={p1Stats.isDefBuffed}
        />
      )}
      {p2KnightReady && (p2.activeCard || p2KnightDying) && (
        <Card3D
          ref={p2KnightRef}
          position={perspPos(CONFIG_3D.opponentKnightSlot)}
          rotation={perspRot(CONFIG_3D.opponentKnightSlot)}
          scale={CONFIG_3D.opponentKnightSlot.scale}
          topSkew={CONFIG_3D.opponentKnightSlot.topSkew ?? [0, 0]}
          bottomSkew={CONFIG_3D.opponentKnightSlot.bottomSkew ?? [0, 0]}
          type="knight"
          name={(p2.activeCard ?? p2LastKnight.current)?.name ?? '?'}
          atk={(p2.activeCard ?? p2LastKnight.current)?.atk ?? 0}
          def={(p2.activeCard ?? p2LastKnight.current)?.def ?? 0}
          pa={(p2.activeCard ?? p2LastKnight.current)?.pa ?? 0}
          isAtkBuffed={p2Stats.isAtkBuffed}
          isDefBuffed={p2Stats.isDefBuffed}
          hoverable
          hoverLift={0}
        />
      )}
      {p2KnightReady && p2.activeCard && (
        <BuffIcons
          position={perspPos(CONFIG_3D.opponentKnightSlot)}
          isAtkBuffed={p2Stats.isAtkBuffed}
          isDefBuffed={p2Stats.isDefBuffed}
        />
      )}

      {/* ═══════ VFX Manager ═══════ */}
      <VFXManager
        p1KnightRef={p1KnightRef}
        p2KnightRef={p2KnightRef}
        knightPositions={knightPositions}
      />

      {/* ── Terreno Attivo (alto-sinistra, fisso, respiro lento) ── */}
      {/* Durante la rivelazione: animazione dal mazzo al centro → posizione finale */}
      {terrainReveal && (
        <TerrainRevealCard
          terrainData={terrainReveal.data}
          deckConfigKey={terrainReveal.deckKey}
          onComplete={() => setTerrainReveal(null)}
        />
      )}
      {/* Dopo la rivelazione: carta statica con respiro */}
      {activeTerrain && !terrainReveal && (
        <TerrainDisplayCard terrainData={activeTerrain} />
      )}

      {/* ── Anello Zona di Scontro (esatto centro tra i due cavalieri) ── */}
      <mesh rotation={perspRot(clash)} position={perspPos(clash)} scale={clash.scale}>
        <ringGeometry args={[clash.innerRadius, clash.outerRadius, 32]} />
        <meshStandardMaterial
          color="#8a0303" emissive="#8a0303" emissiveIntensity={0.5}
          transparent opacity={0.45} side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Debug: bordo visibile della Hotzone di scarto ── */}
      {DEBUG_HOTZONE && (
        <mesh
          position={[HOTZONE_CX, 0.005, HOTZONE_CZ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[HOTZONE_W, HOTZONE_H]} />
          <meshBasicMaterial
            color="#ff4444"
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      {DEBUG_HOTZONE && (
        <lineSegments
          position={[HOTZONE_CX, 0.006, HOTZONE_CZ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <edgesGeometry args={[new THREE.PlaneGeometry(HOTZONE_W, HOTZONE_H)]} />
          <lineBasicMaterial color="#ff0000" linewidth={2} />
        </lineSegments>
      )}

      {/* ── Carte in Pesca del Giocatore ── */}
      {drawData && drawData.cards.map((card, arrIdx) =>
        !landedP1.has(card._drawIdx) && (
          <DrawingCard
            key={`p1draw-${card._drawIdx}`}
            card={card} index={card._drawIdx} totalCount={MAX_HAND_SIZE}
            deckPos={perspPos(CONFIG_3D.playerMainDeck)}
            deckRot={perspRot(CONFIG_3D.playerMainDeck)}
            deckTopSkew={CONFIG_3D.playerMainDeck.topSkew ?? [0, 0]}
            deckBottomSkew={CONFIG_3D.playerMainDeck.bottomSkew ?? [0, 0]}
            isOpponent={false}
            absoluteDelay={arrIdx * CARD_ANIM_DUR}
            onLanded={handleP1Landed}
          />
        )
      )}

      {/* ── Carte in Pesca dell'Avversario (faccia in giù, decorative + dati reali sotto) ── */}
      {oppDrawStarted && (() => {
        /* Filtra solo le carte non atterrate (in volo) */
        const inFlight = oppHand.filter(c => !c._landed && !landedP2.has(c._drawIdx));
        return inFlight.map((c, arrIdx) =>
          <DrawingCard
            key={`p2draw-${c._drawIdx}`}
            card={null} index={c._drawIdx} totalCount={MAX_HAND_SIZE}
            deckPos={perspPos(CONFIG_3D.opponentMainDeck)}
            deckRot={perspRot(CONFIG_3D.opponentMainDeck)}
            deckTopSkew={CONFIG_3D.opponentMainDeck.topSkew ?? [0, 0]}
            deckBottomSkew={CONFIG_3D.opponentMainDeck.bottomSkew ?? [0, 0]}
            isOpponent
            absoluteDelay={arrIdx * CARD_ANIM_DUR}
            onLanded={handleP2Landed}
          />
        );
      })()}

      {/* ── Mano del Giocatore (ventaglio dinamico centrato) ── */}
      {fullHand.map((card, vi) => (
        card._landed && (
          <HandCard
            key={`hand-${card._drawIdx}`}
            card={card}
            visibleIndex={vi}
            visibleCount={fullHand.length}
            onPlay={handlePlayCard}
            onDiscard={handleDiscardCard}
          />
        )
      ))}

      {/* ── Carta Giocata → slot azione → dissoluzione → arco → buff cavaliere ── */}
      {playingCard && (
        <PlayingCard
          card={playingCard.card}
          startPos={playingCard.startPos}
          actionConfigKey="playerActionSlot"
          knightGroupRef={p1KnightRef}
          onComplete={handlePlayComplete}
        />
      )}

      {/* ── Carta Giocata AI → stessa sequenza dal lato avversario ── */}
      {aiPlayingCard && (
        <PlayingCard
          card={aiPlayingCard.card}
          startPos={aiPlayingCard.startPos}
          startScale={OPP_HAND_SC}
          actionConfigKey="opponentActionSlot"
          knightGroupRef={p2KnightRef}
          onComplete={handleAiPlayComplete}
        />
      )}

      {/* ── Carta Scartata → volo al centro + dissoluzione ── */}
      {discardingCard && (
        <DiscardingCard
          card={discardingCard.card}
          startPos={discardingCard.startPos}
          onComplete={handleDiscardComplete}
        />
      )}

      {/* ── Mano dell'Avversario (ventaglio dinamico centrato) ── */}
      {(() => {
        const fullOpp = oppHand.filter(c => !oppPlayedCards.has(c._drawIdx));
        return fullOpp.map((c, vi) => (
          c._landed && (
            <OppHandCard
              key={`opp-${c._drawIdx}`}
              visibleIndex={vi}
              visibleCount={fullOpp.length}
              card={p2.weaponSlots[c._slotIdx ?? c._drawIdx] ?? null}
            />
          )
        ));
      })()}

      {/* ── Disco flash d'impatto per attacco fisico ── */}
      <mesh ref={attackFlashRef} visible={false}
        position={[0, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 32]} />
        <meshBasicMaterial
          color="#ff3300" transparent opacity={0}
          depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}


/* ─── HUD overlay — pannello azioni verticale (destra) + moneta Attacca/Pass ─── */
const HOLD_THRESHOLD = 1500; // ms per triggerare PassTurn

function GameHUD() {
  const {
    turn, gameOver, hasAttacked, p1, p2, isInitializing,
    playAITurn, attack, endTurn,
  } = useGameStore();
  const [aiPlaying, setAiPlaying] = useState(false);
  const [coinFlipping, setCoinFlipping] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0); // 0–1
  const holdTimerRef  = useRef(null);
  const holdStartRef  = useRef(0);
  const holdRafRef    = useRef(null);
  const didPassRef    = useRef(false);

  const canAct = turn === 1 && !gameOver && !isInitializing && !aiPlaying
    && !coinFlipping && !hasAttacked && p1.activeCard && p2.activeCard
    && !p1.buffs.some(b => b.id === 'noAttack' || b.id === 'sabbia');

  /* ── Pointer Down: avvia timer hold ── */
  const handlePointerDown = useCallback(() => {
    if (!canAct) return;
    didPassRef.current = false;
    holdStartRef.current = performance.now();

    /* Aggiorna anello di caricamento via RAF */
    const tick = () => {
      const elapsed = performance.now() - holdStartRef.current;
      const p = Math.min(elapsed / HOLD_THRESHOLD, 1);
      setHoldProgress(p);
      if (p < 1) {
        holdRafRef.current = requestAnimationFrame(tick);
      } else {
        /* Hold completato → PassTurn */
        didPassRef.current = true;
        setHoldProgress(0);
        const s = useGameStore.getState();
        if (s.gameOver) return;
        s.endTurn(1);
        setAiPlaying(true);
        s.playAITurn().then(() => setAiPlaying(false));
      }
    };
    holdRafRef.current = requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAct]);

  /* ── Pointer Up: se rilascio rapido (<300ms) → Attack, altrimenti annulla hold ── */
  const handlePointerUp = useCallback(() => {
    if (holdRafRef.current) cancelAnimationFrame(holdRafRef.current);
    holdRafRef.current = null;
    setHoldProgress(0);

    if (didPassRef.current) return; // già passato turno
    if (!canAct) return;

    const elapsed = performance.now() - holdStartRef.current;
    if (elapsed < 300) {
      /* Click rapido → Attacca */
      setCoinFlipping(true);
      setTimeout(() => {
        attack(1);
        setCoinFlipping(false);
      }, 600);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAct]);

  /* Cleanup RAF al unmount */
  useEffect(() => () => {
    if (holdRafRef.current) cancelAnimationFrame(holdRafRef.current);
  }, []);

  /* ── Auto Fine Turno: scatta appena hasAttacked diventa true e l'anim d'attacco è cessata ── */
  const autoEndScheduled = useRef(false);
  useEffect(() => {
    if (!hasAttacked || turn !== 1 || gameOver || aiPlaying || isInitializing) return;
    if (autoEndScheduled.current) return;
    autoEndScheduled.current = true;
    const delay = (ATTACK_LIFT_DUR + ATTACK_LUNGE_DUR + ATTACK_FLASH_CNT * ATTACK_FLASH_DUR + ATTACK_RETURN_DUR + 0.3) * 1000;
    const timer = setTimeout(async () => {
      const s = useGameStore.getState();
      if (s.gameOver) { autoEndScheduled.current = false; return; }
      s.endTurn(1);
      setAiPlaying(true);
      await s.playAITurn();
      setAiPlaying(false);
      autoEndScheduled.current = false;
    }, delay);
    return () => { clearTimeout(timer); autoEndScheduled.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAttacked, turn, gameOver, aiPlaying, isInitializing]);

  if (isInitializing) return null;

  /* Stile CSS per animazione flip moneta + pulse icone buff + anello di caricamento */
  const COIN_SIZE = 83; // 64 * 1.3 ≈ 83
  const ringCircumference = Math.PI * (COIN_SIZE - 6); // raggio interno svg stroke

  const styleTag = `
    @keyframes coin-flip {
      0%   { transform: rotateY(0deg) scale(1); }
      50%  { transform: rotateY(540deg) scale(1.15); }
      100% { transform: rotateY(1080deg) scale(1); }
    }
    @keyframes pulse-icon {
      0%, 100% { opacity: 0.85; transform: scale(1); }
      50%      { opacity: 1;    transform: scale(1.2); }
    }
  `;

  return (
    <>
      <style>{styleTag}</style>

      {/* ── Pannello Azioni Verticale (destra) ── */}
      <div style={{
        position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center',
        zIndex: 10, fontFamily: 'monospace', userSelect: 'none',
      }}>
        {/* Indicatore turno */}
        <div style={{
          background: turn === 1 ? '#1a6b1a' : '#6b1a1a',
          padding: '6px 12px', borderRadius: 6, fontSize: 13, color: '#fff',
          textAlign: 'center', minWidth: 60,
        }}>
          {gameOver ? 'FINE' : aiPlaying ? 'AI...' : `Turno G${turn}`}
        </div>

        {/* Moneta "Attacca / Hold = Pass" con anello scintille */}
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{
            position: 'relative',
            width: COIN_SIZE, height: COIN_SIZE,
            cursor: canAct ? 'pointer' : 'default',
            opacity: canAct ? 1 : 0.4,
          }}
        >
          {/* Anello SVG di caricamento (scintille perimetrali) */}
          <svg width={COIN_SIZE} height={COIN_SIZE}
            style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}
          >
            <circle
              cx={COIN_SIZE / 2} cy={COIN_SIZE / 2} r={(COIN_SIZE - 6) / 2}
              fill="none" stroke="#ffaa00" strokeWidth={3}
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringCircumference * (1 - holdProgress)}
              strokeLinecap="round"
              style={{ transition: holdProgress === 0 ? 'stroke-dashoffset 0.05s' : 'none',
                       filter: holdProgress > 0 ? 'drop-shadow(0 0 4px #ffaa00)' : 'none' }}
            />
          </svg>
          {/* Disco moneta */}
          <div style={{
            position: 'absolute', top: 3, left: 3,
            width: COIN_SIZE - 6, height: COIN_SIZE - 6, borderRadius: '50%',
            background: canAct ? '#8a1a1a' : '#333',
            border: canAct ? '2px solid #ff4444' : '2px solid #555',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace',
            textTransform: 'uppercase', letterSpacing: 1,
            animation: coinFlipping ? 'coin-flip 0.6s ease-in-out' : 'none',
            transition: 'background 0.2s, border 0.2s',
          }}>
            {holdProgress > 0.05 ? 'Pass...' : 'Attacca'}
          </div>
        </div>
      </div>

      {/* ── Overlay Game Over ── */}
      {gameOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.65)', fontFamily: 'monospace', color: '#fff',
          userSelect: 'none', pointerEvents: 'auto',
        }}>
          <div style={{ fontSize: 42, fontWeight: 'bold', textShadow: '0 0 20px #ff6600' }}>
            {(!p1.activeCard && p1.cardsLeft === 0) && (!p2.activeCard && p2.cardsLeft === 0)
              ? 'PAREGGIO'
              : (!p1.activeCard && p1.cardsLeft === 0) ? 'SCONFITTA' : 'VITTORIA'}
          </div>
          <div style={{ fontSize: 16, marginTop: 12, opacity: 0.7 }}>
            Ricarica la pagina per giocare ancora
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Exported Canvas wrapper ─── */
export default function GameBoard3D() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <GameHUD />
      <Canvas
        frameloop="always"
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        style={{ width: '100%', height: '100%', background: '#050505' }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
