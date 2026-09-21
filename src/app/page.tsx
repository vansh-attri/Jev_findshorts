'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Search, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch('/api/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setResults(data.chunks || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const highPotentialChunks = results.filter(r => r.evaluation?.answers?.virality_potential === 'High' && r.evaluation?.answers?.is_standalone);
  const otherChunks = results.filter(r => r.evaluation?.answers?.virality_potential !== 'High' || !r.evaluation?.answers?.is_standalone);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 selection:bg-indigo-500/30">
      {/* Background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] bg-rose-600/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <main className="relative max-w-5xl mx-auto px-6 py-20 flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12 space-y-4"
        >
          <div className="inline-flex items-center justify-center p-3 bg-neutral-900/50 border border-neutral-800 rounded-2xl mb-4 shadow-xl">
            <Video className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
            AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Shorts</span> Clipper
          </h1>
          <p className="text-neutral-400 max-w-xl mx-auto text-lg">
            Paste a YouTube URL below to auto-transcribe and evaluate the best clips for short-form content using Jev.
          </p>
        </motion.div>

        <motion.form 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleAnalyze} 
          className="w-full max-w-2xl relative mb-16"
        >
          <div className="relative flex items-center">
            <div className="absolute left-4 text-neutral-500">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full bg-neutral-900/60 border border-neutral-800 text-white rounded-full py-4 pl-12 pr-32 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all backdrop-blur-xl shadow-xl"
            />
            <button 
              disabled={loading || !url}
              className="absolute right-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 text-white font-medium rounded-full px-6 py-2 transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
            </button>
          </div>
        </motion.form>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 mb-12"
          >
            <XCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}

        {results.length > 0 && (
          <div className="w-full space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                Highly Recommended Clips
              </h2>
              {highPotentialChunks.length === 0 ? (
                <p className="text-neutral-500 bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800/50">No high-potential clips found in the analyzed section.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {highPotentialChunks.map((chunk, i) => (
                    <ChunkCard key={i} chunk={chunk} recommended />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl font-semibold text-neutral-300 mb-6 border-b border-neutral-800 pb-2">
                Other Analyzed Sections
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {otherChunks.map((chunk, i) => (
                  <ChunkCard key={i} chunk={chunk} />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ChunkCard({ chunk, recommended = false }: { chunk: any, recommended?: boolean }) {
  const ans = chunk.evaluation?.answers || {};
  const hasError = !!chunk.error;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "group p-6 rounded-2xl border transition-all duration-300 flex flex-col gap-4",
        recommended 
          ? "bg-gradient-to-b from-indigo-500/10 to-transparent border-indigo-500/30 hover:border-indigo-500/60 shadow-[0_0_30px_-10px_rgba(99,102,241,0.2)]" 
          : "bg-neutral-900/30 border-neutral-800/50 hover:border-neutral-700"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-neutral-400 bg-neutral-950/50 px-3 py-1.5 rounded-lg border border-neutral-800">
          <Clock className="w-4 h-4" />
          <span className="font-mono text-sm font-medium">
            {formatTime(chunk.startTime)} - {formatTime(chunk.endTime)}
          </span>
        </div>
        
        {ans.content_type && (
          <span className="text-xs font-medium px-3 py-1 bg-neutral-800 text-neutral-300 rounded-full">
            {ans.content_type}
          </span>
        )}
      </div>

      <div className="flex-1">
        <p className="text-neutral-200 text-sm leading-relaxed line-clamp-4 group-hover:line-clamp-none transition-all duration-300">
          "{chunk.text}"
        </p>
      </div>

      {!hasError && ans ? (
        <div className="grid grid-cols-3 gap-2 mt-2 pt-4 border-t border-neutral-800/50">
          <div className="flex flex-col">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Virality</span>
            <span className={cn(
              "text-sm font-medium",
              ans.virality_potential === 'High' ? 'text-emerald-400' : 
              ans.virality_potential === 'Medium' ? 'text-amber-400' : 'text-neutral-400'
            )}>{ans.virality_potential || 'N/A'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Standalone</span>
            <span className={cn(
              "text-sm font-medium",
              ans.is_standalone ? 'text-emerald-400' : 'text-rose-400'
            )}>{ans.is_standalone ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Hook</span>
            <span className={cn(
              "text-sm font-medium",
              ans.has_hook ? 'text-emerald-400' : 'text-neutral-400'
            )}>{ans.has_hook ? 'Yes' : 'No'}</span>
          </div>
        </div>
      ) : (
        <div className="mt-2 pt-4 border-t border-neutral-800/50 text-rose-400 text-xs">
          Evaluation failed: {chunk.error}
        </div>
      )}
    </motion.div>
  );
}
