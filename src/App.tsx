import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Search, Plus, ChefHat, Sparkles, Leaf, Trash2, X, RefreshCw, CheckCircle, Video, PlayCircle, ImagePlus, User as UserIcon, LogOut, MessageCircle, Send, CalendarRange, ShoppingCart, ExternalLink, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const provider = new GoogleAuthProvider();
export const signInWithGoogle = () => signInWithPopup(auth, provider);

// Initialize Gemini API
let aiClient: GoogleGenAI | null = null;
const getAiClient = () => {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("API key is not configured. Add it in AI Studio settings.");
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// TYPES
type Ingredient = {
  id: string;
  name: string;
  quantity: string;
  addedAt: number;
  status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED';
};

type RecipeStep = {
  step: number;
  instruction: string;
  technique: string;
};

type Recipe = {
  id: string;
  title: string;
  prepTime: number;
  recipeType: 'STRICT' | 'RELAXED';
  missingIngredients: string[];
  youtubeQuery: string;
  macros: { protein: number; carbs: number; fats: number };
  steps: RecipeStep[];
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'fridge' | 'recipes' | 'mealplan' | 'chat' | 'impact'>('fridge');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  const [pantry, setPantry] = useState<Ingredient[]>([]);
  const [impactStats, setImpactStats] = useState({ moneySaved: 0, co2Saved: 0 });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const snap = await getDocFromServer(docRef);
          if (snap.exists()) {
            const data = snap.data();
            setPantry(data.pantry || []);
            setImpactStats(data.impactStats || { moneySaved: 0, co2Saved: 0 });
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setPantry([]);
        setImpactStats({ moneySaved: 0, co2Saved: 0 });
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Save to db
  useEffect(() => {
    if (user && !authLoading) {
      setDoc(doc(db, 'users', user.uid), { pantry, impactStats }).catch(e => {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
      });
    }
  }, [pantry, impactStats, user, authLoading]);

  const activePantry = pantry.filter(i => i.status === 'ACTIVE');

  if (authLoading) {
    return (
      <div className="bg-black min-h-screen flex justify-center text-slate-900 font-sans">
        <div className="w-full max-w-md bg-slate-50 h-screen flex flex-col justify-center items-center">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
          <p className="text-slate-500 font-medium">Loading Savor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-black min-h-screen flex justify-center text-slate-900 font-sans">
        <div className="w-full max-w-md bg-slate-50 h-screen flex flex-col justify-center items-center px-6 relative overflow-hidden">
          <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-emerald-200 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
          <div className="absolute bottom-[-100px] left-[-100px] w-64 h-64 bg-emerald-300 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
          
          <div className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-sm flex flex-col items-center z-10 text-center border border-slate-100">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
              <ChefHat className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-br from-emerald-600 to-emerald-800 bg-clip-text text-transparent mb-2">Savor.ai</h1>
            <p className="text-slate-500 mb-8 max-w-[250px]">Your personal AI sous-chef and fridge manager.</p>
            
            <button 
              onClick={() => signInWithGoogle().catch(e => { 
                console.error(e); 
                if (e.code !== 'auth/popup-closed-by-user') {
                  alert("Failed to sign in: " + e.message); 
                }
              })}
              className="w-full py-4 px-6 bg-slate-900 hover:bg-black text-white rounded-2xl font-semibold shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.58c2.1-1.92 3.31-4.75 3.31-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                <path fill="none" d="M1 1h22v22H1z" />
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen flex justify-center text-slate-900 font-sans">
      {/* Mobile App Container */}
      <div className="w-full max-w-md bg-slate-50 h-screen flex flex-col relative overflow-hidden shadow-2xl">
        {/* Render a sticky profile/sign out button */}
        <div className="absolute top-4 right-4 z-[60]">
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)} 
            className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center text-slate-400 hover:text-emerald-500 overflow-hidden relative"
          >
            {user.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5" />}
          </button>
          
          <AnimatePresence>
            {showProfileMenu && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-xl overflow-hidden border border-slate-100 py-1"
              >
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-900 truncate">{user.displayName || 'User'}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
                <button 
                  onClick={() => {
                    setShowProfileMenu(false);
                    signOut(auth);
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto px-2 flex flex-col relative w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(4px)' }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex-1 flex flex-col min-h-full"
            >
              {activeTab === 'fridge' && <FridgeScreen pantry={activePantry} setPantry={setPantry} />}
              {activeTab === 'mealplan' && <MealPlanScreen pantry={activePantry} />}
              {activeTab === 'recipes' && <RecipesScreen pantry={activePantry} impactStats={impactStats} setImpactStats={setImpactStats} pantryList={pantry} setPantry={setPantry} />}
              {activeTab === 'chat' && <ChatScreen pantry={activePantry} />}
              {activeTab === 'impact' && <ImpactScreen stats={impactStats} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Navigation */}
        <nav className="shrink-0 w-full bg-white/80 backdrop-blur-xl border-t border-slate-200/50 flex justify-around items-center p-3 pb-8 z-[90] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] overflow-x-auto text-xs sm:text-base">
          <NavButton active={activeTab === 'fridge'} onClick={() => setActiveTab('fridge')} icon={Search} label="Fridge" />
          <NavButton active={activeTab === 'mealplan'} onClick={() => setActiveTab('mealplan')} icon={CalendarRange} label="Meal Plan" />
          <NavButton active={activeTab === 'recipes'} onClick={() => setActiveTab('recipes')} icon={ChefHat} label="Recipes" />
          <NavButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={MessageCircle} label="Chef AI" />
        </nav>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick} className={`relative flex flex-col items-center gap-1.5 transition-all duration-300 ${active ? 'text-emerald-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
      <div className={`p-2 transition-colors relative z-10 ${active ? '' : ''}`}>
         <Icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
      </div>
      {active && (
        <motion.div 
          layoutId="nav-pill" 
          className="absolute inset-0 bg-emerald-100/80 rounded-2xl -z-10" 
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <span className="text-[10px] font-bold tracking-wide">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-emerald-500 rounded-full absolute -bottom-3" />}
    </button>
  );
}

function MealPlanScreen({ pantry }: { pantry: Ingredient[] }) {
  const [mealPlan, setMealPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateMealPlan = async () => {
    setLoading(true);
    try {
      const pantryNames = pantry.map(i => i.name).join(", ");
      const response = await getAiClient().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { role: 'user', parts: [{ text: `Generate a 3-day meal plan (breakfast, lunch, dinner) using mainly these ingredients: ${pantryNames}. Provide output as a JSON object with this structure: { "days": [ { "day": 1, "meals": { "breakfast": "...", "lunch": "...", "dinner": "..." } } ] }. Do not include any other text or markdown block formatting.` }] }
        ]
      });
      const text = response.text || "{}";
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      setMealPlan(JSON.parse(cleaned));
    } catch (err) {
      console.error(err);
      alert("Failed to generate meal plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 overflow-y-auto pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          AI Meal Planner <CalendarRange className="w-5 h-5 text-emerald-500" />
        </h1>
        <p className="text-slate-500 text-sm mt-1">Get a personalized meal plan based on what's in your fridge.</p>
      </header>

      {!mealPlan ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl shadow-sm border border-slate-100">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Ready to plan your week?</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-[250px]">We'll generate a 3-day meal plan minimizing food waste.</p>
          <button 
            onClick={generateMealPlan}
            disabled={loading || pantry.length === 0}
            className="bg-slate-900 text-white px-6 py-3 rounded-full font-medium shadow-md shadow-slate-900/20 active:scale-95 transition-all w-full md:w-auto disabled:opacity-50"
          >
            {loading ? 'Generating...' : (pantry.length === 0 ? 'Add ingredients first' : 'Generate Plan')}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {mealPlan.days?.map((day: any, i: number) => (
            <div key={i} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-lg border-b border-slate-100 pb-3 mb-4 text-emerald-800">Day {day.day}</h3>
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <div className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-1">Breakfast</div>
                  <div className="text-slate-800 font-medium">{day.meals.breakfast}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <div className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-1">Lunch</div>
                  <div className="text-slate-800 font-medium">{day.meals.lunch}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <div className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-1">Dinner</div>
                  <div className="text-slate-800 font-medium">{day.meals.dinner}</div>
                </div>
              </div>
            </div>
          ))}
          <button 
             onClick={generateMealPlan}
             disabled={loading}
             className="w-full bg-slate-100 text-slate-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 mt-4 hover:bg-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Regenerate Plan
          </button>
        </div>
      )}
    </div>
  );
}

function ChatScreen({ pantry }: { pantry: Ingredient[] }) {
  const [messages, setMessages] = useState<{role: 'user' | 'model', content: string}[]>([
    { role: 'model', content: "Hello! I'm Chef Savor. Ask me about flavour pairings, cooking techniques, or substituting ingredients!" }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      const pantryNames = pantry.map(i => i.name).join(", ");
      
      const historyMsg = messages.map(m => {
          return { role: m.role, parts: [{ text: m.content }] };
      });
      
      const response = await getAiClient().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
            ...historyMsg,
            { role: 'user', parts: [{ text: `User request: ${userMessage}. Context: The user currently has these items in their fridge: ${pantryNames}. You are an expert AI Chef named Chef Savor. Give a brief, helpful, and creative response. Keep it conversational and concise.` }] }
        ]
      });

      setMessages(prev => [...prev, { role: 'model', content: response.text || "Sorry, I couldn't process that." }]);
    } catch (err: any) {
      console.error(err);
      if (err.message && (err.message.includes('429') || err.message.includes('quota'))) {
          setMessages(prev => [...prev, { role: 'model', content: "My kitchen brain is a bit overwhelmed right now (Quota exceeded). Please try again soon!" }]);
      } else {
          setMessages(prev => [...prev, { role: 'model', content: "Oops, my kitchen brain froze. Please try again later!" }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] bg-slate-50 relative -mx-2 px-2 pb-6">
      <header className="p-6 pb-2 shrink-0 bg-transparent z-10 w-full flex-col">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          Chef Chat <Sparkles className="w-5 h-5 text-emerald-500" />
        </h1>
        <p className="text-slate-500 text-sm">Ask about pairings, techniques, or tips!</p>
      </header>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none shadow-md shadow-emerald-600/30' : 'bg-white text-slate-800 border border-slate-200 shadow-sm rounded-bl-none'}`}>
              <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {isTyping && (
           <div className="flex justify-start">
             <div className="bg-white border border-slate-200 shadow-sm rounded-2xl rounded-bl-none p-4 flex gap-1.5 items-center h-12">
               <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
               <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
               <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
             </div>
           </div>
        )}
        <div ref={endRef} className="h-4" />
      </div>

      <div className="p-4 bg-white border-t border-slate-100 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] rounded-3xl mx-2 mb-2 relative z-20">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Chef Savor..." 
            className="flex-1 bg-slate-50 rounded-xl px-4 py-3 focus:outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-slate-800 placeholder-slate-400"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isTyping}
            className="bg-slate-900 text-white w-12 rounded-xl flex items-center justify-center hover:bg-slate-800 disabled:opacity-50 disabled:active:scale-100 active:scale-95 transition-all shadow-lg"
          >
            <Send className="w-5 h-5 -ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SCREENS
// ---------------------------------------------------------------------------

function FridgeScreen({ pantry, setPantry }: { pantry: Ingredient[], setPantry: any }) {
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [newIngredientName, setNewIngredientName] = useState("");
  const [newIngredientQuantity, setNewIngredientQuantity] = useState("");
  const [pendingIngredients, setPendingIngredients] = useState<Ingredient[] | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngredientName.trim()) return;
    
    const newItem: Ingredient = {
      id: crypto.randomUUID(),
      name: newIngredientName.trim(),
      quantity: newIngredientQuantity.trim() || "1",
      addedAt: Date.now(),
      status: 'ACTIVE'
    };
    
    setPantry((prev: Ingredient[]) => [newItem, ...prev]);
    setNewIngredientName("");
    setNewIngredientQuantity("");
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      mediaStreamRef.current = stream;
      setIsCameraOpen(true);
    } catch (err) {
      alert("Could not access camera. Please allow camera permissions.");
    }
  };

  useEffect(() => {
    if (isCameraOpen && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [isCameraOpen]);

  const closeCamera = () => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false);
  };

  const processImageBase64 = async (base64Image: string) => {
    setIsScanning(true);
    try {
      const response = await getAiClient().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { role: 'user', parts: [
            { text: `Analyze this image of a fridge or pantry. Detect all visible food ingredients.
Return ONLY a valid JSON array of objects. 
Like this: [{"name": "Eggs", "quantity": "half dozen"}, {"name": "Milk", "quantity": "1/2 gallon"}]
Do not include any other text or markdown formatting.` },
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
          ]}
        ]
      });

      const text = response.text || "[]";
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const ingredients = JSON.parse(cleaned);
      const newItems: Ingredient[] = ingredients.map((i: any) => ({
        id: crypto.randomUUID(),
        name: i.name,
        quantity: i.quantity || "1",
        addedAt: Date.now(),
        status: 'ACTIVE'
      }));

      setPendingIngredients(newItems);
    } catch (err: any) {
      console.error(err);
      const msg = err.message || JSON.stringify(err);
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        alert("The AI's quota is currently exhausted. Please try again later or provide your own API key.");
      } else {
        alert("Failed to analyze image: " + msg);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        const base64Image = result.split(',')[1];
        await processImageBase64(base64Image);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const captureImage = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
    
    closeCamera();
    await processImageBase64(base64Image);
  };

  const removeItem = (id: string) => {
    setPantry((prev: Ingredient[]) => prev.filter(i => i.id !== id));
  };

  return (
    <div className="p-6">
      <header className="mb-8 pt-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Fridge</h1>
          <p className="text-slate-500 text-sm">Scan to add ingredients</p>
        </div>
      </header>

      {/* Main Action */}
      <div className="flex gap-4 mb-10">
        <button 
          onClick={openCamera}
          disabled={isScanning}
          className="relative flex-[2] overflow-hidden group bg-emerald-600 active:bg-emerald-800 text-white p-5 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-900/10 hover:shadow-2xl hover:-translate-y-1 disabled:opacity-75"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600 to-teal-400 opacity-100 group-hover:scale-110 transition-transform duration-500" />
          <div className="relative z-10 flex flex-col items-center">
            {isScanning ? (
               <RefreshCw className="w-10 h-10 animate-spin text-white mb-2" />
            ) : (
               <div className="bg-white/20 backdrop-blur-md p-4 rounded-full mb-2 group-hover:bg-white/30 transition-colors"><Camera className="w-8 h-8" /></div>
            )}
            <span className="font-bold text-[17px] tracking-wide">{isScanning ? "Processing..." : "Scan Fridge"}</span>
          </div>
        </button>

        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isScanning}
          className="flex-1 bg-emerald-50/80 backdrop-blur border border-emerald-100 hover:bg-emerald-100 active:scale-95 text-emerald-800 p-5 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all disabled:opacity-50"
        >
          <div className="bg-emerald-200/50 p-4 rounded-full"><ImagePlus className="w-7 h-7 text-emerald-700" /></div>
          <span className="font-bold text-[15px] text-emerald-900">Upload</span>
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          hidden 
          onChange={handleFileUpload} 
        />
      </div>

      {/* Manual Input Form */}
      <motion.form 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onSubmit={addManualItem} 
        className="mb-10 flex gap-2 p-2 bg-white rounded-2xl shadow-sm border border-slate-100 flex-col sm:flex-row relative transition-all"
      >
        <div className="flex-1 flex gap-2 w-full">
            <div className="flex-[2] flex items-center pl-3 bg-slate-50 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
              <Search className="w-5 h-5 text-slate-400 mr-2" />
              <input 
                type="text" 
                placeholder="Add an ingredient..." 
                value={newIngredientName}
                onChange={(e) => setNewIngredientName(e.target.value)}
                className="w-full bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none py-3 font-medium min-w-0"
              />
            </div>
            <div className="flex-1 flex items-center px-3 bg-slate-50 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
              <input 
                type="text" 
                placeholder="Qty..." 
                value={newIngredientQuantity}
                onChange={(e) => setNewIngredientQuantity(e.target.value)}
                className="w-full bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none py-3 font-medium min-w-0 text-center sm:text-left"
              />
            </div>
        </div>
        <button 
          type="submit"
          disabled={!newIngredientName.trim()}
          className="bg-slate-900 text-white sm:w-16 h-12 rounded-xl hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 transition-colors flex items-center justify-center active:scale-95 w-full sm:w-auto"
        >
          <Plus className="w-6 h-6" />
        </button>
      </motion.form>

      {/* Inventory List */}
      <div className="space-y-4">
        <h3 className="font-bold tracking-wide text-slate-900 text-sm uppercase flex items-center gap-2">
          Current Inventory <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs">{pantry.length}</span>
        </h3>
        
        {pantry.length === 0 ? (
          <div className="text-center p-10 bg-slate-50 border border-slate-200 border-dashed rounded-3xl text-slate-500 mt-4 flex flex-col items-center">
             <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mb-4">
               <Leaf className="w-8 h-8 text-emerald-300" />
             </div>
             <p className="font-medium">Your fridge is empty.</p>
             <p className="text-sm text-slate-400 mt-1">Scan an image to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-4">
             <AnimatePresence mode="popLayout">
               {pantry.map((item, index) => (
                 <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.8 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 25, delay: index * 0.05 }}
                    key={item.id} 
                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60 relative group hover:shadow-md transition-shadow"
                 >
                    <button onClick={() => removeItem(item.id)} className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-500 rounded-xl opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 active:scale-95">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-3 text-lg">🥗</div>
                    <h4 className="font-bold text-slate-800 capitalize leading-tight pr-6">{item.name}</h4>
                    <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">{item.quantity}</p>
                 </motion.div>
               ))}
             </AnimatePresence>
          </div>
        )}
      </div>

      {/* Review Scan Modal */}
      {createPortal(
        <AnimatePresence>
          {pendingIngredients && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6"
            >
              <motion.div 
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">Review Scan</h2>
                    <p className="text-sm text-slate-500">Confirm detected ingredients.</p>
                  </div>
                  <button 
                    onClick={() => setPendingIngredients(null)} 
                    className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50">
                  <div className="space-y-3">
                    {pendingIngredients.length === 0 ? (
                       <div className="text-center p-8 text-slate-500">No ingredients detected. Please try again.</div>
                    ) : (
                       pendingIngredients.map((item, idx) => (
                         <div key={item.id} className="flex gap-2 items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-200 group">
                            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1 flex gap-2">
                              <input 
                                className="flex-[2] bg-slate-50 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 border border-transparent transition-all min-w-0" 
                                value={item.name} 
                                onChange={(e) => {
                                  const newItems = [...pendingIngredients];
                                  newItems[idx].name = e.target.value;
                                  setPendingIngredients(newItems);
                                }} 
                              />
                              <input 
                                className="flex-[1] bg-slate-50 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 outline-none focus:ring-2 focus:ring-emerald-500 border border-transparent transition-all min-w-0 text-center md:text-left" 
                                value={item.quantity} 
                                onChange={(e) => {
                                  const newItems = [...pendingIngredients];
                                  newItems[idx].quantity = e.target.value;
                                  setPendingIngredients(newItems);
                                }} 
                              />
                            </div>
                            <button 
                              onClick={() => {
                                  const newItems = [...pendingIngredients];
                                  newItems.splice(idx, 1);
                                  setPendingIngredients(newItems);
                              }}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors active:scale-95 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                       ))
                    )}
                  </div>
                </div>
                
                <div className="p-6 bg-white border-t border-slate-100 flex gap-3">
                  <button 
                    onClick={() => setPendingIngredients(null)}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all"
                  >
                    Discard
                  </button>
                  <button 
                     onClick={() => {
                       setPantry((prev: Ingredient[]) => [...pendingIngredients, ...prev]);
                       setPendingIngredients(null);
                     }}
                     disabled={pendingIngredients.length === 0}
                     className="flex-[2] py-3.5 rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" /> Add to Fridge
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Camera Modal */}
      {createPortal(
        <AnimatePresence>
          {isCameraOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="fixed inset-0 bg-black z-[100] flex flex-col"
            >
              <div className="flex-1 relative bg-black">
                 <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                 <div className="absolute top-0 w-full p-4 flex justify-between bg-gradient-to-b from-black/50 to-transparent">
                    <button onClick={closeCamera} className="p-3 bg-white/20 backdrop-blur-md text-white rounded-full transition-transform active:scale-95">
                      <X className="w-6 h-6" />
                    </button>
                 </div>
              </div>
              <div className="h-40 bg-black flex items-center justify-center pb-8 shrink-0">
                 <button onClick={captureImage} className="w-20 h-20 rounded-full border-4 border-white flex justify-center items-center active:scale-95 transition-transform group">
                   <div className="w-16 h-16 bg-white rounded-full group-hover:bg-slate-200 transition-colors" />
                 </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function RecipesScreen({ pantry, impactStats, setImpactStats, pantryList, setPantry }: { pantry: Ingredient[], impactStats: any, setImpactStats: any, pantryList: any, setPantry: any }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [constraint, setConstraint] = useState<'STRICT' | 'RELAXED'>('STRICT');

  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);

  const generateRecipes = async () => {
    if (pantry.length === 0) {
      alert("Add some ingredients to your fridge first!");
      return;
    }

    setIsGenerating(true);
    
    try {
      const pantryNames = pantry.map(i => i.name).join(", ");
      const response = await getAiClient().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: `
You are Savor.ai, a master chef app. Generate exactly ONE recipe based on the user's pantry.
User Pantry: ${pantryNames}
Constraint: ${constraint} 
If STRICT, use ONLY items from the pantry plus standard basics (water, salt, pepper, oil).
If RELAXED, you can suggest 1-2 additional common ingredients to buy to make a better meal.

Return ONLY valid JSON matching this structure perfectly:
{
  "title": "Recipe Name",
  "prepTime": 15,
  "recipeType": "${constraint}",
  "missingIngredients": ["item1", "item2"] (empty array if STRICT),
  "youtubeQuery": "how to cook [recipe name]",
  "macros": { "protein": 20, "carbs": 10, "fats": 5 },
  "steps": [
    { "step": 1, "instruction": "Dice the onions...", "technique": "dicing" },
    { "step": 2, "instruction": "...", "technique": "..." }
  ]
}
` }]}]
      });

      const text = response.text || "{}";
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const recipe = JSON.parse(cleaned) as Recipe;
      recipe.id = crypto.randomUUID();
      
      setRecipes([recipe, ...recipes]);
    } catch (err: any) {
      console.error(err);
      const msg = err.message || JSON.stringify(err);
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        alert("The AI's quota is currently exhausted. Please try again later or provide your own API key.");
      } else {
        alert("Failed to generate recipe: " + msg);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const markCooked = () => {
      // Simulate consuming ingredients -> adds to gamification
      const consumedCount = Math.min(3, pantry.length); // estimate
      setImpactStats({
          moneySaved: impactStats.moneySaved + (consumedCount * 2.50), // roughly $2.50 saved per item
          co2Saved: impactStats.co2Saved + (consumedCount * 0.5) // ~0.5kg CO2 per item
      });
      alert(`Awesome! You just saved money and prevented food waste!`);
      setActiveRecipe(null);
  }

  return (
    <div className="p-6">
       <header className="mb-6 pt-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI Kitchen</h1>
        <p className="text-slate-500 text-sm">Turn your leftovers into masterpieces.</p>
      </header>

      {/* Constraints Toggle */}
      <div className="bg-slate-100/80 p-1.5 rounded-2xl flex mb-6 shadow-inner relative">
         <motion.div 
            layout
            className="absolute inset-y-1.5 bg-white rounded-xl shadow-sm border border-slate-200/50 pointer-events-none"
            initial={false}
            animate={{ 
               left: constraint === 'STRICT' ? '0.375rem' : '50%', 
               width: 'calc(50% - 0.375rem)' 
            }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
         />
         <button 
           onClick={() => setConstraint('STRICT')}
           className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all relative z-10 ${constraint === 'STRICT' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
         >
            Strict (Zero Waste)
         </button>
         <button 
           onClick={() => setConstraint('RELAXED')}
           className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all relative z-10 ${constraint === 'RELAXED' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
         >
            Relaxed (+1-2 items)
         </button>
      </div>

      <button 
        disabled={isGenerating || pantry.length === 0}
        onClick={generateRecipes}
        className="relative group w-full bg-slate-900 overflow-hidden text-white rounded-2xl p-4 flex items-center justify-center gap-2 font-bold mb-10 transition-all hover:shadow-2xl hover:shadow-slate-900/20 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
        {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />}
        {isGenerating ? "Crafting Recipe..." : "Generate Magic Recipe"}
      </button>

      {/* Recipe List */}
      <div className="space-y-5">
        <AnimatePresence>
        {recipes.map((recipe, index) => (
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: index * 0.1 }}
             key={recipe.id} 
             onClick={() => setActiveRecipe(recipe)} 
             className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 relative overflow-hidden active:scale-95 transition-all cursor-pointer hover:shadow-xl hover:shadow-slate-200/50 group"
          >
             <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-emerald-400 to-teal-500 opacity-80 group-hover:opacity-100 transition-opacity" />
             <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-xl leading-tight text-slate-900 pr-4">{recipe.title}</h3>
                <span className="bg-emerald-50 text-emerald-700 text-xs font-black px-3 py-1.5 rounded-xl border border-emerald-100 whitespace-nowrap">
                  {recipe.prepTime} min
                </span>
             </div>
             
             <div className="flex gap-2 mt-4">
                <div className="flex-1 bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Protein</span>
                  <span className="font-bold text-slate-800">{recipe.macros.protein}g</span>
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Carbs</span>
                  <span className="font-bold text-slate-800">{recipe.macros.carbs}g</span>
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fats</span>
                  <span className="font-bold text-slate-800">{recipe.macros.fats}g</span>
                </div>
             </div>
             
             {recipe.missingIngredients.length > 0 && (
                 <div className="mt-4 pt-4 border-t border-slate-100/80">
                    <p className="text-xs text-orange-600 font-bold flex items-center gap-1.5 bg-orange-50 w-fit px-3 py-1.5 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                        Missing: {recipe.missingIngredients.join(', ')}
                    </p>
                 </div>
             )}
          </motion.div>
        ))}
        </AnimatePresence>
      </div>

      {/* Full Recipe Modal */}
      {createPortal(
        <AnimatePresence>
          {activeRecipe && (
              <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                 transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                 className="fixed inset-0 bg-white z-[100] flex flex-col h-full overflow-hidden"
              >
                 <div className="p-4 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md z-10 sticky top-0">
                    <h3 className="font-bold text-lg">{activeRecipe.title}</h3>
                    <button onClick={() => setActiveRecipe(null)} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200 transition-colors"><X className="w-5 h-5" /></button>
                 </div>
                 
                 {/* Traditional Scroll for Steps */}
                 <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-6">
                     {/* Recipe Hero */}
                     <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 text-center relative overflow-hidden group">
                         <div className="absolute inset-0 bg-gradient-to-tr from-red-50 to-orange-50 opacity-50 group-hover:opacity-100 transition-opacity" />
                         <div className="relative z-10">
                           <PlayCircle className="w-14 h-14 text-red-500 mx-auto mb-4 drop-shadow-md group-hover:scale-110 transition-transform" />
                           <h3 className="text-slate-900 font-black text-xl mb-2 tracking-tight">Recipe Tutorial</h3>
                           <p className="text-slate-500 mb-6 text-sm max-w-[250px] mx-auto font-medium leading-relaxed">Watch a step-by-step video tutorial for this recipe on YouTube.</p>
                           <a 
                               href={`https://www.youtube.com/results?search_query=${encodeURIComponent((activeRecipe.youtubeQuery || activeRecipe.title) + ' recipe tutorial')}`}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="bg-red-500 text-white hover:bg-red-600 font-bold py-3 px-8 rounded-full inline-flex items-center gap-2 transition-all shadow-lg shadow-red-500/30 active:scale-95"
                           >
                               <PlayCircle className="w-5 h-5" />
                               Watch on YouTube
                           </a>
                         </div>
                     </div>
  
                     <div className="space-y-4">
                       <h4 className="font-bold text-slate-900 text-xl px-2 tracking-tight">Instructions</h4>
                       {activeRecipe.steps.map((step, idx) => (
                           <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 group hover:shadow-md transition-shadow relative overflow-hidden">
                               <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                               <div className="flex items-center gap-3 mb-2">
                                  <span className="bg-emerald-100 text-emerald-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
                                    {step.step}
                                  </span>
                                  <span className="text-slate-400 font-mono tracking-wider text-xs uppercase font-bold">{step.technique}</span>
                               </div>
                               <p className="text-slate-700 text-base font-medium leading-relaxed mt-3 pl-11">{step.instruction}</p>
                           </div>
                       ))}
                     </div>
                     
                     <div className="pt-4 pb-8">
                       <button onClick={markCooked} className="w-full bg-slate-900 text-white font-bold py-5 rounded-2xl flex justify-center shadow-xl shadow-slate-900/20 active:scale-95 transition-all outline-none focus:ring-4 focus:ring-slate-900/10">
                           Mark as Cooked (Save Food!)
                       </button>
                     </div>
                 </div>
              </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function ImpactScreen({ stats }: { stats: { moneySaved: number, co2Saved: number } }) {
  return (
    <div className="p-6">
       <header className="mb-8 pt-4">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-none">Your Impact</h1>
        <p className="text-slate-500 text-base font-medium mt-2">Every meal saves the planet.</p>
      </header>

      <div className="grid grid-cols-1 gap-5">
         <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 rounded-[2rem] p-8 text-white shadow-2xl shadow-emerald-900/20 relative overflow-hidden group">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
             <div className="absolute -right-6 -bottom-6 w-48 h-48 bg-white opacity-5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
             <div className="relative z-10">
               <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-white/10">
                 <Leaf className="w-8 h-8 text-white" />
               </div>
               <p className="text-emerald-50 font-bold tracking-wide uppercase text-xs mb-2">CO2 Emissions Saved</p>
               <h2 className="text-6xl font-black tracking-tighter mb-1">{stats.co2Saved.toFixed(1)} <span className="text-3xl font-bold text-emerald-200">kg</span></h2>
               <p className="text-sm border-t border-emerald-400/30 pt-4 mt-4 text-emerald-50 font-medium"> Equivalent to driving <strong className="text-white">{(stats.co2Saved * 4.1).toFixed(1)} miles</strong> 🚗</p>
             </div>
         </div>

         <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-xl shadow-slate-200/50 mt-2 relative overflow-hidden">
             <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10" />
             <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner text-white font-bold text-3xl shadow-blue-500/30">$</div>
             <p className="text-slate-400 font-bold tracking-wide uppercase text-xs mb-1">Money Saved</p>
             <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-2">${stats.moneySaved.toFixed(2)}</h2>
             <p className="text-sm text-slate-500 font-medium">By using what you already have in the fridge.</p>
         </div>

         <div className="bg-slate-900 rounded-[2rem] p-8 mt-2 relative overflow-hidden shadow-xl shadow-slate-900/20 group">
             <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-slate-800 to-emerald-900 opacity-50" />
             <div className="relative z-10 flex flex-col items-start">
                 <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-4 border border-emerald-500/30 inline-block">Global Ranking</span>
                 <h3 className="text-white text-3xl font-black tracking-tight mb-2">Top 5% Eco-Chef</h3>
                 <p className="text-slate-400 text-sm font-medium">Keep cooking to reach the Master level.</p>
             </div>
             <Sparkles className="absolute -right-6 -top-6 w-40 h-40 text-emerald-400 opacity-10 group-hover:opacity-30 group-hover:rotate-12 transition-all duration-700" />
         </div>
      </div>
    </div>
  );
}