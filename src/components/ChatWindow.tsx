"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRepo } from "@/context/RepoContext";
import { MessageBubble } from "./MessageBubble";
import { RepoSidebar } from "./RepoSidebar";

const SUGGESTED_QUESTIONS = [
  "How is pagination middleware configured?",
  "Explain the payment or authentication flow.",
  "Where are route handlers defined?",
];

export function ChatWindow() {
  const { messages, sendQuestion, isLoadingAnswer, repoId } = useRepo();
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoadingAnswer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoadingAnswer) return;
    const q = inputText;
    setInputText("");
    sendQuestion(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestedClick = (questionText: string) => {
    if (isLoadingAnswer) return;
    sendQuestion(questionText);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto w-full px-4 sm:px-6 relative">
      {/* Scrollable Message List */}
      <div className="flex-1 overflow-y-auto py-6 pr-2 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Loading Indicator */}
        {isLoadingAnswer && (
          <div className="flex items-center gap-3 my-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-xs font-mono text-slate-400 animate-pulse">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span>ASTra is performing hybrid retrieval & generating cited response...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 1 && !isLoadingAnswer && (
        <div className="mb-4">
          <p className="text-[11px] font-mono text-slate-400 mb-2">Suggested questions for {repoId}:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((sq) => (
              <button
                key={sq}
                onClick={() => handleSuggestedClick(sq)}
                className="text-xs font-mono text-slate-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/40 px-3 py-1.5 rounded-lg transition-all text-left"
              >
                💡 {sq}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Input Box */}
      <div className="pb-6 pt-2 sticky bottom-0 bg-slate-950/80 backdrop-blur-md border-t border-slate-800/60">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask anything about ${repoId || "this codebase"}... (Shift+Enter for new line)`}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-4 pr-14 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoadingAnswer}
            className="absolute right-3 bottom-4 p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white rounded-lg transition-all shadow-md active:scale-95 flex items-center justify-center"
            title="Send Question"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>

      {/* Slide-out Repo Insights Sidebar */}
      <RepoSidebar />
    </div>
  );
}
