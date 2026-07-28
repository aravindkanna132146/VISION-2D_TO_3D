import { supabase } from './supabaseClient';

/**
 * Generates a clean, fully functional 2D Printable vector Blueprint (SVG).
 * Renders wall boundaries, room names, guidelines, plot dimensions, and compass indicator.
 */
export async function exportToSVG(houseData) {
  if (!houseData) return;
  const { dimensions = { width: 12, length: 12 }, walls = [], openings = [], rooms = [] } = houseData;

  // Scale mapping coordinates: 1m = 40px
  const scale = 40;
  const widthPx = (dimensions.width || 12) * scale;
  const lengthPx = (dimensions.length || 12) * scale;

  const canvasWidth = widthPx + 100;
  const canvasHeight = lengthPx + 160;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth} ${canvasHeight}" width="100%" height="100%">
  <!-- Blueprint style dark blueprint grid background -->
  <rect width="100%" height="100%" fill="#07090e" />
  
  <defs>
    <!-- engineering drafting graph grid pattern -->
    <pattern id="draftGrid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1b233a" stroke-width="0.5"/>
    </pattern>
  </defs>

  <!-- Plot frame boundary -->
  <rect x="30" y="30" width="${widthPx + 40}" height="${lengthPx + 40}" fill="url(#draftGrid)" stroke="#2d3b5c" stroke-width="2" />
  
  <!-- Cardinal directions Vastu indicators -->
  <text x="${(widthPx + 100) / 2}" y="20" fill="#10b981" font-size="11" font-weight="bold" font-family="monospace" text-anchor="middle">N (NORTH)</text>
  <text x="${(widthPx + 100) / 2}" y="${lengthPx + 90}" fill="#ef4444" font-size="11" font-weight="bold" font-family="monospace" text-anchor="middle">S (SOUTH)</text>
  <text x="${widthPx + 85}" y="${(lengthPx + 100) / 2}" fill="#3b82f6" font-size="11" font-weight="bold" font-family="monospace" text-anchor="middle" transform="rotate(90, ${widthPx + 85}, ${(lengthPx + 100) / 2})">E (EAST) ➜</text>
  <text x="15" y="${(lengthPx + 100) / 2}" fill="#f59e0b" font-size="11" font-weight="bold" font-family="monospace" text-anchor="middle" transform="rotate(-90, 15, ${(lengthPx + 100) / 2})">W (WEST)</text>

  <!-- Vector scale viewport translate -->
  <g transform="translate(50, 50)">
    
    <!-- A. Wall silhouettes (Thick high contrast white/purple strokes) -->
    ${walls.map(w => {
    const isOuter = w.type === 'outer';
    const color = isOuter ? '#b388ff' : '#ff80ab';
    const width = isOuter ? 9 : 4.5;
    return `<line x1="${w.x1 * scale}" y1="${w.y1 * scale}" x2="${w.x2 * scale}" y2="${w.y2 * scale}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" />`;
  }).join('\n    ')}

    <!-- B. Bounding openings (doors & windows points) -->
    ${openings.map(op => {
    const color = op.type === 'door' ? '#3b82f6' : '#10b981';
    return `<circle cx="${op.x * scale}" cy="${op.y * scale}" r="6" fill="${color}" stroke="#ffffff" stroke-width="1.5" />
    <text x="${op.x * scale}" y="${op.y * scale - 10}" fill="#ffffff" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle">${op.type.toUpperCase()}</text>`;
  }).join('\n    ')}

    <!-- C. Room labels & panels layout -->
    ${rooms.map(rm => {
    const rx = rm.x * scale;
    const ry = rm.y * scale;
    return `<rect x="${rx - 55}" y="${ry - 14}" width="110" height="28" rx="6" fill="#131929" stroke="#324976" stroke-width="1" />
    <text x="${rx}" y="${ry + 3}" fill="#f8fafc" font-size="10" font-weight="bold" font-family="monospace" text-anchor="middle">${rm.name}</text>`;
  }).join('\n    ')}

    <!-- D. Dimension line guides -->
    <!-- Width Dimension -->
    <line x1="0" y1="${lengthPx + 18}" x2="${widthPx}" y2="${lengthPx + 18}" stroke="#475569" stroke-width="1.5" />
    <line x1="0" y1="${lengthPx + 13}" x2="0" y2="${lengthPx + 23}" stroke="#475569" stroke-width="1.5" />
    <line x1="${widthPx}" y1="${lengthPx + 13}" x2="${widthPx}" y2="${lengthPx + 23}" stroke="#475569" stroke-width="1.5" />
    <text x="${widthPx / 2}" y="${lengthPx + 34}" fill="#94a3b8" font-size="12" font-weight="bold" font-family="monospace" text-anchor="middle">
      WIDTH: ${dimensions.width.toFixed(1)}m (${Math.round(dimensions.width * 3.28)} ft)
    </text>

    <!-- Length Dimension -->
    <line x1="${widthPx + 18}" y1="0" x2="${widthPx + 18}" y2="${lengthPx}" stroke="#475569" stroke-width="1.5" />
    <line x1="${widthPx + 13}" y1="0" x2="${widthPx + 23}" y2="0" stroke="#475569" stroke-width="1.5" />
    <line x1="${widthPx + 13}" y1="${lengthPx}" x2="${widthPx + 23}" y2="${lengthPx}" stroke="#475569" stroke-width="1.5" />
    <text x="${widthPx + 34}" y="${lengthPx / 2}" fill="#94a3b8" font-size="12" font-weight="bold" font-family="monospace" text-anchor="middle" transform="rotate(90, ${widthPx + 34}, ${lengthPx / 2})">
      LENGTH: ${dimensions.length.toFixed(1)}m (${Math.round(dimensions.length * 3.28)} ft)
    </text>
  </g>

  <!-- Title & engineering info block at the footer of viewport -->
  <g transform="translate(30, ${lengthPx + 105})">
    <rect width="${widthPx + 40}" height="42" rx="8" fill="#0b111e" stroke="#253556" stroke-width="1.5" />
    <text x="20" y="25" fill="#f8fafc" font-size="12" font-weight="bold" font-family="monospace" letter-spacing="1.5">
      VISION ARCHITECTURAL STUDIO
    </text>
    <text x="${widthPx + 20}" y="25" fill="#10b981" font-size="10" font-weight="bold" font-family="monospace" text-anchor="end">
      VASTU PRINCIPLE COMPLIANT BLUEPRINT
    </text>
  </g>
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Vision_2D_Blueprint_Layout.svg';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Dynamic Supabase backend upload
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const fileName = `exports/${user.id}/blueprint_${Date.now()}.svg`;
      const file = new File([blob], `blueprint_${Date.now()}.svg`, { type: 'image/svg+xml' });

      const { data, error } = await supabase.storage
        .from('exported-cad')
        .upload(fileName, file);

      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage
          .from('exported-cad')
          .getPublicUrl(fileName);

        await supabase.from('exports').insert({
          user_id: user.id,
          export_type: 'svg',
          file_url: publicUrl
        });
      }
    }
  } catch (err) {
    console.warn("Storage upload was skipped:", err);
  }
}

/**
 * Downloads standard text-based data format as client JSON
 */
export function downloadBIMJson(houseData) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(houseData, null, 2));
  const link = document.createElement('a');
  link.setAttribute("href", dataStr);
  link.setAttribute("download", "floorplan_bim_spec.json");
  document.body.appendChild(link);
  link.click();
  link.remove();
}
