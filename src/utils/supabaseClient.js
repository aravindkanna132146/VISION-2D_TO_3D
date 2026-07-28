import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Mask publishable key for log safety
const maskedKey = supabaseAnonKey
    ? `${supabaseAnonKey.slice(0, 10)}...${supabaseAnonKey.slice(-10)}`
    : 'NOT_FOUND';

console.log("=== SUPABASE STARTUP CHECK ===");
console.log(`Supabase URL loaded: ${supabaseUrl || 'NOT_CONFIGURED'}`);
console.log(`Publishable key loaded: ${maskedKey}`);

export const supabase = createClient(
    supabaseUrl || 'https://jxczpfqzkixniqweiphi.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key-missing'
);

// Perform async database connection test heartbeat
(async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Supabase Connection Status: FAILED (Missing environment configuration)");
        return;
    }
    try {
        const { error } = await supabase.auth.getSession();
        if (error) {
            console.error("Supabase Connection Status: FAILED (API rejected request)", error.message);
        } else {
            console.log("Supabase Connection Status: SUCCESSFUL! Heartbeat verification complete.");
        }
    } catch (err) {
        console.error("Supabase Connection Status: FAILED (Network fetch exception)", err);
    }
})();
