'use client';

import React, { useState, useEffect } from "react";
import { 
  X, Key, Eye, EyeOff, ExternalLink, ShieldCheck, AlertCircle, 
  Check, Globe, Sliders, Settings, Sparkles, HelpCircle 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useWorkflowStore } from "@/store/workflowStore";

interface APIKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FALLBACK_PROVIDERS = {
  gemini: {
    name: "Google Gemini",
    description: "Google's flagship multimodal AI models",
    key_url: "https://aistudio.google.com/apikey",
    key_hint: "AIzaSy...",
    default_model: "gemini-2.5-flash",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", tier: "fast" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", tier: "advanced" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", tier: "fast" },
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", tier: "fast" }
    ]
  },
  openai: {
    name: "OpenAI",
    description: "GPT-4o and o-series reasoning models",
    key_url: "https://platform.openai.com/api-keys",
    key_hint: "sk-...",
    default_model: "gpt-4o",
    models: [
      { id: "gpt-4o", name: "GPT-4o", tier: "advanced" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", tier: "fast" },
      { id: "o3-mini", name: "o3-mini", tier: "reasoning" },
      { id: "o1", name: "o1", tier: "reasoning" }
    ]
  },
  claude: {
    name: "Anthropic Claude",
    description: "Sovereign intelligence with Claude 3.5 & 3.7 family",
    key_url: "https://console.anthropic.com/settings/keys",
    key_hint: "sk-ant-...",
    default_model: "claude-sonnet-4-20250514",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", tier: "advanced" },
      { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", tier: "advanced" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", tier: "advanced" },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", tier: "fast" }
    ]
  },
  deepseek: {
    name: "DeepSeek",
    description: "High-intelligence open reasoning and chat models",
    key_url: "https://platform.deepseek.com/api_keys",
    key_hint: "sk-...",
    default_model: "deepseek-chat",
    models: [
      { id: "deepseek-chat", name: "DeepSeek V3", tier: "advanced" },
      { id: "deepseek-reasoner", name: "DeepSeek R1", tier: "reasoning" }
    ]
  },
  groq: {
    name: "Groq",
    description: "Ultra-low-latency LPU model execution",
    key_url: "https://console.groq.com/keys",
    key_hint: "gsk_...",
    default_model: "llama-3.3-70b-versatile",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", tier: "fast" },
      { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill Llama 70B", tier: "reasoning" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", tier: "fast" }
    ]
  },
  openrouter: {
    name: "OpenRouter",
    description: "Consolidated API for hundreds of LLMs",
    key_url: "https://openrouter.ai/keys",
    key_hint: "sk-or-...",
    default_model: "openai/gpt-4o",
    models: [
      { id: "openai/gpt-4o", name: "GPT-4o", tier: "advanced" },
      { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet", tier: "advanced" },
      { id: "deepseek/deepseek-chat", name: "DeepSeek V3", tier: "open" }
    ]
  },
  ollama: {
    name: "Ollama (Local)",
    description: "Local model hosting engine running on your system",
    key_url: "https://ollama.com",
    key_hint: "No credentials needed",
    default_model: "llama3",
    models: [
      { id: "llama3", name: "Llama 3", tier: "open" },
      { id: "mistral", name: "Mistral", tier: "open" },
      { id: "phi3", name: "Phi 3", tier: "open" }
    ]
  }
};

export default function APIKeysModal({ isOpen, onClose }: APIKeysModalProps) {
  const apiKeys = useWorkflowStore((s) => s.apiKeys);
  const setProviderApiKey = useWorkflowStore((s) => s.setProviderApiKey);
  const activeProvider = useWorkflowStore((s) => s.provider);
  const setProvider = useWorkflowStore((s) => s.setProvider);
  const activeModel = useWorkflowStore((s) => s.model);
  const setModel = useWorkflowStore((s) => s.setModel);
  const availableProvidersFromStore = useWorkflowStore((s) => s.availableProviders);
  const providerBaseUrls = useWorkflowStore((s) => s.providerBaseUrls);
  const setProviderBaseUrl = useWorkflowStore((s) => s.setProviderBaseUrl);
  const providerModels = useWorkflowStore((s) => s.providerModels);
  const fetchProviderModels = useWorkflowStore((s) => s.fetchProviderModels);
  const fallbackProvider = useWorkflowStore((s) => s.fallbackProvider);
  const setFallbackProvider = useWorkflowStore((s) => s.setFallbackProvider);

  // Local Form State
  const [selectedProvider, setSelectedProvider] = useState<string>("gemini");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isCustomModelInput, setIsCustomModelInput] = useState<boolean>(false);
  const [customModelText, setCustomModelText] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState<string>("");
  const [baseUrlInput, setUrlInput] = useState<string>("");
  const [fallbackProv, setFallbackProv] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  
  // Connection Testing State
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });

  // Load backend providers config or fallback
  const providersConfig: Record<string, any> = Object.keys(availableProvidersFromStore || {}).length > 0 
    ? availableProvidersFromStore 
    : FALLBACK_PROVIDERS;

  // Initialize fields when modal opens
  useEffect(() => {
    if (isOpen) {
      const currentProv = activeProvider || "gemini";
      setSelectedProvider(currentProv);
      setSelectedModel(activeModel || "");
      setFallbackProv(fallbackProvider || "");
      setApiKeyInput(apiKeys[currentProv] || "");
      setUrlInput(providerBaseUrls[currentProv] || "");
      setShowKey(false);
      setTestResult({ status: 'idle', message: '' });

      const provConfig = providersConfig[currentProv] || {};
      const modelsList = providerModels[currentProv] || provConfig.models || [];
      const isPredefined = modelsList.some((m: any) => m.id === activeModel);
      if (!isPredefined && activeModel) {
        setIsCustomModelInput(true);
        setCustomModelText(activeModel);
      } else {
        setIsCustomModelInput(false);
        setCustomModelText("");
      }

      fetchProviderModels(currentProv).catch(() => {});
    }
  }, [isOpen]);

  // Sync inputs when selected provider changes
  const handleProviderChange = (newProvider: string) => {
    setSelectedProvider(newProvider);
    setApiKeyInput(apiKeys[newProvider] || "");
    setUrlInput(providerBaseUrls[newProvider] || "");
    setTestResult({ status: 'idle', message: '' });

    // Pick default model or first model for this new provider
    const provConfig = providersConfig[newProvider] || {};
    const modelsList = providerModels[newProvider] || provConfig.models || [];
    const defaultMod = modelsList.length > 0 ? modelsList[0].id : (provConfig.default_model || "");
    setSelectedModel(defaultMod);
    setIsCustomModelInput(modelsList.length === 0);
    setCustomModelText("");

    // Fetch latest models list in the background
    fetchProviderModels(newProvider).catch(() => {});
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult({ status: 'idle', message: '' });

    try {
      const response = await fetch("/api/gemini/test_agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node: {
            id: "test",
            data: {
              name: "Test Connection Agent",
              systemPrompt: "You are a friendly connection validation utility. Keep answers brief.",
              model: selectedModel
            }
          },
          provider: selectedProvider,
          api_key: apiKeyInput.trim(),
          api_keys: { ...apiKeys, [selectedProvider]: apiKeyInput.trim() },
          base_url: baseUrlInput.trim() || undefined
        })
      });

      const data = await response.json();
      if (response.ok && data.status === "success") {
        setTestResult({
          status: 'success',
          message: `Connection successful! Output: "${data.response?.substring(0, 50) || 'Success'}"`
        });
      } else {
        setTestResult({
          status: 'error',
          message: data.detail || data.error || "Connection failed. Please check credentials and endpoint."
        });
      }
    } catch (e: any) {
      setTestResult({
        status: 'error',
        message: e.message || "Failed to reach the API server. Ensure your backend is running."
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    // Save to Zustand store & IndexedDB
    await setProviderApiKey(selectedProvider, apiKeyInput.trim());
    setProviderBaseUrl(selectedProvider, baseUrlInput.trim());
    setProvider(selectedProvider);
    setModel(selectedModel);
    setFallbackProvider(fallbackProv);
    onClose();
  };

  if (!isOpen) return null;

  const currentProviderInfo = providersConfig[selectedProvider] || {};
  const modelsList = providerModels[selectedProvider] || currentProviderInfo.models || [];
  
  // Custom or local providers require base URL
  const isCustomOrLocal = selectedProvider === 'ollama' || selectedProvider === 'lmstudio' || selectedProvider === 'custom' || currentProviderInfo.is_custom || currentProviderInfo.is_local;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="w-full max-w-md bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl text-white overflow-y-auto max-h-[90vh] custom-scrollbar"
      >
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer transition-colors">
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex gap-4 items-center mb-6">
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
            <Key className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">AI Engine Settings</h3>
            <p className="text-xs text-neutral-400 font-sans mt-0.5">Configure your active AI provider, model routing, and keys.</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* 1. Provider Selector */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Provider</label>
            <select
              value={selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500 cursor-pointer"
            >
              {Object.keys(providersConfig).map((pKey) => (
                <option key={pKey} value={pKey}>
                  {providersConfig[pKey]?.name || pKey}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Model Selector */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Model</label>
              {modelsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const willBeCustom = !isCustomModelInput;
                    setIsCustomModelInput(willBeCustom);
                    if (willBeCustom) {
                      setCustomModelText(selectedModel);
                    } else {
                      const defaultMod = modelsList[0]?.id || currentProviderInfo.default_model || "";
                      setSelectedModel(defaultMod);
                    }
                  }}
                  className="text-[9px] text-cyan-400 hover:underline font-mono cursor-pointer"
                >
                  {isCustomModelInput ? "Select from list" : "Enter custom model ID"}
                </button>
              )}
            </div>
            {isCustomModelInput || modelsList.length === 0 ? (
              <input
                type="text"
                placeholder="e.g. custom-fine-tune-v1, llama3"
                value={isCustomModelInput ? customModelText : selectedModel}
                onChange={(e) => {
                  const val = e.target.value;
                  if (isCustomModelInput) {
                    setCustomModelText(val);
                  }
                  setSelectedModel(val);
                }}
                className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500 font-mono"
              />
            ) : (
              <select
                value={selectedModel}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__custom__") {
                    setIsCustomModelInput(true);
                    setCustomModelText(selectedModel);
                  } else {
                    setSelectedModel(val);
                  }
                }}
                className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500 cursor-pointer"
              >
                {modelsList.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id} ({m.tier || "standard"})
                  </option>
                ))}
                <option value="__custom__">Custom Model ID...</option>
              </select>
            )}
          </div>

          {/* 3. Custom Base URL Gateway */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" /> Base URL {isCustomOrLocal ? "(Required)" : "(Optional)"}
            </label>
            <input
              type="text"
              placeholder={currentProviderInfo.base_url || "https://api.provider.com/v1"}
              value={baseUrlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500 font-mono"
            />
          </div>

          {/* 4. API Key Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">
                {selectedProvider.toUpperCase()}_API_KEY
              </label>
              {currentProviderInfo.key_url && (
                <a
                  href={currentProviderInfo.key_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[9px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Get key <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                placeholder={
                  currentProviderInfo.key_hint
                    ? `Enter key (starts with ${currentProviderInfo.key_hint})`
                    : "Enter API key"
                }
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="w-full bg-black border border-[#1f1f1f] rounded-xl pl-4 pr-12 py-3 text-xs text-white outline-none focus:border-neutral-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 5. Fallback Provider Selector */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Automatic Fallback</label>
            <select
              value={fallbackProv}
              onChange={(e) => setFallbackProv(e.target.value)}
              className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500 cursor-pointer"
            >
              <option value="">No Fallback (Error immediately)</option>
              {Object.keys(providersConfig)
                .filter((pKey) => pKey !== selectedProvider)
                .map((pKey) => (
                  <option key={pKey} value={pKey}>
                    Fallback: {providersConfig[pKey]?.name || pKey}
                  </option>
                ))}
            </select>
          </div>

          {/* Connection Test pipeline */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || (!apiKeyInput && selectedProvider !== "ollama" && selectedProvider !== "lmstudio")}
              className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 border border-[#1f1f1f] text-neutral-300 hover:text-white font-bold rounded-xl text-xs font-mono transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-20 disabled:scale-100"
            >
              {isTesting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Testing Pipeline...
                </>
              ) : (
                "Test Connection"
              )}
            </button>

            {/* Test Connection Results */}
            <AnimatePresence>
              {testResult.status !== 'idle' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className={`mt-3 flex items-start gap-2.5 p-3 rounded-xl text-[10px] leading-normal font-mono border ${
                    testResult.status === 'success'
                      ? 'bg-emerald-950/20 border-emerald-950/30 text-emerald-400'
                      : 'bg-rose-950/20 border-rose-950/30 text-rose-400'
                  }`}
                >
                  {testResult.status === 'success' ? (
                    <Check className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  )}
                  <span className="whitespace-pre-wrap">{testResult.message}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 6. Save and Cancel Buttons */}
          <div className="pt-4 flex gap-3 border-t border-[#141414]">
            <button
              id="save-api-key-btn"
              onClick={handleSaveSettings}
              className="flex-1 py-2.5 bg-white hover:bg-neutral-100 text-black font-bold rounded-xl text-xs font-mono transition-colors cursor-pointer"
            >
              Save Settings
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 border border-[#1f1f1f] text-neutral-400 hover:text-white rounded-xl text-xs font-mono transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
