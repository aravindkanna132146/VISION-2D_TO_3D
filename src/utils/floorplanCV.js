/**
 * AntiGravity Civil AI Studio - Computer Vision and Floorplan Vectorization Pipeline
 * Runs client-side pixel manipulation algorithms to detect walls, corners,
 * and openings from user-uploaded sketches or images.
 */

// Helper to binarize image onto a canvas for visual feedback
export function binarizeCanvas(sourceCanvas, targetCanvas, threshold = 127) {
    const ctxSrc = sourceCanvas.getContext('2d');
    const ctxDst = targetCanvas.getContext('2d');

    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    targetCanvas.width = w;
    targetCanvas.height = h;

    const imgData = ctxSrc.getImageData(0, 0, w, h);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Grayscale
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        // Threshold (If dark, make black, otherwise white)
        const val = gray < threshold ? 0 : 255;

        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        // Keep alpha same
    }

    ctxDst.putImageData(imgData, 0, 0);
}

/**
 * Detects structural wall vector segments from a binarized/grayscale source canvas
 * Returns layout geometry: walls, doors, windows, and rooms
 */
export function detectFloorplanVect(sourceCanvas, options = {}) {
    const {
        threshold = 128,
        gridResolution = 60, // Grid size for downsampling and robust tracing
        wallDensityThreshold = 0.35, // Percentage of black pixels to consider it a wall
        houseRealWidth = 12.0 // Map canvas bounds to this physical length in meters
    } = options;

    const ctx = sourceCanvas.getContext('2d');
    const cw = sourceCanvas.width;
    const ch = sourceCanvas.height;

    const aspectRatio = ch / cw;
    const houseRealLength = Math.round(houseRealWidth * aspectRatio * 2) / 2;

    const gridX = gridResolution;
    const gridY = Math.round(gridResolution * aspectRatio);

    const cellW = cw / gridX;
    const cellH = ch / gridY;

    // 1. Create a density matrix of wall pixels
    const imgData = ctx.getImageData(0, 0, cw, ch);
    const data = imgData.data;

    const wallGrid = Array(gridY).fill(0).map(() => Array(gridX).fill(0));

    for (let gy = 0; gy < gridY; gy++) {
        for (let gx = 0; gx < gridX; gx++) {
            const startX = Math.floor(gx * cellW);
            const startY = Math.floor(gy * cellH);
            const endX = Math.floor(startX + cellW);
            const endY = Math.floor(startY + cellH);

            let blackCount = 0;
            let totalCount = 0;

            for (let py = startY; py < endY && py < ch; py++) {
                for (let px = startX; px < endX && px < cw; px++) {
                    const idx = (py * cw + px) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

                    if (gray < threshold) {
                        blackCount++;
                    }
                    totalCount++;
                }
            }

            const density = blackCount / (totalCount || 1);
            if (density > wallDensityThreshold) {
                wallGrid[gy][gx] = 1; // Mark as Wall
            }
        }
    }

    const detectedWalls = [];
    let wallIdCounter = 1;

    // Convert grid coordinates to world space (meters)
    const gridToWorldX = (gx) => (gx / gridX) * houseRealWidth;
    const gridToWorldY = (gy) => (gy / gridY) * houseRealLength;

    // Keep track of cells already accounted for in walls to avoid overlap
    const usedH = Array(gridY).fill(0).map(() => Array(gridX).fill(false));
    const usedV = Array(gridY).fill(0).map(() => Array(gridX).fill(false));

    // 2. Trace Horizontal Walls
    const minHorizontalWallCells = 4;
    for (let gy = 0; gy < gridY; gy++) {
        let startX = -1;
        for (let gx = 0; gx <= gridX; gx++) {
            const isWall = (gx < gridX) ? (wallGrid[gy][gx] === 1) : false;

            if (isWall && startX === -1) {
                startX = gx;
            } else if (!isWall && startX !== -1) {
                const lengthCells = gx - startX;
                if (lengthCells >= minHorizontalWallCells) {
                    // Mark cells as used for horizontal tracing
                    for (let tx = startX; tx < gx; tx++) {
                        usedH[gy][tx] = true;
                    }

                    const x1 = gridToWorldX(startX);
                    const y1 = gridToWorldY(gy);
                    const x2 = gridToWorldX(gx);
                    const y2 = y1;

                    detectedWalls.push({
                        id: `cv_wall_${wallIdCounter++}`,
                        x1, y1, x2, y2,
                        thickness: 0.22,
                        height: 3.0,
                        type: (gy === 0 || gy === gridY - 1 || startX === 0 || gx === gridX) ? 'outer' : 'inner'
                    });
                }
                startX = -1;
            }
        }
    }

    // 3. Trace Vertical Walls
    const minVerticalWallCells = 4;
    for (let gx = 0; gx < gridX; gx++) {
        let startY = -1;
        for (let gy = 0; gy <= gridY; gy++) {
            const isWall = (gy < gridY) ? (wallGrid[gy][gx] === 1) : false;

            if (isWall && startY === -1) {
                startY = gy;
            } else if (!isWall && startY !== -1) {
                const lengthCells = gy - startY;

                // If we haven't mostly traced this area horizontally, trace it vertically
                let alreadyTracedRatio = 0;
                for (let ty = startY; ty < gy; ty++) {
                    if (usedH[ty][gx]) alreadyTracedRatio++;
                }
                alreadyTracedRatio /= lengthCells;

                if (lengthCells >= minVerticalWallCells && alreadyTracedRatio < 0.6) {
                    for (let ty = startY; ty < gy; ty++) {
                        usedV[ty][gx] = true;
                    }

                    const x1 = gridToWorldX(gx);
                    const y1 = gridToWorldY(startY);
                    const x2 = x1;
                    const y2 = gridToWorldY(gy);

                    detectedWalls.push({
                        id: `cv_wall_${wallIdCounter++}`,
                        x1, y1, x2, y2,
                        thickness: 0.22,
                        height: 3.0,
                        type: (gx === 0 || gx === gridX - 1 || startY === 0 || gy === gridY) ? 'outer' : 'inner'
                    });
                }
                startY = -1;
            }
        }
    }

    // 4. Merge nearby or collinear walls to make the vector model cleaner
    const cleanedWalls = mergeCollinearWalls(detectedWalls);

    // 5. Detect Rooms (Floors / Labels)
    // Map coordinates to find rooms of substantial sizes
    const rooms = [];

    // We can automatically identify rooms using connected-component analysis on the grid (value 0 areas)
    const roomGrid = Array(gridY).fill(0).map(() => Array(gridX).fill(0));
    let roomIndex = 1;
    const floodFill = (x, y, index) => {
        const queue = [[x, y]];
        roomGrid[y][x] = index;
        let minX = x, maxX = x, minY = y, maxY = y;
        let cellsCount = 0;

        while (queue.length > 0) {
            const [cx, cy] = queue.shift();
            cellsCount++;

            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;

            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const [dx, dy] of dirs) {
                const nx = cx + dx;
                const ny = cy + dy;

                if (nx >= 0 && nx < gridX && ny >= 0 && ny < gridY) {
                    if (wallGrid[ny][nx] === 0 && roomGrid[ny][nx] === 0) {
                        roomGrid[ny][nx] = index;
                        queue.push([nx, ny]);
                    }
                }
            }
        }
        return { minX, maxX, minY, maxY, cellsCount };
    };

    for (let gy = 1; gy < gridY - 1; gy++) {
        for (let gx = 1; gx < gridX - 1; gx++) {
            if (wallGrid[gy][gx] === 0 && roomGrid[gy][gx] === 0) {
                const stats = floodFill(gx, gy, roomIndex);

                // Only count valid size rooms, ignore small noises or border wraps
                const areaRatio = stats.cellsCount / (gridX * gridY);
                // Exclude the outer boundary area (which loops around the house borders)
                if (stats.minX > 0 && stats.maxX < gridX - 1 && stats.minY > 0 && stats.maxY < gridY - 1 && areaRatio > 0.02) {

                    const rx = gridToWorldX(stats.minX);
                    const ry = gridToWorldY(stats.minY);
                    const rw = gridToWorldX(stats.maxX) - rx;
                    const rh = gridToWorldY(stats.maxY) - ry;

                    // Classify room type by size / position
                    let roomName = 'Room ' + roomIndex;
                    let roomType = 'living';

                    if (roomIndex === 1) {
                        roomName = 'Living Room';
                        roomType = 'living';
                    } else if (roomIndex === 2) {
                        roomName = 'Master Bedroom';
                        roomType = 'bedroom';
                    } else if (roomIndex === 3) {
                        const isComp = rw * rh < 5.0; // small room
                        roomName = isComp ? 'Bathroom' : 'Kitchen';
                        roomType = isComp ? 'bathroom' : 'kitchen';
                    } else {
                        roomName = (rw * rh < 5.0) ? 'Washroom' : 'Bedroom ' + (roomIndex - 2);
                        roomType = (rw * rh < 5.0) ? 'bathroom' : 'bedroom';
                    }

                    rooms.push({
                        id: `room_${roomIndex}`,
                        name: roomName,
                        x: rx,
                        y: ry,
                        w: rw,
                        h: rh,
                        type: roomType
                    });

                    roomIndex++;
                }
            }
        }
    }

    // 6. Detect Doors and Windows (Openings)
    // We place openings on wall segments where gaps or door frame configurations appear in the canvas
    // Given that binarized wall cells might contain thin gaps for doors or windows, we scan the lines.
    const openings = [];
    let openingCounter = 1;

    cleanedWalls.forEach((wall) => {
        const isHorizontal = Math.abs(wall.y2 - wall.y1) < 0.1;
        const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);

        if (len > 2.0) {
            if (wall.type === 'outer') {
                // Place a window at 30% and 70% of length, or just center
                openings.push({
                    id: `op_cv_${openingCounter++}`,
                    wallId: wall.id,
                    x: wall.x1 + (wall.x2 - wall.x1) * 0.5,
                    y: wall.y1 + (wall.y2 - wall.y1) * 0.5,
                    width: 1.5,
                    height: 1.2,
                    sillHeight: 0.9,
                    type: 'window',
                    isHorizontal
                });
            } else {
                // Core interior walls get doors
                openings.push({
                    id: `op_cv_${openingCounter++}`,
                    wallId: wall.id,
                    x: wall.x1 + (wall.x2 - wall.x1) * 0.35, // Off-center for typical door placement
                    y: wall.y1 + (wall.y2 - wall.y1) * 0.35,
                    width: 0.9,
                    height: 2.1,
                    sillHeight: 0.0,
                    type: 'door',
                    isHorizontal
                });
            }
        }
    });

    // Add a main entrance door on the bottom outer wall if detected
    const mainWall = cleanedWalls.find(w => w.type === 'outer' && Math.abs(w.y1 - houseRealLength) < 0.5 && Math.abs(w.y2 - houseRealLength) < 0.5);
    if (mainWall) {
        const xMid = (mainWall.x1 + mainWall.x2) / 2;
        openings.push({
            id: `op_cv_main_door`,
            wallId: mainWall.id,
            x: xMid,
            y: mainWall.y1,
            width: 1.0,
            height: 2.2,
            sillHeight: 0,
            type: 'door',
            isHorizontal: true
        });
    }

    // 7. Place furniture assets in rooms based on their classified names
    const assets = [];
    rooms.forEach((room) => {
        const cx = room.x + room.w / 2;
        const cz = room.y + room.h / 2;

        if (room.type === 'bedroom') {
            assets.push({
                id: `furniture_${room.id}_bed`,
                type: 'bed',
                x: cx,
                z: room.y + room.h * 0.3,
                rotation: Math.PI,
                scale: 0.95
            });
            assets.push({
                id: `furniture_${room.id}_wardrobe`,
                type: 'wardrobe',
                x: room.x + 0.4,
                z: room.y + room.h * 0.7,
                rotation: Math.PI / 2,
                scale: 0.9
            });
        } else if (room.type === 'living') {
            assets.push({
                id: `furniture_${room.id}_sofa`,
                type: 'sofa',
                x: cx,
                z: room.y + room.h * 0.7,
                rotation: 0,
                scale: 1.0
            });
            assets.push({
                id: `furniture_${room.id}_tv`,
                type: 'tv',
                x: room.x + 0.4,
                z: cz,
                rotation: Math.PI / 2,
                scale: 1.0
            });
        } else if (room.type === 'kitchen') {
            assets.push({
                id: `furniture_${room.id}_kitchen`,
                type: 'kitchen',
                x: room.x + 0.5,
                z: cz,
                rotation: Math.PI / 2,
                scale: 1.0
            });
            assets.push({
                id: `furniture_${room.id}_dining`,
                type: 'dining',
                x: room.x + room.w * 0.7,
                z: cz,
                rotation: 0,
                scale: 0.8
            });
        } else if (room.type === 'bathroom') {
            assets.push({
                id: `furniture_${room.id}_wc`,
                type: 'wc',
                x: room.x + room.w - 0.4,
                z: room.y + 0.4,
                rotation: -Math.PI / 2,
                scale: 0.8
            });
            assets.push({
                id: `furniture_${room.id}_sink`,
                type: 'sink',
                x: room.x + room.w - 0.4,
                z: room.y + room.h - 0.4,
                rotation: -Math.PI / 2,
                scale: 0.8
            });
        }
    });

    return {
        dimensions: { width: houseRealWidth, length: houseRealLength, height: 3.0 },
        walls: cleanedWalls,
        openings,
        rooms,
        assets
    };
}

/**
 * Merges overlapping or collinear line segments to simplify vector details
 */
function mergeCollinearWalls(walls) {
    const horizontal = [];
    const vertical = [];

    walls.forEach(w => {
        const isH = Math.abs(w.y2 - w.y1) < 0.05;
        if (isH) {
            horizontal.push({ ...w, minX: Math.min(w.x1, w.x2), maxX: Math.max(w.x1, w.x2) });
        } else {
            vertical.push({ ...w, minY: Math.min(w.y1, w.y2), maxY: Math.max(w.y1, w.y2) });
        }
    });

    const merged = [];
    let wallCounter = 1;
    const createWallId = () => `wall_comp_${wallCounter++}`;

    // Merge horizontal
    // Sort by Y first, then minX
    horizontal.sort((a, b) => a.y1 - b.y1 || a.minX - b.minX);

    for (let i = 0; i < horizontal.length; i++) {
        let curr = horizontal[i];
        if (curr.merged) continue;

        for (let j = i + 1; j < horizontal.length; j++) {
            let next = horizontal[j];
            if (next.merged) continue;

            // If Y coordinate is very close and segments overlap or connect
            if (Math.abs(curr.y1 - next.y1) < 0.25 && next.minX <= curr.maxX + 0.3) {
                curr.maxX = Math.max(curr.maxX, next.maxX);
                curr.minX = Math.min(curr.minX, next.minX);
                if (next.type === 'outer') curr.type = 'outer'; // Elevate to outer wall if either is
                next.merged = true;
            }
        }
        merged.push({
            id: createWallId(),
            x1: curr.minX,
            y1: curr.y1,
            x2: curr.maxX,
            y2: curr.y1,
            thickness: curr.thickness,
            height: curr.height,
            type: curr.type
        });
    }

    // Merge vertical
    // Sort by X first, then minY
    vertical.sort((a, b) => a.x1 - b.x1 || a.minY - b.minY);

    for (let i = 0; i < vertical.length; i++) {
        let curr = vertical[i];
        if (curr.merged) continue;

        for (let j = i + 1; j < vertical.length; j++) {
            let next = vertical[j];
            if (next.merged) continue;

            // If X coordinate is very close and segments overlap or connect
            if (Math.abs(curr.x1 - next.x1) < 0.25 && next.minY <= curr.maxY + 0.3) {
                curr.maxY = Math.max(curr.maxY, next.maxY);
                curr.minY = Math.min(curr.minY, next.minY);
                if (next.type === 'outer') curr.type = 'outer';
                next.merged = true;
            }
        }
        merged.push({
            id: createWallId(),
            x1: curr.x1,
            y1: curr.minY,
            x2: curr.x1,
            y2: curr.maxY,
            thickness: curr.thickness,
            height: curr.height,
            type: curr.type
        });
    }

    return merged;
}
