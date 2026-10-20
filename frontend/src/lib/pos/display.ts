const POS_FULLSCREEN_KEY = "pos-fullscreen-mode";

export function readPosFullscreen(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(POS_FULLSCREEN_KEY) === "1";
}

export function writePosFullscreen(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(POS_FULLSCREEN_KEY, on ? "1" : "0");
  window.dispatchEvent(new CustomEvent("pos-fullscreen-change"));
}
