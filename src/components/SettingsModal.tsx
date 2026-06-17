import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Settings, 
  Sparkles, 
  Key, 
  Globe, 
  AlertTriangle, 
  CheckCircle, 
  Smartphone, 
  Info,
  Server,
  Compass
} from 'lucide-react';
import { getGeminiConfig, saveGeminiConfig, GeminiConfig } from '../utils/geminiClient';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<GeminiConfig>(getGeminiConfig());
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testError, setTestError] = useState<string>('');

  // Update original state when opening
  useEffect(() => {
    if (isOpen) {
      setConfig(getGeminiConfig());
      setTestStatus('idle');
      setTestError('');
    }
  }, [isOpen]);

  const handleSave = () => {
    saveGeminiConfig(config);
    onClose();
    // Dispatch a custom event so other components know configuration has refreshed
    window.dispatchEvent(new Event('et_config_updated'));
  };

  const handleTestKey = async () => {
    if (!config.apiKey) {
      setTestStatus('failed');
      setTestError('Please paste your Gemini API Key first.');
      return;
    }

    setTestStatus('testing');
    setTestError('');

    try {
      // Hit lightweight public model endpoint to test the key
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: 'Say "API works" as a raw text string' }
                ]
              }
            ]
          }),
        }
      );

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.error?.message || `HTTP Service Error ${response.status}`);
      }

      const resJson = await response.json();
      if (resJson.candidates?.[0]?.content?.parts?.[0]?.text) {
        setTestStatus('success');
      } else {
        throw new Error('No readable output received from Gemini test.');
      }
    } catch (err: any) {
      setTestStatus('failed');
      setTestError(err.message || 'Verification request failed. Please check internet connection or key.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div
            id="settings-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-black/70"
          />

          {/* Modal Container */}
          <motion.div
            id="settings-modal-content"
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 mx-auto max-h-[90vh] overflow-y-auto"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors pointer-events-auto"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="mb-6 mr-8">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                <Settings className="h-3.5 w-3.5" />
                Integration Settings
              </span>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white font-display">
                Mobile & AI Routing Panel
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Configure your Gemini connection to work flawlessly on static hosts (Netlify) and packaged phone apps.
              </p>
            </div>

            {/* Body Form */}
            <div className="space-y-6">
              {/* Routing Mode */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Select API Connection Mode
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Mode 1: Sandbox Server */}
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, mode: 'sandbox' }))}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all select-none cursor-pointer ${
                      config.mode === 'sandbox'
                        ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Server className={`h-4' w-4 ${config.mode === 'sandbox' ? 'text-indigo-500' : 'text-slate-400'}`} />
                        <span className="text-xs font-extrabold text-slate-800 dark:text-white">AI Studio Sandbox</span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-relaxed font-sans">
                        Uses default preview container server. Runs great within AI Studio.
                      </p>
                    </div>
                    <span className="text-[10px] mt-4 text-slate-400 italic">No Key Required</span>
                  </button>

                  {/* Mode 2: Direct Gemini REST */}
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, mode: 'direct' }))}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all select-none cursor-pointer ${
                      config.mode === 'direct'
                        ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Sparkles className={`h-4 w-4 ${config.mode === 'direct' ? 'text-emerald-500' : 'text-slate-400'}`} />
                        <span className="text-xs font-extrabold text-slate-800 dark:text-white">Direct Gemini API</span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-relaxed font-sans">
                        Bypasses sandbox firewalls. Connects 100% serverless from any mobile app or Netlify site.
                      </p>
                    </div>
                    <span className="text-[10px] mt-4 text-emerald-500 font-bold uppercase tracking-wider font-sans">Highly Recommended</span>
                  </button>

                  {/* Mode 3: Self Hosted Backend */}
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, mode: 'custom' }))}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all select-none cursor-pointer ${
                      config.mode === 'custom'
                        ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Globe className={`h-4 w-4 ${config.mode === 'custom' ? 'text-indigo-500' : 'text-slate-400'}`} />
                        <span className="text-xs font-extrabold text-slate-800 dark:text-white">Custom Backend</span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-relaxed font-sans">
                        Uses your own deployed Node server URL (e.g. on Render, Fly.io, or Railway).
                      </p>
                    </div>
                    <span className="text-[10px] mt-4 text-slate-400 italic">Advanced Users</span>
                  </button>
                </div>
              </div>

              {/* Mode Specific Settings Input Fields */}
              {config.mode === 'direct' && (
                <div className="p-5 rounded-2xl border border-emerald-100 dark:border-emerald-950/40 bg-emerald-50/5 dark:bg-emerald-950/5 space-y-4">
                  <div>
                    <label htmlFor="settings-api-key" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Key className="h-3.5 w-3.5 text-emerald-500" />
                      Google Gemini API Key
                    </label>
                    <div className="mt-2 flex gap-3">
                      <input
                        id="settings-api-key"
                        type="password"
                        placeholder="AIzaSy..."
                        value={config.apiKey}
                        onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                        className="flex-1 px-4 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleTestKey}
                        disabled={testStatus === 'testing'}
                        className="px-4 py-2 text-xs font-bold font-sans rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-all select-none disabled:opacity-50"
                      >
                        {testStatus === 'testing' ? 'Verifying...' : 'Test Connection'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-550 mt-1.5 font-sans leading-relaxed">
                      You can get a free secure Gemini API key instantly at{' '}
                      <a
                        href="https://aistudio.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-500 hover:underline font-bold"
                      >
                        aistudio.google.com
                      </a>. The key remains stored only locally on your phone or browser device folder.
                    </p>
                  </div>

                  {/* Feedback Status */}
                  {testStatus === 'success' && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500">
                      <CheckCircle className="h-4 w-4" />
                      <span>API verified successfully! Your receipt and statement OCR scanning is fully functional.</span>
                    </div>
                  )}
                  {testStatus === 'failed' && (
                    <div className="flex items-start gap-2 text-xs font-semibold text-rose-500 leading-normal">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{testError}</span>
                    </div>
                  )}
                </div>
              )}

              {config.mode === 'custom' && (
                <div className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-950/40 bg-indigo-50/5 dark:bg-indigo-950/5 space-y-3">
                  <div>
                    <label htmlFor="settings-backend-url" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5 text-indigo-550" />
                      Self-Hosted Production Backend URL
                    </label>
                    <input
                      id="settings-backend-url"
                      type="url"
                      placeholder="https://my-expense-tracker-backend.onrender.com"
                      value={config.customBackendUrl}
                      onChange={(e) => setConfig(prev => ({ ...prev, customBackendUrl: e.target.value }))}
                      className="mt-2 w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[11px] text-slate-400 dark:text-zinc-550 mt-1.5 leading-relaxed font-sans">
                      Connects directly to your Express backend `/server.ts` build hosted elsewhere without cookie constraints.
                    </p>
                  </div>
                </div>
              )}

              {/* Troubleshooting Webview and Mobile Apps guide */}
              <div className="border-t border-slate-100 dark:border-zinc-850 pt-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3">
                  <Smartphone className="h-4 w-4 text-indigo-500" />
                  Mobile WebView Wrapper setup (WebIntoApp / Cordorva / Capacitor)
                </h3>

                <div className="rounded-2xl bg-slate-50 dark:bg-zinc-950 p-4 space-y-3 text-left">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-250 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      1. Client-Side Serverless Advantage (Netlify Setup)
                    </h4>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 leading-relaxed pl-3.5 font-sans">
                      Standard Netlify hosting only hosts React static assets and ignores the <code className="font-mono text-[10px]">server.ts</code> completely. To make receipt OCR and bulk scanner work, switch the app mode to <strong>Direct Gemini API Mode</strong> and enter your API key. No server is required!
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-250 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      2. Camera & File Upload Permissions on Mobile
                    </h4>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 leading-relaxed pl-3.5 font-sans">
                      Mobile wrappers must be allowed device permissions to load assets. In your <strong>WebIntoApp</strong> dashboard or workspace, ensure the following fields are ticked:
                      <br />• <span className="font-semibold">Camera Access (Hardware Permission)</span>
                      <br />• <span className="font-semibold">Photo/File Gallery Access (Storage Permission)</span>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-250 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-505" />
                      3. CORS & CSP Whitelists
                    </h4>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 leading-relaxed pl-3.5 font-sans">
                      If requests fail inside webviews, verify your CSP meta tag whitelists connection to Google endpoints (<code className="font-mono text-[10px]">https://generativelanguage.googleapis.com</code>).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-zinc-850 pt-5">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors select-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-650 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-650/10 transition-all select-none"
              >
                Apply Routing Configuration
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
