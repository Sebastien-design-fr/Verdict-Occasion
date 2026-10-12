/* MecaVeya — interface. Cœur V2 : « Mon véhicule » et les modules Anticiper, Décider, Agir (owner.js).
   Rubrique secondaire « Avant d'acheter » : accueil (trouver le véhicule) → annonce → verdict,
   puis détails, mode visite, comparaison et répertoire. Le calcul est dans engine.js et health.js. */
(async function(){
const $=s=>document.querySelector(s);
const app=$('#app');
let DATA=window.VO_DATA;
if(!DATA){
  try{
    const [m,d,p,c,po,o]=await Promise.all(['modeles','defauts','prix_neufs','decote','politiques','organes'].map(f=>fetch(`data/${f}.json`).then(r=>{if(!r.ok)throw new Error(f);return r.json();})));
    DATA={modeles:m.modeles,defauts:d.defauts,version:d.version,prix:p.prix,decote:c,politiques:po,organes:o};
  }catch(e){app.innerHTML='<div class="view"><div class="col"><div class="alert warn">La base de données n\'a pas pu être chargée (dossier data/). Rechargez la page.</div></div></div>';return;}
}
const E=createEngine(DATA);
const {MODELS,DEFECTS,nf,eur,label,shortEngine,GL,NOW}=E;
const HL=createHealth({E,politiques:DATA.politiques,organes:DATA.organes});
let storage=null;try{storage=window.localStorage;}catch(e){}
const STORE=createStore({storage,models:MODELS});
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtDate=v=>{const [y,m,d]=String(v||'').split('-');return d?`${d}/${m}/${y}`:v;};
const ICON={
  back:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  chev:'<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  search:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="color:var(--muted);flex:none"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  paste:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:var(--accent);flex:none"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="M8 12h8M8 16h5"/></svg>'
};

/* ---- État (gardé dans ce navigateur uniquement) ---- */
const KEY='ausculto-v1';
let S={cur:null,recents:[],compare:[]};
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&typeof s==='object')S={...S,...s};}catch(e){}
const valid=st=>st&&MODELS.some(m=>m.id===st.model);
if(S.cur&&!valid(S.cur))S.cur=null;
S.recents=(S.recents||[]).filter(valid);S.compare=(S.compare||[]).filter(valid);
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
const EXAMPLE={model:'vw-golf-7',eng:4,box:0,year:2016,km:120000,price:12200,cote:0,ch:110,maint:'partiel',treated:[],checks:[],example:true};
const sig=s=>[s.model,s.eng,s.box,s.year,s.km,s.price].join('|');
const modelOf=s=>MODELS.find(m=>m.id===s.model);
function blank(m,i,year){
  const age=NOW-year;const man=m.boites.findIndex(b=>b.code==='man');
  return {model:m.id,eng:i,box:man>=0?man:0,year,km:Math.round(Math.max(5000,age*13500)/1000)*1000,price:0,cote:0,ch:0,maint:'partiel',treated:[],checks:[]};
}
const defaultYear=m=>Math.max(m.annees[0],Math.min(m.annees[1],NOW-6));

/* ---- Petits outils ---- */
let toastT;
function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>el.hidden=true,2400);}
function copy(text,ok){
  const fallback=()=>{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
    let done=false;try{done=document.execCommand('copy');}catch(e){}ta.remove();toast(done?ok:'Copie impossible ici : sélectionnez le texte à la main.');};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(()=>toast(ok)).catch(fallback);else fallback();
}
const tagHtml=(tone,t)=>`<span class="tag t-${tone}">${esc(t)}</span>`;
const seg=(id,opts,cur)=>`<div class="seg" id="${id}" role="group">${opts.map(([v,l])=>`<button type="button" data-v="${esc(v)}" aria-pressed="${String(v)===String(cur)}">${esc(l)}</button>`).join('')}</div>`;
const backBtn=(to,t='Retour')=>`<button class="back" data-go="${to}">${ICON.back}${esc(t)}</button>`;
const steps=n=>`<div class="steps" aria-hidden="true">${[1,2,3].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</div>`;
const carLine=(r)=>`${esc(r.m.modele)} ${esc(r.m.generation)} · ${esc(shortEngine(r.e))} · ${r.year} · ${nf.format(r.km)} km`;

/* ---- Routage par ancre simple (#verdict, #visite…) ---- */
const OWNER_ROUTES=['vehicule','ajout','anticiper','decider','agir'];
const BUYER_ROUTES=['accueil','annonce','verdict','details','visite','comparer','repertoire'];
const ROUTES=[...OWNER_ROUTES,...BUYER_ROUTES];
let last='',fresh=false;
const route=()=>{const h=location.hash.replace('#','');return ROUTES.includes(h)?h:'vehicule';};
function go(r){if(location.hash.replace('#','')===r)render();else location.hash=r;}
addEventListener('hashchange',render);
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b){e.preventDefault();go(b.dataset.go);}});

function render(){
  let r=route();
  if(['annonce','verdict','details','visite'].includes(r)&&!S.cur)r='accueil';
  const buyer=BUYER_ROUTES.includes(r);
  const key={vehicule:'vehicule',ajout:'vehicule',anticiper:'anticiper',decider:'decider',agir:'agir',
    accueil:'achat',annonce:'achat',verdict:'achat',details:'achat',visite:'achat',comparer:'comparer',repertoire:'repertoire'}[r];
  document.querySelectorAll('[data-nav]').forEach(b=>{if(b.dataset.nav===key||(buyer&&b.dataset.nav==='buyer'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  $('#subnav').hidden=!buyer;document.body.classList.toggle('in-buyer',buyer);
  const n=$('#cmp-n');n.textContent=S.compare.length;n.hidden=!S.compare.length;
  fresh=r!==last;
  VIEWS[r]();
  if(fresh){scrollTo(0,0);last=r;}
}

/* =========================================================
   1. Accueil : trouver le véhicule
   ========================================================= */
const H={q:'',paste:false,adText:'',adMsg:null,brand:null,model:null,pending:null};
function viewAccueil(){
  app.innerHTML=`<section class="view"><div class="col">
    <div class="bar"><span class="step-l">Étape 1 sur 3</span></div>
    ${steps(1)}
    <h1 class="h1">Quelle voiture regardez-vous&#160;?</h1>
    <div>
      <label class="l" for="q">Modèle, motorisation, année</label>
      <div class="searchbox">${ICON.search}<input id="q" type="search" autocomplete="off" placeholder="Ex. : 308 PureTech 2017, Golf TDI, X1 18d" value="${esc(H.q)}"><button type="button" id="q-clear" aria-label="Effacer" ${H.q?'':'hidden'}>×</button></div>
    </div>
    <div id="res"></div>
    <div class="or">ou</div>
    <button class="paste" id="paste-open" aria-expanded="${H.paste}">${ICON.paste}<span><b style="display:block;font-size:15px">Coller le texte d'une annonce</b><span style="font-size:12.5px;color:var(--muted)">Modèle, année, kilométrage et prix remplis pour vous</span></span></button>
    <div id="paste" ${H.paste?'':'hidden'}>
      <label class="l" for="ad">Texte de l'annonce</label>
      <textarea class="inp" id="ad" placeholder="Collez ici le titre et la description de l'annonce (Leboncoin, La Centrale…)">${esc(H.adText)}</textarea>
      <div id="ad-msg"></div>
      <div style="margin-top:10px"><button class="btn primary" id="ad-go" type="button">Lire l'annonce</button></div>
      <p class="hint">Le texte reste sur votre appareil : il n'est envoyé nulle part.</p>
    </div>
    <section style="display:flex;flex-direction:column;gap:8px">
      <h2 class="h2">${S.recents.length?'Évalués récemment':'Pour essayer'}</h2>
      <div class="list" id="recents">${recentsHtml()}</div>
    </section>
  </div></section>`;
  const q=$('#q');
  q.oninput=()=>{H.q=q.value;H.brand=H.brand&&!H.q?H.brand:null;$('#q-clear').hidden=!H.q;renderResults();};
  q.onkeydown=e=>{if(e.key==='Enter'){const f=$('#res [data-pick]');if(f)f.click();}};
  $('#q-clear').onclick=()=>{H.q='';q.value='';$('#q-clear').hidden=true;renderResults();q.focus();};
  $('#paste-open').onclick=()=>{H.paste=!H.paste;$('#paste').hidden=!H.paste;$('#paste-open').setAttribute('aria-expanded',H.paste);if(H.paste)$('#ad').focus();};
  $('#ad').oninput=e=>H.adText=e.target.value;
  $('#ad-go').onclick=readAd;
  renderAdMsg();
  bindRecents();
  renderResults();
}
function recentsHtml(){
  const list=S.recents.length?S.recents:[EXAMPLE];
  return list.map((s,i)=>{const r=E.evaluate(s);if(!r)return '';
    return `<button class="item" data-recent="${i}"><span class="grow"><span class="t">${esc(label(r.m))} · ${esc(shortEngine(r.e))}</span>
      <span class="s"><span>${r.year} · ${nf.format(r.km)} km${r.price?' · '+eur(r.price):''}</span>${s.example?tagHtml('muted','Exemple'):''}</span></span>
      ${tagHtml(r.v.tone,r.v.l+' · '+r.score)}</button>`;}).join('');
}
function bindRecents(){
  document.querySelectorAll('[data-recent]').forEach(b=>b.onclick=()=>{
    const list=S.recents.length?S.recents:[EXAMPLE];
    S.cur=JSON.parse(JSON.stringify(list[+b.dataset.recent]));save();go('verdict');});
}
function renderResults(){
  const box=$('#res');if(!box)return;
  if(H.q.trim()){
    const res=E.search(H.q,12);
    box.innerHTML=res.length?`<div class="list">${res.map((x,k)=>{const n=E.defectCount(x.m,x.e);
      return `<button class="item" data-pick="${k}"><span class="grow"><span class="t">${esc(x.m.marque)} ${esc(x.m.modele)} ${esc(x.m.generation)} · ${esc(shortEngine(x.e))}</span>
      <span class="s"><span>${x.m.annees[0]}–${x.m.annees[1]} · ${esc(x.e.carburant)}</span>${n?tagHtml('warn',n+' défaut'+(n>1?'s':'')+' documenté'+(n>1?'s':'')):tagHtml('muted','Aucun défaut dans la base')}</span></span>${ICON.chev}</button>`;}).join('')}</div>`
      :`<div class="alert warn">Aucun modèle ne correspond à « ${esc(H.q)} ». Essayez la marque et le modèle seuls (ex. « Clio »), ou parcourez par marque ci-dessous.</div>${brandsHtml()}`;
    res.forEach((x,k)=>{const b=box.querySelector(`[data-pick="${k}"]`);if(b)b.onclick=()=>pick(x.m,x.i,x.year);});
    bindBrands();return;
  }
  box.innerHTML=brandsHtml();bindBrands();
}
function brandsHtml(){
  const brands=[...new Set(MODELS.map(m=>m.marque))].sort((a,b)=>a.localeCompare(b,'fr'));
  let h=`<div style="display:flex;flex-direction:column;gap:10px"><h2 class="h2">Parcourir par marque</h2><div class="chips">${brands.map(b=>`<button class="chip-btn" data-brand="${esc(b)}" aria-pressed="${H.brand===b}">${esc(b)}</button>`).join('')}</div>`;
  if(H.brand){
    const ms=MODELS.filter(m=>m.marque===H.brand).sort((a,b)=>a.modele.localeCompare(b.modele,'fr')||a.annees[0]-b.annees[0]);
    h+=`<div class="list">${ms.map(m=>m.id===H.model?`<div style="background:var(--accent-soft);padding:10px 16px 4px;border-top:1px solid var(--line)"><span class="t" style="font-weight:600">${esc(m.modele)} ${esc(m.generation)}</span> <span style="font-size:12.5px;color:var(--muted)">${m.annees[0]}–${m.annees[1]} · choisissez la motorisation</span></div>`+m.moteurs.map((e,i)=>`<button class="item" data-me="${m.id}|${i}" style="padding-left:28px"><span class="grow"><span class="t" style="font-weight:500">${esc(e.libelle)}</span><span class="s">${esc(e.carburant)}${e.ch?' · '+e.ch+' ch environ':''}</span></span>${ICON.chev}</button>`).join('')
      :`<button class="item" data-model="${m.id}"><span class="grow"><span class="t">${esc(m.modele)} ${esc(m.generation)}</span><span class="s">${m.annees[0]}–${m.annees[1]} · ${m.moteurs.length} motorisation${m.moteurs.length>1?'s':''}</span></span>${ICON.chev}</button>`).join('')}</div>`;
  }
  return h+'</div>';
}
function bindBrands(){
  document.querySelectorAll('[data-brand]').forEach(b=>b.onclick=()=>{H.brand=H.brand===b.dataset.brand?null:b.dataset.brand;H.model=null;renderResults();});
  document.querySelectorAll('[data-model]').forEach(b=>b.onclick=()=>{H.model=b.dataset.model;renderResults();});
  document.querySelectorAll('[data-me]').forEach(b=>b.onclick=()=>{const [id,i]=b.dataset.me.split('|');pick(MODELS.find(m=>m.id===id),+i);});
}
function pick(m,i,year){
  const y=year&&year>=m.annees[0]&&year<=m.annees[1]?year:defaultYear(m);
  S.cur=blank(m,i,y);
  if(H.pending){const p=H.pending;if(p.year&&p.year>=m.annees[0]&&p.year<=m.annees[1])S.cur.year=p.year;if(p.km)S.cur.km=p.km;if(p.price)S.cur.price=p.price;if(p.ch)S.cur.ch=p.ch;S.cur.fromAd=p.found;H.pending=null;}
  save();go('annonce');
}
function readAd(){
  const t=($('#ad').value||'').trim();H.adText=t;
  if(t.length<15){H.adMsg={tone:'warn',t:'Collez le titre et la description de l\'annonce : quelques mots ne suffisent pas.'};renderAdMsg();return;}
  const p=E.parseAd(t);
  if(!p.model){
    H.pending=p;H.adMsg={tone:'warn',t:`Modèle non reconnu. ${p.found.length?'Valeurs lues : '+p.found.join(', ')+'. ':''}Cherchez le modèle ci-dessus : ces valeurs seront reprises.`};renderAdMsg();$('#q').focus();return;
  }
  const m=MODELS.find(x=>x.id===p.model);
  S.cur=blank(m,p.eng,p.year&&p.year>=m.annees[0]&&p.year<=m.annees[1]?p.year:defaultYear(m));
  if(p.box!=null)S.cur.box=p.box;if(p.km)S.cur.km=p.km;if(p.price)S.cur.price=p.price;if(p.ch)S.cur.ch=p.ch;
  S.cur.fromAd=p.found;H.adMsg=null;save();go('annonce');
}
function renderAdMsg(){const el=$('#ad-msg');if(!el)return;el.innerHTML=H.adMsg?`<div class="alert ${H.adMsg.tone}" style="margin-top:10px">${esc(H.adMsg.t)}</div>`:'';}

/* =========================================================
   2. Annonce : décrire le véhicule
   ========================================================= */
function viewAnnonce(){
  const c=S.cur,m=modelOf(c),e=m.moteurs[c.eng];
  const years=[];for(let y=m.annees[1];y>=m.annees[0];y--)years.push(y);
  const all=['man','ev'];
  const missing=c.fromAd?['modèle','kilométrage','prix','année','boîte'].filter(f=>!c.fromAd.includes(f)):[];
  app.innerHTML=`<section class="view"><div class="col">
    <div class="bar">${backBtn('accueil')}<span class="step-l">Étape 2 sur 3</span></div>
    ${steps(2)}
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px">
      <div style="min-width:0"><div style="font-weight:600;font-size:16px">${esc(label(m))}</div><div style="font-size:13px;color:var(--muted)">${m.annees[0]}–${m.annees[1]}</div></div>
      <button class="linkbtn" data-go="accueil">Changer</button>
    </div>
    ${c.fromAd?`<div class="alert info">Rempli depuis le texte de l'annonce. Vérifiez les valeurs avant de continuer.${missing.length?' Non trouvé dans le texte : '+esc(missing.join(', '))+'.':''}</div>`:''}
    <div><label class="l" for="f-eng">Motorisation</label><select class="inp" id="f-eng">${m.moteurs.map((x,i)=>`<option value="${i}" ${i===c.eng?'selected':''}>${esc(x.libelle)} · ${esc(x.carburant)}</option>`).join('')}</select></div>
    <div class="row2">
      <div><label class="l" for="f-year">Année</label><select class="inp" id="f-year">${years.map(y=>`<option ${y===c.year?'selected':''}>${y}</option>`).join('')}</select></div>
      <div><label class="l" for="f-km">Kilométrage</label><input class="inp num" id="f-km" type="number" inputmode="numeric" min="0" step="1000" value="${c.km||''}"></div>
    </div>
    <div><span class="l">Boîte de vitesses</span>${m.boites.length<=3?seg('f-box',m.boites.map((b,i)=>[i,b.libelle]),c.box):`<select class="inp" id="f-box-s">${m.boites.map((b,i)=>`<option value="${i}" ${i===c.box?'selected':''}>${esc(b.libelle)}</option>`).join('')}</select>`}</div>
    <div class="row2">
      <div><label class="l" for="f-price">Prix demandé (€)</label><input class="inp num" id="f-price" type="number" inputmode="numeric" min="0" step="100" value="${c.price||''}" placeholder="Ex. 11 500"></div>
      <div><label class="l" for="f-cote">Cote du marché (€)</label><input class="inp num" id="f-cote" type="number" inputmode="numeric" min="0" step="100" value="${c.cote||''}" placeholder="Facultatif"></div>
    </div>
    <p class="hint" id="cote-hint" style="margin-top:-8px"></p>
    <div><label class="l" for="f-ch">Puissance (ch)</label><input class="inp num" id="f-ch" type="number" inputmode="numeric" min="40" max="800" value="${c.ch||''}" placeholder="${e.ch?e.ch+' (valeur type de cette motorisation)':'Facultatif'}">
      <p class="hint">À préciser quand la motorisation regroupe plusieurs puissances (ex. 116d, 118d, 120d) : la cote en dépend.</p></div>
    <div><span class="l">Historique d'entretien</span>${seg('f-maint',[['complet','Complet'],['partiel','Partiel'],['aucun','Aucun']],c.maint)}
      <p class="hint">Complet : carnet ou factures pour toutes les révisions. Partiel : quelques factures.</p></div>
    <button class="btn primary" id="to-verdict" type="button">Voir le verdict</button>
  </div></section>`;
  const upd=()=>{save();const r=E.evaluate(c);const h=$('#cote-hint');
    h.innerHTML=r.est?`Estimation MecaVeya : <b class="num">${eur(r.est.mid)}</b> (de ${eur(r.est.low)} à ${eur(r.est.high)}). Laissez la cote vide pour l'utiliser, ou saisissez celle de <a href="https://www.lacentrale.fr/cote-voiture-occasion" target="_blank" rel="noopener">La Centrale</a> ou de <a href="https://www.largus.fr/cote-voiture-occasion.html" target="_blank" rel="noopener">L'argus</a>.`:'';};
  const num=(id,k)=>$(id).oninput=ev=>{c[k]=Math.max(0,+ev.target.value||0);c.example=false;upd();};
  num('#f-km','km');num('#f-price','price');num('#f-cote','cote');num('#f-ch','ch');
  $('#f-year').onchange=ev=>{c.year=+ev.target.value;upd();};
  $('#f-eng').onchange=ev=>{c.eng=+ev.target.value;c.ch=0;c.treated=[];c.checks=[];save();viewAnnonce();};
  document.querySelectorAll('#f-box button').forEach(b=>b.onclick=()=>{c.box=+b.dataset.v;document.querySelectorAll('#f-box button').forEach(x=>x.setAttribute('aria-pressed',x===b));upd();});
  const bs=$('#f-box-s');if(bs)bs.onchange=ev=>{c.box=+ev.target.value;upd();};
  document.querySelectorAll('#f-maint button').forEach(b=>b.onclick=()=>{c.maint=b.dataset.v;document.querySelectorAll('#f-maint button').forEach(x=>x.setAttribute('aria-pressed',x===b));upd();});
  $('#to-verdict').onclick=()=>{remember();delete c.visitBase;save();go('verdict');};
  upd();
}
function remember(){
  const c=S.cur;if(c.example)return;
  S.recents=[JSON.parse(JSON.stringify(c)),...S.recents.filter(s=>sig(s)!==sig(c))].slice(0,8);save();
}

/* =========================================================
   3. Verdict
   ========================================================= */
function viewVerdict(){
  const c=S.cur,r=E.evaluate(c),why=E.reasons(r);
  const inCmp=S.compare.some(s=>sig(s)===sig(c));
  const offer=r.price?(r.target<r.price
    ?`<section class="offer"><div><small>Proposez</small><span class="big num">${eur(r.target)}</span></div><div class="was">au lieu de<s>${eur(r.price)}</s></div></section>`
    :`<section class="offer"><div><small>Prix demandé</small><span class="big num">${eur(r.price)}</span></div><div class="was">cohérent avec la cote<br>et les frais à prévoir</div></section>`)
    :`<div class="alert info">Indiquez le prix demandé pour savoir si l'annonce est au bon prix et combien proposer. <button class="linkbtn" data-go="annonce">Ajouter le prix</button></div>`;
  app.innerHTML=`<section class="view"><div class="col verdict-col">
    <div class="bar">${backBtn('annonce','Modifier')}<span class="step-l" style="text-align:right">${carLine(r)}</span></div>
    ${steps(3)}
    ${c.example?`<div class="alert info">Ceci est un exemple. <button class="linkbtn" data-go="accueil">Évaluer votre annonce</button></div>`:''}
    <div class="split">
      <div>
        <section class="card verdict tone-${r.v.tone}">
          <div class="plate"><i aria-hidden="true"></i><b>${esc(r.v.l)}</b><i aria-hidden="true"></i></div>
          <div class="score num">Indice éditorial ${r.score} / 100</div>
          <div class="gauge" aria-hidden="true"><i style="left:${r.score}%"></i></div>
          <div class="subs"><span>Indice mécanique <b class="num">${r.mec}</b></span><span>Prix <b>${r.pr?(r.pr.pts>0?'+':r.pr.pts<0?'−':'')+Math.abs(r.pr.pts)+' pts · '+esc(r.pr.label):'non évalué'}</b></span></div>
          <p class="hint" style="margin:0">Indicateur éditorial : gravité et fréquence estimées par la rédaction, kilométrage et prix. Ce n'est pas une probabilité de panne.</p>
        </section>
        ${offer}
        <button class="btn primary" data-go="visite">Préparer la visite</button>
        <div class="btn-row">
          <button class="btn" data-detail="defauts">Détails</button>
          <button class="btn" data-detail="argument">Argumentaire</button>
          <button class="btn" id="share" aria-label="Copier le résumé">Résumé</button>
        </div>
        <button class="btn block" id="cmp-add" ${inCmp?'disabled':''}>${inCmp?'Dans la comparaison':'Ajouter à la comparaison'}</button>
      </div>
      <div>
        <h2 class="h2">Pourquoi</h2>
        <div class="reasons">${why.map(w=>`<div class="reason">${tagHtml(w.tone,w.tag)}<span>${esc(w.t)}</span></div>`).join('')}</div>
        <p class="hint">${r.list.length} défaut${r.list.length>1?'s':''} connu${r.list.length>1?'s':''} pour cette version${r.list.filter(d=>d.done).length?', dont '+r.list.filter(d=>d.done).length+' traité(s)':''}. Cote ${r.coteSrc==='estimée'?'estimée par MecaVeya':'saisie'} : ${r.cote?eur(r.cote):'non disponible'}. Frais à prévoir (estimation éditoriale) : ${eur(r.exp)}.</p>
      </div>
    </div>
  </div></section>`;
  document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>{D.tab=b.dataset.detail;go('details');});
  $('#share').onclick=()=>copy(summary(r,why),'Résumé copié');
  $('#cmp-add').onclick=()=>{if(S.compare.length>=3)S.compare.shift();S.compare.push(JSON.parse(JSON.stringify(c)));remember();save();toast('Ajoutée à la comparaison');render();};
}
function summary(r,why){
  return `MecaVeya · ${label(r.m)} ${shortEngine(r.e)}, ${r.year}, ${nf.format(r.km)} km${r.price?', '+eur(r.price):''}
Verdict : ${r.v.l} (score ${r.score}/100)
${r.price&&r.target<r.price?'Prix à proposer : '+eur(r.target)+'\n':''}Pourquoi :
${why.map(w=>'- '+w.t).join('\n')}`;
}

/* =========================================================
   4. Détails : défauts, prix, argumentaire
   ========================================================= */
const D={tab:'defauts',open:null};
function viewDetails(){
  const c=S.cur,r=E.evaluate(c);
  const tabs=[['defauts',`Défauts (${r.list.length})`],['prix','Prix'],['argument','Argumentaire']];
  let body='';
  if(D.tab==='defauts'){
    if(!r.list.length)body=`<div class="alert info">Aucun défaut répertorié pour cette version à ce stade de la base, ce qui ne prouve pas sa fiabilité. Les contrôles du mode visite restent indispensables.</div>`;
    else body=r.list.map((d,k)=>{
      const max=Math.max(d.km[1]*1.15,r.km*1.08,1);const L=x=>Math.min(100,x/max*100);
      const tone=d.done?'ok':d.z.cls==='in'?'crit':d.z.cls==='near'?'warn':'muted';
      return `<details class="defect${d.done?' done':''}" data-id="${esc(d.id)}" ${(D.open?D.open===d.id:k===0)?'open':''}>
        <summary><div class="meta">${tagHtml(d.gravite===3?'crit':d.gravite===2?'warn':'muted',GL[d.gravite])}${d.rappel?tagHtml('info','Rappel officiel'):''}<span>${d.confiance==='confirmé'?'Confirmé':'À confirmer'} · ${d.sources.length} source${d.sources.length>1?'s':''}</span></div>
          <h3>${esc(d.titre)}</h3>
          <div class="meta">${tagHtml(tone,d.done?'Traité, preuve présentée':d.z.l)}</div></summary>
        <div class="body">
          <div><div class="zone-l"><span>Plage documentée : ${nf.format(d.km[0])} → ${nf.format(d.km[1])} km</span><span>Ce véhicule : ${nf.format(r.km)} km</span></div>
            <div class="zonebar" aria-hidden="true"><span class="risk" style="left:${L(d.km[0])}%;width:${L(d.km[1])-L(d.km[0])}%"></span><i class="me" style="left:${L(r.km)}%"></i></div></div>
          <dl>
            <div><dt>Symptômes</dt><dd>${esc(d.symptomes)}</dd></div>
            <div><dt>À contrôler</dt><dd>${esc(d.controle)}</dd></div>
            <div><dt>Si rien n'est fait</dt><dd>${d.rappel&&d.preventif===0?'Intervention gratuite dans le réseau si le rappel n\'a pas été fait. ':''}${d.preventif?'Préventif ~'+eur(d.preventif)+' · ':''}${d.cout[1]?'réparation '+nf.format(d.cout[0])+' à '+eur(d.cout[1]):'sans frais'}. ${esc(d.solution)}</dd></div>
          </dl>
          <label class="switch"><span>${d.rappel?'Preuve du rappel présentée':'Facture présentée par le vendeur'}</span><input type="checkbox" data-treat="${esc(d.id)}" ${d.done?'checked':''}></label>
          <details><summary class="linkbtn" style="display:inline">Voir les ${d.sources.length} source${d.sources.length>1?'s':''}</summary>
            <ul class="srcs" style="margin-top:8px">${d.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a>${s.type==='forum'?' '+tagHtml('muted','Forum'):s.type==='officiel'?' '+tagHtml('info','Officiel'):''}</li>`).join('')}</ul></details>
        </div></details>`;}).join('');
  }else if(D.tab==='prix'){
    if(!r.price)body=`<div class="alert info">Indiquez le prix demandé pour analyser le prix. <button class="linkbtn" data-go="annonce">Ajouter le prix</button></div>`;
    const pos=r.pr?Math.max(0,Math.min(100,(r.pr.e+0.3)/0.8*100)):0;
    body+=`<div class="figs">
      <div class="fig"><span>Prix demandé</span><b>${r.price?eur(r.price):'—'}</b></div>
      <div class="fig"><span>${r.coteSrc==='estimée'?'Cote estimée':'Cote saisie'}</span><b>${r.cote?eur(r.cote):'—'}</b></div>
      <div class="fig"><span>Frais à prévoir</span><b>${eur(r.exp)}</b></div>
      <div class="fig"><span>Prix réel vs cote</span><b>${r.pr?eur(r.pr.real)+' · '+(r.pr.e>0?'+':'')+Math.round(r.pr.e*100)+' %':'—'}</b></div>
    </div>
    ${r.pr?`<div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="bar"><b>Position par rapport à la cote</b>${tagHtml(r.pr.tone,r.pr.label)}</div>
      <div class="pscale" aria-hidden="true"><i style="left:${pos}%"></i></div>
      <div class="pscale-l" aria-hidden="true"><span style="left:0;transform:none">−30 %</span><span style="left:37.5%">cote</span><span style="left:56.25%">+15 %</span><span style="left:100%;transform:translateX(-100%)">+50 %</span></div>
      <p class="hint" style="margin:0">Le prix réel ajoute au prix demandé les frais à prévoir pour les défauts connus non traités. C'est lui qu'on compare à la cote.</p></div>`:''}
    ${r.est?`<p class="hint">Estimation MecaVeya : ${eur(r.est.mid)}, fourchette ${eur(r.est.low)} à ${eur(r.est.high)}. Calcul : prix neuf de référence ${eur(r.est.neuf)}${r.est.neufEstime?' (estimé, à vérifier)':''} pour ${r.ch||'?'} ch, décote selon l'âge, kilométrage, tenue de la marque${r.est.crit?', moteur à défaut critique connu':''}.${r.coteSrc==='estimée'?' Une cote saisie dans l\'annonce la remplace.':''}</p>`:''}`;
  }else{
    const a=E.argument(r);
    body=a?`<pre class="arg" id="arg">${esc(a)}</pre><button class="btn primary" id="copy-arg">Copier l'argumentaire</button><p class="hint">Message prêt à envoyer au vendeur. Il cite la cote et les défauts connus sans facture de traitement.</p>`
      :`<div class="alert ok">Pas d'argument de négociation : ${r.price?'le prix demandé est cohérent avec la cote et les frais à prévoir.':'indiquez d\'abord le prix demandé.'}</div>`;
  }
  app.innerHTML=`<section class="view"><div class="col">
    <div class="bar">${backBtn('verdict','Verdict')}<span class="step-l">${carLine(r)}</span></div>
    <h1 class="h1">Détails</h1>
    <div class="tabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" data-tab="${k}" aria-selected="${D.tab===k}">${esc(l)}</button>`).join('')}</div>
    <div style="display:flex;flex-direction:column;gap:10px">${body}</div>
    <p class="hint">Un défaut documenté ne signifie pas que tous les véhicules sont touchés ; une absence de défaut ne prouve pas la fiabilité. Base du ${fmtDate(DATA.version)}. Une erreur dans un défaut ? Les sources de chaque fiche sont publiques : vérifiez-les et signalez-la sur le dépôt du projet.</p>
  </div></section>`;
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{D.tab=b.dataset.tab;D.open=null;viewDetails();});
  document.querySelectorAll('[data-treat]').forEach(x=>x.onchange=()=>{toggleTreated(x.dataset.treat,x.checked);D.open=x.dataset.treat;viewDetails();});
  const cp=$('#copy-arg');if(cp)cp.onclick=()=>copy($('#arg').textContent,'Argumentaire copié');
}
function toggleTreated(id,on){const c=S.cur;c.treated=on?[...new Set([...(c.treated||[]),id])]:(c.treated||[]).filter(x=>x!==id);c.example=false;save();}

/* =========================================================
   5. Mode visite : check-list et score en direct
   ========================================================= */
const GENERIC=[
 ['froid','Moteur froid, avant de démarrer',[
   ['huile',"Niveau d'huile entre mini et maxi, huile ni noire épaisse ni laiteuse"],
   ['lr','Liquide de refroidissement au bon niveau, sans traces huileuses'],
   ['fuite','Pas de tache ni de fuite sous le moteur'],
   ['demar','Démarrage franc, sans claquement métallique ni fumée']]],
 ['papiers','Papiers du vendeur',[
   ['ct','Contrôle technique de moins de 6 mois (obligatoire au-delà de 4 ans)'],
   ['cg','Carte grise au nom du vendeur, numéro de série (VIN) identique à la voiture'],
   ['histovec','Rapport HistoVec : propriétaires, sinistres et kilométrages cohérents'],
   ['carnet',"Carnet et factures d'entretien cohérents avec le kilométrage"]]],
 ['essai',"Pendant l'essai",[
   ['voyants','Aucun voyant allumé au tableau de bord, moteur tournant'],
   ['fumee',"Pas de fumée bleue ou noire à l'accélération"],
   ['boite','Rapports qui passent sans à-coups ni craquement'],
   ['freins','Freinage droit, sans vibration ni bruit'],
   ['direction','Direction sans jeu, voiture qui roule droit'],
   ['clim','Climatisation qui refroidit']]]
];
function viewVisite(){
  const c=S.cur;c.checks=c.checks||[];
  const r=E.evaluate(c);
  if(c.visitBase==null){c.visitBase=r.score;save();}
  const open=r.list.filter(d=>!d.done);
  const delta=id=>{const t=E.evaluate({...c,treated:[...(c.treated||[]),id]});return t.score-r.score;};
  const proofs=r.list.map(d=>({d,done:d.done,gain:d.done?0:delta(d.id)}));
  const specific=[...new Set(open.map(d=>d.controle))];
  const sections=[GENERIC[0],
    ['proofs','Factures et rappels',null],
    GENERIC[1],
    ...(specific.length?[['spec','Contrôles propres à cette version',specific.map((t,i)=>['s'+i,t])]]:[]),
    GENERIC[2]];
  const total=GENERIC.reduce((n,g)=>n+g[2].length,0)+specific.length+proofs.length;
  const done=c.checks.filter(k=>k.startsWith('g:')||k.startsWith('s:')).length+proofs.filter(p=>p.done).length;
  const html=sections.map(([id,title,items])=>{
    if(id==='proofs'){
      if(!proofs.length)return '';
      return `<section class="vsec"><h2 class="h2">${esc(title)}</h2>${proofs.map(p=>`<label class="vchk money"><input type="checkbox" data-proof="${esc(p.d.id)}" ${p.done?'checked':''}><span>${p.d.rappel?'Preuve du rappel : ':'Facture : '}${esc(p.d.titre)}<small>${p.done?'Présentée : défaut traité':p.gain>0?'Si présentée : +'+p.gain+' point'+(p.gain>1?'s':''):'Si présentée : frais retirés du prix réel'}</small></span></label>`).join('')}</section>`;
    }
    const pre=id==='spec'?'s:':'g:';
    return `<section class="vsec"><h2 class="h2">${esc(title)}</h2>${items.map(([k,t])=>`<label class="vchk"><input type="checkbox" data-chk="${pre+id+':'+k}" ${c.checks.includes(pre+id+':'+k)?'checked':''}><span>${esc(t)}</span></label>`).join('')}</section>`;
  }).join('');
  app.innerHTML=`<section class="view"><div class="col">
    <div class="bar">${backBtn('verdict','Verdict')}<span class="step-l num">${done} / ${total}</span></div>
    <h1 class="h1">Mode visite</h1>
    <div class="progress" aria-hidden="true"><i style="width:${total?done/total*100:0}%"></i></div>
    <p class="lede">Cochez au fur et à mesure. Les factures et preuves de rappel présentées par le vendeur mettent l'indice à jour.</p>
    ${html}
    <div class="livebar"><div class="in">
      <div><small>Indice éditorial en direct</small><span class="n num">${r.score}</span> <span style="font-size:13px;color:var(--inv-muted)">/ 100${c.visitBase!==r.score?' · était '+c.visitBase:''}</span></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">${tagHtml(r.v.tone,r.v.l)}<button class="linkbtn" data-go="verdict" style="color:var(--inv-fg)">Voir le verdict</button></div>
    </div></div>
  </div></section>`;
  document.querySelectorAll('[data-chk]').forEach(x=>x.onchange=()=>{const k=x.dataset.chk;c.checks=x.checked?[...new Set([...c.checks,k])]:c.checks.filter(y=>y!==k);save();keepScroll(viewVisite);});
  document.querySelectorAll('[data-proof]').forEach(x=>x.onchange=()=>{toggleTreated(x.dataset.proof,x.checked);keepScroll(viewVisite);});
}
function keepScroll(fn){const y=scrollY;fn();scrollTo(0,y);}

/* =========================================================
   6. Comparer
   ========================================================= */
function viewComparer(){
  const items=S.compare.map(s=>({s,r:E.evaluate(s)})).filter(x=>x.r);
  const L='ABC';
  let body='';
  if(items.length<2){
    const cand=[...(S.cur&&!S.cur.example?[S.cur]:[]),...S.recents].filter((s,i,a)=>a.findIndex(x=>sig(x)===sig(s))===i&&!S.compare.some(x=>sig(x)===sig(s)));
    body=`<p class="lede">Ajoutez deux ou trois annonces pour les comparer frais compris : la moins chère à l'achat n'est pas toujours la moins chère au final.</p>
    ${items.length?`<div class="list">${items.map((x,i)=>`<div class="item" style="cursor:default"><span class="grow"><span class="t">Annonce ${L[i]} · ${esc(label(x.r.m))}</span><span class="s">${x.r.year} · ${nf.format(x.r.km)} km${x.r.price?' · '+eur(x.r.price):''}</span></span>${tagHtml(x.r.v.tone,x.r.v.l+' · '+x.r.score)}</div>`).join('')}</div>`:''}
    ${cand.length?`<h2 class="h2">Annonces évaluées</h2><div class="list">${cand.slice(0,8).map((s,i)=>{const r=E.evaluate(s);return `<button class="item" data-cadd="${i}"><span class="grow"><span class="t">${esc(label(r.m))} · ${esc(shortEngine(r.e))}</span><span class="s">${r.year} · ${nf.format(r.km)} km${r.price?' · '+eur(r.price):''}</span></span><span class="btn small">Ajouter</span></button>`;}).join('')}</div>`
      :`<div class="alert info">Évaluez une annonce, puis touchez « Ajouter à la comparaison » sur son verdict.</div>`}
    <button class="btn primary" data-go="accueil">Évaluer une annonce</button>`;
    app.innerHTML=`<section class="view"><div class="col"><h1 class="h1">Comparer</h1>${body}</div></section>`;
    document.querySelectorAll('[data-cadd]').forEach(b=>b.onclick=()=>{S.compare.push(JSON.parse(JSON.stringify(cand[+b.dataset.cadd])));save();render();});
    return;
  }
  const real=x=>x.r.price?x.r.price+x.r.exp:Infinity;
  const best=[...items].sort((a,b)=>b.r.score-a.r.score||real(a)-real(b))[0];
  const crit=x=>x.r.list.filter(d=>!d.done&&d.gravite===3&&!d.rappel).length;
  const rap=x=>x.r.list.filter(d=>!d.done&&d.rappel).length;
  const pctv=x=>x.r.pr?Math.round(x.r.pr.e*100):null;
  const rows=[
    ['Verdict',x=>`${tagHtml(x.r.v.tone,x.r.v.l)}`,null],
    ['Indice éditorial',x=>x.r.score+' / 100',x=>-x.r.score],
    ['Prix demandé',x=>x.r.price?eur(x.r.price):'—',x=>x.r.price||Infinity],
    ['Frais à prévoir',x=>eur(x.r.exp),x=>x.r.exp],
    ['Prix + frais',x=>x.r.price?eur(real(x)):'—',real],
    ['Prix réel vs cote',x=>pctv(x)==null?'—':(pctv(x)>0?'+':'')+pctv(x)+' %',x=>pctv(x)??Infinity],
    ['Défauts critiques en attente',x=>crit(x),crit],
    ['Rappels à vérifier',x=>rap(x),rap],
    ['Entretien',x=>({complet:'Complet',partiel:'Partiel',aucun:'Aucun'})[x.r.maint],x=>({complet:0,partiel:1,aucun:2})[x.r.maint]],
    ['Prix à proposer',x=>x.r.price?eur(x.r.target):'—',null],
  ];
  const winners=f=>{if(!f)return [];const v=items.map(f);const m=Math.min(...v);return v.every(x=>x===m)?[]:v.map(x=>x===m);};
  const others=items.filter(x=>x!==best);
  const bi=items.indexOf(best);
  const o=others[0],oi=items.indexOf(o);
  let verdictTxt=`L'annonce ${L[bi]} obtient le meilleur indice éditorial (${best.r.score} contre ${others.map(x=>x.r.score).join(' et ')}).`;
  if(best.r.price&&o.r.price){
    const d=real(best)-real(o);
    verdictTxt+=d<=0?` Frais compris, elle revient ${eur(-d)} de moins que l'annonce ${L[oi]} (${eur(real(best))} contre ${eur(real(o))}).`
      :` Elle revient ${eur(d)} de plus que l'annonce ${L[oi]} frais compris (${eur(real(best))} contre ${eur(real(o))}) : à vous de juger si l'écart d'indice le justifie.`;
  }
  if(crit(best)===0&&others.some(x=>crit(x)>0))verdictTxt+=' Elle n\'a aucun défaut critique en attente.';
  app.innerHTML=`<section class="view"><div class="wide">
    <h1 class="h1">Comparer</h1>
    <div class="cmp-head" style="grid-template-columns:repeat(${items.length},minmax(0,1fr))">${items.map((x,i)=>`<div class="cmp-card${x===best?' best':''}">
      <button class="x" data-crm="${i}" aria-label="Retirer l'annonce ${L[i]}">×</button>
      <span style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="h2">Annonce ${L[i]}</span>${x===best?tagHtml('ok','Meilleur choix'):''}</span>
      <b style="font-size:15px">${esc(x.r.m.marque)} ${esc(x.r.m.modele)} ${esc(x.r.m.generation)}</b>
      <span style="font-size:13px;color:var(--muted)">${esc(shortEngine(x.r.e))}<br>${x.r.year} · ${nf.format(x.r.km)} km${x.r.price?'<br>'+eur(x.r.price):''}</span>
      <button class="linkbtn" data-copen="${i}" style="align-self:flex-start;font-size:13px">Ouvrir le verdict</button></div>`).join('')}</div>
    <div class="cmp-table"><table>${rows.map(([t,f,w])=>{const win=winners(w);return `<tr><th scope="row">${esc(t)}</th>${items.map((x,i)=>`<td class="${win[i]?'win':''}">${f(x)}</td>`).join('')}</tr>`;}).join('')}</table></div>
    <div class="alert ok">${esc(verdictTxt)}</div>
    ${items.length<3?`<button class="btn block" data-go="accueil">Ajouter une ${items.length===2?'troisième':'autre'} annonce</button>`:''}
  </div></section>`;
  document.querySelectorAll('[data-crm]').forEach(b=>b.onclick=()=>{S.compare.splice(+b.dataset.crm,1);save();render();});
  document.querySelectorAll('[data-copen]').forEach(b=>b.onclick=()=>{S.cur=JSON.parse(JSON.stringify(S.compare[+b.dataset.copen]));save();go('verdict');});
}

/* =========================================================
   7. Répertoire des défauts
   ========================================================= */
const R={q:'',brand:'',conf:false};
function viewRepertoire(){
  const brands=[...new Set(MODELS.map(m=>m.marque))].sort((a,b)=>a.localeCompare(b,'fr'));
  app.innerHTML=`<section class="view"><div class="wide">
    <h1 class="h1">Répertoire des défauts</h1>
    <p class="lede">${MODELS.length} générations depuis 2010. Chaque défaut est rattaché à un moteur, une boîte ou un carburant, et sourcé.</p>
    <div class="rep-tools">
      <div><label class="l" for="r-q">Rechercher</label><input class="inp" id="r-q" type="search" placeholder="Modèle, moteur ou défaut (ex. courroie, N47, DSG)" value="${esc(R.q)}"></div>
      <div><label class="l" for="r-brand">Marque</label><select class="inp" id="r-brand"><option value="">Toutes les marques</option>${brands.map(b=>`<option ${b===R.brand?'selected':''}>${esc(b)}</option>`).join('')}</select></div>
      <label class="check"><input type="checkbox" id="r-conf" ${R.conf?'checked':''}> Confirmés seulement</label>
    </div>
    <div class="rep" id="rep"></div>
  </div></section>`;
  $('#r-q').oninput=e=>{R.q=e.target.value;renderRep();};
  $('#r-brand').onchange=e=>{R.brand=e.target.value;renderRep();};
  $('#r-conf').onchange=e=>{R.conf=e.target.checked;renderRep();};
  renderRep();
}
function renderRep(){
  const q=E.norm(R.q);
  const out=MODELS.filter(m=>!R.brand||m.marque===R.brand).map(m=>{
    const defs=DEFECTS.filter(d=>(!R.conf||d.confiance==='confirmé')
      &&(m.moteurs.some(e=>E.applies(d,m,e,null))||m.boites.some(b=>E.applies(d,m,null,b))||E.applies(d,m,null,null))
      &&(!d.annees||(d.annees[1]>=m.annees[0]&&d.annees[0]<=m.annees[1])));
    const hay=E.norm(label(m)+' '+m.moteurs.map(e=>e.libelle).join(' ')+' '+defs.map(d=>d.titre).join(' '));
    return {m,defs,ok:!q||q.split(' ').every(w=>hay.includes(w))};
  }).filter(x=>x.ok);
  const shown=out.slice(0,60);
  $('#rep').innerHTML=out.length?shown.map(({m,defs})=>`<article class="card">
    <span class="h2">${esc(m.marque)}</span><h3>${esc(m.modele)} ${esc(m.generation)}</h3>
    <span style="font-size:13px;color:var(--muted)">${m.annees[0]}–${m.annees[1]} · ${m.moteurs.length} motorisation${m.moteurs.length>1?'s':''}</span>
    ${defs.length?`<ul>${[...defs].sort((a,b)=>b.gravite-a.gravite).slice(0,8).map(d=>`<li>${tagHtml(d.rappel?'info':d.gravite===3?'crit':d.gravite===2?'warn':'muted',d.rappel?'Rappel':GL[d.gravite])}<span>${esc(d.titre)}${d.confiance==='confirmé'?'':' <span style="color:var(--muted)">(à confirmer)</span>'}</span></li>`).join('')}${defs.length>8?`<li style="color:var(--muted)">+ ${defs.length-8} autre(s)</li>`:''}</ul>`:`<p style="margin:0;color:var(--muted);font-size:13.5px">Aucun défaut répertorié pour l'instant.</p>`}
    <button class="btn small" data-rep="${m.id}" style="align-self:flex-start;margin-top:auto">Évaluer ce modèle</button></article>`).join('')
    +(out.length>shown.length?`<p class="hint">${out.length-shown.length} autres générations : précisez la recherche ou choisissez une marque.</p>`:'')
    :`<p class="lede">Aucun résultat pour cette recherche.</p>`;
  document.querySelectorAll('[data-rep]').forEach(b=>b.onclick=()=>{const m=MODELS.find(x=>x.id===b.dataset.rep);S.cur=blank(m,0,defaultYear(m));save();go('annonce');});
}

const OWNER=ownerViews({LOGO:window.MV_LOGO||'assets/logo.png',E,H:HL,store:STORE,app,$,esc,go,toast,copy,tagHtml,ICON,DATA,render,backBtn,isFresh:()=>fresh});
const VIEWS={...OWNER.views,accueil:viewAccueil,annonce:viewAnnonce,verdict:viewVerdict,details:viewDetails,visite:viewVisite,comparer:viewComparer,repertoire:viewRepertoire};
$('#stats').textContent=`${MODELS.length} générations · ${DEFECTS.length} défauts sourcés · base du ${fmtDate(DATA.version)}`;
render();
})();
