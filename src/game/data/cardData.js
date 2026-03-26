/*
 * cardData.js — Catalogo per le pagine Collection, DeckBuilder, PackOpening.
 * Usa gli stessi nomi/dati da gameData.js per coerenza.
 */
import {
    knightNames, weaponNames, shieldNames, itemDefs, terrainDefs,
    getPixelSVG, pixelArtsKnights, pixelArtsWeapons, pixelArtsShields, pixelArtsItems, pixelArtsTerrains
} from './gameData';

export const RARITIES = [
    { id: 'comune',      label: 'Comune',      color: '#8a8a9a' },
    { id: 'rara',        label: 'Rara',        color: '#2a5da8' },
    { id: 'epica',       label: 'Epica',       color: '#8b5fbf' },
    { id: 'leggendaria', label: 'Leggendaria', color: '#c9a84c' },
];

export function rollRarity() {
    const r = Math.random();
    if (r < 0.05) return RARITIES[3];      // leggendaria 5%
    if (r < 0.15) return RARITIES[2];      // epica 10%
    if (r < 0.40) return RARITIES[1];      // rara 25%
    return RARITIES[0];                     // comune 60%
}

function rFor(i, len) {
    const pct = i / len;
    if (pct < 0.5) return RARITIES[0];
    if (pct < 0.75) return RARITIES[1];
    if (pct < 0.92) return RARITIES[2];
    return RARITIES[3];
}

const catalog = [];

// Cavalieri
knightNames.forEach((name, i) => {
    catalog.push({
        catalogId: `knight_${i}`,
        name,
        type: 'knight',
        rarity: rFor(i, knightNames.length),
        baseAtk: 3 + i,
        baseDef: 5 + i,
        basePa: 2 + (i % 3),
        art: getPixelSVG(pixelArtsKnights[0]),
    });
});

// Armi
weaponNames.forEach((name, i) => {
    catalog.push({
        catalogId: `weapon_${i}`,
        name,
        type: 'weapon',
        rarity: rFor(i, weaponNames.length),
        atkBonus: 1 + i,
        art: getPixelSVG(pixelArtsWeapons[0]),
    });
});

// Scudi
shieldNames.forEach((name, i) => {
    catalog.push({
        catalogId: `shield_${i}`,
        name,
        type: 'shield',
        rarity: rFor(i, shieldNames.length),
        defBonus: 1 + i,
        art: getPixelSVG(pixelArtsShields[0]),
    });
});

// Oggetti
itemDefs.forEach((def, i) => {
    catalog.push({
        catalogId: `item_${i}`,
        name: def.name,
        type: 'item',
        rarity: rFor(i, itemDefs.length),
        desc: def.desc,
        art: getPixelSVG(pixelArtsItems[0]),
    });
});

// Terreni
terrainDefs.forEach((def, i) => {
    catalog.push({
        catalogId: `terrain_${i}`,
        name: def.name,
        type: 'terrain',
        rarity: rFor(i, terrainDefs.length),
        desc: def.desc,
        art: getPixelSVG(pixelArtsTerrains[0]),
    });
});

export const CARD_CATALOG = catalog;
