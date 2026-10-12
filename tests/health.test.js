// MecaVeya V2 : véhicule du propriétaire, vigilance, devis, prises en charge, stockage. Usage : node tests/health.test.js
const fs=require('fs');
const path=require('path');
const read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data',f)));
const E=require('../engine.js')({modeles:read('modeles.json').modeles,defauts:read('defauts.json').defauts,prix:read('prix_neufs.json').prix,decote:read('decote.json')});
const createHealth=require('../health.js');
const createStore=require('../store.js');
const POL=read('politiques.json'),ORG=read('organes.json');
const H=createHealth({E,politiques:POL,organes:ORG,today:'2026-10-12'});

let ko=0;
const check=(name,cond)=>{console.log(`${cond?'OK ':'KO '} ${name}`);if(!cond)ko++;};
const engIdx=(model,code)=>E.MODELS.find(m=>m.id===model).moteurs.findIndex(e=>e.code===code);
const veh=(o)=>{const r=H.makeVehicle(o);if(!r.ok)throw new Error(r.error);return r.v;};

/* Correspondance modèle / motorisation */
const s=E.search('308 puretech 2018',1)[0];
const v308=veh({model:s.m.id,eng:s.i,year:2018,km:112000});
check('recherche « 308 puretech 2018 » → 308 II, moteur puretech-t', H.describe(v308).engineCode==='puretech-t'&&H.describe(v308).generation==='II');
check('année hors production refusée', !H.makeVehicle({model:'peugeot-308-2',eng:0,year:2005,km:1000}).ok);
check('motorisation inexistante refusée', !H.makeVehicle({model:'peugeot-308-2',eng:99,year:2018,km:1000}).ok);
check('kilométrage invalide refusé', !H.makeVehicle({model:'peugeot-308-2',eng:0,year:2018,km:-5}).ok);
check('modèle inconnu refusé', !H.makeVehicle({model:'xx',eng:0,year:2018,km:0}).ok);

/* Défauts applicables et années de production */
const ids=H.defectsFor(v308).map(x=>x.d.id);
check('308 II PureTech 2018 : courroie et huile documentées', ids.includes('puretech-courroie-turbo')&&ids.includes('puretech-huile-turbo'));
check('rappel pompe à vide (2013-2017) exclu pour une 2018', !ids.includes('puretech-pompe-vide'));
const v2016=veh({model:'peugeot-308-2',eng:engIdx('peugeot-308-2','puretech-t'),year:2016,km:60000});
const k16=H.knowledge(v2016);
check('308 PureTech 2016 : rappel recensé et en rouge tant qu\'il n\'est pas marqué fait', k16.rappels===1&&k16.list.find(x=>x.d.id==='puretech-pompe-vide').level.code==='red');
check('chaque défaut porte un organe, une preuve, un coût et des sources', k16.list.every(x=>x.organe&&x.evidence.label&&x.cost.txt&&x.d.sources.length));

/* Moteur sans défaut documenté */
const codesWith=new Set(E.DEFECTS.flatMap(d=>d.moteurs||[]));
let empty=null;
for(const m of E.MODELS){for(let i=0;i<m.moteurs.length&&!empty;i++){const v=veh({model:m.id,eng:i,year:m.annees[0],km:50000,box:m.boites.findIndex(b=>b.code==='man')>=0?m.boites.findIndex(b=>b.code==='man'):0});
  if(!codesWith.has(m.moteurs[i].code)&&!H.defectsFor(v).length)empty=v;}if(empty)break;}
const ke=H.knowledge(empty);
check('moteur sans défaut : liste vide et message « ne veut pas dire qu\'elle est fiable »', ke.empty&&/ne veut pas dire qu'elle est fiable/.test(ke.emptyNote));

/* Plusieurs défauts et plages kilométriques */
let many=null;
for(const m of E.MODELS){for(let i=0;i<m.moteurs.length;i++){const v=veh({model:m.id,eng:i,year:Math.min(m.annees[1],Math.max(m.annees[0],2014)),km:100000});if(H.defectsFor(v).length>=4){many=v;break;}}if(many)break;}
check('véhicule avec au moins 4 défauts trouvé et trié rouge → orange → vert', many&&(()=>{const o={red:0,orange:1,green:2};const l=H.defectsFor(many).map(x=>o[x.level.code]);return l.every((x,i)=>!i||l[i-1]<=x);})());
const d=E.DEFECTS.find(x=>x.id==='puretech-courroie-turbo');
const at=km=>H.levelOf(d,{km,interventions:[],symptomes:[]}).code;
check('plages : loin avant → vert, approche → orange, dans → orange, au-delà → orange', at(10000)==='green'&&at(40000)==='orange'&&at(100000)==='orange'&&at(200000)==='orange');
const minor=E.DEFECTS.find(x=>x.gravite===1&&!x.rappel);
check('défaut mineur → vert (information)', H.levelOf(minor,{km:minor.km[0],interventions:[],symptomes:[]}).code==='green');

/* Interventions et symptômes */
const iv=H.makeIntervention({titre:'Courroie remplacée',date:'2026-09-01',km:110000,cout:1150,defaut:'puretech-courroie-turbo'});
check('intervention valide créée', iv.ok&&iv.i.km===110000&&iv.i.defaut==='puretech-courroie-turbo');
check('intervention sans titre refusée', !H.makeIntervention({titre:' '}).ok);
const vIv={...v308,interventions:[iv.i]};
const lvIv=H.defectsFor(vIv).find(x=>x.d.id==='puretech-courroie-turbo').level;
check('intervention liée → vert, avec rappel qu\'elle ne garantit rien', lvIv.code==='green'&&/ne garantit pas/.test(lvIv.reason));
const vSym={...vIv,symptomes:['puretech-courroie-turbo']};
check('symptôme signalé → rouge, même après intervention', H.defectsFor(vSym).find(x=>x.d.id==='puretech-courroie-turbo').level.code==='red');

/* Devis et valeur */
const q=H.analyzeQuote({v:v308,amount:2400,defauts:['puretech-courroie-turbo'],panne:'courroie voyant huile'});
check('devis : ratio calculé sur la valeur estimée, avec fourchette', q.value.source==='estimation'&&Math.abs(q.ratio.mid-2400/q.value.mid*100)<1e-9&&q.ratio.low<q.ratio.mid&&q.ratio.high>q.ratio.mid);
check('devis : valeur saisie prioritaire sur l\'estimation', (()=>{const r=H.analyzeQuote({v:v308,amount:3000,userValue:6000,defauts:[]});return r.value.source==='utilisateur'&&Math.round(r.ratio.mid)===50;})());
check('devis : trois scénarios avec arguments pour et contre', q.scenarios.length===3&&q.scenarios.every(s=>s.pour.length&&s.contre.length));
check('devis : autres points listés sans addition de coûts', q.others.every(x=>x.d.id!=='puretech-courroie-turbo')&&!('total' in q)&&!q.facts.some(f=>/total|au total/i.test(f)));
check('devis : texte libre rapproché de la courroie', q.suggestions[0]&&q.suggestions[0].x.d.id==='puretech-courroie-turbo');
check('devis incomplet : montant manquant signalé', H.analyzeQuote({v:v308,amount:0,defauts:[]}).incomplete.includes('Montant du devis'));
check('devis : jamais de verdict catégorique', !/vous devez|il faut réparer|il faut vendre/i.test(JSON.stringify(q.scenarios)+q.verdict));

/* Prises en charge */
const p1=H.policiesFor(v308,'puretech-courroie-turbo');
check('PureTech : politique documentée, critères âge et km remplis', p1.status.code==='documentee'&&p1.items[0].checks.find(c=>c.label==='Kilométrage maximal').state==='ok'&&p1.items[0].checks.find(c=>c.label==='Âge maximal').state==='ok');
const vOld=veh({model:'peugeot-308-2',eng:engIdx('peugeot-308-2','puretech-t'),year:2014,km:190000});
check('PureTech 2014 à 190 000 km : âge et kilométrage non remplis', (()=>{const c=H.policiesFor(vOld,'puretech-courroie-turbo').items[0].checks;return c.find(x=>x.label==='Kilométrage maximal').state==='ko'&&c.find(x=>x.label==='Âge maximal').state==='ko';})());
check('âge à la limite sans date de mise en circulation → à vérifier', (()=>{const v=veh({model:'peugeot-308-2',eng:engIdx('peugeot-308-2','puretech-t'),year:2016,km:90000});return H.policiesFor(v,'puretech-courroie-turbo').items[0].checks.find(x=>x.label==='Âge maximal').state==='unknown';})());
check('politique jamais vérifiée → « informations à actualiser »', H.policiesFor(veh({model:'renault-clio-4',eng:engIdx('renault-clio-4','tce12'),year:2014,km:90000}),'tce12-huile').status.code==='a_actualiser');
const Hlater=createHealth({E,politiques:POL,organes:ORG,today:'2028-06-01'});
check('politique vérifiée il y a plus d\'un an → à actualiser', Hlater.policiesFor(v308,'puretech-courroie-turbo').status.code==='a_actualiser');
check('défaut sans politique → « aucune » et rappel des droits', (()=>{const r=H.policiesFor(v2016,'puretech-pompe-vide');return r.status.code==='aucune'&&/ne signifie pas une absence de droits/.test(r.status.why);})());
check('aucune panne choisie → informations insuffisantes', H.policiesFor(v308,null).status.code==='insuffisant');
const hy=E.MODELS.find(m=>m.marque==='Hyundai'&&m.boites.some(b=>b.code==='dct7'));
check('politique Kia non proposée pour une Hyundai à même boîte', !hy||(()=>{const v=veh({model:hy.id,eng:0,box:hy.boites.findIndex(b=>b.code==='dct7'),year:Math.max(hy.annees[0],2016),km:60000});return H.policiesFor(v,'dct7-vibrations').status.code==='aucune';})());
check('courrier factuel : véhicule et défaut cités, aucune affirmation de droit', (()=>{const t=H.letter({v:v308,defect:d,policy:p1.items[0].policy,amount:2400});return t.includes('Peugeot 308')&&t.includes(d.titre)&&/sollicite l'examen/.test(t)&&!/vous êtes tenu|j'ai droit/i.test(t);})());
check('politiques : toutes rattachées à des défauts existants et sourcées', POL.politiques.every(p=>p.defauts.every(id=>E.DEFECTS.some(x=>x.id===id))&&p.sources.length&&p.sources.every(s=>s.url)));
check('fonctions premium ouvertes pendant les tests', H.isUnlocked('analyse_devis')&&H.isUnlocked('dossier_constructeur'));

/* Stockage local, export, import */
const mem={};const storage={getItem:k=>mem[k]??null,setItem:(k,v)=>{mem[k]=String(v);}};
const S=createStore({storage,models:E.MODELS});
const st={...S.empty(),vehicles:[vIv],activeId:vIv.id};
check('sauvegarde puis relecture identiques', S.save(st)&&JSON.stringify(S.load().state.vehicles[0])===JSON.stringify(S.validate(st).data.vehicles[0]));
const exp=S.exportJSON(st);
const imp=S.importJSON(exp);
check('export puis import : véhicule et intervention conservés', imp.ok&&imp.data.vehicles.length===1&&imp.data.vehicles[0].interventions[0].titre==='Courroie remplacée');
check('import d\'un JSON invalide refusé', !S.importJSON('{oups').ok);
check('import d\'un fichier étranger refusé', !S.importJSON('{"a":1}').ok);
const bad=JSON.parse(exp);bad.vehicles.push({id:'x',model:'inconnu',eng:0,km:1});
const ib=S.importJSON(JSON.stringify(bad));
check('import : véhicule hors catalogue ignoré avec avertissement', ib.ok&&ib.data.vehicles.length===1&&ib.warnings.length===1);
check('stockage indisponible : état vide sans plantage', (()=>{const S2=createStore({storage:{getItem(){throw new Error('x');},setItem(){throw new Error('x');}},models:E.MODELS});return S2.load().state.vehicles.length===0&&S2.save(st)===false;})());

/* Rigueur : aucun pourcentage de risque ni probabilité affichée */
const src=['health.js','owner.js'].map(f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8')).join('\n');
check('aucun « % de risque » ni « probabilité de panne » affirmée dans les écrans V2', !/%\s*de\s*(risque|chance)/i.test(src)&&!/probabilité de panne (est|de)/i.test(src));
check('organes : chaque défaut en a un', E.DEFECTS.every(x=>ORG.organes[x.id]));

console.log(ko?`${ko} échec(s)`:'Tous les tests passent');
process.exit(ko?1:0);
