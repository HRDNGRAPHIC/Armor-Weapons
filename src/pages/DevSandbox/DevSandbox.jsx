/**
 * DevSandbox.jsx — Wrapper page for /dev-game.
 * Renders GameBoardDev + DevToolsPanel side by side.
 */
import { useRef, useState } from 'react';
import GameBoardDev from './GameBoardDev';
import DevToolsPanel from './DevToolsPanel';

export default function DevSandbox() {
    const boardRef = useRef(null);
    const [gameState, setGameState] = useState(null);

    return (
        <div className="h-screen flex overflow-hidden bg-black">
            {/* Game area */}
            <div className="flex-1 min-w-0 overflow-hidden">
                <GameBoardDev ref={boardRef} onStateChange={setGameState} />
            </div>
            {/* Dev panel — hidden on mobile, visible on lg+ */}
            <div className="hidden lg:block">
                <DevToolsPanel gameState={gameState} boardRef={boardRef} />
            </div>
        </div>
    );
}
