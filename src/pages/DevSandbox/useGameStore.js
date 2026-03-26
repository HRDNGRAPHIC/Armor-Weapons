/**
 * useGameStore.js — Zustand store con l'intera logica di gioco.
 *
 * Migrazione 1:1 del game engine da GameBoard.jsx (versione 8-bit)
 * adattato per essere consumato da GameBoard3D.jsx (layer 3D R3F).
 *
 * Il layer visivo (GameBoard3D) legge lo stato e chiama le azioni.
 * Lo store NON produce effetti visivi — si limita a mutare stato.
 * Le animazioni GSAP/R3F vivono esclusivamente nel componente 3D.
 *
 * Nessuna registrazione ELO/oro — siamo in dev sandbox.
 */
import { create } from 'zustand';
import {
  generateCard, generateEquipmentDeck, createDeck, getInitialState,
  getPixelSVG, pixelArtsKnights, pixelArtsWeapons, pixelArtsShields,
  pixelArtsItems, pixelArtsTerrains,
} from '../../game/data/gameData';
import { CARD_CATALOG } from '../../game/data/cardCatalog';
import {
  TERRAIN_ENV_MAP, ITEM_PARTICLE_COLORS, ITEM_TARGET_MAP, VFX_EVENTS,
} from './vfx/vfxConstants';


/* ═══════ Costanti di gioco ═══════ */
const ATK_CAP = 15;
const DEF_CAP = 15;
const PA_CAP  = 5;


/* ═══════ Helper: converte catalogId in oggetto gioco ═══════ */
function buildPlayerDeck(knightIds, cardIds) {
  const knights = knightIds.map(cid => {
    const cat = CARD_CATALOG.find(c => c.catalogId === cid);
    if (!cat) return generateCard();
    return {
      id: Math.random().toString(36).substr(2, 9),
      name: cat.name,
      baseAtk: cat.baseAtk, atk: cat.baseAtk,
      baseDef: cat.baseDef, def: cat.baseDef, maxDef: cat.baseDef,
      basePa: cat.basePa,   pa: cat.basePa,
      art: getPixelSVG(pixelArtsKnights[0]),
    };
  });

  const equipment = cardIds.map(cid => {
    const cat = CARD_CATALOG.find(c => c.catalogId === cid);
    if (!cat) return null;
    const base = { id: Math.random().toString(36).substr(2, 9), name: cat.name };
    if (cat.type === 'weapon')  return { ...base, type: 'arma',    bonus: cat.atkBonus,            cu: cat.cu, art: getPixelSVG(pixelArtsWeapons[0]) };
    if (cat.type === 'shield')  return { ...base, type: 'scudo',   bonus: cat.defBonus,            cu: cat.cu, art: getPixelSVG(pixelArtsShields[0]) };
    if (cat.type === 'item')    return { ...base, type: 'oggetto', itemId: cat.itemId, desc: cat.desc, cu: cat.cu, art: getPixelSVG(pixelArtsItems[0]) };
    if (cat.type === 'terrain') return { ...base, type: 'terreno', itemId: cat.terrainId, desc: cat.desc, cu: 0, art: getPixelSVG(pixelArtsTerrains[0]) };
    return null;
  }).filter(Boolean);

  /* Mescola equipaggiamento (Fisher-Yates) */
  for (let i = equipment.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [equipment[i], equipment[j]] = [equipment[j], equipment[i]];
  }
  return { knights, equipment };
}


/* ═══════ Helper: clona profondo (evita mutazioni condivise) ═══════ */
function deep(obj) { return JSON.parse(JSON.stringify(obj)); }


/* ═══════ Helper: calcola statistiche finali con modificatori terreno ═══════ */
function getFinalStats(playerState, activeTerrain) {
  const card = playerState.activeCard;
  if (!card) return { atk: 0, def: 0, pa: 0 };

  let atk = card.atk;
  let def = card.def;
  let pa  = card.pa;

  if (activeTerrain) {
    const t = activeTerrain;
    if (t.id === 'catene') {
      atk = Math.min(atk, card.baseAtk);
      def = Math.min(def, card.baseDef);
      pa  = Math.min(pa,  card.basePa);
    }
    if (t.id === 'sonno') {
      atk = Math.max(0, atk - 5);
    }
  }

  return {
    atk: Math.max(0, Math.min(ATK_CAP, atk)),
    def: Math.max(0, Math.min(DEF_CAP, def)),
    pa:  Math.max(0, Math.min(PA_CAP, pa)),
  };
}


/* ═══════ Helper: processa buff scaduti a fine turno ═══════ */
function processBuffs(pState) {
  pState.buffs.forEach(b => {
    b.turns--;

    if (b.turns <= 0 && pState.activeCard) {
      /* sabbia: ripristina ATK persa */
      if (b.id === 'sabbia') {
        pState.activeCard.atk = Math.min(ATK_CAP, pState.activeCard.atk + (b.origAtkLost || 0));
      }
      /* veleno: inverti effetto temporaneo */
      if (b.id === 'veleno') {
        pState.activeCard.atk = Math.max(0, pState.activeCard.atk - 1);
        pState.activeCard.def = Math.min(DEF_CAP, pState.activeCard.def + 1);
      }
      /* lacrima: inverti effetto temporaneo */
      if (b.id === 'lacrima') {
        pState.activeCard.def = Math.max(0, pState.activeCard.def - 1);
        pState.activeCard.atk = Math.min(ATK_CAP, pState.activeCard.atk + 1);
      }
    }
  });

  /* Rimuovi buff scaduti */
  pState.buffs = pState.buffs.filter(b => b.turns > 0);
}


/* ═══════ Helper: applica Riflesso (clona cavaliere avversario) ═══════ */
function applyRiflesso(ownerState, enemyState) {
  if (ownerState.activeCard && enemyState.activeCard) {
    enemyState.hiddenOriginalCard = deep(enemyState.activeCard);
    enemyState.activeCard.name    = ownerState.activeCard.name;
    enemyState.activeCard.art     = ownerState.activeCard.art;
    enemyState.activeCard.atk     = ownerState.activeCard.atk;
    enemyState.activeCard.def     = ownerState.activeCard.def;
    enemyState.activeCard.pa      = ownerState.activeCard.pa;
    enemyState.activeCard.baseAtk = ownerState.activeCard.baseAtk;
    enemyState.activeCard.baseDef = ownerState.activeCard.baseDef;
    enemyState.activeCard.basePa  = ownerState.activeCard.basePa;
    enemyState.activeCard.isCloned = true;
  }
}


/* ═══════════════════════════════════════════════════════════════════
   ZUSTAND STORE — Motore di gioco completo
   ═══════════════════════════════════════════════════════════════════ */
const useGameStore = create((set, get) => ({

  /* ─────────── Stato iniziale ─────────── */
  ...getInitialState(),

  /* Coda azioni: il layer 3D la consuma per riprodurre animazioni in sequenza.
     Ogni entry è { type: string, payload: object }.
     Tipi: 'knightDraw', 'weaponDraw', 'equipWeapon', 'terrainActivated',
           'attack', 'knightDeath', 'endTurn', 'gameOver', 'discardWeapon',
           'extraDraw', 'shatter' */
  actionQueue: [],

  /* Contatore monotono — il layer 3D lo osserva per sapere quando aggiornare */
  tick: 0,

  /* ── VFX Event Queue ──
     Coda eventi visivi separata da actionQueue.
     I componenti VFX la consumano per attivare effetti 3D (proiettili, fumo, esplosioni).
     Ogni entry è { type: VFX_EVENTS.*, payload: object, id: number } */
  vfxQueue: [],
  vfxTick: 0,

  /* ── Effetto Ambiente Corrente ──
     Derivato dal terreno attivo. Letto dai componenti luci/particelle R3F.
     null | 'RAIN' | 'QUAKE' | 'CHAINS' | 'SLEEP' | 'MIRROR' */
  environmentEffect: null,

  /* Risultato dell'ultimo attacco — il layer 3D lo osserva per lanciare animazioni */
  lastAttackResult: null,

  /* Ultimo equipaggiamento — il layer 3D lo osserva per l'animazione PlayingCard AI */
  lastEquipResult: null,


  /* ═══════ INIT GAME ═══════ */
  initGame: (knightIds, cardIds) => {
    const base = getInitialState();

    /* Costruisci deck giocatore: da catalogo se forniti, altrimenti random */
    if (knightIds?.length && cardIds?.length) {
      const { knights, equipment } = buildPlayerDeck(knightIds, cardIds);
      base.p1.deck       = knights;
      base.p1.weaponDeck = equipment;
      base.p1.cardsLeft  = knights.length;
      base.p1.weaponsLeft = equipment.length;
    } else {
      base.p1.deck       = createDeck(generateCard, 5);
      base.p1.weaponDeck = generateEquipmentDeck();
      base.p1.cardsLeft  = 5;
      base.p1.weaponsLeft = 45;
    }

    /* AI → sempre random */
    base.p2.deck       = createDeck(generateCard, 5);
    base.p2.weaponDeck = generateEquipmentDeck();
    base.p2.cardsLeft  = 5;
    base.p2.weaponsLeft = 45;

    base.isInitializing = true;

    set({
      ...base,
      actionQueue: [],
      tick: 0,
      vfxQueue: [],
      vfxTick: 0,
      environmentEffect: null,
    });
  },

  /* Segna fine fase di inizializzazione (chiamata dal layer 3D dopo le animazioni) */
  finishInit: () => set({ isInitializing: false }),


  /* ═══════ PESCA CAVALIERE ═══════ */
  drawCard: (playerNum) => {
    const s = get();
    const p = playerNum === 1 ? s.p1 : s.p2;

    /* Validazioni — isInitializing NON blocca drawCard: la pesca cavaliere avviene durante l'init */
    if (s.gameOver) return null;
    if (p.activeCard || p.cardsLeft <= 0) return null;

    const card = p.deck[p.deck.length - 1]; /* peek per copia */
    const newDeck = p.deck.slice(0, -1);
    const newCardsLeft = p.cardsLeft - 1;

    /* Applica pioggia: +2 DEF immediato se terreno attivo */
    if (s.activeTerrain?.id === 'pioggia') {
      card.def = Math.min(DEF_CAP, card.def + 2);
    }

    const pKey = playerNum === 1 ? 'p1' : 'p2';
    const updates = {
      [pKey]: {
        ...p,
        deck: newDeck,
        cardsLeft: newCardsLeft,
        activeCard: card,
      },
    };

    /* Applica riflesso se il terreno è posseduto dall'avversario */
    if (s.activeTerrain?.id === 'riflesso' && playerNum !== s.activeTerrain.owner) {
      const ownerKey = s.activeTerrain.owner === 1 ? 'p1' : 'p2';
      const ownerState = ownerKey === pKey ? updates[pKey] : { ...s[ownerKey] };
      applyRiflesso(ownerState, updates[pKey]);
    }

    set({
      ...updates,
      actionQueue: [...s.actionQueue, { type: 'knightDraw', payload: { playerNum, card: deep(card) } }],
      tick: s.tick + 1,
    });

    return card;
  },


  /* ═══════ PESCA EQUIPAGGIAMENTO ═══════ */
  drawWeapon: (playerNum) => {
    const s = get();
    const p = playerNum === 1 ? s.p1 : s.p2;

    if (s.turn !== playerNum || s.gameOver || s.isInitializing) return [];
    if (p.hasDrawnWeapon || p.weaponsLeft <= 0) return [];
    if (p.buffs.some(b => b.id === 'noDraw')) return [];

    const emptySlots = p.weaponSlots
      .map((sl, i) => sl === null ? i : -1)
      .filter(i => i !== -1);

    if (emptySlots.length === 0) return [];

    const newWeaponDeck = [...p.weaponDeck];
    const newSlots      = [...p.weaponSlots];
    let newWeaponsLeft   = p.weaponsLeft;
    const drawnCards     = [];
    const terrainCards   = [];

    for (const slotIdx of emptySlots) {
      if (newWeaponsLeft <= 0) break;
      const card = newWeaponDeck.pop();
      newWeaponsLeft--;

      if (card.type === 'terreno') {
        /* Il terreno va in coda separata — il layer 3D mostrerà l'overlay */
        terrainCards.push({ card, slotIdx });
      } else {
        newSlots[slotIdx] = card;
        drawnCards.push({ card, slotIdx });
      }
    }

    const pKey = playerNum === 1 ? 'p1' : 'p2';
    const newP = {
      ...p,
      weaponDeck: newWeaponDeck,
      weaponsLeft: newWeaponsLeft,
      weaponSlots: newSlots,
      hasDrawnWeapon: true,
    };

    const queue = [...s.actionQueue];
    drawnCards.forEach(d => queue.push({ type: 'weaponDraw', payload: { playerNum, card: deep(d.card), slotIdx: d.slotIdx } }));
    terrainCards.forEach(t => queue.push({ type: 'terrainActivated', payload: { playerNum, card: deep(t.card) } }));

    /* Se c'è un terreno, attivalo immediatamente nello stato */
    let newTerrain = s.activeTerrain;
    let newEnvEffect = s.environmentEffect;
    const vfx = [...s.vfxQueue];
    if (terrainCards.length > 0) {
      const tc = terrainCards[0].card;
      newTerrain = { id: tc.itemId, turns: 3, owner: playerNum, card: deep(tc) };
      newEnvEffect = TERRAIN_ENV_MAP[tc.itemId] || null;
      vfx.push({ type: VFX_EVENTS.TERRAIN_ACTIVATED, id: s.vfxTick, payload: {
        terrainId: tc.itemId, card: deep(tc), playerNum, envEffect: newEnvEffect,
      }});

      /* Effetto immediato pioggia: +2 DEF a entrambi */
      if (tc.itemId === 'pioggia') {
        const otherKey = playerNum === 1 ? 'p2' : 'p1';
        const otherP = { ...s[otherKey] };
        if (newP.activeCard) newP.activeCard.def = Math.min(DEF_CAP, newP.activeCard.def + 2);
        if (otherP.activeCard) {
          otherP.activeCard = { ...otherP.activeCard, def: Math.min(DEF_CAP, otherP.activeCard.def + 2) };
          set(prev => ({ [otherKey]: { ...prev[otherKey], activeCard: otherP.activeCard } }));
        }
      }

      /* Riflesso: clona cavaliere */
      if (tc.itemId === 'riflesso') {
        const enemyNum = playerNum === 1 ? 2 : 1;
        const enemyKey = playerNum === 1 ? 'p2' : 'p1';
        const enemyP   = { ...s[enemyKey] };
        applyRiflesso(newP, enemyP);
        set(prev => ({ [enemyKey]: { ...prev[enemyKey], ...enemyP } }));
        vfx.push({ type: VFX_EVENTS.CLONE_INITIATED, id: s.vfxTick + 1, payload: {
          ownerNum: playerNum, targetNum: enemyNum,
        }});
      }
    }

    set({
      [pKey]: newP,
      activeTerrain: newTerrain,
      environmentEffect: newEnvEffect,
      actionQueue: queue,
      tick: s.tick + 1,
      vfxQueue: vfx,
      vfxTick: s.vfxTick + vfx.length - s.vfxQueue.length,
    });

    return drawnCards;
  },


  /* ═══════ PESCA SINGOLA ARMA (es. fortuna / redraw) ═══════ */
  drawSingleWeapon: (playerNum, targetSlotIdx) => {
    const s = get();
    const p = playerNum === 1 ? s.p1 : s.p2;

    if (p.weaponsLeft <= 0 || p.buffs.some(b => b.id === 'noDraw')) return null;

    const newWeaponDeck = [...p.weaponDeck];
    const card = newWeaponDeck.pop();
    const newWeaponsLeft = p.weaponsLeft - 1;
    const newSlots = [...p.weaponSlots];

    const pKey = playerNum === 1 ? 'p1' : 'p2';
    const queue = [...s.actionQueue];
    let newTerrain = s.activeTerrain;

    if (card.type === 'terreno') {
      /* Terreno: attiva e ripesca un'altra carta nello stesso slot */
      newTerrain = { id: card.itemId, turns: 3, owner: playerNum, card: deep(card) };
      queue.push({ type: 'terrainActivated', payload: { playerNum, card: deep(card) } });

      set({
        [pKey]: { ...p, weaponDeck: newWeaponDeck, weaponsLeft: newWeaponsLeft },
        activeTerrain: newTerrain,
        actionQueue: queue,
        tick: s.tick + 1,
      });

      /* Ripesca ricorsiva per lo stesso slot */
      setTimeout(() => get().drawSingleWeapon(playerNum, targetSlotIdx), 100);
      return null;
    }

    newSlots[targetSlotIdx] = card;
    queue.push({ type: 'weaponDraw', payload: { playerNum, card: deep(card), slotIdx: targetSlotIdx } });

    set({
      [pKey]: { ...p, weaponDeck: newWeaponDeck, weaponsLeft: newWeaponsLeft, weaponSlots: newSlots },
      activeTerrain: newTerrain,
      actionQueue: queue,
      tick: s.tick + 1,
    });

    return card;
  },


  /* ═══════ SCARTA ARMA (click destro) + auto-redraw se primo scarto ═══════ */
  discardWeapon: (playerNum, slotIdx) => {
    const s = get();
    const p = playerNum === 1 ? s.p1 : s.p2;

    if (s.turn !== playerNum || s.gameOver || !p.weaponSlots[slotIdx]) return;

    const newSlots = [...p.weaponSlots];
    newSlots[slotIdx] = null;
    const pKey = playerNum === 1 ? 'p1' : 'p2';

    const queue = [...s.actionQueue];
    queue.push({ type: 'discardWeapon', payload: { playerNum, slotIdx } });

    /* Primo scarto del turno → ripesca automatica */
    const willRedraw = !p.hasUsedRedraw && p.weaponsLeft > 0 && !p.buffs.some(b => b.id === 'noDraw');

    set({
      [pKey]: { ...p, weaponSlots: newSlots, hasUsedRedraw: willRedraw ? true : p.hasUsedRedraw },
      actionQueue: queue,
      tick: s.tick + 1,
    });

    if (willRedraw) {
      setTimeout(() => get().drawSingleWeapon(playerNum, slotIdx), 300);
    }
  },


  /* ═══════ EQUIPAGGIA ARMA ═══════ */
  equipWeapon: (playerNum, slotIdx) => {
    const s = get();
    const p = playerNum === 1 ? s.p1 : s.p2;
    const pKey = playerNum === 1 ? 'p1' : 'p2';
    const enemyKey = playerNum === 1 ? 'p2' : 'p1';
    const enemy = { ...s[enemyKey] };

    const weapon = p.weaponSlots[slotIdx];
    const knight = p.activeCard;

    /* Validazioni */
    if (!weapon || !knight) return { success: false, reason: 'no-weapon-or-knight' };
    if (knight.pa < weapon.cu) return { success: false, reason: 'no-pa' };

    /* Restrizione scudo: noDefBoost impedisce equipaggiamento scudi */
    if (weapon.type === 'scudo' && p.buffs.some(b => b.id === 'noDefBoost')) {
      return { success: false, reason: 'no-def-boost' };
    }

    /* Oggetti offensivi richiedono cavaliere nemico in campo */
    if (weapon.type === 'oggetto' &&
        ['sabbia', 'afferra', 'sottrai', 'sangue'].includes(weapon.itemId) &&
        !enemy.activeCard) {
      return { success: false, reason: 'no-enemy-knight' };
    }

    /* ── Consuma PA ── */
    const newKnight = { ...knight };
    newKnight.pa -= weapon.cu;

    /* ── Applica effetto in base al tipo ── */
    let effectType = weapon.type;
    let effectPayload = {};
    let newEnemy = deep(enemy);
    const newP = { ...p, activeCard: newKnight };
    const newSlots = [...p.weaponSlots];
    newSlots[slotIdx] = null;
    newP.weaponSlots = newSlots;
    const queue = [...s.actionQueue];

    switch (weapon.type) {
      case 'arma': {
        const maxBonus = ATK_CAP - newKnight.atk;
        const applied  = Math.min(maxBonus, weapon.bonus);
        newKnight.atk += applied;
        newP.weaponAtkGainedThisTurn += applied;
        effectPayload = { stat: 'atk', delta: applied };
        break;
      }
      case 'scudo': {
        newKnight.def = Math.min(DEF_CAP, newKnight.def + weapon.bonus);
        effectPayload = { stat: 'def', delta: weapon.bonus };
        break;
      }
      case 'oggetto': {
        effectType = 'oggetto';
        effectPayload = { itemId: weapon.itemId };

        switch (weapon.itemId) {
          case 'ampolla':
            newKnight.def = Math.min(DEF_CAP, newKnight.def + 5);
            effectPayload.stat = 'def';
            effectPayload.delta = 5;
            break;

          case 'sidro':
            newKnight.pa = Math.min(PA_CAP, newKnight.pa + 3);
            effectPayload.stat = 'pa';
            effectPayload.delta = 3;
            break;

          case 'sabbia': {
            const lostAtk = Math.ceil(newEnemy.activeCard.atk / 2);
            newEnemy.activeCard.atk -= lostAtk;
            newEnemy.buffs = [...newEnemy.buffs,
              { id: 'sabbia', turns: 2, origAtkLost: lostAtk },
              { id: 'noAttack', turns: 2 },
            ];
            effectPayload.lostAtk = lostAtk;
            break;
          }

          case 'afferra': {
            if (newEnemy.lastTurnWeaponAtk > 0) {
              newEnemy.activeCard.atk = Math.max(0, newEnemy.activeCard.atk - newEnemy.lastTurnWeaponAtk);
              effectPayload.stolen = newEnemy.lastTurnWeaponAtk;
            }
            break;
          }

          case 'veleno':
            newKnight.atk = Math.min(ATK_CAP, newKnight.atk + 1);
            newKnight.def = Math.max(0, newKnight.def - 1);
            newP.buffs = [...p.buffs, { id: 'veleno', turns: 3 }];
            break;

          case 'lacrima':
            newKnight.def = Math.min(DEF_CAP, newKnight.def + 1);
            newKnight.atk = Math.max(0, newKnight.atk - 1);
            newP.buffs = [...p.buffs, { id: 'lacrima', turns: 3 }];
            break;

          case 'sangue':
            newKnight.def = Math.max(0, newKnight.def - 5);
            newEnemy.buffs = [...newEnemy.buffs, { id: 'noDefBoost', turns: 999 }];
            break;

          case 'fortuna':
            /* Peschi 1 carta extra — verrà eseguito dopo questa azione */
            effectPayload.extraDraw = true;
            effectPayload.targetSlot = slotIdx;
            break;

          case 'sacrificio':
            newKnight.atk = ATK_CAP;
            newKnight.def = DEF_CAP;
            newKnight.pa  = 0;
            newP.buffs = [...p.buffs, { id: 'noDraw', turns: 3 }];
            /* Distruggi tutte le altre carte nello slot armi */
            for (let i = 0; i < 3; i++) {
              if (i !== slotIdx && newSlots[i]) {
                queue.push({ type: 'shatter', payload: { playerNum, slotIdx: i } });
                newSlots[i] = null;
              }
            }
            break;

          case 'sottrai': {
            newP.buffs = [...p.buffs, { id: 'noAttack', turns: 1 }];
            const filledSlots = newEnemy.weaponSlots
              .map((w, i) => w ? i : -1)
              .filter(i => i !== -1);
            if (filledSlots.length > 0) {
              const target = filledSlots[Math.floor(Math.random() * filledSlots.length)];
              queue.push({ type: 'shatter', payload: { playerNum: playerNum === 1 ? 2 : 1, slotIdx: target } });
              newEnemy.weaponSlots[target] = null;
            }
            break;
          }

          default:
            break;
        }
        break;
      }
      default:
        break;
    }

    newP.activeCard = newKnight;
    queue.push({
      type: 'equipWeapon',
      payload: {
        playerNum, slotIdx, weapon: deep(weapon),
        effectType, effectPayload,
        knightAfter: deep(newKnight),
      },
    });

    /* ── Emetti eventi VFX ── */
    const vfx = [...s.vfxQueue];
    let vfxCount = 0;

    if (weapon.type === 'oggetto') {
      if (weapon.itemId === 'sacrificio') {
        /* Sacrificio: evento speciale con lista slot distrutti */
        const destroyedSlots = [];
        for (let i = 0; i < 3; i++) {
          if (i !== slotIdx && p.weaponSlots[i]) destroyedSlots.push(i);
        }
        vfx.push({ type: VFX_EVENTS.SACRIFICE_TRIGGERED, id: s.vfxTick + vfxCount++, payload: {
          playerNum, destroyedSlots,
        }});
      } else {
        /* Tutti gli altri oggetti: SPELL_CAST con colore particelle */
        const targetType = ITEM_TARGET_MAP[weapon.itemId] || 'self';
        const targetNum = targetType === 'enemy' ? (playerNum === 1 ? 2 : 1) : playerNum;
        vfx.push({ type: VFX_EVENTS.SPELL_CAST, id: s.vfxTick + vfxCount++, payload: {
          playerNum, targetNum, itemId: weapon.itemId,
          card: deep(weapon),
          particleColor: ITEM_PARTICLE_COLORS[weapon.itemId] || ITEM_PARTICLE_COLORS.ampolla,
          targetType,
        }});
      }
    } else if (weapon.type === 'arma' || weapon.type === 'scudo') {
      vfx.push({ type: VFX_EVENTS.BUFF_APPLIED, id: s.vfxTick + vfxCount++, payload: {
        playerNum,
        stat: weapon.type === 'arma' ? 'atk' : 'def',
        delta: weapon.bonus,
      }});
    }

    set({
      [pKey]: newP,
      [enemyKey]: newEnemy,
      actionQueue: queue,
      lastEquipResult: { playerNum, slotIdx, weapon: deep(weapon) },
      tick: s.tick + 1,
      vfxQueue: vfx,
      vfxTick: s.vfxTick + vfxCount,
    });

    /* Fortuna: pesca extra dopo breve attesa */
    if (weapon.itemId === 'fortuna') {
      setTimeout(() => get().drawSingleWeapon(playerNum, slotIdx), 450);
    }

    return { success: true, effectType, effectPayload };
  },


  /* ═══════ ATTACCO ═══════ */
  attack: (playerNum) => {
    const s = get();
    const p = playerNum === 1 ? s.p1 : s.p2;
    const pKey = playerNum === 1 ? 'p1' : 'p2';
    const enemyNum = playerNum === 1 ? 2 : 1;
    const enemyKey = playerNum === 1 ? 'p2' : 'p1';
    const enemy = s[enemyKey];

    if (s.turn !== playerNum || s.gameOver || s.hasAttacked) return null;
    if (!p.activeCard || !enemy.activeCard) return null;
    if (p.buffs.some(b => b.id === 'noAttack' || b.id === 'sabbia')) return null;

    /* Calcola danno con modificatori terreno */
    const stats = getFinalStats(p, s.activeTerrain);
    let damage = stats.atk;

    /* Terremoto: danno raddoppiato */
    if (s.activeTerrain?.id === 'terremoto') {
      damage = damage * 2;
    }

    /* Applica danno alla DEF nemica */
    const newEnemy = deep(enemy);
    newEnemy.activeCard.def -= damage;

    /* Determina se il cavaliere nemico muore */
    const enemyStats = getFinalStats(newEnemy, s.activeTerrain);
    const knightDied = enemyStats.def <= 0;

    if (knightDied) {
      /* NON annullare activeCard qui — il layer 3D ha bisogno della carta
         montata per la dissoluzione. Sarà confirmKnightDeath() a fare pulizia. */
      newEnemy.activeCard.def = 0;
    }

    const queue = [...s.actionQueue];
    queue.push({
      type: 'attack',
      payload: {
        playerNum, enemyNum, damage,
        knightDied,
        isSlow: s.activeTerrain?.id === 'sonno',
        attackerStats: stats,
      },
    });

    if (knightDied) {
      queue.push({ type: 'knightDeath', payload: { playerNum: enemyNum } });
    }

    set({
      [enemyKey]: newEnemy,
      hasAttacked: true,
      lastAttackResult: { playerNum, enemyNum, damage, knightDied },
      actionQueue: queue,
      tick: s.tick + 1,
    });

    return { damage, knightDied };
  },


  /* ═══════ FINE TURNO ═══════ */
  endTurn: (playerNum) => {
    const s = get();
    if (s.turn !== playerNum || s.gameOver) return;

    const p = playerNum === 1 ? s.p1 : s.p2;
    const pKey = playerNum === 1 ? 'p1' : 'p2';

    /* Salva ATK guadagnata quest turno (per item 'afferra') */
    const newP = deep(p);
    newP.lastTurnWeaponAtk      = newP.weaponAtkGainedThisTurn;
    newP.weaponAtkGainedThisTurn = 0;

    /* Scambia turno */
    const nextTurn = playerNum === 1 ? 2 : 1;

    /* Reset flag per-turno per ENTRAMBI i giocatori */
    const otherKey = playerNum === 1 ? 'p2' : 'p1';
    const newOther = deep(s[otherKey]);
    newP.hasDrawnWeapon    = false;
    newP.hasUsedRedraw     = false;
    newOther.hasDrawnWeapon = false;
    newOther.hasUsedRedraw  = false;

    /* Processa buff del giocatore del PROSSIMO turno */
    const nextPState = nextTurn === 1 ? (pKey === 'p1' ? newP : newOther) : (pKey === 'p2' ? newP : newOther);
    processBuffs(nextPState);

    /* Aggiorna terreno */
    let newTerrain = s.activeTerrain ? { ...s.activeTerrain } : null;
    if (newTerrain && newTerrain.owner === nextTurn) {
      newTerrain.turns--;

      /* Pioggia: +2 DEF a tutti ogni turno del proprietario */
      if (newTerrain.id === 'pioggia' && newTerrain.turns > 0) {
        if (newP.activeCard) newP.activeCard.def = Math.min(DEF_CAP, newP.activeCard.def + 2);
        if (newOther.activeCard) newOther.activeCard.def = Math.min(DEF_CAP, newOther.activeCard.def + 2);
      }

      /* Terreno scaduto */
      if (newTerrain.turns <= 0) {
        /* Riflesso: ripristina carte clonate */
        if (newTerrain.id === 'riflesso') {
          const enemyOfOwner = newTerrain.owner === 1 ? newOther : newP;
          if (enemyOfOwner.hiddenOriginalCard) {
            enemyOfOwner.activeCard = enemyOfOwner.hiddenOriginalCard;
            if (enemyOfOwner.activeCard) enemyOfOwner.activeCard.isCloned = false;
            enemyOfOwner.hiddenOriginalCard = null;
          }
        }
        newTerrain = null;
      }
    }

    const queue = [...s.actionQueue];
    queue.push({ type: 'endTurn', payload: { from: playerNum, to: nextTurn } });

    /* ── Emetti VFX per scadenza terreno ── */
    const vfx = [...s.vfxQueue];
    let newEnvEffect = s.environmentEffect;
    if (s.activeTerrain && !newTerrain) {
      vfx.push({ type: VFX_EVENTS.TERRAIN_EXPIRED, id: s.vfxTick, payload: {
        terrainId: s.activeTerrain.id,
      }});
      newEnvEffect = null;
    }

    set({
      [pKey]: newP,
      [otherKey]: newOther,
      turn: nextTurn,
      hasAttacked: false,
      activeTerrain: newTerrain,
      environmentEffect: newEnvEffect,
      actionQueue: queue,
      tick: s.tick + 1,
      vfxQueue: vfx,
      vfxTick: s.vfxTick + (vfx.length - s.vfxQueue.length),
    });
  },


  /* ═══════ CONTROLLO VITTORIA ═══════ */
  checkWinCondition: () => {
    const s = get();
    const p1Lost = !s.p1.activeCard && s.p1.cardsLeft === 0;
    const p2Lost = !s.p2.activeCard && s.p2.cardsLeft === 0;

    if (!p1Lost && !p2Lost) return null;

    let outcome = 'draw';
    let message = 'PAREGGIO! Entrambi sono caduti.';
    if (p1Lost && p2Lost) {
      outcome = 'draw';
    } else if (p1Lost) {
      outcome = 'loss';
      message = 'IL GIOCATORE 2 TRIONFA!';
    } else if (p2Lost) {
      outcome = 'win';
      message = 'IL GIOCATORE 1 TRIONFA!';
    }

    set({
      gameOver: true,
      actionQueue: [...s.actionQueue, { type: 'gameOver', payload: { outcome, message } }],
      tick: s.tick + 1,
    });

    return { outcome, message };
  },


  /* ═══════ TURNO AI COMPLETO ═══════ */
  playAITurn: async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const s = get;

    /* Pausa iniziale — dà tempo al layer 3D di mostrare il cambio turno */
    await wait(1000);
    if (s().gameOver || s().turn !== 2) return;

    /* 1. Pesca cavaliere se non presente */
    if (!s().p2.activeCard && s().p2.cardsLeft > 0) {
      s().drawCard(2);
      await wait(1000);
    }
    if (s().gameOver) return;

    /* 2. Pesca equipaggiamento */
    if (!s().p2.hasDrawnWeapon && s().p2.weaponsLeft > 0 && s().p2.weaponSlots.includes(null)) {
      s().drawWeapon(2);
      await wait(1200);
    }
    if (s().gameOver) return;

    /* 3. Scarta armi troppo costose (PA insufficiente) — usa il primo scarto gratuito */
    if (!s().p2.hasUsedRedraw && s().p2.activeCard) {
      const uselessSlot = s().p2.weaponSlots.findIndex(w =>
        w !== null && w.cu > s().p2.activeCard.pa
      );
      if (uselessSlot !== -1) {
        s().discardWeapon(2, uselessSlot);
        await wait(1200);
      }
    }
    if (s().gameOver) return;

    /* 4. Equipaggia armi da sinistra a destra se PA sufficiente */
    if (s().p2.activeCard) {
      for (let i = 0; i < 3; i++) {
        const current = s();
        const w = current.p2.weaponSlots[i];
        if (!w || !current.p2.activeCard) continue;
        if (current.p2.activeCard.pa < w.cu) continue;

        /* Salta oggetti offensivi se non c'è cavaliere nemico */
        if (w.type === 'oggetto' &&
            ['sabbia', 'afferra', 'sottrai', 'sangue'].includes(w.itemId) &&
            !current.p1.activeCard) {
          continue;
        }

        current.equipWeapon(2, i);
        await wait(4800);
        if (s().gameOver) return;
      }
    }
    if (s().gameOver) return;

    /* 5. Attacca se possibile */
    const final = s();
    if (final.p2.activeCard && final.p1.activeCard && !final.hasAttacked &&
        !final.p2.buffs.some(b => b.id === 'noAttack' || b.id === 'sabbia')) {
      final.attack(2);
      await wait(2500); /* attesa lunga per dissoluzione cavaliere nel layer 3D */
    }

    /* 6. Fine turno */
    if (!s().gameOver && s().turn === 2) {
      s().endTurn(2);
    }
  },


  /* ═══════ GETTER: statistiche finali con modificatori terreno + flag buff ═══════ */
  getStats: (playerNum) => {
    const s = get();
    const p = playerNum === 1 ? s.p1 : s.p2;
    const stats = getFinalStats(p, s.activeTerrain);
    const card = p.activeCard;
    return {
      ...stats,
      /* Flag ologrammi: true se la stat corrente è maggiore della base */
      isAtkBuffed: card ? card.atk > card.baseAtk : false,
      isDefBuffed: card ? card.def > card.baseDef : false,
    };
  },


  /* ═══════ CONSUMA AZIONE DALLA CODA (chiamata dal layer 3D dopo aver animato) ═══════ */
  consumeAction: () => {
    set(s => ({
      actionQueue: s.actionQueue.slice(1),
    }));
  },

  /* Svuota tutta la coda (reset veloce) */
  clearQueue: () => set({ actionQueue: [] }),

  /* ═══════ VFX QUEUE — Consuma/resetta eventi visivi ═══════ */
  consumeVfx: () => set(s => ({ vfxQueue: s.vfxQueue.slice(1) })),
  clearVfxQueue: () => set({ vfxQueue: [] }),


  /* ═══════ CONFERMA MORTE CAVALIERE (chiamata dal layer 3D dopo la dissoluzione) ═══════ */
  confirmKnightDeath: (playerNum) => {
    const pKey = playerNum === 1 ? 'p1' : 'p2';
    set(s => ({
      [pKey]: { ...s[pKey], activeCard: null, buffs: [] },
    }));
    setTimeout(() => get().checkWinCondition(), 50);
  },

  /* Resetta risultato ultimo attacco (il layer 3D chiama dopo aver animato) */
  clearLastAttack: () => set({ lastAttackResult: null }),
  clearLastEquip:  () => set({ lastEquipResult: null }),
}));

export default useGameStore;
