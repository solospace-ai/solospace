'use client';

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match && !String(children).includes("\n");

            if (isInline) {
              return (
                <code
                  className="bg-neutral-800 text-cyan-300 px-1.5 py-0.5 rounded text-[0.82em] font-mono border border-neutral-700/60"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            const language = match ? match[1] : "text";
            const codeString = String(children).replace(/\n$/, "");

            return (
              <div className="my-4 rounded-xl overflow-hidden border border-neutral-800 bg-[#0d0d0d]">
                {/* Language badge header */}
                <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/80 border-b border-neutral-800">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                    {language}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(codeString)}
                    className="text-[10px] font-mono text-neutral-500 hover:text-white transition-colors cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
                <SyntaxHighlighter
                  style={oneDark}
                  language={language}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                    background: "transparent",
                    fontSize: "0.8rem",
                    lineHeight: "1.6",
                  }}
                  codeTagProps={{ style: { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" } }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          },

          // Headings
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-white mt-6 mb-3 pb-2 border-b border-neutral-800 leading-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-white mt-5 mb-2 leading-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-neutral-200 mt-4 mb-1.5 leading-tight">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-neutral-300 mt-3 mb-1 leading-tight">
              {children}
            </h4>
          ),

          // Paragraph
          p: ({ children }) => (
            <p className="text-sm text-neutral-200 leading-relaxed mb-3">
              {children}
            </p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-none space-y-1.5 mb-3 pl-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1.5 mb-3 pl-1">
              {children}
            </ol>
          ),
          li: ({ children, ordered }: any) => (
            <li className="text-sm text-neutral-200 leading-relaxed flex gap-2 items-start">
              {!ordered && (
                <span className="text-neutral-500 shrink-0 mt-0.5 select-none">▸</span>
              )}
              <span className="flex-1">{children}</span>
            </li>
          ),

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-neutral-600 pl-4 my-3 text-sm text-neutral-400 italic">
              {children}
            </blockquote>
          ),

          // Strong / Em
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-neutral-300">{children}</em>
          ),

          // Horizontal rule
          hr: () => (
            <hr className="my-4 border-neutral-800" />
          ),

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-xl border border-neutral-800">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-neutral-900/60">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-neutral-800/60">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-neutral-900/30 transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono border-b border-neutral-800">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 text-xs text-neutral-300 leading-relaxed">
              {children}
            </td>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
