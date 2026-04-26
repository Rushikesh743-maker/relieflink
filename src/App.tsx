import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { db } from "./lib/firebase";
import { collection, getDocs } from "firebase/firestore";

import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import UserApp from "./pages/UserApp.tsx";
import NgoDashboard from "./pages/NgoDashboard.tsx";
import Simulation from "./pages/Simulation.tsx";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    async function testFirebase() {
      try {
        const querySnapshot = await getDocs(collection(db, "test"));
        console.log("🔥 Firebase Connected!", querySnapshot.size);
      } catch (error) {
        console.error("❌ Firebase Error:", error);
      }
    }

    testFirebase();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/user" element={<UserApp />} />
            <Route path="/ngo" element={<NgoDashboard />} />
            <Route path="/simulation" element={<Simulation />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
