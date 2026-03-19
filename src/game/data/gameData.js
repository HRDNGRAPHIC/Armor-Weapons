// --- DATI E GENERAZIONE CARTE (copia esatta da A&Wmobile.html) ---

export const knightNames = [ "Gothmog", "Kull", "Vanguard", "Draken", "Tark", "Gorluk", "Azrael", "Morbus", "Vornik", "Zarak", "Ragnar", "Kaelen" ];
export const weaponNames = [ "Spada Sanguinaria", "Ascia del Boia", "Mazza Devastante", "Lama Oscura", "Spadone di Ferro", "Falce Animica" ];
export const shieldNames = [ "Scudo di Legno", "Scudo del Drago", "Egida Oscura", "Scudo di Ferro", "Baluardo Pietra", "Scudo Spinato" ];
export const itemDefs = [
    { id: 'ampolla', name: 'Ampolla di cura', cu: 1, desc: '+5 DEF' },
    { id: 'sidro', name: 'Sidro guerriero', cu: 0, desc: '+3 PA' },
    { id: 'sabbia', name: 'Sabbia negli occhi', cu: 2, desc: 'Acceca nemico (2T), 1/2 ATK' },
    { id: 'afferra', name: 'Afferra arma', cu: 1, desc: 'Togli ATK bonus nemico prec.' },
    { id: 'veleno', name: 'Veleno Berserker', cu: 1, desc: '+1 ATK/-1 DEF (3T)' },
    { id: 'lacrima', name: 'Lacrima di angelo', cu: 1, desc: '+1 DEF/-1 ATK (3T)' },
    { id: 'sangue', name: 'Sangue al nemico', cu: 1, desc: '-5 DEF, blocca DEF nemico' },
    { id: 'fortuna', name: 'Fortuna liquida', cu: 1, desc: 'Peschi 1 carta extra' },
    { id: 'sacrificio', name: 'Sacrificio', cu: 0, desc: 'ATK/DEF 15, PA 0, no pesca (3T)' },
    { id: 'sottrai', name: 'Sottrai', cu: 2, desc: 'Distruggi carta nemico, no atk 1T' }
];
export const terrainDefs = [
    { id: 'terremoto', name: 'Terremoto', cu: 0, desc: 'Dimezza ATK e DEF (3T)' },
    { id: 'pioggia', name: 'Pioggia divina', cu: 0, desc: '+2 DEF curati ogni turno (3T)' },
    { id: 'catene', name: 'Catene Infernali', cu: 0, desc: 'Annulla potenziamenti (3T)' },
    { id: 'sonno', name: 'Sonno', cu: 0, desc: 'Battaglia Lenta, -5 ATK (3T)' },
    { id: 'riflesso', name: 'Riflesso', cu: 0, desc: 'Nemico clone tuo cavaliere (3T)' }
];

// Pixel Arts (16x12)
export const pixelArtsKnights = [ [ "   X        X   ", "  XX        XX  ", "  X          X  ", " ###        ### ", " @@@@@@@@@@@@@@ ", " ### O #### O # ", " ############## ", "  ############  ", "   ##########   ", "    ##    ##    ", "    ##    ##    ", "   ###    ###   " ] ];
export const pixelArtsWeapons = [ [ "       X        ", "      XXX       ", "      XXX       ", "      XXX       ", "      XXX       ", "      XXX       ", "     XXXXX      ", "    XXXXXXX     ", "       #        ", "       #        ", "       #        ", "      ###       " ] ];
export const pixelArtsShields = [ [ "                ", "     XXXXXX     ", "    XX####XX    ", "   XX######XX   ", "   XX######XX   ", "   XX######XX   ", "   XX######XX   ", "    XX####XX    ", "     XX##XX     ", "      XXXX      ", "       XX       ", "                " ] ];
export const pixelArtsItems = [ [ "                ", "      ####      ", "     ##  ##     ", "    ##    ##    ", "    ## ####     ", "    ##  ##      ", "     ##  ##     ", "      ####      ", "                ", "                ", "                ", "                " ] ];
export const pixelArtsTerrains = [ [ "      @@@@      ", "     @####@     ", "    @######@    ", "   @########@   ", "  @#  ####  #@  ", "  @#  ####  #@  ", "   @########@   ", "    @######@    ", "     @####@     ", "      @@@@      ", "                ", "                " ] ];

export function getPixelSVG(artMatrix) {
    let svg = `<svg viewBox="0 0 16 12" style="width:100%; height:100%; image-rendering: pixelated; filter: drop-shadow(0px 4px 0px rgba(138,3,3,0.4));">`;
    const pal = {'#':'#111', '@':'#444', 'O':'#ff0000', 'X':'#e2d1a3', '-':'#b8860b', '|':'#8b4513'};
    for(let y=0; y<artMatrix.length; y++){
        for(let x=0; x<artMatrix[y].length; x++){
            let c = artMatrix[y][x];
            if(pal[c]) svg += `<rect x="${x}" y="${y}" width="1.05" height="1.05" fill="${pal[c]}" />`;
        }
    }
    svg += `</svg>`;
    return svg;
}

export function generateCard() {
    let atkVal = Math.floor(Math.random() * 10) + 3;
    let defVal = Math.floor(Math.random() * 10) + 5;
    let paVal = Math.floor(Math.random() * 3) + 2;
    return {
        id: Math.random().toString(36).substr(2, 9),
        name: knightNames[Math.floor(Math.random() * knightNames.length)],
        baseAtk: atkVal, atk: atkVal,
        baseDef: defVal, def: defVal, maxDef: defVal,
        basePa: paVal, pa: paVal,
        art: getPixelSVG(pixelArtsKnights[0])
    };
}

export function generateEquipmentDeck() {
    let weapons = [], shields = [];
    for(let i=0; i<15; i++) {
        let bonusAtk = Math.floor(Math.random() * 5) + 1;
        weapons.push({ id: 'w_' + Math.random().toString(36).substr(2, 9), type: 'arma', name: weaponNames[Math.floor(Math.random() * weaponNames.length)], bonus: bonusAtk, cu: Math.max(1, bonusAtk - Math.floor(Math.random() * 2)), art: getPixelSVG(pixelArtsWeapons[0]) });
    }
    for(let i=0; i<15; i++) {
        let bonusDef = Math.floor(Math.random() * 5) + 1;
        shields.push({ id: 's_' + Math.random().toString(36).substr(2, 9), type: 'scudo', name: shieldNames[Math.floor(Math.random() * shieldNames.length)], bonus: bonusDef, cu: Math.max(1, bonusDef - Math.floor(Math.random() * 2)), art: getPixelSVG(pixelArtsShields[0]) });
    }
    let items = itemDefs.map(def => ({ id: 'i_' + Math.random().toString(36).substr(2, 9), type: 'oggetto', itemId: def.id, name: def.name, cu: def.cu, desc: def.desc, art: getPixelSVG(pixelArtsItems[0]) }));
    let terrains = terrainDefs.map(def => ({ id: 't_' + Math.random().toString(36).substr(2, 9), type: 'terreno', itemId: def.id, name: def.name, cu: 0, desc: def.desc, art: getPixelSVG(pixelArtsTerrains[0]) }));

    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    for (let i = terrains.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [terrains[i], terrains[j]] = [terrains[j], terrains[i]]; }

    let deck = [];
    for (let chunk = 0; chunk < 5; chunk++) {
        let miniDeck = [ weapons.pop(), weapons.pop(), weapons.pop(), shields.pop(), shields.pop(), shields.pop(), items.pop(), items.pop(), terrains.pop() ];
        for (let i = miniDeck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [miniDeck[i], miniDeck[j]] = [miniDeck[j], miniDeck[i]]; }
        deck.push(...miniDeck);
    }
    return deck;
}

export function createDeck(generator, size) {
    let deck = []; for(let i=0; i<size; i++) deck.push(generator()); return deck;
}

export function getInitialState() {
    return {
        turn: 1, hasAttacked: false, gameOver: false, isInitializing: false, isPaused: false,
        activeTerrain: null,
        p1: { deck: [], activeCard: null, cardsLeft: 5, weaponDeck: [], weaponsLeft: 45, weaponSlots: [null, null, null], hasDrawnWeapon: false, hasUsedRedraw: false, buffs: [], weaponAtkGainedThisTurn: 0, lastTurnWeaponAtk: 0 },
        p2: { deck: [], activeCard: null, cardsLeft: 5, weaponDeck: [], weaponsLeft: 45, weaponSlots: [null, null, null], hasDrawnWeapon: false, hasUsedRedraw: false, buffs: [], weaponAtkGainedThisTurn: 0, lastTurnWeaponAtk: 0 }
    };
}
