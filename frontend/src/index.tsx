import { t } from "./i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./styles.css";
import "./mentor.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error(t("Не найден элемент #root в index.html"));
}

createRoot(container).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
