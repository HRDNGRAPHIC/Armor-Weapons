/**
 * DevSandbox.jsx — Pagina wrapper per /dev-game.
 * Renderizza GameBoard3D (R3F) a schermo intero.
 * Il motore di gioco vive nello Zustand store (useGameStore).
 * Carica il deck selezionato dal DB tramite route state (deckId).
 */
import { useRef, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import GameBoardDev from './GameBoardDev';
import GameBoard3D from './GameBoard3D';
import { useAuth } from '../../context/AuthContext';
import { getUserDecks } from '../../services/decks';
import useGameStore from './useGameStore';

export default function DevSandbox() {
    const boardRef = useRef(null);
    const [gameState, setGameState] = useState(null);
    const [deckLoaded, setDeckLoaded] = useState(false);
    const location = useLocation();
    const { user } = useAuth();
    const initGame = useGameStore(s => s.initGame);
    const deckId = location.state?.deckId;   // dichiarato a livello componente per le dipendenze dell'effect

    /* Carica il deck dal DB se deckId è presente nel route state */
    useEffect(() => {
        if (deckLoaded) return;

        if (deckId && user?.id) {
            getUserDecks(user.id).then(decks => {
                const selected = decks.find(d => d.id === deckId);
                if (selected?.knights?.length && selected?.cards?.length) {
                    initGame(selected.knights, selected.cards);
                } else {
                    /* Fallback: deck random se il deck selezionato non è valido */
                    initGame();
                }
                setDeckLoaded(true);
            }).catch(() => {
                initGame();
                setDeckLoaded(true);
            });
        } else {
            /* Nessun deck selezionato: avvia con deck random */
            initGame();
            setDeckLoaded(true);
        }
    }, [deckId, user?.id, deckLoaded, initGame]);

    return (
        <div className="h-screen flex overflow-hidden bg-black">
            {/* Motore di gioco DOM nascosto (legacy, mantenuto per confronto) */}
            <div className="sr-only" aria-hidden="true">
                <GameBoardDev ref={boardRef} onStateChange={setGameState} />
            </div>

            {/* Scena 3D — viewport a schermo intero */}
            <div className="flex-1 min-w-0 overflow-hidden h-full">
                <GameBoard3D />
            </div>
        </div>
    );
}
