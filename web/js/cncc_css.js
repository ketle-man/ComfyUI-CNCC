let cssInjected = false;

export function ensureCSS() {
    if (cssInjected) return;
    cssInjected = true;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("../css/cncc.css", import.meta.url).href;
    document.head.appendChild(link);
}
