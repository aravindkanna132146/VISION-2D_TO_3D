/**
 * AntiGravity Civil AI Studio - Procedural Floorplan & BIM Generator
 * Translates text requirements or parsed dimensions into full structural wall
 * lines, room labels, doors, windows, and interior layouts.
 */

export function parsePrompt(promptText) {
  const text = promptText.toLowerCase();
  
  // Default values
  let areaSqft = 1000;
  let bedrooms = 2;
  let bathrooms = 1;
  let hasParking = false;
  let style = 'modern'; // modern, classic, compact
  
  // Parse area
  const areaMatch = text.match(/(\d+)\s*(sq\s*ft|sqft|square\s*feet|sq\.?\s*ft)/);
  if (areaMatch) {
    areaSqft = parseInt(areaMatch[1], 10);
  }
  
  // Parse bedrooms
  if (text.includes("3 bedroom") || text.includes("3bh") || text.includes("3-bedroom") || text.includes("three bedroom") || text.includes("3 bed")) {
    bedrooms = 3;
  } else if (text.includes("1 bedroom") || text.includes("1bh") || text.includes("1-bedroom") || text.includes("one bedroom") || text.includes("1 bed") || text.includes("studio")) {
    bedrooms = 1;
  } else if (text.includes("4 bedroom") || text.includes("4bh") || text.includes("4-bedroom") || text.includes("4 bed")) {
    bedrooms = 4;
  } else {
    bedrooms = 2; // Default
  }
  
  // Parse bathrooms
  const bathMatch = text.match(/(\d+)\s*(bath|bathroom|toilet|washroom)/);
  if (bathMatch) {
    bathrooms = parseInt(bathMatch[1], 10);
  } else if (text.includes("two bath") || text.includes("2 bath")) {
    bathrooms = 2;
  }
  
  // Parse parking
  if (text.includes("parking") || text.includes("garage") || text.includes("car") || text.includes("driveway")) {
    hasParking = true;
  }
  
  // Parse style
  if (text.includes("compact") || text.includes("tiny") || text.includes("small")) {
    style = 'compact';
  } else if (text.includes("classic") || text.includes("traditional") || text.includes("rustic")) {
    style = 'classic';
  }
  
  return { areaSqft, bedrooms, bathrooms, hasParking, style };
}

export function generateHouseFromPrompt(promptText) {
  const specs = parsePrompt(promptText);
  return generateHouseBIM(specs);
}

export function generateHouseBIM(specs) {
  const { areaSqft, bedrooms, bathrooms, hasParking, style } = specs;
  
  // Calculate footprint in meters (1 sq ft ≈ 0.0929 sq meters)
  const areaSqm = areaSqft * 0.0929;
  
  // Choose width and length matching aspect ratio (approx 1:1 or 4:3)
  let width = Math.sqrt(areaSqm);
  let length = width;
  
  // Round to nearest 0.5 meters
  width = Math.round(width * 2) / 2;
  length = Math.round(length * 2) / 2;
  
  // Adjust min limits
  if (width < 6) width = 6;
  if (length < 6) length = 6;
  
  const height = 3.0; // standard 9.8 ft ceiling
  const thicknessOuter = 0.25; // 10 inch outer wall
  const thicknessInner = 0.12; // 5 inch inner wall
  
  const walls = [];
  const rooms = [];
  const assets = [];
  const openings = [];
  
  let wallIdCounter = 1;
  const addWall = (x1, y1, x2, y2, type = 'inner') => {
    // Avoid zero-length walls
    if (Math.abs(x2 - x1) < 0.1 && Math.abs(y2 - y1) < 0.1) return null;
    const w = {
      id: `wall_${wallIdCounter++}`,
      x1,
      y1,
      x2,
      y2,
      thickness: type === 'outer' ? thicknessOuter : thicknessInner,
      height,
      type
    };
    walls.push(w);
    return w;
  };

  // 1. CREATE OUTER PERIMETER
  // We keep a parking cutout on the bottom right if parking is requested
  const parkingWidth = 3.5;
  const parkingLength = 5.0;
  
  let hasParkingCutout = hasParking && width >= 8 && length >= 8;
  
  if (hasParkingCutout) {
    // Cutout layout: House volume occupies remaining space
    // Outer border loops around the parking cutout on bottom right (max X, max Y)
    // Corners:
    // (0,0) -> (width, 0)
    // (width, 0) -> (width, length - parkingLength)
    // (width, length - parkingLength) -> (width - parkingWidth, length - parkingLength)
    // (width - parkingWidth, length - parkingLength) -> (width - parkingWidth, length)
    // (width - parkingWidth, length) -> (0, length)
    // (0, length) -> (0, 0)
    
    addWall(0, 0, width, 0, 'outer');
    addWall(width, 0, width, length - parkingLength, 'outer');
    addWall(width, length - parkingLength, width - parkingWidth, length - parkingLength, 'outer');
    addWall(width - parkingWidth, length - parkingLength, width - parkingWidth, length, 'outer');
    addWall(width - parkingWidth, length, 0, length, 'outer');
    addWall(0, length, 0, 0, 'outer');
    
    // Add parking asset
    assets.push({
      id: 'car_1',
      type: 'car',
      x: width - parkingWidth / 2,
      z: length - parkingLength / 2,
      rotation: 0,
      scale: 1,
      color: '#e74c3c'
    });
    
    rooms.push({
      name: 'Car Parking',
      x: width - parkingWidth,
      y: length - parkingLength,
      w: parkingWidth,
      h: parkingLength,
      type: 'parking'
    });
  } else {
    // Normal rectangular house
    addWall(0, 0, width, 0, 'outer');
    addWall(width, 0, width, length, 'outer');
    addWall(width, length, 0, length, 'outer');
    addWall(0, length, 0, 0, 'outer');
    
    if (hasParking) {
      // Just put a parking space outside on the right
      rooms.push({
        name: 'Car Parking',
        x: width,
        y: length - 6,
        w: 3.5,
        h: 5.5,
        type: 'parking'
      });
      assets.push({
        id: 'car_1',
        type: 'car',
        x: width + 1.75,
        z: length - 3.25,
        rotation: 0,
        scale: 1,
        color: '#34495e'
      });
    }
  }
  
  // Main house area boundaries for rooms
  const houseWidth = hasParkingCutout ? width - parkingWidth : width;
  const houseLength = length;
  
  // 2. DIVISION OF ROOMS (Generates inner walls and places furniture)
  if (bedrooms === 1) {
    // --- 1 BEDROOM LAYOUT ---
    // Horizontal divider in the middle
    const midY = houseLength * 0.45;
    addWall(0, midY, houseWidth, midY, 'inner');
    
    // Top is Bedroom and Bathroom
    const bedWidth = houseWidth * 0.65;
    addWall(bedWidth, 0, bedWidth, midY, 'inner');
    
    rooms.push({ name: 'Master Bedroom', x: 0, y: 0, w: bedWidth, h: midY, type: 'bedroom' });
    rooms.push({ name: 'Bathroom', x: bedWidth, y: 0, w: houseWidth - bedWidth, h: midY, type: 'bathroom' });
    
    // Bottom divided into Living Room and Kitchen
    const kitchenWidth = houseWidth * 0.4;
    addWall(kitchenWidth, midY, kitchenWidth, houseLength, 'inner');
    
    rooms.push({ name: 'Living Room', x: kitchenWidth, y: midY, w: houseWidth - kitchenWidth, h: houseLength - midY, type: 'living' });
    rooms.push({ name: 'Kitchen & Dining', x: 0, y: midY, w: kitchenWidth, h: houseLength - midY, type: 'kitchen' });
    
    // Furniture placements
    // Bedroom Assets
    assets.push({ id: 'bed_m', type: 'bed', x: bedWidth / 2, z: midY * 0.4, rotation: Math.PI, scale: 0.95 });
    assets.push({ id: 'wardrobe_m', type: 'wardrobe', x: 0.5, z: midY * 0.8, rotation: Math.PI / 2, scale: 1 });
    assets.push({ id: 'plant_1', type: 'plant', x: bedWidth - 0.5, z: midY - 0.5, rotation: 0, scale: 0.8 });
    
    // Bathroom Assets
    assets.push({ id: 'wc_1', type: 'wc', x: houseWidth - 0.5, z: midY * 0.2, rotation: -Math.PI / 2, scale: 1 });
    assets.push({ id: 'sink_1', type: 'sink', x: houseWidth - 0.5, z: midY * 0.7, rotation: -Math.PI / 2, scale: 1 });
    
    // Living Room Assets
    assets.push({ id: 'sofa_1', type: 'sofa', x: kitchenWidth + (houseWidth - kitchenWidth) / 2, z: houseLength - 1.2, rotation: 0, scale: 1 });
    assets.push({ id: 'tv_1', type: 'tv', x: kitchenWidth + 0.4, z: midY + (houseLength - midY) / 2, rotation: Math.PI / 2, scale: 1 });
    
    // Kitchen Assets
    assets.push({ id: 'kitchen_1', type: 'kitchen', x: 0.5, z: midY + (houseLength - midY) / 3, rotation: Math.PI / 2, scale: 1.1 });
    assets.push({ id: 'dining_1', type: 'dining', x: kitchenWidth * 0.5, z: houseLength - 1.2, rotation: 0, scale: 0.85 });
    
  } else if (bedrooms === 2) {
    // --- 2 BEDROOM LAYOUT ---
    // Top half: Master Bedroom, Bathroom, Bedroom 2
    const topY = houseLength * 0.45;
    addWall(0, topY, houseWidth, topY, 'inner');
    
    const sec1X = houseWidth * 0.4;
    const sec2X = houseWidth * 0.7;
    addWall(sec1X, 0, sec1X, topY, 'inner');
    addWall(sec2X, 0, sec2X, topY, 'inner');
    
    rooms.push({ name: 'Master Bedroom', x: 0, y: 0, w: sec1X, h: topY, type: 'bedroom' });
    rooms.push({ name: 'Bathroom', x: sec1X, y: 0, w: sec2X - sec1X, h: topY, type: 'bathroom' });
    rooms.push({ name: 'Kids Bedroom', x: sec2X, y: 0, w: houseWidth - sec2X, h: topY, type: 'bedroom' });
    
    // Bottom half: Kitchen & Dining (left), Living Room (right)
    const midX = houseWidth * 0.4;
    addWall(midX, topY, midX, houseLength, 'inner');
    
    // Check if bathroom 2 needed
    let kitchenY = topY;
    if (bathrooms >= 2) {
      // Carve out a guest bath in the bottom-left or mid
      const bath2Y = topY + (houseLength - topY) * 0.4;
      addWall(0, bath2Y, midX, bath2Y, 'inner');
      rooms.push({ name: 'Guest Bath', x: 0, y: topY, w: midX, h: bath2Y - topY, type: 'bathroom' });
      kitchenY = bath2Y;
      
      // Guest Bath Assets
      assets.push({ id: 'wc_2', type: 'wc', x: 0.5, z: topY + 0.5, rotation: Math.PI / 2, scale: 0.8 });
      assets.push({ id: 'sink_2', type: 'sink', x: midX - 0.5, z: topY + 0.5, rotation: -Math.PI / 2, scale: 0.8 });
    }
    
    rooms.push({ name: 'Kitchen & Dining', x: 0, y: kitchenY, w: midX, h: houseLength - kitchenY, type: 'kitchen' });
    rooms.push({ name: 'Living Room', x: midX, y: topY, w: houseWidth - midX, h: houseLength - topY, type: 'living' });
    
    // Bedroom 1 Assets
    assets.push({ id: 'bed_m', type: 'bed', x: sec1X / 2, z: topY * 0.4, rotation: Math.PI, scale: 1 });
    assets.push({ id: 'wardrobe_m', type: 'wardrobe', x: 0.4, z: topY * 0.8, rotation: Math.PI / 2, scale: 1 });
    
    // Kids Bedroom Assets
    assets.push({ id: 'bed_k', type: 'bed', x: sec2X + (houseWidth - sec2X) / 2, z: topY * 0.4, rotation: Math.PI, scale: 0.85 });
    assets.push({ id: 'wardrobe_k', type: 'wardrobe', x: houseWidth - 0.4, z: topY * 0.8, rotation: -Math.PI / 2, scale: 0.85 });
    
    // Main Bath Assets
    assets.push({ id: 'wc_1', type: 'wc', x: sec1X + 0.5, z: 0.5, rotation: 0, scale: 0.9 });
    assets.push({ id: 'sink_1', type: 'sink', x: sec2X - 0.5, z: topY - 0.5, rotation: Math.PI, scale: 0.9 });
    
    // Living Room Assets
    assets.push({ id: 'sofa_1', type: 'sofa', x: midX + (houseWidth - midX) / 2, z: houseLength - 1.2, rotation: 0, scale: 1.1 });
    assets.push({ id: 'tv_1', type: 'tv', x: midX + 0.4, z: topY + (houseLength - topY) / 2, rotation: Math.PI / 2, scale: 1.1 });
    assets.push({ id: 'plant_2', type: 'plant', x: houseWidth - 0.6, z: topY + 0.6, rotation: 0, scale: 0.95 });
    
    // Kitchen Assets
    assets.push({ id: 'kitchen_1', type: 'kitchen', x: 0.5, z: kitchenY + (houseLength - kitchenY) * 0.4, rotation: Math.PI / 2, scale: 1.1 });
    assets.push({ id: 'dining_1', type: 'dining', x: midX * 0.55, z: houseLength - 1.2, rotation: 0, scale: 1.0 });
    
  } else {
    // --- 3 OR More BEDROOM LAYOUT ---
    // Split vertical layout:
    // Left: Bedroom 1 (top), Bathroom/Hall (mid), Bedroom 2 (bottom)
    // Middle/Right: Kitchen + Dining (bottom), Living Room (mid), Master Bedroom (top right)
    const leftX = houseWidth * 0.38;
    addWall(leftX, 0, leftX, houseLength, 'inner');
    
    const topY = houseLength * 0.35;
    const botY = houseLength * 0.68;
    
    addWall(0, topY, leftX, topY, 'inner');
    addWall(0, botY, leftX, botY, 'inner');
    
    rooms.push({ name: 'Guest Bedroom', x: 0, y: 0, w: leftX, h: topY, type: 'bedroom' });
    rooms.push({ name: 'Bathroom 1', x: 0, y: topY, w: leftX, h: botY - topY, type: 'bathroom' });
    rooms.push({ name: 'Kids Bedroom', x: 0, y: botY, w: leftX, h: houseLength - botY, type: 'bedroom' });
    
    // Right side split
    const rightX = leftX + (houseWidth - leftX) * 0.55;
    const rightTopY = houseLength * 0.4;
    addWall(leftX, rightTopY, houseWidth, rightTopY, 'inner');
    addWall(rightX, 0, rightX, rightTopY, 'inner');
    
    rooms.push({ name: 'Master Bedroom', x: leftX, y: 0, w: rightX - leftX, h: rightTopY, type: 'bedroom' });
    rooms.push({ name: 'Bathroom 2', x: rightX, y: 0, w: houseWidth - rightX, h: rightTopY, type: 'bathroom' });
    
    // Living Room & Kitchen
    const rightBotY = rightTopY + (houseLength - rightTopY) * 0.5;
    addWall(leftX, rightBotY, houseWidth, rightBotY, 'inner');
    
    rooms.push({ name: 'Living Room', x: leftX, y: rightTopY, w: houseWidth - leftX, h: rightBotY - rightTopY, type: 'living' });
    rooms.push({ name: 'Kitchen & Dining', x: leftX, y: rightBotY, w: houseWidth - leftX, h: houseLength - rightBotY, type: 'kitchen' });
    
    // Assets placements
    // Bedrooms
    assets.push({ id: 'bed_m', type: 'bed', x: leftX + (rightX - leftX) / 2, z: rightTopY * 0.4, rotation: Math.PI, scale: 1 });
    assets.push({ id: 'bed_g', type: 'bed', x: leftX / 2, z: topY * 0.4, rotation: Math.PI, scale: 0.95 });
    assets.push({ id: 'bed_k', type: 'bed', x: leftX / 2, z: botY + (houseLength - botY) * 0.4, rotation: 0, scale: 0.85 });
    
    // Bathrooms
    assets.push({ id: 'wc_1', type: 'wc', x: 0.5, z: topY + 0.5, rotation: Math.PI / 2, scale: 0.8 });
    assets.push({ id: 'sink_1', type: 'sink', x: leftX - 0.5, z: botY - 0.5, rotation: -Math.PI / 2, scale: 0.8 });
    
    assets.push({ id: 'wc_2', type: 'wc', x: houseWidth - 0.5, z: 0.5, rotation: -Math.PI / 2, scale: 0.8 });
    assets.push({ id: 'sink_2', type: 'sink', x: houseWidth - 0.5, z: rightTopY - 0.5, rotation: -Math.PI / 2, scale: 0.8 });
    
    // Living Room
    assets.push({ id: 'sofa_1', type: 'sofa', x: leftX + (houseWidth - leftX) / 2, z: rightBotY - 0.8, rotation: 0, scale: 1.1 });
    assets.push({ id: 'tv_1', type: 'tv', x: leftX + 0.4, z: rightTopY + (rightBotY - rightTopY) / 2, rotation: Math.PI / 2, scale: 1.0 });
    
    // Kitchen & Dining
    assets.push({ id: 'kitchen_1', type: 'kitchen', x: leftX + 0.5, z: rightBotY + (houseLength - rightBotY) * 0.5, rotation: Math.PI / 2, scale: 1.1 });
    assets.push({ id: 'dining_1', type: 'dining', x: leftX + (houseWidth - leftX) * 0.65, z: rightBotY + (houseLength - rightBotY) * 0.5, rotation: Math.PI / 2, scale: 0.9 });
  }
  
  // 3. GENERATE DOORS & WINDOWS (Placed inside wall gaps)
  // We place openings on wall segments. Each opening contains coordinate on a wall, type and size.
  // Standard doors: width 0.9m, height 2.1m. Windows: width 1.2m, height 1.2m, sill height 0.9m.
  // For each room, let's add some doors and windows.
  // To avoid cutting wall intersections, we place openings in the middle of walls.
  walls.forEach((wall) => {
    const wallLength = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
    
    // Only place openings if wall is long enough
    if (wallLength > 1.8) {
      const midX = (wall.x1 + wall.x2) / 2;
      const midY = (wall.y1 + wall.y2) / 2;
      
      const isHorizontal = Math.abs(wall.y2 - wall.y1) < 0.1;
      
      if (wall.type === 'outer') {
        // Place a window on outer walls
        openings.push({
          id: `op_${wall.id}_win`,
          wallId: wall.id,
          x: midX,
          y: midY,
          width: 1.4,
          height: 1.2,
          sillHeight: 0.9,
          type: 'window',
          isHorizontal
        });
      } else {
        // Place a door on inner walls
        openings.push({
          id: `op_${wall.id}_door`,
          wallId: wall.id,
          x: midX,
          y: midY,
          width: 0.9,
          height: 2.1,
          sillHeight: 0,
          type: 'door',
          isHorizontal
        });
      }
    }
  });

  // For the front door, we scan the outer bottom wall and place a front door instead of a window
  const outerBottomWallIndex = walls.findIndex(w => w.type === 'outer' && Math.abs(w.y1 - length) < 0.2 && Math.abs(w.y2 - length) < 0.2);
  if (outerBottomWallIndex !== -1) {
    const wall = walls[outerBottomWallIndex];
    // Find the window opening on this wall and convert it to a front door
    const opIndex = openings.findIndex(op => op.wallId === wall.id);
    if (opIndex !== -1) {
      openings[opIndex].type = 'door';
      openings[opIndex].width = 1.1; // Wider grand entrance door
      openings[opIndex].height = 2.2;
      openings[opIndex].sillHeight = 0;
    } else {
      // Add one
      openings.push({
        id: `op_${wall.id}_main_door`,
        wallId: wall.id,
        x: (wall.x1 + wall.x2) * 0.35, // side entry
        y: length,
        width: 1.1,
        height: 2.2,
        sillHeight: 0,
        type: 'door',
        isHorizontal: true
      });
    }
  } else {
    // Fallback: place a main entrance door somewhere on the outer walls
    const firstOuterWall = walls.find(w => w.type === 'outer');
    if (firstOuterWall) {
      openings.push({
        id: `op_main_door`,
        wallId: firstOuterWall.id,
        x: (firstOuterWall.x1 + firstOuterWall.x2) / 2,
        y: (firstOuterWall.y1 + firstOuterWall.y2) / 2,
        width: 1.0,
        height: 2.1,
        sillHeight: 0,
        type: 'door',
        isHorizontal: Math.abs(firstOuterWall.y2 - firstOuterWall.y1) < 0.1
      });
    }
  }
  
  return {
    specs,
    dimensions: { width, length, height },
    walls,
    openings,
    rooms,
    assets
  };
}
