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
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto w-full px-4 sm:px-6 relative justify-between">
      {/* Scrollable Message List */}
      <div className="flex-1 overflow-y-auto py-6 pr-2 space-y-6 scroll-smooth">
        {messages.map((msg) => (
          <div key={msg.id} className="animate-fade-in-up">
            <MessageBubble message={msg} />
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoadingAnswer && (
          <div className="flex items-center gap-3.5 my-4 p-4.5 rounded-2xl bg-bg-secondary/40 border border-white/5 text-xs font-mono text-text-secondary animate-pulse shadow-md">
            <div className="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
            <span>ASTra is performing hybrid retrieval & generating cited response...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 1 && !isLoadingAnswer && (
        <div className="mb-4 animate-fade-in-up">
          <p className="text-[10px] font-mono text-text-muted mb-2.5 uppercase tracking-wider">Suggested queries for {repoId}:</p>
          <div className="flex flex-wrap gap-2.5">
            {SUGGESTED_QUESTIONS.map((sq) => (
              <button
                key={sq}
                onClick={() => handleSuggestedClick(sq)}
                className="text-xs font-mono text-text-secondary bg-bg-secondary/40 hover:bg-bg-secondary border border-white/5 hover:border-accent-primary/30 px-3.5 py-2 rounded-xl transition-all duration-300 text-left active:scale-98 cursor-pointer flex items-center gap-1.5"
              >
                <span>💡</span>
                <span>{sq}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Input Box */}
      <div className="pb-6 pt-2 sticky bottom-0 bg-background/80 backdrop-blur-md border-t border-white/5">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative rounded-2xl bg-bg-secondary/80 border border-white/5 p-1 transition-all duration-300 focus-within:border-accent-primary/40 focus-within:ring-2 focus-within:ring-accent-primary/10 shadow-lg">
            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask anything about ${repoId || "this codebase"}... (Shift+Enter for new line)`}
              className="w-full bg-transparent border-0 rounded-xl pl-4 pr-16 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-0 transition-all resize-none font-sans"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isLoadingAnswer}
              className="absolute right-3.5 bottom-3.5 p-3 bg-gradient-to-r from-accent-primary to-accent-secondary disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl transition-all shadow-md hover:brightness-110 active:scale-95 flex items-center justify-center cursor-pointer"
              title="Send Question"
            >
              <svg className="w-4 h-4 fill-current transform rotate-90" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* Slide-out Repo Insights Sidebar */}
      <RepoSidebar />
    </div>
  );
}
