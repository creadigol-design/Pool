"use strict";

const TEAM = "Tafarn y Fic";
const KEY = "tafarn-y-fic-pool-v1";

/* ---------- state ---------- */
let state;
let tab = "fixtures";

const SQUAD = ["Neil Broadley", "Aled Emyr", "Dafydd Evans", "Steffan Evens", "Dion Griffiths", "Llyr Hughes",
  "Nick Hughes", "Gruff John", "Mark Jones", "Craig Owen", "Gavin Owen", "Harri Owen", "Iwan Owen", "Llion Owen",
  "Dilwyn Roberts", "Jake Shenton", "Ricky Williams"];
const uid = () => Math.random().toString(36).slice(2, 10);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function load() {
  let s = null;
  try {
    const x = JSON.parse(localStorage.getItem(KEY));
    if (x && Array.isArray(x.players) && Array.isArray(x.fixtures)) s = x;
  } catch (e) { /* fall through */ }
  s = s || { players: [], fixtures: [] };
  s.players.forEach((p, i) => { if (p.order == null) p.order = i; });
  // First run: start with the team's squad (once only, so removing a player sticks).
  // Fixed ids, so two phones seeding the same team can never create duplicates.
  if (!s.seeded && !s.players.length) s.players = SQUAD.map((name, order) => ({ id: "p-" + slug(name), name, order }));
  s.seeded = true;
  // Same for the league fixtures.
  if (!s.fixturesSeeded && !s.fixtures.length) s.fixtures = leagueFixtures();
  s.fixturesSeeded = true;
  return s;
}

/* Division 2, season 2026-27 (from the printed fixture card).
   [week, date, opponent, home?]. Weeks 10-18 are the return fixtures: same opponents, home/away swapped.
   Free weeks: 8 and 17. */
const LEAGUE = [
  [1, "2026-09-16", "Pendeitch", 0], [2, "2026-09-23", "Copa Reds", 1], [3, "2026-09-30", "Yr Afr", 1],
  [4, "2026-10-14", "Clwb Bach", 0], [5, "2026-10-21", "Tyn Llan A", 1], [6, "2026-10-28", "Crown B", 0],
  [7, "2026-11-11", "HITW A", 1], [9, "2026-11-25", "Pennionyn B", 1],
  [10, "2027-01-06", "Pendeitch", 1], [11, "2027-01-13", "Copa Reds", 0], [12, "2027-01-27", "Yr Afr", 0],
  [13, "2027-02-10", "Clwb Bach", 1], [14, "2027-02-24", "Tyn Llan A", 0], [15, "2027-03-03", "Crown B", 1],
  [16, "2027-03-10", "HITW A", 0], [18, "2027-03-24", "Pennionyn B", 0],
];
function leagueFixtures() {
  return LEAGUE.map(([week, date, opponent, home]) =>
    ({ id: "wk" + week, week, date, time: "", opponent, home: !!home, venue: "", avail: {}, played: {}, frames: {} }));
}
state = load();

function persistLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast("Could not save - browser storage is full or blocked"); }
}
// Saves on this device and, when connected to a team, sends only what changed to the shared database.
function save() {
  persistLocal();
  if (sync.on) {
    sync.mod.push(sync.teamId, sync.base, state, () => toast("Couldn't save to the shared database"));
    sync.base = snap();
  }
}
const snap = () => JSON.parse(JSON.stringify({ players: state.players, fixtures: state.fixtures }));
/* ---------- tiny DOM helper (no innerHTML => no injection from pasted data) ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "value") el.value = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- dates ---------- */
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = n => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
function fmtDate(iso, long) {
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d)) return iso || "";
  return d.toLocaleDateString("en-GB", long
    ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    : { weekday: "short", day: "numeric", month: "short" });
}

/* ---------- results ---------- */
const hasScore = f => Number.isInteger(f.scoreFor) && Number.isInteger(f.scoreAgainst);
const resultOf = f => !hasScore(f) ? null : f.scoreFor > f.scoreAgainst ? "W" : f.scoreFor < f.scoreAgainst ? "L" : "D";
const sorted = () => [...state.fixtures].sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

/* ---------- navigation ---------- */
document.querySelectorAll(".tabs button").forEach(b =>
  b.addEventListener("click", () => {
    tab = b.dataset.tab;
    document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("active", x === b));
    render();
  }));

function render() {
  const view = document.getElementById("view");
  const gated = needsGate();
  document.querySelector(".tabs").hidden = gated;
  view.replaceChildren(gated ? viewGate() : ({ fixtures: viewFixtures, squad: viewSquad, stats: viewStats, data: viewData })[tab]());
}

/* ---------- fixtures tab ---------- */
function viewFixtures() {
  const all = sorted();
  const today = todayISO();
  const upcoming = all.filter(f => !hasScore(f) && f.date >= today);
  const awaiting = all.filter(f => !hasScore(f) && f.date < today);
  const played = all.filter(hasScore).reverse();
  const root = h("div");

  root.append(h("div", { class: "row between" },
    h("h2", {}, "Fixtures"),
    h("div", { class: "row" },
      h("button", { class: "btn ghost small", onclick: openImport }, "Import"),
      h("button", { class: "btn small", onclick: () => openFixtureForm() }, "+ Add fixture"))));

  if (!all.length) {
    root.append(h("div", { class: "empty card" },
      h("p", {}, "No fixtures yet."),
      h("p", { class: "small" }, "Use Import to paste the fixture list from the league website, or add them one at a time.")));
    return root;
  }
  const section = (title, list, extra) => {
    if (!list.length) return;
    root.append(h("h2", {}, title));
    list.forEach((f, i) => root.append(fixtureCard(f, extra && i === 0)));
  };
  section("Next up", upcoming.slice(0, 1), true);
  section("Upcoming", upcoming.slice(1));
  section("Needs a score", awaiting);
  section("Results", played);
  return root;
}

function countsFor(f) {
  const c = { yes: 0, maybe: 0, no: 0 };
  for (const p of state.players) { const a = (f.avail || {})[p.id]; if (a) c[a]++; }
  return c;
}

function fixtureCard(f, highlight) {
  const d = new Date(f.date + "T12:00:00");
  const r = resultOf(f);
  const c = countsFor(f);
  const crest = name => h("span", { class: "crest" + (name === TEAM ? " us" : "") }, initials(name));
  const side = (name, cls) => h("div", { class: "side " + cls }, h("span", { class: "tname" }, name), crest(name));
  const left = f.home ? TEAM : f.opponent, right = f.home ? f.opponent : TEAM;
  const mid = r
    ? h("div", { class: "scorebox " + r }, h("b", {}, f.home ? f.scoreFor : f.scoreAgainst), h("i", {}, "-"), h("b", {}, f.home ? f.scoreAgainst : f.scoreFor))
    : h("div", { class: "kick" }, f.time || "TBC");
  return h("div", { class: "card fixture" + (highlight ? " next" : ""), tabindex: 0, onclick: () => openFixture(f.id),
      onkeydown: e => { if (e.key === "Enter") openFixture(f.id); } },
    h("div", { class: "fx-head" },
      h("span", {}, (f.week ? `Wk ${f.week} · ` : "") + (isNaN(d) ? f.date : fmtDate(f.date))),
      h("span", {}, [f.venue, r ? { W: "Win", D: "Draw", L: "Loss" }[r] : null].filter(Boolean).join(" · "))),
    h("div", { class: "fx-body" }, side(left, "l"), mid, side(right, "r")),
    !r && state.players.length ? h("div", { class: "counts" },
      h("span", { class: "dot yes" }, `${c.yes} in`),
      h("span", { class: "dot maybe" }, `${c.maybe} maybe`),
      h("span", { class: "dot no" }, `${c.no} out`)) : null);
}
function initials(name) {
  const w = name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(w => !/^(the|y|of|fc)$/i.test(w));
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2)).toUpperCase();
}

/* ---------- fixture detail ---------- */
function dialog(title, body, onClose) {
  const dlg = document.getElementById("dlg");
  dlg.replaceChildren(
    h("div", { class: "dlg-head" }, h("h3", {}, title),
      h("button", { "aria-label": "Close", onclick: () => dlg.close() }, "×")),
    h("div", { class: "dlg-body" }, body));
  dlg.onclose = () => { dlg.onclose = null; if (onClose) onClose(); render(); };
  if (!dlg.open) dlg.showModal();
  return dlg;
}

function openFixture(id) {
  const f = state.fixtures.find(x => x.id === id);
  if (!f) return;
  f.avail = f.avail || {}; f.played = f.played || {}; f.frames = f.frames || {};

  const body = h("div");
  let drawing = false;
  const draw = () => {
    // Clearing the body blurs a focused input, which fires its change handler and re-enters draw().
    if (drawing) return;
    drawing = true;
    body.replaceChildren();
    body.append(h("p", { class: "muted" },
      [fmtDate(f.date, true), f.time, f.home ? "Home" : "Away", f.venue].filter(Boolean).join(" · ")));

    /* availability */
    body.append(h("h2", {}, "Who's playing?"));
    if (!state.players.length) body.append(h("p", { class: "muted small" }, "Add players on the Squad tab first."));
    state.players.forEach(p => {
      const set = v => { f.avail[p.id] = f.avail[p.id] === v ? undefined : v; save(); draw(); };
      const btn = (v, label) => h("button", { class: (f.avail[p.id] === v ? "on " : "") + v, onclick: () => set(v) }, label);
      body.append(h("div", { class: "player-row" }, h("span", { class: "name" }, p.name),
        h("span", { class: "seg" }, btn("yes", "In"), btn("maybe", "Maybe"), btn("no", "Out"))));
    });
    const c = countsFor(f);
    if (state.players.length) body.append(h("p", { class: "small muted" }, `${c.yes} in, ${c.maybe} maybe, ${c.no} out, ${state.players.length - c.yes - c.maybe - c.no} not replied`));

    /* result */
    body.append(h("h2", {}, "Result"));
    const num = (key) => h("input", { type: "number", min: 0, inputmode: "numeric", "aria-label": key === "scoreFor" ? "Our frames" : "Their frames",
      value: Number.isInteger(f[key]) ? f[key] : "",
      onchange: e => { f[key] = e.target.value === "" ? undefined : Math.max(0, parseInt(e.target.value, 10)); save(); draw(); } });
    const r = resultOf(f);
    body.append(h("div", { class: "row" }, h("b", {}, TEAM), num("scoreFor"), "-", num("scoreAgainst"), h("b", {}, f.opponent),
      r ? h("span", { class: "pill " + r }, { W: "Win", D: "Draw", L: "Loss" }[r]) : null));

    if (r) {
      body.append(h("h2", {}, "Who played & frames won"));
      const tracked = state.players.filter(p => f.played[p.id] || f.avail[p.id] === "yes");
      const list = state.players;
      list.forEach(p => {
        body.append(h("div", { class: "player-row" },
          h("label", { class: "name", style: "margin:0;color:inherit;display:flex;gap:8px;align-items:center" },
            h("input", { type: "checkbox", checked: !!f.played[p.id],
              onchange: e => { f.played[p.id] = e.target.checked; if (!e.target.checked) delete f.frames[p.id]; save(); draw(); } }),
            p.name, !f.played[p.id] && tracked.includes(p) ? h("span", { class: "small muted" }, " (said in)") : null),
          f.played[p.id] ? h("input", { type: "number", min: 0, inputmode: "numeric", "aria-label": `Frames won by ${p.name}`,
            value: f.frames[p.id] ?? "", onchange: e => { f.frames[p.id] = e.target.value === "" ? undefined : Math.max(0, parseInt(e.target.value, 10)); save(); } }) : null));
      });
      const total = Object.values(f.frames).reduce((a, b) => a + (b || 0), 0);
      if (total && total !== f.scoreFor) body.append(h("p", { class: "small muted" }, `Player frames add up to ${total}, team score is ${f.scoreFor}.`));
    }

    /* notes + actions */
    body.append(h("h2", {}, "Notes"),
      h("textarea", { style: "min-height:70px;font-family:inherit", placeholder: "Man of the match, rule disputes, lift arrangements…",
        onchange: e => { f.notes = e.target.value; save(); } }, f.notes || ""));
    body.append(h("div", { class: "row between", style: "margin-top:14px" },
      h("button", { class: "btn danger small", onclick: () => { if (confirm("Delete this fixture?")) { state.fixtures = state.fixtures.filter(x => x !== f); save(); document.getElementById("dlg").close(); } } }, "Delete"),
      h("button", { class: "btn ghost small", onclick: () => openFixtureForm(f) }, "Edit details")));
    drawing = false;
  };
  draw();
  // Called when someone else's change arrives while this fixture is open.
  window.__redraw = () => {
    if (!state.fixtures.includes(f)) { document.getElementById("dlg").close(); return; }
    const a = document.activeElement;
    if (a && body.contains(a) && /INPUT|TEXTAREA/.test(a.tagName)) return; // don't yank a box someone is typing in
    draw();
  };
  dialog(`${f.home ? "v" : "@"} ${f.opponent}`, body, () => { window.__redraw = null; });
}

function openFixtureForm(existing) {
  const f = existing || { id: uid(), date: todayISO(), time: "20:00", opponent: "", home: true, venue: "" };
  const inp = (label, key, type = "text") => h("label", {}, label, h("input", { type, value: f[key] || "", oninput: e => { f[key] = e.target.value; } }));
  const body = h("div", {},
    h("div", { class: "grid2" }, inp("Date", "date", "date"), inp("Time", "time", "time")),
    inp("Opponent", "opponent"),
    h("label", {}, "Home or away",
      h("select", { onchange: e => { f.home = e.target.value === "H"; } },
        h("option", { value: "H", selected: f.home }, "Home (Tafarn y Fic)"),
        h("option", { value: "A", selected: !f.home }, "Away"))),
    inp("Venue (optional)", "venue"),
    h("button", { class: "btn", onclick: () => {
      if (!f.opponent.trim() || !f.date) { toast("Date and opponent are required"); return; }
      f.opponent = f.opponent.trim();
      if (!existing) state.fixtures.push(f);
      save();
      document.getElementById("dlg").close();
      if (existing) openFixture(f.id);
    } }, existing ? "Save" : "Add fixture"));
  dialog(existing ? "Edit fixture" : "Add fixture", body);
}

/* ---------- import ---------- */
const SAMPLE = `Tue 14 Oct 2025 20:00 Tafarn y Fic v The Red Lion
21/10/2025, The Crown, A
2025-10-28, 20:30, Ship Inn, H`;

function openImport() {
  const ta = h("textarea", { placeholder: SAMPLE });
  const out = h("p", { class: "small muted" });
  const body = h("div", {},
    h("p", { class: "small muted" }, "Copy the fixtures for Tafarn y Fic from the league website and paste them here, one fixture per line. Accepted shapes:"),
    h("pre", { class: "small card", style: "overflow:auto;margin:0 0 8px" }, SAMPLE),
    ta, out,
    h("div", { class: "row", style: "margin-top:10px" },
      h("button", { class: "btn ghost", onclick: () => {
        const { fixtures, skipped } = parseFixtures(ta.value);
        out.textContent = `${fixtures.length} fixture(s) recognised` + (skipped.length ? `; ${skipped.length} line(s) not understood: "${skipped[0]}"…` : "");
      } }, "Preview"),
      h("button", { class: "btn", onclick: () => {
        const { fixtures, skipped } = parseFixtures(ta.value);
        let added = 0;
        for (const f of fixtures) {
          if (state.fixtures.some(x => x.date === f.date && x.opponent.toLowerCase() === f.opponent.toLowerCase())) continue;
          state.fixtures.push(f); added++;
        }
        save();
        toast(`Added ${added} fixture(s)` + (skipped.length ? `, ${skipped.length} skipped` : ""));
        document.getElementById("dlg").close();
      } }, "Import")));
  dialog("Import fixtures", body);
}

function parseDate(s) {
  let m, rest = s;
  let m1 = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m1) return { date: m1[0], rest: s.replace(m1[0], " ") };
  m1 = s.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (m1) {
    const y = m1[3].length === 2 ? "20" + m1[3] : m1[3];
    return { date: `${y}-${pad(+m1[2])}-${pad(+m1[1])}`, rest: s.replace(m1[0], " ") };
  }
  m1 = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?(?:,?\s+(\d{4}))?/);
  if (m1) {
    const mi = MONTHS.indexOf(m1[2].slice(0, 3).toLowerCase());
    if (mi >= 0) {
      let y = m1[3] ? +m1[3] : new Date().getFullYear();
      if (!m1[3] && mi < 6 && new Date().getMonth() >= 6) y++; // season runs autumn -> spring
      return { date: `${y}-${pad(mi + 1)}-${pad(+m1[1])}`, rest: s.replace(m1[0], " ") };
    }
  }
  return null;
}

function parseFixtures(text) {
  const fixtures = [], skipped = [];
  const ours = TEAM.toLowerCase();
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line) continue;
    const d = parseDate(line);
    if (!d) { skipped.push(line); continue; }
    let rest = d.rest;
    let time = "";
    const tm = rest.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
    if (tm) { time = `${pad(+tm[1])}:${tm[2]}`; rest = rest.replace(tm[0], " "); }
    rest = rest.replace(/\b(Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)[a-z]*\b,?/gi, " ");

    let opponent = "", home = true;
    const vs = rest.split(/\s+(?:v|vs|v\.|vs\.|-)\s+/i);
    if (vs.length === 2) {
      const [l, r] = vs.map(x => x.replace(/[,|\t]+/g, " ").replace(/\s+/g, " ").trim());
      if (l.toLowerCase().includes(ours) || ours.includes(l.toLowerCase()) && l) { opponent = r; home = true; }
      else if (r.toLowerCase().includes(ours)) { opponent = l; home = false; }
      else { opponent = r; home = true; }
    } else {
      const fields = rest.split(/[,|\t]+/).map(x => x.trim()).filter(Boolean);
      const haIdx = fields.findIndex(x => /^(h|a|home|away)$/i.test(x));
      if (haIdx >= 0) { home = /^h/i.test(fields[haIdx]); fields.splice(haIdx, 1); }
      opponent = fields.join(" ");
    }
    opponent = opponent.replace(/\s*\((h|a|home|away)\)\s*$/i, m => { home = /h/i.test(m); return ""; }).trim();
    if (!opponent) { skipped.push(line); continue; }
    fixtures.push({ id: uid(), date: d.date, time, opponent, home, venue: "", avail: {}, played: {}, frames: {} });
  }
  return { fixtures, skipped };
}

/* ---------- squad tab ---------- */
function viewSquad() {
  const root = h("div", {}, h("h2", {}, "Squad"));
  const input = h("input", { type: "text", placeholder: "Player name", "aria-label": "Player name",
    onkeydown: e => { if (e.key === "Enter") add(); } });
  const add = () => {
    const name = input.value.trim();
    if (!name) return;
    const order = Math.max(-1, ...state.players.map(p => p.order ?? 0)) + 1;
    state.players.push({ id: uid(), name, order });
    save(); render();
    document.querySelector("#view input[type=text]").focus();
  };
  root.append(h("div", { class: "row", style: "margin-bottom:12px" }, input, h("button", { class: "btn", onclick: add }, "Add")));
  if (!state.players.length) root.append(h("div", { class: "empty card" }, "No players yet. Add the team above."));
  state.players.forEach(p => root.append(h("div", { class: "card row between" },
    h("span", {}, p.name),
    h("span", { class: "row" },
      h("button", { class: "btn ghost small", onclick: () => { const n = prompt("Rename player", p.name); if (n && n.trim()) { p.name = n.trim(); save(); render(); } } }, "Rename"),
      h("button", { class: "btn ghost small", onclick: () => {
        if (!confirm(`Remove ${p.name}? Their past attendance and frames stay in the fixtures' totals only if you keep them - this deletes them.`)) return;
        state.players = state.players.filter(x => x !== p);
        state.fixtures.forEach(f => { for (const k of ["avail", "played", "frames"]) if (f[k]) delete f[k][p.id]; });
        save(); render();
      } }, "Remove")))));
  return root;
}

/* ---------- stats tab ---------- */
function viewStats() {
  const done = sorted().filter(hasScore);
  const rec = { W: 0, D: 0, L: 0 }, fr = { f: 0, a: 0 };
  done.forEach(f => { rec[resultOf(f)]++; fr.f += f.scoreFor; fr.a += f.scoreAgainst; });
  const tile = (n, label) => h("div", { class: "tile" }, h("b", {}, n), h("span", { class: "small muted" }, label));
  const root = h("div", {}, h("h2", {}, "Team record"),
    h("div", { class: "tiles" }, tile(done.length, "Played"), tile(rec.W, "Won"), tile(rec.D, "Drawn"), tile(rec.L, "Lost"),
      tile(`${fr.f}-${fr.a}`, "Frames")));

  root.append(h("h2", {}, "Players"));
  if (!state.players.length || !done.length) {
    root.append(h("div", { class: "empty card" }, "Stats appear once players are added and scores are entered."));
    return root;
  }
  const rows = state.players.map(p => {
    const played = done.filter(f => f.played && f.played[p.id]);
    const frames = played.reduce((a, f) => a + ((f.frames || {})[p.id] || 0), 0);
    const wins = played.filter(f => resultOf(f) === "W").length;
    return { name: p.name, played: played.length, att: Math.round(100 * played.length / done.length), frames, wins };
  }).sort((a, b) => b.played - a.played || b.frames - a.frames);
  root.append(h("div", { class: "card" }, h("table", {},
    h("thead", {}, h("tr", {}, ["Player", "Played", "Att %", "Frames won", "Team wins"].map(t => h("th", {}, t)))),
    h("tbody", {}, rows.map(r => h("tr", {}, h("td", {}, r.name), h("td", {}, r.played), h("td", {}, r.att + "%"), h("td", {}, r.frames), h("td", {}, r.wins)))))));
  root.append(h("p", { class: "small muted" }, "Att % = share of completed fixtures the player played in."));
  return root;
}

/* ---------- data tab ---------- */
function viewData() {
  const fileInput = h("input", { type: "file", accept: "application/json", style: "display:none", onchange: e => {
    const file = e.target.files[0]; if (!file) return;
    file.text().then(t => {
      const s = JSON.parse(t);
      if (!Array.isArray(s.players) || !Array.isArray(s.fixtures)) throw new Error("bad file");
      if (!confirm("Replace everything in this browser with the backup?")) return;
      state = s; save(); toast("Backup restored"); render();
    }).catch(() => toast("That file is not a valid backup"));
  } });
  const sharing = sync.code
    ? h("div", { class: "card" },
        h("p", {}, h("b", {}, "Shared with your team. "), "Changes on any phone appear on everyone's phone."),
        h("p", { class: "small muted" }, "Team code: ", h("b", {}, sync.code), ". Anyone with the code can view and edit, so only share it with the team."),
        h("div", { class: "row" },
          h("button", { class: "btn", onclick: copyInvite }, "Copy invite link"),
          h("button", { class: "btn ghost", onclick: () => { if (confirm("Leave the team on this phone? The shared data is kept for everyone else.")) leaveTeam(); } }, "Leave team")))
    : h("div", { class: "card" },
        h("p", {}, h("b", {}, "This phone only. "), "Nothing you enter here is shared with the rest of the team."),
        h("button", { class: "btn", onclick: () => { store.del(LOCAL_KEY); render(); } }, "Set up sharing"));
  return h("div", {}, h("h2", {}, "Data"), sharing,
    h("div", { class: "card" },
      h("p", {}, "Download a backup of everything (squad, fixtures, attendance and scores), or restore one."),
      h("div", { class: "row" },
        h("button", { class: "btn", onclick: () => {
          const a = h("a", { href: URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" })), download: `tafarn-y-fic-pool-${todayISO()}.json` });
          a.click(); URL.revokeObjectURL(a.href);
        } }, "Download backup"),
        h("button", { class: "btn ghost", onclick: () => fileInput.click() }, "Restore backup"), fileInput)),
    h("div", { class: "card" },
      h("p", {}, "Division 2 2026-27 fixtures come pre-loaded. If any are missing, this adds them back without touching scores you've entered."),
      h("button", { class: "btn ghost", onclick: () => {
        let n = 0;
        for (const f of leagueFixtures()) {
          if (state.fixtures.some(x => x.date === f.date && x.opponent.toLowerCase() === f.opponent.toLowerCase())) continue;
          state.fixtures.push(f); n++;
        }
        save(); toast(n ? `Added ${n} league fixture(s)` : "All league fixtures are already here");
      } }, "Add missing league fixtures")),
    h("div", { class: "card" },
      h("button", { class: "btn danger", onclick: () => {
        const msg = sync.on ? "Delete ALL players, fixtures and scores for EVERYONE on the team?" : "Delete ALL players, fixtures and scores?";
        if (confirm(msg)) { state.players = []; state.fixtures = []; save(); render(); }
      } }, "Delete everything")));
}

/* ---------- sharing (live sync between phones) ---------- */
const CODE_KEY = "tfp-team-code", LOCAL_KEY = "tfp-local-only";
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  del: k => { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } },
};
const sync = { mod: null, teamId: null, base: null, on: false, code: store.get(CODE_KEY), status: "local" };
const gate = { code: "", error: "", busy: false };
const needsGate = () => !sync.code && !store.get(LOCAL_KEY);

// The team code is hashed into the database path, so the code itself never leaves the phone.
async function teamIdFor(code) {
  const norm = code.trim().toLowerCase().replace(/\s+/g, " ");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("tafarn-y-fic:" + norm));
  return "t" + [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

function setStatus(s) {
  sync.status = s;
  const el = document.getElementById("sync");
  if (!el) return;
  el.className = "sync " + s;
  el.textContent = { live: "Live", offline: "Offline", connecting: "Connecting…", local: "This phone only", error: "Sync problem" }[s] || s;
}

function fixtureFromDoc(id, d) {
  return { id, week: d.week, date: d.date, time: d.time || "", opponent: d.opponent, home: !!d.home, venue: d.venue || "",
    scoreFor: d.scoreFor, scoreAgainst: d.scoreAgainst, notes: d.notes,
    avail: { ...(d.avail || {}) }, played: { ...(d.played || {}) }, frames: { ...(d.frames || {}) } };
}
const sortPlayers = () => state.players.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));

function replaceFromRemote(players, fixtures) {
  state.players = players.map(p => ({ id: p.id, name: p.name, order: p.order ?? 0 }));
  state.fixtures = fixtures.map(f => fixtureFromDoc(f.id, f));
  sortPlayers();
}

// Someone else's change arrived. Update objects in place so an open fixture keeps pointing at live data.
function applyRemote(kind, changes) {
  for (const c of changes) {
    if (kind === "players") {
      if (c.type === "removed") { state.players = state.players.filter(p => p.id !== c.id); continue; }
      const p = state.players.find(x => x.id === c.id);
      if (p) { p.name = c.data.name; p.order = c.data.order ?? 0; }
      else state.players.push({ id: c.id, name: c.data.name, order: c.data.order ?? 0 });
    } else {
      if (c.type === "removed") { state.fixtures = state.fixtures.filter(f => f.id !== c.id); continue; }
      const nf = fixtureFromDoc(c.id, c.data);
      const f = state.fixtures.find(x => x.id === c.id);
      if (f) { for (const k of Object.keys(f)) delete f[k]; Object.assign(f, nf); }
      else state.fixtures.push(nf);
    }
  }
  sortPlayers();
  sync.base = snap();
  persistLocal();
  if (window.__redraw) window.__redraw();
  const a = document.activeElement;
  if (!(a && a.closest && a.closest("#view") && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) render();
}

// mode: "create" (new team, starts from this phone's data), "join" (existing team) or "resume" (saved code).
async function startSync(code, mode) {
  setStatus("connecting");
  let mod;
  try { mod = await import("./sync.js"); }
  catch (e) { setStatus("offline"); throw new Error("Couldn't load sharing. Check you're online and try again."); }
  try {
    const teamId = await teamIdFor(code);
    const res = await mod.connect(teamId, { onChange: applyRemote, onStatus: setStatus });
    if (res.offline && mode !== "resume") throw new Error("Couldn't reach the shared database. Check your signal and try again.");
    const empty = !res.offline && !res.players.length && !res.fixtures.length;
    if (mode === "create" && !empty) throw new Error("That code is already taken. Pick a different one, or use Join team.");
    if (mode === "join" && empty) throw new Error("No team found for that code. Check the spelling.");

    sync.mod = mod; sync.teamId = teamId; sync.code = code; sync.on = true;
    if (mode === "create") {
      sync.base = { players: [], fixtures: [] };
      save(); // sends everything on this phone to the new team
    } else {
      if (!res.offline) { replaceFromRemote(res.players, res.fixtures); persistLocal(); }
      sync.base = snap();
    }
    store.set(CODE_KEY, code); store.del(LOCAL_KEY);
    if (res.offline) setStatus("offline");
  } catch (e) {
    mod.disconnect();
    sync.on = false;
    setStatus(sync.code ? "error" : "local"); // no saved team => nothing was ever connected
    throw e.code === "permission-denied"
      ? new Error("The shared database isn't ready yet (its security rules haven't been published).")
      : e;
  }
}

function leaveTeam() {
  if (sync.mod) sync.mod.disconnect();
  sync.on = false; sync.code = null; sync.mod = null;
  store.del(CODE_KEY); store.set(LOCAL_KEY, "1");
  setStatus("local");
  render();
}

function copyInvite() {
  const url = location.origin + location.pathname + "#code=" + encodeURIComponent(sync.code);
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
    .then(() => toast("Invite link copied"))
    .catch(() => prompt("Copy this invite link:", url));
}

function viewGate() {
  const input = h("input", { type: "text", value: gate.code, placeholder: "a few words you'll remember", autocapitalize: "off",
    autocomplete: "off", spellcheck: "false", "aria-label": "Team code" });
  const go = async mode => {
    gate.code = input.value.trim();
    gate.error = "";
    if (gate.code.length < 6) { gate.error = "Use at least 6 characters, for example a few words."; render(); return; }
    gate.busy = true; render();
    try { await startSync(gate.code, mode); gate.code = ""; } catch (e) { gate.error = e.message; }
    gate.busy = false; render();
  };
  return h("div", {}, h("h2", {}, "Join your team"),
    h("div", { class: "card" },
      h("p", {}, "Everyone on the team uses the same team code, so attendance and scores update live on every phone."),
      h("label", {}, "Team code", input),
      gate.error ? h("p", { class: "err" }, gate.error) : null,
      h("div", { class: "row" },
        h("button", { class: "btn", disabled: gate.busy, onclick: () => go("join") }, gate.busy ? "Connecting…" : "Join team"),
        h("button", { class: "btn ghost", disabled: gate.busy, onclick: () => go("create") }, "Create new team")),
      h("p", { class: "small muted" }, "First person: Create new team and pick a code. Everyone else: Join team with that code, or open the invite link.")),
    h("p", { class: "small" }, h("a", { href: "#", onclick: e => { e.preventDefault(); store.set(LOCAL_KEY, "1"); setStatus("local"); render(); } }, "Use on this phone only")));
}

async function boot() {
  const m = location.hash.match(/code=([^&]+)/);
  const inviteCode = m ? decodeURIComponent(m[1]).trim() : null;
  if (m) history.replaceState(null, "", location.pathname + location.search);
  const saved = sync.code;
  setStatus(saved || inviteCode ? "connecting" : "local");
  render();
  if (inviteCode && inviteCode !== saved) {
    gate.busy = true; render();
    try { await startSync(inviteCode, "join"); }
    catch (e) {
      gate.code = inviteCode; gate.error = e.message;
      if (saved) { try { await startSync(saved, "resume"); } catch (e2) { toast(e2.message); } }
    }
    gate.busy = false;
  } else if (saved) {
    try { await startSync(saved, "resume"); } catch (e) { toast(e.message); }
  }
  render();
}

boot();
