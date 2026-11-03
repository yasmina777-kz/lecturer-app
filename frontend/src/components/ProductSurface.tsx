import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import "../product-ui.css";

type Theme = "light" | "dark";
const key = "ai-mentor-product-theme";
let theme: Theme = "light";
try {
  theme = localStorage.getItem(key) === "dark" ? "dark" : "light";
} catch {
  /* Use the primary light theme. */
}
const listeners = new Set<() => void>();
function change(next: Theme) {
  theme = next;
  listeners.forEach((listener) => listener());
}
window.addEventListener("storage", (event) => {
  if (event.key === key) change(event.newValue === "dark" ? "dark" : "light");
});
const Context = createContext<{ theme: Theme; toggleTheme: () => void } | null>(
  null,
);
export const useProductTheme = () => useContext(Context);
/** Product preferences are isolated from the public landing's existing theme. */
export function ProductSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => theme,
  );
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    try {
      localStorage.setItem(key, next);
    } catch {
      /* The session still works. */
    }
    change(next);
  };
  return (
    <Context.Provider value={{ theme: current, toggleTheme }}>
      <div
        className={`product-ui ${className}`}
        data-product-ui
        data-product-theme={current}
      >
        {children}
      </div>
    </Context.Provider>
  );
}
