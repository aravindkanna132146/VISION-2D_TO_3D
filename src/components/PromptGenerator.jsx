import React, { useState } from 'react';
import { generateHouseFromPrompt } from '../utils/promptGenerator';
import { Wand2, Building, Car, Bath } from 'lucide-react';

export default function PromptGenerator({ onGenerateHouse }) {
    const [prompt, setPrompt] = useState('1200 sq ft 2-bedroom small house with car parking');

    const suggestions = [
        { text: '900 sq ft cozy 1-bedroom villa with parking', label: '1 BHK Villa & Parking', icon: <Car size={14} /> },
        { text: '1200 sq ft 2-bedroom modern house with utility bathroom', label: '2 BHK Standard Space', icon: <Building size={14} /> },
        { text: '1800 sq ft luxury 3-bedroom spacious house with 2 bathrooms', label: '3 BHK Family Suite', icon: <Bath size={14} /> }
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!prompt.trim()) return;
        const housePlan = generateHouseFromPrompt(prompt);
        onGenerateHouse(housePlan);
    };

    const handleSuggestionClick = (text) => {
        setPrompt(text);
        const housePlan = generateHouseFromPrompt(text);
        onGenerateHouse(housePlan);
    };

    return (
        <div className="flex flex-col gap-5 text-zinc-300">
            <div>
                <h4 className="text-base font-bold uppercase tracking-wider text-white">Generative House AI</h4>
                <p className="text-sm text-zinc-400 mt-1.5">Specify square footage, room counts, and parking. The AI Compiler will rebuild structural wall geometry dynamically.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Input box */}
                <div className="flex flex-col gap-3">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g. 1000 sq ft 2-bedroom house with parking"
                        className="w-full bg-[#09090b] border border-zinc-800 focus:border-purple-500/50 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-700 outline-none transition-all font-medium focus:ring-1 focus:ring-purple-500/20"
                    />

                    <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-purple-800 to-purple-900 border border-purple-700 hover:brightness-110 text-white text-sm font-extrabold uppercase rounded-xl shadow-lg hover:shadow-purple-900/10 transition-transform active:scale-98 cursor-pointer"
                    >
                        <Wand2 size={14} />
                        <span>Generate BIM layout</span>
                    </button>
                </div>

                {/* Suggestion Chips */}
                <div className="flex flex-col gap-2.5 mt-2">
                    <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Example Templates</span>
                    <div className="flex flex-col gap-2">
                        {suggestions.map((suggestion, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleSuggestionClick(suggestion.text)}
                                className="flex items-center gap-3 p-3.5 bg-[#09090b]/55 hover:bg-zinc-900/60 border border-zinc-800 hover:border-purple-500/35 rounded-xl text-left transition-all duration-300 active:scale-95 cursor-pointer"
                            >
                                <span className="p-2 bg-zinc-905 rounded-lg text-purple-400 flex-shrink-0">
                                    {suggestion.icon}
                                </span>
                                <span className="font-semibold text-sm text-zinc-300 hover:text-white whitespace-nowrap">{suggestion.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </form>
        </div>
    );
}
