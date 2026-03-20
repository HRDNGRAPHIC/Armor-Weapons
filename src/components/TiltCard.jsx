/*
 * TiltCard.jsx — Aceternity-inspired 3D perspective tilt on hover.
 * Uses framer-motion for smooth rotateX/rotateY based on mouse position.
 */
import { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

export default function TiltCard({ children, className = '', style = {}, onClick, layoutId }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });

  const handleMouseMove = useCallback((e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // Max tilt: 15 degrees
    const rotateX = ((y - centerY) / centerY) * -15;
    const rotateY = ((x - centerX) / centerX) * 15;
    setTilt({ rotateX, rotateY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ rotateX: 0, rotateY: 0 });
  }, []);

  return (
    <motion.div
      ref={ref}
      layoutId={layoutId}
      className={className}
      style={{ ...style, perspective: 800, transformStyle: 'preserve-3d' }}
      animate={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
    >
      {children}
    </motion.div>
  );
}
