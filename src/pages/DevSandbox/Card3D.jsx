/**
 * Card3D.jsx — 3D card mesh with GSAP-driven animations.
 *
 * Real 3D box with visible thickness. GSAP handles:
 *   - Hover: lift + straighten + scale
 *   - Play:  float → swoosh → bounce+wobble onto table
 *
 * All animations use refs — no React state transitions, no spring libs.
 */
import { useMemo, useRef, useCallback, useImperativeHandle } from 'react';
import { Text } from '@react-three/drei';
import { gsap } from 'gsap';

/* ═══════ Card Geometry ═══════ */
const W = 0.7;
const H = 1.0;
const D = 0.04;   // real 3D thickness

const TYPE_COLORS = {
  knight: '#1a0000', arma: '#330000', scudo: '#002200',
  oggetto: '#332200', terreno: '#1a0033', deck: '#111', back: '#111',
};
const BORDER_COLORS = {
  knight: '#8a0303', arma: '#ff0000', scudo: '#4dff4d',
  oggetto: '#ffd700', terreno: '#9b59b6', deck: '#444', back: '#444',
};
const TYPE_ICONS = {
  knight: '\u2660', arma: '\u2694', scudo: '\u2694',
  oggetto: '\u2728', terreno: '\u25C8', deck: '\u2660',
};

/* ═══════ GSAP Animation Helpers (exported for use by parent) ═══════ */

/**
 * Hover IN: lift card on Y axis ONLY. No rotation change. No perspective warp.
 * The card stays flat facing the camera — screen-space hover.
 */
export function animateHoverIn(group, { restY, targetScale }) {
  gsap.killTweensOf(group.position);
  gsap.killTweensOf(group.scale);
  gsap.to(group.position, { y: restY + 0.5, duration: 0.18, ease: 'power2.out', overwrite: true });
  gsap.to(group.scale, { x: targetScale * 1.12, y: targetScale * 1.12, z: targetScale * 1.12, duration: 0.18, ease: 'power2.out', overwrite: true });
}

/**
 * Hover OUT: return to resting Y and scale. Rotation untouched.
 */
export function animateHoverOut(group, { restY, restRotX, restRotZ, targetScale }) {
  gsap.to(group.position, { y: restY, duration: 0.22, ease: 'power2.inOut', overwrite: true });
  gsap.to(group.scale, { x: targetScale, y: targetScale, z: targetScale, duration: 0.22, ease: 'power2.inOut', overwrite: true });
}

/**
 * Play animation: monolithic GSAP timeline.
 *   1. Kill all residual tweens (hover etc.)
 *   2. Float to screen centre
 *   3. Dramatic pause
 *   4. Scale down + rotate to align with board tilt
 *   5. Bounce landing at final Y
 *
 * @param {THREE.Group} group - the card group ref
 * @param {Object} target - { x, y, z, rotX?, rotY?, rotZ? } destination + rotation
 * @param {Function} onComplete - callback when animation finishes
 */
export function animatePlayCard(group, target, onComplete) {
  /* Kill any residual hover/other animations */
  gsap.killTweensOf(group.position);
  gsap.killTweensOf(group.rotation);
  gsap.killTweensOf(group.scale);

  /* Mark as playing — disables hover handlers */
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

  /* Phase 1 — Float to screen centre */
  tl.to(group.position, { x: 0, y: 2.5, z: 0, duration: 0.35, ease: 'power2.out' });
  tl.to(group.rotation, { x: -Math.PI / 2, y: 0, z: 0, duration: 0.35, ease: 'power2.out' }, '<');
  tl.to(group.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 0.35, ease: 'power2.out' }, '<');

  /* Dramatic float pause */
  tl.to(group.position, { y: 2.6, duration: 0.25, ease: 'sine.inOut', yoyo: true, repeat: 1 });

  /* Phase 2 — Swoosh down: scale down + rotate to board tilt */
  tl.to(group.position, { x: target.x, y: target.y + 0.8, z: target.z, duration: 0.25, ease: 'power3.in' });
  tl.to(group.rotation, { x: finalRotX, y: finalRotY, z: finalRotZ, duration: 0.25, ease: 'power2.inOut' }, '<');
  tl.to(group.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.25, ease: 'power2.in' }, '<');

  /* Phase 3 — Bounce landing at final Y */
  tl.to(group.position, { y: target.y, duration: 0.4, ease: 'bounce.out' });

  /* Wobble on landing */
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
  faceDown = false,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  hoverable = false,
  hoverLift = 0.8,
  renderOrder = 0,
  onClick,
}) {
  const groupRef  = useRef();
  const isHovered = useRef(false);

  /* Expose internal group ref to parent (React 19 ref-as-prop) */
  useImperativeHandle(ref, () => groupRef.current);

  const faceColor   = useMemo(() => TYPE_COLORS[type] || '#111', [type]);
  const borderColor = useMemo(() => BORDER_COLORS[type] || '#444', [type]);
  const isKnight = type === 'knight' && !faceDown;
  const isEquip  = (type === 'arma' || type === 'scudo') && !faceDown;
  const isDeck   = type === 'deck';
  const isBack   = faceDown || type === 'back';

  /* Rest state for hover revert */
  const restState = useMemo(() => ({
    restY: position[1],
    restRotX: rotation[0],
    restRotZ: rotation[2],
    targetScale: scale,
  }), [position[1], rotation[0], rotation[2], scale]);

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
    >
      {/* ── Card body (real 3D box) ── */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color={isBack ? '#0a0a0a' : faceColor} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* ── Border frame ── */}
      <mesh position={[0, 0, -D * 0.3]}>
        <boxGeometry args={[W + 0.04, H + 0.04, D * 0.6]} />
        <meshStandardMaterial color={borderColor} roughness={0.6} metalness={0.15} />
      </mesh>

      {/* ── Face-up content ── */}
      {!isBack && (
        <>
          <Text position={[0, H * 0.38, D / 2 + 0.002]} fontSize={0.055} maxWidth={W - 0.1}
                color="#e2d1a3" anchorX="center" anchorY="middle" overflowWrap="break-word">
            {name}
          </Text>

          {isKnight && (
            <>
              <Text position={[-0.2, -H * 0.35, D / 2 + 0.002]} fontSize={0.06} color="#ff0000" anchorX="center">{`${atk ?? 0}`}</Text>
              <Text position={[0, -H * 0.35, D / 2 + 0.002]} fontSize={0.06} color="#4dff4d" anchorX="center">{`${def ?? 0}`}</Text>
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

          <Text position={[0, 0, D / 2 + 0.002]} fontSize={0.18} anchorX="center" anchorY="middle" color="#444">
            {TYPE_ICONS[type] || ''}
          </Text>
        </>
      )}

      {/* ── Card back ── */}
      {isBack && (
        <>
          <mesh position={[0, 0, D / 2 + 0.001]}>
            <planeGeometry args={[W - 0.08, H - 0.08]} />
            <meshStandardMaterial color="#1a0000" />
          </mesh>
          <Text position={[0, 0, D / 2 + 0.003]} fontSize={0.15} color="#8a0303" anchorX="center" anchorY="middle">
            {'\u2660'}
          </Text>
        </>
      )}

      {isDeck && (
        <Text position={[0, -H * 0.3, D / 2 + 0.002]} fontSize={0.06} color="#ffd700" anchorX="center">
          {name}
        </Text>
      )}
    </group>
  );
}
