import React, { useMemo, useRef, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// -------------------------------------------------------------------
// 1. EXPANDED FINISHES & DECORATIVE COLOR PALETTES
// -------------------------------------------------------------------
const WALL_FINISHES = {
    'Asian Paints Off-White': '#eae6df',
    'Exposed Red Brick': '#b85a3c',
    'Granite Cladding': '#566573',
    'Venetian Plaster': '#cfc4b2',
    'Sand Finish Plaster': '#a19382'
};

const FLOOR_MATERIALS = {
    'Vitrified Ivory Tiles': { color: '#f0ebd8', roughness: 0.2 },
    'Makrana White Marble': { color: '#f5f6fa', roughness: 0.15 },
    'Chettinad Clay Tiles': { color: '#a83d31', roughness: 0.8 },
    'Natural Hardwood': { color: '#8e5431', roughness: 0.4 },
    'Polished IPS Concrete': { color: '#7f8c8d', roughness: 0.25 }
};

const ROOFING_OPTIONS = {
    'Spanish Terracotta Tile': '#e67e22',
    'Dark Slate Shingles': '#34495e',
    'Metal Standing Seam': '#7f8c8d',
    'Flat Concrete Slab': '#505050'
};

const DOOR_WINDOW_FINISHES = {
    'Oak Wood Frame': '#a07040',
    'Modern Black Aluminum': '#1a1a1a',
    'White Vinyl': '#e8e8e8',
    'Frosted Glass': '#96d1eb'
};

// -------------------------------------------------------------------
// 2. EXPORTER COMPONENT (Binds canvas parse commands to window hooks)
// -------------------------------------------------------------------
function SceneExporter() {
    const { scene } = useThree();

    useEffect(() => {
        window.exportToGLTF = async () => {
            const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
            const exporter = new GLTFExporter();
            exporter.parse(
                scene,
                async (gltf) => {
                    const stringified = JSON.stringify(gltf, null, 2);
                    const blob = new Blob([stringified], { type: 'application/json' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = 'vision-multistory-vastu.gltf';
                    link.click();

                    try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                            const fileName = `exports/${user.id}/gltf_${Date.now()}.gltf`;
                            const file = new File([blob], `gltf_${Date.now()}.gltf`, { type: 'application/json' });
                            const { data, error } = await supabase.storage
                                .from('exported-cad')
                                .upload(fileName, file);

                            if (!error && data) {
                                const { data: { publicUrl } } = supabase.storage
                                    .from('exported-cad')
                                    .getPublicUrl(fileName);

                                await supabase.from('exports').insert({
                                    user_id: user.id,
                                    export_type: 'glb',
                                    file_url: publicUrl
                                });
                            }
                        }
                    } catch (err) {
                        console.warn("Supabase gltf upload skipped:", err);
                    }
                },
                (err) => console.error('GLTF Export failed:', err),
                { binary: false }
            );
        };

        window.exportToOBJ = async () => {
            const { OBJExporter } = await import('three/addons/exporters/OBJExporter.js');
            const exporter = new OBJExporter();
            const stringified = exporter.parse(scene);
            const blob = new Blob([stringified], { type: 'text/plain' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'vision-multistory-vastu.obj';
            link.click();

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const fileName = `exports/${user.id}/obj_${Date.now()}.obj`;
                    const file = new File([blob], `obj_${Date.now()}.obj`, { type: 'text/plain' });
                    const { data, error } = await supabase.storage
                        .from('exported-cad')
                        .upload(fileName, file);

                    if (!error && data) {
                        const { data: { publicUrl } } = supabase.storage
                            .from('exported-cad')
                            .getPublicUrl(fileName);

                        await supabase.from('exports').insert({
                            user_id: user.id,
                            export_type: 'obj',
                            file_url: publicUrl
                        });
                    }
                }
            } catch (err) {
                console.warn("Supabase obj upload skipped:", err);
            }
        };

        return () => {
            window.exportToGLTF = null;
            window.exportToOBJ = null;
        };
    }, [scene]);

    return null;
}

// -------------------------------------------------------------------
// 3. FPS WALKTHROUGH CONTROLS (Joystick integrated)
// -------------------------------------------------------------------
function FPSWalkthroughControls({ active, houseWidth, houseLength }) {
    const { camera } = useThree();
    const keys = useRef({ w: false, a: false, s: false, d: false });
    const rotation = useRef({ yaw: 0, pitch: 0 });

    useEffect(() => {
        if (!active) return;

        camera.position.set(houseWidth / 2, 1.65, houseLength - 1.5);
        camera.lookAt(new THREE.Vector3(houseWidth / 2, 1.65, houseLength - 5));
        rotation.current = { yaw: 0, pitch: 0 };

        const handleKeyDown = (e) => {
            const k = e.key.toLowerCase();
            if (k === 'w' || k === 'arrowup') keys.current.w = true;
            if (k === 'a' || k === 'arrowleft') keys.current.a = true;
            if (k === 's' || k === 'arrowdown') keys.current.s = true;
            if (k === 'd' || k === 'arrowright') keys.current.d = true;
        };

        const handleKeyUp = (e) => {
            const k = e.key.toLowerCase();
            if (k === 'w' || k === 'arrowup') keys.current.w = false;
            if (k === 'a' || k === 'arrowleft') keys.current.a = false;
            if (k === 's' || k === 'arrowdown') keys.current.s = false;
            if (k === 'd' || k === 'arrowright') keys.current.d = false;
        };

        const handleMouseMove = (e) => {
            if (document.pointerLockElement !== document.body) return;
            const sensitivity = 0.002;
            rotation.current.yaw -= e.movementX * sensitivity;
            rotation.current.pitch -= e.movementY * sensitivity;
            rotation.current.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotation.current.pitch));
        };

        const handleContainerClick = () => {
            if (document.pointerLockElement !== document.body) {
                document.body.requestPointerLock();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseMove);

        const canvas = document.querySelector('canvas');
        if (canvas) canvas.addEventListener('click', handleContainerClick);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleMouseMove);
            if (canvas) canvas.removeEventListener('click', handleContainerClick);
            if (document.pointerLockElement === document.body) {
                document.exitPointerLock();
            }
        };
    }, [active, houseWidth, houseLength, camera]);

    useFrame((state, delta) => {
        if (!active) return;

        const forwardVal = keys.current.w ? 1 : keys.current.s ? -1 : 0;
        const strafeVal = keys.current.d ? 1 : keys.current.a ? -1 : 0;

        if (!window.joystickMovement) {
            window.joystickMovement = { x: 0, y: 0, turn: 0 };
        }
        const joy = window.joystickMovement;

        const combForward = forwardVal !== 0 ? forwardVal : joy.y;
        const combStrafe = strafeVal !== 0 ? strafeVal : joy.x;

        const moveSpeed = 4.0 * delta;
        const joyTurnSpeed = 1.6 * delta;

        if (joy.turn !== 0) {
            rotation.current.yaw -= joy.turn * joyTurnSpeed;
        }

        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.current.yaw);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.current.yaw);

        if (combForward > 0) camera.position.addScaledVector(forward, moveSpeed);
        if (combForward < 0) camera.position.addScaledVector(forward, -moveSpeed);
        if (combStrafe < 0) camera.position.addScaledVector(right, -moveSpeed);
        if (combStrafe > 0) camera.position.addScaledVector(right, moveSpeed);

        // Keep ground heights
        camera.position.x = Math.max(0.1, Math.min(houseWidth - 0.1, camera.position.x));
        camera.position.z = Math.max(0.1, Math.min(houseLength - 0.1, camera.position.z));
        camera.position.y = 1.65;

        const lookTarget = new THREE.Vector3(0, 0, -1)
            .applyAxisAngle(new THREE.Vector3(1, 0, 0), rotation.current.pitch)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.current.yaw)
            .add(camera.position);

        camera.lookAt(lookTarget);
    });

    return null;
}

// -------------------------------------------------------------------
// 4. CAMERA VIEWS HANDLER (Joystick perspective-aligned movement)
// -------------------------------------------------------------------
function CameraSync({ mode, houseWidth, houseLength, orbitRef }) {
    const { camera } = useThree();

    useEffect(() => {
        if (mode === 'front') {
            camera.position.set(houseWidth / 2, 6, houseLength + 10);
        } else if (mode === 'orbit') {
            camera.position.set(houseWidth * 1.3, houseWidth * 1.2, houseLength * 1.4);
        }
    }, [mode, houseWidth, houseLength, camera]);

    useFrame((state, delta) => {
        if (mode !== 'orbit' || !orbitRef.current) return;
        if (!window.joystickMovement) return;
        const { x, y, turn } = window.joystickMovement;

        if (x === 0 && y === 0 && turn === 0) return;

        const speed = 10 * delta;

        // Perspective-aligned panning calculations
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0;
        right.normalize();

        const moveVector = new THREE.Vector3();
        moveVector.addScaledVector(forward, y * speed);
        moveVector.addScaledVector(right, x * speed);

        orbitRef.current.target.x += moveVector.x;
        orbitRef.current.target.z += moveVector.z;
        camera.position.x += moveVector.x;
        camera.position.z += moveVector.z;

        if (turn !== 0) {
            orbitRef.current.autoRotate = false;
            const angle = turn * 1.8 * delta;

            const target = orbitRef.current.target;
            const dx = camera.position.x - target.x;
            const dz = camera.position.z - target.z;

            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            camera.position.x = target.x + (dx * cos - dz * sin);
            camera.position.z = target.z + (dx * sin + dz * cos);
        }

        orbitRef.current.update();
    });

    return null;
}

// -------------------------------------------------------------------
// 5. INTUITIVE GEOMETRY DRAWING COMPONENTS
// -------------------------------------------------------------------
const AssetGeometry = React.memo(({ type, color }) => {
    const cTheme = color || '#7f8c8d';

    switch (type) {
        case 'car':
            return (
                <group>
                    <mesh castShadow receiveShadow position={[0, 0.35, 0]}>
                        <boxGeometry args={[1.7, 0.5, 3.8]} />
                        <meshStandardMaterial color={cTheme} roughness={0.2} metalness={0.8} />
                    </mesh>
                    <mesh castShadow position={[0, 0.85, -0.2]}>
                        <boxGeometry args={[1.5, 0.5, 1.8]} />
                        <meshStandardMaterial color={cTheme} roughness={0.2} metalness={0.8} />
                    </mesh>
                    <mesh position={[0, 0.87, 0.3]}>
                        <boxGeometry args={[1.4, 0.45, 0.6]} />
                        <meshStandardMaterial color="#1a252f" roughness={0.05} opacity={0.65} transparent />
                    </mesh>
                    <mesh position={[-0.85, 0.16, -1.1]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.3, 0.3, 0.25, 12]} />
                        <meshStandardMaterial color="#111" roughness={0.9} />
                    </mesh>
                    <mesh position={[0.85, 0.16, -1.1]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.3, 0.3, 0.25, 12]} />
                        <meshStandardMaterial color="#111" roughness={0.9} />
                    </mesh>
                </group>
            );

        case 'bed':
            return (
                <group>
                    <mesh castShadow position={[0, 0.15, 0]}>
                        <boxGeometry args={[1.6, 0.3, 2.0]} />
                        <meshStandardMaterial color="#5c4033" roughness={0.8} />
                    </mesh>
                    <mesh castShadow position={[0, 0.4, 0.05]}>
                        <boxGeometry args={[1.5, 0.3, 1.9]} />
                        <meshStandardMaterial color="#ecf0f1" roughness={0.9} />
                    </mesh>
                </group>
            );

        case 'sofa':
            return (
                <group>
                    <mesh castShadow position={[0, 0.2, 0]}>
                        <boxGeometry args={[2.0, 0.3, 0.8]} />
                        <meshStandardMaterial color="#d35400" roughness={0.7} />
                    </mesh>
                    <mesh castShadow position={[0, 0.55, -0.35]}>
                        <boxGeometry args={[2.0, 0.5, 0.15]} />
                        <meshStandardMaterial color="#d35400" roughness={0.7} />
                    </mesh>
                </group>
            );

        case 'dining':
            return (
                <group>
                    <mesh castShadow position={[0, 0.75, 0]}>
                        <boxGeometry args={[1.6, 0.05, 1.0]} />
                        <meshStandardMaterial color="#5c4033" roughness={0.6} />
                    </mesh>
                    <mesh position={[-0.7, 0.375, -0.4]}>
                        <cylinderGeometry args={[0.03, 0.03, 0.7]} />
                        <meshStandardMaterial color="#222" metalness={0.7} roughness={0.2} />
                    </mesh>
                    <mesh position={[0.7, 0.375, -0.4]}>
                        <cylinderGeometry args={[0.03, 0.03, 0.7]} />
                        <meshStandardMaterial color="#222" metalness={0.7} roughness={0.2} />
                    </mesh>
                </group>
            );

        case 'kitchen':
            return (
                <group>
                    <mesh castShadow position={[0, 0.42, 0]}>
                        <boxGeometry args={[2.0, 0.84, 0.6]} />
                        <meshStandardMaterial color="#ecf0f1" roughness={0.7} />
                    </mesh>
                </group>
            );

        case 'wc':
            return (
                <group>
                    <mesh castShadow position={[0, 0.2, 0.1]}>
                        <boxGeometry args={[0.45, 0.4, 0.6]} />
                        <meshStandardMaterial color="#ffffff" roughness={0.1} />
                    </mesh>
                </group>
            );

        case 'sink':
            return (
                <group>
                    <mesh castShadow position={[0, 0.4, 0]}>
                        <boxGeometry args={[0.8, 0.8, 0.5]} />
                        <meshStandardMaterial color="#5a4030" roughness={0.8} />
                    </mesh>
                </group>
            );

        case 'wardrobe':
            return (
                <mesh castShadow position={[0, 1.0, 0]}>
                    <boxGeometry args={[1.4, 2.0, 0.6]} />
                    <meshStandardMaterial color="#5a4030" roughness={0.85} />
                </mesh>
            );

        case 'tv':
            return (
                <group>
                    <mesh castShadow position={[0, 0.25, 0]}>
                        <boxGeometry args={[1.6, 0.4, 0.4]} />
                        <meshStandardMaterial color="#2d2218" roughness={0.9} />
                    </mesh>
                    <mesh position={[0, 0.8, 0]}>
                        <boxGeometry args={[1.3, 0.7, 0.05]} />
                        <meshStandardMaterial color="#080808" roughness={0.2} />
                    </mesh>
                </group>
            );

        case 'plant':
            return (
                <group>
                    <mesh position={[0, 0.2, 0]}>
                        <cylinderGeometry args={[0.2, 0.15, 0.4, 10]} />
                        <meshStandardMaterial color="#5a4030" roughness={0.9} />
                    </mesh>
                    <mesh position={[0, 0.48, 0]}>
                        <sphereGeometry args={[0.25, 8, 8]} />
                        <meshStandardMaterial color="#27ae60" roughness={0.9} />
                    </mesh>
                </group>
            );

        default:
            return (
                <mesh castShadow position={[0, 0.5, 0]}>
                    <boxGeometry args={[0.8, 1, 0.8]} />
                    <meshStandardMaterial color="#7f8c8d" />
                </mesh>
            );
    }
});

// -------------------------------------------------------------------
// 6. MAIN VIEWPORT CANVAS INTEGRATION (Indian Multi-Story Dynamic Stack)
// -------------------------------------------------------------------
export default function ThreeViewport({
    houseData,
    selectedAssetId,
    setSelectedAssetId,
    onUpdateAsset,
    onDeleteAsset,
    cameraMode,
    showRoof,
    wallColor,
    floorTexture,
    roofColor,
    doorFinish,
    windowFinish,
    floorCount = 1,          // G+0 to G+10 stacking triggers
    roofStyle = 'rcc_flat',  // 'rcc_flat' | 'mangalore_slope' | 'metal_sheet' | 'pergola_glass'
    showSolarPanels = false,
    showWaterTank = false,
    showMumty = false,
    parapetRailing = 'steel_grill',
    balconyFinishing = 'steel_grill'
}) {
    const {
        dimensions = { width: 12, length: 12, height: 3.0 },
        walls = [],
        openings = [],
        assets = []
    } = houseData || {};

    const orbitRef = useRef();

    // Precompute static wall segments via useMemo & verify indices
    const wallSegments = useMemo(() => {
        if (!walls || !Array.isArray(walls)) return [];

        const segments = [];
        walls.forEach((wall) => {
            if (!wall) return;
            const x1 = wall.x1 ?? 0;
            const y1 = wall.y1 ?? 0;
            const x2 = wall.x2 ?? 0;
            const y2 = wall.y2 ?? 0;
            const thickness = wall.thickness ?? 0.15;
            const wHeight = wall.height ?? 3.0;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const length = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);

            const wOpenings = (openings || []).filter((op) => op && op.wallId === wall.id);

            if (wOpenings.length === 0) {
                segments.push({
                    id: `seg_${wall.id}_main`,
                    position: [(x1 + x2) / 2, wHeight / 2, (y1 + y2) / 2],
                    args: [length || 0.1, wHeight, thickness],
                    rotation: [0, -angle, 0]
                });
            } else {
                const sorted = wOpenings
                    .map((op) => ({ ...op, dist: Math.hypot((op.x ?? 0) - x1, (op.y ?? 0) - y1) }))
                    .sort((a, b) => a.dist - b.dist);

                let currentDist = 0;
                sorted.forEach((op, idx) => {
                    const opWidth = op.width ?? 0.9;
                    const opHeight = op.height ?? 2.0;
                    const opSill = op.sillHeight ?? 0;

                    const opStart = op.dist - opWidth / 2;
                    const opEnd = op.dist + opWidth / 2;

                    if (opStart > currentDist) {
                        const chunkLen = opStart - currentDist;
                        const mDist = currentDist + chunkLen / 2;
                        const cx = x1 + Math.cos(angle) * mDist;
                        const cz = y1 + Math.sin(angle) * mDist;
                        segments.push({
                            id: `seg_${wall.id}_c1_${idx}`,
                            position: [cx, wHeight / 2, cz],
                            args: [chunkLen || 0.1, wHeight, thickness],
                            rotation: [0, -angle, 0]
                        });
                    }

                    const headerStart = opSill + opHeight;
                    if (headerStart < wHeight) {
                        const hHeight = wHeight - headerStart;
                        const cx = x1 + Math.cos(angle) * op.dist;
                        const cz = y1 + Math.sin(angle) * op.dist;
                        const cy = headerStart + hHeight / 2;
                        segments.push({
                            id: `seg_${wall.id}_c2_${idx}`,
                            position: [cx, cy, cz],
                            args: [opWidth || 0.1, hHeight, thickness],
                            rotation: [0, -angle, 0]
                        });
                    }

                    if (opSill > 0.05) {
                        const cx = x1 + Math.cos(angle) * op.dist;
                        const cz = y1 + Math.sin(angle) * op.dist;
                        const cy = opSill / 2;
                        segments.push({
                            id: `seg_${wall.id}_c3_${idx}`,
                            position: [cx, cy, cz],
                            args: [opWidth || 0.1, opSill, thickness],
                            rotation: [0, -angle, 0]
                        });
                    }

                    currentDist = opEnd;
                });

                if (length > currentDist) {
                    const chunkLen = length - currentDist;
                    const mDist = currentDist + chunkLen / 2;
                    const cx = x1 + Math.cos(angle) * mDist;
                    const cz = y1 + Math.sin(angle) * mDist;
                    segments.push({
                        id: `seg_${wall.id}_c4`,
                        position: [cx, wHeight / 2, cz],
                        args: [chunkLen || 0.1, wHeight, thickness],
                        rotation: [0, -angle, 0]
                    });
                }
            }
        });
        return segments;
    }, [walls, openings]);

    // Wall paint properties mapping
    const computedWallColor = useMemo(() => {
        return WALL_FINISHES[wallColor] || '#eae6df';
    }, [wallColor]);

    // Flooring details
    const computedFloor = useMemo(() => {
        return FLOOR_MATERIALS[floorTexture] || { color: '#f0ebd8', roughness: 0.2 };
    }, [floorTexture]);

    // Roofing options
    const computedRoofColor = useMemo(() => {
        return ROOFING_OPTIONS[roofColor] || '#e67e22';
    }, [roofColor]);

    // Door/Window frame finishes
    const computedFrameColor = useMemo(() => {
        return DOOR_WINDOW_FINISHES[doorFinish] || '#a07040';
    }, [doorFinish]);

    const computedWindowColor = useMemo(() => {
        return DOOR_WINDOW_FINISHES[windowFinish] || '#1a1a1a';
    }, [windowFinish]);

    // Railing rendering styles
    const computedGrillColor = '#2c3e50';
    const balconyRailingWireframe = balconyFinishing === 'steel_grill';

    // Pillars concrete positions coordinates boundaries
    const corners = useMemo(() => {
        const w = dimensions.width || 12;
        const l = dimensions.length || 12;
        return [
            [0.1, 0.1],
            [w - 0.1, 0.1],
            [w - 0.1, l - 0.1],
            [0.1, l - 0.1]
        ];
    }, [dimensions]);

    const totalHeight = floorCount * dimensions.height;

    // Floor iterations stack lists
    const levelIndexes = Array.from({ length: floorCount }, (_, i) => i);

    return (
        <div className="w-full h-full relative bg-[#07080b]">
            {/* 3D Canvas webgl setup */}
            <Canvas
                dpr={[1, 1.5]}
                shadows
                camera={{ position: [14, 14, 18], fov: 45 }}
                gl={{ antialias: true, preserveDrawingBuffer: true }}
            >
                <color attach="background" args={['#07080b']} />
                <fog attach="fog" args={['#07080b', 30, 85]} />

                {/* CAD Grid Map centered on active house dimensions */}
                <gridHelper
                    args={[100, 100, '#2d2d3a', '#17171f']}
                    position={[dimensions.width / 2, 0, dimensions.length / 2]}
                />

                <ambientLight intensity={0.5} />
                <directionalLight
                    castShadow
                    position={[20, 35, 25]}
                    intensity={0.9}
                    shadow-mapSize={[1024, 1024]}
                    shadow-camera-far={80}
                    shadow-camera-left={-30}
                    shadow-camera-right={30}
                    shadow-camera-top={30}
                    shadow-camera-bottom={-30}
                />

                {/* 3D VASTU SHASTRA DIRECTION INDICATORS ON GROUND FLOOR */}
                <group>
                    {/* North - Green Disc */}
                    <mesh position={[dimensions.width / 2, 0.02, -1.8]}>
                        <cylinderGeometry args={[0.5, 0.5, 0.05, 16]} />
                        <meshBasicMaterial color="#10b981" />
                    </mesh>

                    {/* South - Red Disc */}
                    <mesh position={[dimensions.width / 2, 0.02, dimensions.length + 1.8]}>
                        <cylinderGeometry args={[0.5, 0.5, 0.05, 16]} />
                        <meshBasicMaterial color="#ef4444" />
                    </mesh>

                    {/* East - Blue Disc */}
                    <mesh position={[dimensions.width + 1.8, 0.02, dimensions.length / 2]}>
                        <cylinderGeometry args={[0.5, 0.5, 0.05, 16]} />
                        <meshBasicMaterial color="#3b82f6" />
                    </mesh>

                    {/* West - Yellow Disc */}
                    <mesh position={[-1.8, 0.02, dimensions.length / 2]}>
                        <cylinderGeometry args={[0.5, 0.5, 0.05, 16]} />
                        <meshBasicMaterial color="#f59e0b" />
                    </mesh>
                </group>

                {/* MULTI-STORY STACK LOOPS */}
                {levelIndexes.map((lvl) => {
                    const elevY = lvl * dimensions.height;
                    return (
                        <group key={`floor_stack_level_${lvl}`} position={[0, elevY, 0]}>

                            {/* Floor slice slab */}
                            <mesh
                                receiveShadow
                                position={[dimensions.width / 2, -0.05, dimensions.length / 2]}
                            >
                                <boxGeometry args={[dimensions.width || 12, 0.1, dimensions.length || 12]} />
                                <meshStandardMaterial
                                    color={computedFloor.color}
                                    roughness={computedFloor.roughness}
                                    metalness={floorTexture === 'Vitrified Ivory Tiles' || floorTexture === 'Makrana White Marble' ? 0.15 : 0}
                                />
                            </mesh>

                            {/* Balconies mesh on upper levels */}
                            {lvl > 0 && (
                                <group position={[dimensions.width / 2, 0.5, dimensions.length + 0.5]}>
                                    {/* Extension floor */}
                                    <mesh position={[0, -0.55, -0.25]} receiveShadow>
                                        <boxGeometry args={[dimensions.width * 0.8, 0.1, 1.0]} />
                                        <meshStandardMaterial color="#2d3748" roughness={0.7} />
                                    </mesh>
                                    {/* Steel grill or Glass panel railings */}
                                    <mesh position={[0, 0.05, 0.25]}>
                                        <boxGeometry args={[dimensions.width * 0.8, 0.9, 0.03]} />
                                        <meshStandardMaterial
                                            color={computedGrillColor}
                                            wireframe={balconyRailingWireframe}
                                            transparent={!balconyRailingWireframe}
                                            opacity={balconyRailingWireframe ? 1.0 : 0.45}
                                        />
                                    </mesh>
                                </group>
                            )}

                            {/* Placed walls */}
                            <group>
                                {wallSegments.map((seg) => (
                                    <mesh
                                        key={`${seg.id}_lvl_${lvl}`}
                                        castShadow
                                        receiveShadow
                                        position={seg.position}
                                        rotation={seg.rotation}
                                    >
                                        <boxGeometry args={seg.args} />
                                        <meshStandardMaterial
                                            color={computedWallColor}
                                            roughness={0.8}
                                            metalness={0.0}
                                        />
                                    </mesh>
                                ))}
                            </group>

                            {/* Placed openings */}
                            <group>
                                {(openings || []).map((op) => {
                                    if (!op) return null;
                                    const dx = walls.find((w) => w && w.id === op.wallId);
                                    const wallAngle = dx ? Math.atan2(dx.y2 - dx.y1, dx.x2 - dx.x1) : 0;
                                    const sillHeight = op.sillHeight ?? 0;
                                    const opHeight = op.height ?? 2.0;
                                    const opWidth = op.width ?? 0.9;

                                    return (
                                        <group
                                            key={`${op.id}_lvl_${lvl}`}
                                            position={[op.x ?? 0, sillHeight + opHeight / 2, op.y ?? 0]}
                                            rotation={[0, -wallAngle, 0]}
                                        >
                                            {op.type === 'door' ? (
                                                <group>
                                                    <mesh>
                                                        <boxGeometry args={[opWidth, opHeight, 0.28]} />
                                                        <meshStandardMaterial color={computedFrameColor} roughness={0.7} wireframe />
                                                    </mesh>
                                                    <mesh position={[opWidth * 0.44, 0, 0.2]} rotation={[0, Math.PI / 3.5, 0]}>
                                                        <boxGeometry args={[opWidth * 0.94, opHeight * 0.96, 0.05]} />
                                                        <meshStandardMaterial color={computedFrameColor} roughness={0.65} />
                                                    </mesh>
                                                </group>
                                            ) : (
                                                <group>
                                                    <mesh>
                                                        <boxGeometry args={[opWidth, opHeight, 0.22]} />
                                                        <meshStandardMaterial color={computedWindowColor} roughness={0.5} wireframe />
                                                    </mesh>
                                                    <mesh>
                                                        <boxGeometry args={[opWidth * 0.92, opHeight * 0.92, 0.02]} />
                                                        <meshStandardMaterial
                                                            color="#aed6f1"
                                                            transparent
                                                            opacity={0.45}
                                                            roughness={0.05}
                                                        />
                                                    </mesh>
                                                </group>
                                            )}
                                        </group>
                                    );
                                })}
                            </group>

                            {/* Placed furnitures */}
                            <group>
                                {(assets || []).map((asset) => {
                                    if (!asset) return null;
                                    return (
                                        <group
                                            key={`${asset.id}_lvl_${lvl}`}
                                            position={[asset.x ?? 5.5, 0, asset.z ?? 5.5]}
                                            rotation={[0, asset.rotation || 0, 0]}
                                            scale={[asset.scale || 1, asset.scale || 1, asset.scale || 1]}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedAssetId(asset.id);
                                            }}
                                        >
                                            <AssetGeometry type={asset.type} color={asset.color} />
                                            {selectedAssetId === asset.id && lvl === 0 && (
                                                <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                                                    <ringGeometry args={[0.9, 1.05, 32]} />
                                                    <meshBasicMaterial color="#a855f7" side={THREE.DoubleSide} />
                                                </mesh>
                                            )}
                                        </group>
                                    );
                                })}
                            </group>

                        </group>
                    );
                })}

                {/* STRUCTURAL PILLAR COLUMNS going bottom to top */}
                <group>
                    {corners.map(([cx, cz], idx) => (
                        <mesh key={`column_post_${idx}`} position={[cx, totalHeight / 2, cz]}>
                            <cylinderGeometry args={[0.18, 0.18, totalHeight, 12]} />
                            <meshStandardMaterial color="#7f8c8d" roughness={0.65} metalness={0.1} />
                        </mesh>
                    ))}
                </group>

                {/* ACCENDING EXTERNAL STAIRCASES FOR MULTIPLEX BULKS */}
                {floorCount > 1 && (
                    <group position={[-1.1, 0, dimensions.length / 2]}>
                        {Array.from({ length: 14 * floorCount }).map((_, stepIdx) => {
                            const stepY = (stepIdx * totalHeight) / (14 * floorCount);
                            const progress = stepIdx / (14 * floorCount);
                            const stepZ = (progress * dimensions.length) % dimensions.length;
                            return (
                                <mesh
                                    key={`stair_step_${stepIdx}`}
                                    position={[0, stepY + 0.05, stepZ]}
                                    receiveShadow
                                    castShadow
                                >
                                    <boxGeometry args={[1.0, 0.1, 0.32]} />
                                    <meshStandardMaterial color="#4a5568" roughness={0.8} />
                                </mesh>
                            );
                        })}
                    </group>
                )}

                {/* ROOFTOP EXTREMITIES & ROOF OVERLAY SUITES */}
                {showRoof && (
                    <group position={[0, totalHeight, 0]}>

                        {/* A. RCC Concrete Flat Shutter Parapets */}
                        {roofStyle === 'rcc_flat' && (
                            <group>
                                {/* Roof Slab */}
                                <mesh position={[dimensions.width / 2, 0.05, dimensions.length / 2]} receiveShadow castShadow>
                                    <boxGeometry args={[dimensions.width + 0.3, 0.12, dimensions.length + 0.3]} />
                                    <meshStandardMaterial color="#4a4a4a" roughness={0.7} />
                                </mesh>

                                {/* Parapet walls around roof deck */}
                                <mesh position={[dimensions.width / 2, 0.55, 0.08]} castShadow>
                                    <boxGeometry args={[dimensions.width + 0.3, 0.9, 0.1]} />
                                    <meshStandardMaterial color={computedWallColor} />
                                </mesh>
                                <mesh position={[dimensions.width / 2, 0.55, dimensions.length - 0.08]} castShadow>
                                    <boxGeometry args={[dimensions.width + 0.3, 0.9, 0.1]} />
                                    <meshStandardMaterial color={computedWallColor} />
                                </mesh>
                                <mesh position={[0.08, 0.55, dimensions.length / 2]} castShadow>
                                    <boxGeometry args={[0.1, 0.9, dimensions.length + 0.3]} />
                                    <meshStandardMaterial color={computedWallColor} />
                                </mesh>
                                <mesh position={[dimensions.width - 0.08, 0.55, dimensions.length / 2]} castShadow>
                                    <boxGeometry args={[0.1, 0.9, dimensions.length + 0.3]} />
                                    <meshStandardMaterial color={computedWallColor} />
                                </mesh>

                                {/* Overhead PVC Water Tank (Yellow color) under Northwest corner */}
                                {showWaterTank && (
                                    <group position={[1.8, 1.0, 1.8]}>
                                        <mesh position={[0, -0.3, 0]}>
                                            <boxGeometry args={[1.2, 0.5, 1.2]} />
                                            <meshStandardMaterial color="#555" />
                                        </mesh>
                                        <mesh castShadow position={[0, 0.45, 0]}>
                                            <cylinderGeometry args={[0.5, 0.5, 1.0, 16]} />
                                            <meshStandardMaterial color="#d4ac0d" roughness={0.1} />
                                        </mesh>
                                        <mesh position={[0, 0.97, 0]}>
                                            <cylinderGeometry args={[0.42, 0.42, 0.08, 16]} />
                                            <meshStandardMaterial color="#333" />
                                        </mesh>
                                    </group>
                                )}

                                {/* Staircase Mumty Cabin */}
                                {showMumty && (
                                    <mesh position={[1.5, 1.15, dimensions.length / 2]} castShadow receiveShadow>
                                        <boxGeometry args={[2.0, 2.2, 2.5]} />
                                        <meshStandardMaterial color={computedWallColor} />
                                    </mesh>
                                )}

                                {/* Rooftop Solar Panels */}
                                {showSolarPanels && (
                                    <group position={[dimensions.width - 2.5, 0.45, dimensions.length / 2]}>
                                        {/* Tilt Stand */}
                                        <mesh position={[0, -0.15, 0]} rotation={[Math.PI / 8, 0, 0]}>
                                            <boxGeometry args={[2.8, 0.05, 1.6]} />
                                            <meshStandardMaterial color="#1a252f" metalness={0.9} roughness={0.1} />
                                        </mesh>
                                        {/* Frame cell lattices */}
                                        <mesh position={[0, -0.14, 0]} rotation={[Math.PI / 8, 0, 0]} wireframe>
                                            <boxGeometry args={[2.82, 0.08, 1.62]} />
                                            <meshStandardMaterial color="#ffffff" />
                                        </mesh>
                                    </group>
                                )}
                            </group>
                        )}

                        {/* B. traditional Mangalore clay ridge styles */}
                        {roofStyle === 'mangalore_slope' && (
                            <mesh
                                castShadow
                                position={[dimensions.width / 2, 1.15, dimensions.length / 2]}
                                rotation={[0, Math.PI / 4, 0]}
                            >
                                <cylinderGeometry args={[0.05, Math.max(dimensions.width, dimensions.length) / 1.3, 2.2, 4, 1]} />
                                <meshStandardMaterial color={computedRoofColor} roughness={0.65} />
                            </mesh>
                        )}

                        {/* C. Industrial corrugated metallic roofing */}
                        {roofStyle === 'metal_sheet' && (
                            <mesh
                                castShadow
                                position={[dimensions.width / 2, 0.6, dimensions.length / 2]}
                                rotation={[Math.PI / 18, 0, 0]}
                            >
                                <boxGeometry args={[dimensions.width + 0.6, 0.15, dimensions.length + 0.6]} />
                                <meshStandardMaterial color="#7f8c8d" metalness={0.9} roughness={0.2} />
                            </mesh>
                        )}

                        {/* D. Modern Sloped Pergola & Glass Canopy */}
                        {roofStyle === 'pergola_glass' && (
                            <group position={[dimensions.width / 2, 1.0, dimensions.length / 2]}>
                                {/* Wood Beam Grid */}
                                <mesh wireframe>
                                    <boxGeometry args={[dimensions.width + 0.4, 0.4, dimensions.length + 0.4]} />
                                    <meshStandardMaterial color="#8e5431" roughness={0.9} />
                                </mesh>
                                {/* Glass Panels */}
                                <mesh position={[0, 0.2, 0]}>
                                    <boxGeometry args={[dimensions.width + 0.3, 0.04, dimensions.length + 0.3]} />
                                    <meshStandardMaterial color="#aed6f1" transparent opacity={0.65} roughness={0.05} />
                                </mesh>
                            </group>
                        )}

                    </group>
                )}

                {/* SceneExporter Binder */}
                <SceneExporter />

                <CameraSync
                    mode={cameraMode}
                    houseWidth={dimensions.width ?? 12}
                    houseLength={dimensions.length ?? 12}
                    orbitRef={orbitRef}
                />

                <OrbitControls
                    ref={orbitRef}
                    enableDamping
                    dampingFactor={0.05}
                    maxPolarAngle={Math.PI / 2.05}
                    minDistance={3}
                    maxDistance={80}
                />

                {cameraMode === 'fps' && (
                    <FPSWalkthroughControls
                        active
                        houseWidth={dimensions.width ?? 12}
                        houseLength={dimensions.length ?? 12}
                    />
                )}
            </Canvas>
        </div>
    );
}
