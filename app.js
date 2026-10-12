/* Verdict Occasion — moteur d'évaluation. Les données viennent de data/modeles.json et data/defauts.json. */
(async function(){
const $=s=>document.querySelector(s);
let DATA=window.VO_DATA;
if(!DATA){
  try{
    const [m,d]=await Promise.all([fetch('data/modeles.json').then(r=>r.json()),fetch('data/defauts.json').then(r=>r.json())]);
    DATA={modeles:m.modeles,defauts:d.defauts,version:d.version};
  }catch(e){$('#report').innerHTML='<div class="alert warn">Impossible de charger la base de défauts (dossier data/).</div>';return;}
}
const MODELS=DATA.modeles, DEFECTS=DATA.defauts;

const GENERIC=[
 'Contrôle technique de moins de 6 mois remis par le vendeur (obligatoire pour un véhicule de plus de 4 ans)',
 'Rapport HistoVec : historique des propriétaires, sinistres et kilométrages relevés',
 'Rappels constructeur effectués, vérifiés avec le numéro VIN',
 'Carnet et factures d\'entretien cohérents avec le kilométrage',
 'Aucun voyant allumé moteur tournant',
 'Pneus de même marque et usure régulière, freins sans vibration'
];
const nf=new Intl.NumberFormat('fr-FR');
const eur=n=>nf.format(Math.round(n))+' €';
const range=r=>r[1]===0?'Sans frais':nf.format(r[0])+' à '+nf.format(r[1])+' €';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const GL={1:'Mineure',2:'Majeure',3:'Critique'};
const PF={1:.15,2:.3,3:.5};
const NOW=new Date().getFullYear();

$('#stats').textContent=`${MODELS.length} modèles · ${DEFECTS.length} défauts répertoriés, dont ${DEFECTS.filter(d=>d.confiance==='confirmé').length} confirmés`;

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
  if(km<r[0]*0.6) return {f:.35,cls:'z-later',l:'Risque à venir'};
  if(km<r[0]) return {f:.7,cls:'z-soon',l:'Zone de risque proche'};
  if(km<=r[1]) return {f:1,cls:'z-in',l:'Dans la zone de risque'};
  return {f:.6,cls:'z-past',l:'Au-delà de la zone : vérifier si déjà traité'};
}
const label=m=>`${m.marque} ${m.modele} ${m.generation}`;

const state={model:'peugeot-308-2',eng:0,box:0,year:2017,km:98000,price:11500,cote:10800,maint:'partiel',treated:[],example:true};
try{const s=JSON.parse(localStorage.getItem('vo-state3')||'null');if(s&&MODELS.some(m=>m.id===s.model))Object.assign(state,s);}catch(e){}
function save(){try{localStorage.setItem('vo-state3',JSON.stringify(state));}catch(e){}}

/* Analyse du prix : on compare le « prix réel » (prix demandé + coût de risque mécanique) à la cote.
   Un prix délirant plafonne le score, quel que soit l'état mécanique. */
function pricing(price,cote,exp){
  if(!price||!cote)return null;
  const real=price+exp, e=(real-cote)/cote, raw=(price-cote)/cote;
  let p;
  if(raw<-0.35)p={pts:-10,label:'Anormalement bas',cls:'c2',cap:55,note:`Prix inférieur de ${Math.round(-raw*100)} % à la cote : vérifier l'historique (sinistre, kilométrage, gage) et se méfier des arnaques au faux vendeur ou au faux acompte.`};
  else if(e<=-0.10)p={pts:8,label:'Bonne affaire',cls:'cok'};
  else if(e<=0.05)p={pts:0,label:'Prix cohérent',cls:'c1'};
  else if(e<=0.15)p={pts:-10,label:'Un peu cher',cls:'c2'};
  else if(e<=0.30)p={pts:-25,label:'Cher',cls:'c3'};
  else p={pts:-40,label:'Prix délirant',cls:'c3',cap:25,note:`En comptant les frais à prévoir, ce véhicule revient ${Math.round(e*100)} % au-dessus de la cote. Même en parfait état, il ne vaut pas ce prix.`};
  return {...p,real,e,raw};
}

function fillModel(){
  const sel=$('#f-model');sel.innerHTML='';
  [...new Set(MODELS.map(m=>m.marque))].sort().forEach(b=>{const og=document.createElement('optgroup');og.label=b;
    MODELS.filter(m=>m.marque===b).forEach(m=>og.appendChild(new Option(`${m.modele} ${m.generation} (${m.annees[0]}-${m.annees[1]})`,m.id)));sel.appendChild(og);});
  sel.value=state.model;
}
function fillDeps(){
  const m=MODELS.find(x=>x.id===state.model);
  $('#f-eng').innerHTML='';m.moteurs.forEach((e,i)=>$('#f-eng').add(new Option(`${e.libelle} · ${e.carburant}`,i)));
  $('#f-box').innerHTML='';m.boites.forEach((b,i)=>$('#f-box').add(new Option(b.libelle,i)));
  $('#f-year').innerHTML='';for(let y=m.annees[1];y>=m.annees[0];y--)$('#f-year').add(new Option(y,y));
  if(state.eng>=m.moteurs.length)state.eng=0;if(state.box>=m.boites.length)state.box=0;
  if(state.year<m.annees[0]||state.year>m.annees[1])state.year=m.annees[1];
  $('#f-eng').value=state.eng;$('#f-box').value=state.box;$('#f-year').value=state.year;
}
function syncInputs(){
  $('#f-km').value=state.km;$('#f-price').value=state.price||'';$('#f-cote').value=state.cote||'';
  document.querySelectorAll('#f-maint button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===state.maint));
  $('#ex-pill').hidden=!state.example;
}

function evaluate(){
  const m=MODELS.find(x=>x.id===state.model),e=m.moteurs[state.eng],b=m.boites[state.box];
  const km=Number(state.km)||0,year=Number(state.year);
  const list=DEFECTS.filter(d=>applies(d,m,e,b)&&(!d.annees||(year>=d.annees[0]&&year<=d.annees[1]))).map(d=>{
    const z=zone(km,d.km);const done=state.treated.includes(d.id);
    const w=d.confiance==='confirmé'?1:0.6;
    const risk=d.gravite*d.frequence*z.f*w;
    const exp=done?0:(d.preventif!=null?d.preventif*z.f:((d.cout[0]+d.cout[1])/2)*PF[d.frequence]*z.f*w);
    return {...d,z,done,risk,exp};
  }).sort((a,b)=>(a.done-b.done)||(b.risk-a.risk));
  let score=100;list.forEach(d=>{if(!d.done)score-=d.risk*3.5;});
  score-={complet:0,partiel:8,aucun:18}[state.maint];
  const age=Math.max(1,NOW-year+0.5),kmy=km/age;
  const notes=[];
  if(kmy>25000){score-=6;notes.push(`Kilométrage élevé pour l'âge : environ ${nf.format(Math.round(kmy/1000)*1000)} km par an. Usure générale (trains roulants, embrayage, amortisseurs) à surveiller.`);}
  if(km>0&&kmy<5000)notes.push(`Kilométrage très faible pour l'âge : environ ${nf.format(Math.round(kmy/100)*100)} km par an. Vérifier la cohérence des relevés sur HistoVec et les contrôles techniques.`);
  if(state.maint==='aucun')notes.push('Aucun historique d\'entretien : les défauts liés à la qualité de l\'huile et aux intervalles de vidange deviennent bien plus probables.');
  const recalls=list.filter(d=>d.rappel&&!d.done);
  if(recalls.length)notes.push(`${recalls.length>1?recalls.length+' rappels officiels concernent':'Un rappel officiel concerne'} ce véhicule. Exiger la preuve qu'${recalls.length>1?'ils ont':'il a'} été fait${recalls.length>1?'s':''} : sinon, l'intervention est gratuite en concession.`);
  const mec=Math.max(5,Math.min(100,Math.round(score)));
  const exp=list.reduce((s,d)=>s+d.exp,0);
  const pr=pricing(Number(state.price)||0,Number(state.cote)||0,exp);
  let fin=mec;
  if(pr){fin=Math.min(100,mec+pr.pts);if(pr.cap!=null)fin=Math.min(fin,pr.cap);if(pr.note)notes.unshift(pr.note);}
  else if(state.price)notes.push('Indiquez la cote du marché pour que le prix entre dans le score.');
  fin=Math.max(5,Math.round(fin));
  let v=fin>=70?{l:'Bon achat',c:'v-ok'}:fin>=45?{l:'À négocier',c:'v-warn'}:{l:'Risqué',c:'v-crit'};
  if(pr&&pr.label==='Prix délirant')v={l:'Trop cher',c:'v-crit'};
  return {m,e,b,km,year,list,score:fin,mec,pr,exp,v,notes};
}

function costCell(d){
  if(d.rappel&&d.preventif===0)return 'Rappel gratuit<br><span style="color:var(--muted)">Sinon '+range(d.cout)+'</span>';
  if(d.preventif)return 'Préventif ~'+nf.format(d.preventif)+' €<br><span style="color:var(--muted)">Casse '+range(d.cout)+'</span>';
  return range(d.cout);
}

function render(){
  const r=evaluate();const price=Number(state.price)||0,cote=Number(state.cote)||0;
  const base=cote?Math.min(price,cote):price;
  const target=price?Math.max(0,Math.round((base-r.exp)/50)*50):0;
  const pct=x=>(x>0?'+':'')+Math.round(x*100)+' %';
  const name=`${label(r.m)} · ${r.e.libelle} · ${r.b.libelle}`;
  const open=r.list.filter(d=>!d.done),done=r.list.filter(d=>d.done);
  const checks=[...new Set(open.map(d=>d.controle))];
  let html=`<div class="panel"><div class="verdict">
    <div class="plate ${r.v.c}"><div class="lab">${r.v.l}</div><div class="sc">Score ${r.score} / 100</div></div>
    <div style="min-width:0"><p class="eyebrow">Évaluation</p><p class="vehicle">${esc(name)}</p>
    <div style="color:var(--muted);font-size:.88rem;font-family:var(--f-mono)">${r.year} · ${nf.format(r.km)} km${price?' · '+eur(price):''}</div>
    <div class="meter" aria-hidden="true"><i style="left:${r.score}%"></i></div>
    <div class="meter-scale"><span>0</span><span>45</span><span>70</span><span>100</span></div>
    <div class="subscores"><span>Mécanique <b>${r.mec}/100</b></span><span>Prix <b>${r.pr?(r.pr.pts>0?'+':'')+r.pr.pts+' pts · '+r.pr.label:'non évalué'}</b></span></div></div>
  </div></div>
  <div class="figs">
    <div class="fig"><b>${open.length}</b><span>défaut${open.length>1?'s':''} connu${open.length>1?'s':''} à surveiller${done.length?` · ${done.length} traité${done.length>1?'s':''}`:''}</span></div>
    <div class="fig"><b>${eur(r.exp)}</b><span>coût de risque estimé sur ce véhicule</span></div>
    <div class="fig"><b>${price?eur(target):'—'}</b><span>${price?'prix cible de négociation':'indiquez le prix pour un prix cible'}</span></div>
  </div>`;
  html+=r.notes.map(n=>`<div class="alert warn">${n}</div>`).join('');
  if(r.pr){
    const pos=Math.max(0,Math.min(100,(r.pr.e+0.3)/0.8*100));
    html+=`<div class="panel price"><div class="head-row"><h2>Analyse du prix</h2><span class="chip ${r.pr.cls}">${r.pr.label}</span></div>
      <div class="price-grid">
        <div><span>Prix demandé</span><b>${eur(price)}</b></div>
        <div><span>Cote du marché</span><b>${eur(cote)}</b></div>
        <div><span>Frais à prévoir</span><b>${eur(r.exp)}</b></div>
        <div><span>Prix réel vs cote</span><b>${eur(r.pr.real)} · ${pct(r.pr.e)}</b></div>
      </div>
      <div class="pscale" aria-hidden="true"><i style="left:${pos}%"></i></div>
      <div class="pscale-l" style="position:relative;height:1em"><span style="position:absolute;left:0">−30 %</span><span style="position:absolute;left:37.5%;transform:translateX(-50%)">cote</span><span style="position:absolute;left:75%;transform:translateX(-50%)">+30 %</span><span style="position:absolute;right:0">+50 %</span></div>
      <p class="hint" style="margin-top:10px">Le prix réel ajoute au prix demandé les frais à prévoir pour les défauts connus non traités. C'est lui qu'on compare à la cote.</p></div>`;
  }
  html+=`<div class="panel"><div class="head-row"><h2>Défauts connus</h2><span class="eyebrow" style="margin:0">Gravité façon contrôle technique</span></div>`;
  if(!r.list.length)html+=`<div class="alert ok">Aucun défaut répertorié pour cette combinaison à ce stade de la base. Les contrôles génériques ci-dessous restent indispensables.</div>`;
  else html+=`<div class="list">${r.list.map(d=>`
    <details class="def g${d.gravite}${d.done?' done':''}">
      <summary><div style="min-width:0"><h3>${esc(d.titre)}</h3>
        <div class="meta"><span class="chip c${d.gravite}">${GL[d.gravite]}</span>${d.rappel?'<span class="rap">Rappel officiel</span>':''}<span class="conf${d.confiance==='confirmé'?' ok':''}">${d.confiance==='confirmé'?'Confirmé':'À confirmer'}</span>${d.done?'<span class="zone" style="color:var(--ok)">Traité, facture présentée</span>':`<span class="zone ${d.z.cls}">${d.z.l}</span>`}<span>${nf.format(d.km[0])} à ${nf.format(d.km[1])} km</span></div></div>
        <div class="cost">${costCell(d)}</div>
      </summary>
      <div class="body"><dl style="margin:0;display:grid;gap:10px">
        <div><dt>Symptômes</dt><dd>${esc(d.symptomes)}</dd></div>
        <div><dt>À contrôler à la visite</dt><dd>${esc(d.controle)}</dd></div>
        <div><dt>Solution</dt><dd>${esc(d.solution)}</dd></div>
        <div><dt>Sources</dt><dd><ul class="srcs">${d.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a>${s.type==='forum'?' <span class="conf">Forum</span>':''}</li>`).join('')}</ul></dd></div></dl>
        <label class="treat"><input type="checkbox" data-treat="${d.id}" ${d.done?'checked':''}> ${d.rappel?'Fait : preuve du rappel présentée':'Traité : le vendeur présente une facture'}</label>
      </div>
    </details>`).join('')}</div>`;
  html+=`</div>`;
  html+=`<div class="panel"><div class="head-row"><h2>À vérifier pendant la visite</h2></div><ul class="checks">
    ${[...GENERIC,...checks].map((c,i)=>`<li><label><input type="checkbox" id="chk-${i}"> <span>${esc(c)}</span></label></li>`).join('')}</ul></div>`;
  const argDefs=open.filter(d=>d.cout[1]>0&&!(d.rappel&&d.preventif===0)).slice(0,4);
  const overCote=cote&&price>cote;
  if(price&&(argDefs.length||overCote)&&target<price){
    const parts=[];
    if(overCote)parts.push(`La cote de ce véhicule pour cette version, cette année et ce kilométrage est d'environ ${eur(cote)}, soit ${pct((price-cote)/cote)} par rapport à votre prix.`);
    if(argDefs.length)parts.push(`Il est aussi concerné par des défauts connus sur ce modèle, sans facture de traitement à ce jour :\n${argDefs.map(d=>`– ${d.titre.replace(/\s*\(.*?\)\s*$/,'')} : ${d.preventif?'intervention préventive d\'environ '+nf.format(d.preventif)+' €':'réparation estimée entre '+nf.format(d.cout[0])+' et '+nf.format(d.cout[1])+' €'}`).join('\n')}`);
    const arg=`Bonjour,\n\nJe suis intéressé par votre ${label(r.m)} ${r.e.libelle} de ${r.year} (${nf.format(r.km)} km).\n\n${parts.join('\n\n')}\n\nCompte tenu de ces éléments, je vous propose ${eur(target)}.\n\nCordialement`;
    html+=`<div class="panel"><div class="head-row"><h2>Argumentaire de négociation</h2><button class="btn ghost" id="copy">Copier</button></div><pre class="argument" id="arg">${esc(arg)}</pre></div>`;
  }
  $('#report').innerHTML=html;
  const cp=$('#copy');if(cp)cp.onclick=()=>{const t=$('#arg').textContent;
    const sel=()=>{const s=getSelection(),rg=document.createRange();rg.selectNodeContents($('#arg'));s.removeAllRanges();s.addRange(rg);cp.textContent='Texte sélectionné';};
    if(navigator.clipboard)navigator.clipboard.writeText(t).then(()=>{cp.textContent='Copié';setTimeout(()=>cp.textContent='Copier',1500);}).catch(sel);else sel();};
  document.querySelectorAll('[data-treat]').forEach(c=>c.onchange=()=>{
    const id=c.dataset.treat;state.treated=c.checked?[...state.treated,id]:state.treated.filter(x=>x!==id);touch();render();
    const el=document.querySelector(`[data-treat="${id}"]`);if(el)el.closest('details').open=true;
  });
}
function touch(){state.example=false;$('#ex-pill').hidden=true;save();}

function renderRep(){
  const q=$('#r-q').value.trim().toLowerCase(),br=$('#r-brand').value,onlyConf=$('#r-conf').checked;
  const out=MODELS.filter(m=>!br||m.marque===br).map(m=>{
    const defs=DEFECTS.filter(d=>(!onlyConf||d.confiance==='confirmé')
      &&(m.moteurs.some(e=>applies(d,m,e,null))||m.boites.some(b=>applies(d,m,null,b))||applies(d,m,null,null))
      &&(!d.annees||(d.annees[1]>=m.annees[0]&&d.annees[0]<=m.annees[1])));
    const hay=(label(m)+' '+m.moteurs.map(e=>e.libelle).join(' ')+' '+defs.map(d=>d.titre).join(' ')).toLowerCase();
    return {m,defs,ok:!q||hay.includes(q)};
  }).filter(x=>x.ok);
  $('#rep').innerHTML=out.length?out.map(({m,defs})=>`<article class="panel model">
    <p class="eyebrow" style="margin-bottom:2px">${esc(m.marque)}</p><h3>${esc(m.modele)} ${esc(m.generation)}</h3><div class="yrs">${m.annees[0]} – ${m.annees[1]} · ${m.moteurs.length} motorisations</div>
    ${defs.length?`<ul>${[...defs].sort((a,b)=>b.gravite-a.gravite).map(d=>{
      const where=d.moteurs?m.moteurs.filter(e=>d.moteurs.includes(e.code)).map(e=>e.libelle):d.boites?m.boites.filter(b=>d.boites.includes(b.code)).map(b=>b.libelle):d.carburant?['versions diesel']:[];
      return `<li><span class="chip c${d.gravite}">${GL[d.gravite]}</span><span>${esc(d.titre)}${where.length?` <span style="color:var(--muted)">· ${esc(where.join(', '))}</span>`:''}${d.confiance==='confirmé'?'':' <span class="conf">À confirmer</span>'}</span></li>`;}).join('')}</ul>`:`<p class="clean">Aucun défaut répertorié pour l'instant.</p>`}
    <button class="btn ghost open" data-open="${m.id}">Évaluer ce modèle</button></article>`).join(''):`<p class="empty">Aucun résultat pour cette recherche.</p>`;
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{state.model=b.dataset.open;state.eng=0;state.box=0;state.treated=[];touch();fillModel();fillDeps();render();show('eval');scrollTo({top:0});});
}

function show(v){
  $('#view-eval').hidden=v!=='eval';$('#view-rep').hidden=v!=='rep';
  $('#tab-eval').setAttribute('aria-selected',v==='eval');$('#tab-rep').setAttribute('aria-selected',v==='rep');
}

$('#tab-eval').onclick=()=>show('eval');
$('#tab-rep').onclick=()=>show('rep');
$('#f-model').onchange=e=>{state.model=e.target.value;state.eng=0;state.box=0;state.treated=[];touch();fillDeps();render();};
$('#f-eng').onchange=e=>{state.eng=+e.target.value;state.treated=[];touch();render();};
$('#f-box').onchange=e=>{state.box=+e.target.value;touch();render();};
$('#f-year').onchange=e=>{state.year=+e.target.value;touch();render();};
$('#f-km').oninput=e=>{state.km=+e.target.value||0;touch();render();};
$('#f-price').oninput=e=>{state.price=+e.target.value||0;touch();render();};
$('#f-cote').oninput=e=>{state.cote=+e.target.value||0;touch();render();};
document.querySelectorAll('#f-maint button').forEach(b=>b.onclick=()=>{state.maint=b.dataset.v;touch();syncInputs();render();});
$('#r-q').oninput=renderRep;$('#r-conf').onchange=renderRep;
$('#r-brand').add(new Option('Toutes les marques',''));[...new Set(MODELS.map(m=>m.marque))].sort().forEach(b=>$('#r-brand').add(new Option(b,b)));
$('#r-brand').onchange=renderRep;
if(location.hash==='#repertoire')show('rep');

fillModel();fillDeps();syncInputs();render();renderRep();
})();
