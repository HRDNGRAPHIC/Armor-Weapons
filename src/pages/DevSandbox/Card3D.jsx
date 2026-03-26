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
import { Text } from '@react-three/drei';
import { gsap } from 'gsap';

/* ═══════ Geometria Carta ═══════ */
const W = 0.7;
const H = 1.0;

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
              vec2 cardUV = vec2(vLocalPos.x / 0.7 + 0.5, vLocalPos.y / 1.0 + 0.5);
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
        /* Dissolvi anche testi e figli visivi */
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

  const faceColor   = useMemo(() => TYPE_COLORS[type] || '#111', [type]);
  const borderColor = useMemo(() => BORDER_COLORS[type] || '#444', [type]);
  const isKnight = type === 'knight' && !faceDown;
  const isEquip  = (type === 'arma' || type === 'scudo') && !faceDown;
  const isItem   = (type === 'oggetto' || type === 'terreno') && !faceDown;
  const isDeck   = type === 'deck';
  const isBack   = faceDown || type === 'back';

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
      <mesh ref={bodyMeshRef} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color={isBack ? '#333333' : faceColor} roughness={0.7} metalness={0.1} transparent />
      </mesh>

      {/* ── Border frame ── */}
      <mesh ref={borderMeshRef} position={[0, 0, -D * 0.3]}>
        <boxGeometry args={[W + 0.04, H + 0.04, D * 0.6]} />
        <meshStandardMaterial color={borderColor} roughness={0.6} metalness={0.15} transparent />
      </mesh>

      {/* ── Face-up content ── */}
      {!isBack && (
        <>
          {/* Etichette metà superiore — spostate da topSkew per seguire la deformazione della mesh */}
          <group position={[topSkew[0], topSkew[1], 0]}>
            <Text position={[0, H * 0.38, D / 2 + 0.002]} fontSize={0.055} maxWidth={W - 0.1}
                  color="#e2d1a3" anchorX="center" anchorY="middle" overflowWrap="break-word">
              {name}
            </Text>
          </group>

          {/* Etichette metà inferiore — spostate da bottomSkew */}
          <group position={[bottomSkew[0], bottomSkew[1], 0]}>
            {isKnight && (
              <>
                <Text position={[-0.2, -H * 0.35, D / 2 + 0.002]} fontSize={isAtkBuffed ? 0.07 : 0.06} color={isAtkBuffed ? '#ff4444' : '#ff0000'} anchorX="center" outlineWidth={isAtkBuffed ? 0.006 : 0} outlineColor="#ff0000">{`${atk ?? 0}`}</Text>
                <Text position={[0, -H * 0.35, D / 2 + 0.002]} fontSize={isDefBuffed ? 0.07 : 0.06} color={isDefBuffed ? '#66ff66' : '#4dff4d'} anchorX="center" outlineWidth={isDefBuffed ? 0.006 : 0} outlineColor="#4dff4d">{`${def ?? 0}`}</Text>
                <Text position={[0.2, -H * 0.35, D / 2 + 0.002]} fontSize={0.06} color="#ffd700" anchorX="center">{`${pa ?? 0}`}</Text>
                <Text position={[-0.2, -H * 0.43, D / 2 + 0.002]} fontSize={0.03} color="#888" anchorX="center">ATK</Text>
                <Text position={[0, -H * 0.43, D / 2 + 0.002]} fontSize={0.03} color="#888" anchorX="center">DEF</Text>
                <Text position={[0.2, -H * 0.43, D / 2 + 0.002]} fontSize={0.03} color="#888" anchorX="center">PA</Text>
              </>
            )}

            {isEquip && bonus != null && (
              <Text position={[0, -H * 0.35, D / 2 + 0.002]} fontSize={0.07}
                    color={type === 'arma' ? '#ff0000' : '#4dff4d'} anchorX="center">
                {`+${bonus}`}
              </Text>
            )}

            {/* Descrizione testuale per oggetti e terreni */}
            {isItem && desc && (
              <Text position={[0, -H * 0.28, D / 2 + 0.002]} fontSize={0.035} maxWidth={W - 0.12}
                    color="#ccc" anchorX="center" anchorY="top" overflowWrap="break-word"
                    textAlign="center">
                {desc}
              </Text>
            )}

            {/* Costo CU — mostrato in basso a destra per tutti gli equipaggiamenti */}
            {(isEquip || isItem) && cu != null && (
              <Text position={[W * 0.35, -H * 0.43, D / 2 + 0.002]} fontSize={0.04}
                    color="#ffd700" anchorX="right" anchorY="middle">
                {`CU:${cu}`}
              </Text>
            )}
          </group>

          {/* Icona centrale — nessun offset skew (confine Y=0) */}
          <Text position={[0, 0, D / 2 + 0.002]} fontSize={0.18} anchorX="center" anchorY="middle" color="#444">
            {TYPE_ICONS[type] || ''}
          </Text>
        </>
      )}

      {/* ── Dorso carta — solo colore piatto + logo picche ── */}
      {isBack && (
        <>
          <mesh position={[0, 0, D / 2 + 0.001]}>
            <planeGeometry args={[W - 0.08, H - 0.08]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
          <Text position={[0, 0, D / 2 + 0.003]} fontSize={0.15} color="#8a0303" anchorX="center" anchorY="middle">
            {'\u2660'}
          </Text>
        </>
      )}

      {isDeck && (
        <group position={[bottomSkew[0], bottomSkew[1], 0]}>
          <Text position={[0, -H * 0.3, D / 2 + 0.002]} fontSize={0.06} color="#ffd700" anchorX="center">
            {name}
          </Text>
        </group>
      )}
    </group>
  );
}
