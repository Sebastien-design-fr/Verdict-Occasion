// Vérifie la cote estimée sur les cotes de marché publiques listées dans data/decote.json (« controles »).
// Usage : node tests/cote.test.js  — échoue si une estimation sort de la fourchette affichée.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(root, 'data', f)));
const DC = read('decote.json');
const PRIX = read('prix_neufs.json').prix;
const DEFECTS = read('defauts.json').defauts;
const MODELS = read('modeles.json').modeles;
const E = require('../engine.js')({ modeles: MODELS, defauts: DEFECTS, prix: PRIX, decote: DC });

// Cas de contrôle (cotes autobiz listées dans data/decote.json) : [modèle, code moteur, index moteur ou null, boîte, année, km, cote, ch]
const CAS = require('./cote.cases.js');

let ko = 0;
for (const [id, ec, idx, bc, year, km, cote, ch] of CAS) {
  const m = MODELS.find(x => x.id === id);
  const e = idx != null ? m.moteurs[idx] : m.moteurs.find(x => x.code === ec);
  const r = E.estimateCote(m, e, m.boites.find(x => x.code === bc), year, km, ch);
  const ok = cote >= r.low && cote <= r.high;
  if (!ok) ko++;
  console.log(`${ok ? 'OK ' : 'KO '} ${id} ${ch} ch ${year} ${km} km : estimé ${r.mid} € (${r.low}-${r.high}), marché ${cote} €, écart ${Math.round((r.mid / cote - 1) * 100)} %`);
}
console.log(ko ? `${ko} cas hors fourchette` : 'Tous les cas sont dans la fourchette');
process.exit(ko ? 1 : 0);
