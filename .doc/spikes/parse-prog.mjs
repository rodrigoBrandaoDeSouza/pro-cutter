import fs from 'node:fs'; import path from 'node:path';
const dir = process.argv[2];
const LADDER = ['1X','1Y','2X','2Y','3X','3Y','4X','4Y'];
const pieces = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.prog')).sort()) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');
  const root = Object.fromEntries([...s.match(/<com\.cutplanning\.cvl\.program ([^>]*)>/)[1].matchAll(/(\w+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
  const cuts = [...s.matchAll(/<com\.cutplanning\.cvl\.program\.cut ([^>]*)\/>/g)].map(m => Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map(x => [x[1], x[2]])));
  const sheet = { lvl: -1, x: +root.lenght, y: +root.width, kids: [] };
  const open = [sheet]; // open[i] = last node at depth
  for (const c of cuts) {
    if (c.type.startsWith('R') || c.type.endsWith('*')) continue;
    const L = LADDER.indexOf(c.type);
    // parent = nearest open node with lvl < L
    while (open.length && open.at(-1).lvl >= L) open.pop();
    let parent = open.at(-1);
    if (parent.lvl < L - 1) { // implicit intermediate (e.g. sheet starts with 1Y => implicit full 1X)
      const imp = { lvl: L - 1, x: parent.x, y: parent.y, kids: [] }; parent.kids.push(imp); open.push(imp); parent = imp;
    }
    const isX = c.type.endsWith('X');
    for (let q = 0; q < +c.quantity; q++) {
      const n = { lvl: L, x: isX ? +c.value : parent.x, y: isX ? parent.y : +c.value, kids: [] };
      parent.kids.push(n); if (q === +c.quantity - 1) open.push(n);
    }
  }
  const leaves = []; (function w(n){ if (!n.kids.length && n !== sheet) leaves.push(n); n.kids.forEach(w); })(sheet);
  console.log(`${f.replace('Everaldo cozinha.xml-','')}: ${root.lenght}x${root.width} -> ${leaves.length} pecas: ` + leaves.map(l=>`${l.x}x${l.y}`).join(' '));
  for (const l of leaves) pieces.push({ k: (root.material.includes("Linho")?"Linho ":"Branco ")+[l.x,l.y].sort((a,b)=>a-b).join("x") });
}
// compare with Promob XML
const xml = fs.readFileSync(path.join(dir, 'Everaldo cozinha.xml'), 'utf8');
const want = {};
for (const m of xml.matchAll(/<ITEM [^>]*>/g)) {
  const a = Object.fromEntries([...m[0].matchAll(/(\w+)="([^"]*)"/g)].map(x => [x[1], x[2]]));
  const k = (m[0].includes("Linho")?"Linho ":"Branco ")+[+a.WIDTH, +a.DEPTH].sort((a,b)=>a-b).join('x'); want[k] = (want[k]||0) + +a.REPETITION;
}
const got = {}; for (const p of pieces) got[p.k] = (got[p.k]||0) + 1;
const keys = new Set([...Object.keys(want), ...Object.keys(got)]);
let ok = true; for (const k of keys) if (want[k] !== got[k]) { ok = false; console.log(`DIF ${k}: xml=${want[k]||0} prog=${got[k]||0}`); }
console.log(`total xml=${Object.values(want).reduce((a,b)=>a+b)} prog=${pieces.length} -> ${ok ? 'BATE 100%' : 'diferencas acima'}`);
