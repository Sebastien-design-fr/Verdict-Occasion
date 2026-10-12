// Vérifie la recherche, la lecture d'annonce et l'évaluation. Usage : node tests/engine.test.js
const fs = require('fs');
const path = require('path');
const read = f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', f)));
const E = require('../engine.js')({ modeles: read('modeles.json').modeles, defauts: read('defauts.json').defauts, prix: read('prix_neufs.json').prix, decote: read('decote.json') });

let ko = 0;
const check = (name, cond) => { console.log(`${cond ? 'OK ' : 'KO '} ${name}`); if (!cond) ko++; };

const s1 = E.search('308 puretech 2017', 3);
check('recherche « 308 puretech 2017 » → 308 II PureTech', s1[0] && s1[0].m.id === 'peugeot-308-2' && s1[0].e.code === 'puretech-t');
const s2 = E.search('golf gti', 3);
check('recherche « golf gti » → une Golf GTI', s2[0] && s2[0].m.modele === 'Golf' && /GTI/.test(s2[0].e.libelle));
check('recherche « bmw 320d » → Série 3', E.search('bmw 320d', 1)[0].m.modele === 'Série 3');

const a1 = E.parseAd("Peugeot 308 1.2 PureTech 130ch S&S EAT8 Allure - Année 2018 - 87 500 km - Essence - Boîte automatique. Prix : 14 990 €.");
check('annonce 308 : modèle, km, prix, année, boîte auto', a1.model === 'peugeot-308-2' && a1.km === 87500 && a1.price === 14990 && a1.year === 2018 && a1.box > 0);
const a2 = E.parseAd('Vends BMW Série 4 Coupé 440i M Sport xDrive, 11/2017, 92000 km, 326 ch, BVA8. 31 500 euros. Financement possible 450 €/mois');
check('annonce 440i : moteur B58, prix hors mensualité, boîte auto', a2.model === 'bmw-serie4-f32' && E.MODELS.find(m => m.id === a2.model).moteurs[a2.eng].code === 'b58' && a2.price === 31500 && a2.box > 0);

const ev = E.evaluate({ model: 'peugeot-308-2', eng: 0, box: 0, year: 2017, km: 98000, price: 30000, maint: 'complet', treated: [] });
check('prix délirant → « Trop cher » et score plafonné', ev.v.l === 'Trop cher' && ev.score <= 25);
const before = E.evaluate({ model: 'peugeot-308-2', eng: 0, box: 0, year: 2017, km: 98000, price: 8000, maint: 'partiel', treated: [] });
const after = E.evaluate({ model: 'peugeot-308-2', eng: 0, box: 0, year: 2017, km: 98000, price: 8000, maint: 'partiel', treated: ['puretech-courroie-turbo'] });
check('facture de courroie présentée → score en hausse', after.score > before.score);

console.log(ko ? `${ko} échec(s)` : 'Tous les tests passent');
process.exit(ko ? 1 : 0);
