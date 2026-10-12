/* MecaVeya — moteur d'évaluation, sans interface.
   createEngine(DATA) reçoit {modeles, defauts, prix, decote, version} et renvoie les fonctions de calcul.
   Utilisé par ui.js dans le navigateur et par tests/*.test.js sous Node. */
function createEngine(DATA){
const MODELS=DATA.modeles, DEFECTS=DATA.defauts, PRIX=DATA.prix||{}, DC=DATA.decote;
const NOW=new Date().getFullYear();
const GL={1:'Mineure',2:'Majeure',3:'Critique'};
const PF={1:.15,2:.3,3:.5};
const nf=new Intl.NumberFormat('fr-FR');
const eur=n=>nf.format(Math.round(n))+' €';

/* Facteur moteur : type de carburant × puissance. Le prix neuf d'une version croît avec sa puissance
   (exposant calé sur des cotes de marché) : une 440i de 326 ch ne coûte pas le prix d'une 418i de 136 ch. */
function moteurFactor(e,ch){
  const M=DC.moteurs,P=DC.puissance;
  let f;
  if(e.carburant==='Électrique')f=M.electrique;
  else if(e.carburant==='Hybride')f=M.hybride;
  else{f=e.carburant==='Diesel'?M.diesel:M.turbo_essence;if(M.codes_base.includes(e.code))f=M.base;}
  const c=ch||e.ch;
  if(P&&c&&e.carburant!=='Électrique')f*=Math.pow(c/P.reference,P.exposant*(e.carburant==='Hybride'?0.5:1));
  return f;
}
/* Les versions puissantes et les sportives perdent moins de valeur. */
function maintienPuissance(e,ch){
  const P=DC.puissance,c=ch||e.ch;
  if(!P||!c||e.carburant==='Électrique'||e.carburant==='Hybride')return 1;
  return (1+P.maintien*Math.max(0,Math.log(c/P.reference)))*(e.sport?P.bonus_sportive:1);
}
/* Cote estimée : prix neuf de référence × finition × motorisation × décote × kilométrage × marque.
   Paramètres dans data/decote.json, calés sur des cotes de marché publiques. */
function estimateCote(m,e,b,year,km,ch){
  const ref=PRIX[m.id];if(!DC||!ref||!year)return null;
  const fmin=Math.min(...m.moteurs.map(x=>moteurFactor(x,ref.ch?Math.max(x.ch||0,ref.ch):0)));
  const auto=!['man','ev','ecvt'].includes(b.code);
  const neuf=ref.entree*DC.finition_moyenne*moteurFactor(e,ch)/fmin*(auto?DC.boite_auto:1);
  const now=new Date(),a=Math.max(0.2,now.getFullYear()+now.getMonth()/12-(year+0.5));
  const C=DC.courbe;
  let D=a<1?1-(1-C.premiere_annee)*a:C.premiere_annee*Math.pow(C.annuelle_jusqu_a_5_ans,Math.min(a,5)-1)*Math.pow(C.annuelle_apres_5_ans,Math.max(0,a-5));
  if(e.carburant==='Électrique')D*=C.electrique;
  const K=Math.max(DC.km.min,Math.min(DC.km.max,1-DC.km.par_10000_km*(km-a*DC.km.moyenne_annuelle)/10000));
  const crit=DEFECTS.some(d=>d.confiance==='confirmé'&&d.gravite===3&&d.frequence===3&&!d.rappel&&(d.moteurs||[]).includes(e.code)&&(!d.annees||(year>=d.annees[0]&&year<=d.annees[1])));
  const mid=neuf*D*K*maintienPuissance(e,ch)*(DC.marques[m.marque]||1)*(DC.modeles[m.id]||1)*(crit?DC.defaut_critique:1);
  const r=x=>Math.round(x/100)*100;
  return {mid:r(mid),low:r(mid*(1-DC.fourchette)),high:r(mid*(1+DC.fourchette)),neuf:r(neuf),neufEstime:!!ref.estime,crit};
}

/* Un défaut vise des moteurs, des boîtes ou un carburant. S'il liste aussi des modèles,
   il ne concerne que ces modèles (ex. rappel propre au C-HR hybride). */
function applies(d,model,eng,box){
  const tech=d.moteurs||d.boites||d.carburant;
  const techOK=(d.moteurs&&eng&&d.moteurs.includes(eng.code))||(d.carburant&&eng&&d.carburant===eng.carburant)
    ||(d.boites&&box&&d.boites.includes(box.code));
  const modOK=d.modeles?d.modeles.includes(model.id):true;
  return tech?(!!techOK&&modOK):(!!d.modeles&&modOK);
}
function zone(km,r){
  if(km<r[0]*0.6) return {f:.35,cls:'later',l:'Avant la plage documentée'};
  if(km<r[0]) return {f:.7,cls:'near',l:'Approche de la plage documentée'};
  if(km<=r[1]) return {f:1,cls:'in',l:'Dans la plage documentée'};
  return {f:.6,cls:'past',l:'Au-delà de la plage documentée : vérifier si déjà traité'};
}
/* Analyse du prix : on compare le « prix réel » (prix demandé + frais à prévoir) à la cote.
   Un prix délirant plafonne le score, quel que soit l'état mécanique. */
function pricing(price,cote,exp){
  if(!price||!cote)return null;
  const real=price+exp, e=(real-cote)/cote, raw=(price-cote)/cote;
  let p;
  if(raw<-0.35)p={pts:-10,label:'Anormalement bas',tone:'warn',cap:55,note:`Prix inférieur de ${Math.round(-raw*100)} % à la cote : vérifiez l'historique (sinistre, kilométrage, gage) et méfiez-vous des arnaques au faux vendeur ou au faux acompte.`};
  else if(e<=-0.10)p={pts:8,label:'Bonne affaire',tone:'ok'};
  else if(e<=0.05)p={pts:0,label:'Prix cohérent',tone:'ok'};
  else if(e<=0.15)p={pts:-10,label:'Un peu cher',tone:'warn'};
  else if(e<=0.30)p={pts:-25,label:'Cher',tone:'crit'};
  else p={pts:-40,label:'Prix délirant',tone:'crit',cap:25,note:`En comptant les frais à prévoir, ce véhicule revient ${Math.round(e*100)} % au-dessus de la cote. Même en parfait état, il ne vaut pas ce prix.`};
  return {...p,real,e,raw};
}
const label=m=>`${m.marque} ${m.modele} ${m.generation}`;
const shortEngine=e=>e.libelle.replace(/\s*\(.*?\)\s*/g,' ').replace(/\s+/g,' ').trim();

/* Évaluation complète d'une annonce. s = {model, eng, box, year, km, price, cote, ch, maint, treated[]} */
function evaluate(s){
  const m=MODELS.find(x=>x.id===s.model);if(!m)return null;
  const e=m.moteurs[s.eng]||m.moteurs[0],b=m.boites[s.box]||m.boites[0];
  const km=Number(s.km)||0,year=Number(s.year)||m.annees[1],treated=s.treated||[];
  const list=DEFECTS.filter(d=>applies(d,m,e,b)&&(!d.annees||(year>=d.annees[0]&&year<=d.annees[1]))).map(d=>{
    const z=zone(km,d.km);const done=treated.includes(d.id);
    const w=d.confiance==='confirmé'?1:0.6;
    /* Un rappel se règle gratuitement en concession : il pèse peu dans le score, il faut surtout le vérifier. */
    const risk=d.gravite*d.frequence*z.f*w*(d.rappel?0.3:1);
    const exp=done?0:(d.preventif!=null?d.preventif*z.f:((d.cout[0]+d.cout[1])/2)*PF[d.frequence]*z.f*w);
    return {...d,z,done,risk,exp};
  }).sort((a,b)=>(a.done-b.done)||(b.risk-a.risk));
  let score=100;list.forEach(d=>{if(!d.done)score-=d.risk*3.5;});
  const maint=s.maint||'partiel';
  score-={complet:0,partiel:8,aucun:18}[maint];
  const age=Math.max(1,NOW-year+0.5),kmy=km/age;
  const notes=[];
  if(kmy>25000){score-=6;notes.push({tone:'warn',tag:'Kilométrage',t:`Kilométrage élevé pour l'âge : environ ${nf.format(Math.round(kmy/1000)*1000)} km par an. Usure générale (trains roulants, embrayage, amortisseurs) à surveiller.`});}
  if(km>0&&kmy<5000)notes.push({tone:'warn',tag:'Kilométrage',t:`Kilométrage très faible pour l'âge : environ ${nf.format(Math.round(kmy/100)*100)} km par an. Vérifiez la cohérence des relevés sur HistoVec et les contrôles techniques.`});
  if(maint==='aucun')notes.push({tone:'warn',tag:'Entretien',t:'Aucun historique d\'entretien : les défauts liés à la qualité de l\'huile et aux intervalles de vidange sont plus difficiles à écarter.'});
  const mec=Math.max(5,Math.min(100,Math.round(score)));
  const exp=list.reduce((t,d)=>t+d.exp,0);
  const ch=Number(s.ch)||0;
  const est=estimateCote(m,e,b,year,km,ch);
  const userCote=Number(s.cote)||0, price=Number(s.price)||0;
  const cote=userCote||(est?est.mid:0), coteSrc=userCote?'saisie':'estimée';
  const pr=pricing(price,cote,exp);
  let fin=mec;
  if(pr){fin=Math.min(100,mec+pr.pts);if(pr.cap!=null)fin=Math.min(fin,pr.cap);}
  fin=Math.max(5,Math.round(fin));
  let v=fin>=70?{l:'Bon achat',tone:'ok'}:fin>=45?{l:'À négocier',tone:'warn'}:{l:'Risqué',tone:'crit'};
  if(pr&&pr.label==='Prix délirant')v={l:'Trop cher',tone:'crit'};
  const base=cote?Math.min(price,cote):price;
  const target=price?Math.max(0,Math.round((base-exp)/50)*50):0;
  return {m,e,b,km,year,ch:ch||e.ch,maint,list,score:fin,mec,pr,exp,v,notes,est,cote,coteSrc,price,target};
}

/* Les raisons du verdict, les plus lourdes d'abord (écran « Pourquoi »). */
function reasons(r){
  const out=[];
  const open=r.list.filter(d=>!d.done);
  open.filter(d=>!d.rappel&&d.gravite>=2).slice(0,2).forEach(d=>{
    const cost=d.preventif?`environ ${eur(d.preventif)} de préventif à prévoir`:`réparation de ${nf.format(d.cout[0])} à ${eur(d.cout[1])} si le défaut survient`;
    out.push({tone:d.gravite===3?'crit':'warn',tag:GL[d.gravite],t:`${d.titre} : ${d.z.l.toLowerCase()}, ${cost}.`});
  });
  if(r.pr){
    const p=Math.round(r.pr.e*100);
    out.push({tone:r.pr.tone,tag:'Prix',t:r.pr.note||(p>0?`Frais compris, la voiture revient ${p} % au-dessus de la cote (${eur(r.cote)}).`:p<0?`Frais compris, la voiture revient ${-p} % sous la cote (${eur(r.cote)}).`:`Le prix est aligné sur la cote (${eur(r.cote)}).`)});
  }
  const rap=open.filter(d=>d.rappel);
  if(rap.length)out.push({tone:'info',tag:'Rappel',t:`${rap.length>1?rap.length+' rappels officiels':'Rappel officiel'} : ${rap.map(d=>d.titre.replace(/\s*\((rappel|rappels).*?\)/i,'')).join(' ; ')}. À vérifier avec le numéro VIN, gratuit s'il n'a pas été fait.`});
  r.notes.forEach(n=>out.push(n));
  if(!open.length)out.push({tone:r.list.length?'ok':'info',tag:'Mécanique',t:r.list.length?'Les défauts connus de cette version sont traités, factures à l\'appui.':'Aucun défaut répertorié pour cette version à ce stade de la base, ce qui ne prouve pas sa fiabilité. Les contrôles de la visite restent indispensables.'});
  return out.slice(0,5);
}

/* Argumentaire de négociation à envoyer au vendeur. */
function argument(r){
  const open=r.list.filter(d=>!d.done);
  const argDefs=open.filter(d=>d.cout[1]>0&&!(d.rappel&&d.preventif===0)).slice(0,4);
  const overCote=r.cote&&r.price>r.cote;
  if(!r.price||!(argDefs.length||overCote)||r.target>=r.price)return null;
  const pct=x=>(x>0?'+':'')+Math.round(x*100)+' %';
  const parts=[];
  if(overCote)parts.push(`La cote de ce véhicule pour cette version, cette année et ce kilométrage est d'environ ${eur(r.cote)}, soit ${pct((r.price-r.cote)/r.cote)} par rapport à votre prix.`);
  if(argDefs.length)parts.push(`Il est aussi concerné par des défauts connus sur ce modèle, sans facture de traitement à ce jour :\n${argDefs.map(d=>`– ${d.titre.replace(/\s*\(.*?\)\s*$/,'')} : ${d.preventif?'intervention préventive d\'environ '+nf.format(d.preventif)+' €':'réparation estimée entre '+nf.format(d.cout[0])+' et '+nf.format(d.cout[1])+' €'}`).join('\n')}`);
  return `Bonjour,\n\nJe suis intéressé par votre ${label(r.m)} ${shortEngine(r.e)} de ${r.year} (${nf.format(r.km)} km).\n\n${parts.join('\n\n')}\n\nCompte tenu de ces éléments, je vous propose ${eur(r.target)}.\n\nCordialement`;
}

/* ---- Recherche et lecture d'annonce ---- */
const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9.+]+/g,' ').trim();
const MODEL_KEYS=MODELS.map(m=>({m,brand:norm(m.marque),name:norm(m.modele).replace(/\s*\/.*$/,''),names:norm(m.modele).split(/\s+(?=[a-z])|\s*\/\s*/).filter(Boolean),gen:norm(m.generation)}));
function defectCount(m,e){
  return DEFECTS.filter(d=>m.boites.some(b=>applies(d,m,e,b))||applies(d,m,e,null)).length;
}
/* Recherche libre : « 308 puretech 2017 », « golf tdi », « bmw 320d ». Renvoie modèle + moteur. */
function search(q,limit=12){
  const toks=norm(q).split(' ').filter(Boolean);if(!toks.length)return [];
  const year=toks.map(Number).find(n=>n>=1990&&n<=NOW+1);
  const words=toks.filter(t=>!(Number(t)>=1990&&Number(t)<=NOW+1));
  const out=[];
  for(const k of MODEL_KEYS){
    const m=k.m;
    if(year&&(year<m.annees[0]||year>m.annees[1]))continue;
    m.moteurs.forEach((e,i)=>{
      const hay=' '+[k.brand,norm(m.modele),k.gen,norm(e.libelle),norm(e.carburant)].join(' ')+' ';
      let score=0;
      for(const w of words){
        if(hay.includes(' '+w+' '))score+=3;else if(hay.includes(' '+w)||hay.includes(w))score+=1;else{score=-1;break;}
        if(k.name===w||k.names.includes(w))score+=4;
      }
      if(score>=0)out.push({m,i,e,score:score+(year?1:0)-(NOW-m.annees[1])*0.02});
    });
  }
  out.sort((a,b)=>b.score-a.score);
  return out.slice(0,limit).map(x=>({...x,year}));
}
/* Lecture d'un texte d'annonce collé : modèle, moteur, année, km, prix, boîte, puissance. */
function parseAd(text){
  const raw=String(text||''),t=' '+norm(raw)+' ';
  const res={found:[]};
  const num=x=>Number(String(x).replace(/[ .  ]/g,''));
  const kmM=raw.match(/(\d{1,3}(?:[ .  ]\d{3})+|\d{4,6})\s*(?:km|kms|kilom)/i);
  if(kmM){res.km=num(kmM[1]);res.found.push('kilométrage');}
  const prices=[...raw.matchAll(/(\d{1,3}(?:[ .  ]\d{3})+|\d{4,6})(?:[,.]\d{2})?\s*(?:€|eur\b|euros)(?!\s*\/\s*mois|\s*par\s*mois)/gi)].map(x=>num(x[1])).filter(n=>n>=500&&n<=400000);
  if(prices.length){res.price=prices[0];res.found.push('prix');}
  const yM=raw.match(/(?:ann[ée]e|mise en (?:circulation|service)|mec|modèle)\D{0,20}(?:\d{2}\/)?((?:19|20)\d{2})/i)||raw.match(/\b(?:\d{2}\/)?((?:19[89]|20[0-2])\d)\b/);
  if(yM){const y=Number(yM[1]);if(y>=1990&&y<=NOW+1){res.year=y;res.found.push('année');}}
  const chM=raw.match(/(\d{2,3})\s*(?:ch|cv din|chevaux)\b/i)||raw.match(/\b(?:puretech|bluehdi|e-hdi|hdi|tce|blue dci|dci|tdi|tsi|tfsi|ecoboost|tdci|crdi|cdti|multijet|vti|thp|d-4d|skyactiv-[gd]|t-gdi|gdi)\s*(\d{2,3})\b/i);
  if(chM&&Number(chM[1])>=50){res.ch=Number(chM[1]);res.found.push('puissance');}
  const fuel=/electrique|100 ?% electrique|\bev\b/.test(t)?'Électrique':/hybride|hybrid|e-tech|phev|e:hev/.test(t)?'Hybride':/diesel|gazole|\bhdi|bluehdi|\btdi|\bdci|crdi|cdti|tdci|d-4d|multijet|\b\d{3}d\b|\b\d{2}d\b/.test(t)?'Diesel':/essence|\btsi|\btfsi|puretech|\btce|ecoboost|\bvti|\bthp|\b\d{3}i\b/.test(t)?'Essence':null;
  if(fuel)res.fuel=fuel;
  let best=null;
  for(const k of MODEL_KEYS){
    const m=k.m;let s=0;
    if(t.includes(' '+k.brand+' '))s+=3;
    const nameHit=k.names.some(n=>n.length>1&&t.includes(' '+n+' '));
    if(!nameHit)continue;
    s+=5;
    if(res.year){if(res.year>=m.annees[0]&&res.year<=m.annees[1])s+=3;else s-=6;}
    let bi=0,bs=-99;
    m.moteurs.forEach((e,i)=>{
      let es=0;
      const toks=norm(e.libelle).split(' ').filter(w=>w.length>=3&&!/^\d+$/.test(w)&&!['moteur','trois','cylindres','hybride','leger','rechargeable','essence','diesel','generation','puis'].includes(w));
      toks.forEach(w=>{if(t.includes(' '+w+' '))es+=2;});
      if(fuel)es+=e.carburant===fuel?3:-4;
      if(res.ch&&e.ch)es-=Math.abs(e.ch-res.ch)/40;
      if(es>bs){bs=es;bi=i;}
    });
    s+=Math.max(0,bs)*0.5;
    if(!best||s>best.s)best={s,m,i:bi};
  }
  if(best){
    res.model=best.m.id;res.eng=best.i;res.found.unshift('modèle');
    const m=best.m;
    const auto=/automatique|\bbva\d?\b|\bdsg|\bedc\b|\beat ?[68]|s ?tronic|steptronic|tiptronic|\bcvt\b|e ?cvt|xtronic|\bauto\b|7g|9g|geartronic|powershift/.test(t);
    const manu=/manuelle|\bbvm\b|boite meca|mecanique/.test(t);
    if(auto){const i=m.boites.findIndex(b=>b.code!=='man');if(i>=0){res.box=i;res.found.push('boîte');}}
    else if(manu){const i=m.boites.findIndex(b=>b.code==='man');if(i>=0){res.box=i;res.found.push('boîte');}}
  }
  return res;
}

return {MODELS,DEFECTS,PRIX,DC,NOW,GL,nf,eur,label,shortEngine,norm,moteurFactor,maintienPuissance,estimateCote,applies,zone,pricing,evaluate,reasons,argument,search,parseAd,defectCount};
}
if(typeof module!=='undefined')module.exports=createEngine;
