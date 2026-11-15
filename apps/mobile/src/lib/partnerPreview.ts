/** App Review skip: show the Lead Manager shell with no account data. */
let preview = false;
let exitPreview: (() => void) | null = null;

export function setPartnerPreview(on: boolean) {
  preview = on;
}

export function isPartnerPreview() {
  return preview;
}

export function setPartnerPreviewExit(fn: (() => void) | null) {
  exitPreview = fn;
}

export function exitPartnerPreview() {
  preview = false;
  exitPreview?.();
}
