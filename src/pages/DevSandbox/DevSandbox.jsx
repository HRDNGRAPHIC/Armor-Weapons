/**
 * DevSandbox.jsx — Wrapper page for /dev-game.
 * Renders GameBoard3D (R3F) fullscreen. DevToolsPanel hidden for calibration.
 * GameBoardDev runs hidden to manage game logic & imperative handle.
 */
import { useRef, useState } from 'react';
import GameBoardDev from './GameBoardDev';
import GameBoard3D from './GameBoard3D';
// import DevToolsPanel from './DevToolsPanel';  // hidden for 3D calibration

export default function DevSandbox() {
    const boardRef = useRef(null);
    const [gameState, setGameState] = useState(null);

    return (
        <div className="h-screen flex overflow-hidden bg-black">
            {/* Hidden DOM game engine (manages state, AI, logic) */}
            <div className="sr-only" aria-hidden="true">
                <GameBoardDev ref={boardRef} onStateChange={setGameState} />
            </div>

            {/* 3D scene — fullscreen viewport */}
            <div className="flex-1 min-w-0 overflow-hidden h-full">
                <GameBoard3D gameState={gameState} />
            </div>

            {/* DevToolsPanel hidden for 3D engine calibration
            <div className="hidden lg:block">
                <DevToolsPanel gameState={gameState} boardRef={boardRef} />
            </div>
            */}
        </div>
    );
}
