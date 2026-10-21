// Shared by the static pages (about, privacy, cookies, terms).
import "./fonts";
import "./page.css";
import { openConsent } from "./ads";

try {
  const t = localStorage.getItem("islandiq-theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch { /* fine */ }

document.querySelectorAll<HTMLButtonElement>("[data-consent]").forEach((b) => (b.onclick = () => {
  if (!openConsent()) b.textContent = "Ad privacy choices appear here once ads are switched on.";
}));
