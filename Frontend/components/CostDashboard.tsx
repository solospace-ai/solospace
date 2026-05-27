'use client';

import React, { useState, useEffect } from "react";
import { X, DollarSign, TrendingUp, AlertTriangle, ShieldAlert, Settings } from "lucide-react";
import { motion } from "motion/react";

interface CostRecord {
  sessionId: string;
  cost: number;
  timestamp: string;
}

interface CostDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string | null;
  currentSessionCost: number;
  currentModel: string;
  currentProvider: string;
}

export default function CostDashboard({
  isOpen,
  onClose,
  currentSessionId,
  currentSessionCost,
  currentModel,
  currentProvider,
}: CostDashboardProps) {
  const [budgetLimit, setBudgetLimit] = useState<number>(10.00);
  const [alertThreshold, setAlertThreshold] = useState<number>(80); // 80%
  const [costHistory, setCostHistory] = useState<CostRecord[]>([]);

  // Load configuration and history
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLimit = localStorage.getItem("solospace_budget_limit");
      if (savedLimit) setBudgetLimit(parseFloat(savedLimit));

      const savedThreshold = localStorage.getItem("solospace_budget_threshold");
      if (savedThreshold) setAlertThreshold(parseInt(savedThreshold));

      const savedHistory = localStorage.getItem("solospace_cost_history");
      if (savedHistory) {
        try {
          setCostHistory(JSON.parse(savedHistory));
        } catch (e) {
          console.error("Failed to parse cost history", e);
        }
      }
    }
  }, [isOpen]);

  // Update history with the current session cost
  useEffect(() => {
    if (!currentSessionId || currentSessionCost <= 0) return;

    setCostHistory((prev) => {
      const now = new Date().toISOString();
      const existingIdx = prev.findIndex((r) => r.sessionId === currentSessionId);
      let updated = [...prev];

      if (existingIdx > -1) {
        updated[existingIdx] = {
          ...updated[existingIdx],
          cost: currentSessionCost,
          timestamp: now,
        };
      } else {
        updated.push({
          sessionId: currentSessionId,
          cost: currentSessionCost,
          timestamp: now,
        });
      }

      localStorage.setItem("solospace_cost_history", JSON.stringify(updated));
      return updated;
    });
  }, [currentSessionId, currentSessionCost]);

  const handleSaveBudget = (limit: number, threshold: number) => {
    setBudgetLimit(limit);
    setAlertThreshold(threshold);
    localStorage.setItem("solospace_budget_limit", limit.toString());
    localStorage.setItem("solospace_budget_threshold", threshold.toString());
  };

  // Calculations
  const getTodayCost = () => {
    const today = new Date().toISOString().split("T")[0];
    return costHistory
      .filter((r) => r.timestamp.startsWith(today))
      .reduce((sum, r) => sum + r.cost, 0);
  };

  const getMonthCost = () => {
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    return costHistory
      .filter((r) => r.timestamp.startsWith(currentMonth))
      .reduce((sum, r) => sum + r.cost, 0);
  };

  const todayCost = getTodayCost();
  const monthCost = getMonthCost();
  const thresholdCost = budgetLimit * (alertThreshold / 100);
  const isCloseToLimit = monthCost >= thresholdCost && monthCost < budgetLimit;
  const isOverLimit = monthCost >= budgetLimit;

  // Simple pricing tiers lookup helper
  const getPricingTier = (modelId: string) => {
    const modelLower = modelId.toLowerCase();
    if (modelLower.includes("pro") || modelLower.includes("opus") || modelLower.includes("4o")) {
      return { tier: "Advanced", rate: "$3.00 / 1M tokens" };
    } else if (modelLower.includes("reasoning") || modelLower.includes("o1") || modelLower.includes("o3")) {
      return { tier: "Reasoning", rate: "$15.00 / 1M tokens" };
    } else if (modelLower.includes("flash") || modelLower.includes("mini") || modelLower.includes("haiku")) {
      return { tier: "Fast", rate: "$0.15 / 1M tokens" };
    }
    return { tier: "Standard", rate: "$0.50 / 1M tokens" };
  };

  const tierInfo = getPricingTier(currentModel);

  if (!isOpen) return null;

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
        className="w-full max-w-lg bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl flex flex-col max-h-[85vh] text-white"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer">
          <X className="w-5 h-5" />
        </button>

        <div className="flex gap-3 items-center border-b border-[#141414] pb-4 mb-4 shrink-0">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Token & Cost Dashboard</h3>
            <p className="text-[10px] text-neutral-500">Track and manage your real-time API spending budget.</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-5">
          {/* Alerts */}
          {isOverLimit && (
            <div className="bg-red-950/20 border border-red-900/40 p-3 rounded-xl flex gap-3 items-start">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-red-400 block font-mono uppercase tracking-wider">Budget Exceeded</span>
                Your monthly spending of <span className="font-bold">${monthCost.toFixed(4)}</span> has exceeded your monthly budget of <span className="font-bold">${budgetLimit.toFixed(2)}</span>. Consider switching to cheaper models or pausing operations.
              </div>
            </div>
          )}
          {!isOverLimit && isCloseToLimit && (
            <div className="bg-amber-950/20 border border-amber-900/40 p-3 rounded-xl flex gap-3 items-start">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-amber-400 block font-mono uppercase tracking-wider">Threshold Warning</span>
                Your monthly spending of <span className="font-bold">${monthCost.toFixed(4)}</span> has crossed <span className="font-bold">{alertThreshold}%</span> of your monthly budget limit (${budgetLimit.toFixed(2)}).
              </div>
            </div>
          )}

          {/* Current Session Widget */}
          <div className="bg-[#050505] border border-[#1f1f1f] p-4 rounded-xl space-y-3">
            <span className="text-[9px] font-mono uppercase text-neutral-500 font-bold block">Current Session Usage</span>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0a0a0a] border border-[#141414] p-3 rounded-lg">
                <span className="text-[9px] font-mono text-neutral-500 block">Session Cost</span>
                <span className="text-lg font-bold font-mono text-emerald-400">${currentSessionCost.toFixed(4)}</span>
              </div>
              <div className="bg-[#0a0a0a] border border-[#141414] p-3 rounded-lg">
                <span className="text-[9px] font-mono text-neutral-500 block">Current Model Pricing</span>
                <span className="text-xs font-bold text-neutral-200 block truncate" title={currentModel}>{currentModel || "None"}</span>
                <span className="text-[9px] font-mono text-neutral-500 block">{tierInfo.rate} ({tierInfo.tier} tier)</span>
              </div>
            </div>
          </div>

          {/* Aggregate Budgets */}
          <div className="bg-[#050505] border border-[#1f1f1f] p-4 rounded-xl space-y-4">
            <span className="text-[9px] font-mono uppercase text-neutral-500 font-bold block">Budget Performance</span>
            
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-neutral-400">Today&apos;s Spend:</span>
                <span className="font-bold text-neutral-200">${todayCost.toFixed(4)}</span>
              </div>
              <div className="h-1.5 bg-[#141414] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.min((todayCost / Math.max(budgetLimit / 30, 0.01)) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-neutral-500">
                <span>Daily Guideline: ${(budgetLimit / 30).toFixed(2)}</span>
                <span>{((todayCost / Math.max(budgetLimit / 30, 0.01)) * 100).toFixed(0)}% used</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-[#141414]">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-neutral-400">Monthly Spend:</span>
                <span className="font-bold text-neutral-200">${monthCost.toFixed(4)} / ${budgetLimit.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-[#141414] rounded-full overflow-hidden relative">
                <div 
                  className={`h-full transition-all duration-300 ${
                    isOverLimit ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                    isCloseToLimit ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                  }`}
                  style={{ width: `${Math.min((monthCost / budgetLimit) * 100, 100)}%` }}
                />
                <div 
                  className="absolute top-0 bottom-0 border-l border-white/40 cursor-help"
                  style={{ left: `${alertThreshold}%` }}
                  title={`Alert threshold: ${alertThreshold}%`}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-neutral-500">
                <span>Alert Limit: ${thresholdCost.toFixed(2)} ({alertThreshold}%)</span>
                <span>{((monthCost / budgetLimit) * 100).toFixed(1)}% of total</span>
              </div>
            </div>
          </div>

          {/* Budget Limits Settings */}
          <div className="bg-[#050505] border border-[#1f1f1f] p-4 rounded-xl space-y-4">
            <div className="flex gap-2 items-center">
              <Settings className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-[9px] font-mono uppercase text-neutral-500 font-bold block">Budget Settings</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-neutral-400">Monthly Budget Limit ($):</span>
                  <span className="font-bold">${budgetLimit.toFixed(2)}</span>
                </div>
                <input 
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={budgetLimit}
                  onChange={(e) => handleSaveBudget(parseFloat(e.target.value), alertThreshold)}
                  className="w-full h-1 bg-[#141414] rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between font-mono">
                  <span className="text-neutral-400">Alert Notification Threshold (%):</span>
                  <span className="font-bold">{alertThreshold}%</span>
                </div>
                <input 
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={alertThreshold}
                  onChange={(e) => handleSaveBudget(budgetLimit, parseInt(e.target.value))}
                  className="w-full h-1 bg-[#141414] rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
