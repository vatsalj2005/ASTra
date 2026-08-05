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
      <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-accent-primary/20 selection:text-text-primary font-sans transition-colors duration-300">
        <HeroHeader />
        <MainContent />
      </div>
    </RepoProvider>
  );
}
