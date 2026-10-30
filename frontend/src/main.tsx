import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./styles.css";
import "./mentor.css";
import "./cosmic.css";
import "./human-mentor.css";
import "./cream-theme.css";
import "./learning-experience.css";
import "./app-theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
