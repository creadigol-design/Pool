// Live sharing via Firestore. Loaded on demand by app.js so the app still works if this fails to load.
//
// Data layout:  teams/{teamId}/players/{id}   { name, order }
//               teams/{teamId}/fixtures/{id}  { week, date, time, opponent, home, venue, scoreFor, scoreAgainst,
//                                               notes, avail:{pid:..}, played:{pid:..}, frames:{pid:..} }
// Fixtures are written field by field (avail.<pid> etc.) so two people editing the same fixture at the same
// time don't overwrite each other.

const CDN = "https://www.gstatic.com/firebasejs/10.14.1/";
const SCALARS = ["week", "date", "time", "opponent", "home", "venue", "scoreFor", "scoreAgainst", "notes"];
const MAPS = ["avail", "played", "frames"];

let fs = null, db = null, unsubs = [];

async function load() {
  if (fs) return fs;
  const [appMod, store] = await Promise.all([import(CDN + "firebase-app.js"), import(CDN + "firebase-firestore.js")]);
  const app = appMod.initializeApp(window.FIREBASE_CONFIG);
  try {
    // Keeps working (and queues edits) when the signal drops, e.g. in the pub.
    db = store.initializeFirestore(app, { localCache: store.persistentLocalCache({ tabManager: store.persistentMultipleTabManager() }) });
  } catch (e) {
    db = store.getFirestore(app);
  }
  fs = store;
  return fs;
}

export function disconnect() {
  unsubs.forEach(u => u());
  unsubs = [];
}

/* Subscribes to a team. Resolves once both collections have been read:
   { players, fixtures } (arrays of {id, ...data}) or { offline: true } if the server can't be reached in time.
   Later changes are delivered to onChange(kind, [{type, id, data}]). */
export async function connect(teamId, { onChange, onStatus }) {
  const s = await load();
  disconnect();
  const kinds = ["players", "fixtures"];
  const first = {};
  return new Promise((resolve, reject) => {
    let settled = false, timer;
    const finish = v => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } };
    const fail = e => {
      if (!settled) { settled = true; clearTimeout(timer); disconnect(); reject(e); }
      else onStatus("error", e);
    };
    timer = setTimeout(() => finish({ offline: true }), 8000);
    for (const kind of kinds) {
      const col = s.collection(db, "teams", teamId, kind);
      unsubs.push(s.onSnapshot(col, { includeMetadataChanges: true }, snap => {
        onStatus(snap.metadata.fromCache ? "offline" : "live");
        if (!settled) {
          first[kind] = { docs: snap.docs.map(d => ({ id: d.id, ...d.data() })), server: !snap.metadata.fromCache };
          // An empty answer from the local cache proves nothing; wait for the server to say so.
          if (kinds.every(k => first[k] && (first[k].server || first[k].docs.length))) {
            finish({ players: first.players.docs, fixtures: first.fixtures.docs });
          }
        } else {
          const changes = snap.docChanges().map(c => ({ type: c.type, id: c.doc.id, data: c.doc.data() }));
          if (changes.length) onChange(kind, changes);
        }
      }, fail));
    }
  });
}

function flat(f) {
  const o = {};
  for (const k of SCALARS) if (f[k] !== undefined && f[k] !== null) o[k] = f[k];
  for (const m of MAPS) for (const [pid, v] of Object.entries(f[m] || {})) if (v !== undefined && v !== null) o[m + "." + pid] = v;
  return o;
}
function fullDoc(f) {
  const d = {};
  for (const k of SCALARS) if (f[k] !== undefined && f[k] !== null) d[k] = f[k];
  for (const m of MAPS) {
    d[m] = {};
    for (const [pid, v] of Object.entries(f[m] || {})) if (v !== undefined && v !== null) d[m][pid] = v;
  }
  return d;
}

/* Writes whatever differs between prev and next ({players, fixtures}) to the team. Fire and forget. */
export function push(teamId, prev, next, onError) {
  if (!fs || !db) return;
  const ref = (kind, id) => fs.doc(db, "teams", teamId, kind, id);
  const run = p => p.catch(e => { if (e && e.code !== "not-found") onError && onError(e); });
  const byId = list => Object.fromEntries(list.map(x => [x.id, x]));

  const pp = byId(prev.players), np = byId(next.players);
  for (const p of next.players) {
    const o = pp[p.id];
    if (!o || o.name !== p.name || o.order !== p.order) run(fs.setDoc(ref("players", p.id), { name: p.name, order: p.order ?? 0 }));
  }
  for (const id in pp) if (!np[id]) run(fs.deleteDoc(ref("players", id)));

  const pf = byId(prev.fixtures), nf = byId(next.fixtures);
  for (const f of next.fixtures) {
    const o = pf[f.id];
    if (!o) { run(fs.setDoc(ref("fixtures", f.id), fullDoc(f))); continue; }
    const a = flat(o), b = flat(f), upd = {};
    for (const k in b) if (a[k] !== b[k]) upd[k] = b[k];
    for (const k in a) if (!(k in b)) upd[k] = fs.deleteField();
    if (Object.keys(upd).length) run(fs.updateDoc(ref("fixtures", f.id), upd));
  }
  for (const id in pf) if (!nf[id]) run(fs.deleteDoc(ref("fixtures", id)));
}
