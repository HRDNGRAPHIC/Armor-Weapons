/*
 * cardCatalog.js — Expanded 60+ card catalog with Dark Fantasy theme.
 * Used by Collection, DeckBuilder, PackOpening.
 * Each card has: catalogId, name, type, rarity, stats, desc, art.
 */
import { getPixelSVG, pixelArtsKnights, pixelArtsWeapons, pixelArtsShields, pixelArtsItems, pixelArtsTerrains } from './gameData';

/* ── Rarities ─────────────────────────────────────── */
export const RARITIES = [
  { id: 'comune',      label: 'Comune',      color: '#8a8a9a', weight: 55 },
  { id: 'rara',        label: 'Rara',        color: '#2a5da8', weight: 25 },
  { id: 'epica',       label: 'Epica',       color: '#8b5fbf', weight: 14 },
  { id: 'leggendaria', label: 'Leggendaria', color: '#c9a84c', weight: 6  },
];

export function rollRarity() {
  const r = Math.random() * 100;
  if (r < 6)  return RARITIES[3]; // leggendaria
  if (r < 20) return RARITIES[2]; // epica
  if (r < 45) return RARITIES[1]; // rara
  return RARITIES[0];             // comune
}

/* ── Knights (15) ─────────────────────────────────── */
const KNIGHTS = [
  { name: 'Gothmog il Flagello',      rarity: 'comune',      baseAtk: 4,  baseDef: 6,  basePa: 2 },
  { name: 'Kull il Martire',          rarity: 'comune',      baseAtk: 5,  baseDef: 5,  basePa: 2 },
  { name: 'Vanguard Oscuro',          rarity: 'comune',      baseAtk: 3,  baseDef: 8,  basePa: 3 },
  { name: 'Draken il Rosso',          rarity: 'comune',      baseAtk: 6,  baseDef: 4,  basePa: 2 },
  { name: 'Tark il Difensore',        rarity: 'rara',        baseAtk: 4,  baseDef: 9,  basePa: 3 },
  { name: 'Gorluk Spezzaossa',        rarity: 'rara',        baseAtk: 7,  baseDef: 5,  basePa: 2 },
  { name: 'Azrael il Silente',        rarity: 'rara',        baseAtk: 6,  baseDef: 7,  basePa: 3 },
  { name: 'Morbus Plagamorte',        rarity: 'rara',        baseAtk: 5,  baseDef: 8,  basePa: 4 },
  { name: 'Vornik il Brutale',        rarity: 'epica',       baseAtk: 8,  baseDef: 7,  basePa: 3 },
  { name: 'Zarak Cuponero',           rarity: 'epica',       baseAtk: 7,  baseDef: 9,  basePa: 3 },
  { name: 'Ragnar Lugubre',           rarity: 'epica',       baseAtk: 9,  baseDef: 6,  basePa: 4 },
  { name: 'Kaelen il Dannato',        rarity: 'epica',       baseAtk: 8,  baseDef: 8,  basePa: 3 },
  { name: 'Sardeth il Re Nero',       rarity: 'leggendaria', baseAtk: 10, baseDef: 10, basePa: 4 },
  { name: 'Velkan il Distruttore',    rarity: 'leggendaria', baseAtk: 12, baseDef: 7,  basePa: 4 },
  { name: 'Mortharion Spettrale',     rarity: 'leggendaria', baseAtk: 9,  baseDef: 12, basePa: 4 },
];

/* ── Weapons (12) ─────────────────────────────────── */
const WEAPONS = [
  { name: 'Pugnale Arrugginito',      rarity: 'comune',      atkBonus: 1 },
  { name: 'Spada di Ferro Nero',      rarity: 'comune',      atkBonus: 2 },
  { name: 'Mazza Chiodata',           rarity: 'comune',      atkBonus: 2 },
  { name: 'Ascia del Boia',           rarity: 'rara',        atkBonus: 3 },
  { name: 'Lama Sanguinaria',         rarity: 'rara',        atkBonus: 3 },
  { name: 'Spadone del Tormento',      rarity: 'rara',       atkBonus: 4 },
  { name: 'Flagello di Catene',       rarity: 'epica',       atkBonus: 4 },
  { name: 'Falce Animica',            rarity: 'epica',       atkBonus: 5 },
  { name: 'Martello del Crepuscolo',  rarity: 'epica',       atkBonus: 5 },
  { name: 'Lama Oscura del Void',     rarity: 'leggendaria', atkBonus: 6 },
  { name: 'Mazza Devastante Reale',   rarity: 'leggendaria', atkBonus: 7 },
  { name: 'Spadone di Sangue Antico', rarity: 'leggendaria', atkBonus: 8 },
];

/* ── Shields (10) ─────────────────────────────────── */
const SHIELDS = [
  { name: 'Scudo di Legno Marcio',    rarity: 'comune',      defBonus: 1 },
  { name: 'Scudo di Ferro',           rarity: 'comune',      defBonus: 2 },
  { name: 'Baluardo di Pietra',       rarity: 'comune',      defBonus: 2 },
  { name: 'Scudo del Drago',          rarity: 'rara',        defBonus: 3 },
  { name: 'Egida Oscura',             rarity: 'rara',        defBonus: 4 },
  { name: 'Scudo Spinato',            rarity: 'rara',        defBonus: 3 },
  { name: 'Barriera dell\'Abisso',    rarity: 'epica',       defBonus: 5 },
  { name: 'Scudo del Dannato',        rarity: 'epica',       defBonus: 5 },
  { name: 'Egida del Re Morto',       rarity: 'leggendaria', defBonus: 7 },
  { name: 'Scudo Eterno',             rarity: 'leggendaria', defBonus: 8 },
];

/* ── Items (13) ───────────────────────────────────── */
const ITEMS = [
  { name: 'Ampolla di Cura',          rarity: 'comune',      itemId: 'ampolla',    desc: '+5 DEF',                        cu: 1 },
  { name: 'Sidro Guerriero',          rarity: 'comune',      itemId: 'sidro',      desc: '+3 PA',                         cu: 0 },
  { name: 'Sabbia negli Occhi',       rarity: 'rara',        itemId: 'sabbia',     desc: 'Acceca nemico (2T), 1/2 ATK',   cu: 2 },
  { name: 'Afferra Arma',             rarity: 'rara',        itemId: 'afferra',    desc: 'Togli ATK bonus nemico',        cu: 1 },
  { name: 'Veleno Berserker',         rarity: 'rara',        itemId: 'veleno',     desc: '+1 ATK/-1 DEF (3T)',            cu: 1 },
  { name: 'Lacrima di Angelo',        rarity: 'epica',       itemId: 'lacrima',    desc: '+1 DEF/-1 ATK (3T)',            cu: 1 },
  { name: 'Sangue al Nemico',         rarity: 'epica',       itemId: 'sangue',     desc: '-5 DEF, blocca DEF nemico',     cu: 1 },
  { name: 'Fortuna Liquida',          rarity: 'comune',      itemId: 'fortuna',    desc: 'Peschi 1 carta extra',          cu: 1 },
  { name: 'Sacrificio',               rarity: 'epica',       itemId: 'sacrificio', desc: 'ATK/DEF 15, PA 0, no pesca(3T)',cu: 0 },
  { name: 'Sottrai',                  rarity: 'leggendaria', itemId: 'sottrai',    desc: 'Distruggi carta nemico, no atk 1T', cu: 2 },
  { name: 'Fiala di Nebbia',          rarity: 'comune',      itemId: 'fortuna',    desc: 'Peschi 1 carta extra',          cu: 1 },
  { name: 'Polvere Oscura',           rarity: 'rara',        itemId: 'veleno',     desc: '+1 ATK/-1 DEF (3T)',            cu: 1 },
  { name: 'Essenza della Tomba',      rarity: 'epica',       itemId: 'lacrima',    desc: '+1 DEF/-1 ATK (3T)',            cu: 1 },
];

/* ── Terrains (10) ────────────────────────────────── */
const TERRAINS = [
  { name: 'Terremoto',                rarity: 'rara',        terrainId: 'terremoto', desc: 'Dimezza ATK e DEF (3T)' },
  { name: 'Pioggia Divina',           rarity: 'comune',      terrainId: 'pioggia',   desc: '+2 DEF curati ogni turno (3T)' },
  { name: 'Catene Infernali',         rarity: 'epica',       terrainId: 'catene',    desc: 'Annulla potenziamenti (3T)' },
  { name: 'Sonno Profondo',           rarity: 'rara',        terrainId: 'sonno',     desc: 'Battaglia Lenta, -5 ATK (3T)' },
  { name: 'Riflesso Oscuro',          rarity: 'leggendaria', terrainId: 'riflesso',  desc: 'Nemico clone tuo cavaliere (3T)' },
  { name: 'Nebbia dei Morti',         rarity: 'comune',      terrainId: 'pioggia',   desc: '+2 DEF curati ogni turno (3T)' },
  { name: 'Frattura Tellurica',       rarity: 'rara',        terrainId: 'terremoto', desc: 'Dimezza ATK e DEF (3T)' },
  { name: 'Ghiaccio Perenne',         rarity: 'epica',       terrainId: 'sonno',     desc: 'Battaglia Lenta, -5 ATK (3T)' },
  { name: 'Fossa dell\'Oblio',        rarity: 'epica',       terrainId: 'catene',    desc: 'Annulla potenziamenti (3T)' },
  { name: 'Specchio dell\'Anima',     rarity: 'leggendaria', terrainId: 'riflesso',  desc: 'Nemico clone tuo cavaliere (3T)' },
];

/* ── Build catalog ────────────────────────────────── */
function findRarity(id) { return RARITIES.find(r => r.id === id); }

const catalog = [];
let idx = 0;

KNIGHTS.forEach(k => {
  catalog.push({
    catalogId: `K${String(idx++).padStart(3,'0')}`,
    name: k.name, type: 'knight', rarity: findRarity(k.rarity),
    baseAtk: k.baseAtk, baseDef: k.baseDef, basePa: k.basePa,
    art: getPixelSVG(pixelArtsKnights[0]),
  });
});

WEAPONS.forEach(w => {
  catalog.push({
    catalogId: `W${String(idx++).padStart(3,'0')}`,
    name: w.name, type: 'weapon', rarity: findRarity(w.rarity),
    atkBonus: w.atkBonus,
    art: getPixelSVG(pixelArtsWeapons[0]),
  });
});

SHIELDS.forEach(s => {
  catalog.push({
    catalogId: `S${String(idx++).padStart(3,'0')}`,
    name: s.name, type: 'shield', rarity: findRarity(s.rarity),
    defBonus: s.defBonus,
    art: getPixelSVG(pixelArtsShields[0]),
  });
});

ITEMS.forEach(it => {
  catalog.push({
    catalogId: `I${String(idx++).padStart(3,'0')}`,
    name: it.name, type: 'item', rarity: findRarity(it.rarity),
    itemId: it.itemId, desc: it.desc, cu: it.cu,
    art: getPixelSVG(pixelArtsItems[0]),
  });
});

TERRAINS.forEach(t => {
  catalog.push({
    catalogId: `T${String(idx++).padStart(3,'0')}`,
    name: t.name, type: 'terrain', rarity: findRarity(t.rarity),
    terrainId: t.terrainId, desc: t.desc,
    art: getPixelSVG(pixelArtsTerrains[0]),
  });
});

export const CARD_CATALOG = catalog; // 60 cards total

/* ── Helpers ──────────────────────────────────────── */
export function getCardById(catalogId) {
  return CARD_CATALOG.find(c => c.catalogId === catalogId) ?? null;
}

export function getCardsByType(type) {
  return CARD_CATALOG.filter(c => c.type === type);
}
