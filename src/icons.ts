const s = (d: string) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
export const ICONS: Record<string, string> = {
  auto: s('<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/>'),
  cam: s('<rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 11 5-3v8l-5-3"/>'),
  shot: s('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  rec: s('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>'),
  settingsBtn: s('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  full: s('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  hide: s('<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 4l16 16"/>'),
  prev: s('<path d="M6 5v14M18 6l-9 6 9 6z" fill="currentColor"/>'),
  next: s('<path d="M18 5v14M6 6l9 6-9 6z" fill="currentColor"/>'),
  mic: s('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  plBtn: s('<path d="M4 6h12M4 12h12M4 18h8"/><circle cx="18" cy="17" r="2"/><path d="M20 17V8"/>'),
}
export const PLAY = s('<path d="M8 5v14l11-7z" fill="currentColor"/>'), PAUSE = s('<path d="M8 5v14M16 5v14" stroke-width="3"/>')
