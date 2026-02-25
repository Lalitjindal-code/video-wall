import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:3001`;

export default function Client() {
    const [socket, setSocket] = useState(null);
    const [matrix, setMatrix] = useState({
        rows: 10,
        cols: 10,
        eventName: "Paradox",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        users: {}
    });

    const [gameState, setGameState] = useState('onboarding'); // 'onboarding', 'waiting', 'playing'
    const [myPos, setMyPos] = useState({ row: 1, col: 1 });
    const [errorMsg, setErrorMsg] = useState('');

    const videoRef = useRef(null);

    useEffect(() => {
        const newSocket = io(SOCKET_SERVER_URL);
        setSocket(newSocket);

        newSocket.on('matrix_state', (state) => {
            setMatrix(state);
            // If we are waiting and the video URL changes, we might want to reload
            if (videoRef.current) {
                videoRef.current.load();
            }
        });

        newSocket.on('join_success', () => {
            setGameState('waiting');
            setErrorMsg('');
            if (videoRef.current) {
                videoRef.current.load(); // start buffering
            }
        });

        newSocket.on('join_error', (msg) => {
            setErrorMsg(msg);
        });

        newSocket.on('admin_play', () => {
            if (gameState === 'waiting' || gameState === 'playing') {
                setGameState('playing');
            }
        });

        newSocket.on('admin_pause', () => {
            if (videoRef.current) {
                videoRef.current.pause();
            }
        });

        newSocket.on('admin_reset', () => {
            setGameState('onboarding');
            setErrorMsg('Admin reset the grid or updated the video source.');
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
        });

        return () => newSocket.close();
    }, [gameState]);

    // Handle Play execution securely when gameState changes to playing
    useEffect(() => {
        if (gameState === 'playing' && videoRef.current) {
            videoRef.current.play().catch(e => console.error("Autoplay blocked:", e));
        }
    }, [gameState]);

    const handleJoin = (e) => {
        e.preventDefault();
        if (socket && myPos.row >= 1 && myPos.col >= 1) {
            socket.emit('client_join', myPos);
        }
    };

    const handleVideoCanPlay = () => {
        if (socket && (gameState === 'waiting' || gameState === 'onboarding')) {
            socket.emit('client_ready');
        }
    };

    const M = matrix.rows;
    const N = matrix.cols;
    const R = myPos.row;
    const C = myPos.col;

    const displayStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${N * 100}vw`,
        height: `${M * 100}vh`,
        transform: `translate(${-(C - 1) * 100}vw, ${-(R - 1) * 100}vh)`,
        objectFit: 'cover'
    };



    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col items-center justify-center p-4">

            {/* Admin Login Portal Button */}
            {gameState === 'onboarding' && (
                <div className="absolute top-6 right-6 z-50">
                    <Link to="/admin" className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-[#00f0ff] text-zinc-400 hover:text-black px-4 py-2 rounded-full transition-colors shadow-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer">
                        <Lock size={12} /> Admin Auth
                    </Link>
                </div>
            )}

            {/* The single, persistent video element to prevent buffering resets */}
            <video
                ref={videoRef}
                src={matrix.videoUrl}
                style={gameState === 'playing' ? displayStyle : { display: 'none' }}
                className={gameState === 'playing' ? '' : 'hidden'}
                playsInline
                muted
                loop
                onLoadedData={handleVideoCanPlay}
            />

            {gameState === 'onboarding' && (
                <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-sm w-full relative overflow-hidden z-10">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent"></div>

                    <h1 className="text-3xl font-black mb-2 tracking-widest uppercase text-center text-[#00f0ff] drop-shadow-[0_0_10px_rgba(0,240,255,0.3)]">
                        {matrix.eventName}
                    </h1>
                    <p className="text-center text-zinc-500 text-sm mb-8 tracking-wider">Join the Human Video Wall</p>

                    <form onSubmit={handleJoin} className="space-y-6">
                        <div className="space-y-4 text-center text-zinc-400 text-xs">
                            Grid Size: <span className="text-white font-bold">{M} rows × {N} cols</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs uppercase text-zinc-500 font-bold mb-1">Your Row</label>
                                <input
                                    type="number" min="1" max={M} required
                                    value={myPos.row} onChange={e => setMyPos({ ...myPos, row: parseInt(e.target.value) })}
                                    className="w-full bg-black border border-zinc-800 rounded p-3 text-center text-white text-xl focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-zinc-500 font-bold mb-1">Your Column</label>
                                <input
                                    type="number" min="1" max={N} required
                                    value={myPos.col} onChange={e => setMyPos({ ...myPos, col: parseInt(e.target.value) })}
                                    className="w-full bg-black border border-zinc-800 rounded p-3 text-center text-white text-xl focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff]"
                                />
                            </div>
                        </div>

                        {errorMsg && <p className="text-[#ff003c] text-sm text-center font-bold">{errorMsg}</p>}

                        <button type="submit" className="w-full bg-[#00f0ff] hover:bg-[#00c0cc] text-black font-black py-4 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:shadow-[0_0_30px_rgba(0,240,255,0.6)] tracking-widest uppercase">
                            Enter Matrix
                        </button>
                    </form>
                </div>
            )}

            {gameState === 'waiting' && (
                <div className="text-center space-y-8 animate-pulse z-10 w-full h-full flex flex-col items-center justify-center bg-zinc-950 absolute top-0 left-0">
                    <div className="w-32 h-32 border-4 border-[#00f0ff] border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_30px_rgba(0,240,255,0.3)]"></div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-widest text-zinc-300">Awaiting Signal</h2>
                        <p className="text-zinc-500 mt-2">Position [{myPos.row}, {myPos.col}] locked. Do not close this tab.</p>
                    </div>
                </div>
            )}

        </div>
    );
}
