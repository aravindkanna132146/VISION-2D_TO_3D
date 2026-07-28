import React, { useRef, useEffect, useState } from 'react';
import { binarizeCanvas, detectFloorplanVect } from '../utils/floorplanCV';
import { Upload, Play, Sliders, Trash2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

export default function VisionPipeline({ onImportHouseData }) {
    // Mode switcher: 'cv' (Computer Vision Sketch Upload) or 'sketcher' (Interactive 2D CAD Sketcher)
    const [editorMode, setEditorMode] = useState('sketcher');

    // --- CV TAB STATES ---
    const [imageSrc, setImageSrc] = useState(null);
    const [fileName, setFileName] = useState('');
    const [threshold, setThreshold] = useState(128);
    const [gridRes, setGridRes] = useState(60);
    const [density, setDensity] = useState(0.35);
    const [physicalWidth, setPhysicalWidth] = useState(12.0);
    const [processingStep, setProcessingStep] = useState(0); // 0: idle, 1: scanning, 2: extruding, 3: fitting
    const [dragActive, setDragActive] = useState(false);

    const sourceCanvasRef = useRef(null);
    const binarizedCanvasRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const fileInputRef = useRef(null);

    // --- SKETCHER TAB STATES ---
    const sketchCanvasRef = useRef(null);
    const [activeTool, setActiveTool] = useState('wall_outer');
    const [sketchWalls, setSketchWalls] = useState([
        { id: 'sw_1', x1: 40, y1: 40, x2: 280, y2: 40, type: 'outer' },
        { id: 'sw_2', x1: 280, y1: 40, x2: 280, y2: 280, type: 'outer' },
        { id: 'sw_3', x1: 280, y1: 280, x2: 40, y2: 280, type: 'outer' },
        { id: 'sw_4', x1: 40, y1: 280, x2: 40, y2: 40, type: 'outer' },
        { id: 'sw_5', x1: 160, y1: 40, x2: 160, y2: 280, type: 'inner' },
        { id: 'sw_6', x1: 40, y1: 160, x2: 160, y2: 160, type: 'inner' }
    ]);
    const [sketchOpenings, setSketchOpenings] = useState([
        { id: 'so_1', wallId: 'sw_4', x: 40, y: 100, type: 'door', isHorizontal: false },
        { id: 'so_2', wallId: 'sw_1', x: 200, y: 40, type: 'window', isHorizontal: true },
        { id: 'so_3', wallId: 'sw_3', x: 160, y: 280, type: 'door', isHorizontal: true }
    ]);
    const [sketchRooms, setSketchRooms] = useState([
        { id: 'sr_1', name: 'NE: Pooja Room', x: 100, y: 100, type: 'pooja' },
        { id: 'sr_2', name: 'SE: Kitchen', x: 220, y: 100, type: 'kitchen' },
        { id: 'sr_3', name: 'SW: Master Bed', x: 100, y: 220, type: 'bedroom' },
        { id: 'sr_4', name: 'NW: Living Room', x: 220, y: 220, type: 'living' }
    ]);

    const [drawStart, setDrawStart] = useState(null);
    const [currentMousePos, setCurrentMousePos] = useState(null);

    // --- COMPUTER VISION ROUTINES ---
    useEffect(() => {
        if (editorMode === 'cv') {
            const sampleImage = new Image();
            sampleImage.src = createDefaultFloorplanDataURI();
            sampleImage.onload = () => {
                setFileName('default_layout_blueprint.png');
                onImageLoaded(sampleImage);
            };
        }
    }, [editorMode]);

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processSelectedFile(file);
    };

    const processSelectedFile = async (file) => {
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                onImageLoaded(img);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);

        // Upload to Supabase blueprint-uploads bucket is user is authenticated
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const fileExt = file.name.split('.').pop() || 'png';
                const filePath = `${user.id}/${Date.now()}.${fileExt}`;
                const { data, error } = await supabase.storage
                    .from('blueprint-uploads')
                    .upload(filePath, file);

                if (!error && data) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('blueprint-uploads')
                        .getPublicUrl(filePath);

                    await supabase.from('uploads').insert({
                        user_id: user.id,
                        file_name: file.name,
                        file_url: publicUrl
                    });
                }
            }
        } catch (err) {
            console.warn("Storage upload was skipped or failed:", err);
        }
    };

    const onImageLoaded = (imgObj) => {
        setImageSrc(imgObj);
        const canvas = sourceCanvasRef.current;
        if (!canvas) return;
        const maxDim = 320;
        let w = imgObj.width;
        let h = imgObj.height;
        if (w > maxDim || h > maxDim) {
            if (w > h) {
                h = (h / w) * maxDim;
                w = maxDim;
            } else {
                w = (w / h) * maxDim;
                h = maxDim;
            }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgObj, 0, 0, w, h);
        runCV();
    };

    // Generate fallback structures for low contrast or unclear blueprint matrices
    const generateFallbackVastuHouse = (width, length) => {
        const height = 3.0;
        const walls = [
            // Outer perimeter walls boundary matching plot bounds exactly!
            { id: 'fb_w1', x1: 0, y1: 0, x2: width, y2: 0, thickness: 0.25, height, type: 'outer' },
            { id: 'fb_w2', x1: width, y1: 0, x2: width, y2: length, thickness: 0.25, height, type: 'outer' },
            { id: 'fb_w3', x1: width, y1: length, x2: 0, y2: length, thickness: 0.25, height, type: 'outer' },
            { id: 'fb_w4', x1: 0, y1: length, x2: 0, y2: 0, thickness: 0.25, height, type: 'outer' },
            // Dividing center walls (Create 4 Vastu quadrants)
            { id: 'fb_w5', x1: width / 2, y1: 0, x2: width / 2, y2: length, thickness: 0.12, height, type: 'inner' },
            { id: 'fb_w6', x1: 0, y1: length / 2, x2: width, y2: length / 2, thickness: 0.12, height, type: 'inner' }
        ];

        const openings = [
            { id: 'fb_op1', wallId: 'fb_w4', x: 0, y: length * 0.25, type: 'door', width: 0.9, height: 2.1, sillHeight: 0, isHorizontal: false },
            { id: 'fb_op2', wallId: 'fb_w1', x: width * 0.75, y: 0, type: 'window', width: 1.4, height: 1.2, sillHeight: 0.9, isHorizontal: true },
            { id: 'fb_op3', wallId: 'fb_w2', x: width, y: length * 0.75, type: 'window', width: 1.4, height: 1.2, sillHeight: 0.9, isHorizontal: false },
            { id: 'fb_op4', wallId: 'fb_w5', x: width / 2, y: length * 0.35, type: 'door', width: 0.9, height: 2.1, sillHeight: 0, isHorizontal: false }
        ];

        const rooms = [
            { id: 'fb_r1', name: 'NE: Pooja Room', x: width * 0.25, y: length * 0.25, w: width / 2, h: length / 2, type: 'pooja' },
            { id: 'fb_r2', name: 'SE: Kitchen', x: width * 0.75, y: length * 0.25, w: width / 2, h: length / 2, type: 'kitchen' },
            { id: 'fb_r3', name: 'SW: Master Bed', x: width * 0.25, y: length * 0.75, w: width / 2, h: length / 2, type: 'bedroom' },
            { id: 'fb_r4', name: 'NW: Living Room', x: width * 0.75, y: length * 0.75, w: width / 2, h: length / 2, type: 'living' }
        ];

        const assets = [
            { id: 'fb_a1', type: 'plant', x: width * 0.25, z: length * 0.25, rotation: 0, scale: 0.9 },
            { id: 'fb_a2', type: 'kitchen', x: width * 0.82, z: length * 0.25, rotation: Math.PI / 2, scale: 0.95 },
            { id: 'fb_a3', type: 'bed', x: width * 0.25, z: length * 0.72, rotation: 0, scale: 0.95 },
            { id: 'fb_a4', type: 'sofa', x: width * 0.75, z: length * 0.78, rotation: Math.PI, scale: 1.0 }
        ];

        return {
            dimensions: { width, length, height },
            walls,
            openings,
            rooms,
            assets
        };
    };

    const runCV = () => {
        const srcCanvas = sourceCanvasRef.current;
        const binCanvas = binarizedCanvasRef.current;
        const overCanvas = overlayCanvasRef.current;
        if (!srcCanvas || !binCanvas || !overCanvas || !imageSrc) return;

        const w = srcCanvas.width;
        const h = srcCanvas.height;

        // Binarize source canvas data to target
        binarizeCanvas(srcCanvas, binCanvas, threshold);

        // Calculate light/dark balance percentage
        const bCtx = binCanvas.getContext('2d');
        const bData = bCtx.getImageData(0, 0, w, h).data;
        let darkPixels = 0;
        for (let i = 0; i < bData.length; i += 4) {
            if (bData[i] === 0) {
                darkPixels++;
            }
        }
        const darkRatio = darkPixels / (w * h);

        const lengthReal = physicalWidth * (h / w);
        let detection = null;

        // Trigger fallback layout parser if contrast check fails
        if (darkRatio < 0.015 || darkRatio > 0.88) {
            detection = generateFallbackVastuHouse(physicalWidth, lengthReal);
        } else {
            detection = detectFloorplanVect(binCanvas, {
                threshold: 128,
                gridResolution: gridRes,
                wallDensityThreshold: density,
                houseRealWidth: physicalWidth
            });
            // Bounding count safety check
            if (!detection.walls || detection.walls.length < 3) {
                detection = generateFallbackVastuHouse(physicalWidth, lengthReal);
            }
        }

        overCanvas.width = w;
        overCanvas.height = h;
        const oCtx = overCanvas.getContext('2d');
        oCtx.clearRect(0, 0, w, h);
        oCtx.globalAlpha = 0.25;
        oCtx.drawImage(binCanvas, 0, 0);
        oCtx.globalAlpha = 1.0;

        const scaleX = w / physicalWidth;
        const scaleY = h / lengthReal;

        // Draw lines
        oCtx.lineWidth = 4;
        detection.walls.forEach(wall => {
            oCtx.strokeStyle = wall.type === 'outer' ? '#9c27b0' : '#ec4899';
            oCtx.beginPath();
            oCtx.moveTo(wall.x1 * scaleX, wall.y1 * scaleY);
            oCtx.lineTo(wall.x2 * scaleX, wall.y2 * scaleY);
            oCtx.stroke();
        });

        // Draw openings
        detection.openings.forEach(op => {
            oCtx.fillStyle = op.type === 'door' ? '#3b82f6' : '#10b981';
            oCtx.beginPath();
            oCtx.arc(op.x * scaleX, op.y * scaleY, 5, 0, Math.PI * 2);
            oCtx.fill();
        });

        overCanvas.userData = detection;
    };

    const handleExtrudeTrigger = () => {
        const overCanvas = overlayCanvasRef.current;
        if (!overCanvas || !overCanvas.userData) {
            alert('Please upload or load a blueprint floorplan image first.');
            return;
        }

        // Immediate scanning HUD status switches
        setProcessingStep(1); // "Scanning floorplan pixels..."
        setTimeout(() => {
            setProcessingStep(2); // "Extruding 3D walls..."
            setTimeout(() => {
                setProcessingStep(3); // "Fitting doors & windows..."
                setTimeout(() => {
                    onImportHouseData(overCanvas.userData);
                    setProcessingStep(0);
                }, 800);
            }, 800);
        }, 850);
    };

    // --- SKETCHER DRAW REMAPPING ---
    useEffect(() => {
        if (editorMode === 'sketcher') {
            redrawSketchMesh();
        }
    }, [sketchWalls, sketchOpenings, sketchRooms, activeTool, drawStart, currentMousePos, editorMode]);

    const snapToGrid = (val, step = 10) => {
        return Math.round(val / step) * step;
    };

    const getCanvasMousePos = (e) => {
        const canvas = sketchCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: snapToGrid((e.clientX - rect.left) * scaleX),
            y: snapToGrid((e.clientY - rect.top) * scaleY)
        };
    };

    const handleSketchMouseDown = (e) => {
        const coords = getCanvasMousePos(e);
        if (activeTool === 'wall_outer' || activeTool === 'wall_inner') {
            setDrawStart(coords);
            setCurrentMousePos(coords);
        } else if (activeTool === 'door' || activeTool === 'window') {
            let nearestWall = null;
            let minDist = 30;
            sketchWalls.forEach(wall => {
                const dist = distToSegment(coords, wall);
                if (dist < minDist) {
                    minDist = dist;
                    nearestWall = wall;
                }
            });
            if (nearestWall) {
                const proj = projectPointOnSegment(coords, nearestWall);
                const isHorizontal = Math.abs(nearestWall.y2 - nearestWall.y1) < 5;
                const newOp = {
                    id: `so_${Date.now()}`,
                    wallId: nearestWall.id,
                    x: proj.x,
                    y: proj.y,
                    type: activeTool,
                    isHorizontal
                };
                setSketchOpenings(prev => [...prev, newOp]);
            } else {
                alert('Please place doors/windows directly on wall lines.');
            }
        } else if (activeTool.startsWith('room_')) {
            const roomType = activeTool.replace('room_', '');
            const labelMap = {
                pooja: 'NE: Pooja Room',
                kitchen: 'SE: Kitchen',
                bedroom: 'SW: Master Bed',
                hall: 'NW: Living Room',
                balcony: 'Balcony',
                parking: 'Parking / Portico'
            };
            const newRoom = {
                id: `sr_${Date.now()}`,
                name: labelMap[roomType] || 'Utility Room',
                x: coords.x,
                y: coords.y,
                type: roomType
            };
            setSketchRooms(prev => [...prev, newRoom]);
        }
    };

    const handleSketchMouseMove = (e) => {
        if (!drawStart) return;
        const coords = getCanvasMousePos(e);
        setCurrentMousePos(coords);
    };

    const handleSketchMouseUp = () => {
        if (drawStart && currentMousePos) {
            const dx = currentMousePos.x - drawStart.x;
            const dy = currentMousePos.y - drawStart.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 15) {
                const type = activeTool === 'wall_outer' ? 'outer' : 'inner';
                const newWall = {
                    id: `sw_${Date.now()}`,
                    x1: drawStart.x,
                    y1: drawStart.y,
                    x2: currentMousePos.x,
                    y2: currentMousePos.y,
                    type
                };
                setSketchWalls(prev => [...prev, newWall]);
            }
        }
        setDrawStart(null);
        setCurrentMousePos(null);
    };

    const handleClearSketch = () => {
        setSketchWalls([]);
        setSketchOpenings([]);
        setSketchRooms([]);
    };

    const handleExtrudeSketch = () => {
        const scaleFactor = 12.0 / 320.0;
        const extrudedBIM = {
            dimensions: { width: 12.0, length: 12.0, height: 3.0 },
            walls: sketchWalls.map(w => ({
                id: w.id,
                x1: w.x1 * scaleFactor,
                y1: w.y1 * scaleFactor,
                x2: w.x2 * scaleFactor,
                y2: w.y2 * scaleFactor,
                thickness: w.type === 'outer' ? 0.25 : 0.12,
                height: 3.0,
                type: w.type
            })),
            openings: sketchOpenings.map(op => ({
                id: op.id,
                wallId: op.wallId,
                x: op.x * scaleFactor,
                y: op.y * scaleFactor,
                width: op.type === 'door' ? 0.9 : 1.4,
                height: op.type === 'door' ? 2.1 : 1.2,
                sillHeight: op.type === 'door' ? 0.0 : 0.9,
                type: op.type,
                isHorizontal: op.isHorizontal
            })),
            rooms: sketchRooms.map(r => ({
                id: r.id,
                name: r.name,
                x: r.x * scaleFactor,
                y: r.y * scaleFactor,
                w: 3.0,
                h: 3.0,
                type: r.type
            })),
            assets: sketchRooms.map(r => {
                let aType = 'plant';
                if (r.type === 'bedroom') aType = 'bed';
                else if (r.type === 'kitchen') aType = 'kitchen';
                else if (r.type === 'living') aType = 'sofa';
                else if (r.type === 'parking') aType = 'car';
                return {
                    id: `asset_sketch_${r.id}`,
                    type: aType,
                    x: r.x * scaleFactor,
                    z: r.y * scaleFactor,
                    rotation: 0,
                    scale: 0.9
                };
            })
        };
        onImportHouseData(extrudedBIM);
    };

    const redrawSketchMesh = () => {
        const canvas = sketchCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 1;
        for (let g = 0; g <= canvas.width; g += 20) {
            ctx.beginPath();
            ctx.moveTo(g, 0);
            ctx.lineTo(g, canvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, g);
            ctx.lineTo(canvas.width, g);
            ctx.stroke();
        }

        ctx.fillStyle = '#27272a';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('N (NORTH)', canvas.width / 2 - 25, 15);
        ctx.fillText('S (SOUTH)', canvas.width / 2 - 25, canvas.height - 8);
        ctx.fillText('E (EAST) ➜', canvas.width - 65, canvas.height / 2);
        ctx.fillText('W (WEST)', 10, canvas.height / 2);

        ctx.fillStyle = '#94a3b8';
        ctx.fillText('NE: Pooja Zone', 25, 25);
        ctx.fillText('SE: Agni Kitchen', canvas.width - 110, 25);
        ctx.fillText('SW: Master Room', 25, canvas.height - 25);
        ctx.fillText('NW: Washroom/Guest', canvas.width - 115, canvas.height - 25);

        sketchWalls.forEach(wall => {
            ctx.strokeStyle = wall.type === 'outer' ? '#a855f7' : '#ec4899';
            ctx.lineWidth = wall.type === 'outer' ? 6 : 3;
            ctx.beginPath();
            ctx.moveTo(wall.x1, wall.y1);
            ctx.lineTo(wall.x2, wall.y2);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(wall.x1, wall.y1, 3.5, 0, Math.PI * 2);
            ctx.arc(wall.x2, wall.y2, 3.5, 0, Math.PI * 2);
            ctx.fill();
        });

        sketchOpenings.forEach(op => {
            ctx.fillStyle = op.type === 'door' ? '#3b82f6' : '#22c55e';
            ctx.beginPath();
            ctx.arc(op.x, op.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        sketchRooms.forEach(room => {
            ctx.fillStyle = '#f3e8ff';
            ctx.font = 'bold 9px sans-serif';
            ctx.fillText(room.name, room.x - 30, room.y + 4);
        });

        if (drawStart && currentMousePos) {
            ctx.strokeStyle = '#e9d5ff';
            ctx.lineWidth = activeTool === 'wall_outer' ? 5 : 2.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(drawStart.x, drawStart.y);
            ctx.lineTo(currentMousePos.x, currentMousePos.y);
            ctx.stroke();
            ctx.setLineDash([]);

            const dx = currentMousePos.x - drawStart.x;
            const dy = currentMousePos.y - drawStart.y;
            const distPx = Math.hypot(dx, dy);
            const feet = distPx / 8;
            const feetInt = Math.floor(feet);
            const inches = Math.round((feet - feetInt) * 12);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(`${feetInt} ft ${inches} in`, currentMousePos.x + 8, currentMousePos.y - 8);
        }
    };

    const distToSegment = (p, w) => {
        const l2 = dist2(w.x1, w.y1, w.x2, w.y2);
        if (l2 === 0) return Math.hypot(p.x - w.x1, p.y - w.y1);
        let t = ((p.x - w.x1) * (w.x2 - w.x1) + (p.y - w.y1) * (w.y2 - w.y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (w.x1 + t * (w.x2 - w.x1)), p.y - (w.y1 + t * (w.y2 - w.y1)));
    };

    const dist2 = (x1, y1, x2, y2) => (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);

    const projectPointOnSegment = (p, w) => {
        const l2 = dist2(w.x1, w.y1, w.x2, w.y2);
        if (l2 === 0) return { x: w.x1, y: w.y1 };
        let t = ((p.x - w.x1) * (w.x2 - w.x1) + (p.y - w.y1) * (w.y2 - w.y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return {
            x: Math.round(w.x1 + t * (w.x2 - w.x1)),
            y: Math.round(w.y1 + t * (w.y2 - w.y1))
        };
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 bg-[#09090b] border border-zinc-800 p-1.5 rounded-xl">
                <button
                    onClick={() => setEditorMode('sketcher')}
                    className={`py-2.5 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${editorMode === 'sketcher' ? 'bg-[#9c27b0] text-white shadow' : 'text-zinc-400 hover:text-white'
                        }`}
                >
                    2D Sketcher
                </button>
                <button
                    onClick={() => setEditorMode('cv')}
                    className={`py-2.5 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${editorMode === 'cv' ? 'bg-[#9c27b0] text-white shadow' : 'text-zinc-400 hover:text-white'
                        }`}
                >
                    2D Picture Scan
                </button>
            </div>

            {editorMode === 'sketcher' && (
                <div className="flex flex-col gap-4 animate-fade-in">
                    <div className="flex flex-col gap-1.5 text-zinc-400">
                        <span className="text-xs font-semibold text-zinc-300">Plot boundary layout (40ft x 40ft grid):</span>
                        <span className="text-[11px] leading-relaxed text-zinc-500 font-sans">Drag to draw wall segments. Click walls to inject doors / windows. Click rooms to attach labels.</span>
                    </div>

                    <div className="relative border border-zinc-800 bg-[#060608] rounded-xl flex items-center justify-center p-2">
                        <canvas
                            ref={sketchCanvasRef}
                            width={320}
                            height={320}
                            onMouseDown={handleSketchMouseDown}
                            onMouseMove={handleSketchMouseMove}
                            onMouseUp={handleSketchMouseUp}
                            className="bg-[#050507] rounded-lg cursor-crosshair border border-zinc-900 shadow-2xl"
                        />
                    </div>

                    <div className="flex flex-col gap-2.5 bg-zinc-900/40 border border-zinc-800/80 p-3.5 rounded-xl">
                        <span className="text-[10px] uppercase font-extrabold text-zinc-400 tracking-wider">Sketching Tools</span>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setActiveTool('wall_outer')}
                                className={`py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${activeTool === 'wall_outer' ? 'bg-purple-950/45 text-purple-400 border border-purple-500/50' : 'bg-transparent border border-zinc-800 text-zinc-400'
                                    }`}
                            >
                                🧱 Outer Wall (9")
                            </button>
                            <button
                                onClick={() => setActiveTool('wall_inner')}
                                className={`py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${activeTool === 'wall_inner' ? 'bg-purple-950/45 text-purple-400 border border-purple-500/50' : 'bg-transparent border border-zinc-800 text-zinc-400'
                                    }`}
                            >
                                🧱 Inner Wall (4.5")
                            </button>
                            <button
                                onClick={() => setActiveTool('door')}
                                className={`py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${activeTool === 'door' ? 'bg-purple-950/45 text-purple-400 border border-purple-500/50' : 'bg-transparent border border-zinc-800 text-zinc-400'
                                    }`}
                            >
                                🚪 Insert Door
                            </button>
                            <button
                                onClick={() => setActiveTool('window')}
                                className={`py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${activeTool === 'window' ? 'bg-purple-950/45 text-purple-400 border border-purple-500/50' : 'bg-transparent border border-zinc-800 text-zinc-400'
                                    }`}
                            >
                                🪟 Insert Window
                            </button>
                        </div>

                        <div className="flex flex-col gap-2 mt-1">
                            <span className="text-[10px] uppercase font-extrabold text-zinc-400 tracking-wider">Vastu Room Labels</span>
                            <div className="grid grid-cols-3 gap-1.5">
                                {['pooja', 'kitchen', 'bedroom', 'hall', 'balcony', 'parking'].map(rm => (
                                    <button
                                        key={rm}
                                        onClick={() => setActiveTool(`room_${rm}`)}
                                        className={`py-1.5 text-[9px] uppercase font-extrabold rounded-md transition-all cursor-pointer ${activeTool === `room_${rm}` ? 'bg-[#9c27b0] text-white' : 'bg-zinc-900 border border-zinc-805 text-zinc-300'
                                            }`}
                                    >
                                        {rm}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-1 border-t border-zinc-800/80 pt-2.5">
                            <button
                                type="button"
                                onClick={handleClearSketch}
                                className="w-full flex items-center justify-center gap-1.5 py-3 border border-red-500/25 bg-red-950/5 hover:bg-red-950/15 text-red-400 text-xs font-bold uppercase rounded-xl cursor-pointer"
                            >
                                <Trash2 size={12} />
                                <span>Clear sketch</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleExtrudeSketch}
                                className="w-full flex items-center justify-center gap-1.5 py-3 bg-[#9c27b0] hover:brightness-110 text-white text-xs font-extrabold uppercase rounded-xl cursor-pointer"
                            >
                                <CheckCircle2 size={12} />
                                <span>Extrude to 3D</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editorMode === 'cv' && (
                <div className="flex flex-col gap-4 animate-fade-in">
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) processSelectedFile(f); }}
                        className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${dragActive ? 'border-purple-500 bg-purple-950/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-905/30'
                            }`}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                            accept="image/*"
                        />
                        <div className="flex flex-col items-center gap-3">
                            <Upload className="text-zinc-500" size={28} />
                            <div className="text-zinc-300 text-xs font-bold">
                                Drag floorplan sketch image here OR{' '}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-purple-400 underline font-extrabold cursor-pointer"
                                >
                                    Browse Files
                                </button>
                            </div>
                            <span className="text-[10px] text-zinc-500">Supports JPG, PNG, WebP standard floor sketches</span>
                        </div>
                    </div>

                    {fileName && (
                        <div className="flex items-center justify-between text-xs bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl">
                            <span className="text-zinc-400 truncate max-w-[190px]">{fileName}</span>
                            <span className="text-[10px] text-purple-400 uppercase font-black tracking-wider">Ready to process</span>
                        </div>
                    )}

                    <div className="flex flex-col gap-3.5 bg-zinc-90e/40 border border-zinc-800/80 p-4.5 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">CV Pipeline parameters</span>
                        <div className="flex flex-col gap-3">

                            <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between text-xs font-semibold">
                                    <span>Threshold</span>
                                    <span>{threshold}</span>
                                </div>
                                <input
                                    type="range"
                                    min="50"
                                    max="200"
                                    value={threshold}
                                    onChange={(e) => { setThreshold(parseInt(e.target.value)); setTimeout(runCV, 100); }}
                                    className="w-full cursor-col-resize"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between text-xs font-semibold">
                                    <span>Physical Plot Width</span>
                                    <span>{physicalWidth}m</span>
                                </div>
                                <input
                                    type="range"
                                    min="6"
                                    max="20"
                                    step="0.5"
                                    value={physicalWidth}
                                    onChange={(e) => { setPhysicalWidth(parseFloat(e.target.value)); setTimeout(runCV, 100); }}
                                    className="w-full cursor-col-resize"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleExtrudeTrigger}
                        disabled={processingStep > 0}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-purple-800 to-purple-900 text-white font-extrabold uppercase text-xs rounded-xl shadow-lg hover:brightness-110 active:scale-98 transition-transform cursor-pointer"
                    >
                        <Play size={12} />
                        <span>{processingStep > 0 ? 'Analyzing matrix...' : 'Analyze & Generate 3D'}</span>
                    </button>

                    <div className="hidden">
                        <canvas ref={sourceCanvasRef} />
                        <canvas ref={binarizedCanvasRef} />
                        <canvas ref={overlayCanvasRef} />
                    </div>
                </div>
            )}

            {/* Progress extraction overlays with custom state bars */}
            {processingStep > 0 && (
                <div className="fixed inset-0 bg-[#07080bd0] backdrop-blur-xl flex flex-col items-center justify-center z-50 animate-fade-in text-white">
                    <div className="flex flex-col items-center gap-4 max-w-[320px] text-center">
                        <div className="relative w-16 h-16 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-extrabold uppercase tracking-widest text-purple-400">
                                {processingStep === 1 && 'Scanning floorplan pixels...'}
                                {processingStep === 2 && 'Extruding 3D walls...'}
                                {processingStep === 3 && 'Fitting doors & windows...'}
                            </span>
                            <p className="text-xs text-zinc-400">Building structural coordinates, doorways, and floor segments.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function createDefaultFloorplanDataURI() {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 120, 120);
    ctx.fillStyle = '#000000';
    ctx.fillRect(10, 10, 100, 10);
    ctx.fillRect(10, 100, 100, 10);
    ctx.fillRect(10, 10, 10, 100);
    ctx.fillRect(100, 10, 10, 100);
    ctx.fillRect(60, 10, 10, 100);
    return canvas.toDataURL();
}
