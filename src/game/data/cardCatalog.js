/*
 * cardCatalog.js — Catalogo di oltre 60 carte con tema Dark Fantasy.
 * SORGENTE MASTER: array di gameData.js (knightNames, weaponNames, shieldNames, itemDefs, terrainDefs).
 * Tutti gli ID oggetto/terreno, valori CU e descrizioni provengono da gameData.
 * Usato da Collection, DeckBuilder, PackOpening.
 */
import {
  getPixelSVG,
  knightNames, weaponNames, shieldNames, itemDefs,
  pixelArtsKnights, pixelArtsWeapons, pixelArtsShields, pixelArtsItems, pixelArtsTerrains,
} from './gameData';

/* ── Nomi in Italiano ─────────────────── */
export const TYPE_LABELS_IT = {
  knight: 'Cavalieri',
  weapon: 'Armi',
  shield: 'Scudi',
  item: 'Oggetti',
  terrain: 'Terreni',
};

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

/* ── Cavalieri (15) ─────────────────────────────────── */
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

/* ── Armi (12) — OGNI coppia (atkBonus, cu) è UNICA ── */
const WEAPONS = [
  { name: 'Pugnale Arrugginito',      rarity: 'comune',      atkBonus: 1, cu: 1 },
  { name: 'Spada di Ferro Nero',      rarity: 'comune',      atkBonus: 2, cu: 1 },
  { name: 'Mazza Chiodata',           rarity: 'comune',      atkBonus: 2, cu: 2 },
  { name: 'Ascia del Boia',           rarity: 'rara',        atkBonus: 3, cu: 1 },
  { name: 'Lama Sanguinaria',         rarity: 'rara',        atkBonus: 3, cu: 2 },
  { name: 'Spadone del Tormento',     rarity: 'rara',        atkBonus: 4, cu: 1 },
  { name: 'Flagello di Catene',       rarity: 'epica',       atkBonus: 4, cu: 2 },
  { name: 'Falce Animica',            rarity: 'epica',       atkBonus: 5, cu: 1 },
  { name: 'Martello del Crepuscolo',  rarity: 'epica',       atkBonus: 6, cu: 3 },
  { name: 'Lama Oscura del Void',     rarity: 'leggendaria', atkBonus: 6, cu: 2 },
  { name: 'Mazza Devastante Reale',   rarity: 'leggendaria', atkBonus: 7, cu: 2 },
  { name: 'Spadone di Sangue Antico', rarity: 'leggendaria', atkBonus: 8, cu: 3 },
];

/* ── Scudi (10) — OGNI coppia (defBonus, cu) è UNICA ── */
const SHIELDS = [
  { name: 'Scudo di Legno Marcio',    rarity: 'comune',      defBonus: 1, cu: 1 },
  { name: 'Scudo di Ferro',           rarity: 'comune',      defBonus: 2, cu: 1 },
  { name: 'Baluardo di Pietra',       rarity: 'comune',      defBonus: 3, cu: 2 },
  { name: 'Scudo del Drago',          rarity: 'rara',        defBonus: 3, cu: 1 },
  { name: 'Egida Oscura',             rarity: 'rara',        defBonus: 4, cu: 1 },
  { name: 'Scudo Spinato',            rarity: 'rara',        defBonus: 4, cu: 2 },
  { name: 'Barriera dell\'Abisso',    rarity: 'epica',       defBonus: 5, cu: 2 },
  { name: 'Scudo del Dannato',        rarity: 'epica',       defBonus: 6, cu: 2 },
  { name: 'Egida del Re Morto',       rarity: 'leggendaria', defBonus: 7, cu: 2 },
  { name: 'Scudo Eterno',             rarity: 'leggendaria', defBonus: 8, cu: 3 },
];

/* ── Oggetti (25) — I 10 ID base provengono da gameData.itemDefs ─── */
/* OGNI carta ha una descrizione UNICA — nessuna carta condivide lo stesso testo. */
const _id = (id) => itemDefs.find(d => d.id === id);
const ITEMS = [
  // ── 13 Originali (preserva gli ID del catalogo) ──
  { name: 'Ampolla di Cura',          rarity: 'comune',      itemId: 'ampolla',    desc: '+5 DEF',                                           cu: _id('ampolla').cu },
  { name: 'Sidro Guerriero',          rarity: 'comune',      itemId: 'sidro',      desc: '+3 PA',                                            cu: _id('sidro').cu },
  { name: 'Sabbia negli Occhi',       rarity: 'rara',        itemId: 'sabbia',     desc: 'Acceca nemico (2T), 1/2 ATK',                      cu: _id('sabbia').cu },
  { name: 'Afferra Arma',             rarity: 'rara',        itemId: 'afferra',    desc: 'Togli ATK bonus nemico prec.',                     cu: _id('afferra').cu },
  { name: 'Veleno Berserker',         rarity: 'rara',        itemId: 'veleno',     desc: '+1 ATK/-1 DEF (3T)',                               cu: _id('veleno').cu },
  { name: 'Lacrima di Angelo',        rarity: 'epica',       itemId: 'lacrima',    desc: '+1 DEF/-1 ATK (3T)',                               cu: _id('lacrima').cu },
  { name: 'Sangue al Nemico',         rarity: 'epica',       itemId: 'sangue',     desc: '-5 DEF, blocca DEF nemico',                        cu: _id('sangue').cu },
  { name: 'Fortuna Liquida',          rarity: 'comune',      itemId: 'fortuna',    desc: 'Peschi 1 carta extra',                             cu: _id('fortuna').cu },
  { name: 'Sacrificio',               rarity: 'epica',       itemId: 'sacrificio', desc: 'ATK/DEF 15, PA 0, no pesca (3T)',                  cu: _id('sacrificio').cu },
  { name: 'Sottrai',                  rarity: 'leggendaria', itemId: 'sottrai',    desc: 'Distruggi carta nemico, no atk 1T',                cu: _id('sottrai').cu },
  { name: 'Fiala di Nebbia',          rarity: 'comune',      itemId: 'fortuna',    desc: 'Nebbia mistica: pesca 1 carta aggiuntiva',         cu: _id('fortuna').cu },
  { name: 'Polvere Oscura',           rarity: 'rara',        itemId: 'veleno',     desc: 'Furia tossica: +1 ATK, -1 DEF per 3 turni',       cu: _id('veleno').cu },
  { name: 'Essenza della Tomba',      rarity: 'epica',       itemId: 'lacrima',    desc: 'Protezione spettrale: +1 DEF/-1 ATK (3T)',         cu: _id('lacrima').cu },
  // ── 12 Nuove Varianti — descrizioni uniche ──
  { name: 'Balsamo Infernale',        rarity: 'comune',      itemId: 'ampolla',    desc: 'Cura ferite: +5 alla difesa',                      cu: _id('ampolla').cu },
  { name: 'Nettare degli Dei',        rarity: 'rara',        itemId: 'sidro',      desc: 'Vigore divino: +3 PA questo turno',                cu: _id('sidro').cu },
  { name: 'Cenere Accecante',         rarity: 'epica',       itemId: 'sabbia',     desc: 'Acceca il nemico per 2 turni, dimezza ATK',        cu: _id('sabbia').cu },
  { name: 'Uncino Predatore',         rarity: 'epica',       itemId: 'afferra',    desc: 'Strappa arma: rimuovi ATK bonus nemico',           cu: _id('afferra').cu },
  { name: 'Tossina del Drago',        rarity: 'rara',        itemId: 'veleno',     desc: 'Rabbia draconica: +1 ATK/-1 DEF, durata 3T',      cu: _id('veleno').cu },
  { name: 'Lacrime del Crepuscolo',   rarity: 'rara',        itemId: 'lacrima',    desc: 'Scudo angelico: +1 DEF, -1 ATK per 3T',           cu: _id('lacrima').cu },
  { name: 'Furia Sanguinaria',        rarity: 'leggendaria', itemId: 'sangue',     desc: 'Maledizione: -5 DEF nemico, blocca guarigione',   cu: _id('sangue').cu },
  { name: 'Dado del Destino',         rarity: 'rara',        itemId: 'fortuna',    desc: 'Sorte: ottieni 1 carta extra dal mazzo',           cu: _id('fortuna').cu },
  { name: 'Rito del Martire',         rarity: 'leggendaria', itemId: 'sacrificio', desc: 'Potere supremo: 15 ATK/DEF, 0 PA, no pesca (3T)', cu: _id('sacrificio').cu },
  { name: 'Mano Fantasma',            rarity: 'epica',       itemId: 'sottrai',    desc: 'Ruba e distruggi: elimina carta nemica, salta atk 1T', cu: _id('sottrai').cu },
  { name: 'Elisir della Tempesta',    rarity: 'rara',        itemId: 'ampolla',    desc: 'Rigenerazione: ripristina 5 punti difesa',         cu: _id('ampolla').cu },
  { name: 'Fumo Tossico',             rarity: 'comune',      itemId: 'sabbia',     desc: 'Nube accecante: nemico a metà attacco (2T)',       cu: _id('sabbia').cu },
];

/* ── Terreni (18) — I 5 ID base provengono da gameData.terrainDefs ── */
/* OGNI carta ha una descrizione UNICA — nessuna carta condivide lo stesso testo. */
const TERRAINS = [
  // ── 10 Originali (preserva gli ID del catalogo) ──
  { name: 'Terremoto',                rarity: 'rara',        terrainId: 'terremoto', desc: 'Dimezza ATK e DEF (3T)' },
  { name: 'Pioggia Divina',           rarity: 'comune',      terrainId: 'pioggia',   desc: '+2 DEF curati ogni turno (3T)' },
  { name: 'Catene Infernali',         rarity: 'epica',       terrainId: 'catene',    desc: 'Annulla potenziamenti (3T)' },
  { name: 'Sonno Profondo',           rarity: 'rara',        terrainId: 'sonno',     desc: 'Battaglia Lenta, -5 ATK (3T)' },
  { name: 'Riflesso Oscuro',          rarity: 'leggendaria', terrainId: 'riflesso',  desc: 'Nemico clone tuo cavaliere (3T)' },
  { name: 'Nebbia dei Morti',         rarity: 'comune',      terrainId: 'pioggia',   desc: 'Bruma curativa: +2 DEF ogni turno (3T)' },
  { name: 'Frattura Tellurica',       rarity: 'rara',        terrainId: 'terremoto', desc: 'Scossa: ATK e DEF a metà per 3 turni' },
  { name: 'Ghiaccio Perenne',         rarity: 'epica',       terrainId: 'sonno',     desc: 'Gelo eterno: -5 ATK, battaglia lenta (3T)' },
  { name: 'Fossa dell\'Oblio',        rarity: 'epica',       terrainId: 'catene',    desc: 'Oblio: annulla tutti i potenziamenti (3T)' },
  { name: 'Specchio dell\'Anima',     rarity: 'leggendaria', terrainId: 'riflesso',  desc: 'Specchio: il nemico copia il tuo cavaliere (3T)' },
  // ── 8 Nuove Varianti — descrizioni uniche ──
  { name: 'Valanga Oscura',           rarity: 'epica',       terrainId: 'terremoto', desc: 'Devastazione: dimezza ATK/DEF di tutti (3T)' },
  { name: 'Fonte Sacra',              rarity: 'rara',        terrainId: 'pioggia',   desc: 'Acqua benedetta: rigenera +2 DEF a turno (3T)' },
  { name: 'Prigione di Spine',        rarity: 'rara',        terrainId: 'catene',    desc: 'Spine: blocca potenziamenti per 3 turni' },
  { name: 'Torpore Glaciale',         rarity: 'leggendaria', terrainId: 'sonno',     desc: 'Ibernazione: rallenta e riduce ATK di 5 (3T)' },
  { name: 'Ombra Gemella',            rarity: 'epica',       terrainId: 'riflesso',  desc: 'Doppelgänger: nemico diventa il tuo cavaliere (3T)' },
  { name: 'Sabbie Mobili',            rarity: 'comune',      terrainId: 'terremoto', desc: 'Terreno instabile: ATK e DEF ridotti del 50% (3T)' },
  { name: 'Bruma Guaritrice',         rarity: 'epica',       terrainId: 'pioggia',   desc: 'Vapore sacro: +2 DEF per turno, dura 3 turni' },
  { name: 'Trappola del Ragno',       rarity: 'comune',      terrainId: 'catene',    desc: 'Ragnatela: i potenziamenti sono annullati (3T)' },
];

/* ── Costruzione catalogo (ID retrocompatibili: le carte esistenti mantengono i propri indici) ── */
function findRarity(id) { return RARITIES.find(r => r.id === id); }

const catalog = [];
let idx = 0;

// K000-K014 (Cavalieri)
KNIGHTS.forEach(k => {
  catalog.push({
    catalogId: `K${String(idx++).padStart(3,'0')}`,
    name: k.name, type: 'knight', rarity: findRarity(k.rarity),
    baseAtk: k.baseAtk, baseDef: k.baseDef, basePa: k.basePa,
    art: getPixelSVG(pixelArtsKnights[0]),
  });
});

// W015-W026 (Armi)
WEAPONS.forEach(w => {
  catalog.push({
    catalogId: `W${String(idx++).padStart(3,'0')}`,
    name: w.name, type: 'weapon', rarity: findRarity(w.rarity),
    atkBonus: w.atkBonus, cu: w.cu,
    art: getPixelSVG(pixelArtsWeapons[0]),
  });
});

// S027-S036 (Scudi)
SHIELDS.forEach(s => {
  catalog.push({
    catalogId: `S${String(idx++).padStart(3,'0')}`,
    name: s.name, type: 'shield', rarity: findRarity(s.rarity),
    defBonus: s.defBonus, cu: s.cu,
    art: getPixelSVG(pixelArtsShields[0]),
  });
});

// I037-I049 (13 oggetti originali)
ITEMS.slice(0, 13).forEach(it => {
  catalog.push({
    catalogId: `I${String(idx++).padStart(3,'0')}`,
    name: it.name, type: 'item', rarity: findRarity(it.rarity),
    itemId: it.itemId, desc: it.desc, cu: it.cu,
    art: getPixelSVG(pixelArtsItems[0]),
  });
});

// T050-T059 (10 terreni originali)
TERRAINS.slice(0, 10).forEach(t => {
  catalog.push({
    catalogId: `T${String(idx++).padStart(3,'0')}`,
    name: t.name, type: 'terrain', rarity: findRarity(t.rarity),
    terrainId: t.terrainId, desc: t.desc,
    art: getPixelSVG(pixelArtsTerrains[0]),
  });
});

// I060-I071 (12 nuove varianti oggetto)
ITEMS.slice(13).forEach(it => {
  catalog.push({
    catalogId: `I${String(idx++).padStart(3,'0')}`,
    name: it.name, type: 'item', rarity: findRarity(it.rarity),
    itemId: it.itemId, desc: it.desc, cu: it.cu,
    art: getPixelSVG(pixelArtsItems[0]),
  });
});

// T072-T079 (8 nuove varianti terreno)
TERRAINS.slice(10).forEach(t => {
  catalog.push({
    catalogId: `T${String(idx++).padStart(3,'0')}`,
    name: t.name, type: 'terrain', rarity: findRarity(t.rarity),
    terrainId: t.terrainId, desc: t.desc,
    art: getPixelSVG(pixelArtsTerrains[0]),
  });
});

export const CARD_CATALOG = catalog; // 80 cards total

/* ── Helpers ──────────────────────────────────────── */
export function getCardById(catalogId) {
  return CARD_CATALOG.find(c => c.catalogId === catalogId) ?? null;
}

export function getCardsByType(type) {
  return CARD_CATALOG.filter(c => c.type === type);
}
