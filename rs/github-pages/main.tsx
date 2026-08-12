import React from "react";
import { createRoot } from "react-dom/client";
import ResearchPlatform from "../components/ResearchPlatform";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <React.StrictMode>
    <ResearchPlatform />
  </React.StrictMode>,
);
