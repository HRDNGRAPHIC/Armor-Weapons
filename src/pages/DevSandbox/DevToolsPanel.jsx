/**
 * DevToolsPanel.jsx — Sidebar with State Inspector + Action Triggers
 * for the GameBoardDev sandbox.
 */
import { useState } from 'react';
import { terrainDefs } from '../../game/data/gameData';

const SECTION = 'border border-red-900/40 bg-black/60 rounded p-3 space-y-2';
const BTN = 'w-full text-[0.55rem] font-bold py-1.5 px-2 border border-red-900/60 bg-black/80 text-gray-300 hover:bg-red-900/30 transition-colors cursor-pointer';
const LABEL = 'text-[0.5rem] text-gray-500 uppercase tracking-wider';

function StatLine({ label, value, color = 'text-gray-200' }) {
    return (
        <div className="flex justify-between items-center">
            <span className={LABEL}>{label}</span>
            <span className={`text-[0.6rem] font-bold ${color}`}>{value ?? '—'}</span>
        </div>
    );
}

function PlayerBlock({ label, data, color }) {
    if (!data) return null;
    const card = data.activeCard;
    return (
        <div className="space-y-1">
            <h4 className={`text-[0.6rem] font-bold ${color}`}>{label}</h4>
            {card ? (
                <>
                    <StatLine label="Knight" value={card.name} />
                    <StatLine label="ATK" value={card.atk} color="text-red-400" />
                    <StatLine label="DEF" value={card.def} color="text-green-400" />
                    <StatLine label="PA" value={card.pa} color="text-yellow-400" />
                </>
            ) : (
                <span className="text-[0.5rem] text-gray-600 italic">Nessun cavaliere</span>
            )}
            <StatLine label="Carte" value={`${data.cardsLeft}/5`} />
            <StatLine label="Rastrelliera" value={`${data.weaponsLeft}/45`} />
            {data.buffs?.length > 0 && (
                <StatLine label="Buff" value={data.buffs.map(b => `${b.id}(${b.turns})`).join(', ')} color="text-purple-400" />
            )}
            <StatLine label="Slot" value={data.weaponSlots?.map(w => w ? w.name : '—').join(' | ')} />
        </div>
    );
}

export default function DevToolsPanel({ gameState, boardRef }) {
    const [selectedTerrain, setSelectedTerrain] = useState('terremoto');

    const act = (fn, ...args) => { if (boardRef.current) fn.call(null, ...args); };

    return (
        <aside className="w-72 h-full overflow-y-auto bg-[#0a0a0a] border-l-2 border-red-900/60 flex flex-col gap-3 p-3 custom-scrollbar"
               style={{ fontFamily: "'Press Start 2P', monospace" }}>

            {/* Header */}
            <h3 className="text-[0.7rem] text-red-500 text-center tracking-widest">DEV TOOLS</h3>

            {/* ── State Inspector ── */}
            <div className={SECTION}>
                <h4 className="text-[0.55rem] text-yellow-500 mb-1">State Inspector</h4>
                <StatLine label="Turno" value={gameState?.turn === 1 ? 'P1' : 'P2 (IA)'} color={gameState?.turn === 1 ? 'text-red-400' : 'text-blue-400'} />
                <StatLine label="Attacked" value={gameState?.hasAttacked ? 'SI' : 'NO'} />
                <StatLine label="Game Over" value={gameState?.gameOver ? 'SI' : 'NO'} color={gameState?.gameOver ? 'text-red-500' : 'text-green-500'} />
                <StatLine label="Paused" value={gameState?.isPaused ? 'SI' : 'NO'} />
                <StatLine label="Terreno"
                    value={gameState?.activeTerrain ? `${gameState.activeTerrain.id} (${gameState.activeTerrain.turns}T, P${gameState.activeTerrain.owner})` : 'Nessuno'}
                    color="text-purple-400" />

                <hr className="border-red-900/30 my-1" />
                <PlayerBlock label="GIOCATORE 1" data={gameState?.p1} color="text-red-400" />
                <hr className="border-red-900/30 my-1" />
                <PlayerBlock label="GIOCATORE 2 (IA)" data={gameState?.p2} color="text-blue-400" />
            </div>

            {/* ── Action Triggers ── */}
            <div className={SECTION}>
                <h4 className="text-[0.55rem] text-yellow-500 mb-1">Action Triggers</h4>

                <button className={BTN} onClick={() => boardRef.current?.restart()}>Restart Game</button>

                <div className="grid grid-cols-2 gap-1">
                    <button className={BTN} onClick={() => boardRef.current?.forceDrawP1()}>Draw P1</button>
                    <button className={BTN} onClick={() => boardRef.current?.forceDrawP2()}>Draw P2</button>
                </div>

                <div className="grid grid-cols-2 gap-1">
                    <button className={BTN} onClick={() => boardRef.current?.maxPA(1)}>Max PA P1</button>
                    <button className={BTN} onClick={() => boardRef.current?.maxPA(2)}>Max PA P2</button>
                </div>

                <div className="grid grid-cols-2 gap-1">
                    <button className={`${BTN} text-red-400`} onClick={() => boardRef.current?.instaKill(1)}>Kill P1</button>
                    <button className={`${BTN} text-blue-400`} onClick={() => boardRef.current?.instaKill(2)}>Kill P2</button>
                </div>

                <div className="grid grid-cols-2 gap-1">
                    <button className={BTN} onClick={() => boardRef.current?.setTurn(1)}>Set Turn P1</button>
                    <button className={BTN} onClick={() => boardRef.current?.setTurn(2)}>Set Turn P2</button>
                </div>

                <div className="space-y-1">
                    <label className={LABEL}>Force Terrain</label>
                    <div className="flex gap-1">
                        <select
                            className="flex-1 text-[0.5rem] bg-black border border-red-900/60 text-gray-300 px-1 py-1 rounded"
                            value={selectedTerrain}
                            onChange={e => setSelectedTerrain(e.target.value)}
                        >
                            {terrainDefs.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <button className={`${BTN} w-auto px-3`} onClick={() => boardRef.current?.forceTerrain(selectedTerrain)}>GO</button>
                    </div>
                </div>

                <button className={`${BTN} text-blue-400`} onClick={() => boardRef.current?.triggerAI()}>Trigger AI Turn</button>
            </div>

            {/* ── Raw JSON ── */}
            <details className={SECTION}>
                <summary className="text-[0.5rem] text-gray-500 cursor-pointer">Raw JSON</summary>
                <pre className="text-[0.35rem] text-green-400/80 overflow-x-auto mt-2 max-h-60 custom-scrollbar">
                    {JSON.stringify(gameState, null, 2)}
                </pre>
            </details>
        </aside>
    );
}
