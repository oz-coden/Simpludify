try {
  const saved = localStorage.getItem("simpludify-docs-theme");
  document.documentElement.dataset.theme =
    saved === "light" || saved === "dark"
      ? saved
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
} catch {
  // Storage is optional; system color preference still applies through CSS.
}
