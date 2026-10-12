// Vérifie la cote estimée sur les cotes de marché publiques listées dans data/decote.json (« controles »).
// Usage : node tests/cote.test.js  — échoue si une estimation sort de la fourchette affichée.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(root, 'data', f)));
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const DC = read('decote.json');
const PRIX = read('prix_neufs.json').prix;
const DEFECTS = read('defauts.json').defauts;
const MODELS = read('modeles.json').modeles;
eval(src.slice(src.indexOf('function moteurFactor'), src.indexOf('const GENERIC')));

// Cas : [modèle, code moteur, code boîte, année, km, cote de marché]
const CAS = [
  ['peugeot-308-2', 'puretech-t', 'man', 2017, 107000, 7400],
  ['renault-clio-4', 'tce09', 'man', 2016, 113000, 7600],
  ['renault-clio-4', 'tce12', 'edc', 2016, 108000, 8800],
  ['toyota-yaris-3', 'toyhyb', 'ecvt', 2016, 105000, 11400],
  ['vw-golf-7', 'ea288', 'man', 2015, 153000, 9100],
  ['dacia-sandero-2', 'tce09', 'man', 2017, 101000, 6800],
  ['vw-golf-7', 'ea211', 'man', 2012, 167000, 6600],
  ['citroen-c3-2', 'puretech-a', 'man', 2016, 106000, 5000],
  ['nissan-qashqai-2', 'k9k', 'man', 2017, 137000, 11000],
  ['peugeot-3008-2', 'bluehdi16', 'man', 2017, 153000, 10600],
  ['fiat-500', 'fire12', 'man', 2015, 102000, 6700],
];

let ko = 0;
for (const [id, ec, bc, year, km, cote] of CAS) {
  const m = MODELS.find(x => x.id === id);
  const r = estimateCote(m, m.moteurs.find(x => x.code === ec), m.boites.find(x => x.code === bc), year, km);
  const ok = cote >= r.low && cote <= r.high;
  if (!ok) ko++;
  console.log(`${ok ? 'OK ' : 'KO '} ${id} ${year} ${km} km : estimé ${r.mid} € (${r.low}-${r.high}), marché ${cote} €, écart ${Math.round((r.mid / cote - 1) * 100)} %`);
}
console.log(ko ? `${ko} cas hors fourchette` : 'Tous les cas sont dans la fourchette');
process.exit(ko ? 1 : 0);
