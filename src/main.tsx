import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initializeStore } from './lib/store';
import { TooltipProvider } from "@/components/ui/tooltip";

const queryClient = new QueryClient();

// Initialize TanStack DB store
initializeStore().catch(console.error);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
