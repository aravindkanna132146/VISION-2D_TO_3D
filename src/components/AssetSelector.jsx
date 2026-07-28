import React, { useState } from 'react';
import { Sofa, Bed, Table, PlusCircle, Layers, Package, Bath } from 'lucide-react';

export default function AssetSelector({ onAddAsset, assetsList = [] }) {
    const [activeTab, setActiveTab] = useState('living');

    const assetTypes = {
        living: [
            { name: 'Modern Sectional Sofa', type: 'sofa', icon: <Sofa size={14} /> },
            { name: 'Wood Media Console LCD', type: 'tv', icon: <Package size={14} /> },
            { name: 'Potted Leaf Plant', type: 'plant', icon: <Layers size={14} /> },
            { name: 'Bed & Pillow Set', type: 'bed', icon: <Bed size={14} /> },
            { name: 'Wardrobe Closet', type: 'wardrobe', icon: <Package size={14} /> }
        ],
        kitchen: [
            { name: 'Granite Cabinet Counter', type: 'kitchen', icon: <Table size={14} /> },
            { name: 'Dining Set & Chairs', type: 'dining', icon: <Table size={14} /> },
            { name: 'Porcelain Toilet (WC)', type: 'wc', icon: <Bath size={14} /> },
            { name: 'Bathroom vanity sink', type: 'sink', icon: <Bath size={14} /> }
        ],
        exterior: [
            { name: 'Red Sedan Car', type: 'car', color: '#e74c3c', icon: <Package size={14} /> },
            { name: 'Graphite Sedan Car', type: 'car', color: '#34495e', icon: <Package size={14} /> }
        ]
    };

    const handleAdd = (item) => {
        const newAsset = {
            id: `${item.type}_${Date.now()}`,
            type: item.type,
            x: 5.5,
            z: 5.5,
            rotation: 0,
            scale: item.type === 'car' ? 0.95 : item.type === 'wc' || item.type === 'sink' ? 0.8 : 1.0,
            color: item.color || undefined
        };
        onAddAsset(newAsset);
    };

    return (
        <div className="flex flex-col gap-5 text-zinc-300">
            <div>
                <h4 className="text-base font-bold uppercase tracking-wider text-white">Structural Assets</h4>
                <p className="text-sm text-zinc-400 mt-1.5">Select furniture entities to spawn them at the coordinates center block.</p>
            </div>

            {/* Tabs Switcher */}
            <div className="flex bg-[#09090b] border border-zinc-800 p-1 rounded-xl">
                {Object.keys(assetTypes).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === tab
                                ? 'bg-zinc-800 text-white shadow-md'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Grid of Addable Items */}
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {assetTypes[activeTab].map((item, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleAdd(item)}
                        className="flex items-center justify-between p-3.5 bg-[#09090b]/55 border border-zinc-800 hover:border-purple-500/40 rounded-xl text-left text-sm font-medium text-zinc-300 hover:text-white transition-all transform hover:-translate-y-0.5 active:scale-98 shadow-sm cursor-pointer"
                    >
                        <div className="flex items-center gap-3">
                            <span className="p-2 bg-zinc-900/80 rounded-lg text-purple-400">
                                {item.icon}
                            </span>
                            <span className="font-semibold text-sm">{item.name}</span>
                        </div>

                        <PlusCircle size={15} className="text-zinc-500 hover:text-purple-400 transition-colors" />
                    </button>
                ))}
            </div>

            {/* Active Scene asset list */}
            <div className="border-t border-zinc-800/80 pt-4 flex flex-col gap-2">
                <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">
                    Placed scene entities ({assetsList.length})
                </span>
                <div className="flex gap-2 flex-wrap max-h-[100px] overflow-y-auto pr-1">
                    {assetsList.length === 0 ? (
                        <span className="text-sm text-zinc-550 italic">No custom assets added.</span>
                    ) : (
                        assetsList.map((asset) => (
                            <span
                                key={asset.id}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#09090b] border border-zinc-800 text-xs font-mono text-zinc-300 rounded-lg"
                            >
                                <span className="font-bold text-purple-400">{asset.type}</span>
                                <span className="text-zinc-700">|</span>
                                <span>x:{asset.x.toFixed(1)}, z:{asset.z.toFixed(1)}</span>
                            </span>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
