// Transient on-screen confirmation for executed voice commands.

let toastEl: HTMLDivElement | null = null;
let hideTimer: number | null = null;

export function showToast(message: string, durationMs = 1800): void {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.style.display = 'block';
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
  }
  hideTimer = window.setTimeout(() => {
    if (toastEl) toastEl.style.display = 'none';
  }, durationMs);
}
