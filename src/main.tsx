import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorHandlers } from "./lib/errorLogger";
import { preloadLcpImage } from "./lib/preloadLcp";

// Preload da imagem LCP (primeiro banner) assim que o chunk carrega
preloadLcpImage();

const root = createRoot(document.getElementById("root")!);
root.render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// Carregar tracking de erros e session recovery bem depois do LCP para não alongar a cadeia crítica
const DEFER_AFTER_MS = 4000;
if (typeof requestIdleCallback !== 'undefined') {
  setTimeout(() => {
    requestIdleCallback(() => {
      initGlobalErrorHandlers();
      import("./lib/sessionRecovery").then(m => m.initSessionRecovery());
    }, { timeout: 500 });
  }, DEFER_AFTER_MS);
} else {
  setTimeout(() => {
    initGlobalErrorHandlers();
    import("./lib/sessionRecovery").then(m => m.initSessionRecovery());
  }, DEFER_AFTER_MS);
}
