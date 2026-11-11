// Builds the profile: animated system-map heroes (light + dark), link buttons, and README.md.
// Data: docs/systems.json (also read by the interactive map at docs/index.html). Run: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const DIR = new URL('..', import.meta.url).pathname;
const { nodes: NODES, edges: EDGES, zones: ZONES } = JSON.parse(readFileSync(DIR + 'docs/systems.json', 'utf8'));

const b64 = (f) => readFileSync(DIR + 'fonts/' + f).toString('base64');
const FONTS = `@font-face{font-family:G;src:url(data:font/woff2;base64,${b64('geist.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:GM;src:url(data:font/woff2;base64,${b64('geist-mono.woff2')}) format('woff2')}`;

const THEMES = {
  light: { bg: '#fcfcfa', fg: '#0b0c0f', dim: '#5d606b', faint: '#b9bbc2', line: '#dcdcd6', accent: '#2334e6', node: '#ffffff', live: '#17a34a' },
  dark: { bg: '#101218', fg: '#eeeff2', dim: '#9a9eab', faint: '#4a4e5a', line: '#23262f', accent: '#7c88ff', node: '#161922', live: '#3ccf74' },
};

const W = 1200, TOP = 150, MAP_H = 700, CAP = 120, H = TOP + MAP_H + CAP;
const STEP = 3.2; // seconds each system is in the spotlight
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&#39;');
const width = (n) => (n.hub ? 132 : Math.max(n.name.length * 9.4, n.kind.length * 6.9) + 44);
const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
const tour = NODES.filter((n) => !n.hub);
const T = tour.length * STEP;
const w = STEP / T, e = 0.25 / T;
// A window animation: off until this system's turn, on for STEP seconds, then off for the rest of the loop.
const win = (i, attr, off, on) => `<animate attributeName="${attr}" dur="${T}s" begin="${(i * STEP).toFixed(2)}s" repeatCount="indefinite" keyTimes="0;${e.toFixed(4)};${(w - e).toFixed(4)};${w.toFixed(4)};1" values="${off};${on};${on};${off};${off}"/>`;

function wrap(text, max) {
  const out = [''];
  for (const word of text.split(' ')) {
    if ((out.at(-1) + ' ' + word).trim().length > max) out.push(word); else out[out.length - 1] = (out.at(-1) + ' ' + word).trim();
  }
  return out;
}

function render(t) {
  const c = THEMES[t];
  const p = [];
  // dot grid + zones
  for (let x = 20; x < W; x += 40) for (let y = 20; y < MAP_H; y += 40) p.push(`<circle cx="${x}" cy="${y + TOP}" r="1" fill="${c.line}"/>`);
  for (const z of ZONES) p.push(`<rect x="${z.x}" y="${z.y + TOP}" width="${z.w}" height="${z.h}" rx="12" fill="none" stroke="${c.line}" stroke-dasharray="2 5"/><text class="m" x="${z.x + 16}" y="${z.y + TOP + 24}" font-size="11" letter-spacing=".9" fill="${c.dim}">${z.label.toUpperCase()}</text>`);
  // edges
  EDGES.forEach(([a, b, type], k) => {
    const A = byId[a], B = byId[b];
    p.push(`<path id="e${k}" d="M${A.x},${A.y + TOP} L${B.x},${B.y + TOP}" stroke="${c.faint}" stroke-width="1.2" fill="none"${type === 'mcp' ? ' stroke-dasharray="4 4"' : ''}/>`);
  });
  // spotlight overlays for edges + labels (one copy per endpoint, so each lights on either system's turn)
  EDGES.forEach(([a, b, , label], k) => {
    const A = byId[a], B = byId[b];
    for (const end of [a, b]) {
      const i = tour.findIndex((n) => n.id === end);
      if (i < 0) continue;
      p.push(`<g opacity="0">${win(i, 'opacity', 0, 1)}<path d="M${A.x},${A.y + TOP} L${B.x},${B.y + TOP}" stroke="${c.accent}" stroke-width="1.8" fill="none"/><text class="m" x="${(A.x + B.x) / 2}" y="${(A.y + B.y) / 2 + TOP - 7}" text-anchor="middle" font-size="10.5" fill="${c.accent}" stroke="${c.bg}" stroke-width="4" paint-order="stroke">${esc(label)}</text></g>`);
    }
  });
  // pulses toward Claude
  EDGES.forEach(([, b], k) => {
    if (b !== 'claude') return;
    const begin = ((k * 0.37) % 1 * 3.2).toFixed(2);
    p.push(`<circle r="3" fill="${c.accent}" opacity="0"><animateMotion dur="3.2s" begin="${begin}s" repeatCount="indefinite"><mpath href="#e${k}"/></animateMotion><animate attributeName="opacity" dur="3.2s" begin="${begin}s" repeatCount="indefinite" values="0;1;1;0"/></circle>`);
  });
  // nodes
  for (const n of NODES) {
    const nw = width(n), nh = 46, x = n.x - nw / 2, y = n.y + TOP - nh / 2;
    const i = tour.indexOf(n);
    p.push(`<g transform="translate(${x.toFixed(1)},${y})">
<rect width="${nw.toFixed(1)}" height="${nh}" rx="7" fill="${n.hub ? c.fg : c.node}" stroke="${c.fg}" stroke-width="1.1"/>
${i >= 0 ? `<rect width="${nw.toFixed(1)}" height="${nh}" rx="7" fill="none" stroke="${c.accent}" stroke-width="2.2" opacity="0">${win(i, 'opacity', 0, 1)}</rect>` : ''}
<text class="s" x="14" y="20" font-size="15" font-weight="600" fill="${n.hub ? c.bg : c.fg}">${esc(n.name)}</text>
<text class="m" x="14" y="36" font-size="11" fill="${n.hub ? c.faint : c.dim}">${esc(n.kind)}</text>
${n.status && n.status !== 'Private' ? `<circle cx="${(nw - 13).toFixed(1)}" cy="15" r="3.5" fill="${c.live}"/>` : ''}</g>`);
  }
  // captions
  const cy = TOP + MAP_H + 34;
  tour.forEach((n, i) => {
    const lines = wrap(n.does, 112);
    p.push(`<g opacity="0">${win(i, 'opacity', 0, 1)}
<text class="s" x="40" y="${cy}" font-size="17" font-weight="600" fill="${c.fg}">${esc(n.name)} <tspan class="m" font-size="12" font-weight="400" fill="${c.dim}" dx="6">${esc(n.kind)}${n.status ? ' · ' + esc(n.status.toLowerCase()) : ''}</tspan></text>
${lines.map((l, j) => `<text class="s" x="40" y="${cy + 26 + j * 21}" font-size="15" fill="${c.dim}">${esc(l)}</text>`).join('')}</g>`);
  });
  // progress ticks
  const tw = (W - 80) / tour.length;
  tour.forEach((n, i) => {
    const x = 40 + i * tw;
    p.push(`<rect x="${(x + 2).toFixed(1)}" y="${H - 18}" width="${(tw - 4).toFixed(1)}" height="2" fill="${c.line}"/><rect x="${(x + 2).toFixed(1)}" y="${H - 18}" width="${(tw - 4).toFixed(1)}" height="2" fill="${c.accent}" opacity="0">${win(i, 'opacity', 0, 1)}</rect>`);
  });

  const mcp = EDGES.filter((x) => x[2] === 'mcp').length;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Naram Alhasani, systems architect. A map of ${tour.length} systems he built across construction, Formwork and his own products; ${mcp} connect to Claude over MCP. Each system is highlighted in turn with a line on what it does.">
<style>${FONTS}.s{font-family:G,system-ui,sans-serif}.m{font-family:GM,ui-monospace,monospace}@media (prefers-reduced-motion:reduce){animate,animateMotion{display:none}}</style>
<rect width="${W}" height="${H}" rx="14" fill="${c.bg}"/>
<text class="s" x="40" y="86" font-size="56" font-weight="600" letter-spacing="-2" fill="${c.fg}">Naram Alhasani</text>
<text class="m" x="42" y="118" font-size="14" fill="${c.dim}">Systems architect · the software I've built, and how it connects</text>
<text class="m" x="${W - 40}" y="118" font-size="12.5" text-anchor="end" fill="${c.dim}">${tour.length} systems · ${mcp} on MCP · 532+ tools</text>
<line x1="40" x2="${W - 40}" y1="${TOP - 4}" y2="${TOP - 4}" stroke="${c.line}"/>
${p.join('\n')}
<line x1="40" x2="${W - 40}" y1="${TOP + MAP_H}" y2="${TOP + MAP_H}" stroke="${c.line}"/>
</svg>`;
}

function button(label, t) {
  const c = THEMES[t], bw = label.length * 8.6 + 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${bw}" height="44" viewBox="0 0 ${bw} 44" role="img" aria-label="${esc(label)}">
<style>${FONTS}.s{font-family:G,system-ui,sans-serif}</style>
<rect x=".5" y=".5" width="${bw - 1}" height="43" rx="22" fill="${c.node}" stroke="${c.fg}"/>
<circle cx="22" cy="22" r="3.5" fill="${c.accent}"/>
<text class="s" x="36" y="27" font-size="15" font-weight="600" fill="${c.fg}">${esc(label)}</text>
<path d="M${bw - 26} 22h9m-4-4 4 4-4 4" fill="none" stroke="${c.fg}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

const MAP_URL = 'https://naramalhasaniwork.github.io/naramalhasaniWork/';
const pic = (name, alt, width) => `<picture><source media="(prefers-color-scheme: dark)" srcset="assets/${name}-dark.svg"><img src="assets/${name}-light.svg" alt="${alt}"${width ? ` width="${width}"` : ''}></picture>`;

const FEATURED = [
  { name: 'SIGIL', repo: 'naramalhasaniWork/sigil', stack: 'TypeScript · Next.js · Web Audio (AudioWorklet) · C++ · JUCE',
    text: 'A sound-design instrument with six synthesis engines (analog, FM, physical, granular, wavetable, sampler). It runs in a browser tab, and the same engines ship as a VST3 plugin. Every build checks the plugin\'s audio against the web version sample for sample.',
    live: 'https://sigil-production-26de.up.railway.app/start' },
  { name: 'Orbit', repo: 'naramalhasaniWork/orbit', stack: 'TypeScript · Next.js · PostgreSQL + pgvector · BullMQ · Playwright · Claude',
    text: 'Connect a GitHub repo and Orbit maps the app (routes, components, APIs, auth), writes a prioritized test plan, and runs it in real browsers. Failures come back as plain-English explanations on the pull request.' },
];

const readme = `<!-- Generated by scripts/build.mjs from docs/systems.json. Edit those, then run: node scripts/build.mjs -->
<a href="${MAP_URL}">${pic('map', 'Naram Alhasani, systems architect. An animated map of the systems he has built across construction, Formwork and his own products, and how they connect to Claude over MCP.')}</a>

<p>
  <a href="${MAP_URL}">${pic('btn-map', 'Explore the interactive map')}</a>&nbsp;
  <a href="https://www.naramalhasani.com">${pic('btn-site', 'naramalhasani.com')}</a>
</p>

## Featured

${FEATURED.map((f) => `### [${f.name}](https://github.com/${f.repo})

**${f.stack}**

${f.text}

[Repository →](https://github.com/${f.repo})${f.live ? ` · [Try it →](${f.live})` : ''}
`).join('\n')}
## Everything on the map

| System | What it does |
|---|---|
${tour.map((n) => `| **${n.name}** · ${n.kind} | ${n.does} |`).join('\n')}
`;

mkdirSync(DIR + 'assets', { recursive: true });
for (const t of Object.keys(THEMES)) {
  writeFileSync(`${DIR}assets/map-${t}.svg`, render(t));
  writeFileSync(`${DIR}assets/btn-map-${t}.svg`, button('Explore the map', t));
  writeFileSync(`${DIR}assets/btn-site-${t}.svg`, button('naramalhasani.com', t));
}
writeFileSync(DIR + 'README.md', readme);
console.log('built', tour.length, 'systems,', T.toFixed(1) + 's loop');
