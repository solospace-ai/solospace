'use client';

import React, { useState, useEffect, useRef } from "react";
import { 
  X, Key, Eye, EyeOff, ExternalLink, ShieldCheck, AlertCircle, 
  Check, Globe, Sliders, Settings, Sparkles, HelpCircle, ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useWorkflowStore } from "@/store/workflowStore";
import { set as idbSet, del as idbDel } from 'idb-keyval';

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
    description: "GPT-4.1, Codex, and o-series reasoning models (Recommended)",
    key_url: "https://platform.openai.com/api-keys",
    key_hint: "sk-...",
    default_model: "gpt-4.1",
    models: [
      { id: "gpt-4.1", name: "GPT-4.1", tier: "advanced" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", tier: "fast" },
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", tier: "fast" },
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
  },
  ollama_cloud: {
    name: "Ollama Cloud",
    description: "Hosted Ollama Cloud models via https://ollama.com",
    key_url: "https://ollama.com",
    key_hint: "Ollama API Key",
    default_model: "llama3",
    models: [
      { id: "llama3", name: "Llama 3", tier: "cloud" },
      { id: "mistral", name: "Mistral", tier: "cloud" },
      { id: "phi3", name: "Phi 3", tier: "cloud" }
    ]
  },
  alibaba: {
    name: "Alibaba Cloud (Qwen)",
    description: "Qwen model family via DashScope OpenAI-compatible endpoint",
    key_url: "https://www.alibabacloud.com/help/en/model-studio/developer-reference/api-key",
    key_hint: "sk-...",
    default_model: "qwen-turbo",
    models: [
      { id: "qwen-turbo", name: "Qwen Turbo", tier: "fast" },
      { id: "qwen-plus", name: "Qwen Plus", tier: "advanced" },
      { id: "qwen-max", name: "Qwen Max", tier: "advanced" },
      { id: "qwen-long", name: "Qwen Long", tier: "advanced" },
      { id: "qwen2.5-72b-instruct", name: "Qwen 2.5 72B Instruct", tier: "advanced" },
      { id: "qwen2.5-14b-instruct", name: "Qwen 2.5 14B Instruct", tier: "fast" }
    ]
  },
  nvidia: {
    name: "NVIDIA NIM",
    description: "NVIDIA NIM inference microservices — optimized open models",
    key_url: "https://build.nvidia.com",
    key_hint: "nvapi-...",
    default_model: "meta/llama-3.1-70b-instruct",
    models: [
      { id: "meta/llama-3.1-70b-instruct", name: "Llama 3.1 70B Instruct", tier: "advanced" },
      { id: "meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B Instruct", tier: "fast" },
      { id: "mistralai/mixtral-8x7b-instruct-v0.1", name: "Mixtral 8x7B Instruct", tier: "fast" },
      { id: "microsoft/phi-3-mini-128k-instruct", name: "Phi-3 Mini 128K", tier: "fast" },
      { id: "google/gemma-2-9b-it", name: "Gemma 2 9B IT", tier: "fast" },
      { id: "nvidia/llama3-chatqa-1.5-70b", name: "ChatQA 1.5 70B", tier: "advanced" }
    ]
  },
  glm: {
    name: "Zhipu GLM",
    description: "GLM models from Zhipu AI (via z.ai)",
    key_url: "https://api.z.ai/",
    key_hint: "",
    default_model: "glm-4-flash",
    models: [
      { id: "glm-4-flash", name: "GLM 4 Flash", tier: "fast" },
      { id: "glm-4-plus", name: "GLM 4 Plus", tier: "advanced" },
      { id: "glm-4-air", name: "GLM 4 Air", tier: "fast" },
      { id: "glm-4", name: "GLM 4", tier: "advanced" }
    ]
  },
  "z.ai": {
    name: "z.ai",
    description: "GLM models from z.ai",
    key_url: "https://api.z.ai/",
    key_hint: "",
    default_model: "glm-4-flash",
    models: [
      { id: "glm-4-flash", name: "GLM 4 Flash", tier: "fast" },
      { id: "glm-4-plus", name: "GLM 4 Plus", tier: "advanced" },
      { id: "glm-4-air", name: "GLM 4 Air", tier: "fast" },
      { id: "glm-4", name: "GLM 4", tier: "advanced" }
    ]
  }
};

interface CustomSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const CustomSelect = ({
  value,
  onChange,
  options,
  disabled = false
}: {
  value: string;
  onChange: (val: string) => void;
  options: CustomSelectOption[];
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500 cursor-pointer flex justify-between items-center text-left disabled:opacity-50 select-none"
      >
        <span className="truncate">{selectedOption?.label || value || "Select..."}</span>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 w-full mt-1.5 bg-[#0d0d0d] border border-[#1f1f1f] rounded-xl shadow-2xl overflow-y-auto max-h-60 custom-scrollbar p-1"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-between disabled:opacity-30 ${
                  opt.value === value
                    ? "bg-white text-black font-semibold"
                    : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                }`}
              >
                <span className="truncate pr-4">{opt.label}</span>
                {opt.value === value && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function APIKeysModal({ isOpen, onClose }: APIKeysModalProps) {
  const apiKeys = useWorkflowStore((s) => s.apiKeys);
  const setProviderApiKey = useWorkflowStore((s) => s.setProviderApiKey);
  const backupApiKeys = useWorkflowStore((s) => s.backupApiKeys);
  const setBackupApiKey = useWorkflowStore((s) => s.setBackupApiKey);
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
  const [backupKey1Input, setBackupKey1Input] = useState<string>("");
  const [backupKey2Input, setBackupKey2Input] = useState<string>("");
  const [showBackupKey1, setShowBackupKey1] = useState<boolean>(false);
  const [showBackupKey2, setShowBackupKey2] = useState<boolean>(false);
  const [showBackupExpander, setShowBackupExpander] = useState<boolean>(false);
  const [showSecondBackup, setShowSecondBackup] = useState<boolean>(false);
  const [baseUrlInput, setUrlInput] = useState<string>("");
  const [fallbackProv, setFallbackProv] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  
  // Ollama status check state
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  
  // Connection Testing State
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });

  // Load backend providers config or fallback
  const providersConfig: Record<string, any> = Object.keys(availableProvidersFromStore || {}).length > 0 
    ? availableProvidersFromStore 
    : FALLBACK_PROVIDERS;

  const checkOllama = async () => {
    setOllamaStatus('checking');
    try {
      const resp = await fetch("/api/gemini/ollama");
      if (resp.ok) {
        const data = await resp.json();
        if (data.ollama_available || (Array.isArray(data.models) && data.models.length > 0)) {
          setOllamaStatus('available');
        } else {
          setOllamaStatus('unavailable');
        }
      } else {
        setOllamaStatus('unavailable');
      }
    } catch (e) {
      setOllamaStatus('unavailable');
    }
  };

  // Initialize fields when modal opens
  useEffect(() => {
    if (isOpen) {
      const currentProv = activeProvider || "gemini";
      setSelectedProvider(currentProv);
      setSelectedModel(activeModel || "");
      setFallbackProv(fallbackProvider || "");
      setApiKeyInput(apiKeys[currentProv] || "");
      
      const backupKeys = backupApiKeys[currentProv] || [];
      setBackupKey1Input(backupKeys[0] || "");
      setBackupKey2Input(backupKeys[1] || "");
      setShowBackupExpander(!!(backupKeys[0] || backupKeys[1]));
      setShowSecondBackup(!!backupKeys[1]);

      const defaultUrl = currentProv === 'ollama' ? "http://localhost:11434/v1" : "";
      setUrlInput(providerBaseUrls[currentProv] || defaultUrl);
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
      if (currentProv === 'ollama') {
        checkOllama();
      }
    }
  }, [isOpen]);

  // Sync inputs when selected provider changes
  const handleProviderChange = (newProvider: string) => {
    setSelectedProvider(newProvider);
    setApiKeyInput(apiKeys[newProvider] || "");
    
    const backupKeys = backupApiKeys[newProvider] || [];
    setBackupKey1Input(backupKeys[0] || "");
    setBackupKey2Input(backupKeys[1] || "");
    setShowBackupExpander(!!(backupKeys[0] || backupKeys[1]));
    setShowSecondBackup(!!backupKeys[1]);
    
    const defaultUrl = newProvider === 'ollama' ? "http://localhost:11434/v1" : "";
    setUrlInput(providerBaseUrls[newProvider] || defaultUrl);
    setTestResult({ status: 'idle', message: '' });

    // Pick default model or first model for this new provider
    const provConfig = providersConfig[newProvider] || {};
    const modelsList = providerModels[newProvider] || provConfig.models || [];
    const defaultMod = modelsList.length > 0 ? modelsList[0].id : (provConfig.default_model || "");
    setSelectedModel(defaultMod);
    setIsCustomModelInput(modelsList.length === 0 && newProvider !== 'ollama');
    setCustomModelText("");

    // Fetch latest models list in the background
    fetchProviderModels(newProvider).catch(() => {});
    if (newProvider === 'ollama') {
      checkOllama();
    }
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
    await setBackupApiKey(selectedProvider, 0, backupKey1Input.trim());
    await setBackupApiKey(selectedProvider, 1, backupKey2Input.trim());
    setProviderBaseUrl(selectedProvider, baseUrlInput.trim());
    await setProvider(selectedProvider);
    await setModel(selectedModel);
    setFallbackProvider(fallbackProv);

    // Save custom model custom string if user selected custom
    if (isCustomModelInput && customModelText.trim()) {
      await idbSet(`solospace_custom_model_${selectedProvider}`, customModelText.trim());
    } else {
      await idbDel(`solospace_custom_model_${selectedProvider}`);
    }

    onClose();
  };

  if (!isOpen) return null;

  const currentProviderInfo = providersConfig[selectedProvider] || {};
  const modelsList = providerModels[selectedProvider] || currentProviderInfo.models || [];
  
  // Custom or local providers require base URL
  const isCustomOrLocal = selectedProvider === 'ollama' || selectedProvider === 'lmstudio' || selectedProvider === 'custom' || currentProviderInfo.is_custom || currentProviderInfo.is_local;
  const isLocalProvider = selectedProvider === 'ollama' || selectedProvider === 'lmstudio' || !!currentProviderInfo.is_local;

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
            <p className="text-xs text-neutral-400 font-sans mt-0.5">Powered by OpenAI GPT-4.1 & Codex. Configure your active AI provider, model routing, and keys.</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* 1. Provider Selector */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Provider</label>
            <CustomSelect
              value={selectedProvider}
              onChange={handleProviderChange}
              options={Object.keys(providersConfig).map((pKey) => ({
                value: pKey,
                label: providersConfig[pKey]?.name || pKey
              }))}
            />
          </div>

          {/* 2. Model Selector */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Model</label>
              {(modelsList.length > 0 || selectedProvider === 'ollama') && (
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
            {isCustomModelInput || (modelsList.length === 0 && selectedProvider !== 'ollama') ? (
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
              <CustomSelect
                value={selectedModel}
                onChange={(val) => {
                  if (val === "__custom__") {
                    setIsCustomModelInput(true);
                    setCustomModelText(selectedModel);
                  } else {
                    setSelectedModel(val);
                  }
                }}
                options={[
                  ...(selectedProvider === "ollama" && modelsList.length === 0
                    ? [{ value: "", label: "No local models detected", disabled: true }]
                    : modelsList.map((m: any) => ({
                        value: m.id,
                        label: `${m.name || m.id} (${m.tier || "standard"})`
                      }))),
                  { value: "__custom__", label: "Custom Model ID..." }
                ]}
              />
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

          {/* 4. API Key Input or Status Box (Ollama) */}
          {selectedProvider === "ollama" ? (
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">
                Ollama Status
              </label>
              <div className="bg-black border border-[#1f1f1f] rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs">
                  {ollamaStatus === "checking" && (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin shrink-0" />
                      <span className="text-neutral-400 font-mono">Checking local Ollama availability...</span>
                    </>
                  )}
                  {ollamaStatus === "available" && (
                    <>
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-emerald-400 font-mono font-bold">Ollama running locally</span>
                    </>
                  )}
                  {ollamaStatus === "unavailable" && (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span className="text-rose-400 font-mono font-bold">Ollama not detected</span>
                    </>
                  )}
                </div>
                {ollamaStatus === "unavailable" && (
                  <p className="text-[10px] text-neutral-400 leading-normal font-sans">
                    Make sure Ollama is running on your machine. You can download it from{" "}
                    <a
                      href="https://ollama.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      ollama.com <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </p>
                )}
              </div>
            </div>
          ) : (
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
          )}

          {/* Backup API Keys Expandable Section */}
          {selectedProvider !== "ollama" && (
            <div className="space-y-2 mt-2">
              {!showBackupExpander ? (
                <button
                  type="button"
                  onClick={() => setShowBackupExpander(true)}
                  className="text-[10px] text-cyan-400 hover:underline font-mono cursor-pointer flex items-center gap-1"
                >
                  + Add backup key
                </button>
              ) : (
                <div className="border border-[#1f1f1f] bg-black/40 rounded-xl p-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Backup Keys</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBackupExpander(false);
                        setBackupKey1Input("");
                        setBackupKey2Input("");
                        setShowSecondBackup(false);
                      }}
                      className="text-[9px] text-rose-400 hover:underline font-mono cursor-pointer"
                    >
                      Remove all
                    </button>
                  </div>
                  
                  {/* Backup Key 1 */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-neutral-500">Backup Key 1</label>
                    <div className="relative">
                      <input
                        type={showBackupKey1 ? "text" : "password"}
                        placeholder="Enter backup key 1"
                        value={backupKey1Input}
                        onChange={(e) => setBackupKey1Input(e.target.value)}
                        className="w-full bg-black border border-[#1f1f1f] rounded-lg pl-3 pr-10 py-2 text-xs text-white outline-none focus:border-neutral-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBackupKey1(!showBackupKey1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white cursor-pointer"
                      >
                        {showBackupKey1 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Backup Key 2 */}
                  {!showSecondBackup ? (
                    <button
                      type="button"
                      onClick={() => setShowSecondBackup(true)}
                      className="text-[10px] text-cyan-400 hover:underline font-mono cursor-pointer flex items-center gap-1"
                    >
                      + Add another backup key
                    </button>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-mono uppercase text-neutral-500">Backup Key 2</label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowSecondBackup(false);
                            setBackupKey2Input("");
                          }}
                          className="text-[9px] text-neutral-500 hover:text-neutral-300 font-mono cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showBackupKey2 ? "text" : "password"}
                          placeholder="Enter backup key 2"
                          value={backupKey2Input}
                          onChange={(e) => setBackupKey2Input(e.target.value)}
                          className="w-full bg-black border border-[#1f1f1f] rounded-lg pl-3 pr-10 py-2 text-xs text-white outline-none focus:border-neutral-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowBackupKey2(!showBackupKey2)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white cursor-pointer"
                        >
                          {showBackupKey2 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 5. Fallback Provider Selector */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Automatic Fallback</label>
            <CustomSelect
              value={fallbackProv}
              onChange={setFallbackProv}
              options={[
                { value: "", label: "No Fallback (Error immediately)" },
                ...Object.keys(providersConfig)
                  .filter((pKey) => pKey !== selectedProvider)
                  .map((pKey) => ({
                    value: pKey,
                    label: `Fallback: ${providersConfig[pKey]?.name || pKey}`
                  }))
              ]}
            />
          </div>

          {/* Connection Test pipeline */}
          {isLocalProvider ? (
            <div className="p-3 bg-neutral-950/40 border border-[#1f1f1f] rounded-xl text-[10px] text-neutral-400 font-mono leading-normal">
              ℹ️ Local models run directly on your machine and do not require API connection testing.
            </div>
          ) : (
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
          )}

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
