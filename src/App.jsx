import React, { useState, useMemo, useEffect } from 'react';
import ThreeViewport from './components/ThreeViewport';
import PromptGenerator from './components/PromptGenerator';
import VisionPipeline from './components/VisionPipeline';
import AssetSelector from './components/AssetSelector';
import { generateHouseBIM } from './utils/promptGenerator';
import { exportToSVG } from './utils/exporters';
import SupabaseAuthPanel from './components/SupabaseAuthPanel';

import {
  Compass,
  Eye,
  Sparkles,
  ImageIcon,
  HardHat,
  FileDown,
  Palette,
  Layers,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Sliders,
  LifeBuoy,
  Cloud
} from 'lucide-react';
import './App.css';

// Default initial Vastu-compliant layout specs
const initialHouseData = generateHouseBIM({
  areaSqft: 1200,
  bedrooms: 2,
  bathrooms: 2,
  hasParking: true,
  style: 'modern'
});

export default function App() {
  const [houseData, setHouseData] = useState(initialHouseData);
  const [selectedAssetId, setSelectedAssetId] = useState(null);

  // Dock controls tabs: 'prompt' | 'blueprint' | 'structure' | 'materials' | 'assets'
  const [leftTab, setLeftTab] = useState('blueprint');
  const [leftDockCollapsed, setLeftDockCollapsed] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState('blueprint');

  // Camera settings
  const [cameraMode, setCameraMode] = useState('orbit');
  const [showRoof, setShowRoof] = useState(true);

  // --- MULTI-STORY STRUCTURAL ENGINE STATES ---
  const [buildingType, setBuildingType] = useState('single'); // 'single' | 'duplex' | 'triplex' | 'apartment'
  const [floorCount, setFloorCount] = useState(1); // 1 = G+0, 2 = G+1, 3 = G+2, 4..11 = G+3..G+10
  const [roofStyle, setRoofStyle] = useState('rcc_flat'); // 'rcc_flat' | 'mangalore_slope' | 'metal_sheet' | 'pergola_glass'
  const [showSolarPanels, setShowSolarPanels] = useState(false);
  const [showWaterTank, setShowWaterTank] = useState(false);
  const [showMumty, setShowMumty] = useState(false);

  // --- EXTENDED FINISHES AND MATERIALS STATES ---
  const [wallColor, setWallColor] = useState('Asian Paints Off-White');
  const [floorTexture, setFloorTexture] = useState('Vitrified Ivory Tiles');
  const [roofColor, setRoofColor] = useState('Spanish Terracotta Tile');
  const [doorFinish, setDoorFinish] = useState('Oak Wood Frame');
  const [windowFinish, setWindowFinish] = useState('Modern Black Aluminum');
  const [balconyFinishing, setBalconyFinishing] = useState('steel_grill'); // 'steel_grill' | 'glass_balcony'

  // Handle building type select to auto-set floor indices
  const handleBuildingTypeChange = (type) => {
    setBuildingType(type);
    if (type === 'single') {
      setFloorCount(1);
    } else if (type === 'duplex') {
      setFloorCount(2);
    } else if (type === 'triplex') {
      setFloorCount(3);
    } else if (type === 'apartment') {
      setFloorCount(5); // Default G+4 level
    }
  };

  // Safe generation layout update trigger (clears selection highlights to prevent R3F crashes)
  const handleImportHouseData = (newData) => {
    setSelectedAssetId(null);
    setHouseData(newData);
  };

  // Initialize global window joystick object and bind global release listeners to avoid sticking bugs
  useEffect(() => {
    if (!window.joystickMovement) {
      window.joystickMovement = { x: 0, y: 0, turn: 0 };
    }

    const handleGlobalRelease = () => {
      window.joystickMovement = { x: 0, y: 0, turn: 0 };
    };

    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('touchend', handleGlobalRelease);

    return () => {
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('touchend', handleGlobalRelease);
    };
  }, []);

  // Save current helper boundaries globally to guide furniture spawn centroids
  useEffect(() => {
    if (houseData && houseData.dimensions) {
      window.houseWidthLimit = houseData.dimensions.width;
      window.houseLengthLimit = houseData.dimensions.length;
    }
  }, [houseData]);

  // Selected Asset properties tracker
  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return null;
    return houseData.assets.find(asset => asset.id === selectedAssetId) || null;
  }, [selectedAssetId, houseData.assets]);

  // Asset updates handlers
  const handleAddAsset = (newAsset) => {
    setHouseData(prev => ({
      ...prev,
      assets: [...prev.assets, newAsset]
    }));
  };

  const handleUpdateAsset = (id, updatedProperties) => {
    setHouseData(prev => ({
      ...prev,
      assets: prev.assets.map(asset =>
        asset.id === id ? { ...asset, ...updatedProperties } : asset
      )
    }));
  };

  const handleDeleteAsset = (id) => {
    setHouseData(prev => ({
      ...prev,
      assets: prev.assets.filter(asset => asset.id !== id)
    }));
    setSelectedAssetId(null);
  };

  // Viewport exporters triggers
  const triggerGLTFExport = () => {
    if (window.exportToGLTF) {
      window.exportToGLTF();
    } else {
      alert('3D Scene Canvas is still initializing, please wait.');
    }
  };

  const triggerOBJExport = () => {
    if (window.exportToOBJ) {
      window.exportToOBJ();
    } else {
      alert('3D Scene Canvas is still initializing, please wait.');
    }
  };

  const triggerSVGExport = () => {
    exportToSVG(houseData);
  };


  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#09090b] text-[#f8fafc] font-sans antialiased">

      {/* 1. TOP NAVIGATION BAR */}
      <header className="flex items-center justify-between h-16 px-6 border-b border-[#27272a]/70 bg-[#09090b]/85 backdrop-blur-md z-30 select-none">

        {/* Brand Details */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-[#9c27b0] to-[#ec4899] rounded-xl shadow-lg shadow-purple-950/30">
            <HardHat size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black uppercase text-white tracking-widest">Vision</h1>
              <span className="bg-purple-950/60 text-purple-400 font-extrabold text-[9px] uppercase px-2 py-0.5 rounded border border-purple-800/40 tracking-wider shadow-inner">CIVIL VASTU</span>
            </div>
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-widest mt-0.5">Computational Architectural AI</p>
          </div>
        </div>

        {/* Workspace Mode Tab Switcher */}
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl shadow-inner shadow-black/40">
          <button
            onClick={() => {
              setWorkspaceMode('prompt');
              setLeftTab('prompt');
              setLeftDockCollapsed(false);
            }}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-bold uppercase rounded-lg transition-all cursor-pointer ${workspaceMode === 'prompt'
              ? 'bg-zinc-800 text-white shadow-md border border-zinc-700/30 shadow-purple-500/5'
              : 'text-zinc-400 hover:text-white'
              }`}
          >
            <Sparkles size={13} />
            <span>AI Text Prompt</span>
          </button>

          <button
            onClick={() => {
              setWorkspaceMode('blueprint');
              setLeftTab('blueprint');
              setLeftDockCollapsed(false);
            }}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-bold uppercase rounded-lg transition-all cursor-pointer ${workspaceMode === 'blueprint'
              ? 'bg-zinc-800 text-white shadow-md border border-zinc-700/30 shadow-purple-500/5'
              : 'text-zinc-400 hover:text-white'
              }`}
          >
            <ImageIcon size={13} />
            <span>2D Design Canvas</span>
          </button>
        </div>

        {/* Global Toolbar Exporters */}
        <div className="flex items-center gap-3">

          {/* Roof overlays switch */}
          <button
            onClick={() => setShowRoof(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold uppercase transition-all cursor-pointer hover:shadow-indigo-500/5 ${showRoof
              ? 'bg-purple-950/40 border-purple-500/60 text-purple-400 shadow-lg shadow-purple-500/10'
              : 'bg-transparent border-zinc-800 text-zinc-400 hover:text-white'
              }`}
          >
            <Layers size={13} />
            <span>{showRoof ? 'Roof Structure: Active' : 'Roof Structure: Hidden'}</span>
          </button>

          <span className="w-[1.5px] h-5 bg-zinc-800 mx-1"></span>

          {/* OBJ Exporter */}
          <button
            onClick={triggerOBJExport}
            className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-all cursor-pointer"
          >
            <FileDown size={13} />
            <span>OBJ</span>
          </button>

          {/* GLTF Exporter */}
          <button
            onClick={triggerGLTFExport}
            className="flex items-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-zinc-900 border border-purple-500/40 hover:border-purple-500/70 rounded-xl text-xs font-bold uppercase tracking-wider text-purple-300 hover:text-white transition-all cursor-pointer shadow-md shadow-purple-900/10"
          >
            <FileDown size={13} />
            <span>GLTF</span>
          </button>
        </div>
      </header>

      {/* 2. BODY COMPILER CONTAINER */}
      <div className="flex flex-1 w-full relative overflow-hidden">

        {/* COLLAPSIBLE LEFT DOCK */}
        <div className="flex h-full select-none z-20">

          {/* Icon Tabs selector Panel (Expanded to 5 modules) */}
          <div className="flex flex-col items-center w-16 bg-zinc-950/80 border-r border-[#27272a]/70 py-5 gap-5 shadow-xl shadow-black/80">
            <button
              onClick={() => {
                setLeftTab('prompt');
                setLeftDockCollapsed(false);
              }}
              title="AI Prompt Parameters"
              className={`p-2.5 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${leftTab === 'prompt' && !leftDockCollapsed
                ? 'bg-gradient-to-tr from-[#9c27b0] to-purple-550 text-white shadow-xl shadow-purple-905/30 border border-purple-500/30'
                : 'text-zinc-500 hover:text-white'
                }`}
            >
              <Sparkles size={20} />
            </button>

            <button
              onClick={() => {
                setLeftTab('blueprint');
                setLeftDockCollapsed(false);
              }}
              title="2D Design / Tracing Canvas"
              className={`p-2.5 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${leftTab === 'blueprint' && !leftDockCollapsed
                ? 'bg-gradient-to-tr from-[#9c27b0] to-purple-550 text-white shadow-xl shadow-purple-905/30 border border-purple-500/30'
                : 'text-zinc-500 hover:text-white'
                }`}
            >
              <ImageIcon size={20} />
            </button>

            <button
              onClick={() => {
                setLeftTab('structure');
                setLeftDockCollapsed(false);
              }}
              title="Duplex / Apartment Stacking Columns"
              className={`p-2.5 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${leftTab === 'structure' && !leftDockCollapsed
                ? 'bg-gradient-to-tr from-[#9c27b0] to-purple-550 text-white shadow-xl shadow-purple-905/30 border border-purple-500/30'
                : 'text-zinc-500 hover:text-white'
                }`}
            >
              <HardHat size={20} />
            </button>

            <button
              onClick={() => {
                setLeftTab('materials');
                setLeftDockCollapsed(false);
              }}
              title="Indian Floor & Paint Finishes"
              className={`p-2.5 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${leftTab === 'materials' && !leftDockCollapsed
                ? 'bg-gradient-to-tr from-[#9c27b0] to-purple-550 text-white shadow-xl shadow-purple-905/30 border border-purple-500/30'
                : 'text-zinc-500 hover:text-white'
                }`}
            >
              <Palette size={20} />
            </button>

            <button
              onClick={() => {
                setLeftTab('assets');
                setLeftDockCollapsed(false);
              }}
              title="Indian Furniture selector"
              className={`p-2.5 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${leftTab === 'assets' && !leftDockCollapsed
                ? 'bg-gradient-to-tr from-[#9c27b0] to-purple-550 text-white shadow-xl shadow-purple-905/30 border border-purple-500/30'
                : 'text-zinc-500 hover:text-white'
                }`}
            >
              <Layers size={20} />
            </button>

            <button
              onClick={() => {
                setLeftTab('cloud');
                setLeftDockCollapsed(false);
              }}
              title="Cloud Projects & Account sync"
              className={`p-2.5 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${leftTab === 'cloud' && !leftDockCollapsed
                ? 'bg-gradient-to-tr from-[#9c27b0] to-purple-550 text-white shadow-xl shadow-purple-905/30 border border-purple-500/30'
                : 'text-zinc-500 hover:text-white'
                }`}
            >
              <Cloud size={20} />
            </button>

            <div className="flex-1"></div>

            {/* Collapse Toolbar expand switch */}
            <button
              onClick={() => setLeftDockCollapsed(prev => !prev)}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer hover:border-zinc-700"
            >
              {leftDockCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>

          {/* Expanded Dock Contents */}
          <div
            className={`h-full border-r border-[#27272a]/65 bg-zinc-950/80 backdrop-blur-xl transition-all duration-300 overflow-hidden ${leftDockCollapsed ? 'w-0 border-r-0' : 'w-[400px]'
              }`}
          >
            <div className="flex flex-col h-full w-[400px] p-6 overflow-y-auto gap-5">

              {/* Tab Title */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span className="text-xs uppercase font-extrabold text-[#a1a1aa] tracking-widest flex items-center gap-2">
                  {leftTab === 'prompt' && <Sparkles size={13} className="text-purple-400" />}
                  {leftTab === 'blueprint' && <ImageIcon size={13} className="text-purple-400" />}
                  {leftTab === 'structure' && <HardHat size={13} className="text-purple-400" />}
                  {leftTab === 'materials' && <Palette size={13} className="text-purple-400" />}
                  {leftTab === 'assets' && <Layers size={13} className="text-purple-400" />}
                  {leftTab === 'cloud' && <Cloud size={13} className="text-purple-400" />}
                  <span>{leftTab} Parameters</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-500 uppercase font-semibold">CIVIL SAAS</span>
              </div>

              {/* a. AI PROMPT TAB */}
              {leftTab === 'prompt' && (
                <div className="animate-fade-in flex flex-col gap-5">
                  <PromptGenerator onGenerateHouse={handleImportHouseData} />
                </div>
              )}

              {/* b. BLUEPRINT 2D CAD SKETCHER TAB */}
              {leftTab === 'blueprint' && (
                <div className="animate-fade-in flex flex-col gap-5">
                  <VisionPipeline onImportHouseData={handleImportHouseData} />
                </div>
              )}

              {/* f. SUPABASE CLOUD SYNC TAB */}
              {leftTab === 'cloud' && (
                <div className="animate-fade-in flex flex-col gap-5">
                  <SupabaseAuthPanel
                    houseData={houseData}
                    onImportHouseData={handleImportHouseData}
                    buildingType={buildingType}
                    setBuildingType={setBuildingType}
                    floorCount={floorCount}
                    setFloorCount={setFloorCount}
                    roofStyle={roofStyle}
                    setRoofStyle={setRoofStyle}
                  />
                </div>
              )}

              {/* c. STRUCTURAL HEIGHT & MULTI-PLAY TAB */}
              {leftTab === 'structure' && (
                <div className="animate-fade-in flex flex-col gap-5">
                  <div className="flex flex-col gap-5 bg-zinc-900/40 p-4.5 rounded-xl border border-zinc-800/80">

                    {/* Building Type */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider">Building Configuration</label>
                      <select
                        value={buildingType}
                        onChange={(e) => handleBuildingTypeChange(e.target.value)}
                        className="w-full bg-[#09090b] border border-zinc-800 text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:border-zinc-705 font-bold cursor-pointer"
                      >
                        <option value="single">Single Story House</option>
                        <option value="duplex">Duplex (G+1)</option>
                        <option value="triplex">Triplex (G+2)</option>
                        <option value="apartment">Multi-Story Apartment Block</option>
                      </select>
                    </div>

                    {/* Floor Stacking controller */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        <span>Total Floor Stacks</span>
                        <span className="text-purple-400 font-mono">
                          {floorCount === 1 ? 'Ground Only (G+0)' : `G + ${floorCount - 1} Floors`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="11"
                        step="1"
                        value={floorCount}
                        disabled={buildingType !== 'apartment'} // Locked for predefined duplex/triplex options
                        onChange={(e) => setFloorCount(parseInt(e.target.value))}
                        className={`w-full cursor-col-resize ${buildingType !== 'apartment' ? 'opacity-40' : ''}`}
                      />
                      {buildingType !== 'apartment' && (
                        <span className="text-[10px] text-zinc-500 italic">Unlock the Floor Slider by selection "Multi-Story Apartment" type above.</span>
                      )}
                    </div>

                    {/* Parapet / Balcony Railing type */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider">Balcony Grill Style</label>
                      <select
                        value={balconyFinishing}
                        onChange={(e) => setBalconyFinishing(e.target.value)}
                        className="w-full bg-[#09090b] border border-zinc-800 text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:border-zinc-755 font-bold cursor-pointer"
                      >
                        <option value="steel_grill">Steel Grill grill Railing</option>
                        <option value="glass_balcony">Toughened Glass Balcony</option>
                      </select>
                    </div>

                    {/* Roof Material / Style */}
                    <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
                      <label className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider">Top Roof profile</label>
                      <select
                        value={roofStyle}
                        onChange={(e) => setRoofStyle(e.target.value)}
                        className="w-full bg-[#09090b] border border-zinc-800 text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:border-zinc-705 font-bold cursor-pointer"
                      >
                        <option value="rcc_flat">Flat RCC Concrete Slab & Parapets</option>
                        <option value="mangalore_slope">Traditional Mangalore Sloped Roof</option>
                        <option value="metal_sheet">Industrial Metal Slanted Sheet</option>
                        <option value="pergola_glass">Modern sloped Pergola & Glass Canopy</option>
                      </select>
                    </div>

                    {/* Flat RCC Extras parameters */}
                    {roofStyle === 'rcc_flat' && (
                      <div className="flex flex-col gap-2 mt-2 bg-[#09090b]/60 p-3 rounded-xl border border-zinc-850">
                        <span className="text-[10px] uppercase font-black text-zinc-400 tracking-widest mb-1.5 flex items-center gap-1.5">
                          <LifeBuoy size={11} className="text-purple-400 animate-spin" />
                          <span>RCC Terrace Utilities</span>
                        </span>

                        {/* Overhead Tank */}
                        <label className="flex items-center gap-2.5 text-xs text-zinc-300 py-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={showWaterTank}
                            onChange={(e) => setShowWaterTank(e.target.checked)}
                            className="rounded accent-purple-600 scale-105"
                          />
                          <span>Sintex 1000L Overhead Water Tank</span>
                        </label>

                        {/* solar array */}
                        <label className="flex items-center gap-2.5 text-xs text-zinc-300 py-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={showSolarPanels}
                            onChange={(e) => setShowSolarPanels(e.target.checked)}
                            className="rounded accent-purple-600 scale-105"
                          />
                          <span>South-Facing Solar Panel Array</span>
                        </label>

                        {/* Mumty cabin */}
                        <label className="flex items-center gap-2.5 text-xs text-zinc-300 py-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={showMumty}
                            onChange={(e) => setShowMumty(e.target.checked)}
                            className="rounded accent-purple-600 scale-105"
                          />
                          <span>Staircase Mumty Terrace Cabin</span>
                        </label>
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* d. MATERIALS CUSTOMIZATION TAB */}
              {leftTab === 'materials' && (
                <div className="animate-fade-in flex flex-col gap-5">
                  <div className="flex flex-col gap-5 bg-zinc-900/40 p-4.5 rounded-xl border border-zinc-800/80">

                    {/* Indian Flooring */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider">Indian Flooring Texture</label>
                      <select
                        value={floorTexture}
                        onChange={(e) => setFloorTexture(e.target.value)}
                        className="w-full bg-[#09090b] border border-zinc-800 text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:border-zinc-700 font-semibold cursor-pointer"
                      >
                        <option>Vitrified Ivory Tiles</option>
                        <option>Makrana White Marble</option>
                        <option>Chettinad Clay Tiles</option>
                        <option>Natural Hardwood</option>
                        <option>Polished IPS Concrete</option>
                      </select>
                    </div>

                    {/* Exterior wall finishes */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider">Exterior Wall Finishing</label>
                      <select
                        value={wallColor}
                        onChange={(e) => setWallColor(e.target.value)}
                        className="w-full bg-[#09090b] border border-zinc-800 text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:border-zinc-700 font-semibold cursor-pointer"
                      >
                        <option>Asian Paints Off-White</option>
                        <option>Exposed Red Brick</option>
                        <option>Granite Cladding</option>
                        <option>Venetian Plaster</option>
                        <option>Sand Finish Plaster</option>
                      </select>
                    </div>

                    {/* Door Frames */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider">Door Frame Texture</label>
                      <select
                        value={doorFinish}
                        onChange={(e) => setDoorFinish(e.target.value)}
                        className="w-full bg-[#09090b] border border-zinc-800 text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:border-zinc-700 font-semibold cursor-pointer"
                      >
                        <option>Oak Wood Frame</option>
                        <option>Modern Black Aluminum</option>
                        <option>White Vinyl</option>
                        <option>Frosted Glass</option>
                      </select>
                    </div>

                    {/* Window Frames */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider">Window frame Design</label>
                      <select
                        value={windowFinish}
                        onChange={(e) => setWindowFinish(e.target.value)}
                        className="w-full bg-[#09090b] border border-zinc-800 text-sm text-white rounded-xl px-3 py-2.5 outline-none focus:border-zinc-700 font-semibold cursor-pointer"
                      >
                        <option>Oak Wood Frame</option>
                        <option>Modern Black Aluminum</option>
                        <option>White Vinyl</option>
                        <option>Frosted Glass</option>
                      </select>
                    </div>

                  </div>
                </div>
              )}

              {/* e. FURNITURES / ASSETS TAB */}
              {leftTab === 'assets' && (
                <div className="animate-fade-in flex flex-col gap-5">
                  <AssetSelector
                    assetsList={houseData.assets}
                    onAddAsset={handleAddAsset}
                    houseWidth={houseData.dimensions.width}
                    houseLength={houseData.dimensions.length}
                  />
                </div>
              )}

            </div>
          </div>
        </div>

        {/* 3D VIEWPORT CANVAS AREA */}
        <div className="flex-grow h-full relative overflow-hidden bg-[#07080b]">

          {/* Top-Right camera view controls */}
          <div className="absolute top-4 right-4 flex gap-2 p-1.5 bg-zinc-950/85 backdrop-blur-md border border-zinc-800 rounded-xl z-20 shadow-2xl">
            <button
              onClick={() => setCameraMode('orbit')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer border ${cameraMode === 'orbit'
                ? 'bg-zinc-800 text-white border-zinc-700 shadow-md shadow-purple-500/5'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border-transparent'
                }`}
            >
              <Compass size={13} />
              <span>3D Orbit</span>
            </button>

            <button
              onClick={() => setCameraMode('front')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer border ${cameraMode === 'front'
                ? 'bg-zinc-800 text-white border-zinc-700 shadow-md shadow-purple-500/5'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border-transparent'
                }`}
            >
              <Eye size={13} />
              <span>Elevation</span>
            </button>

            <button
              onClick={() => setCameraMode('fps')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer border ${cameraMode === 'fps'
                ? 'bg-purple-950/30 text-purple-400 border-purple-800/40 shadow-lg shadow-purple-500/10'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border-transparent'
                }`}
            >
              <Compass size={13} />
              <span>Walkthrough</span>
            </button>
          </div>

          {/* Vastu quadrants HUD advisor overlay */}
          <div className="absolute top-20 right-4 bg-zinc-955/90 border border-zinc-800/80 p-4 rounded-xl z-10 shadow-2xl flex flex-col gap-2 min-w-[200px] select-none text-zinc-300">
            <span className="text-[10px] uppercase font-extrabold text-[#a1a1aa] tracking-widest border-b border-zinc-800 pb-1.5 flex items-center gap-1.5">
              🕌 VASTU DESIGN MAPS
            </span>
            <div className="flex flex-col gap-[7px] text-[10px] font-sans">
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">NORTH-EAST:</span>
                <span className="text-green-400 font-extrabold">Pooja Room (Good)</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">SOUTH-EAST:</span>
                <span className="text-orange-400 font-extrabold">Kitchen (Fire)</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">SOUTH-WEST:</span>
                <span className="text-[#a855f7] font-extrabold">Master Bedroom</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">NORTH-WEST:</span>
                <span className="text-blue-400 font-bold">Washroom / Guest</span>
              </div>
            </div>
          </div>

          {/* Interactive Enlarged 50% On-Screen Joystick D-Pad Overlay (150px x 150px) */}
          <div className="absolute bottom-6 left-6 z-20 flex flex-col items-center gap-3">
            <div className="flex gap-2">
              <button
                onMouseDown={() => { window.joystickMovement = { x: 0, y: 0, turn: -1 }; }}
                onTouchStart={(e) => { e.preventDefault(); window.joystickMovement = { x: 0, y: 0, turn: -1 }; }}
                className="px-4 py-2.5 bg-zinc-950/90 hover:bg-[#18181b] border border-purple-500/30 hover:border-purple-500/60 rounded-xl text-xs font-extrabold text-purple-400 active:scale-95 transition-all shadow-lg shadow-purple-950/20 cursor-pointer select-none"
                title="Turn Left"
              >
                Turn Left
              </button>
              <button
                onMouseDown={() => { window.joystickMovement = { x: 0, y: 0, turn: 1 }; }}
                onTouchStart={(e) => { e.preventDefault(); window.joystickMovement = { x: 0, y: 0, turn: 1 }; }}
                className="px-4 py-2.5 bg-zinc-950/90 hover:bg-[#18181b] border border-purple-500/30 hover:border-purple-500/60 rounded-xl text-xs font-extrabold text-purple-400 active:scale-95 transition-all shadow-lg shadow-purple-950/20 cursor-pointer select-none"
                title="Turn Right"
              >
                Turn Right
              </button>
            </div>

            <div className="relative w-[150px] h-[150px] bg-zinc-950/80 border-2 border-purple-500/35 hover:border-purple-500/65 rounded-full flex items-center justify-center shadow-2xl backdrop-blur-md select-none touch-none shadow-purple-950/20">
              {/* UP */}
              <button
                onMouseDown={() => { window.joystickMovement = { x: 0, y: 1, turn: 0 }; }}
                onTouchStart={(e) => { e.preventDefault(); window.joystickMovement = { x: 0, y: 1, turn: 0 }; }}
                className="absolute top-2 w-[34px] h-[34px] flex items-center justify-center bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs text-white rounded-xl shadow-md cursor-pointer active:scale-90"
              >
                ▲
              </button>
              {/* DOWN */}
              <button
                onMouseDown={() => { window.joystickMovement = { x: 0, y: -1, turn: 0 }; }}
                onTouchStart={(e) => { e.preventDefault(); window.joystickMovement = { x: 0, y: -1, turn: 0 }; }}
                className="absolute bottom-2 w-[34px] h-[34px] flex items-center justify-center bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs text-white rounded-xl shadow-md cursor-pointer active:scale-90"
              >
                ▼
              </button>
              {/* LEFT */}
              <button
                onMouseDown={() => { window.joystickMovement = { x: -1, y: 0, turn: 0 }; }}
                onTouchStart={(e) => { e.preventDefault(); window.joystickMovement = { x: -1, y: 0, turn: 0 }; }}
                className="absolute left-2 w-[34px] h-[34px] flex items-center justify-center bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs text-white rounded-xl shadow-md cursor-pointer active:scale-90"
              >
                ◀
              </button>
              {/* RIGHT */}
              <button
                onMouseDown={() => { window.joystickMovement = { x: 1, y: 0, turn: 0 }; }}
                onTouchStart={(e) => { e.preventDefault(); window.joystickMovement = { x: 1, y: 0, turn: 0 }; }}
                className="absolute right-2 w-[34px] h-[34px] flex items-center justify-center bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs text-white rounded-xl shadow-md cursor-pointer active:scale-90"
              >
                ▶
              </button>

              {/* High Contrast touch knob at center */}
              <div
                className="w-11 h-11 bg-gradient-to-tr from-purple-700 to-pink-600 border border-purple-500/40 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shadow-xl shadow-purple-950/20 active:scale-90 hover:brightness-110"
              >
                PAD
              </div>
            </div>
          </div>

          {/* Floating dynamic navigation explanations */}
          <div className="absolute bottom-6 left-48 bg-zinc-950/85 backdrop-blur-md border border-zinc-800 px-4 py-3 rounded-xl text-xs text-zinc-400 z-10 shadow-2xl flex flex-col gap-1 max-w-[280px]">
            <div className="flex items-center gap-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[9px]">
              <span className="w-1.5 h-1.5 bg-zinc-650 rounded-full animate-ping"></span>
              <span>Camera Directional Guides</span>
            </div>
            {cameraMode === 'fps' ? (
              <span className="font-semibold text-purple-400">
                WASD / Arrows: Walk | Move Mouse: Look Around | Click to Lock cursor | Esc: Unlock
              </span>
            ) : (
              <span>
                Left-Click + Drag: Rotate | Right-Click + Drag: Pan | Scroll: Zoom
              </span>
            )}
          </div>

          {/* Floating actions and frame status labels */}
          <div className="absolute bottom-6 right-6 flex items-center gap-4 z-10 select-none">
            <button
              onClick={triggerSVGExport}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-800 to-purple-900 border border-purple-700 hover:brightness-110 text-white text-xs font-extrabold uppercase rounded-xl transition-all shadow-lg hover:shadow-purple-900/10 cursor-pointer"
            >
              <FileDown size={14} />
              <span>Export 2D Print (SVG / Blueprint)</span>
            </button>

            <div className="bg-zinc-950/85 backdrop-blur-md border border-zinc-800 px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-[#10b981] rounded-full animate-ping"></span>
              <span className="text-zinc-300 font-semibold lowercase font-mono">60 fps engine active</span>
            </div>
          </div>

          {/* Main 3D viewport canvas component container */}
          <ThreeViewport
            houseData={houseData}
            selectedAssetId={selectedAssetId}
            setSelectedAssetId={setSelectedAssetId}
            onUpdateAsset={handleUpdateAsset}
            onDeleteAsset={handleDeleteAsset}
            cameraMode={cameraMode}
            showRoof={showRoof}
            wallColor={wallColor}
            floorTexture={floorTexture}
            roofColor={roofColor}
            doorFinish={doorFinish}
            windowFinish={windowFinish}
            floorCount={floorCount}
            roofStyle={roofStyle}
            showSolarPanels={showSolarPanels}
            showWaterTank={showWaterTank}
            showMumty={showMumty}
            balconyFinishing={balconyFinishing}
          />
        </div>

        {/* RIGHT PROPERTY INSPECTOR PANEL */}
        <div
          className={`h-full border-l border-[#27272a]/65 bg-zinc-950/80 backdrop-blur-xl transition-all duration-300 z-20 flex overflow-hidden ${selectedAsset ? 'w-[320px]' : 'w-0 border-l-0'
            }`}
        >
          {selectedAsset && (
            <div className="flex flex-col h-full w-[320px] p-6 overflow-y-auto gap-5 select-none animate-fade-in">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span className="text-xs uppercase font-extrabold text-[#a1a1aa] tracking-widest flex items-center gap-2">
                  <Sliders size={13} className="text-purple-400" /> Object Inspector
                </span>
                <button
                  onClick={() => setSelectedAssetId(null)}
                  className="text-zinc-500 hover:text-white cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* ID labels panel */}
              <div className="bg-zinc-900/40 rounded-xl p-4 border border-zinc-800/80 text-xs font-mono flex flex-col gap-2 text-zinc-400">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Asset Type:</span>
                  <span className="font-extrabold text-purple-405 font-sans uppercase">{selectedAsset.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Identity ID:</span>
                  <span className="text-zinc-500 truncate max-w-[155px]">{selectedAsset.id}</span>
                </div>
              </div>

              {/* Position coordinates sliders controls */}
              <div className="flex flex-col gap-5">

                {/* Pos X */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <span>Position Axis X</span>
                    <span className="text-white font-mono">{selectedAsset.x.toFixed(2)}m</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={houseData.dimensions.width}
                    step="0.1"
                    value={selectedAsset.x}
                    onChange={(e) => handleUpdateAsset(selectedAsset.id, { x: parseFloat(e.target.value) })}
                    className="w-full cursor-col-resize"
                  />
                </div>

                {/* Pos Z */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <span>Position Axis Z</span>
                    <span className="text-white font-mono">{selectedAsset.z.toFixed(2)}m</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={houseData.dimensions.length}
                    step="0.1"
                    value={selectedAsset.z}
                    onChange={(e) => handleUpdateAsset(selectedAsset.id, { z: parseFloat(e.target.value) })}
                    className="w-full cursor-col-resize"
                  />
                </div>

                {/* Rotation */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <span>Rotation Yaw</span>
                    <span className="text-white font-mono">
                      {Math.round(((selectedAsset.rotation || 0) * 180) / Math.PI)}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.PI * 2}
                    step="0.05"
                    value={selectedAsset.rotation || 0}
                    onChange={(e) => handleUpdateAsset(selectedAsset.id, { rotation: parseFloat(e.target.value) })}
                    className="w-full cursor-col-resize"
                  />
                </div>

                {/* Scale */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <span>Scale Factor</span>
                    <span className="text-white font-mono">{selectedAsset.scale || 1.0}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={selectedAsset.scale || 1.0}
                    onChange={(e) => handleUpdateAsset(selectedAsset.id, { scale: parseFloat(e.target.value) })}
                    className="w-full cursor-col-resize"
                  />
                </div>

                {/* Car Color Picker */}
                {selectedAsset.type === 'car' && (
                  <div className="flex flex-col gap-2.5">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Vehicle Color Coat</span>
                    <div className="flex gap-2 flex-wrap">
                      {['#e74c3c', '#34495e', '#2ecc71', '#f1c40f', '#9b59b6', '#ffffff'].map(clr => (
                        <button
                          key={clr}
                          onClick={() => handleUpdateAsset(selectedAsset.id, { color: clr })}
                          className={`w-7 h-7 rounded-full border border-zinc-800 transition-all cursor-pointer ${selectedAsset.color === clr ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-[#09090b]' : ''
                            }`}
                          style={{ backgroundColor: clr }}
                        />
                      ))}
                    </div>
                  </div>
                )}

              </div>

              <div className="flex-grow"></div>

              {/* Delete asset button */}
              <button
                onClick={() => handleDeleteAsset(selectedAsset.id)}
                className="w-full flex items-center justify-center gap-2 py-4 border border-red-500/25 bg-red-950/15 hover:bg-red-950/25 text-red-400 text-sm font-bold rounded-xl transition-all cursor-pointer hover:border-red-500/40"
              >
                <Trash2 size={14} />
                <span>Delete Entity</span>
              </button>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
