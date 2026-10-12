/* MecaVeya V2 — santé mécanique d'un véhicule de propriétaire, sans interface.
   createHealth({E, politiques, organes, today}) s'appuie sur le moteur existant (engine.js) :
   catalogue, défauts, applies(), estimateCote(). Rien n'est recalculé en probabilité :
   les niveaux de vigilance sont des règles explicites, décrites dans levelOf(). */
function createHealth(opts){
const E=opts.E, POL=(opts.politiques&&opts.politiques.politiques)||[], ORG=(opts.organes&&opts.organes.organes)||{};
const TODAY=opts.today?new Date(opts.today):new Date();
const {MODELS,DEFECTS,nf,eur,GL}=E;
const NA='Information non disponible';

/* Fonctions potentiellement payantes plus tard. Tout est ouvert pendant les tests :
   isUnlocked() renvoie toujours vrai. Un futur paiement n'aura qu'à changer cette fonction. */
const TIERS={
  vehicule:{tier:'gratuit'},anticiper:{tier:'gratuit'},historique:{tier:'gratuit'},
  analyse_devis:{tier:'premium',prix_envisage:9.9},
  dossier_constructeur:{tier:'premium',prix_envisage:19.9},
  rapport_exportable:{tier:'premium',prix_envisage:null}
};
const isUnlocked=feature=>true;

const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const modelOf=v=>MODELS.find(m=>m.id===v.model)||null;

/* ---- Profil du véhicule ---- */
function makeVehicle(input){
  const m=MODELS.find(x=>x.id===input.model);
  if(!m)return {ok:false,error:'Modèle inconnu dans le catalogue.'};
  const eng=Number(input.eng);
  if(!(eng>=0&&eng<m.moteurs.length))return {ok:false,error:'Motorisation inconnue pour ce modèle.'};
  const year=Number(input.year);
  if(!(year>=m.annees[0]&&year<=m.annees[1]))return {ok:false,error:`Année hors de la période de production (${m.annees[0]}–${m.annees[1]}).`};
  const km=Number(input.km);
  if(!(km>=0&&km<2000000))return {ok:false,error:'Kilométrage invalide.'};
  let box=Number(input.box);if(!(box>=0&&box<m.boites.length))box=0;
  const mec=input.mec&&/^\d{4}-\d{2}$/.test(input.mec)?input.mec:null;
  return {ok:true,v:{id:input.id||uid(),model:m.id,eng,box,year,km,kmDate:input.kmDate||TODAY.toISOString().slice(0,10),
    mec,nom:String(input.nom||'').slice(0,60),interventions:input.interventions||[],symptomes:input.symptomes||[],devis:input.devis||null,
    createdAt:input.createdAt||TODAY.toISOString()}};
}
function describe(v){
  const m=modelOf(v);if(!m)return null;
  const e=m.moteurs[v.eng]||m.moteurs[0],b=m.boites[v.box]||m.boites[0];
  return {m,e,b,name:`${m.marque} ${m.modele}`,generation:m.generation,period:`${m.annees[0]}–${m.annees[1]}`,
    engine:e.libelle,engineCode:e.code||null,fuel:e.carburant,power:e.ch||null,gearbox:b.libelle,gearboxCode:b.code,
    title:v.nom||`${m.marque} ${m.modele} ${m.generation}`};
}
/* Âge en années, au mois près si la date de mise en circulation est connue. */
function ageOf(v){
  if(v.mec){const [y,mo]=v.mec.split('-').map(Number);return {years:(TODAY.getFullYear()-y)+(TODAY.getMonth()+1-mo)/12,exact:true};}
  return {years:TODAY.getFullYear()-v.year,exact:false};
}

/* ---- Niveaux de preuve et présentation ---- */
function evidenceOf(d){
  const forums=d.sources.filter(s=>s.type==='forum').length;
  if(d.confiance==='confirmé')return {code:'confirme',label:'Défaut confirmé',
    explain:d.rappel?'Rappel officiel du constructeur.':`Décrit par au moins deux sources indépendantes${forums?', dont des témoignages de propriétaires':''}. Confirmé ne veut pas dire que tous les véhicules sont touchés.`};
  return {code:'rapporte',label:'Défaut rapporté',explain:'Une seule source ou des témoignages : à recouper. Information à prendre avec prudence.'};
}
function costOf(d){
  if(d.rappel&&d.preventif===0&&!d.cout[1])return {txt:'Rappel : intervention gratuite dans le réseau',range:null};
  const parts=[];
  if(d.cout&&d.cout[1])parts.push(`Réparation : ${nf.format(d.cout[0])} à ${eur(d.cout[1])}`);
  if(d.preventif)parts.push(`préventif : environ ${eur(d.preventif)}`);
  if(d.rappel&&d.preventif===0)parts.push('gratuit si le rappel n\'a pas été fait');
  return {txt:parts.length?parts.join(' ; ')+' (fourchette indicative)':NA,range:d.cout&&d.cout[1]?d.cout:null};
}
const organeOf=d=>ORG[d.id]||NA;
const kmText=d=>d.km?`${nf.format(d.km[0])} à ${nf.format(d.km[1])} km (plage où le défaut est le plus souvent signalé)`:NA;

/* ---- Niveaux de vigilance : rouge / orange / vert. Ce ne sont pas des probabilités.
   Rouge : symptôme déclaré par l'utilisateur, ou rappel officiel non marqué comme fait.
   Orange : défaut documenté de gravité majeure ou critique, kilométrage dans la plage documentée,
            à l'approche ou au-delà, sans intervention enregistrée.
   Vert : information, défaut mineur, kilométrage encore loin de la plage, ou intervention enregistrée. */
function levelOf(d,v){
  const sym=(v.symptomes||[]).includes(d.id);
  const iv=(v.interventions||[]).filter(i=>i.defaut===d.id).sort((a,b)=>(b.km||0)-(a.km||0));
  const last=iv[0]||null;
  if(sym)return {code:'red',label:'Vérification prioritaire',reason:'Vous avez signalé un symptôme correspondant à ce défaut. Faites établir un diagnostic.',last};
  if(d.rappel&&!last)return {code:'red',label:'Vérification prioritaire',reason:'Rappel officiel : vérifiez avec le numéro VIN qu\'il a été effectué. L\'intervention est gratuite dans le réseau.',last};
  if(last)return {code:'green',label:'Intervention enregistrée',reason:`Intervention enregistrée${last.date?' le '+fmtDate(last.date):''}${last.km?' à '+nf.format(last.km)+' km':''}. Elle ne garantit pas que le défaut ne réapparaîtra pas : restez attentif aux symptômes.`,last};
  const km=v.km||0;
  if(d.gravite===1)return {code:'green',label:'Information',reason:'Défaut de gravité mineure : à connaître, sans urgence.',last};
  if(km<d.km[0]*0.6)return {code:'green',label:'Entretien préventif',reason:`Votre kilométrage est encore loin de la plage documentée (à partir de ${nf.format(d.km[0])} km). Suivez l'entretien préconisé.`,last};
  if(km<d.km[0])return {code:'orange',label:'Point à surveiller',reason:`Votre kilométrage approche de la plage documentée (à partir de ${nf.format(d.km[0])} km).`,last};
  if(km<=d.km[1])return {code:'orange',label:'Point à surveiller',reason:'Votre kilométrage est dans la plage où ce défaut est le plus souvent signalé.',last};
  return {code:'orange',label:'Point à surveiller',reason:'Votre kilométrage dépasse la plage documentée : vérifiez si une intervention a déjà eu lieu (factures).',last};
}
const LEVEL_ORDER={red:0,orange:1,green:2};
function fmtDate(s){const [y,m,d]=String(s||'').split('-');return d?`${d}/${m}/${y}`:m?`${m}/${y}`:String(s||'');}

/* Défauts applicables au véhicule : moteur, boîte, carburant, modèle et années de production. */
function defectsFor(v){
  const x=describe(v);if(!x)return [];
  return DEFECTS.filter(d=>E.applies(d,x.m,x.e,x.b)&&(!d.annees||(v.year>=d.annees[0]&&v.year<=d.annees[1])))
    .map(d=>({d,organe:organeOf(d),evidence:evidenceOf(d),cost:costOf(d),kmText:kmText(d),gravite:GL[d.gravite],
      level:levelOf(d,v),policies:POL.filter(p=>p.defauts.includes(d.id)).map(p=>p.id)}))
    .sort((a,b)=>LEVEL_ORDER[a.level.code]-LEVEL_ORDER[b.level.code]||b.d.gravite-a.d.gravite||a.d.km[0]-b.d.km[0]);
}
/* Part du catalogue couverte : sert à rappeler qu'une absence de défaut ne prouve rien. */
const ENGINE_CODES=[...new Set(MODELS.flatMap(m=>m.moteurs.map(e=>e.code)))];
const CODES_WITH=new Set(DEFECTS.flatMap(d=>d.moteurs||[]));
const coverage={codes:ENGINE_CODES.length,sansDefaut:ENGINE_CODES.filter(c=>!CODES_WITH.has(c)).length};
function knowledge(v){
  const list=defectsFor(v);
  const checks=[...new Set(list.filter(x=>x.level.code!=='green').map(x=>x.d.controle))];
  return {list,total:list.length,confirmes:list.filter(x=>x.evidence.code==='confirme').length,
    rapportes:list.filter(x=>x.evidence.code==='rapporte').length,rappels:list.filter(x=>x.d.rappel).length,
    rouge:list.filter(x=>x.level.code==='red').length,orange:list.filter(x=>x.level.code==='orange').length,vert:list.filter(x=>x.level.code==='green').length,
    checks,empty:!list.length,
    emptyNote:`Aucun défaut documenté dans la base pour cette version. Cela ne veut pas dire qu'elle est fiable : la base est incomplète (${coverage.sansDefaut} codes moteur sur ${coverage.codes} n'ont encore aucun défaut spécifique). Suivez l'entretien préconisé par le constructeur.`};
}

/* ---- Interventions ---- */
function makeIntervention(input){
  const t=String(input.titre||'').trim();if(!t)return {ok:false,error:'Indiquez l\'intervention réalisée.'};
  const km=input.km===''||input.km==null?null:Number(input.km);
  if(km!=null&&!(km>=0&&km<2000000))return {ok:false,error:'Kilométrage invalide.'};
  const cout=input.cout===''||input.cout==null?null:Number(input.cout);
  if(cout!=null&&!(cout>=0))return {ok:false,error:'Coût invalide.'};
  const date=input.date&&/^\d{4}-\d{2}-\d{2}$/.test(input.date)?input.date:null;
  return {ok:true,i:{id:input.id||uid(),titre:t.slice(0,120),date,km,cout,commentaire:String(input.commentaire||'').slice(0,500),defaut:input.defaut||null}};
}

/* ---- Décider : analyse d'un devis ---- */
const STOP=new Set('les des une un du de la le et en au aux sur par pour avec sans qui que est sont pas plus moteur voiture panne probleme probleme mon ma mes il elle a ou'.split(' '));
function words(s){return E.norm(s).split(' ').filter(w=>w.length>=3&&!STOP.has(w));}
/* Rapprochement texte libre → défauts du véhicule, par mots communs. Ce n'est pas un diagnostic. */
function matchPanne(v,text){
  const q=words(text);if(!q.length)return [];
  return defectsFor(v).map(x=>{
    const hay=new Set(words(x.d.titre+' '+x.d.symptomes+' '+x.organe));
    const stems=[...hay].map(w=>w.slice(0,5));
    const hits=q.filter(w=>hay.has(w)||stems.includes(w.slice(0,5)));
    return {x,score:hits.length,hits};
  }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
}
/* Valeur du véhicule : saisie indépendante prioritaire, sinon estimation MecaVeya avec sa fourchette. */
function valueOf(v,userValue){
  const u=Number(userValue)||0;
  if(u>0)return {source:'utilisateur',mid:u,low:u,high:u,note:'Valeur saisie par vous (cote La Centrale, L\'argus ou offre de reprise).'};
  const x=describe(v);if(!x)return {source:'indisponible',note:NA};
  const est=E.estimateCote(x.m,x.e,x.b,v.year,v.km,0);
  if(!est)return {source:'indisponible',note:'Estimation impossible pour ce modèle : saisissez une valeur indépendante.'};
  return {source:'estimation',mid:est.mid,low:est.low,high:est.high,
    note:`Estimation MecaVeya, peu calibrée : fourchette de ${eur(est.low)} à ${eur(est.high)} (±15 %), contrôlée sur 36 cotes de marché seulement. Une cote indépendante est préférable.`};
}
function analyzeQuote(q){
  const v=q.v,x=describe(v);
  const amount=Number(q.amount)||0;
  const all=defectsFor(v);
  const sel=all.filter(a=>(q.defauts||[]).includes(a.d.id));
  const value=valueOf(v,q.userValue);
  const out={x,amount,repair:String(q.repair||''),panne:String(q.panne||''),matches:sel,suggestions:q.panne?matchPanne(v,q.panne):[],value,ratio:null,facts:[],others:[],scenarios:[],incomplete:[]};
  if(!amount)out.incomplete.push('Montant du devis');
  if(value.source==='indisponible')out.incomplete.push('Valeur du véhicule');
  if(amount&&value.mid){
    out.ratio={mid:amount/value.mid*100,low:amount/value.high*100,high:amount/value.low*100};
    const r=out.ratio.mid;
    out.facts.push(value.source==='estimation'
      ?`Le devis représente environ ${Math.round(r)} % de la valeur estimée (entre ${Math.round(out.ratio.low)} et ${Math.round(out.ratio.high)} % selon la fourchette).`
      :`Le devis représente environ ${Math.round(r)} % de la valeur que vous avez saisie.`);
    if(out.ratio.low>=100)out.facts.push('Même dans le haut de la fourchette, le devis dépasse la valeur du véhicule.');
    else if(r>=100)out.facts.push('Le devis dépasse la valeur estimée du véhicule.');
    else if(r>=50)out.facts.push('Le devis dépasse la moitié de la valeur estimée du véhicule.');
  }
  if(!sel.length)out.facts.push(q.panne||q.defauts&&q.defauts.length?'La panne décrite ne correspond à aucun défaut documenté sélectionné : cela n\'exclut rien, la base est incomplète.':'Aucune panne documentée sélectionnée.');
  else out.facts.push(`${sel.length>1?'Ces défauts sont documentés':'Ce défaut est documenté'} pour votre motorisation. Seul un diagnostic confirme qu'il s'agit bien de ${sel.length>1?'l\'un d\'eux':'lui'}.`);
  /* Autres points : listés un par un. Leurs coûts ne s'additionnent pas : rien ne dit qu'ils surviendront. */
  out.others=all.filter(a=>!sel.includes(a)&&a.level.code!=='green');
  const pol=sel.flatMap(a=>policiesFor(v,a.d.id).items);
  const anyPol=pol.some(p=>p.applies!==false&&p.policy.nature!=='position_constructeur'&&p.policy.nature!=='hors_france');
  const high=out.ratio&&out.ratio.mid>=50, low=out.ratio&&out.ratio.high<25;
  out.scenarios=[
    {id:'reparer',titre:'Réparer le véhicule',
      pour:[low?'Le devis reste une part modeste de la valeur du véhicule.':null,
        'Vous connaissez l\'historique de ce véhicule, ce qui n\'est pas le cas d\'un véhicule de remplacement.',
        anyPol?'Une politique de prise en charge du constructeur est recensée : le reste à charge pourrait baisser (voir « Agir »).':null].filter(Boolean),
      contre:[high?'Le devis représente une part importante de la valeur du véhicule.':null,
        out.others.length?`${out.others.length} autre${out.others.length>1?'s':''} point${out.others.length>1?'s':''} documenté${out.others.length>1?'s':''} à surveiller sur cette motorisation.`:null,
        !sel.length?'La panne n\'est pas rattachée à un défaut documenté : le diagnostic mérite d\'être solide.':null].filter(Boolean)},
    {id:'second_avis',titre:'Demander un second devis ou un diagnostic complémentaire',
      pour:[amount>=1500?'Le montant justifie de comparer : un autre garage peut proposer une autre réparation ou un autre prix.':'Un second avis coûte peu au regard d\'une erreur de diagnostic.',
        sel.length?'Vous pouvez demander au garage de confirmer, codes défaut à l\'appui, qu\'il s\'agit du défaut documenté.':'Un diagnostic précis peut rattacher la panne à un défaut connu, ou l\'écarter.',
        anyPol?'Pour une prise en charge constructeur, le diagnostic doit souvent être fait dans le réseau agréé, avant toute réparation.':null].filter(Boolean),
      contre:['Délai et immobilisation du véhicule.','Le diagnostic peut être facturé.'] },
    {id:'remplacer',titre:'Étudier le remplacement du véhicule',
      pour:[high?'La réparation pèse lourd face à la valeur du véhicule.':null,
        out.others.length>=2?'Plusieurs autres points documentés concernent cette motorisation.':null].filter(Boolean),
      contre:['Un véhicule de remplacement a ses propres inconnues, et son coût n\'est pas évalué ici.',
        'Vendu en panne, le véhicule perd une part de sa valeur que cette analyse ne chiffre pas.',
        anyPol?'Une prise en charge possible serait perdue si le véhicule est vendu sans démarche.':null].filter(Boolean)}
  ];
  if(!out.scenarios[2].pour.length)out.scenarios[2].pour.push('Aucun élément de cette analyse ne pousse en ce sens à ce stade.');
  out.verdict=out.incomplete.length?'Informations insuffisantes pour comparer le devis à la valeur du véhicule.':'MecaVeya ne tranche pas à votre place : ces éléments sont indicatifs et ne remplacent pas un diagnostic.';
  return out;
}

/* ---- Agir : politiques constructeur ---- */
const NATURE={extension_garantie:'Extension de garantie du constructeur',garantie_contractuelle:'Garantie commerciale du constructeur',
  geste_commercial:'Geste commercial au cas par cas (sans engagement)',position_constructeur:'Position publique du constructeur',hors_france:'Dispositif constaté hors de France'};
function policyStatus(p){
  const ver=p.derniere_verification?new Date(p.derniere_verification):null;
  const fresh=ver&&(TODAY-ver)/864e5<=365;
  const criteria=p.age_max_ans!=null||p.km_max!=null;
  if(fresh&&criteria&&['extension_garantie','garantie_contractuelle'].includes(p.nature))
    return {code:'documentee',label:'Politique documentée, critères connus à vérifier',tone:'ok'};
  return {code:'a_actualiser',label:'Politique identifiée, informations à actualiser',tone:'warn',
    why:!ver?'Cette politique n\'a pas encore été vérifiée spécifiquement : vérification nécessaire.':!fresh?`Dernière vérification le ${fmtDate(p.derniere_verification)}, il y a plus d'un an : vérification nécessaire.`:!criteria?'Critères d\'âge et de kilométrage inconnus.':NATURE[p.nature]+'.'};
}
function eligibility(p,v){
  const x=describe(v),age=ageOf(v),checks=[];
  const brandOk=!p.marques||p.marques.includes(x.m.marque);
  checks.push({label:'Marque',state:brandOk?'ok':'ko',txt:brandOk?`${x.m.marque} : concernée.`:`${x.m.marque} n'est pas citée par cette politique.`});
  if(p.age_max_ans==null)checks.push({label:'Âge maximal',state:'unknown',txt:NA});
  else{
    const a=age.years,lim=p.age_max_ans,margin=age.exact?0:1;
    checks.push({label:'Âge maximal',state:a<lim-margin?'ok':a>lim+margin?'ko':'unknown',
      txt:`${lim} ans. Votre véhicule : environ ${Math.max(0,Math.floor(a))} an${a>=2?'s':''}${age.exact?'':' (calculé sur l\'année seule : vérifiez la date de 1re mise en circulation)'}.`});
  }
  if(p.km_max==null)checks.push({label:'Kilométrage maximal',state:'unknown',txt:NA});
  else checks.push({label:'Kilométrage maximal',state:v.km<=p.km_max?'ok':'ko',txt:`${nf.format(p.km_max)} km. Votre véhicule : ${nf.format(v.km)} km.`});
  checks.push({label:'Entretien',state:'unknown',txt:p.exigences_entretien||'Exigences d\'entretien non précisées par les sources.'});
  return {checks,applies:brandOk?(checks.some(c=>c.state==='ko')?false:null):false};
}
function policiesFor(v,defectId){
  if(!v||!describe(v))return {status:{code:'insuffisant',label:'Informations insuffisantes',tone:'muted'},items:[]};
  if(!defectId)return {status:{code:'insuffisant',label:'Informations insuffisantes',tone:'muted',why:'Choisissez la panne concernée parmi les défauts documentés de votre véhicule.'},items:[]};
  const items=POL.filter(p=>p.defauts.includes(defectId)).map(p=>{const el=eligibility(p,v);return {policy:p,nature:NATURE[p.nature]||NA,status:policyStatus(p),checks:el.checks,applies:el.applies};})
    .filter(it=>it.checks[0].state!=='ko');
  if(!items.length)return {status:{code:'aucune',label:'Aucune politique recensée dans la base',tone:'muted',
    why:'L\'absence de politique recensée ne signifie pas une absence de droits : garanties légales, garantie commerciale en cours ou geste commercial restent possibles.'},items:[]};
  const best=items.find(i=>i.status.code==='documentee')||items[0];
  return {status:best.status,items};
}
const LEGAL=[
  {titre:'Garantie légale de conformité',txt:'Due par un vendeur professionnel pour un défaut existant à la livraison. Elle ne dépend pas du constructeur. Délais et conditions : à vérifier sur service-public.fr.'},
  {titre:'Garantie des vices cachés',txt:'Code civil, articles 1641 et suivants : peut viser tout vendeur, professionnel ou particulier, pour un défaut grave, caché et antérieur à la vente. Délais et preuve : à vérifier avec un professionnel du droit.'},
  {titre:'Garantie commerciale du constructeur',txt:'Garantie contractuelle dont la durée varie selon les marques : voir le carnet de garantie du véhicule.'},
  {titre:'Dispositifs commerciaux',txt:'Extensions de garantie ou gestes au cas par cas décidés par le constructeur. Ils ne remplacent pas les garanties légales et ne sont pas un droit acquis.'}
];
function documents(v,defectId,pol){
  const out=['Certificat d\'immatriculation (carte grise) et numéro VIN','Factures d\'entretien et carnet d\'entretien, dans l\'ordre chronologique',
    'Devis ou ordre de réparation détaillé, avec le diagnostic et les codes défaut relevés','Procès-verbal du dernier contrôle technique',
    'Photos ou vidéos des symptômes (voyant, fumée, bruit)','Facture d\'achat du véhicule si vous l\'avez acheté récemment'];
  (pol||[]).forEach(it=>{if(it.policy.exigences_entretien)out.push(`Exigence citée par la politique « ${it.policy.constructeur} » : ${it.policy.exigences_entretien}`);});
  const iv=(v.interventions||[]).filter(i=>i.defaut===defectId);
  if(iv.length)out.push(`Factures des interventions déjà enregistrées pour ce défaut (${iv.length})`);
  return out;
}
function garageQuestions(d,pol){
  const q=['Quel diagnostic a été réalisé, et quels codes défaut ont été relevés ?','La panne est-elle certaine, ou s\'agit-il d\'une hypothèse à confirmer ?',
    'Quelles pièces sont remplacées, et la main-d\'œuvre est-elle détaillée ?'];
  if(d)q.push(`La panne correspond-elle au défaut connu « ${d.titre} » ?`);
  if(d&&d.rappel)q.push('Le rappel officiel a-t-il été effectué sur ce véhicule (vérification par le VIN) ?');
  if(pol&&pol.length)q.push('Une prise en charge du constructeur est-elle possible ? Faut-il ouvrir la demande avant la réparation ?','Pouvez-vous transmettre le dossier au constructeur ou me remettre le diagnostic écrit ?');
  return q;
}
function letter(o){
  const x=describe(o.v),d=o.defect,p=o.policy;
  const lines=[
    '[Vos prénom et nom]','[Votre adresse]','','À l\'attention du service relations clientèle '+(p?p.constructeur:x.m.marque),'','[Lieu], le [date]','',
    'Objet : demande d\'examen d\'une prise en charge — '+x.name+' '+x.generation,'',
    'Madame, Monsieur,','',
    `Je suis propriétaire d'un véhicule ${x.name} ${x.generation}, motorisation ${x.engine}, de ${o.v.year}${o.v.mec?' (1re mise en circulation : '+fmtDate(o.v.mec)+')':''}, numéro VIN [à compléter], affichant ${nf.format(o.v.km)} km.`,'',
    d?`Le véhicule présente une panne qui semble correspondre au défaut connu suivant : « ${d.titre} ». ${o.diag?'Le diagnostic réalisé par '+o.diag+' indique : [résumé du diagnostic].':'Un diagnostic a été réalisé par [nom du garage] le [date] : [résumé du diagnostic].'}`:'Le véhicule présente la panne suivante : [description et diagnostic].','',
    o.amount?`Le devis de réparation s'élève à ${eur(o.amount)} TTC.`:'Le devis de réparation s\'élève à [montant] TTC.','',
    p?`Je sollicite l'examen d'une prise en charge au titre du dispositif suivant, tel que je le comprends : ${p.resume} Je vous remercie de me confirmer si mon véhicule y est éligible.`:'Je sollicite l\'examen d\'une prise en charge totale ou partielle de cette réparation.','',
    'Le véhicule a été entretenu selon les préconisations du constructeur. Vous trouverez ci-joint les justificatifs : [liste des pièces jointes].','',
    'Dans l\'attente de votre réponse, je vous prie d\'agréer, Madame, Monsieur, mes salutations distinguées.','','[Signature]'];
  return lines.join('\n');
}

return {TIERS,isUnlocked,NA,makeVehicle,describe,ageOf,defectsFor,knowledge,levelOf,evidenceOf,costOf,organeOf,coverage,
  makeIntervention,matchPanne,valueOf,analyzeQuote,policyStatus,policiesFor,eligibility,LEGAL,NATURE,documents,garageQuestions,letter,fmtDate,POL};
}
if(typeof module!=='undefined')module.exports=createHealth;
