import type { PdfThemeId } from "./types"

/**
 * THE LOOKS of the song PDF. Each is a complete decision, not a recolour: its own palette (OKLCH, one dominant colour and
 * one accent), its own pair of typefaces, its own head of the page (the photo, the number, the title), its own
 * treatment of the photo. The body layouts read only the variables set here, so any look wears any layout.
 * Photos are the app's own (landscapes, objects, nobody in them). Fonts come from Google Fonts and fall back to the
 * device's own when the phone is offline.
 */

export type HeadInput = { number: number; title: string; meta: string[]; photo: string | null }
export type Theme = { fonts: string; css: string; head: (h: HeadInput) => string }

const G = "https://fonts.googleapis.com/css2?"
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const metaLine = (m: string[]) => m.map((x) => `<span>${esc(x)}</span>`).join("")
const photoStyle = (photo: string | null) => (photo ? `style="background-image:url('${photo}')"` : "")

export const THEMES: Record<PdfThemeId, Theme> = {
  /** Misty valley at first light. White, deep blue-green ink, one burnt orange. Heavy grotesque against a light one. */
  dawn: {
    fonts: `${G}family=Bricolage+Grotesque:opsz,wght@12..96,200;12..96,400;12..96,800&family=Instrument+Sans:ital,wght@0,400;1,400&family=DM+Mono:wght@500&display=swap`,
    css: `:root{--display:'Bricolage Grotesque','Helvetica Neue',sans-serif;--lyric:'Bricolage Grotesque','Helvetica Neue',sans-serif;--body:'Instrument Sans','Helvetica Neue',sans-serif;--mono:'DM Mono',ui-monospace,monospace;
--paper:oklch(0.985 0.004 235);--ink:oklch(0.23 0.045 245);--muted:oklch(0.48 0.03 245);--rule:oklch(0.48 0.03 245 / .28);--accent:oklch(0.55 0.165 45);--gloss:oklch(0.5 0.15 45);--lw:300;--hw:800}
.hd{position:relative;height:46mm;margin-bottom:7mm;background:var(--ink) center/cover;color:#fff;display:flex;align-items:flex-end}
.hd:after{content:"";position:absolute;inset:0;background:linear-gradient(to top,oklch(0.18 0.04 245 / .86),oklch(0.18 0.04 245 / 0) 72%)}
.hd .in{position:relative;z-index:1;padding:0 7mm 6mm;width:100%;display:flex;justify-content:space-between;align-items:flex-end;gap:8mm}
.hd .no{display:inline-block;background:var(--accent);color:#fff;font:800 11pt/1 var(--display);padding:2mm 3mm;margin-bottom:3mm}
.hd h1{color:#fff;font-size:34pt;letter-spacing:-.02em}
.hd .meta{color:oklch(1 0 0 / .85);flex-direction:column;gap:1.4mm;align-items:flex-end}.hd .meta span+span{border:0;padding:0}`,
    head: ({ number, title, meta, photo }) =>
      `<div class="hd" ${photoStyle(photo)}><div class="in"><div><span class="no">№ ${number}</span><h1>${esc(title)}</h1></div><div class="meta eb">${metaLine(meta)}</div></div></div>`,
  },

  /** The same song at night, for a screen: near-black blue, warm white type in a thin weight, one moon-gold. A wide geometric display. */
  night: {
    fonts: `${G}family=Unbounded:wght@200;700&family=Outfit:wght@200;400&family=JetBrains+Mono:wght@500&display=swap`,
    css: `:root{--display:'Unbounded','Arial Black',sans-serif;--lyric:'Outfit','Helvetica Neue',sans-serif;--body:'Outfit','Helvetica Neue',sans-serif;--mono:'JetBrains Mono',ui-monospace,monospace;
--paper:oklch(0.17 0.03 265);--ink:oklch(0.94 0.012 85);--muted:oklch(0.7 0.02 265);--rule:oklch(0.94 0.012 85 / .2);--accent:oklch(0.83 0.14 80);--gloss:oklch(0.83 0.14 80);--lw:200;--hw:200}
html{background:var(--paper)}
.hd{position:relative;height:56mm;margin:0 0 4mm;background:var(--paper) center/cover}
.hd:after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,oklch(0.17 0.03 265 / .15),oklch(0.17 0.03 265) 96%)}
.hd .in{position:absolute;z-index:1;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:flex-end;gap:8mm}
.hd .no{display:block;color:var(--accent);font:700 11pt/1 var(--display);margin-bottom:3mm}
.hd h1{font-size:23pt;letter-spacing:-.01em;line-height:1.12}
.hd .meta{flex-direction:column;gap:1.4mm;align-items:flex-end}.hd .meta span+span{border:0;padding:0}
.w .g{border-top-color:var(--rule)}.tl p{font-weight:400}`,
    head: ({ number, title, meta, photo }) =>
      `<div class="hd" ${photoStyle(photo)}><div class="in"><div><span class="no">№ ${number}</span><h1>${esc(title)}</h1></div><div class="meta eb">${metaLine(meta)}</div></div></div>`,
  },

  /** A hymnal: the one place a serif is earned. White paper, black type, red rubric (as in a service book), a small framed plate. */
  hymnal: {
    fonts: `${G}family=Cormorant+Garamond:ital,wght@0,300;0,700;1,300;1,500&family=Hanken+Grotesk:wght@500&display=swap`,
    css: `:root{--display:'Cormorant Garamond',Garamond,serif;--lyric:'Cormorant Garamond',Garamond,serif;--body:'Cormorant Garamond',Garamond,serif;--mono:'Hanken Grotesk','Helvetica Neue',sans-serif;
--paper:oklch(0.995 0.002 90);--ink:oklch(0.2 0.005 60);--muted:oklch(0.45 0.01 60);--rule:oklch(0.2 0.005 60 / .55);--accent:oklch(0.5 0.19 28);--gloss:oklch(0.5 0.19 28);--lw:400;--hw:700}
body{font-size:12.5pt}
.hd{display:grid;grid-template-columns:auto 1fr auto;gap:9mm;align-items:center;padding:0 0 6mm;margin-bottom:8mm;border-bottom:3px double var(--rule)}
.hd .no{font:700 46pt/0.9 var(--display);color:var(--accent)}
.hd h1{font:500 30pt/1.02 var(--display);font-style:italic;letter-spacing:0}
.hd .meta{margin-top:3mm}.hd .plate{width:30mm;height:30mm;border:1px solid var(--rule);padding:1.2mm;background:var(--paper)}
.hd .plate i{display:block;width:100%;height:100%;background:var(--ink) center/cover;filter:grayscale(.15)}
.w .r{font-weight:500}.w .g{font-style:italic}.eb{letter-spacing:.2em}`,
    head: ({ number, title, meta, photo }) =>
      `<div class="hd"><div class="no">${number}</div><div><h1>${esc(title)}</h1><div class="meta eb">${metaLine(meta)}</div></div>${photo ? `<div class="plate"><i ${photoStyle(photo)}></i></div>` : "<div></div>"}</div>`,
  },

  /** A poster: a cobalt block, a huge number, cream paper below. Wide geometric display against a plain grotesque. Flat colour, no gradients. */
  poster: {
    fonts: `${G}family=Unbounded:wght@200;800&family=Hanken+Grotesk:wght@400;700&family=DM+Mono:wght@500&display=swap`,
    css: `:root{--display:'Unbounded','Arial Black',sans-serif;--lyric:'Hanken Grotesk','Helvetica Neue',sans-serif;--body:'Hanken Grotesk','Helvetica Neue',sans-serif;--mono:'DM Mono',ui-monospace,monospace;
--paper:oklch(0.975 0.012 95);--ink:oklch(0.2 0.03 255);--muted:oklch(0.45 0.04 255);--rule:oklch(0.2 0.03 255 / .3);--accent:oklch(0.66 0.17 50);--gloss:oklch(0.42 0.17 255);--lw:400;--hw:800;--cobalt:oklch(0.42 0.17 255)}
.hd{display:grid;grid-template-columns:1fr 70mm;background:var(--cobalt);color:oklch(0.975 0.012 95);margin-bottom:6mm;min-height:40mm}
.hd .tx{padding:7mm 8mm;display:flex;flex-direction:column;justify-content:space-between;gap:4mm}
.hd .no{font:800 50pt/0.82 var(--display);letter-spacing:-.04em;color:var(--accent)}
.hd h1{font:200 21pt/1.1 var(--display);color:inherit}
.hd .meta{color:oklch(0.975 0.012 95 / .85);gap:4mm}.hd .meta span+span{border-color:oklch(0.975 0.012 95 / .4)}
.hd .ph{background:var(--ink) center/cover}`,
    head: ({ number, title, meta, photo }) =>
      `<div class="hd"><div class="tx"><div class="no">${number}</div><div><h1>${esc(title)}</h1><div class="meta eb" style="margin-top:3mm">${metaLine(meta)}</div></div></div><div class="ph" ${photoStyle(photo)}></div></div>`,
  },

  /** Ink-saving, for an office printer: white, black, one orange number, the photo in greys. Swiss and dense: a condensed-to-wide grotesque and a mono. */
  mono: {
    fonts: `${G}family=Archivo:wght@200;400;800&family=IBM+Plex+Mono:wght@500&display=swap`,
    css: `:root{--display:'Archivo','Helvetica Neue',sans-serif;--lyric:'Archivo','Helvetica Neue',sans-serif;--body:'Archivo','Helvetica Neue',sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace;
--paper:#fff;--ink:oklch(0.15 0 0);--muted:oklch(0.42 0 0);--rule:oklch(0.15 0 0 / .45);--accent:oklch(0.6 0.19 45);--gloss:oklch(0.35 0 0);--lw:400;--hw:800}
.hd{display:grid;grid-template-columns:auto 1fr 52mm;gap:7mm;align-items:end;border-top:3pt solid var(--ink);padding-top:4mm;margin-bottom:8mm}
.hd .no{font:800 54pt/0.85 var(--display);color:var(--accent);letter-spacing:-.03em}
.hd h1{font:800 21pt/1 var(--display);text-transform:uppercase;letter-spacing:-.01em}
.hd .meta{margin-top:3mm}.hd .ph{height:26mm;background:var(--ink) center/cover;filter:grayscale(1) contrast(1.15)}
.w .r{font-weight:400}.w .g{font-style:normal;font-family:var(--mono);font-size:6.8pt;letter-spacing:.02em}`,
    head: ({ number, title, meta, photo }) =>
      `<div class="hd"><div class="no">${number}</div><div><h1>${esc(title)}</h1><div class="meta eb">${metaLine(meta)}</div></div><div class="ph" ${photoStyle(photo)}></div></div>`,
  },
}

/**
 * THE STAGE, the projector layout (16:9, one stanza a slide, the song in very large type). Each look has its own scene on
 * top of the shared slide frame in html.ts: the photo blurred to a soft field, a scrim for contrast, one accent, the stanza
 * number as a big mark. `cw` is the width of a letter in em and `wmm` the width the lyric may use, so the builder can fit the
 * type to the longest line. Dark rooms need light type on dark: four looks are dark, Ink-saving is the one for a bright room.
 */
export const STAGES: Record<PdfThemeId, { css: string; cw: number; wmm: number }> = {
  dawn: {
    cw: 0.49,
    wmm: 205,
    css: `.s{--stext:#fff;--sdim:oklch(0.9 0.025 235);--blur:30px}
.sc{background:linear-gradient(105deg,oklch(0.19 0.05 245 / .9),oklch(0.19 0.05 245 / .5) 70%,oklch(0.19 0.05 245 / .72))}
.gl{background:radial-gradient(55% 75% at 12% 62%,oklch(0.55 0.165 45 / .42),transparent 70%)}
.c{padding:14mm 20mm 20mm 28mm}.c:before{content:"";position:absolute;left:18mm;top:22mm;bottom:28mm;width:2.4mm;background:var(--accent)}
.p{background:oklch(1 0 0 / .08);border:1px solid oklch(1 0 0 / .24);padding:9mm 11mm}
.ly .l{font-weight:800;letter-spacing:-.018em}.no{position:absolute;right:20mm;top:12mm;color:var(--accent);font:800 44pt/1 var(--display);letter-spacing:-.04em}.tr p{font-weight:400}`,
  },
  night: {
    cw: 0.5,
    wmm: 250,
    css: `.s{--stext:oklch(0.95 0.012 85);--sdim:oklch(0.83 0.1 80);--blur:16px;background:oklch(0.12 0.03 265)}
.bg{opacity:.8}
.sc{background:radial-gradient(90% 100% at 50% 55%,oklch(0.14 0.03 265 / .35),oklch(0.1 0.03 265 / .92))}
.gl{background:radial-gradient(40% 55% at 80% 20%,oklch(0.83 0.14 80 / .22),transparent 70%),radial-gradient(45% 60% at 10% 90%,oklch(0.5 0.14 265 / .35),transparent 70%)}
.c:before{content:"";display:block;width:26mm;height:1.6mm;background:var(--accent);margin-bottom:9mm}
.ly .l{font-weight:200;letter-spacing:.005em}.no{color:var(--accent);font:700 40pt/1 var(--display);position:absolute;right:20mm;top:12mm}.tr p{font-weight:200}`,
  },
  hymnal: {
    cw: 0.38,
    wmm: 240,
    css: `.s{--stext:oklch(0.97 0.012 80);--sdim:oklch(0.82 0.05 60);--blur:34px;background:oklch(0.14 0.02 40)}
.sc{background:linear-gradient(to bottom,oklch(0.13 0.02 40 / .8),oklch(0.12 0.03 35 / .66) 55%,oklch(0.1 0.02 40 / .9))}
.gl{background:radial-gradient(50% 65% at 50% 100%,oklch(0.68 0.16 55 / .38),transparent 70%)}
.ly .l{font-style:italic;font-weight:500;letter-spacing:.002em}.no{position:absolute;left:20mm;top:12mm;font:700 54pt/1 var(--display);color:oklch(0.72 0.17 35 / .9)}
.c{align-items:center;text-align:center}.tr{border-top:1px solid oklch(1 0 0 / .25);padding-top:6mm;margin-top:9mm}`,
  },
  poster: {
    cw: 0.47,
    wmm: 195,
    css: `.s{--stext:oklch(0.975 0.012 95);--sdim:oklch(0.88 0.04 255);background:var(--cobalt)}
.bg{inset:0 0 0 auto;width:54mm;filter:none}
.sc{background:linear-gradient(to right,transparent calc(100% - 54mm),oklch(0.2 0.03 255 / .15) 100%)}
.gl{background:radial-gradient(60% 90% at 0% 0%,oklch(0.66 0.17 50 / .28),transparent 65%)}
.c{padding:12mm 76mm 20mm 20mm}
.no{position:absolute;left:20mm;top:9mm;font:800 70pt/1 var(--display);letter-spacing:-.05em;color:var(--accent)}.c .ly{margin-top:14mm}
.ly .l{font-weight:700;letter-spacing:-.01em}.bar{right:76mm}`,
  },
  mono: {
    cw: 0.53,
    wmm: 250,
    css: `.s{--stext:oklch(0.15 0 0);--sdim:oklch(0.38 0 0)}
.bg{filter:grayscale(1) blur(22px);opacity:.14}
.sc{background:linear-gradient(to bottom,#fff,oklch(1 0 0 / .55))}
.gl{border-top:3pt solid var(--ink)}
.no{position:absolute;right:20mm;top:11mm;font:800 58pt/1 var(--display);letter-spacing:-.04em;color:var(--accent)}
.ly .l{font-weight:800;letter-spacing:-.015em}.c{padding-top:22mm}`,
  },
}
