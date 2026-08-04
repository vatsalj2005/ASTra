"use client";

import React from "react";
import { RepoProvider, useRepo } from "@/context/RepoContext";
import { HeroHeader } from "@/components/HeroHeader";
import { RepoInput } from "@/components/RepoInput";
import { IngestionProgress } from "@/components/IngestionProgress";
import { ChatWindow } from "@/components/ChatWindow";

function MainContent() {
  const { stage } = useRepo();

  return (
    <main className="flex-1 flex flex-col min-h-[calc(100vh-4rem)]">
      {stage === "input" && <RepoInput />}
      {stage === "ingesting" && <IngestionProgress />}
      {stage === "chat" && <ChatWindow />}
    </main>
  );
}

export default function Home() {
  return (
    <RepoProvider>
      <div className="min-h-screen flex flex-col bg-[#0b0f17] text-slate-100 selection:bg-blue-500/30 selection:text-blue-200 font-sans">
        <HeroHeader />
        <MainContent />
      </div>
    </RepoProvider>
  );
}
