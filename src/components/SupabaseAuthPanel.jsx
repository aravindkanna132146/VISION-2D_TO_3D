import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Cloud, Lock, Mail, Key, User, LogOut, Save, FolderOpen, Trash2, ShieldCheck, Loader2 } from 'lucide-react';

export default function SupabaseAuthPanel({
    houseData,
    onImportHouseData,
    buildingType,
    setBuildingType,
    floorCount,
    setFloorCount,
    roofStyle,
    setRoofStyle
}) {
    const [user, setUser] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Projects state
    const [projects, setProjects] = useState([]);
    const [projectName, setProjectName] = useState('My Vastu Layout');

    // Subscribe to auth state updates
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProjects(session.user.id);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProjects(session.user.id);
            } else {
                setProjects([]);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMessage('');
        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                alert('Sign up successful! Please check your email inbox if verification is enabled.');
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (err) {
            console.error('Supabase Auth failure:', err);
            let errMsg = err.message || 'Authentication failed';

            // Check for placeholder URL or connection issues
            if (errMsg === 'Failed to fetch' || err.name === 'TypeError') {
                const currentUrl = supabase.supabaseUrl || 'unknown';
                errMsg = `Connection Error (Failed to fetch): Could not connect to Supabase. This typically means you are using the default placeholder URL or have a network problem. Please check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are updated with your actual Supabase credentials in your .env file at the project root. Current URL: ${currentUrl}`;
            }
            setErrorMessage(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        setLoading(true);
        await supabase.auth.signOut();
        setLoading(false);
    };

    const fetchProjects = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setProjects(data || []);
        } catch (err) {
            console.error('Error loading projects:', err.message);
        }
    };

    const handleSaveProject = async () => {
        if (!user) return;
        setLoading(true);
        setErrorMessage('');
        try {
            // Save or update project
            const { data, error } = await supabase
                .from('projects')
                .insert({
                    user_id: user.id,
                    name: projectName,
                    house_data: houseData,
                    building_type: buildingType,
                    floor_count: floorCount,
                    roof_style: roofStyle,
                    updated_at: new Date().toISOString()
                })
                .select();

            if (error) throw error;
            alert(`Project "${projectName}" saved successfully to Cloud DB!`);
            fetchProjects(user.id);
        } catch (err) {
            setErrorMessage(err.message || 'Failed to save project');
        } finally {
            setLoading(false);
        }
    };

    const handleLoadProject = (proj) => {
        if (!proj || !proj.house_data) return;
        onImportHouseData(proj.house_data);

        // Restore meta stacking states
        if (proj.building_type) setBuildingType(proj.building_type);
        if (proj.floor_count) setFloorCount(proj.floor_count);
        if (proj.roof_style) setRoofStyle(proj.roof_style);

        setProjectName(proj.name);
        alert(`Loaded project: "${proj.name}"`);
    };

    const handleDeleteProject = async (projectId) => {
        if (!confirm('Are you sure you want to delete this project?')) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId);

            if (error) throw error;
            fetchProjects(user.id);
        } catch (err) {
            setErrorMessage(err.message || 'Failed to delete project');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-5">
            {!user ? (
                // Authentication View
                <div className="flex flex-col gap-4.5 bg-zinc-900/40 p-4.5 rounded-xl border border-zinc-800/80 animate-fade-in text-zinc-300">
                    <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
                        <Lock className="text-purple-400" size={16} />
                        <span className="text-xs font-extrabold uppercase tracking-wider">Cloud Account Authentication</span>
                    </div>

                    <form onSubmit={handleAuth} className="flex flex-col gap-3.5">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Email Address</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                                    <Mail size={13} />
                                </span>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[#050507] border border-zinc-800 text-xs text-white rounded-xl pl-9 pr-3 py-3 outline-none focus:border-purple-500/50"
                                    placeholder="architect@vision.build"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Password</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                                    <Key size={13} />
                                </span>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#050507] border border-zinc-800 text-xs text-white rounded-xl pl-9 pr-3 py-3 outline-none focus:border-purple-500/50"
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {errorMessage && (
                            <span className="text-[11px] text-red-400 font-semibold bg-red-950/20 p-2 rounded-lg border border-red-900/30">
                                {errorMessage}
                            </span>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-1.5 py-3 bg-[#9c27b0] hover:brightness-110 text-white font-extrabold uppercase text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                            <span>{isSignUp ? 'REGISTER ACCOUNT' : 'SECURE SIGN IN'}</span>
                        </button>
                    </form>

                    <div className="text-center mt-1 border-t border-zinc-800/80 pt-3">
                        <button
                            onClick={() => setIsSignUp(prev => !prev)}
                            className="text-[10px] text-purple-400 font-extrabold uppercase tracking-widest hover:underline cursor-pointer"
                        >
                            {isSignUp ? 'Already have an account? Sign In' : 'Create new cloud account'}
                        </button>
                    </div>
                </div>
            ) : (
                // Authenticated View
                <div className="flex flex-col gap-5 animate-fade-in">

                    {/* User profile banner */}
                    <div className="flex items-center justify-between bg-zinc-900/40 p-4.5 rounded-xl border border-zinc-800/80 text-zinc-300">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-800 to-pink-600 flex items-center justify-center text-white font-bold text-xs">
                                {email[0]?.toUpperCase() || 'A'}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-black uppercase text-white truncate max-w-[170px]">{email}</span>
                                <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                    <span>Cloud Synced</span>
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={handleSignOut}
                            className="p-2 border border-zinc-800 hover:border-zinc-700 bg-[#09090b] text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer"
                            title="Sign Out"
                        >
                            <LogOut size={13} />
                        </button>
                    </div>

                    {/* Save Current Layout */}
                    <div className="flex flex-col gap-3.5 bg-zinc-900/40 p-4.5 rounded-xl border border-zinc-800/80 text-zinc-300">
                        <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
                            <Save className="text-purple-400" size={16} />
                            <span className="text-xs font-extrabold uppercase tracking-wider">Save Current Layout</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Project Specification Name</label>
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                className="w-full bg-[#050507] border border-zinc-800 text-xs text-white rounded-xl px-3 py-3 outline-none focus:border-purple-500/50 font-bold"
                                placeholder="My Vastu Layout"
                            />
                        </div>

                        <button
                            onClick={handleSaveProject}
                            disabled={loading || !projectName.trim()}
                            className="w-full mt-1 flex items-center justify-center gap-2 py-3 bg-[#9c27b0] hover:brightness-110 text-white font-extrabold uppercase text-xs rounded-xl shadow-lg cursor-pointer transition-all active:scale-[0.99]"
                        >
                            {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            <span>SAVE TO DATABASE</span>
                        </button>
                    </div>

                    {/* Loaded database projects list */}
                    <div className="flex flex-col gap-3.5 bg-zinc-900/40 p-4.5 rounded-xl border border-zinc-800/80 text-zinc-300">
                        <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
                            <FolderOpen className="text-purple-400" size={16} />
                            <span className="text-xs font-extrabold uppercase tracking-wider">Saved Layouts List</span>
                        </div>

                        {projects.length === 0 ? (
                            <div className="text-center py-6 text-zinc-500 text-xs font-medium">
                                No cloud blueprints saved yet.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                                {projects.map((proj) => (
                                    <div
                                        key={proj.id}
                                        className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-zinc-705 transition-all text-xs"
                                    >
                                        <div
                                            onClick={() => handleLoadProject(proj)}
                                            className="flex flex-col cursor-pointer flex-1 truncate pr-2"
                                        >
                                            <span className="font-bold text-zinc-300 truncate hover:text-purple-400 transition-colors">
                                                {proj.name}
                                            </span>
                                            <span className="text-[9px] text-zinc-500 mt-0.5">
                                                {proj.building_type.toUpperCase()} • Stack: {proj.floor_count} • {new Date(proj.updated_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => handleDeleteProject(proj.id)}
                                            className="p-1.5 border border-transparent hover:border-red-950 hover:bg-red-950/20 text-zinc-500 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                                            title="Delete Layout"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
