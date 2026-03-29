/**
 * vfxConstants.js — Costanti condivise tra il Game Store e i componenti VFX.
 *
 * Mappa terreno → tipo ambiente, mappa item → colore particelle,
 * tempi di default per animazioni VFX.
 */


/* ═══════ Terreno → Tipo Effetto Ambiente ═══════ */
export const TERRAIN_ENV_MAP = {
  terremoto: 'QUAKE',
  pioggia:   'RAIN',
  catene:    'CHAINS',
  sonno:     'SLEEP',
  riflesso:  'MIRROR',
};


/* ═══════ Item → Colori Particelle per Esplosione ═══════ */
export const ITEM_PARTICLE_COLORS = {
  ampolla:    { primary: '#00ddff', secondary: '#0088ff', emissive: '#006699' },
  sidro:      { primary: '#ffaa00', secondary: '#ff6600', emissive: '#994400' },
  sabbia:     { primary: '#ffd700', secondary: '#cc9900', emissive: '#997700' },
  afferra:    { primary: '#ff6600', secondary: '#ff3300', emissive: '#993300' },
  veleno:     { primary: '#00ff44', secondary: '#008822', emissive: '#005511' },
  lacrima:    { primary: '#ffffff', secondary: '#ccddff', emissive: '#6688aa' },
  sangue:     { primary: '#ff0000', secondary: '#880000', emissive: '#550000' },
  fortuna:    { primary: '#ffd700', secondary: '#ffee88', emissive: '#aa8800' },
  sacrificio: { primary: '#ffffff', secondary: '#ff4400', emissive: '#ff2200' },
  sottrai:    { primary: '#9b59b6', secondary: '#6c3483', emissive: '#4a2360' },
};


/* ═══════ Item → Bersaglio (self o enemy) ═══════ */
export const ITEM_TARGET_MAP = {
  ampolla:    'self',
  sidro:      'self',
  sabbia:     'enemy',
  afferra:    'enemy',
  veleno:     'self',
  lacrima:    'self',
  sangue:     'enemy',
  fortuna:    'self',
  sacrificio: 'self',
  sottrai:    'enemy',
};


/* ═══════ Tipi Evento VFX ═══════ */
export const VFX_EVENTS = {
  TERRAIN_ACTIVATED:    'TERRAIN_ACTIVATED',
  TERRAIN_EXPIRED:      'TERRAIN_EXPIRED',
  SPELL_CAST:           'SPELL_CAST',
  BUFF_APPLIED:         'BUFF_APPLIED',
  CLONE_INITIATED:      'CLONE_INITIATED',
  SACRIFICE_TRIGGERED:  'SACRIFICE_TRIGGERED',
};


/* ═══════ Tempi Animazione VFX (secondi) ═══════ */
export const VFX_TIMING = {
  /* Terreno fluttuante */
  TERRAIN_FLY_DUR:    0.8,
  TERRAIN_FLOAT_AMP:  0.08,
  TERRAIN_FLOAT_DUR:  2.5,

  /* Proiettile spell */
  SPELL_RISE_DUR:     0.35,
  SPELL_STALL_DUR:    0.25,
  SPELL_SMASH_DUR:    0.20,
  SPELL_EXPLODE_DUR:  0.60,
  SPELL_PARTICLE_CNT: 40,

  /* Ologrammi buff */
  HOLO_SPIN_SPEED:    1.2,     // rad/s
  HOLO_FLOAT_AMP:     0.08,
  HOLO_FLOAT_SPEED:   1.5,

  /* Riflesso fumo (totale ~10s) */
  SMOKE_BUILDUP_DUR:  2.5,
  SMOKE_HOLD_DUR:     4.5,
  SMOKE_FADE_DUR:     3.0,
  LIGHTNING_INTERVAL: 150,     // ms tra flash

  /* Sacrificio */
  SACRIFICE_SHATTER_DUR:  0.6,
  SACRIFICE_GLOW_DUR:     1.5,
  SACRIFICE_EDGE_DUR:     3.0,
};
