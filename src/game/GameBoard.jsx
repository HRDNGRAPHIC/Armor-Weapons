import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateCard, generateEquipmentDeck, createDeck, getInitialState } from './data/gameData';
import { playSound } from './data/gameAudio';
import { useAuth } from '../context/AuthContext';
import { recordGameResult } from '../services/elo';

/*
 * GameBoard — 1:1 port of A&Wmobile.html
 * Uses direct DOM manipulation (refs) to match the original's imperative style exactly.
 * All game logic is copied word-for-word from the original HTML file.
 */

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function GameBoard() {
    const navigate = useNavigate();
    const { user, refreshProfile } = useAuth();
    const stateRef = useRef(getInitialState());
    const zoomOriginRef = useRef({ x: 0, y: 0 });
    const containerRef = useRef(null);
    const initRef = useRef(false);

    // --- Helper: get DOM element by ID within our container ---
    const $ = useCallback((id) => {
        if (!containerRef.current) return null;
        return containerRef.current.querySelector(`#${CSS.escape(id)}`);
    }, []);

    // --- BUFF/TERRAIN LOGIC (exact copy) ---
    const processBuffs = useCallback((playerNum) => {
        let state = stateRef.current;
        let pState = playerNum === 1 ? state.p1 : state.p2;
        pState.buffs.forEach(b => {
            b.turns--;
            if (b.turns <= 0) {
                if (b.id === 'sabbia' && pState.activeCard) pState.activeCard.atk = Math.min(15, pState.activeCard.atk + b.origAtkLost);
                if (b.id === 'veleno' && pState.activeCard) { pState.activeCard.atk = Math.max(0, pState.activeCard.atk - 1); pState.activeCard.def = Math.min(15, pState.activeCard.def + 1); }
                if (b.id === 'lacrima' && pState.activeCard) { pState.activeCard.def = Math.max(0, pState.activeCard.def - 1); pState.activeCard.atk = Math.min(15, pState.activeCard.atk + 1); }
            }
        });
        pState.buffs = pState.buffs.filter(b => b.turns > 0);
    }, []);

    const applyRiflesso = useCallback((ownerState, enemyState) => {
        if (ownerState.activeCard && enemyState.activeCard) {
            enemyState.hiddenOriginalCard = JSON.parse(JSON.stringify(enemyState.activeCard));
            enemyState.activeCard.name = ownerState.activeCard.name;
            enemyState.activeCard.art = ownerState.activeCard.art;
            enemyState.activeCard.atk = ownerState.activeCard.atk;
            enemyState.activeCard.def = ownerState.activeCard.def;
            enemyState.activeCard.pa = ownerState.activeCard.pa;
            enemyState.activeCard.baseAtk = ownerState.activeCard.baseAtk;
            enemyState.activeCard.baseDef = ownerState.activeCard.baseDef;
            enemyState.activeCard.basePa = ownerState.activeCard.basePa;
            enemyState.activeCard.isCloned = true;
        }
    }, []);

    const getEffectiveStats = useCallback((playerNum) => {
        let state = stateRef.current;
        let pState = playerNum === 1 ? state.p1 : state.p2; let card = pState.activeCard;
        if (!card) return { atk: 0, def: 0, pa: 0 };
        let atk = card.atk; let def = card.def; let pa = card.pa; let t = state.activeTerrain;
        if (t) {
            if (t.id === 'catene') { atk = Math.min(atk, card.baseAtk); def = Math.min(def, card.baseDef); pa = Math.min(pa, card.basePa); }
            if (t.id === 'sonno') { atk = Math.max(0, atk - 5); }
            if (t.id === 'terremoto') { atk = Math.floor(atk / 2); def = Math.floor(def / 2); }
        }
        return { atk: Math.max(0, Math.min(15, atk)), def: Math.max(0, Math.min(15, def)), pa: Math.max(0, Math.min(5, pa)) };
    }, []);

    const getFinalStats = useCallback((playerNum) => { return getEffectiveStats(playerNum); }, [getEffectiveStats]);

    // --- RENDER FUNCTIONS (exact copy, using innerHTML) ---
    const renderCardHTML = useCallback((card, playerId = null, isZoom = false) => {
        if(!card) return '';
        let state = stateRef.current;
        const contextMenuAttr = (!isZoom && playerId) ? `oncontextmenu="return false;"` : '';
        const cardIdAttr = isZoom ? `zoom-card-${card.id}` : `card-${card.id}`;

        let extraClass = '';
        let dispAtk = card.atk; let dispDef = card.def; let dispPa = card.pa;

        if (playerId) {
            let pState = playerId === 1 ? state.p1 : state.p2;
            if (pState.buffs.some(b => b.id === 'sabbia')) extraClass += ' blinded';
            let stats = getFinalStats(playerId); dispAtk = stats.atk; dispDef = stats.def; dispPa = stats.pa;

            if (state.activeTerrain) {
                let t = state.activeTerrain;
                if (t.id === 'terremoto') extraClass += ' anim-shake-continuous';
                if (t.id === 'pioggia') extraClass += ' terrain-pioggia';
                if (t.id === 'catene') extraClass += ' terrain-catene';
                if (t.id === 'sonno') extraClass += ' terrain-sonno';
                if (t.id === 'riflesso' && playerId !== t.owner) extraClass += ' terrain-riflesso';
            }
        }

        return `
            <div class="card${extraClass}" id="${cardIdAttr}" ${contextMenuAttr} title="${isZoom ? '' : 'Tasto destro/Tieni premuto per esaminare (Tocca in Pausa)'}">
                <div class="card-header">${card.name}</div>
                <div class="card-art">${card.art}</div>
                <div class="card-stats">
                    <div class="stat"><span>ATK</span><span class="stat-val atk-val">${dispAtk}</span></div>
                    <div class="stat"><span>DEF</span><span class="stat-val def-val">${dispDef}</span></div>
                    <div class="stat"><span>PA</span><span class="stat-val pa-val">${dispPa}</span></div>
                </div>
            </div>`;
    }, [getFinalStats]);

    const renderWeaponHTML = useCallback((weapon, playerId, slotIndex) => {
        if(!weapon) return '';
        let statHTML = ''; let typeIcon = '';

        if (weapon.type === 'oggetto') {
            typeIcon = '\u2728';
            statHTML = `<div class="stat" style="grid-column: span 2;"><span class="text-[0.4rem] text-yellow-300 font-sans tracking-normal leading-tight px-1">${weapon.desc}</span></div><div class="stat" style="grid-column: span 2;"><span class="text-[0.4rem] text-yellow-500 pb-1">CU: -${weapon.cu}</span></div>`;
        } else if (weapon.type === 'terreno') {
            typeIcon = '\uD83C\uDF2A\uFE0F';
            statHTML = `<div class="stat" style="grid-column: span 2;"><span class="text-[0.4rem] text-purple-300 font-sans tracking-normal leading-tight px-1">${weapon.desc}</span></div><div class="stat" style="grid-column: span 2;"><span class="text-[0.4rem] text-purple-500 pb-1">Globale</span></div>`;
        } else {
            let statLabel = weapon.type === 'arma' ? 'ATK' : 'DEF'; let statColor = weapon.type === 'arma' ? 'text-red-500' : 'text-green-500'; typeIcon = '\u2694';
            statHTML = `<div class="stat"><span class="text-[0.4rem] ${statColor}">${statLabel}</span><span class="stat-val">+${weapon.bonus}</span></div><div class="stat"><span class="text-[0.4rem] text-yellow-500">CU</span><span class="stat-val">-${weapon.cu}</span></div>`;
        }

        return `
            <div class="mini-card" id="weapon-${playerId}-${slotIndex}" data-type="${weapon.type}"
                 title="SX/Tocca: Usa | DX/Tieni Premuto: Distruggi | CTRL+DX (O tocca in pausa): Esamina">
                <div class="mini-card-inner">
                    <div class="mini-card-cover"><div class="text-gray-500 text-5xl">${typeIcon}</div></div>
                    <div class="mini-card-face">
                        <div class="mini-card-header text-[0.35rem] leading-tight flex items-center justify-center">${weapon.name}</div>
                        <div class="mini-card-art">${weapon.art}</div>
                        <div class="mini-card-stats item-stats">${statHTML}</div>
                    </div>
                </div>
            </div>`;
    }, []);

    const renderWeaponZoomHTML = useCallback((weapon) => {
        if(!weapon) return '';
        let statHTML = ''; let borderColor = '';
        if (weapon.type === 'oggetto') { statHTML = `<div class="stat" style="grid-column: span 2;"><span class="text-[0.4rem] text-yellow-300 font-sans tracking-normal leading-tight px-1">${weapon.desc}</span></div><div class="stat" style="grid-column: span 2;"><span class="text-[0.4rem] text-yellow-500 pb-1">CU: -${weapon.cu}</span></div>`; borderColor = '#ffd700'; }
        else if (weapon.type === 'terreno') { statHTML = `<div class="stat" style="grid-column: span 2;"><span class="text-[0.4rem] text-purple-300 font-sans tracking-normal leading-tight px-1">${weapon.desc}</span></div><div class="stat" style="grid-column: span 2;"><span class="text-[0.4rem] text-purple-500 pb-1">Globale</span></div>`; borderColor = 'var(--purple)'; }
        else { let statLabel = weapon.type === 'arma' ? 'ATK' : 'DEF'; let statColor = weapon.type === 'arma' ? 'text-red-500' : 'text-green-500'; statHTML = `<div class="stat"><span class="text-[0.4rem] ${statColor}">${statLabel}</span><span class="stat-val">+${weapon.bonus}</span></div><div class="stat"><span class="text-[0.4rem] text-yellow-500">CU</span><span class="stat-val">-${weapon.cu}</span></div>`; borderColor = weapon.type === 'arma' ? 'var(--blood-red-bright)' : '#4dff4d'; }

        return `
            <div class="mini-card" style="pointer-events: none; margin: 0;">
                <div class="mini-card-face" style="transform: none; border-color: ${borderColor}; position: relative; width: 100%; height: 100%;">
                    <div class="mini-card-header text-[0.35rem] leading-tight flex items-center justify-center">${weapon.name}</div>
                    <div class="mini-card-art">${weapon.art}</div>
                    <div class="mini-card-stats item-stats">${statHTML}</div>
                </div>
            </div>`;
    }, []);

    // --- UPDATE UI (exact copy) ---
    const updateUI = useCallback(() => {
        let state = stateRef.current;
        const el = (id) => $(`${id}`);

        const p1DeckCount = el('p1-deck-count');
        const p2DeckCount = el('p2-deck-count');
        const p1WeaponCount = el('p1-weapon-count');
        const p2WeaponCount = el('p2-weapon-count');
        if (p1DeckCount) p1DeckCount.innerText = `${state.p1.cardsLeft}/5`;
        if (p2DeckCount) p2DeckCount.innerText = `${state.p2.cardsLeft}/5`;
        if (p1WeaponCount) p1WeaponCount.innerText = `${state.p1.weaponsLeft}/45`;
        if (p2WeaponCount) p2WeaponCount.innerText = `${state.p2.weaponsLeft}/45`;

        const p1Slot = el('p1-slot');
        const p2Slot = el('p2-slot');
        if (p1Slot) p1Slot.innerHTML = state.p1.activeCard ? renderCardHTML(state.p1.activeCard, 1) : '';
        if (p2Slot) p2Slot.innerHTML = state.p2.activeCard ? renderCardHTML(state.p2.activeCard, 2) : '';

        for(let i=0; i<3; i++) {
            const p1w = el(`p1-wslot-${i}`);
            const p2w = el(`p2-wslot-${i}`);
            if (p1w) p1w.innerHTML = state.p1.weaponSlots[i] ? renderWeaponHTML(state.p1.weaponSlots[i], 1, i) : '';
            if (p2w) p2w.innerHTML = state.p2.weaponSlots[i] ? renderWeaponHTML(state.p2.weaponSlots[i], 2, i) : '';
        }

        const tInd = el('turn-indicator');
        const s1 = el('p1-section');
        const s2 = el('p2-section');

        if (state.turn === 1) {
            if (tInd) { tInd.innerText = "TURNO: GIOCATORE 1"; tInd.classList.replace('text-blue-500', 'text-red-500'); }
            if (s1) s1.classList.add('active-player-glow'); if (s2) s2.classList.remove('active-player-glow');
            const p1Deck = el('p1-deck');
            const p1WeaponDeck = el('p1-weapon-deck');
            if (p1Deck) p1Deck.classList.toggle('disabled', state.p1.activeCard !== null || state.p1.cardsLeft === 0);
            if (p1WeaponDeck) p1WeaponDeck.classList.toggle('disabled', state.p1.hasDrawnWeapon || state.p1.weaponsLeft === 0 || !state.p1.weaponSlots.includes(null));
            const p2Deck = el('p2-deck');
            const p2WeaponDeck = el('p2-weapon-deck');
            if (p2Deck) p2Deck.classList.add('disabled'); if (p2WeaponDeck) p2WeaponDeck.classList.add('disabled');

            const btnAtk = el('btn-atk-1');
            const btnEnd = el('btn-end-1');
            if (btnAtk) btnAtk.disabled = state.isInitializing || state.isPaused || (!state.p1.activeCard || state.hasAttacked);
            if (btnEnd) btnEnd.disabled = state.isInitializing || state.isPaused || (!state.p1.activeCard);
        } else {
            if (tInd) { tInd.innerText = "TURNO: GIOCATORE 2 (IA)"; tInd.classList.replace('text-red-500', 'text-blue-500'); }
            if (s2) s2.classList.add('active-player-glow'); if (s1) s1.classList.remove('active-player-glow');
            const p2Deck = el('p2-deck');
            const p2WeaponDeck = el('p2-weapon-deck');
            const p1Deck = el('p1-deck');
            const p1WeaponDeck = el('p1-weapon-deck');
            if (p2Deck) p2Deck.classList.add('disabled'); if (p2WeaponDeck) p2WeaponDeck.classList.add('disabled');
            if (p1Deck) p1Deck.classList.add('disabled'); if (p1WeaponDeck) p1WeaponDeck.classList.add('disabled');
            const btnAtk = el('btn-atk-1');
            const btnEnd = el('btn-end-1');
            if (btnAtk) btnAtk.disabled = true; if (btnEnd) btnEnd.disabled = true;
        }

        // Re-bind weapon click handlers after innerHTML update
        rebindWeaponHandlers();
        rebindKnightHandlers();
    }, [$, renderCardHTML, renderWeaponHTML]);

    // --- SHATTER CARD (exact copy) ---
    const shatterCard = useCallback((cardEl) => {
        playSound('shatter'); const parent = cardEl.parentElement; cardEl.style.opacity = '0';
        const colors = ['#1a1a1a', '#8a0303', '#ff0000', '#000000', '#e2d1a3', '#8b4513'];
        for(let i = 0; i < 40; i++) {
            let p = document.createElement('div'); p.className = 'pixel-particle'; p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            p.style.left = `calc(50% + ${(Math.random() - 0.5) * 100}px)`; p.style.top = `calc(50% + ${(Math.random() - 0.5) * 150}px)`;
            p.style.setProperty('--tx', `${(Math.random() - 0.5) * 400}px`); p.style.setProperty('--ty', `${(Math.random() - 0.5) * 400}px`);
            p.style.setProperty('--rot', `${Math.random() * 360}deg`); parent.appendChild(p);
            setTimeout(() => p.remove(), 600);
        }
    }, []);

    // --- ANIMATE DRAW (exact copy) ---
    const animateDraw = useCallback((deckId, targetId) => {
        const deckEl = $(deckId); const targetEl = $(targetId);
        if (deckEl && targetEl) {
            const dRect = deckEl.getBoundingClientRect(); const tRect = targetEl.getBoundingClientRect();
            const tx = dRect.left + dRect.width/2 - (tRect.left + tRect.width/2); const ty = dRect.top + dRect.height/2 - (tRect.top + tRect.height/2);
            targetEl.style.setProperty('--start-x', `${tx}px`); targetEl.style.setProperty('--start-y', `${ty}px`);
            targetEl.classList.add('anim-draw-dynamic');
            setTimeout(() => { if (targetEl) targetEl.classList.remove('anim-draw-dynamic'); }, 400);
        }
    }, [$]);

    // --- TRIGGER ERROR (exact copy) ---
    const triggerError = useCallback((elId) => { playSound('error'); const el = $(elId); if (el) { el.classList.add('anim-error'); setTimeout(() => el.classList.remove('anim-error'), 300); } }, [$]);

    // --- ZOOM FUNCTIONS ---
    const closeZoom = useCallback(() => {
        const zoomOverlay = $('zoom-overlay'); const zoomContainer = $('zoom-container');
        if (!zoomOverlay || !zoomContainer) return;
        zoomOverlay.classList.remove('opacity-100'); zoomOverlay.classList.add('opacity-0');
        zoomContainer.style.transform = `translate(${zoomOriginRef.current.x}px, ${zoomOriginRef.current.y}px) scale(1)`;
        setTimeout(() => { zoomOverlay.classList.add('hidden'); zoomOverlay.classList.remove('flex'); zoomContainer.innerHTML = ''; }, 300);
    }, [$]);

    const zoomWeapon = useCallback((playerNum, slotIndex) => {
        let state = stateRef.current;
        let p = playerNum === 1 ? state.p1 : state.p2; let weapon = p.weaponSlots[slotIndex]; if (!weapon) return;
        const sourceCard = $(`weapon-${playerNum}-${slotIndex}`); if (!sourceCard) return;
        const rect = sourceCard.getBoundingClientRect(); zoomOriginRef.current.x = (rect.left + rect.width / 2) - window.innerWidth / 2; zoomOriginRef.current.y = (rect.top + rect.height / 2) - window.innerHeight / 2;
        const zoomOverlay = $('zoom-overlay'); const zoomContainer = $('zoom-container');
        if (!zoomOverlay || !zoomContainer) return;
        zoomContainer.innerHTML = renderWeaponZoomHTML(weapon); zoomContainer.style.transition = 'none'; zoomContainer.style.transform = `translate(${zoomOriginRef.current.x}px, ${zoomOriginRef.current.y}px) scale(1)`;
        zoomOverlay.classList.remove('hidden'); zoomOverlay.classList.add('flex'); void zoomOverlay.offsetWidth;
        zoomContainer.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; zoomOverlay.classList.remove('opacity-0'); zoomOverlay.classList.add('opacity-100');
        zoomContainer.style.transform = `translate(0px, 0px) scale(${window.innerWidth < 768 ? 2.2 : 3.5})`;
    }, [$, renderWeaponZoomHTML]);

    const handleRightClick = useCallback((event, playerId) => {
        let state = stateRef.current;
        if (state.isPaused && !event.ctrlKey) return;
        event.preventDefault(); let card = playerId === 1 ? state.p1.activeCard : state.p2.activeCard; if (!card) return;
        const sourceCard = $(`card-${card.id}`); if (!sourceCard) return;
        const rect = sourceCard.getBoundingClientRect(); zoomOriginRef.current.x = (rect.left + rect.width / 2) - window.innerWidth / 2; zoomOriginRef.current.y = (rect.top + rect.height / 2) - window.innerHeight / 2;
        const zoomOverlay = $('zoom-overlay'); const zoomContainer = $('zoom-container');
        if (!zoomOverlay || !zoomContainer) return;
        zoomContainer.innerHTML = renderCardHTML(card, null, true); zoomContainer.style.transition = 'none'; zoomContainer.style.transform = `translate(${zoomOriginRef.current.x}px, ${zoomOriginRef.current.y}px) scale(1)`;
        zoomOverlay.classList.remove('hidden'); zoomOverlay.classList.add('flex'); void zoomOverlay.offsetWidth;
        zoomContainer.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; zoomOverlay.classList.remove('opacity-0'); zoomOverlay.classList.add('opacity-100');
        zoomContainer.style.transform = `translate(0px, 0px) scale(1.5)`;
    }, [$, renderCardHTML]);

    const handleKnightClick = useCallback((playerId) => {
        let state = stateRef.current;
        if (state.isPaused) {
            handleRightClick({ preventDefault: () => {} }, playerId);
        }
    }, [handleRightClick]);

    // --- ACTIVATE TERRAIN (exact copy) ---
    const activateTerrain = useCallback((terrainCard, playerNum) => {
        let state = stateRef.current;
        return new Promise(resolve => {
            playSound('terrain'); state.activeTerrain = { id: terrainCard.itemId, turns: 3, owner: playerNum, card: terrainCard };
            const overlay = $('terrain-overlay'); const container = $('terrain-container');
            if (!overlay || !container) { resolve(); return; }
            container.innerHTML = renderWeaponZoomHTML(terrainCard);
            overlay.classList.remove('hidden'); overlay.classList.add('flex'); void overlay.offsetWidth; overlay.classList.remove('opacity-0'); overlay.classList.add('opacity-100');
            if (terrainCard.itemId === 'pioggia') { if (state.p1.activeCard) state.p1.activeCard.def = Math.min(15, state.p1.activeCard.def + 2); if (state.p2.activeCard) state.p2.activeCard.def = Math.min(15, state.p2.activeCard.def + 2); }
            if (terrainCard.itemId === 'riflesso') { let ownerState = playerNum === 1 ? state.p1 : state.p2; let enemyState = playerNum === 1 ? state.p2 : state.p1; applyRiflesso(ownerState, enemyState); }
            updateUI();
            const btnContinue = $('btn-terrain-continue');
            if (btnContinue) {
                btnContinue.onclick = () => { overlay.classList.remove('opacity-100'); overlay.classList.add('opacity-0'); setTimeout(() => { overlay.classList.add('hidden'); overlay.classList.remove('flex'); resolve(); }, 500); };
            } else { resolve(); }
        });
    }, [$, renderWeaponZoomHTML, applyRiflesso, updateUI]);

    // --- DRAW CARD (exact copy) ---
    const drawCard = useCallback((playerNum, force = false) => {
        let state = stateRef.current;
        if (state.isPaused) return;
        let pState = playerNum === 1 ? state.p1 : state.p2;
        if (!force && (state.turn !== playerNum || state.gameOver || state.isInitializing || pState.activeCard || pState.cardsLeft <= 0)) return;
        let card = pState.deck.pop(); pState.cardsLeft--; pState.activeCard = card;
        if (state.activeTerrain && state.activeTerrain.id === 'pioggia') pState.activeCard.def = Math.min(15, pState.activeCard.def + 2);
        if (state.activeTerrain && state.activeTerrain.id === 'riflesso' && playerNum !== state.activeTerrain.owner) { let ownerState = state.activeTerrain.owner === 1 ? state.p1 : state.p2; applyRiflesso(ownerState, pState); }
        playSound('draw'); updateUI(); animateDraw(`p${playerNum}-deck`, `card-${card.id}`);
    }, [applyRiflesso, updateUI, animateDraw]);

    // --- DRAW SINGLE WEAPON (exact copy) ---
    const drawSingleWeaponRef = useRef(null);
    const drawSingleWeapon = useCallback(async (playerNum, targetSlotIndex) => {
        let state = stateRef.current;
        let p = playerNum === 1 ? state.p1 : state.p2;
        if (p.weaponsLeft > 0 && !p.buffs.some(b => b.id === 'noDraw')) {
            let card = p.weaponDeck.pop(); p.weaponsLeft--;
            if (card.type === 'terreno') { await activateTerrain(card, playerNum); if (drawSingleWeaponRef.current) drawSingleWeaponRef.current(playerNum, targetSlotIndex); }
            else { p.weaponSlots[targetSlotIndex] = card; playSound('draw'); updateUI(); animateDraw(`p${playerNum}-weapon-deck`, `weapon-${playerNum}-${targetSlotIndex}`); }
        }
    }, [activateTerrain, updateUI, animateDraw]);
    drawSingleWeaponRef.current = drawSingleWeapon;

    // --- DRAW WEAPON (exact copy) ---
    const drawWeapon = useCallback((playerNum) => {
        let state = stateRef.current;
        if (state.isPaused) return; let p = playerNum === 1 ? state.p1 : state.p2;
        if (state.turn !== playerNum || state.gameOver || state.isInitializing || p.hasDrawnWeapon || p.weaponsLeft <= 0) return;
        if (p.buffs.some(b => b.id === 'noDraw')) { triggerError(`p${playerNum}-weapon-deck`); return; }
        let emptySlots = p.weaponSlots.map((s, i) => s === null ? i : -1).filter(i => i !== -1); if (emptySlots.length === 0) return;
        p.hasDrawnWeapon = true; let slotFillIndex = 0;

        async function processNextDraw() {
            if (slotFillIndex >= emptySlots.length || p.weaponsLeft <= 0) return;
            let card = p.weaponDeck.pop(); p.weaponsLeft--;
            if (card.type === 'terreno') { await activateTerrain(card, playerNum); processNextDraw(); }
            else { let slotIndex = emptySlots[slotFillIndex]; p.weaponSlots[slotIndex] = card; playSound('draw'); updateUI(); animateDraw(`p${playerNum}-weapon-deck`, `weapon-${playerNum}-${slotIndex}`); slotFillIndex++; setTimeout(() => processNextDraw(), 300); }
        }
        processNextDraw();
    }, [activateTerrain, triggerError, updateUI, animateDraw]);

    // --- CHECK WIN CONDITION & GAME OVER ---
    const showGameOver = useCallback(async (message) => {
        let state = stateRef.current;
        state.gameOver = true;
        const winnerText = $('winner-text');
        const gameOverScreen = $('game-over-screen');
        if (winnerText) winnerText.innerText = message;
        if (gameOverScreen) { gameOverScreen.classList.remove('hidden'); gameOverScreen.classList.add('flex'); }

        // Record ELO result
        if (user) {
            let outcome = 'draw';
            if (message.includes('GIOCATORE 1 TRIONFA')) outcome = 'win';
            else if (message.includes('GIOCATORE 2 TRIONFA')) outcome = 'loss';
            await recordGameResult(user.id, outcome);
            refreshProfile();
        }
    }, [$, user, refreshProfile]);

    // --- ABANDON GAME ---
    const abandonGame = useCallback(async () => {
        let state = stateRef.current;
        if (state.gameOver) { navigate('/lobby'); return; }
        state.gameOver = true;
        state.isPaused = false;
        const pauseMenu = $('pause-menu');
        if (pauseMenu) { pauseMenu.classList.add('hidden'); pauseMenu.classList.remove('flex'); }
        if (user) {
            await recordGameResult(user.id, 'abandon');
            refreshProfile();
        }
        navigate('/lobby');
    }, [$, user, refreshProfile, navigate]);

    const checkWinCondition = useCallback(() => {
        let state = stateRef.current;
        let p1Lost = (state.p1.activeCard === null && state.p1.cardsLeft === 0);
        let p2Lost = (state.p2.activeCard === null && state.p2.cardsLeft === 0);
        if (p1Lost && p2Lost) showGameOver("PAREGGIO! Entrambi sono caduti.");
        else if (p1Lost) showGameOver("IL GIOCATORE 2 TRIONFA!");
        else if (p2Lost) showGameOver("IL GIOCATORE 1 TRIONFA!");
    }, [showGameOver]);

    // --- EQUIP WEAPON (exact copy) ---
    const equipWeaponRef = useRef(null);
    const equipWeapon = useCallback((playerNum, slotIndex) => {
        let state = stateRef.current;
        if (state.isPaused) { zoomWeapon(playerNum, slotIndex); return; }
        if (state.turn !== playerNum || state.gameOver || state.isInitializing) return;
        let p = playerNum === 1 ? state.p1 : state.p2; let enemyNum = playerNum === 1 ? 2 : 1; let enemy = enemyNum === 1 ? state.p1 : state.p2;
        let weapon = p.weaponSlots[slotIndex]; let knight = p.activeCard; let eKnight = enemy.activeCard;
        if (!weapon) return; if (!knight || knight.pa < weapon.cu) { triggerError(`weapon-${playerNum}-${slotIndex}`); return; }
        if (weapon.type === 'scudo' && p.buffs.some(b => b.id === 'noDefBoost')) { triggerError(`weapon-${playerNum}-${slotIndex}`); return; }
        if (weapon.type === 'oggetto' && (weapon.itemId === 'sabbia' || weapon.itemId === 'afferra' || weapon.itemId === 'sottrai' || weapon.itemId === 'sangue') && !eKnight) { triggerError(`weapon-${playerNum}-${slotIndex}`); return; }

        knight.pa -= weapon.cu; let auraClass = '';
        if (weapon.type === 'arma') { let actualBonus = Math.min(15 - knight.atk, weapon.bonus); knight.atk += actualBonus; p.weaponAtkGainedThisTurn += actualBonus; playSound('weapon'); auraClass = 'anim-aura-red'; }
        else if (weapon.type === 'scudo') { knight.def = Math.min(15, knight.def + weapon.bonus); playSound('shield'); auraClass = 'anim-aura-green'; }
        else if (weapon.type === 'oggetto') { playSound('item'); auraClass = 'anim-aura-gold';
            switch(weapon.itemId) {
                case 'ampolla': knight.def = Math.min(15, knight.def + 5); break; case 'sidro': knight.pa = Math.min(5, knight.pa + 3); break;
                case 'sabbia': { let lostAtk = Math.ceil(eKnight.atk / 2); eKnight.atk -= lostAtk; enemy.buffs.push({ id: 'sabbia', turns: 2, origAtkLost: lostAtk }); enemy.buffs.push({ id: 'noAttack', turns: 2 }); break; }
                case 'afferra': if (enemy.lastTurnWeaponAtk > 0) eKnight.atk = Math.max(0, eKnight.atk - enemy.lastTurnWeaponAtk); break;
                case 'veleno': knight.atk = Math.min(15, knight.atk + 1); knight.def = Math.max(0, knight.def - 1); p.buffs.push({ id: 'veleno', turns: 3 }); break;
                case 'lacrima': knight.def = Math.min(15, knight.def + 1); knight.atk = Math.max(0, knight.atk - 1); p.buffs.push({ id: 'lacrima', turns: 3 }); break;
                case 'sangue': knight.def = Math.max(0, knight.def - 5); enemy.buffs.push({ id: 'noDefBoost', turns: 999 }); break;
                case 'fortuna': setTimeout(() => drawSingleWeaponRef.current(playerNum, slotIndex), 450); break;
                case 'sacrificio': knight.atk = 15; knight.def = 15; knight.pa = 0; p.buffs.push({ id: 'noDraw', turns: 3 }); p.weaponSlots.forEach((w, i) => { if (w && i !== slotIndex) { let wEl = $(`weapon-${playerNum}-${i}`); if (wEl) shatterCard(wEl); p.weaponSlots[i] = null; } }); break;
                case 'sottrai': p.buffs.push({ id: 'noAttack', turns: 1 }); { let filled = enemy.weaponSlots.map((w,i) => w ? i : -1).filter(i => i !== -1); if (filled.length > 0) { let target = filled[Math.floor(Math.random() * filled.length)]; let wEl = $(`weapon-${enemyNum}-${target}`); if (wEl) shatterCard(wEl); enemy.weaponSlots[target] = null; } } break;
            }
        }

        let weaponEl = $(`weapon-${playerNum}-${slotIndex}`); let knightEl = $(`card-${knight.id}`);
        if (weaponEl && knightEl) {
            let wRect = weaponEl.getBoundingClientRect(); let kRect = knightEl.getBoundingClientRect();
            weaponEl.style.setProperty('--tx', `${(kRect.left + kRect.width/2) - (wRect.left + wRect.width/2)}px`); weaponEl.style.setProperty('--ty', `${(kRect.top + kRect.height/2) - (wRect.top + wRect.height/2)}px`);
            weaponEl.classList.add('anim-equip');
            setTimeout(() => { p.weaponSlots[slotIndex] = null; knightEl.classList.add(auraClass); updateUI();
                let currentKnightEl = $(`card-${knight.id}`);
                if(currentKnightEl) {
                    let statSpan = currentKnightEl.querySelector(weapon.type === 'arma' ? '.atk-val' : '.def-val'); let paSpan = currentKnightEl.querySelector('.pa-val');
                    let flashColor = weapon.type === 'arma' ? '#ff0000' : (weapon.type === 'scudo' ? '#4dff4d' : '#ffd700');
                    if(statSpan) statSpan.style.color = flashColor; if(paSpan) paSpan.style.color = '#ff0000';
                    setTimeout(() => { if(statSpan) statSpan.style.color = ''; if(paSpan) paSpan.style.color = ''; if(currentKnightEl) currentKnightEl.classList.remove(auraClass); }, 600);
                }
            }, 400);
        }
    }, [$, zoomWeapon, triggerError, shatterCard, updateUI]);
    equipWeaponRef.current = equipWeapon;

    // --- DISCARD WEAPON (exact copy) ---
    const discardWeaponRef = useRef(null);
    const discardWeapon = useCallback((event, playerNum, slotIndex) => {
        let state = stateRef.current;
        if (state.isPaused) return; event.preventDefault();
        if (event.ctrlKey || event.metaKey) { zoomWeapon(playerNum, slotIndex); return; }
        if (state.turn !== playerNum || state.gameOver || state.isInitializing) return;
        let p = playerNum === 1 ? state.p1 : state.p2; let weapon = p.weaponSlots[slotIndex]; if (!weapon) return;
        let weaponEl = $(`weapon-${playerNum}-${slotIndex}`);
        if (weaponEl) {
            shatterCard(weaponEl); p.weaponSlots[slotIndex] = null;
            setTimeout(() => { if (!p.hasUsedRedraw && p.weaponsLeft > 0) { p.hasUsedRedraw = true; drawSingleWeaponRef.current(playerNum, slotIndex); } else { updateUI(); } }, 600);
        }
    }, [$, zoomWeapon, shatterCard, updateUI]);
    discardWeaponRef.current = discardWeapon;

    // --- END TURN (exact copy) ---
    const endTurnRef = useRef(null);
    const endTurn = useCallback((playerNum) => {
        let state = stateRef.current;
        if (state.isPaused) return; if (state.turn !== playerNum || state.gameOver) return;
        let pState = playerNum === 1 ? state.p1 : state.p2; if (!pState.activeCard) return;

        pState.lastTurnWeaponAtk = pState.weaponAtkGainedThisTurn; pState.weaponAtkGainedThisTurn = 0;
        state.turn = state.turn === 1 ? 2 : 1; state.hasAttacked = false;
        state.p1.hasDrawnWeapon = false; state.p2.hasDrawnWeapon = false; state.p1.hasUsedRedraw = false; state.p2.hasUsedRedraw = false;

        processBuffs(state.turn);

        if (state.activeTerrain && state.activeTerrain.owner === state.turn) {
            state.activeTerrain.turns--;
            if (state.activeTerrain && state.activeTerrain.id === 'pioggia' && state.activeTerrain.turns > 0) { if (state.p1.activeCard) state.p1.activeCard.def = Math.min(15, state.p1.activeCard.def + 2); if (state.p2.activeCard) state.p2.activeCard.def = Math.min(15, state.p2.activeCard.def + 2); playSound('shield'); }
            if (state.activeTerrain.turns <= 0) {
                if (state.activeTerrain.id === 'riflesso') {
                    let enemyState = state.activeTerrain.owner === 1 ? state.p2 : state.p1;
                    if (enemyState.activeCard && enemyState.activeCard.isCloned && enemyState.hiddenOriginalCard) {
                        let orig = enemyState.hiddenOriginalCard; orig.def = Math.min(orig.def, enemyState.activeCard.def); enemyState.activeCard.name = orig.name; enemyState.activeCard.art = orig.art; enemyState.activeCard.atk = orig.atk; enemyState.activeCard.def = orig.def; enemyState.activeCard.pa = orig.pa; enemyState.activeCard.baseAtk = orig.baseAtk; enemyState.activeCard.baseDef = orig.baseDef; enemyState.activeCard.basePa = orig.basePa; enemyState.activeCard.isCloned = false;
                    }
                }
                state.activeTerrain = null;
            }
        }
        updateUI();
        if (state.turn === 2) {
            playAITurnRef.current();
        } else {
            // Safety: ensure P1 buttons are re-enabled after AI turn ends
            setTimeout(() => {
                if (!stateRef.current.gameOver && stateRef.current.turn === 1) updateUI();
            }, 100);
        }
    }, [processBuffs, updateUI]);
    endTurnRef.current = endTurn;

    // --- ATTACK (exact copy) ---
    const attack = useCallback((playerNum) => {
        let state = stateRef.current;
        if (state.isPaused) return;
        if (state.turn !== playerNum || state.hasAttacked || state.gameOver || state.isInitializing) return;
        let attacker = playerNum === 1 ? state.p1 : state.p2; let defenderNum = playerNum === 1 ? 2 : 1; let defender = playerNum === 1 ? state.p2 : state.p1;
        if (!attacker.activeCard) return; if (attacker.buffs.some(b => b.id === 'noAttack' || b.id === 'sabbia')) { triggerError(`card-${attacker.activeCard.id}`); return; }

        if (playerNum === 1) { const btnAtk = $('btn-atk-1'); const btnEnd = $('btn-end-1'); if (btnAtk) btnAtk.disabled = true; if (btnEnd) btnEnd.disabled = true; }
        const atkCardEl = $(`card-${attacker.activeCard.id}`); let isSlow = state.activeTerrain && state.activeTerrain.id === 'sonno'; let animDur = isSlow ? 1500 : 500;

        if (atkCardEl) { atkCardEl.style.animationDuration = `${animDur}ms`; atkCardEl.classList.add(`anim-attack-p${playerNum}`); }
        setTimeout(() => { if (atkCardEl) { atkCardEl.classList.remove(`anim-attack-p${playerNum}`); atkCardEl.style.animationDuration = ''; } }, animDur);
        state.hasAttacked = true;

        if (defender.activeCard) {
            setTimeout(() => {
                playSound('damage');
                let attackerStats = getFinalStats(playerNum); let damage = attackerStats.atk; let underlyingDamage = damage;
                if (state.activeTerrain && state.activeTerrain.id === 'terremoto') underlyingDamage = damage * 2;
                defender.activeCard.def -= underlyingDamage;
                const defCardEl = $(`card-${defender.activeCard.id}`);
                if(defCardEl) { const defValEl = defCardEl.querySelector('.def-val'); if (defValEl) defValEl.innerText = Math.max(0, getFinalStats(defenderNum).def); defCardEl.classList.add('anim-damage'); }

                if (getFinalStats(defenderNum).def <= 0) {
                    defender.activeCard.def = 0;
                    setTimeout(() => { if(defCardEl) { shatterCard(defCardEl); defender.buffs = []; setTimeout(() => { defender.activeCard = null; updateUI(); checkWinCondition(); if (!state.gameOver) endTurnRef.current(playerNum); }, 600); } }, 500);
                } else { setTimeout(() => { if(defCardEl) defCardEl.classList.remove('anim-damage'); updateUI(); if (!state.gameOver) endTurnRef.current(playerNum); }, 500); }
            }, animDur / 2);
        } else { setTimeout(() => { updateUI(); if (!state.gameOver) endTurnRef.current(playerNum); }, animDur); }
    }, [$, getFinalStats, triggerError, shatterCard, updateUI, checkWinCondition]);

    // --- AI TURN (exact copy) ---
    const checkPause = useCallback(async () => { while (stateRef.current.isPaused) await wait(200); }, []);

    const playAITurnRef = useRef(null);
    const playAITurn = useCallback(async () => {
        let state = stateRef.current;
        if (state.gameOver) return; await wait(1000); await checkPause(); if (state.gameOver) return;
        if (!state.p2.activeCard && state.p2.cardsLeft > 0) { drawCard(2); await wait(1000); await checkPause(); }
        if (state.gameOver) return;
        if (!state.p2.hasDrawnWeapon && state.p2.weaponsLeft > 0 && state.p2.weaponSlots.includes(null) && !state.p2.buffs.some(b => b.id === 'noDraw')) {
            let emptyCount = state.p2.weaponSlots.filter(s => s === null).length; drawWeapon(2); await wait(emptyCount * 400 + 800); await checkPause();
            const terrainOverlay = $('terrain-overlay');
            while(terrainOverlay && terrainOverlay.classList.contains('flex')) { await wait(500); await checkPause(); }
        }
        if (state.gameOver) return;
        if (!state.p2.hasUsedRedraw && state.p2.activeCard) {
            let uselessSlot = state.p2.weaponSlots.findIndex(w => w !== null && w.cu > state.p2.activeCard.pa);
            if (uselessSlot !== -1) { discardWeaponRef.current({preventDefault: () => {}}, 2, uselessSlot); await wait(1500); await checkPause();
                const terrainOverlay = $('terrain-overlay');
                while(terrainOverlay && terrainOverlay.classList.contains('flex')) { await wait(500); await checkPause(); }
            }
        }
        if (state.p2.activeCard) {
            for (let i = 0; i < 3; i++) {
                let w = state.p2.weaponSlots[i];
                if (w && state.p2.activeCard.pa >= w.cu) {
                    if (w.type === 'oggetto' && (w.itemId === 'sabbia' || w.itemId === 'afferra' || w.itemId === 'sottrai' || w.itemId === 'sangue') && !state.p1.activeCard) continue;
                    equipWeaponRef.current(2, i); await wait(800); await checkPause();
                    const terrainOverlay = $('terrain-overlay');
                    while(terrainOverlay && terrainOverlay.classList.contains('flex')) { await wait(500); await checkPause(); }
                }
            }
        }
        if (state.gameOver) return;
        if (state.p2.activeCard && state.p1.activeCard && !state.hasAttacked && !state.p2.buffs.some(b => b.id === 'noAttack' || b.id === 'sabbia')) { attack(2); } else { endTurnRef.current(2); }
    }, [$, checkPause, drawCard, drawWeapon, attack]);
    playAITurnRef.current = playAITurn;

    // --- PAUSE & TUTORIAL ---
    const togglePause = useCallback(() => {
        let state = stateRef.current;
        if (state.gameOver || state.isInitializing) return;
        state.isPaused = !state.isPaused;
        const pauseMenu = $('pause-menu');
        if (!pauseMenu) return;
        if (state.isPaused) {
            pauseMenu.classList.remove('hidden'); pauseMenu.classList.add('flex');
        } else {
            pauseMenu.classList.add('hidden'); pauseMenu.classList.remove('flex');
        }
        updateUI();
    }, [$, updateUI]);

    const showTutorial = useCallback(() => {
        const pauseMenu = $('pause-menu');
        const tutorialOverlay = $('tutorial-overlay');
        if (pauseMenu) { pauseMenu.classList.add('hidden'); pauseMenu.classList.remove('flex'); }
        if (tutorialOverlay) { tutorialOverlay.classList.remove('hidden'); tutorialOverlay.classList.add('flex'); }
    }, [$]);

    const hideTutorial = useCallback(() => {
        let state = stateRef.current;
        const tutorialOverlay = $('tutorial-overlay');
        if (tutorialOverlay) { tutorialOverlay.classList.add('hidden'); tutorialOverlay.classList.remove('flex'); }
        if (state.isPaused) {
            const pauseMenu = $('pause-menu');
            if (pauseMenu) { pauseMenu.classList.remove('hidden'); pauseMenu.classList.add('flex'); }
        }
    }, [$]);

    // --- RE-BIND EVENT HANDLERS (after innerHTML updates) ---
    const rebindWeaponHandlers = useCallback(() => {
        if (!containerRef.current) return;
        for (let playerNum = 1; playerNum <= 2; playerNum++) {
            for (let i = 0; i < 3; i++) {
                const el = $(`weapon-${playerNum}-${i}`);
                if (el) {
                    el.onclick = () => equipWeaponRef.current(playerNum, i);
                    el.oncontextmenu = (e) => discardWeaponRef.current(e, playerNum, i);
                }
            }
        }
    }, [$]);

    const rebindKnightHandlers = useCallback(() => {
        if (!containerRef.current) return;
        let state = stateRef.current;
        for (let playerNum = 1; playerNum <= 2; playerNum++) {
            let pState = playerNum === 1 ? state.p1 : state.p2;
            if (pState.activeCard) {
                const el = $(`card-${pState.activeCard.id}`);
                if (el) {
                    el.onclick = () => handleKnightClick(playerNum);
                    el.oncontextmenu = (e) => handleRightClick(e, playerNum);
                }
            }
        }
    }, [$, handleKnightClick, handleRightClick]);

    // --- INIT GAME (exact copy) ---
    const initGame = useCallback(async () => {
        let state = stateRef.current;
        state.turn = 1; state.hasAttacked = false; state.gameOver = false; state.isInitializing = true; state.isPaused = false;
        state.activeTerrain = null;
        ['p1', 'p2'].forEach(p => { state[p].deck = createDeck(generateCard, 5); state[p].weaponDeck = generateEquipmentDeck(); state[p].cardsLeft = 5; state[p].weaponsLeft = 45; state[p].activeCard = null; state[p].weaponSlots = [null, null, null]; state[p].hasDrawnWeapon = false; state[p].hasUsedRedraw = false; state[p].buffs = []; state[p].weaponAtkGainedThisTurn = 0; state[p].lastTurnWeaponAtk = 0; });
        const gameOverScreen = $('game-over-screen');
        if (gameOverScreen) gameOverScreen.classList.add('hidden');
        updateUI(); await wait(500); drawCard(1, true); await wait(600); drawCard(2, true); await wait(400);
        state.isInitializing = false; updateUI();
    }, [$, updateUI, drawCard]);

    // --- KEYBOARD HANDLER ---
    useEffect(() => {
        const handler = (e) => {
            let state = stateRef.current;
            const tutorialOverlay = $('tutorial-overlay');
            if (e.key === 'Escape' || e.key === 'Esc') {
                if (tutorialOverlay && !tutorialOverlay.classList.contains('hidden')) {
                    hideTutorial();
                } else if (!state.gameOver && !state.isInitializing) {
                    togglePause();
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [$, hideTutorial, togglePause]);

    // --- MOUNT: init game ---
    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;
        // Small delay to allow DOM to render
        setTimeout(() => initGame(), 100);
    }, [initGame]);

    // --- RENDER (exact HTML structure from A&Wmobile.html) ---
    return (
        <div ref={containerRef} className="game-page h-screen flex flex-col" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            {/* Header */}
            <header className="py-2 md:py-4 border-b-2 border-red-900 bg-black/60 relative z-10 flex flex-row items-center justify-between px-4 md:px-8">
                <button className="btn text-[0.4rem] md:text-sm px-3 md:px-4 py-2" onClick={togglePause}>{'\u2699\uFE0F'} MENU</button>
                <div className="flex flex-col items-center flex-grow">
                    <h1 className="text-xl md:text-4xl text-red-700 frazetta-title mb-1 md:mb-2 tracking-widest leading-none">Cavalieri Oscuri</h1>
                    <span id="turn-indicator" className="text-[0.55rem] md:text-2xl font-bold text-red-500">TURNO: GIOCATORE 1</span>
                </div>
                <div className="w-[60px] md:w-[100px]"></div>
            </header>

            {/* Campo di Battaglia */}
            <main className="flex-grow flex flex-col-reverse md:flex-row relative z-10">
                {/* GIOCATORE 1 */}
                <section id="p1-section" className="w-full md:w-1/2 flex flex-col justify-between p-2 md:p-6 active-player-glow transition-all duration-500">
                    <h2 className="text-sm md:text-2xl text-gray-400 text-center frazetta-title mb-2 md:mb-4">Giocatore 1</h2>
                    <div className="flex flex-col md:flex-row items-center justify-around flex-grow w-full gap-4 md:gap-0">
                        <div className="flex flex-row md:flex-col items-center gap-4 md:gap-8">
                            <div id="p1-deck" className="deck" onClick={() => drawCard(1)}>
                                <div className="text-center">
                                    <div className="text-red-900 text-5xl mb-1 md:mb-2">{'\u2660'}</div>
                                    <div className="font-bold text-gray-300 deck-label" style={{fontSize:'0.6rem'}}>MAZZO</div>
                                    <div id="p1-deck-count" className="deck-count text-2xl mt-1 md:mt-2 text-yellow-600">5/5</div>
                                </div>
                            </div>
                            <div id="p1-weapon-deck" className="deck" onClick={() => drawWeapon(1)}>
                                <div className="text-center">
                                    <div className="text-gray-500 text-5xl mb-1 md:mb-2">{'\u2694'}</div>
                                    <div className="font-bold text-gray-300 deck-label" style={{fontSize:'0.6rem'}}>RASTRELLIERA</div>
                                    <div id="p1-weapon-count" className="deck-count text-2xl mt-1 md:mt-2 text-yellow-600">45/45</div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-row items-center gap-2 md:gap-4">
                            <div className="flex flex-col gap-1 md:gap-2">
                                <div id="p1-wslot-0" className="slot-area slot-weapon"></div>
                                <div id="p1-wslot-1" className="slot-area slot-weapon"></div>
                                <div id="p1-wslot-2" className="slot-area slot-weapon"></div>
                            </div>
                            <div id="p1-slot" className="slot-area slot-knight"></div>
                        </div>
                    </div>
                    <div className="flex justify-center gap-2 md:gap-4 mt-4 md:mt-6">
                        <button id="btn-atk-1" className="btn" onClick={() => attack(1)} disabled>Combatti</button>
                        <button id="btn-end-1" className="btn" onClick={() => endTurnRef.current(1)} disabled>Fine Turno</button>
                    </div>
                </section>

                {/* Divisorio */}
                <div className="h-1 w-full md:w-2 md:h-auto bg-gradient-to-r md:bg-gradient-to-b from-transparent via-red-900 to-transparent opacity-50"></div>

                {/* GIOCATORE 2 */}
                <section id="p2-section" className="w-full md:w-1/2 flex flex-col justify-between p-2 md:p-6 transition-all duration-500">
                    <h2 className="text-sm md:text-2xl text-gray-400 text-center frazetta-title mb-2 md:mb-4">Giocatore 2</h2>
                    <div className="flex flex-col-reverse md:flex-row-reverse items-center justify-around flex-grow w-full gap-4 md:gap-0">
                        <div className="flex flex-row md:flex-col items-center gap-4 md:gap-8">
                            <div id="p2-deck" className="deck disabled">
                                <div className="text-center">
                                    <div className="text-red-900 text-5xl mb-1 md:mb-2">{'\u2660'}</div>
                                    <div className="font-bold text-gray-300 deck-label" style={{fontSize:'0.6rem'}}>MAZZO</div>
                                    <div id="p2-deck-count" className="deck-count text-2xl mt-1 md:mt-2 text-yellow-600">5/5</div>
                                </div>
                            </div>
                            <div id="p2-weapon-deck" className="deck disabled">
                                <div className="text-center">
                                    <div className="text-gray-500 text-5xl mb-1 md:mb-2">{'\u2694'}</div>
                                    <div className="font-bold text-gray-300 deck-label" style={{fontSize:'0.6rem'}}>RASTRELLIERA</div>
                                    <div id="p2-weapon-count" className="deck-count text-2xl mt-1 md:mt-2 text-yellow-600">45/45</div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-row-reverse items-center gap-2 md:gap-4">
                            <div className="flex flex-col gap-1 md:gap-2">
                                <div id="p2-wslot-0" className="slot-area slot-weapon"></div>
                                <div id="p2-wslot-1" className="slot-area slot-weapon"></div>
                                <div id="p2-wslot-2" className="slot-area slot-weapon"></div>
                            </div>
                            <div id="p2-slot" className="slot-area slot-knight"></div>
                        </div>
                    </div>
                    <div className="h-6 md:h-12 mt-2 md:mt-6"></div>
                </section>
            </main>

            {/* Game Over Overlay */}
            <div id="game-over-screen" className="fixed inset-0 hidden flex-col justify-center items-center z-50 bg-black/90" style={{backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)', backgroundSize: '100% 4px'}}>
                <h1 id="winner-text" className="text-3xl md:text-6xl text-red-600 frazetta-title mb-8 text-shadow-lg text-center px-4">VITTORIA!</h1>
                <div className="flex flex-col gap-4">
                    <button className="btn text-xl md:text-2xl px-6 md:px-8 py-3 md:py-4" onClick={initGame}>Nuova Battaglia</button>
                    <button className="btn text-xl md:text-2xl px-6 md:px-8 py-3 md:py-4 border-gray-600 text-gray-300 hover:bg-gray-800/40" onClick={() => navigate('/lobby')}>Torna alla Lobby</button>
                </div>
            </div>

            {/* Zoom Overlay */}
            <div id="zoom-overlay" className="fixed inset-0 hidden z-[100] bg-black/90 flex-col justify-center items-center cursor-pointer backdrop-blur-sm opacity-0 transition-opacity duration-300" onClick={closeZoom}>
                <div id="zoom-container" className="zoom-container drop-shadow-[0_0_40px_rgba(138,3,3,0.6)] pointer-events-none"></div>
                <div className="absolute bottom-10 text-gray-400 text-[0.6rem] md:text-sm animate-pulse text-center w-full">Tocca ovunque per chiudere</div>
            </div>

            {/* Pause Menu */}
            <div id="pause-menu" className="fixed inset-0 hidden z-[110] bg-black/80 flex-col justify-center items-center backdrop-blur-sm">
                <h2 className="text-4xl md:text-6xl text-red-600 frazetta-title mb-8 md:mb-12 text-shadow-lg">PAUSA</h2>
                <button className="btn text-xl md:text-2xl px-8 py-4 mb-4 md:mb-6 w-64 md:w-80 shadow-[4px_4px_0px_#000]" onClick={togglePause}>Riprendi</button>
                <button className="btn text-xl md:text-2xl px-8 py-4 mb-4 md:mb-6 w-64 md:w-80 shadow-[4px_4px_0px_#000]" onClick={showTutorial}>Tutorial</button>
                <button className="btn text-xl md:text-2xl px-8 py-4 w-64 md:w-80 shadow-[4px_4px_0px_#000] border-red-800 hover:bg-red-900/40 text-red-400" onClick={abandonGame}>{"\uD83C\uDFF3\uFE0F"} ABBANDONA</button>
            </div>

            {/* Tutorial Overlay */}
            <div id="tutorial-overlay" className="fixed inset-0 hidden z-[120] bg-black/95 flex-col justify-start items-center p-4 sm:p-8 overflow-y-auto">
                <h2 className="text-2xl md:text-4xl text-yellow-500 frazetta-title mb-4 md:mb-6 mt-4 text-shadow-lg flex-shrink-0">TUTORIAL</h2>
                <div className="max-w-3xl w-full bg-[#111] border-4 border-red-900 p-4 md:p-8 text-[0.55rem] sm:text-[0.7rem] text-gray-300 leading-relaxed md:leading-loose space-y-4 md:space-y-6 overflow-y-auto custom-scrollbar flex-grow" style={{boxShadow: '8px 8px 0px #000'}}>
                    <div>
                        <h3 className="text-red-500 text-sm md:text-lg mb-1 md:mb-2">{'\uD83D\uDEE1\uFE0F'} Scopo del Gioco</h3>
                        <p>Sconfiggi tutti i Cavalieri del tuo avversario! Il primo giocatore che rimane senza carte Cavaliere (Spade) nel mazzo e sul campo, perde inesorabilmente la battaglia.</p>
                    </div>
                    <div>
                        <h3 className="text-red-500 text-sm md:text-lg mb-1 md:mb-2">{'\u2694\uFE0F'} Fasi del Turno</h3>
                        <ul className="list-none space-y-2 md:space-y-3">
                            <li><span className="text-yellow-500">{'>'}</span> <strong>SCHIERA:</strong> Se il tuo slot Cavaliere è vuoto, clicca sul MAZZO per schierarne uno in campo.</li>
                            <li><span className="text-yellow-500">{'>'}</span> <strong>RIFORNISCI:</strong> Clicca sulla RASTRELLIERA per riempire i tuoi slot. <span className="text-red-400">1 volta per turno</span>.</li>
                            <li><span className="text-yellow-500">{'>'}</span> <strong>EQUIPAGGIA:</strong> <span className="text-blue-400">Tocca/Clicca</span> un{"'"}Arma, Scudo o Oggetto per assegnarlo. Consuma i Punti Azione (PA). Limiti Max: 15 ATK, 15 DEF, 5 PA.</li>
                            <li><span className="text-yellow-500">{'>'}</span> <strong>SOSTITUISCI:</strong> Tieni Premuto (Mobile) o Tasto Destro (PC) per distruggere una carta. La <span className="text-red-400">PRIMA volta</span> ne peschi in automatico una nuova!</li>
                            <li><span className="text-yellow-500">{'>'}</span> <strong>COMBATTI:</strong> Attacca (ATK) contro la difesa (DEF) del nemico. A 0 DEF, il Cavaliere muore.</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-red-500 text-sm md:text-lg mb-1 md:mb-2">{'\u2728'} Tipi di Carte Rastrelliera</h3>
                        <ul className="list-none space-y-2 md:space-y-3">
                            <li><span className="text-red-500 font-bold">Armi:</span> + ATK Permanente.</li>
                            <li><span className="text-green-500 font-bold">Scudi:</span> + DEF Permanente.</li>
                            <li><span className="text-yellow-500 font-bold">Oggetti:</span> Effetti immediati o alterazioni durature (Veleno, Accecamento...).</li>
                            <li><span className="text-purple-500 font-bold">Terreni:</span> Si attivano da soli! Alterano le regole per 3 interi turni.</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-red-500 text-sm md:text-lg mb-1 md:mb-2">{'\uD83D\uDD0D'} Controlli Speciali (Esamina)</h3>
                        <p><strong>Mobile:</strong> Clicca <span className="text-blue-400 font-bold">MENU (Pausa)</span> in alto a sinistra. Mentre il gioco è in pausa, <span className="text-yellow-500">tocca qualsiasi carta in campo</span> per esaminarla gigante a centro schermo!</p>
                        <p className="mt-1"><strong>PC:</strong> Tieni premuto <span className="text-blue-400 font-bold">CTRL + Tasto Destro</span> su una carta, oppure premi ESC e cliccaci sopra normalmente.</p>
                    </div>
                </div>
                <button className="btn text-sm md:text-xl px-6 md:px-8 py-3 md:py-4 mt-4 md:mt-8 flex-shrink-0 shadow-[4px_4px_0px_#000]" onClick={hideTutorial}>Torna al Gioco</button>
            </div>

            {/* Terrain Activation Overlay */}
            <div id="terrain-overlay" className="fixed inset-0 hidden z-[90] bg-purple-900/80 flex-col justify-center items-center opacity-0 transition-opacity duration-500 backdrop-blur-md">
                <h2 className="text-2xl md:text-4xl text-purple-400 frazetta-title mb-[60px] md:mb-[120px] text-shadow-[2px_2px_0px_#000] animate-pulse text-center px-4">CARTA TERRENO ATTIVATA</h2>
                <div id="terrain-container" className="drop-shadow-[0_0_40px_rgba(128,0,128,0.8)] scale-[1.8] sm:scale-[3.5]"></div>
                <button id="btn-terrain-continue" className="btn text-sm md:text-2xl px-6 md:px-8 py-3 md:py-4 mt-[100px] md:mt-[220px] z-50 hover:scale-105 transition-transform shadow-[4px_4px_0px_#000]">CONTINUA</button>
            </div>
        </div>
    );
}
