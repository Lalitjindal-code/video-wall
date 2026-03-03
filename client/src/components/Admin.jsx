import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Play, Pause, RotateCcw, UploadCloud, LogOut, CloudDownload } from 'lucide-react';
import { auth, storage } from '../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:3001`;

export default function Admin() {
    const [socket, setSocket] = useState(null);
    const [matrix, setMatrix] = useState({ rows: 10, cols: 10, eventName: "Paradox", users: {}, mediaType: "video", connectionsCount: 0 });
    const [rowsInput, setRowsInput] = useState(10);
    const [colsInput, setColsInput] = useState(10);
    const [eventNameInput, setEventNameInput] = useState("Paradox");
    const [orientationInput, setOrientationInput] = useState("landscape");
    const [objectFitInput, setObjectFitInput] = useState("fill");

    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [uploadProgress, setUploadProgress] = useState(0);

    // Auth State
    const [user, setUser] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');

    const fileInputRef = useRef(null);
    const adminVideoRef = useRef(null);

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
            setRowsInput(state.rows);
            setColsInput(state.cols);
            setEventNameInput(state.eventName || "Paradox");
            setOrientationInput(state.orientation || "landscape");
            setObjectFitInput(state.objectFit || "fill");
        });

        newSocket.on('grid_update', (users) => {
            setMatrix(prev => ({
                ...prev,
                users: { ...users } // Ensure a brand new object reference to trigger React re-renders
            }));
        });

        // Auth Listener
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });

        return () => {
            newSocket.close();
            unsubscribe();
        };
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setAuthError('Invalid credentials or unauthorized.');
        }
    };

    const handleLogout = () => {
        signOut(auth);
    };

    const handleUpdateMatrix = () => {
        if (socket) {
            socket.emit('admin_update_matrix', {
                rows: parseInt(rowsInput),
                cols: parseInt(colsInput),
                eventName: eventNameInput,
                orientation: orientationInput,
                objectFit: objectFitInput
            });
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        setUploadError("");
        setUploadProgress(0); // Optional: Fake progress or remove progress bar entirely if backend doesn't support streaming progress.

        const formData = new FormData();
        formData.append('video', file);

        try {
            // Fake progress for UX
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    const next = prev + 10;
                    return next >= 90 ? 90 : next;
                });
            }, 200);

            // Using the global server URL but hitting POST /upload
            const response = await fetch(`${SOCKET_SERVER_URL}/upload`, {
                method: 'POST',
                body: formData,
            });

            clearInterval(progressInterval);
            setUploadProgress(100);

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || response.statusText);
            }

            const data = await response.json();
            console.log("Upload successful:", data.url);

            // Wait for 100% flag to stay on screen briefly
            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress(0);
                e.target.value = null; // reset
            }, 500);

        } catch (err) {
            console.error("Upload error:", err);
            setUploadError(`Failed to upload: ${err.message}`);
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handlePlay = () => {
        adminVideoRef.current?.play();
        socket?.emit('admin_play');
    };
    const handlePause = () => {
        adminVideoRef.current?.pause();
        socket?.emit('admin_pause');
    };
    const handleReset = () => {
        if (adminVideoRef.current) {
            adminVideoRef.current.pause();
            adminVideoRef.current.currentTime = 0;
        }
        socket?.emit('admin_reset');
    };

    const handleForceDownload = () => {
        socket?.emit('admin_force_download');
    };

    const handleSlotClick = (r, c) => {
        const entry = Object.entries(matrix.users).find(([_, u]) => u.row === r && u.col === c);
        if (entry && socket) {
            const [socketId] = entry;
            socket.emit('admin_kick', socketId);
        }
    };

    const renderGrid = () => {
        const { rows, cols, users } = matrix;
        const grid = [];
        const userMap = new Map();
        Object.values(users).forEach(u => userMap.set(`${u.row}-${u.col}`, u.status));

        for (let r = 1; r <= rows; r++) {
            const rowElements = [];
            for (let c = 1; c <= cols; c++) {
                const status = userMap.get(`${r}-${c}`);

                let bgColor = 'bg-zinc-800'; // empty
                if (status === 'buffering') bgColor = 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]';
                if (status === 'ready') bgColor = 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]';

                rowElements.push(
                    <div
                        key={`${r}-${c}`}
                        onClick={() => handleSlotClick(r, c)}
                        className={`w-8 h-8 rounded-sm ${bgColor} transition-colors cursor-pointer hover:opacity-80 flex items-center justify-center text-[10px] text-black font-bold`}
                        title={`Row: ${r}, Col: ${c}`}
                    >
                        {status && `${r},${c}`}
                    </div>
                );
            }
            grid.push(<div key={`row-${r}`} className="flex gap-1">{rowElements}</div>);
        }
        return grid;
    };

    const totalConnected = matrix.connectionsCount || 0;
    const totalSlots = matrix.rows * matrix.cols;

    if (!user) {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-sm w-full relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent"></div>
                    <h1 className="text-3xl font-black mb-2 tracking-widest uppercase text-center text-[#ff003c] drop-shadow-[0_0_10px_rgba(255,0,60,0.3)]">
                        Admin Restricted
                    </h1>
                    <p className="text-center text-zinc-500 text-sm mb-8 tracking-wider">Authorized Personnel Only</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs uppercase text-zinc-500 font-bold mb-1">Email</label>
                            <input
                                type="email" required
                                value={email} onChange={e => setEmail(e.target.value)}
                                className="w-full bg-black border border-zinc-800 rounded p-3 text-white focus:outline-none focus:border-[#00f0ff]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-zinc-500 font-bold mb-1">Password</label>
                            <input
                                type="password" required
                                value={password} onChange={e => setPassword(e.target.value)}
                                className="w-full bg-black border border-zinc-800 rounded p-3 text-white focus:outline-none focus:border-[#00f0ff]"
                            />
                        </div>

                        {authError && <p className="text-[#ff003c] text-sm text-center font-bold">{authError}</p>}

                        <button type="submit" className="w-full bg-[#00f0ff] hover:bg-[#00c0cc] text-black font-black py-4 px-4 rounded-xl mt-4 transition-all uppercase tracking-widest">
                            Access Database
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
                    <div>
                        <h1 className="text-4xl font-black uppercase tracking-widest text-[#00f0ff] drop-shadow-[0_0_15px_rgba(0,240,255,0.5)]">
                            {matrix.eventName} Admin
                        </h1>
                        <p className="text-zinc-400 mt-2">Human Video Wall Controller</p>
                    </div>

                    <div className="flex space-x-4">
                        <div className="flex bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-[0_0_30px_rgba(0,240,255,0.1)]">
                            <div className="text-center px-4">
                                <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Connected</p>
                                <p className="text-3xl font-mono text-[#ff003c]">{totalConnected}/{totalSlots}</p>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="flex flex-col items-center justify-center p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer">
                            <LogOut size={20} className="mb-1" />
                            <span className="text-[10px] uppercase font-bold tracking-wider">Logout</span>
                        </button>
                    </div>
                </header>

                <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Controls Panel */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                            <h2 className="text-xl font-bold mb-4 text-[#00f0ff]">Setup Config</h2>

                            <div className="mb-4">
                                <label className="block text-xs uppercase text-zinc-500 font-bold mb-1">Event Name</label>
                                <input type="text" value={eventNameInput} onChange={e => setEventNameInput(e.target.value)} className="w-full bg-black border border-zinc-800 rounded p-3 text-white focus:outline-none focus:border-[#00f0ff]" />
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs uppercase text-zinc-500 font-bold mb-1">Rows (M)</label>
                                    <input type="number" min="1" value={rowsInput} onChange={e => setRowsInput(e.target.value)} className="w-full bg-black border border-zinc-800 rounded p-3 text-white focus:outline-none focus:border-[#00f0ff]" />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-zinc-500 font-bold mb-1">Cols (N)</label>
                                    <input type="number" min="1" value={colsInput} onChange={e => setColsInput(e.target.value)} className="w-full bg-black border border-zinc-800 rounded p-3 text-white focus:outline-none focus:border-[#00f0ff]" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs uppercase text-zinc-500 font-bold mb-1">Orientation</label>
                                    <select value={orientationInput} onChange={e => setOrientationInput(e.target.value)} className="w-full bg-black border border-zinc-800 rounded p-3 text-white focus:outline-none focus:border-[#00f0ff] appearance-none cursor-pointer">
                                        <option value="landscape">Landscape</option>
                                        <option value="portrait">Portrait</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-zinc-500 font-bold mb-1">Video Fit</label>
                                    <select value={objectFitInput} onChange={e => setObjectFitInput(e.target.value)} className="w-full bg-black border border-zinc-800 rounded p-3 text-white focus:outline-none focus:border-[#00f0ff] appearance-none cursor-pointer">
                                        <option value="fill">Stretch (Fill)</option>
                                        <option value="cover">Crop (Cover)</option>
                                        <option value="contain">Fit (Contain)</option>
                                    </select>
                                </div>
                            </div>

                            <button onClick={handleUpdateMatrix} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-4 rounded transition-colors uppercase tracking-wider text-sm mb-6">
                                Apply Config
                            </button>

                            <hr className="border-zinc-800 my-6" />

                            <h2 className="text-lg font-bold mb-4 text-[#00f0ff]">Upload Media Source</h2>
                            <p className="text-xs text-zinc-400 mb-4">Upload a new MP4 or image. This will reset the wall and force all clients to reload the new media.</p>

                            <input
                                type="file"
                                accept="video/*, image/*"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className={`w-full flex items-center justify-center gap-2 ${isUploading ? 'bg-zinc-700 text-zinc-500' : 'bg-[#00f0ff] hover:bg-[#00c0cc] text-black'} font-bold py-3 px-4 rounded transition-colors uppercase tracking-wider text-sm cursor-pointer relative overflow-hidden`}
                            >
                                {/* Progress Bar Background */}
                                {isUploading && (
                                    <div className="absolute top-0 left-0 h-full bg-[#00f0ff] opacity-20" style={{ width: `${uploadProgress}%` }}></div>
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    <UploadCloud size={18} className={isUploading ? '' : 'stroke-black'} />
                                    {isUploading ? `Uploading ${Math.round(uploadProgress)}%` : 'Upload Media to Cloud'}
                                </span>
                            </button>
                            {uploadError && <p className="text-[#ff003c] text-xs font-bold mt-2 text-center">{uploadError}</p>}
                        </div>

                        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                            <h2 className="text-xl font-bold mb-4 text-green-400">Master Controls</h2>
                            <div className="space-y-4">
                                <button onClick={handlePlay} className="w-full flex items-center justify-center gap-2 bg-[#00f0ff] hover:bg-[#00c0cc] text-black font-black py-4 px-4 rounded transition-colors uppercase tracking-widest cursor-pointer">
                                    <Play size={20} className="fill-black" /> EXECUTE PLAY
                                </button>
                                <button onClick={handleForceDownload} className="w-full flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white font-black py-3 px-4 rounded transition-colors uppercase tracking-widest cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                                    <CloudDownload size={18} /> Force Client Download
                                </button>
                                <div className="grid grid-cols-2 gap-4">
                                    <button onClick={handlePause} className="flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-4 rounded transition-colors uppercase text-sm cursor-pointer">
                                        <Pause size={16} className="fill-black" /> Pause
                                    </button>
                                    <button onClick={handleReset} className="flex items-center justify-center gap-2 bg-[#ff003c] hover:bg-[#cc0030] text-white font-bold py-3 px-4 rounded transition-colors uppercase text-sm cursor-pointer">
                                        <RotateCcw size={16} /> Reset
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Visualizer */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Video Preview */}
                        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.3)]">
                            <h2 className="text-xl font-bold mb-4 text-[#00f0ff]">Media Preview</h2>
                            <div className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center relative">
                                {matrix.videoUrl ? (
                                    matrix.mediaType === 'image' ? (
                                        <img
                                            src={getFullVideoUrl(matrix.videoUrl)}
                                            className="w-full h-full object-cover"
                                            alt="Preview"
                                        />
                                    ) : (
                                        <video
                                            ref={adminVideoRef}
                                            src={getFullVideoUrl(matrix.videoUrl)}
                                            className="w-full h-full object-cover"
                                            muted
                                            loop
                                        />
                                    )
                                ) : (
                                    <p className="text-zinc-600 font-bold uppercase tracking-widest text-sm">No Media Loaded</p>
                                )}
                            </div>
                        </div>

                        {/* Grid Map */}
                        <div className="bg-zinc-900 overflow-auto p-6 rounded-2xl border border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center">
                            <h2 className="text-xl w-full font-bold mb-4 text-[#00f0ff] text-left">Client Grid Map</h2>
                            <div className="flex flex-col gap-1 mx-auto bg-black p-4 rounded-xl shadow-inner inline-block relative">
                                {renderGrid()}
                            </div>
                        </div>
                    </div>

                </section>
            </div>
        </div>
    );
}
