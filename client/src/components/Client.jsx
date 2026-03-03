import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Link } from 'react-router-dom';
import { Lock, Smartphone, RotateCcw } from 'lucide-react';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:3001`;

export default function Client() {
    const [socket, setSocket] = useState(null);
    const [matrix, setMatrix] = useState({
        rows: 10,
        cols: 10,
        eventName: "Paradox",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        mediaType: "video",
        users: {}
    });

    const [gameState, setGameState] = useState('onboarding'); // 'onboarding', 'waiting', 'playing'
    const [myPos, setMyPos] = useState({ row: 1, col: 1 });
    const [errorMsg, setErrorMsg] = useState('');

    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [localMediaUrl, setLocalMediaUrl] = useState(null);

    const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

    useEffect(() => {
        const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const videoRef = useRef(null);

    const getFullVideoUrl = (url) => {
        if (!url) return "";
        if (url.startsWith('http')) return url;
        return `${SOCKET_SERVER_URL}${url}`;
    };

    useEffect(() => {
        const newSocket = io(SOCKET_SERVER_URL);
        setSocket(newSocket);

        newSocket.on('matrix_state', (state) => {
            setMatrix(state);
            // If we are waiting and the video URL changes, we might want to reload
            if (videoRef.current && typeof videoRef.current.load === 'function') {
                videoRef.current.load();
            }
        });

        newSocket.on('join_success', () => {
            setGameState('waiting');
            setErrorMsg('');
            if (videoRef.current && typeof videoRef.current.load === 'function') {
                videoRef.current.load(); // start buffering
            }
        });

        newSocket.on('join_error', (msg) => {
            setErrorMsg(msg);
        });

        newSocket.on('admin_play', () => {
            if (gameState === 'waiting' || gameState === 'playing') {
                setGameState('playing');
                if (videoRef.current && typeof videoRef.current.play === 'function') {
                    videoRef.current.play().catch(e => console.error("Play error from socket action:", e));
                }
            }
        });

        newSocket.on('admin_pause', () => {
            if (videoRef.current && typeof videoRef.current.pause === 'function') {
                videoRef.current.pause();
            }
        });

        newSocket.on('admin_reset', () => {
            setGameState('onboarding');
            setErrorMsg('Admin reset the grid or updated the media source.');
            setLocalMediaUrl(null); // Clear local cache on reset
            if (videoRef.current && typeof videoRef.current.pause === 'function') {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
        });

        return () => newSocket.close();
    }, [gameState]);

    const handleDownloadMedia = () => {
        setIsDownloading(true);
        setDownloadProgress(0);

        const xhr = new XMLHttpRequest();
        xhr.open('GET', getFullVideoUrl(matrix.videoUrl), true);
        xhr.responseType = 'blob';
        // Avoid sending cookies since this is cross-origin
        xhr.withCredentials = false;

        xhr.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                setDownloadProgress(percentComplete);
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                // Determine mime type based on mediaType
                const mime = matrix.mediaType === 'image' ? 'image/jpeg' : 'video/mp4';
                const blob = new Blob([xhr.response], { type: mime });
                const url = URL.createObjectURL(blob);
                setLocalMediaUrl(url);
                alert("✅ Download Complete! Media is saved to your phone cache for lag-free playback.");
                if (videoRef.current && typeof videoRef.current.load === 'function') {
                    videoRef.current.load();
                }
            } else {
                alert("❌ Failed to download media.");
            }
            setIsDownloading(false);
        };

        xhr.onerror = () => {
            alert("❌ Error connecting to server for download.");
            setIsDownloading(false);
        };

        xhr.send();
    };

    // Listen for Force Download from Admin
    useEffect(() => {
        if (!socket) return;
        const onForceDownload = () => {
            if (gameState === 'waiting' && !localMediaUrl && !isDownloading && matrix.videoUrl) {
                handleDownloadMedia();
            }
        };
        socket.on('force_download', onForceDownload);
        return () => socket.off('force_download', onForceDownload);
    }, [socket, gameState, localMediaUrl, isDownloading, matrix.videoUrl]);

    // Handle Play execution securely when gameState changes to playing
    useEffect(() => {
        if (gameState === 'playing' && videoRef.current && typeof videoRef.current.play === 'function') {
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
        height: `${M * 100}dvh`,
        transform: `translate(${-(C - 1) * 100}vw, ${-(R - 1) * 100}dvh)`,
        objectFit: matrix.objectFit || 'cover'
    };

    const isOrientationMismatch =
        (matrix.orientation === 'landscape' && isPortrait) ||
        (matrix.orientation === 'portrait' && !isPortrait);

    if (isOrientationMismatch) {
        return (
            <div className="min-h-screen bg-[#ff003c] text-white flex flex-col items-center justify-center p-6 text-center z-[100] fixed inset-0">
                <div className="animate-bounce mb-8">
                    <RotateCcw size={64} className="mx-auto" />
                </div>
                <h1 className="text-4xl font-black uppercase tracking-widest mb-4">Rotate Device</h1>
                <p className="font-bold text-xl">
                    Admin requested
                    <span className="underline uppercase tracking-wide px-2 font-black">{matrix.orientation}</span>
                    mode.
                </p>
                <p className="mt-4 opacity-80 border border-white/30 p-4 rounded-xl text-sm">Please turn your physical phone to remove this lock screen.</p>
            </div>
        );
    }



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

            {/* The single, persistent media element to prevent buffering resets */}
            {matrix.mediaType === 'image' ? (
                <img
                    ref={videoRef}
                    src={localMediaUrl || getFullVideoUrl(matrix.videoUrl)}
                    style={gameState === 'playing' ? displayStyle : { ...displayStyle, opacity: 0, pointerEvents: 'none' }}
                    className={gameState === 'playing' ? 'z-0' : 'z-[-10]'}
                    crossOrigin="anonymous"
                    onLoad={handleVideoCanPlay}
                    alt="Wall Component"
                />
            ) : (
                <video
                    ref={videoRef}
                    src={localMediaUrl || getFullVideoUrl(matrix.videoUrl)}
                    style={gameState === 'playing' ? displayStyle : { ...displayStyle, opacity: 0, pointerEvents: 'none' }}
                    className={gameState === 'playing' ? 'z-0' : 'z-[-10]'}
                    playsInline
                    crossOrigin="anonymous"
                    muted
                    loop
                    onLoadedData={handleVideoCanPlay}
                />
            )}

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
                <div className="text-center space-y-8 z-10 w-full min-h-screen flex flex-col items-center justify-center bg-zinc-950 absolute top-0 left-0 p-6 overflow-y-auto pb-12 pt-12">
                    <div className="w-32 h-32 border-4 border-[#00f0ff] border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_30px_rgba(0,240,255,0.3)] shrink-0"></div>
                    <div className="shrink-0">
                        <h2 className="text-2xl font-black uppercase tracking-widest text-zinc-300 animate-pulse">Awaiting Signal</h2>
                        <p className="text-zinc-500 mt-2">Position [{myPos.row}, {myPos.col}] locked. Do not close this tab.</p>
                    </div>

                    <div className="w-full max-w-sm mt-8 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg relative overflow-hidden shrink-0">
                        <h3 className="text-[#00f0ff] font-bold uppercase tracking-wider text-sm mb-2">Fix Playback Lag?</h3>
                        <p className="text-zinc-400 text-xs mb-4">Download the media directly to your device cache now to prevent buffering issues when playback starts.</p>

                        <button
                            onClick={handleDownloadMedia}
                            disabled={isDownloading || localMediaUrl}
                            className={`w-full py-3 px-4 rounded-xl font-black uppercase tracking-widest transition-all relative overflow-hidden ${localMediaUrl
                                ? 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                                : isDownloading
                                    ? 'bg-zinc-700 text-white'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 shadow-md hover:shadow-lg'
                                }`}
                        >
                            {isDownloading && (
                                <div className="absolute top-0 left-0 h-full bg-[#00f0ff] opacity-20" style={{ width: `${downloadProgress}%` }}></div>
                            )}
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {localMediaUrl ? '✓ Cached Locally' : isDownloading ? `Downloading ${Math.round(downloadProgress)}%` : '⬇️ Download Media'}
                            </span>
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
