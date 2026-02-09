import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  History as HistoryIcon, 
  Download, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Plus,
  X,
  RotateCcw,
  Key
} from 'lucide-react';
import { GenerationRecord, GenerationStatus } from './types';
import { generateCharacterSection } from './services/geminiService';
import { saveGeneration, getAllGenerations, deleteGeneration, clearAllGenerations } from './services/storageService';

// AI Studio API Key Selection helpers
// Define the interface that the error message suggests is required
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    // Fixed: All declarations of 'aistudio' must have identical modifiers and types. 
    // Using the named AIStudio interface as suggested by the compiler error.
    aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [currentGeneration, setCurrentGeneration] = useState<GenerationRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [hasKey, setHasKey] = useState<boolean>(true);

  // Load history from IndexedDB on mount and check API key
  useEffect(() => {
    const init = async () => {
      try {
        const data = await getAllGenerations();
        setHistory(data);
        
        if (window.aistudio) {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasKey(selected);
        }
      } catch (e) {
        console.error("Initialization failed", e);
      }
    };
    init();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true); // Assume success per instructions
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
        setCurrentGeneration(null); // Allow fresh generation
        setStatus(GenerationStatus.IDLE);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetImage = () => {
    setReferenceImage(null);
    setCurrentGeneration(null);
    setStatus(GenerationStatus.IDLE);
    setError(null);
  };

  const startGeneration = async () => {
    if (!referenceImage) return;
    
    setError(null);
    const newId = Date.now().toString();
    
    try {
      setStatus(GenerationStatus.LOADING_TURNAROUND);
      const turnaround = await generateCharacterSection(referenceImage, 'turnaround', "");
      
      setStatus(GenerationStatus.LOADING_POSES);
      const poses = await generateCharacterSection(referenceImage, 'poses', "");
      
      setStatus(GenerationStatus.LOADING_MERCH);
      const merch = await generateCharacterSection(referenceImage, 'merch', "");
      
      setStatus(GenerationStatus.LOADING_POSTERS);
      const posters = await generateCharacterSection(referenceImage, 'posters', "");

      const newRecord: GenerationRecord = {
        id: newId,
        timestamp: Date.now(),
        referenceImage: referenceImage,
        turnaroundImage: turnaround,
        actionPosesImage: poses,
        merchImage: merch,
        postersImage: posters,
        prompt: "Generated using Gemini 3 Pro 2K"
      };

      await saveGeneration(newRecord);
      setCurrentGeneration(newRecord);
      setHistory(prev => [newRecord, ...prev]);
      setStatus(GenerationStatus.SUCCESS);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("entity was not found")) {
        setHasKey(false);
        setError("API Key verification failed. Please re-select your key.");
      } else {
        setError(err.message || "An error occurred during generation. Check your network or API key.");
      }
      setStatus(GenerationStatus.ERROR);
    }
  };

  const deleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteGeneration(id);
      setHistory(prev => prev.filter(item => item.id !== id));
      if (currentGeneration?.id === id) setCurrentGeneration(null);
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear all history? This cannot be undone.")) return;
    try {
      await clearAllGenerations();
      setHistory([]);
      setCurrentGeneration(null);
    } catch (err) {
      console.error("Clear failed", err);
    }
  };

  const downloadSingleImage = (src: string, name: string) => {
    const link = document.createElement('a');
    link.download = `${name}_2K_${Date.now()}.png`;
    link.href = src;
    link.click();
  };

  const downloadFullImage = async () => {
    if (!currentGeneration) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = src;
      });
    };

    try {
      const images = await Promise.all([
        loadImage(currentGeneration.turnaroundImage),
        loadImage(currentGeneration.actionPosesImage),
        loadImage(currentGeneration.merchImage),
        loadImage(currentGeneration.postersImage),
      ]);

      const totalHeight = images.reduce((sum, img) => sum + img.height, 0);
      const maxWidth = Math.max(...images.map(img => img.width));

      canvas.width = maxWidth;
      canvas.height = totalHeight;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let currentY = 0;
      images.forEach(img => {
        const xOffset = (maxWidth - img.width) / 2;
        ctx.drawImage(img, xOffset, currentY);
        currentY += img.height;
      });

      const link = document.createElement('a');
      link.download = `ip_full_kit_2K_${currentGeneration.id}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (e) {
      console.error("Stitching failed", e);
      alert("Failed to stitch 2K images. Try downloading sections individually.");
    }
  };

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center space-y-6 border border-gray-100">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
            <Key className="w-10 h-10 text-blue-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Unlock Pro Features</h2>
            <p className="text-gray-500 text-sm">
              Gemini 3 Pro requires a paid API key for 2K high-resolution IP generation. 
              Please select your key from a project with billing enabled.
            </p>
          </div>
          <button 
            onClick={handleSelectKey}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-95"
          >
            Select API Key
          </button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block text-xs text-blue-500 hover:underline"
          >
            Learn about API billing & setup
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Sidebar - Control Panel */}
      <aside className={`w-full md:w-80 bg-white border-r border-gray-200 flex flex-col z-20 transition-all duration-300 ${showHistory ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-extrabold text-xl text-gray-800 tracking-tight">IP Studio Pro</h1>
          </div>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="md:hidden text-gray-500 p-2 hover:bg-gray-100 rounded-lg"
          >
            <HistoryIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto hide-scrollbar space-y-8">
          <section>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">Reference IP Image</label>
              {referenceImage && (
                <button 
                  onClick={handleResetImage}
                  className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 bg-red-50 rounded-md transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>
            <div className={`relative group border-2 border-dashed rounded-2xl p-4 transition-all duration-200 flex flex-col items-center justify-center bg-gray-50 cursor-pointer overflow-hidden
              ${referenceImage ? 'border-blue-400 bg-white shadow-inner' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'}`}>
              
              <input 
                type="file" 
                className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                onChange={handleFileUpload}
                accept="image/*"
              />
              
              {referenceImage ? (
                <div className="w-full h-full relative group">
                  <img src={referenceImage} alt="Reference" className="w-full h-48 object-contain rounded-lg" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                    <p className="text-white text-sm font-bold flex items-center gap-2">
                      <Upload className="w-4 h-4" /> Change Image
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-sm text-gray-500 font-medium">Click or drag character</p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">PNG / JPG Supported</p>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <button 
              disabled={!referenceImage || (status !== GenerationStatus.IDLE && status !== GenerationStatus.SUCCESS && status !== GenerationStatus.ERROR)}
              onClick={startGeneration}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg
                ${(!referenceImage || (status !== GenerationStatus.IDLE && status !== GenerationStatus.SUCCESS && status !== GenerationStatus.ERROR)) 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:shadow-blue-200 active:scale-[0.98]'}`}
            >
              <Sparkles className="w-5 h-5" />
              {status === GenerationStatus.IDLE ? 'Generate 2K Portfolio' : 'Regenerate'}
            </button>
            
            {currentGeneration && (
              <button 
                onClick={downloadFullImage}
                className="w-full py-4 rounded-xl border-2 border-blue-50 font-bold text-blue-700 flex items-center justify-center gap-2 hover:bg-blue-50/50 transition-all bg-white"
              >
                <Download className="w-5 h-5" />
                Download Full 2K Long Map
              </button>
            )}
          </section>

          {(status !== GenerationStatus.IDLE && status !== GenerationStatus.SUCCESS) && (
            <div className="space-y-4 p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-blue-900">Crafting IP Assets...</h3>
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="space-y-3">
                {[
                  { key: GenerationStatus.LOADING_TURNAROUND, label: "2K Character Turnaround" },
                  { key: GenerationStatus.LOADING_POSES, label: "2K Action Poses Grid" },
                  { key: GenerationStatus.LOADING_MERCH, label: "2K Merchandise Portfolio" },
                  { key: GenerationStatus.LOADING_POSTERS, label: "2K Theme Posters" }
                ].map((step, idx, arr) => {
                  // Fixed: Use index comparison to determine if a step is completed.
                  // Avoids unreachable equality check with GenerationStatus.SUCCESS due to type narrowing.
                  const currentStatusIdx = arr.findIndex(s => s.key === status);
                  const isCompleted = currentStatusIdx !== -1 && idx < currentStatusIdx;

                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full transition-colors ${status === step.key ? 'bg-blue-600 animate-pulse' : (isCompleted ? 'bg-green-500' : 'bg-gray-300')}`} />
                      <span className={`text-xs ${status === step.key ? 'text-blue-700 font-bold' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex gap-3 text-red-600 shadow-sm animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-xs font-bold leading-relaxed">{error}</p>
                <button onClick={handleSelectKey} className="text-[10px] underline uppercase tracking-widest font-black">Refresh API Key</button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50">
          <button 
            onClick={() => setShowHistory(true)}
            className="w-full flex items-center justify-between text-gray-500 hover:text-blue-600 transition-colors bg-white p-4 rounded-xl shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-2">
              <HistoryIcon className="w-5 h-5" />
              <span className="font-bold text-sm">Recent Projects</span>
            </div>
            <div className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black">{history.length}</div>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative h-screen overflow-y-auto bg-gray-100 p-4 md:p-10 flex flex-col items-center">
        {!currentGeneration && status === GenerationStatus.IDLE ? (
          <div className="flex-1 flex flex-col items-center justify-center max-w-lg text-center space-y-6">
            <div className="w-32 h-32 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center mb-4 transform -rotate-12 transition-transform hover:rotate-0 duration-500">
              <Sparkles className="w-16 h-16 text-blue-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">IP Merch Designer</h2>
              <p className="text-gray-500 leading-relaxed font-medium">
                Transform a single character into a complete 2K high-definition professional brand kit. 
                Includes turnarounds, dynamic poses, and full-set merchandise visualization.
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-4xl flex flex-col gap-8 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white flex flex-col items-center">
              {currentGeneration && (
                <div className="w-full p-10 border-b border-gray-50 bg-gradient-to-br from-white to-blue-50/20">
                  <div className="flex items-center justify-between mb-6">
                    <span className="bg-blue-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-lg shadow-blue-200">
                      High-Definition 2K
                    </span>
                    <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                      {new Date(currentGeneration.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-4xl font-black text-gray-900 tracking-tighter mb-2 italic">BRAND IDENTITY PORTFOLIO</h3>
                  <p className="text-gray-400 font-medium text-sm tracking-wide">Consistency-driven Character & Merch Design Ecosystem</p>
                </div>
              )}

              {currentGeneration?.turnaroundImage && (
                <Section title="Character Turnaround" subtitle="Standard 3-View Technical Sheet" image={currentGeneration.turnaroundImage} onDownload={() => downloadSingleImage(currentGeneration.turnaroundImage, 'turnaround')} />
              )}
              
              {currentGeneration?.actionPosesImage && (
                <Section title="Dynamic Expression Grid" subtitle="6-Action Consistency Protocol" image={currentGeneration.actionPosesImage} onDownload={() => downloadSingleImage(currentGeneration.actionPosesImage, 'poses')} />
              )}

              {currentGeneration?.merchImage && (
                <Section title="Product Ecosystem" subtitle="Comprehensive Lifestyle Merchandising" image={currentGeneration.merchImage} onDownload={() => downloadSingleImage(currentGeneration.merchImage, 'merch')} />
              )}

              {currentGeneration?.postersImage && (
                <Section title="Promotional Posters" subtitle="Theme-based Visual Communications" image={currentGeneration.postersImage} onDownload={() => downloadSingleImage(currentGeneration.postersImage, 'posters')} />
              )}

              <div className="w-full py-16 flex flex-col items-center text-gray-300">
                <div className="w-20 h-1 bg-gray-100 rounded-full mb-6" />
                <p className="text-xs font-black uppercase tracking-[0.4em] text-gray-400">Copyright © IP Studio Pro 2024</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* History Slide-over */}
      {showHistory && (
        <div className="absolute inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-md transition-opacity duration-300" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 ease-out border-l border-gray-100">
            <div className="p-8 border-b flex items-center justify-between bg-white sticky top-0 z-10">
              <h2 className="font-black text-2xl text-gray-900 tracking-tight flex items-center gap-3">
                <HistoryIcon className="w-6 h-6 text-blue-600" />
                Archive
              </h2>
              <div className="flex items-center gap-3">
                {history.length > 0 && (
                  <button 
                    onClick={handleClearAll}
                    className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
                  >
                    Wipe
                  </button>
                )}
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 hide-scrollbar">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                    <HistoryIcon className="w-8 h-8 opacity-20" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-widest">No Archived Sessions</p>
                </div>
              ) : (
                history.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => {
                      setCurrentGeneration(item);
                      setReferenceImage(item.referenceImage);
                      setShowHistory(false);
                    }}
                    className={`group relative p-4 rounded-3xl border transition-all cursor-pointer hover:shadow-xl
                      ${currentGeneration?.id === item.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-100 hover:border-blue-200'}`}
                  >
                    <div className="flex gap-5">
                      <div className="w-20 h-20 bg-gray-100 rounded-2xl overflow-hidden flex-shrink-0 shadow-inner">
                        <img src={item.referenceImage} className="w-full h-full object-cover" alt="Ref" />
                      </div>
                      <div className="flex-1 min-w-0 py-1 flex flex-col justify-center">
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${currentGeneration?.id === item.id ? 'text-blue-100' : 'text-gray-400'}`}>
                          {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className={`text-base font-black truncate ${currentGeneration?.id === item.id ? 'text-white' : 'text-gray-900'}`}>
                          IP Concept #{item.id.slice(-4)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <CheckCircle2 className={`w-3.5 h-3.5 ${currentGeneration?.id === item.id ? 'text-blue-200' : 'text-green-500'}`} />
                          <span className={`text-[10px] font-black uppercase tracking-tighter ${currentGeneration?.id === item.id ? 'text-blue-100' : 'text-gray-400'}`}>Success 2K</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => deleteHistoryItem(item.id, e)}
                      className={`absolute top-4 right-4 p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all ${currentGeneration?.id === item.id ? 'hover:bg-blue-500 text-white' : 'hover:bg-red-50 text-red-500'}`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; subtitle: string; image: string; onDownload: () => void }> = ({ title, subtitle, image, onDownload }) => (
  <div className="w-full bg-white group/section border-b border-gray-50 last:border-0">
    <div className="px-10 pt-10 pb-4 flex items-center justify-between">
      <div className="space-y-1">
        <h4 className="text-xl font-black text-gray-900 tracking-tighter uppercase italic flex items-center gap-3">
          <span className="w-8 h-[3px] bg-blue-600 rounded-full" />
          {title}
        </h4>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] ml-11">{subtitle}</p>
      </div>
      <button 
        onClick={onDownload}
        className="opacity-0 group-hover/section:opacity-100 transition-all duration-300 p-3 hover:bg-blue-600 hover:text-white rounded-2xl text-blue-600 bg-blue-50 flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 transform translate-y-2 group-hover/section:translate-y-0"
      >
        <Download className="w-4 h-4" />
        HD 2K
      </button>
    </div>
    <div className="w-full p-4 md:p-10">
      <div className="bg-gray-50 rounded-[2rem] p-2 md:p-4 shadow-inner">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-auto object-contain rounded-2xl hover:scale-[1.02] transition-transform duration-700 cursor-zoom-in shadow-2xl" 
        />
      </div>
    </div>
  </div>
);

export default App;