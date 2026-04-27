import React from "react";
import "@fontsource/chivo/400.css";
import "@fontsource/chivo/700.css";
import "@fontsource/chivo/900.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";

import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Overview from "./pages/Overview";
import Kernel from "./pages/Kernel";
import Ledger from "./pages/Ledger";
import AiGateway from "./pages/AiGateway";
import Policies from "./pages/Policies";
import Incidents from "./pages/Incidents";
import Disclosures from "./pages/Disclosures";
import Tenants from "./pages/Tenants";
import Teacher from "./pages/Teacher";

export default function App() {
  return (
    <div className="App">
      <div className="synthetic-watermark" aria-hidden/>
      <BrowserRouter>
        <div style={{ display: "flex", position: "relative", zIndex: 2 }}>
          <Sidebar />
          <main style={{ flex: 1, minWidth: 0 }} className="grid-texture">
            <Routes>
              <Route path="/"             element={<Overview/>}/>
              <Route path="/kernel"       element={<Kernel/>}/>
              <Route path="/ledger"       element={<Ledger/>}/>
              <Route path="/ai-gateway"   element={<AiGateway/>}/>
              <Route path="/policies"     element={<Policies/>}/>
              <Route path="/incidents"    element={<Incidents/>}/>
              <Route path="/disclosures"  element={<Disclosures/>}/>
              <Route path="/tenants"      element={<Tenants/>}/>
              <Route path="/teacher"      element={<Teacher/>}/>
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </div>
  );
}
