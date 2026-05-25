import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: "A valid prompt is required." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Fallback orchestrations for different concepts if API key is not defined, or if the API call fails
    const defaultReasoning = `Initiating Solospace Orchestration Protocol 09. Combining real-time deep research trackers with automated code sanitizers. I am deploying four specialized agents to parallelize the workflow on your task: "${prompt}".`;

    const getFallbackData = (topic: string) => {
      const normalized = topic.toLowerCase();
      if (normalized.includes("market") || normalized.includes("decentralized") || normalized.includes("protocol") || normalized.includes("audit") || normalized.includes("strategy") || normalized.includes("investor")) {
        return {
          reasoning: "Initiating Solospace Orchestration Protocol 09.\nI am deploying four specialized agents to parallelize the workflow. Research Agent is currently scanning competitor tokenomics. Marketing Strategist is drafting the community-first viral loops. Coding Engineer is verifying the protocol's core smart contracts. Investor Pitch Coach is synthesizing the narrative for Series A.",
          agents: [
            {
              id: "research",
              name: "Research Agent",
              role: "SCANNING WEB",
              description: "Analyzing 42 competitor whitepapers...",
              file: "tasks/competitor_gap_analysis.md",
              tokensSec: "124.5",
              progress: 68,
              metricLabel: "Tokens/sec",
              metricValue: "124.5",
              icon: "science"
            },
            {
              id: "marketing",
              name: "Marketing Strategist",
              role: "QUEUED",
              description: "Defining virality coefficients and channel mix.",
              file: "tasks/distribution_flow.json",
              tokensSec: "0.0",
              progress: 0,
              metricLabel: "Reach Goal",
              metricValue: "4.5M",
              icon: "trending_up"
            },
            {
              id: "coding",
              name: "Coding Engineer",
              role: "AUDITING",
              description: "Running static analysis on `lib/core_v3.rs`...",
              file: "src/contracts/vault.sol",
              tokensSec: "89.2",
              progress: 65,
              metricLabel: "Success Rate",
              metricValue: "98.2%",
              icon: "code"
            },
            {
              id: "investor",
              name: "Investor Pitch Coach",
              role: "WAITING",
              description: "Synthesizing narrative once research completes.",
              file: "out/deck_draft_v1.pdf",
              tokensSec: "0.0",
              progress: 0,
              metricLabel: "Slide Count",
              metricValue: "12 Pages",
              icon: "present_to_all"
            }
          ]
        };
      }

      // Default customized multi-agent pipeline general backup
      return {
        reasoning: `Orchestrating autonomous workspace solvers for your request. Spawning Research Lead to source datasets, Architect Engineer to scaffold execution files, Technical Draftsman to document interfaces, and Quality Assurance to verify benchmarks.`,
        agents: [
          {
            id: "research",
            name: "Research Architect",
            role: "SCANNING WEB",
            description: `Gathering references, APIs and docs for "${topic}"...`,
            file: "docs/references.json",
            tokensSec: "148.0",
            progress: 80,
            metricLabel: "Sources Found",
            metricValue: "18 API Nodes",
            icon: "science"
          },
          {
            id: "scaffolder",
            name: "Coding Assistant",
            role: "AUDITING",
            description: "Scaffolding codebase structures and routing rules...",
            file: "lib/engine.ts",
            tokensSec: "96.4",
            progress: 45,
            metricLabel: "Success Rate",
            metricValue: "99.1%",
            icon: "code"
          },
          {
            id: "evaluator",
            name: "Compliance Auditor",
            role: "QUEUED",
            description: "Generating regression scripts and security checkmarks...",
            file: "tests/security_spec.rb",
            tokensSec: "0.0",
            progress: 0,
            metricLabel: "Test Suites",
            metricValue: "Pending",
            icon: "trending_up"
          },
          {
            id: "publisher",
            name: "GTM Copywriter",
            role: "WAITING",
            description: `Drafting presentation narratives and landing parameters.`,
            file: "public/index.html",
            tokensSec: "0.0",
            progress: 0,
            metricLabel: "Draft Version",
            metricValue: "v0.1.0-beta",
            icon: "present_to_all"
          }
        ]
      };
    };

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      // Return beautiful fallback simulation when API key is not configured
      return NextResponse.json({
        ...getFallbackData(prompt),
        usingFallback: true
      });
    }

    // Initialize real GoogleGenAI client
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const systemInstruction = `
      You are the core orchestrator of Solospace, a multi-agent system of autonomous workspace workers.
      Given a high-level goal or prompt from the user, you must design a specific plan and deploy 4 specialized agents to complete the task.
      You must respond ONLY with a JSON object matching this TypeScript interface structure:
      {
        reasoning: string; // 3-4 sentence detailed professional overview of the reasoning process and active agent dispatch instructions
        agents: Array<{
          id: string; // alphanumeric identifier, e.g. "research", "marketing", "developer"
          name: string; // professional agent name (e.g., "Research Coordinator", "DeFi Strategist")
          role: "SCANNING WEB" | "AUDITING" | "QUEUED" | "WAITING"; // current active agent state
          description: string; // current task action description (e.g., "Analyzing competitor tokenomics...", "Verifying contract vulnerabilities...")
          file: string; // dynamic output file path matching their task scope (e.g. "tasks/gap_analysis.md", "src/contracts/pool.sol")
          tokensSec: string; // decimal rate value (e.g., "124.5", "89.2", "0.0")
          progress: number; // percentage progress value from 0 to 100
          metricLabel: string; // visual stat label (e.g. "Success Rate", "Reach Goal", "Coverage")
          metricValue: string; // metric stat formatting (e.g. "98.2%", "4.5M", "v1.0.4")
          icon: "science" | "trending_up" | "code" | "present_to_all"; // pick one of these icons that best fits
        }>;
      }
      Do not return any markdown formatting wraps (like \`\`\`json) outside of the valid raw JSON payload. Just return the JSON itself.
    `;

    const userContent = `Synthesize an agent deployment pipeline to accomplish the following task: "${prompt}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userContent,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    });

    const text = response.text ? response.text.trim() : "";
    if (!text) {
      throw new Error("Empty response from AI models.");
    }

    // Try parsing generated content
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error("Gemini API Orchestrate Error:", error);
    // Return gracefully structured fallback on failure
    return NextResponse.json({
      error: error.message || "Failed to parse AI response. Utilizing secure backup solvers.",
      reasoning: "Utilizing Solospace backup protocols due to API transient exceptions. Deploying default workspace clusters to progress the strategy.",
      agents: [
        {
          id: "research",
          name: "Rescue Investigator",
          role: "SCANNING WEB",
          description: "Initiating baseline scanning parameters...",
          file: "tasks/secure_vault.md",
          tokensSec: "110.2",
          progress: 50,
          metricLabel: "Tokens/sec",
          metricValue: "110.2",
          icon: "science"
        },
        {
          id: "developer",
          name: "Shorthand Scripter",
          role: "AUDITING",
          description: "Recovering fallback code loops and script routines...",
          file: "lib/fallback.ts",
          tokensSec: "94.5",
          progress: 30,
          metricLabel: "Success Rate",
          metricValue: "95.0%",
          icon: "code"
        },
        {
          id: "marketer",
          name: "System Strategist",
          role: "QUEUED",
          description: "Queuing baseline communication reports...",
          file: "tasks/system_report.json",
          tokensSec: "0.0",
          progress: 0,
          metricLabel: "System Score",
          metricValue: "A+",
          icon: "trending_up"
        },
        {
          id: "coach",
          name: "Strategic Presenter",
          role: "WAITING",
          description: "Awaiting final investigator compilation datasets.",
          file: "out/strategy.pdf",
          tokensSec: "0.0",
          progress: 0,
          metricLabel: "Slide Count",
          metricValue: "8 Pages",
          icon: "present_to_all"
        }
      ],
      usingFallback: true
    });
  }
}
