# Full Project Context

> Generated: 2026-05-25T10:46:25.563Z
> Mode: Full Project
> Files: 14
> Total Lines: 625
> Total Size: 18.3 KB
> Directories: 8

---

## 📁 Folder Structure

```
SoloSpace/
├── Frontend/
│   ├── app/
│   │   ├── api/
│   │   │   └── gemini/
│   │   │       └── orchestrate/
│   │   │           └── route.ts
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── hooks/
│   │   └── use-mobile.ts
│   ├── lib/
│   │   └── utils.ts
│   ├── .eslintrc.json
│   ├── .gitignore
│   ├── metadata.json
│   ├── next-env.d.ts
│   ├── next.config.ts
│   ├── package.json
│   ├── README.md
│   └── tsconfig.json
└── .gitignore
```

---

## 📄 Source Files

### File: `Frontend/app/api/gemini/orchestrate/route.ts`

> 252 lines | 9.8 KB

```typescript
  1 | import { GoogleGenAI } from "@google/genai";
  2 | import { NextRequest, NextResponse } from "next/server";
  3 | 
  4 | export async function POST(req: NextRequest) {
  5 |   try {
  6 |     const { prompt } = await req.json();
  7 | 
  8 |     if (!prompt || typeof prompt !== 'string') {
  9 |       return NextResponse.json({ error: "A valid prompt is required." }, { status: 400 });
 10 |     }
 11 | 
 12 |     const apiKey = process.env.GEMINI_API_KEY;
 13 | 
 14 |     // Fallback orchestrations for different concepts if API key is not defined, or if the API call fails
 15 |     const defaultReasoning = `Initiating Solospace Orchestration Protocol 09. Combining real-time deep research trackers with automated code sanitizers. I am deploying four specialized agents to parallelize the workflow on your task: "${prompt}".`;
 16 | 
 17 |     const getFallbackData = (topic: string) => {
 18 |       const normalized = topic.toLowerCase();
 19 |       if (normalized.includes("market") || normalized.includes("decentralized") || normalized.includes("protocol") || normalized.includes("audit") || normalized.includes("strategy") || normalized.includes("investor")) {
 20 |         return {
 21 |           reasoning: "Initiating Solospace Orchestration Protocol 09.\nI am deploying four specialized agents to parallelize the workflow. Research Agent is currently scanning competitor tokenomics. Marketing Strategist is drafting the community-first viral loops. Coding Engineer is verifying the protocol's core smart contracts. Investor Pitch Coach is synthesizing the narrative for Series A.",
 22 |           agents: [
 23 |             {
 24 |               id: "research",
 25 |               name: "Research Agent",
 26 |               role: "SCANNING WEB",
 27 |               description: "Analyzing 42 competitor whitepapers...",
 28 |               file: "tasks/competitor_gap_analysis.md",
 29 |               tokensSec: "124.5",
 30 |               progress: 68,
 31 |               metricLabel: "Tokens/sec",
 32 |               metricValue: "124.5",
 33 |               icon: "science"
 34 |             },
 35 |             {
 36 |               id: "marketing",
 37 |               name: "Marketing Strategist",
 38 |               role: "QUEUED",
 39 |               description: "Defining virality coefficients and channel mix.",
 40 |               file: "tasks/distribution_flow.json",
 41 |               tokensSec: "0.0",
 42 |               progress: 0,
 43 |               metricLabel: "Reach Goal",
 44 |               metricValue: "4.5M",
 45 |               icon: "trending_up"
 46 |             },
 47 |             {
 48 |               id: "coding",
 49 |               name: "Coding Engineer",
 50 |               role: "AUDITING",
 51 |               description: "Running static analysis on `lib/core_v3.rs`...",
 52 |               file: "src/contracts/vault.sol",
 53 |               tokensSec: "89.2",
 54 |               progress: 65,
 55 |               metricLabel: "Success Rate",
 56 |               metricValue: "98.2%",
 57 |               icon: "code"
 58 |             },
 59 |             {
 60 |               id: "investor",
 61 |               name: "Investor Pitch Coach",
 62 |               role: "WAITING",
 63 |               description: "Synthesizing narrative once research completes.",
 64 |               file: "out/deck_draft_v1.pdf",
 65 |               tokensSec: "0.0",
 66 |               progress: 0,
 67 |               metricLabel: "Slide Count",
 68 |               metricValue: "12 Pages",
 69 |               icon: "present_to_all"
 70 |             }
 71 |           ]
 72 |         };
 73 |       }
 74 | 
 75 |       // Default customized multi-agent pipeline general backup
 76 |       return {
 77 |         reasoning: `Orchestrating autonomous workspace solvers for your request. Spawning Research Lead to source datasets, Architect Engineer to scaffold execution files, Technical Draftsman to document interfaces, and Quality Assurance to verify benchmarks.`,
 78 |         agents: [
 79 |           {
 80 |             id: "research",
 81 |             name: "Research Architect",
 82 |             role: "SCANNING WEB",
 83 |             description: `Gathering references, APIs and docs for "${topic}"...`,
 84 |             file: "docs/references.json",
 85 |             tokensSec: "148.0",
 86 |             progress: 80,
 87 |             metricLabel: "Sources Found",
 88 |             metricValue: "18 API Nodes",
 89 |             icon: "science"
 90 |           },
 91 |           {
 92 |             id: "scaffolder",
 93 |             name: "Coding Assistant",
 94 |             role: "AUDITING",
 95 |             description: "Scaffolding codebase structures and routing rules...",
 96 |             file: "lib/engine.ts",
 97 |             tokensSec: "96.4",
 98 |             progress: 45,
 99 |             metricLabel: "Success Rate",
100 |             metricValue: "99.1%",
101 |             icon: "code"
102 |           },
103 |           {
104 |             id: "evaluator",
105 |             name: "Compliance Auditor",
106 |             role: "QUEUED",
107 |             description: "Generating regression scripts and security checkmarks...",
108 |             file: "tests/security_spec.rb",
109 |             tokensSec: "0.0",
110 |             progress: 0,
111 |             metricLabel: "Test Suites",
112 |             metricValue: "Pending",
113 |             icon: "trending_up"
114 |           },
115 |           {
116 |             id: "publisher",
117 |             name: "GTM Copywriter",
118 |             role: "WAITING",
119 |             description: `Drafting presentation narratives and landing parameters.`,
120 |             file: "public/index.html",
121 |             tokensSec: "0.0",
122 |             progress: 0,
123 |             metricLabel: "Draft Version",
124 |             metricValue: "v0.1.0-beta",
125 |             icon: "present_to_all"
126 |           }
127 |         ]
128 |       };
129 |     };
130 | 
131 |     if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
132 |       // Return beautiful fallback simulation when API key is not configured
133 |       return NextResponse.json({
134 |         ...getFallbackData(prompt),
135 |         usingFallback: true
136 |       });
137 |     }
138 | 
139 |     // Initialize real GoogleGenAI client
140 |     const ai = new GoogleGenAI({
141 |       apiKey: apiKey,
142 |       httpOptions: {
143 |         headers: {
144 |           'User-Agent': 'aistudio-build'
145 |         }
146 |       }
147 |     });
148 | 
149 |     const systemInstruction = `
150 |       You are the core orchestrator of Solospace, a multi-agent system of autonomous workspace workers.
151 |       Given a high-level goal or prompt from the user, you must design a specific plan and deploy 4 specialized agents to complete the task.
152 |       You must respond ONLY with a JSON object matching this TypeScript interface structure:
153 |       {
154 |         reasoning: string; // 3-4 sentence detailed professional overview of the reasoning process and active agent dispatch instructions
155 |         agents: Array<{
156 |           id: string; // alphanumeric identifier, e.g. "research", "marketing", "developer"
157 |           name: string; // professional agent name (e.g., "Research Coordinator", "DeFi Strategist")
158 |           role: "SCANNING WEB" | "AUDITING" | "QUEUED" | "WAITING"; // current active agent state
159 |           description: string; // current task action description (e.g., "Analyzing competitor tokenomics...", "Verifying contract vulnerabilities...")
160 |           file: string; // dynamic output file path matching their task scope (e.g. "tasks/gap_analysis.md", "src/contracts/pool.sol")
161 |           tokensSec: string; // decimal rate value (e.g., "124.5", "89.2", "0.0")
162 |           progress: number; // percentage progress value from 0 to 100
163 |           metricLabel: string; // visual stat label (e.g. "Success Rate", "Reach Goal", "Coverage")
164 |           metricValue: string; // metric stat formatting (e.g. "98.2%", "4.5M", "v1.0.4")
165 |           icon: "science" | "trending_up" | "code" | "present_to_all"; // pick one of these icons that best fits
166 |         }>;
167 |       }
168 |       Do not return any markdown formatting wraps (like \`\`\`json) outside of the valid raw JSON payload. Just return the JSON itself.
169 |     `;
170 | 
171 |     const userContent = `Synthesize an agent deployment pipeline to accomplish the following task: "${prompt}"`;
172 | 
173 |     const response = await ai.models.generateContent({
174 |       model: "gemini-3.5-flash",
175 |       contents: userContent,
176 |       config: {
177 |         systemInstruction: systemInstruction,
178 |         responseMimeType: "application/json",
179 |         temperature: 0.7,
180 |       }
181 |     });
182 | 
183 |     const text = response.text ? response.text.trim() : "";
184 |     if (!text) {
185 |       throw new Error("Empty response from AI models.");
186 |     }
187 | 
188 |     // Try parsing generated content
189 |     const parsed = JSON.parse(text);
190 |     return NextResponse.json(parsed);
191 | 
192 |   } catch (error: any) {
193 |     console.error("Gemini API Orchestrate Error:", error);
194 |     // Return gracefully structured fallback on failure
195 |     return NextResponse.json({
196 |       error: error.message || "Failed to parse AI response. Utilizing secure backup solvers.",
197 |       reasoning: "Utilizing Solospace backup protocols due to API transient exceptions. Deploying default workspace clusters to progress the strategy.",
198 |       agents: [
199 |         {
200 |           id: "research",
201 |           name: "Rescue Investigator",
202 |           role: "SCANNING WEB",
203 |           description: "Initiating baseline scanning parameters...",
204 |           file: "tasks/secure_vault.md",
205 |           tokensSec: "110.2",
206 |           progress: 50,
207 |           metricLabel: "Tokens/sec",
208 |           metricValue: "110.2",
209 |           icon: "science"
210 |         },
211 |         {
212 |           id: "developer",
213 |           name: "Shorthand Scripter",
214 |           role: "AUDITING",
215 |           description: "Recovering fallback code loops and script routines...",
216 |           file: "lib/fallback.ts",
217 |           tokensSec: "94.5",
218 |           progress: 30,
219 |           metricLabel: "Success Rate",
220 |           metricValue: "95.0%",
221 |           icon: "code"
222 |         },
223 |         {
224 |           id: "marketer",
225 |           name: "System Strategist",
226 |           role: "QUEUED",
227 |           description: "Queuing baseline communication reports...",
228 |           file: "tasks/system_report.json",
229 |           tokensSec: "0.0",
230 |           progress: 0,
231 |           metricLabel: "System Score",
232 |           metricValue: "A+",
233 |           icon: "trending_up"
234 |         },
235 |         {
236 |           id: "coach",
237 |           name: "Strategic Presenter",
238 |           role: "WAITING",
239 |           description: "Awaiting final investigator compilation datasets.",
240 |           file: "out/strategy.pdf",
241 |           tokensSec: "0.0",
242 |           progress: 0,
243 |           metricLabel: "Slide Count",
244 |           metricValue: "8 Pages",
245 |           icon: "present_to_all"
246 |         }
247 |       ],
248 |       usingFallback: true
249 |     });
250 |   }
251 | }
252 |
```

### File: `Frontend/app/globals.css`

> 122 lines | 2.9 KB

```css
  1 | @import "tailwindcss";
  2 | @import "tw-animate-css";
  3 | 
  4 | /* Core design tokens */
  5 | :root {
  6 |   background-color: #000000;
  7 |   color: #ffffff;
  8 | }
  9 | 
 10 | body {
 11 |   background-color: #000000;
 12 |   color: #f5f5f5;
 13 |   font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
 14 |   overflow: hidden;
 15 | }
 16 | 
 17 | /* Custom styles and micro-interactions */
 18 | .canvas-grid {
 19 |   background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
 20 |   background-size: 24px 24px;
 21 |   background-color: #000000;
 22 | }
 23 | 
 24 | .glass-panel {
 25 |   background-color: rgba(13, 13, 13, 0.7);
 26 |   backdrop-filter: blur(12px);
 27 |   border: 1px solid rgba(255, 255, 255, 0.07);
 28 | }
 29 | 
 30 | .glass-panel-active {
 31 |   background-color: rgba(20, 20, 20, 0.85);
 32 |   backdrop-filter: blur(16px);
 33 |   border: 1px solid rgba(255, 255, 255, 0.15);
 34 |   box-shadow: 0 0 25px rgba(255, 255, 255, 0.03);
 35 | }
 36 | 
 37 | .chatgpt-input-box {
 38 |   background-color: #0d0d0d;
 39 |   border: 1px solid rgba(255, 255, 255, 0.08);
 40 |   box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
 41 |   transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
 42 | }
 43 | 
 44 | .chatgpt-input-box:focus-within {
 45 |   border-color: rgba(255, 255, 255, 0.2);
 46 |   box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2), 0 8px 32px rgba(0, 0, 0, 0.7);
 47 | }
 48 | 
 49 | .agent-node-card {
 50 |   transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s, box-shadow 0.2s;
 51 | }
 52 | 
 53 | .agent-node-card:hover {
 54 |   border-color: rgba(255, 255, 255, 0.25);
 55 |   box-shadow: 0 8px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(255, 255, 255, 0.03);
 56 | }
 57 | 
 58 | /* Pulsing neon state colors for agent nodes */
 59 | .node-active-pulse {
 60 |   position: relative;
 61 | }
 62 | 
 63 | .node-active-pulse::after {
 64 |   content: '';
 65 |   position: absolute;
 66 |   inset: -1px;
 67 |   border-radius: inherit;
 68 |   padding: 1px;
 69 |   background: linear-gradient(135deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.05));
 70 |   mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
 71 |   -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
 72 |   mask-composite: xor;
 73 |   -webkit-mask-composite: xor;
 74 |   pointer-events: none;
 75 |   animation: border-pulse 2s infinite ease-in-out;
 76 | }
 77 | 
 78 | @keyframes border-pulse {
 79 |   0%, 100% { opacity: 0.3; }
 80 |   50% { opacity: 1; }
 81 | }
 82 | 
 83 | /* Cursor blink for streaming reasoning */
 84 | .cursor-blink {
 85 |   animation: blink step-end 0.8s infinite;
 86 | }
 87 | 
 88 | @keyframes blink {
 89 |   from, to { background-color: transparent }
 90 |   50% { background-color: currentColor }
 91 | }
 92 | 
 93 | /* Custom subtle scrollbars */
 94 | .custom-scrollbar::-webkit-scrollbar {
 95 |   width: 5px;
 96 |   height: 5px;
 97 | }
 98 | 
 99 | .custom-scrollbar::-webkit-scrollbar-track {
100 |   background: #000000;
101 | }
102 | 
103 | .custom-scrollbar::-webkit-scrollbar-thumb {
104 |   background: rgba(255, 255, 255, 0.1);
105 |   border-radius: 99px;
106 | }
107 | 
108 | .custom-scrollbar::-webkit-scrollbar-thumb:hover {
109 |   background: rgba(255, 255, 255, 0.2);
110 | }
111 | 
112 | /* Animated connection dash array */
113 | @keyframes dash {
114 |   to {
115 |     stroke-dashoffset: -40;
116 |   }
117 | }
118 | 
119 | .connection-line {
120 |   animation: dash 2.5s linear infinite;
121 | }
122 |
```

### File: `Frontend/app/layout.tsx`

> 30 lines | 0.8 KB

```tsx
 1 | import type {Metadata} from 'next';
 2 | import './globals.css'; // Global styles
 3 | import { Inter, JetBrains_Mono } from 'next/font/google';
 4 | 
 5 | const inter = Inter({
 6 |   subsets: ['latin'],
 7 |   variable: '--font-sans',
 8 | });
 9 | 
10 | const jetbrainsMono = JetBrains_Mono({
11 |   subsets: ['latin'],
12 |   variable: '--font-mono',
13 | });
14 | 
15 | export const metadata: Metadata = {
16 |   title: 'Solospace - Multi-Agent Orchestration AI OS',
17 |   description: 'An advanced agent orchestration workspace featuring rich conversation steering and active node clustering.',
18 | };
19 | 
20 | export default function RootLayout({children}: {children: React.ReactNode}) {
21 |   return (
22 |     <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
23 |       <body className="font-sans antialiased bg-black text-[#e5e2e1]" suppressHydrationWarning>
24 |         {children}
25 |       </body>
26 |     </html>
27 |   );
28 | }
29 | 
30 |
```

### File: `Frontend/hooks/use-mobile.ts`

> 22 lines | 0.6 KB

```typescript
 1 | import * as React from "react"
 2 | 
 3 | const MOBILE_BREAKPOINT = 768
 4 | 
 5 | export function useIsMobile() {
 6 |   const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)
 7 | 
 8 |   React.useEffect(() => {
 9 |     const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
10 |     const onChange = () => {
11 |       setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
12 |     }
13 |     mql.addEventListener("change", onChange)
14 |     setTimeout(() => {
15 |       setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
16 |     }, 0);
17 |     return () => mql.removeEventListener("change", onChange)
18 |   }, [])
19 | 
20 |   return !!isMobile
21 | }
22 |
```

### File: `Frontend/lib/utils.ts`

> 7 lines | 0.2 KB

```typescript
1 | import { clsx, type ClassValue } from "clsx"
2 | import { twMerge } from "tailwind-merge"
3 | 
4 | export function cn(...inputs: ClassValue[]) {
5 |   return twMerge(clsx(inputs))
6 | }
7 |
```

### File: `Frontend/.eslintrc.json`

> 4 lines | 0.0 KB

```json
1 | {
2 |   "extends": "next"
3 | }
4 |
```

### File: `Frontend/.gitignore`

> 8 lines | 0.1 KB

```text
1 | node_modules/
2 | .next/
3 | coverage/
4 | .DS_Store
5 | *.log
6 | .env*
7 | !.env.example
8 |
```

### File: `Frontend/metadata.json`

> 7 lines | 0.3 KB

```json
1 | {
2 |   "name": "Solospace",
3 |   "description": "An advanced agent orchestration platform and workspace with high-fidelity canvas and conversational steering.",
4 |   "requestFramePermissions": [],
5 |   "majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]
6 | }
7 |
```

### File: `Frontend/next-env.d.ts`

> 7 lines | 0.3 KB

```typescript
1 | /// <reference types="next" />
2 | /// <reference types="next/image-types/global" />
3 | /// <reference path="./.next/types/routes.d.ts" />
4 | 
5 | // NOTE: This file should not be edited
6 | // see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
7 |
```

### File: `Frontend/next.config.ts`

> 37 lines | 0.9 KB

```typescript
 1 | import type {NextConfig} from 'next';
 2 | 
 3 | const nextConfig: NextConfig = {
 4 |   reactStrictMode: true,
 5 |   eslint: {
 6 |     ignoreDuringBuilds: true,
 7 |   },
 8 |   typescript: {
 9 |     ignoreBuildErrors: false,
10 |   },
11 |   // Allow access to remote image placeholder.
12 |   images: {
13 |     remotePatterns: [
14 |       {
15 |         protocol: 'https',
16 |         hostname: 'picsum.photos',
17 |         port: '',
18 |         pathname: '/**', // This allows any path under the hostname
19 |       },
20 |     ],
21 |   },
22 |   output: 'standalone',
23 |   transpilePackages: ['motion'],
24 |   webpack: (config, {dev}) => {
25 |     // HMR is disabled in AI Studio via DISABLE_HMR env var.
26 |     // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
27 |     if (dev && process.env.DISABLE_HMR === 'true') {
28 |       config.watchOptions = {
29 |         ignored: /.*/,
30 |       };
31 |     }
32 |     return config;
33 |   },
34 | };
35 | 
36 | export default nextConfig;
37 |
```

### File: `Frontend/package.json`

> 39 lines | 0.9 KB

```json
 1 | {
 2 |   "name": "ai-studio-applet",
 3 |   "version": "0.1.0",
 4 |   "private": true,
 5 |   "scripts": {
 6 |     "dev": "next dev",
 7 |     "build": "next build",
 8 |     "start": "next start",
 9 |     "lint": "eslint .",
10 |     "clean": "next clean"
11 |   },
12 |   "dependencies": {
13 |     "@google/genai": "^2.4.0",
14 |     "@hookform/resolvers": "^5.2.1",
15 |     "autoprefixer": "^10.4.21",
16 |     "class-variance-authority": "^0.7.1",
17 |     "clsx": "^2.1.1",
18 |     "lucide-react": "^0.553.0",
19 |     "motion": "^12.23.24",
20 |     "next": "^15.4.9",
21 |     "postcss": "^8.5.6",
22 |     "react": "^19.2.1",
23 |     "react-dom": "^19.2.1",
24 |     "tailwind-merge": "^3.3.1"
25 |   },
26 |   "devDependencies": {
27 |     "@tailwindcss/postcss": "4.1.11",
28 |     "@tailwindcss/typography": "^0.5.19",
29 |     "@types/node": "^20",
30 |     "@types/react": "^19",
31 |     "@types/react-dom": "^19",
32 |     "eslint": "9.39.1",
33 |     "eslint-config-next": "15.4.9",
34 |     "firebase-tools": "^15.0.0",
35 |     "tailwindcss": "4.1.11",
36 |     "tw-animate-css": "^1.4.0",
37 |     "typescript": "5.9.3"
38 |   }
39 | }
```

### File: `Frontend/README.md`

> 21 lines | 0.5 KB

```markdown
 1 | <div align="center">
 2 | <img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
 3 | </div>
 4 | 
 5 | # Run and deploy your AI Studio app
 6 | 
 7 | This contains everything you need to run your app locally.
 8 | 
 9 | View your app in AI Studio: https://ai.studio/apps/626beadf-4e58-496b-a024-c2ac5aa91be2
10 | 
11 | ## Run Locally
12 | 
13 | **Prerequisites:**  Node.js
14 | 
15 | 
16 | 1. Install dependencies:
17 |    `npm install`
18 | 2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
19 | 3. Run the app:
20 |    `npm run dev`
21 |
```

### File: `Frontend/tsconfig.json`

> 29 lines | 0.6 KB

```json
 1 | {
 2 |   "compilerOptions": {
 3 |     "target": "ES2017",
 4 |     "lib": ["dom", "dom.iterable", "esnext"],
 5 |     "allowJs": true,
 6 |     "skipLibCheck": true,
 7 |     "strict": true,
 8 |     "noEmit": true,
 9 |     "esModuleInterop": true,
10 |     "module": "esnext",
11 |     "moduleResolution": "bundler",
12 |     "resolveJsonModule": true,
13 |     "isolatedModules": true,
14 |     "jsx": "preserve",
15 |     "incremental": true,
16 |     "plugins": [
17 |       {
18 |         "name": "next"
19 |       }
20 |     ],
21 |     "baseUrl": ".",
22 |     "paths": {
23 |       "@/*": ["./*"]
24 |     }
25 |   },
26 |   "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
27 |   "exclude": ["node_modules"]
28 | }
29 |
```

### File: `.gitignore`

> 40 lines | 0.5 KB

```text
 1 | # Dependencies
 2 | **/node_modules/
 3 | **/bower_components/
 4 | 
 5 | # Next.js build output
 6 | **/build/
 7 | **/.next/
 8 | **/out/
 9 | 
10 | # Debug logs
11 | npm-debug.log*
12 | yarn-debug.log*
13 | yarn-error.log*
14 | lerna-debug.log*
15 | 
16 | # Local env files
17 | **/.env
18 | **/.env.local
19 | **/.env.development.local
20 | **/.env.test.local
21 | **/.env.production.local
22 | **/env.local
23 | !**/.env.example
24 | 
25 | # IDEs and editors
26 | .idea/
27 | .vscode/
28 | *.suo
29 | *.ntvs*
30 | *.njsproj
31 | *.sln
32 | *.sw?
33 | 
34 | # OS files
35 | .DS_Store
36 | Thumbs.db
37 | 
38 | # TypeScript compilation info
39 | **/tsconfig.tsbuildinfo
40 |
```
