/**
 * Card3D.jsx — Mesh carta 3D con animazioni gestite da GSAP.
 *
 * Scatola 3D reale con spessore visibile. GSAP gestisce:
 *   - Hover: sollevamento + raddrizzamento + scala
 *   - Giocata: fluttuazione → picchiata → rimbalzo+wobble sul tavolo
 *
 * Tutte le animazioni usano ref — nessuna transizione di stato React, nessuna lib spring.
 */
import { useMemo, useRef, useCallback, useImperativeHandle, useEffect } from 'react';
import { Text, useTexture } from '@react-three/drei';
import { gsap } from 'gsap';
import * as THREE from 'three';
import dorsoImg from '../../assets/dorso_carta.png';
import fronteImg from '../../assets/fronte_carta.png';

/* ═══════ Pre-caricamento texture ═══════
   Garantisce che le texture siano in cache PRIMA del primo render.
   Previene il Suspense boundary dal smontare/rimontare il Canvas. */
useTexture.preload(dorsoImg);
useTexture.preload(fronteImg);

/* ═══════ Geometria Carta ═══════ */
const H = 1.0;
const W = H * (1610 / 2449); /* ≈ 0.6575 — aspect ratio esatto delle texture */

/* Spessore globale della carta — modifica questo unico valore per snellire tutte le carte */
export const GLOBAL_CARD_THICKNESS = 0.02;
const D = GLOBAL_CARD_THICKNESS;

const TYPE_COLORS = {
  knight: '#1a0000', arma: '#330000', scudo: '#002200',
  oggetto: '#332200', terreno: '#1a0033', deck: '#111', back: '#333333',
};
const BORDER_COLORS = {
  knight: '#8a0303', arma: '#ff0000', scudo: '#4dff4d',
  oggetto: '#ffd700', terreno: '#9b59b6', deck: '#444', back: '#555',
};
const TYPE_ICONS = {
  knight: '\u2660', arma: '\u2694', scudo: '\u2694',
  oggetto: '\u2728', terreno: '\u25C8', deck: '\u2660',
};

/* ═══════ GSAP Animation Helpers (exported for use by parent) ═══════ */

/* ── Hand card hover vertical lift (world units, Y axis toward camera).
   ↓ Adjust this number to change how high hand cards pop up on hover: ↓
   File: src/pages/DevSandbox/Card3D.jsx  →  HAND_HOVER_LIFT_Y           */
const HAND_HOVER_LIFT_Y = 0.3;
const HAND_HOVER_SCREEN_LIFT = 0.5;

/**
 * Hover IN: solleva la carta verso la telecamera (Y) E la fa scorrere fisicamente
 * verso il centro schermo (−Z) così il sollevamento è chiaramente visibile dalla
 * telecamera in prospettiva dall'alto.
 */
export function animateHoverIn(group, { restY, restZ, targetScale, hoverLift }) {
  gsap.killTweensOf(group.position);
  gsap.killTweensOf(group.scale);
  if (hoverLift > 0) {
    gsap.to(group.position, { y: restY + HAND_HOVER_LIFT_Y, z: restZ - HAND_HOVER_SCREEN_LIFT, duration: 0.18, ease: 'power2.out', overwrite: true });
  }
  gsap.to(group.scale, { x: targetScale * 1.12, y: targetScale * 1.12, z: targetScale * 1.12, duration: 0.18, ease: 'power2.out', overwrite: true });
}

/**
 * Hover OUT: ritorna alla Y, Z e scala di riposo. Rotazione invariata.
 */
export function animateHoverOut(group, { restY, restZ, restRotX, restRotZ, targetScale, hoverLift }) {
  if (hoverLift > 0) {
    gsap.to(group.position, { y: restY, z: restZ, duration: 0.22, ease: 'power2.inOut', overwrite: true });
  }
  gsap.to(group.scale, { x: targetScale, y: targetScale, z: targetScale, duration: 0.22, ease: 'power2.inOut', overwrite: true });
}

/**
 * Animazione giocata: timeline GSAP monolitica.
 *   1. Termina tutti i tween residui (hover ecc.)
 *   2. Fluttua verso il centro schermo
 *   3. Pausa drammatica
 *   4. Rimpicciolisce + ruota per allinearsi all'inclinazione del tabellone
 *   5. Rimbalzo all'atterraggio alla Y finale
 *
 * @param {THREE.Group} group - il ref del gruppo carta
 * @param {Object} target - { x, y, z, rotX?, rotY?, rotZ? } destinazione + rotazione
 * @param {Function} onComplete - callback quando l'animazione finisce
 */
export function animatePlayCard(group, target, onComplete) {
  /* Termina tutte le animazioni residue (hover ecc.) */
  gsap.killTweensOf(group.position);
  gsap.killTweensOf(group.rotation);
  gsap.killTweensOf(group.scale);

  /* Segna come in gioco — disabilita i gestori hover */
  group.userData.isPlaying = true;

  const finalRotX = target.rotX ?? (-Math.PI / 2);
  const finalRotY = target.rotY ?? 0;
  const finalRotZ = target.rotZ ?? 0;

  const tl = gsap.timeline({
    onComplete: () => {
      group.userData.isPlaying = false;
      onComplete?.();
    },
  });

  /* Fase 1 — Fluttuazione verso il centro schermo */
  tl.to(group.position, { x: 0, y: 2.5, z: 0, duration: 0.35, ease: 'power2.out' });
  tl.to(group.rotation, { x: -Math.PI / 2, y: 0, z: 0, duration: 0.35, ease: 'power2.out' }, '<');
  tl.to(group.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 0.35, ease: 'power2.out' }, '<');

  /* Pausa drammatica */
  tl.to(group.position, { y: 2.6, duration: 0.25, ease: 'sine.inOut', yoyo: true, repeat: 1 });

  /* Fase 2 — Picchiata: rimpicciolisci + ruota verso l'inclinazione del tabellone */
  tl.to(group.position, { x: target.x, y: target.y + 0.8, z: target.z, duration: 0.25, ease: 'power3.in' });
  tl.to(group.rotation, { x: finalRotX, y: finalRotY, z: finalRotZ, duration: 0.25, ease: 'power2.inOut' }, '<');
  tl.to(group.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.25, ease: 'power2.in' }, '<');

  /* Fase 3 — Rimbalzo all'atterraggio alla Y finale */
  tl.to(group.position, { y: target.y, duration: 0.4, ease: 'bounce.out' });

  /* Wobble all'atterraggio */
  tl.to(group.rotation, { z: finalRotZ + 0.06, duration: 0.08, ease: 'power1.out' }, '-=0.3');
  tl.to(group.rotation, { z: finalRotZ - 0.04, duration: 0.08, ease: 'power1.out' });
  tl.to(group.rotation, { z: finalRotZ + 0.02, duration: 0.06, ease: 'power1.out' });
  tl.to(group.rotation, { z: finalRotZ, duration: 0.06, ease: 'power1.out' });

  return tl;
}


/* ── Sfondo scuro con bordi arrotondati per la faccia frontale ── */
const FRONT_BG_RADIUS = 0.038;

/* ── Badge semitrasparente scuro dietro una statistica ── */
function StatBadge({ x, y, w = 0.15, h = 0.09 }) {
  const shape = useMemo(() => {
    const r = 0.018;
    const bx = -w / 2, by = -h / 2;
    const s = new THREE.Shape();
    s.moveTo(bx + r, by);
    s.lineTo(bx + w - r, by);
    s.quadraticCurveTo(bx + w, by,      bx + w, by + r);
    s.lineTo(bx + w, by + h - r);
    s.quadraticCurveTo(bx + w, by + h,  bx + w - r, by + h);
    s.lineTo(bx + r, by + h);
    s.quadraticCurveTo(bx, by + h,      bx, by + h - r);
    s.lineTo(bx, by + r);
    s.quadraticCurveTo(bx, by,          bx + r, by);
    return s;
  }, [w, h]);
  return (
    <mesh position={[x, y, GLOBAL_CARD_THICKNESS / 2 + 0.0055]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color="#000000" transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}


/* ═══════ Card Component ═══════ */

export default function Card3D({
  ref,
  name = '',
  atk, def, pa,
  type = 'knight',
  bonus,
  desc,
  cu,
  faceDown = false,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  topSkew = [0, 0],
  bottomSkew = [0, 0],
  leftSkew = [0, 0],
  rightSkew = [0, 0],
  hoverable = false,
  hoverLift = 0.8,
  renderOrder = 0,
  isAtkBuffed = false,
  isDefBuffed = false,
  onClick,
  onContextMenu,
}) {
  const dorsoTex  = useTexture(dorsoImg);
  const fronteTex = useTexture(fronteImg);

  /* Forza SRGB color space — evita colori slavati da linear-space rendering */
  useMemo(() => {
    dorsoTex.colorSpace  = THREE.SRGBColorSpace;
    fronteTex.colorSpace = THREE.SRGBColorSpace;
    dorsoTex.needsUpdate  = true;
    fronteTex.needsUpdate = true;
  }, [dorsoTex, fronteTex]);

  const groupRef  = useRef();
  const isHovered = useRef(false);

  /* Esponi il ref interno del gruppo al padre (React 19 ref-as-prop) */
  useImperativeHandle(ref, () => groupRef.current);

  /* ═════ Shader distorsione Skew + combustione Dissolve ────────────────────────────
     Uniform GPU iniettate in MeshStandardMaterial via onBeforeCompile.

     Skew  (vec2 topSkew / bottomSkew):
       Trasla i vertici della metà superiore (Y>0) o inferiore (Y<0) su XY.
       [0,0] = nessuna deformazione. Anima via _setSkew(tx, ty, bx, by).

     Dissolve (float dissolveThreshold):
       -0.1 = completamente visibile (default, inattivo).
       Anima verso 1.5 per bruciare la carta da sotto → sopra.
       Soglia modulata dal rumore con bordo incandescente arancio/rosso.
       Attiva via _startDissolve(duration, onComplete).

     La varying vLocalPos passa la posizione in spazio oggetto al fragment per il seed del rumore.
  ─────────────────────────────────────────────────────────────────────────── */
  const bodyMeshRef   = useRef();
  const borderMeshRef = useRef();
  const topSkewUni    = useRef({ value: { x: 0, y: 0 } });
  const bottomSkewUni = useRef({ value: { x: 0, y: 0 } });
  const leftSkewUni   = useRef({ value: { x: 0, y: 0 } });
  const rightSkewUni  = useRef({ value: { x: 0, y: 0 } });
  const dissolveUni   = useRef({ value: -0.1 });
  const fadeOpacityUni = useRef({ value: 1.0 });

  /* ── Face / border colors (servono ai materiali imperativi sotto) ── */
  const faceColor   = useMemo(() => TYPE_COLORS[type] || '#111', [type]);
  const borderColor = useMemo(() => BORDER_COLORS[type] || '#444', [type]);

  /* ── Shape per il FrontBackground (bordi arrotondati) ── */
  const frontBgShape = useMemo(() => {
    const bw = W * 0.97, bh = H * 0.97, r = FRONT_BG_RADIUS;
    const x = -bw / 2, y = -bh / 2;
    const s = new THREE.Shape();
    s.moveTo(x + r, y);
    s.lineTo(x + bw - r, y);
    s.quadraticCurveTo(x + bw, y, x + bw, y + r);
    s.lineTo(x + bw, y + bh - r);
    s.quadraticCurveTo(x + bw, y + bh, x + bw - r, y + bh);
    s.lineTo(x + r, y + bh);
    s.quadraticCurveTo(x, y + bh, x, y + bh - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }, []);

  useEffect(() => {
    const install = (mesh) => {
      if (!mesh?.material) return;
      const m = mesh.material;
      m.onBeforeCompile = (shader) => {
        shader.uniforms.topSkew           = topSkewUni.current;
        shader.uniforms.bottomSkew        = bottomSkewUni.current;
        shader.uniforms.leftSkew          = leftSkewUni.current;
        shader.uniforms.rightSkew         = rightSkewUni.current;
        shader.uniforms.dissolveThreshold = dissolveUni.current;
        shader.uniforms.fadeOpacity        = fadeOpacityUni.current;

        /* ── Vertex: skew verticale + laterale + pass local pos al fragment ── */
        shader.vertexShader =
          'uniform vec2 topSkew;\nuniform vec2 bottomSkew;\nuniform vec2 leftSkew;\nuniform vec2 rightSkew;\nvarying vec3 vLocalPos;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vLocalPos = position;
            if (position.y > 0.0) {
              transformed.x += topSkew.x;
              transformed.y += topSkew.y;
            } else if (position.y < 0.0) {
              transformed.x += bottomSkew.x;
              transformed.y += bottomSkew.y;
            }
            if (position.x < 0.0) {
              transformed.x += leftSkew.x;
              transformed.y += leftSkew.y;
            } else if (position.x > 0.0) {
              transformed.x += rightSkew.x;
              transformed.y += rightSkew.y;
            }`,
          );

        /* ── Fragment: dissolve — corrosione concentrica + fade-out morbido ── */
        shader.fragmentShader =
          'uniform float dissolveThreshold;\nuniform float fadeOpacity;\nvarying vec3 vLocalPos;\n' +
          shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `if (dissolveThreshold > -0.05) {
              vec2 cardUV = vec2(vLocalPos.x / ${W} + 0.5, vLocalPos.y / ${H} + 0.5);
              float minD = 999.0;
              for (int i = 0; i < 8; i++) {
                float fi = float(i);
                vec2 c = vec2(
                  fract(sin(fi * 127.1 + 311.7) * 43758.5453),
                  fract(sin(fi * 269.5 + 183.3) * 28001.8384)
                );
                c = c * 0.7 + 0.15;
                minD = min(minD, distance(cardUV, c));
              }
              float radius = dissolveThreshold * 0.6;
              if (minD < radius) discard;
              float edgeW = 0.06;
              float edge = 1.0 - smoothstep(radius, radius + edgeW, minD);
              if (edge > 0.0) {
                vec3 glow = mix(vec3(1.0, 0.85, 0.3), vec3(1.0, 0.4, 0.0), edge);
                gl_FragColor.rgb = mix(gl_FragColor.rgb, glow, edge * 0.9);
                gl_FragColor.rgb += vec3(0.6, 0.3, 0.0) * edge * 0.5;
              }
            }
            /* Fade-out morbido globale — la carta svanisce come fumo */
            gl_FragColor.a *= fadeOpacity;
            #include <dithering_fragment>`,
          );
      };
      m.transparent = true;
      m.needsUpdate = true;
    };
    install(bodyMeshRef.current);
    install(borderMeshRef.current);

    topSkewUni.current.value.x    = topSkew[0];
    topSkewUni.current.value.y    = topSkew[1];
    bottomSkewUni.current.value.x = bottomSkew[0];
    bottomSkewUni.current.value.y = bottomSkew[1];
    leftSkewUni.current.value.x   = leftSkew[0];
    leftSkewUni.current.value.y   = leftSkew[1];
    rightSkewUni.current.value.x  = rightSkew[0];
    rightSkewUni.current.value.y  = rightSkew[1];
    if (groupRef.current) {
      groupRef.current.userData._setSkew = (tx, ty, bx, by) => {
        topSkewUni.current.value.x    = tx;
        topSkewUni.current.value.y    = ty;
        bottomSkewUni.current.value.x = bx;
        bottomSkewUni.current.value.y = by;
      };
      groupRef.current.userData._setLateralSkew = (lx, ly, rx, ry) => {
        leftSkewUni.current.value.x  = lx;
        leftSkewUni.current.value.y  = ly;
        rightSkewUni.current.value.x = rx;
        rightSkewUni.current.value.y = ry;
      };
      groupRef.current.userData._dissolveUni = dissolveUni.current;
      groupRef.current.userData._fadeOpacityUni = fadeOpacityUni.current;
      groupRef.current.userData._startDissolve = (duration = 1.5, onComplete) => {
        dissolveUni.current.value = -0.05;
        fadeOpacityUni.current.value = 1.0;
        const tl = gsap.timeline({ onComplete });
        tl.to(dissolveUni.current, {
          value: 1.5, duration, ease: 'power1.in',
        }, 0);
        /* Fade-out morbido: parte insieme alla dissoluzione */
        tl.to(fadeOpacityUni.current, {
          value: 0, duration: duration * 0.8, ease: 'power2.in',
        }, 0);
        /* Dissolvi anche testi, FrontBackground e figli visivi — stessa durata+easing del fadeOpacity */
        const fp = { v: 1 };
        tl.to(fp, {
          v: 0, duration: duration * 0.8, ease: 'power2.in',
          onUpdate: () => groupRef.current?.userData?._fadeAll?.(fp.v),
        }, 0);
        return tl;
      };
      /* Sfuma opacità di tutti i materiali figli (testi, icone, decorazioni) */
      groupRef.current.userData._fadeAll = (opacity) => {
        const g = groupRef.current;
        if (!g) return;
        g.traverse((child) => {
          if (child.material && child !== bodyMeshRef.current && child !== borderMeshRef.current) {
            child.material.transparent = true;
            child.material.opacity = opacity;
          }
        });
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Sincronizza le uniform quando le prop skew cambiano (governate da CONFIG_3D) */
  useEffect(() => {
    topSkewUni.current.value.x    = topSkew[0];
    topSkewUni.current.value.y    = topSkew[1];
    bottomSkewUni.current.value.x = bottomSkew[0];
    bottomSkewUni.current.value.y = bottomSkew[1];
    leftSkewUni.current.value.x   = leftSkew[0];
    leftSkewUni.current.value.y   = leftSkew[1];
    rightSkewUni.current.value.x  = rightSkew[0];
    rightSkewUni.current.value.y  = rightSkew[1];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topSkew[0], topSkew[1], bottomSkew[0], bottomSkew[1], leftSkew[0], leftSkew[1], rightSkew[0], rightSkew[1]]);

  const isKnight = type === 'knight' && !faceDown;
  const isEquip  = (type === 'arma' || type === 'scudo') && !faceDown;
  const isItem   = (type === 'oggetto' || type === 'terreno') && !faceDown;
  const isDeck   = type === 'deck';
  const isBack   = faceDown || type === 'back' || type === 'deck';

  /* Stato di riposo per il ripristino al hover */
  const restState = useMemo(() => {
    const sc = Array.isArray(scale) ? scale[0] : (typeof scale === 'number' ? scale : 1);
    return {
      restY: position[1],
      restZ: position[2],
      restRotX: rotation[0],
      restRotZ: rotation[2],
      targetScale: sc,
      hoverLift,
    };
  }, [position[1], position[2], rotation[0], rotation[2], scale, hoverLift]);

  const handleOver = useCallback((e) => {
    if (!hoverable || !groupRef.current || isHovered.current) return;
    if (groupRef.current.userData?.isPlaying) return;
    e.stopPropagation();
    isHovered.current = true;
    document.body.style.cursor = 'pointer';
    groupRef.current.renderOrder = 100;
    animateHoverIn(groupRef.current, restState);
  }, [hoverable, restState]);

  const handleOut = useCallback(() => {
    if (!hoverable || !groupRef.current || !isHovered.current) return;
    if (groupRef.current.userData?.isPlaying) return;
    isHovered.current = false;
    document.body.style.cursor = 'default';
    groupRef.current.renderOrder = renderOrder;
    animateHoverOut(groupRef.current, restState);
  }, [hoverable, renderOrder, restState]);

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={scale}
      renderOrder={renderOrder}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* ── Card body (real 3D box) ── */}
      <mesh ref={bodyMeshRef}>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color={isBack ? '#7a5c1e' : faceColor} roughness={0.7} metalness={0.1} transparent />
      </mesh>

      {/* ── Border frame ── */}
      <mesh ref={borderMeshRef} position={[0, 0, -D * 0.3]}>
        <boxGeometry args={[W + 0.04, H + 0.04, D * 0.6]} />
        <meshStandardMaterial color={borderColor} roughness={0.6} metalness={0.15} transparent />
      </mesh>

      {/* ── Fronte cornice — texture fronte_carta.png (PNG con centro trasparente) ── */}
      {!isBack && (
        <>
          {/* Fondo scuro con bordi arrotondati — meshBasicMaterial: nessuna influenza luci */}
          <mesh position={[0, 0, D / 2 + 0.0014]}>
            <shapeGeometry args={[frontBgShape]} />
            <meshBasicMaterial color={faceColor} depthWrite toneMapped={false} />
          </mesh>
          {/* Cornice fronte — meshBasicMaterial: texture 1:1 senza filter luci */}
          <mesh position={[0, 0, D / 2 + 0.003]}>
            <planeGeometry args={[W, H]} />
            <meshBasicMaterial map={fronteTex} transparent alphaTest={0.05} toneMapped={false} />
          </mesh>
        </>
      )}

      {/* ── Face-up content ── */}
      {!isBack && (
        <>
          {/* Nome carta — centrato sulla mesh, testo con a-capo automatico */}
          <Text position={[0, H * 0.28, D / 2 + 0.006]} fontSize={0.048} maxWidth={W - 0.1}
                color="#f0e0b0" anchorX="center" anchorY="middle" textAlign="center"
                overflowWrap="break-word" lineHeight={1.2} fontWeight={700}>
            {name}
          </Text>

          {/* Etichette metà inferiore — spostate da bottomSkew */}
          <group position={[bottomSkew[0], bottomSkew[1], 0]}>
            {isKnight && (
              <>
                <Text position={[-0.2, -H * 0.35, D / 2 + 0.009]} fontSize={0.072} color="#ff4444" anchorX="center" anchorY="middle" outlineWidth={0.007} outlineColor="#880000" fontWeight={700}>{`${atk ?? 0}`}</Text>
                <Text position={[0,   -H * 0.35, D / 2 + 0.009]} fontSize={0.072} color="#66ff66" anchorX="center" anchorY="middle" outlineWidth={0.007} outlineColor="#006600" fontWeight={700}>{`${def ?? 0}`}</Text>
                <Text position={[0.2, -H * 0.35, D / 2 + 0.009]} fontSize={0.072} color="#ffd700" anchorX="center" anchorY="middle" outlineWidth={0.005} outlineColor="#885500" fontWeight={700}>{`${pa ?? 0}`}</Text>
                <Text position={[-0.2, -H * 0.435, D / 2 + 0.006]} fontSize={0.028} color="#aaaaaa" anchorX="center">ATK</Text>
                <Text position={[0,   -H * 0.435, D / 2 + 0.006]} fontSize={0.028} color="#aaaaaa" anchorX="center">DEF</Text>
                <Text position={[0.2, -H * 0.435, D / 2 + 0.006]} fontSize={0.028} color="#aaaaaa" anchorX="center">PA</Text>
              </>
            )}

            {isEquip && bonus != null && (
              <>
                <Text position={[cu != null ? -0.14 : 0, -H * 0.35, D / 2 + 0.009]} fontSize={0.072}
                      color={type === 'arma' ? '#ff4444' : '#66ff66'} anchorX="center" anchorY="middle"
                      outlineWidth={0.007} outlineColor={type === 'arma' ? '#880000' : '#006600'} fontWeight={700}>
                  {`+${bonus}`}
                </Text>
                {cu != null && (
                  <Text position={[0.14, -H * 0.35, D / 2 + 0.009]} fontSize={0.072}
                        color="#ffd700" anchorX="center" anchorY="middle"
                        outlineWidth={0.005} outlineColor="#885500" fontWeight={700}>
                    {`${cu}◆`}
                  </Text>
                )}
              </>
            )}

            {/* Descrizione testuale per oggetti e terreni */}
            {isItem && desc && (
              <Text position={[0, -H * 0.18, D / 2 + 0.006]} fontSize={0.052} maxWidth={W - 0.22}
                    color="#ffffff" anchorX="center" anchorY="top" overflowWrap="break-word"
                    textAlign="center" outlineWidth={0.003} outlineColor="#000000">
                {desc}
              </Text>
            )}

            {/* Costo CU — centrato, grande e in grassetto per oggetti/terreni */}
            {isItem && cu != null && (
              <Text position={[0, -H * 0.43, D / 2 + 0.009]} fontSize={0.065}
                    color="#ffd700" anchorX="center" anchorY="middle"
                    outlineWidth={0.005} outlineColor="#885500" fontWeight={700}>
                {`${cu}◆`}
              </Text>
            )}
          </group>


        </>
      )}

      {/* ── Dorso carta — texture dorso_carta.png ── */}
      {isBack && (
        <mesh position={[0, 0, D / 2 + 0.001]}>
          <planeGeometry args={[W, H]} />
          <meshBasicMaterial map={dorsoTex} toneMapped={false} />
        </mesh>
      )}


    </group>
  );
}

