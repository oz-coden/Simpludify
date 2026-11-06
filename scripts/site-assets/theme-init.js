{
  let saved;
  try {
    saved = localStorage.getItem("simpludify-docs-theme");
  } catch {
    // Storage is optional; initialize from the system preference below.
  }
  document.documentElement.dataset.theme =
    saved === "light" || saved === "dark"
      ? saved
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}
