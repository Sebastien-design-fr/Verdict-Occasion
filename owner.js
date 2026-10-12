/* Ausculto V2 — écrans du propriétaire : Mon véhicule, Anticiper, Décider, Agir.
   ownerViews(ctx) renvoie les vues à brancher dans le routeur de ui.js.
   La logique est dans health.js, le stockage dans store.js. */
function ownerViews(ctx){
const {E,H,store,app,$,esc,go,toast,copy,tagHtml,ICON}=ctx;
const {MODELS,nf,eur,NOW}=E;
const NA=H.NA;

/* ---- État du garage (véhicules du propriétaire), gardé dans ce navigateur ---- */
const loaded=store.load();
let G=loaded.state;
const storageOK=loaded.available;
function persist(){if(!store.save(G))toast('Sauvegarde impossible dans ce navigateur : exportez vos données.');}
const active=()=>G.vehicles.find(v=>v.id===G.activeId)||G.vehicles[0]||null;
const hasVehicle=()=>!!active();

const LV={red:{l:'Vérification prioritaire',cls:'lv-red'},orange:{l:'Point à surveiller',cls:'lv-orange'},green:{l:'Information ou entretien préventif',cls:'lv-green'}};
const dot=code=>`<i class="lvdot ${LV[code].cls}" aria-hidden="true"></i>`;
const fmtDate=H.fmtDate;
const val=x=>x==null||x===''?`<span class="na">${NA}</span>`:esc(x);
const disclaimer='<p class="hint">Ausculto présente des défauts documentés pour une motorisation, pas l\'état réel de votre véhicule. Il ne remplace pas un diagnostic mécanique.</p>';

function vehicleHead(v,actions=true){
  const x=H.describe(v);
  return `<section class="card vhead">
    <div class="vhead-t"><div style="min-width:0">${v.nom?`<span class="h2">${esc(x.name)}</span>`:''}<h2 class="vname">${esc(x.title)}</h2>
      <div class="vsub">${esc(x.m.modele)} ${esc(x.generation)} · ${v.year} · ${esc(x.engine)}</div></div>
      ${actions?`<button class="btn small" data-go="ajout" data-edit="1">Modifier</button>`:''}</div>
  </section>`;
}
function switcher(){
  if(G.vehicles.length<2)return '';
  return `<div class="vswitch" role="group" aria-label="Mes véhicules">${G.vehicles.map(v=>{const x=H.describe(v);return `<button class="chip-btn" data-vsel="${esc(v.id)}" aria-pressed="${v.id===G.activeId}">${esc(x?x.title:'?')}</button>`;}).join('')}</div>`;
}
function bindCommon(){
  document.querySelectorAll('[data-vsel]').forEach(b=>b.onclick=()=>{G.activeId=b.dataset.vsel;persist();ctx.render();});
  document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>{A=formFrom(active());}));
}
function noVehicle(title){
  app.innerHTML=`<section class="view"><div class="col"><h1 class="h1">${esc(title)}</h1>
    <div class="empty"><p>Ajoutez d'abord votre véhicule : Ausculto en a besoin pour retrouver les défauts documentés de sa motorisation.</p>
    <button class="btn primary" data-go="ajout">+ Ajouter mon véhicule</button></div></div></section>`;
}

/* =========================================================
   Accueil et tableau de bord « Mon véhicule »
   ========================================================= */
function viewVehicule(){
  const v=active();
  if(!v){
    app.innerHTML=`<section class="view"><div class="col welcome">
      <div class="hero"><span class="h2">Bienvenue sur Ausculto</span>
        <h1 class="h1">Votre assistant personnel de santé mécanique automobile.</h1>
        <p class="lede">Connaître les faiblesses de son véhicule, anticiper les problèmes mécaniques et prendre les bonnes décisions avant de dépenser.</p></div>
      <button class="btn primary" data-go="ajout" id="add-first">+ Ajouter mon véhicule</button>
      <button class="btn block" data-go="accueil">Analyser une voiture avant achat</button>
      <div class="pillars">
        <div class="pillar"><b>Anticiper</b><span>Les défauts documentés de votre motorisation, leurs symptômes et les contrôles utiles.</span></div>
        <div class="pillar"><b>Décider</b><span>Un devis important comparé à la valeur du véhicule, avec trois scénarios.</span></div>
        <div class="pillar"><b>Agir</b><span>Les prises en charge constructeur recensées, les justificatifs et un courrier type.</span></div>
      </div>
      <p class="hint">Aucun compte, aucun serveur : vos données restent dans ce navigateur. Ausculto n'affiche ni score de fiabilité ni probabilité de panne.</p>
      ${importBlock()}
    </div></section>`;
    A=formFrom(null);bindImport();return;
  }
  const x=H.describe(v),k=H.knowledge(v);
  const top=k.list.filter(i=>i.level.code!=='green').slice(0,3);
  const iv=[...(v.interventions||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.km||0)-(a.km||0));
  app.innerHTML=`<section class="view"><div class="wide dash">
    ${switcher()}
    <div class="dash-grid">
      <div class="dash-main">
        <div class="o1">${vehicleHead(v)}</div>
        <section class="card o2">
          <div class="bar"><h2 class="h2">État des connaissances mécaniques</h2></div>
          <div class="tiles">
            <div class="tile"><b class="num">${k.total}</b><span>défaut${k.total>1?'s':''} documenté${k.total>1?'s':''}</span></div>
            <div class="tile"><b class="num">${k.confirmes}</b><span>confirmé${k.confirmes>1?'s':''}</span></div>
            <div class="tile"><b class="num">${k.rouge+k.orange}</b><span>point${k.rouge+k.orange>1?'s':''} de vigilance</span></div>
            <div class="tile"><b class="num">${k.checks.length}</b><span>contrôle${k.checks.length>1?'s':''} recommandé${k.checks.length>1?'s':''}</span></div>
            <div class="tile"><b class="num">${k.rappels}</b><span>rappel${k.rappels>1?'s':''} recensé${k.rappels>1?'s':''}</span></div>
          </div>
          ${k.empty?`<div class="alert info">${esc(k.emptyNote)}</div>`:`<p class="hint">Pas de score global de fiabilité : le nombre de défauts recensés dépend surtout de ce qui a été documenté, pas de la fiabilité réelle.</p>`}
        </section>
        <section class="card o5">
          <h2 class="h2">Identification</h2>
          <dl class="kv">
            <div><dt>Véhicule</dt><dd>${esc(x.name)}</dd></div>
            <div><dt>Génération</dt><dd>${esc(x.generation)} (${esc(x.period)})</dd></div>
            <div><dt>Année</dt><dd>${v.year}${v.mec?' · 1re mise en circulation '+fmtDate(v.mec):''}</dd></div>
            <div><dt>Motorisation</dt><dd>${esc(x.engine)} · ${esc(x.fuel)}${x.power?' · environ '+x.power+' ch':''}</dd></div>
            <div><dt>Famille moteur (base Ausculto)</dt><dd class="mono">${val(x.engineCode)}</dd></div>
            <div><dt>Boîte</dt><dd>${esc(x.gearbox)}</dd></div>
            <div><dt>Kilométrage enregistré</dt><dd><span class="num">${nf.format(v.km)} km</span>${v.kmDate?` <span class="muted">au ${fmtDate(v.kmDate)}</span>`:''}</dd></div>
          </dl>
          <form class="kmform" id="km-form"><label class="l" for="km-new">Mettre à jour le kilométrage</label>
            <div class="inline"><input class="inp num" id="km-new" type="number" inputmode="numeric" min="0" step="100" placeholder="${nf.format(v.km)}"><button class="btn" type="submit">Enregistrer</button></div></form>
        </section>
      </div>
      <div class="dash-side">
        <section class="stack o3">
          <div class="bar"><h2 class="h2">Points de vigilance</h2>${k.total?`<button class="linkbtn" data-go="anticiper">Tout voir (${k.total})</button>`:''}</div>
          ${top.length?top.map(i=>miniCard(i)).join(''):`<div class="alert ok">${k.total?'Aucun point prioritaire ou à surveiller selon les informations enregistrées. Les autres défauts documentés sont dans « Anticiper ».':'Aucun point de vigilance documenté.'}</div>`}
        </section>
        <div class="actions2 o4">
          <button class="btn" data-go="decider">Analyser un devis</button>
          <button class="btn" data-go="agir">Mes recours</button>
        </div>
        <section class="card o6" id="hist">
          <div class="bar"><h2 class="h2">Historique des interventions</h2><button class="btn small" id="iv-open">+ Ajouter</button></div>
          <div id="iv-form-box" hidden>${interventionForm(v)}</div>
          ${iv.length?`<ul class="ivlist">${iv.map(i=>ivItem(v,i)).join('')}</ul>`:'<p class="muted" style="margin:0">Aucune intervention enregistrée. Ajoutez vos entretiens et réparations : les recommandations en tiennent compte.</p>'}
        </section>
        ${dataBlock()}
      </div>
    </div>
    ${disclaimer}
  </div></section>`;
  bindCommon();
  $('#km-form').onsubmit=e=>{e.preventDefault();const n=Number($('#km-new').value);
    if(!(n>=0)||$('#km-new').value===''){toast('Indiquez un kilométrage.');return;}
    if(n<v.km&&!confirm('Ce kilométrage est inférieur au précédent. Enregistrer quand même ?'))return;
    v.km=n;v.kmDate=new Date().toISOString().slice(0,10);persist();toast('Kilométrage enregistré');ctx.render();};
  $('#iv-open').onclick=()=>{const b=$('#iv-form-box');b.hidden=!b.hidden;if(!b.hidden)$('#iv-titre').focus();};
  bindInterventionForm(v);bindIvItems(v);bindData();
}
function miniCard(i){
  return `<button class="mini ${LV[i.level.code].cls}" data-go="anticiper" data-open="${esc(i.d.id)}">
    <span class="mini-l">${dot(i.level.code)}<span>${esc(i.level.label)}</span></span>
    <b>${esc(i.d.titre)}</b><span class="muted">${esc(i.organe)} · ${esc(i.level.reason)}</span></button>`;
}

/* ---- Interventions ---- */
function interventionForm(v,preset){
  const defs=H.defectsFor(v);const p=preset||{};
  return `<form class="ivform" id="iv-form">
    <div><label class="l" for="iv-titre">Intervention réalisée</label><input class="inp" id="iv-titre" maxlength="120" required placeholder="Ex. : remplacement de la courroie de distribution" value="${esc(p.titre||'')}"></div>
    <div class="row2"><div><label class="l" for="iv-date">Date</label><input class="inp" id="iv-date" type="date" value="${esc(p.date||'')}"></div>
      <div><label class="l" for="iv-km">Kilométrage</label><input class="inp num" id="iv-km" type="number" inputmode="numeric" min="0" step="100" value="${p.km??''}"></div></div>
    <div class="row2"><div><label class="l" for="iv-cout">Coût (€)</label><input class="inp num" id="iv-cout" type="number" inputmode="decimal" min="0" step="10" value="${p.cout??''}"></div>
      <div><label class="l" for="iv-def">Défaut concerné</label><select class="inp" id="iv-def"><option value="">Aucun / je ne sais pas</option>${defs.map(i=>`<option value="${esc(i.d.id)}" ${p.defaut===i.d.id?'selected':''}>${esc(i.d.titre)}</option>`).join('')}</select></div></div>
    <div><label class="l" for="iv-com">Commentaire</label><input class="inp" id="iv-com" maxlength="500" placeholder="Garage, pièces, référence de facture…" value="${esc(p.commentaire||'')}"></div>
    <p class="hint" style="margin:0">Une intervention liée à un défaut le fait passer en vert, sans garantir qu'il ne réapparaîtra pas.</p>
    <div class="inline"><button class="btn primary-s" type="submit">${p.id?'Enregistrer les modifications':'Enregistrer l\'intervention'}</button><button class="btn" type="button" id="iv-cancel">Annuler</button></div>
    <input type="hidden" id="iv-id" value="${esc(p.id||'')}">
  </form>`;
}
function bindInterventionForm(v,after){
  const f=$('#iv-form');if(!f)return;
  f.onsubmit=e=>{e.preventDefault();
    const r=H.makeIntervention({id:$('#iv-id').value||null,titre:$('#iv-titre').value,date:$('#iv-date').value,km:$('#iv-km').value,cout:$('#iv-cout').value,commentaire:$('#iv-com').value,defaut:$('#iv-def').value||null});
    if(!r.ok){toast(r.error);return;}
    const k=v.interventions.findIndex(i=>i.id===r.i.id);
    if(k>=0)v.interventions[k]=r.i;else v.interventions.push(r.i);
    if(r.i.km&&r.i.km>v.km){v.km=r.i.km;v.kmDate=r.i.date||new Date().toISOString().slice(0,10);}
    persist();toast('Intervention enregistrée');(after||ctx.render)();};
  $('#iv-cancel').onclick=()=>{(after||ctx.render)();};
}
function ivItem(v,i){
  const d=i.defaut&&E.DEFECTS.find(x=>x.id===i.defaut);
  return `<li class="iv"><div class="grow"><b>${esc(i.titre)}</b>
    <span class="muted">${i.date?fmtDate(i.date):'Date non renseignée'} · ${i.km!=null?nf.format(i.km)+' km':'km non renseigné'}${i.cout!=null?' · '+eur(i.cout):''}</span>
    ${d?`<span class="muted">Défaut : ${esc(d.titre)}</span>`:''}${i.commentaire?`<span class="muted">${esc(i.commentaire)}</span>`:''}</div>
    <div class="iv-act"><button class="linkbtn" data-iv-edit="${esc(i.id)}">Modifier</button><button class="linkbtn danger" data-iv-del="${esc(i.id)}">Supprimer</button></div></li>`;
}
function bindIvItems(v,after){
  document.querySelectorAll('[data-iv-edit]').forEach(b=>b.onclick=()=>{const i=v.interventions.find(x=>x.id===b.dataset.ivEdit);
    const box=$('#iv-form-box');box.innerHTML=interventionForm(v,i);box.hidden=false;bindInterventionForm(v,after);box.scrollIntoView({block:'nearest'});});
  document.querySelectorAll('[data-iv-del]').forEach(b=>b.onclick=()=>{if(!confirm('Supprimer cette intervention de votre historique ?'))return;
    v.interventions=v.interventions.filter(x=>x.id!==b.dataset.ivDel);persist();toast('Intervention supprimée');(after||ctx.render)();});
}

/* ---- Données : export, import, suppression ---- */
function dataBlock(){
  return `<details class="card data o7"><summary><span class="h2">Mes données</span></summary>
    <p class="hint">Vos véhicules sont enregistrés dans ce navigateur${storageOK?'':' — le stockage local est indisponible ici : exportez avant de fermer'}. Exportez-les pour les sauvegarder ou les transférer sur un autre appareil.</p>
    <div class="inline wrap"><button class="btn" id="exp">Exporter (JSON)</button>${importInput()}<button class="btn" data-go="ajout" id="add-other">+ Autre véhicule</button>
    <button class="btn danger" id="del-v">Retirer ce véhicule</button></div></details>`;
}
const importInput=()=>`<label class="btn" for="imp-file">Importer<input type="file" id="imp-file" accept="application/json,.json" hidden></label>`;
const importBlock=()=>`<details class="card data"><summary><span class="h2">J'ai une sauvegarde</span></summary><div class="inline wrap">${importInput()}</div></details>`;
function bindImport(){
  const f=$('#imp-file');if(!f)return;
  f.onchange=()=>{const file=f.files[0];if(!file)return;const rd=new FileReader();
    rd.onload=()=>{const r=store.importJSON(String(rd.result));
      if(!r.ok){toast(r.errors[0]);return;}
      if(G.vehicles.length&&!confirm(`Remplacer vos ${G.vehicles.length} véhicule(s) enregistré(s) par les ${r.data.vehicles.length} du fichier ?`))return;
      G=r.data;persist();toast(`${r.data.vehicles.length} véhicule(s) importé(s)${r.warnings.length?' · '+r.warnings.length+' ignoré(s)':''}`);go('vehicule');ctx.render();};
    rd.readAsText(file);};
}
function bindData(){
  const ex=$('#exp');if(ex)ex.onclick=()=>{const blob=new Blob([store.exportJSON(G)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`ausculto-sauvegarde-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Sauvegarde téléchargée');};
  const ao=$('#add-other');if(ao)ao.addEventListener('click',()=>{A=formFrom(null);});
  const dv=$('#del-v');if(dv)dv.onclick=()=>{const v=active();if(!v)return;const x=H.describe(v);
    if(!confirm(`Retirer « ${x.title} » et son historique de ce navigateur ? Pensez à exporter avant.`))return;
    G.vehicles=G.vehicles.filter(y=>y.id!==v.id);G.activeId=G.vehicles[0]?G.vehicles[0].id:null;persist();toast('Véhicule retiré');ctx.render();};
  bindImport();
}

/* =========================================================
   Ajouter ou modifier un véhicule
   ========================================================= */
let A=null;
function formFrom(v){
  if(!v)return {id:null,q:'',brand:'',model:'',eng:-1,year:0,box:0,km:'',mec:'',nom:'',known:[]};
  const m=MODELS.find(x=>x.id===v.model);
  return {id:v.id,q:'',brand:m.marque,model:m.id,eng:v.eng,year:v.year,box:v.box,km:v.km,mec:v.mec||'',nom:v.nom||'',known:[]};
}
function viewAjout(){
  if(!A)A=formFrom(null);
  const brands=[...new Set(MODELS.map(m=>m.marque))].sort((a,b)=>a.localeCompare(b,'fr'));
  const models=A.brand?MODELS.filter(m=>m.marque===A.brand).sort((a,b)=>a.modele.localeCompare(b.modele,'fr')||a.annees[0]-b.annees[0]):[];
  const m=A.model&&MODELS.find(x=>x.id===A.model);
  const years=[];if(m)for(let y=m.annees[1];y>=m.annees[0];y--)years.push(y);
  const editing=!!A.id;
  let preview='';
  if(m&&A.eng>=0){
    const tmp=H.makeVehicle({model:m.id,eng:A.eng,box:A.box,year:A.year||years[years.length-1],km:Number(A.km)||0});
    const defs=tmp.ok?H.defectsFor(tmp.v):[];
    preview=`<div class="alert info">${defs.length?`<b>${defs.length} défaut${defs.length>1?'s':''} documenté${defs.length>1?'s':''}</b> pour cette motorisation et cette année.`:'Aucun défaut documenté dans la base pour cette version : cela ne prouve pas sa fiabilité.'}</div>
    ${!editing&&defs.length?`<details class="card" ${A.known.length?'open':''}><summary><b>Interventions déjà réalisées sur ces points</b> <span class="muted">(facultatif)</span></summary>
      <p class="hint">Cochez ce qui a déjà été fait, factures à l'appui. Vous pourrez préciser la date et le kilométrage ensuite.</p>
      ${defs.map(i=>`<label class="vchk"><input type="checkbox" data-known="${esc(i.d.id)}" ${A.known.includes(i.d.id)?'checked':''}><span>${esc(i.d.titre)}<small>${esc(i.organe)}</small></span></label>`).join('')}</details>`:''}`;
  }
  app.innerHTML=`<section class="view"><div class="col">
    <div class="bar">${ctx.backBtn('vehicule',hasVehicle()?'Mon véhicule':'Accueil')}<span class="step-l">${editing?'Modifier le véhicule':'Ajouter mon véhicule'}</span></div>
    <h1 class="h1">${editing?'Modifier mon véhicule':'Mon véhicule'}</h1>
    ${editing?'':`<div><label class="l" for="a-q">Recherche rapide</label>
      <div class="searchbox">${ICON.search}<input id="a-q" type="search" autocomplete="off" placeholder="Ex. : 308 PureTech 2018, Clio dCi, 320d" value="${esc(A.q)}"></div>
      <div id="a-res"></div></div>
    <div class="or">ou choisissez</div>`}
    <div class="row2 stack">
      <div><label class="l" for="a-brand">Marque</label><select class="inp" id="a-brand"><option value="">Choisir…</option>${brands.map(b=>`<option ${b===A.brand?'selected':''}>${esc(b)}</option>`).join('')}</select></div>
      <div><label class="l" for="a-model">Modèle</label><select class="inp" id="a-model" ${A.brand?'':'disabled'}><option value="">Choisir…</option>${models.map(x=>`<option value="${x.id}" ${x.id===A.model?'selected':''}>${esc(x.modele)} ${esc(x.generation)} (${x.annees[0]}–${x.annees[1]})</option>`).join('')}</select></div>
    </div>
    ${m?`<div><label class="l" for="a-eng">Motorisation exacte</label><select class="inp" id="a-eng"><option value="-1">Choisir…</option>${m.moteurs.map((e,i)=>`<option value="${i}" ${i===A.eng?'selected':''}>${esc(e.libelle)} · ${esc(e.carburant)}</option>`).join('')}</select></div>
    <div class="row2">
      <div><label class="l" for="a-year">Année</label><select class="inp" id="a-year"><option value="0">Choisir…</option>${years.map(y=>`<option ${y===A.year?'selected':''}>${y}</option>`).join('')}</select></div>
      <div><label class="l" for="a-km">Kilométrage actuel</label><input class="inp num" id="a-km" type="number" inputmode="numeric" min="0" step="1000" value="${esc(A.km)}" placeholder="Ex. 98 000"></div>
    </div>
    ${m.boites.length>1?`<div><label class="l" for="a-box">Boîte de vitesses</label><select class="inp" id="a-box">${m.boites.map((b,i)=>`<option value="${i}" ${i===A.box?'selected':''}>${esc(b.libelle)}</option>`).join('')}</select></div>`:''}
    <details class="card" ${A.mec||A.nom?'open':''}><summary><b>Précisions</b> <span class="muted">(facultatif)</span></summary>
      <div class="row2" style="margin-top:10px"><div><label class="l" for="a-mec">1re mise en circulation</label><input class="inp" id="a-mec" type="month" value="${esc(A.mec)}"><p class="hint">Rubrique B de la carte grise : affine le calcul d'âge des prises en charge.</p></div>
      <div><label class="l" for="a-nom">Surnom</label><input class="inp" id="a-nom" maxlength="60" value="${esc(A.nom)}" placeholder="Ex. : la 308 de Julie"></div></div></details>
    <div id="a-prev">${preview}</div>`:''}
    <div id="a-err"></div>
    <button class="btn primary" id="a-save" type="button" ${m?'':'disabled'}>${editing?'Enregistrer':'Enregistrer mon véhicule'}</button>
  </div></section>`;
  const q=$('#a-q');
  if(q){q.oninput=()=>{A.q=q.value;renderSearch();};renderSearch();}
  $('#a-brand').onchange=e=>{A.brand=e.target.value;A.model='';A.eng=-1;A.year=0;A.known=[];viewAjout();};
  $('#a-model').onchange=e=>{A.model=e.target.value;A.eng=-1;A.year=0;A.box=0;A.known=[];viewAjout();};
  const fe=$('#a-eng');if(fe)fe.onchange=e=>{A.eng=+e.target.value;A.known=[];viewAjout();};
  const fy=$('#a-year');if(fy)fy.onchange=e=>{A.year=+e.target.value;viewAjout();};
  const fk=$('#a-km');if(fk)fk.oninput=e=>{A.km=e.target.value;};
  const fb=$('#a-box');if(fb)fb.onchange=e=>{A.box=+e.target.value;viewAjout();};
  const fm=$('#a-mec');if(fm)fm.onchange=e=>{A.mec=e.target.value;};
  const fn=$('#a-nom');if(fn)fn.oninput=e=>{A.nom=e.target.value;};
  document.querySelectorAll('[data-known]').forEach(c=>c.onchange=()=>{A.known=c.checked?[...new Set([...A.known,c.dataset.known])]:A.known.filter(x=>x!==c.dataset.known);});
  $('#a-save').onclick=saveVehicle;
}
function renderSearch(){
  const box=$('#a-res');if(!box)return;
  if(!A.q.trim()){box.innerHTML='';return;}
  const res=E.search(A.q,8);
  box.innerHTML=res.length?`<div class="list" style="margin-top:8px">${res.map((x,k)=>`<button class="item" data-apick="${k}"><span class="grow"><span class="t">${esc(x.m.marque)} ${esc(x.m.modele)} ${esc(x.m.generation)} · ${esc(E.shortEngine(x.e))}</span><span class="s">${x.m.annees[0]}–${x.m.annees[1]} · ${esc(x.e.carburant)}</span></span>${ICON.chev}</button>`).join('')}</div>`
    :`<div class="alert warn" style="margin-top:8px">Aucun modèle trouvé pour « ${esc(A.q)} ». Essayez la marque et le modèle seuls, ou utilisez les listes ci-dessous.</div>`;
  res.forEach((x,k)=>{box.querySelector(`[data-apick="${k}"]`).onclick=()=>{
    A.brand=x.m.marque;A.model=x.m.id;A.eng=x.i;A.q='';A.known=[];A.box=0;
    A.year=x.year&&x.year>=x.m.annees[0]&&x.year<=x.m.annees[1]?x.year:0;viewAjout();
    const n=A.year?$('#a-km'):$('#a-year');if(n)n.focus();};});
}
function saveVehicle(){
  const err=t=>{$('#a-err').innerHTML=`<div class="alert warn">${esc(t)}</div>`;};
  if(!A.model)return err('Choisissez le modèle.');
  if(!(A.eng>=0))return err('Choisissez la motorisation exacte.');
  if(!A.year)return err('Choisissez l\'année.');
  if(A.km===''||A.km==null)return err('Indiquez le kilométrage actuel.');
  const old=A.id&&G.vehicles.find(v=>v.id===A.id);
  const base=old?{...old}:{};
  const sameEngine=old&&old.model===A.model&&old.eng===A.eng;
  const r=H.makeVehicle({...base,id:A.id,model:A.model,eng:A.eng,box:A.box,year:A.year,km:Number(A.km),mec:A.mec||null,nom:A.nom,
    kmDate:old&&Number(A.km)===old.km?old.kmDate:null,
    interventions:old?(sameEngine?old.interventions:old.interventions.map(i=>({...i,defaut:null}))):A.known.map(id=>{const d=E.DEFECTS.find(x=>x.id===id);
      return H.makeIntervention({titre:`Traité avant l'ajout : ${d.titre}`,defaut:id,commentaire:'Déclaré à l\'ajout du véhicule'}).i;}),
    symptomes:old&&sameEngine?old.symptomes:[]});
  if(!r.ok)return err(r.error);
  if(old)G.vehicles[G.vehicles.indexOf(old)]=r.v;else G.vehicles.push(r.v);
  G.activeId=r.v.id;persist();A=null;toast(old?'Véhicule mis à jour':'Véhicule enregistré');go('vehicule');
}

/* =========================================================
   Anticiper : cartes de vigilance
   ========================================================= */
const F={lv:'all',open:null};
function defectCard(i,v,open){
  const d=i.d;
  const pols=i.policies.length;
  const sym=(v.symptomes||[]).includes(d.id);
  return `<details class="dcard ${LV[i.level.code].cls}" data-id="${esc(d.id)}" ${open?'open':''}>
    <summary>
      <div class="dc-top">${dot(i.level.code)}<span class="dc-lv">${esc(i.level.label)}</span>${d.rappel?tagHtml('info','Rappel officiel'):''}${pols?tagHtml('ok','Prise en charge recensée'):''}</div>
      <h3>${esc(d.titre)}</h3>
      <div class="dc-meta"><span>${esc(i.organe)}</span><span>Gravité technique : ${esc(i.gravite.toLowerCase())}</span><span>${esc(i.evidence.label)}</span></div>
      <p class="dc-reason">${esc(i.level.reason)}</p>
    </summary>
    <div class="dc-body">
      <dl>
        <div><dt>Description et symptômes</dt><dd>${val(d.symptomes)}</dd></div>
        <div><dt>Kilométrage indicatif</dt><dd>${esc(i.kmText)}</dd></div>
        <div><dt>Contrôles possibles</dt><dd>${val(d.controle)}</dd></div>
        <div><dt>Mesures préventives et solutions</dt><dd>${val(d.solution)}</dd></div>
        <div><dt>Coût de réparation estimatif</dt><dd>${esc(i.cost.txt)}</dd></div>
        <div><dt>Niveau de preuve</dt><dd>${esc(i.evidence.label)} : ${esc(i.evidence.explain)}</dd></div>
      </dl>
      <details class="srcbox"><summary class="linkbtn">Sources (${d.sources.length})</summary>
        <ul class="srcs">${d.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a>${s.type==='forum'?' '+tagHtml('muted','Témoignages'):s.type==='officiel'?' '+tagHtml('info','Officiel'):''}</li>`).join('')}</ul></details>
      <div class="inline wrap">
        <button class="btn small ${sym?'on':''}" data-sym="${esc(d.id)}" aria-pressed="${sym}">${sym?'Symptôme signalé — retirer':'Je constate ce symptôme'}</button>
        <button class="btn small" data-ivfor="${esc(d.id)}">Enregistrer une intervention</button>
        ${pols?`<button class="btn small" data-agir="${esc(d.id)}">Voir la prise en charge</button>`:''}
      </div>
    </div>
  </details>`;
}
function viewAnticiper(){
  const v=active();if(!v)return noVehicle('Anticiper');
  const k=H.knowledge(v);
  const list=k.list.filter(i=>F.lv==='all'||i.level.code===F.lv);
  const counts={all:k.total,red:k.rouge,orange:k.orange,green:k.vert};
  app.innerHTML=`<section class="view"><div class="col">
    ${switcher()}
    <h1 class="h1">Anticiper</h1>
    <p class="lede">Les faiblesses documentées de votre ${esc(H.describe(v).title)}, à ${nf.format(v.km)} km.</p>
    <div class="legend">
      <span>${dot('red')} Vérification prioritaire : symptôme signalé ou rappel</span>
      <span>${dot('orange')} Point à surveiller</span>
      <span>${dot('green')} Information ou entretien préventif</span>
    </div>
    <p class="hint" style="margin-top:-8px">Ces niveaux ne sont pas des probabilités de panne. Ils dépendent de vos déclarations, des rappels et de votre kilométrage par rapport aux plages documentées.</p>
    ${k.empty?`<div class="alert info">${esc(k.emptyNote)}</div>`:`
    <div class="seg" role="group" aria-label="Filtrer">${[['all','Tous'],['red','Prioritaire'],['orange','À surveiller'],['green','Information']].map(([c,l])=>`<button type="button" data-flt="${c}" aria-pressed="${F.lv===c}">${l} (${counts[c]})</button>`).join('')}</div>
    <div id="iv-form-box" hidden></div>
    <div class="stack">${list.length?list.map((i,n)=>defectCard(i,v,F.open?F.open===i.d.id:n===0&&i.level.code!=='green')).join(''):'<div class="alert ok">Aucun point dans cette catégorie.</div>'}</div>
    ${k.checks.length?`<section class="card"><h2 class="h2">Contrôles recommandés</h2><ul class="checks">${k.checks.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></section>`:''}`}
    ${disclaimer}
    <p class="hint">Base du ${fmtDate(ctx.DATA.version)}. Coûts : fourchettes indicatives établies par la rédaction à partir des sources, pas des moyennes mesurées.</p>
  </div></section>`;
  bindCommon();
  document.querySelectorAll('[data-flt]').forEach(b=>b.onclick=()=>{F.lv=b.dataset.flt;F.open=null;viewAnticiper();});
  document.querySelectorAll('[data-sym]').forEach(b=>b.onclick=()=>{const id=b.dataset.sym;
    v.symptomes=v.symptomes.includes(id)?v.symptomes.filter(x=>x!==id):[...v.symptomes,id];persist();F.open=id;
    if(v.symptomes.includes(id)&&F.lv!=='all'&&F.lv!=='red')F.lv='all';keep(viewAnticiper);});
  document.querySelectorAll('[data-ivfor]').forEach(b=>b.onclick=()=>{const box=$('#iv-form-box');const d=E.DEFECTS.find(x=>x.id===b.dataset.ivfor);
    box.innerHTML=`<section class="card">${interventionForm(v,{defaut:d.id,km:v.km,titre:''})}</section>`;box.hidden=false;F.open=d.id;
    bindInterventionForm(v,()=>viewAnticiper());box.scrollIntoView({behavior:'smooth',block:'start'});$('#iv-titre').focus();});
  document.querySelectorAll('[data-agir]').forEach(b=>b.onclick=()=>{AG.defect=b.dataset.agir;go('agir');});
  if(F.open){const el=document.querySelector(`.dcard[data-id="${CSS.escape(F.open)}"]`);if(el&&ctx.isFresh())el.scrollIntoView({block:'start'});}
}
function keep(fn){const y=scrollY;fn();scrollTo(0,y);}

/* =========================================================
   Décider : analyser mon devis
   ========================================================= */
let Q=null;
function viewDecider(){
  const v=active();if(!v)return noVehicle('Décider');
  if(!Q||Q.vid!==v.id){const d=v.devis||{};Q={vid:v.id,panne:d.panne||'',defauts:d.defauts||[],amount:d.amount||'',repair:d.repair||'',userValue:d.userValue||'',shown:!!d.amount};}
  const defs=H.defectsFor(v);
  const sugg=Q.panne?H.matchPanne(v,Q.panne):[];
  const est=H.valueOf(v,0);
  const r=Q.shown?H.analyzeQuote({v,...Q}):null;
  app.innerHTML=`<section class="view"><div class="col ${r?'decide-col':''}">
    ${switcher()}
    <h1 class="h1">Analyser mon devis</h1>
    <p class="lede">Comparer une réparation importante à la valeur de votre ${esc(H.describe(v).title)} et repérer ce qui peut éclairer la décision.</p>
    <form class="card stack" id="q-form">
      <div><label class="l" for="q-panne">Nature de la panne</label><input class="inp" id="q-panne" value="${esc(Q.panne)}" placeholder="Ex. : voyant pression d'huile, courroie abîmée"></div>
      ${defs.length?`<div><span class="l">Défauts documentés correspondants <span class="muted">(à cocher si le garage les évoque)</span></span>
        <div class="pick">${defs.map(i=>{const s=sugg.find(x=>x.x.d.id===i.d.id);return `<label class="pickit ${s?'sugg':''}"><input type="checkbox" data-qdef="${esc(i.d.id)}" ${Q.defauts.includes(i.d.id)?'checked':''}><span>${esc(i.d.titre)}<small>${esc(i.organe)}${s?' · mots en commun avec votre description':''}</small></span></label>`;}).join('')}</div>
        <p class="hint">Un défaut répertorié n'est pas un diagnostic : seul le garage peut confirmer la cause de la panne.</p></div>`
        :`<div class="alert info">Aucun défaut documenté pour cette motorisation : l'analyse portera sur le montant et la valeur du véhicule.</div>`}
      <div class="row2"><div><label class="l" for="q-amount">Montant du devis (€ TTC)</label><input class="inp num" id="q-amount" type="number" inputmode="numeric" min="0" step="10" required value="${esc(Q.amount)}"></div>
        <div><label class="l" for="q-km">Kilométrage actuel</label><input class="inp num" id="q-km" type="number" inputmode="numeric" min="0" step="100" value="${v.km}"></div></div>
      <div><label class="l" for="q-repair">Réparation proposée</label><input class="inp" id="q-repair" value="${esc(Q.repair)}" placeholder="Ex. : remplacement courroie, pompe à huile et crépine"></div>
      <div><label class="l" for="q-value">Valeur du véhicule selon une estimation indépendante (€)</label><input class="inp num" id="q-value" type="number" inputmode="numeric" min="0" step="100" value="${esc(Q.userValue)}" placeholder="Facultatif">
        <p class="hint">${est.source==='estimation'?`Sans saisie, Ausculto utilise son estimation : ${eur(est.mid)} (de ${eur(est.low)} à ${eur(est.high)}), peu calibrée. Une cote La Centrale ou L'argus, ou une offre de reprise, est plus fiable.`:esc(est.note)}</p></div>
      <button class="btn primary" type="submit">Analyser le devis</button>
    </form>
    <div id="q-res">${r?quoteResult(r,v):''}</div>
  </div></section>`;
  bindCommon();
  const sync=()=>{Q.panne=$('#q-panne').value;Q.amount=$('#q-amount').value;Q.repair=$('#q-repair').value;Q.userValue=$('#q-value').value;};
  $('#q-panne').onchange=()=>{sync();keep(viewDecider);};
  document.querySelectorAll('[data-qdef]').forEach(c=>c.onchange=()=>{Q.defauts=c.checked?[...new Set([...Q.defauts,c.dataset.qdef])]:Q.defauts.filter(x=>x!==c.dataset.qdef);});
  $('#q-form').onsubmit=e=>{e.preventDefault();sync();
    const km=Number($('#q-km').value);if($('#q-km').value!==''&&km>=0&&km!==v.km){v.km=km;v.kmDate=new Date().toISOString().slice(0,10);}
    if(!(Number(Q.amount)>0)){toast('Indiquez le montant du devis.');$('#q-amount').focus();return;}
    Q.shown=true;v.devis={panne:Q.panne,defauts:Q.defauts,amount:Number(Q.amount),repair:Q.repair,userValue:Number(Q.userValue)||0,date:new Date().toISOString().slice(0,10)};persist();
    viewDecider();const res=$('#q-res');if(res)res.scrollIntoView({behavior:'smooth',block:'start'});};
  const pr=$('#q-print');if(pr)pr.onclick=()=>print();
  const ag=$('#q-agir');if(ag)ag.onclick=()=>{AG.defect=Q.defauts[0]||null;go('agir');};
}
function quoteResult(r,v){
  const val=r.value,ratio=r.ratio;
  const pct=ratio?Math.min(100,ratio.mid):0;
  return `<section class="stack printable" aria-label="Résultat de l'analyse">
    <div class="print-only"><h2>Ausculto · Analyse de devis</h2><p>${esc(H.describe(v).title)} · ${esc(H.describe(v).engine)} · ${v.year} · ${nf.format(v.km)} km · ${new Date().toLocaleDateString('fr-FR')}</p></div>
    <h2 class="h2">1. Identification de la panne</h2>
    ${r.matches.length?r.matches.map(i=>`<div class="card"><div class="dc-top">${dot(i.level.code)}<b>${esc(i.d.titre)}</b></div>
      <p style="margin:6px 0 0">${esc(i.d.symptomes)}</p><p class="hint">${esc(i.evidence.label)} · ${esc(i.cost.txt)}</p></div>`).join('')
      :`<div class="alert info">${r.panne?'Aucun défaut documenté sélectionné pour cette panne.':'Aucune panne décrite.'} Cela n'exclut rien : la base ne recense pas toutes les pannes possibles.</div>`}
    <p class="hint">Un défaut répertorié n'est jamais un diagnostic. Demandez au garage le diagnostic écrit et les codes défaut.</p>
    <h2 class="h2">2. Comparaison économique</h2>
    <div class="figs">
      <div class="fig"><span>Montant de la réparation</span><b>${eur(r.amount)}</b></div>
      <div class="fig"><span>${val.source==='utilisateur'?'Valeur saisie':'Valeur estimée'}</span><b>${val.mid?eur(val.mid):NA}</b>${val.source==='estimation'?`<small>de ${eur(val.low)} à ${eur(val.high)}</small>`:''}</div>
      <div class="fig wide"><span>Part de la valeur représentée par le devis</span><b>${ratio?Math.round(ratio.mid)+' %':NA}</b>${ratio&&val.source==='estimation'?`<small>entre ${Math.round(ratio.low)} et ${Math.round(ratio.high)} % selon la fourchette</small>`:''}
        ${ratio?`<div class="ratiobar" aria-hidden="true"><i style="width:${pct}%"></i>${ratio.mid>100?'<em>au-delà de 100 %</em>':''}</div>`:''}</div>
    </div>
    <ul class="facts">${r.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>
    <p class="hint">Calcul : montant du devis ÷ valeur du véhicule × 100. ${esc(val.note)} Résultat indicatif.</p>
    <h2 class="h2">3. Autres points mécaniques à vérifier</h2>
    ${r.others.length?`<div class="stack">${r.others.map(i=>`<div class="row-def">${dot(i.level.code)}<div><b>${esc(i.d.titre)}</b><span class="muted">${esc(i.level.reason)} ${esc(i.cost.txt)}.</span></div></div>`).join('')}</div>
      <p class="hint">Ces coûts ne s'additionnent pas : rien n'indique que ces défauts surviendront sur votre véhicule. Ils signalent ce qu'il peut être utile de faire contrôler en même temps.</p>`
      :'<p class="muted" style="margin:0">Aucun autre point prioritaire ou à surveiller enregistré pour ce véhicule.</p>'}
    <h2 class="h2">4. Aide à la décision</h2>
    <div class="scen">${r.scenarios.map(s=>`<article class="card"><h3>${esc(s.titre)}</h3>
      <div class="pc"><span class="pc-l pro">Pour</span><ul>${s.pour.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>
      <div class="pc"><span class="pc-l con">Contre</span><ul>${s.contre.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div></article>`).join('')}</div>
    <div class="alert info">${esc(r.verdict)}</div>
    <div class="inline wrap noprint"><button class="btn" id="q-print" type="button">Imprimer la synthèse</button>${r.matches.length?`<button class="btn" id="q-agir" type="button">Mes recours pour cette panne</button>`:''}</div>
    ${disclaimer}
  </section>`;
}

/* =========================================================
   Agir : mes recours et prises en charge
   ========================================================= */
const AG={defect:null,diag:''};
function viewAgir(){
  const v=active();if(!v)return noVehicle('Agir');
  const defs=H.defectsFor(v);
  if(AG.defect&&!defs.some(i=>i.d.id===AG.defect))AG.defect=null;
  if(!AG.defect&&v.devis&&v.devis.defauts&&v.devis.defauts[0])AG.defect=v.devis.defauts[0];
  const sel=defs.find(i=>i.d.id===AG.defect)||null;
  const res=H.policiesFor(v,AG.defect);
  const pol=res.items;
  const best=pol.find(i=>i.status.code==='documentee')||pol[0]||null;
  const amount=v.devis&&v.devis.defauts&&v.devis.defauts.includes(AG.defect)?v.devis.amount:0;
  const letter=H.letter({v,defect:sel&&sel.d,policy:best&&best.policy,amount});
  const withPol=defs.filter(i=>i.policies.length);
  app.innerHTML=`<section class="view"><div class="col">
    ${switcher()}
    <h1 class="h1">Mes recours et prises en charge</h1>
    <p class="lede">Identifier les démarches possibles face à une panne connue. Ausculto informe ; il ne donne pas de conclusion juridique et ne garantit aucune indemnisation.</p>
    <div class="card"><label class="l" for="ag-def">1. Panne concernée</label>
      ${defs.length?`<select class="inp" id="ag-def"><option value="">Choisir parmi les défauts documentés…</option>${defs.map(i=>`<option value="${esc(i.d.id)}" ${i.d.id===AG.defect?'selected':''}>${esc(i.d.titre)}${i.policies.length?' — prise en charge recensée':''}</option>`).join('')}</select>
      <p class="hint">${withPol.length?`${withPol.length} défaut${withPol.length>1?'s':''} de votre motorisation ${withPol.length>1?'ont':'a'} une politique recensée.`:'Aucune politique constructeur recensée pour les défauts de votre motorisation.'}</p>`
      :`<div class="alert info">Aucun défaut documenté pour cette motorisation. Les garanties légales et la garantie du constructeur ci-dessous restent valables.</div>`}
    </div>
    <section class="printable stack">
    <div class="print-only"><h2>Ausculto · Récapitulatif des démarches</h2><p>${esc(H.describe(v).title)} · ${esc(H.describe(v).engine)} · ${v.year} · ${nf.format(v.km)} km · ${new Date().toLocaleDateString('fr-FR')}</p>${sel?`<p>Panne : ${esc(sel.d.titre)}</p>`:''}</div>
    <h2 class="h2">2. Politique constructeur</h2>
    <div class="status st-${res.status.code}"><b>${esc(res.status.label)}</b>${res.status.why?`<span>${esc(res.status.why)}</span>`:''}</div>
    ${pol.map(it=>policyCard(it)).join('')}
    <h2 class="h2">3. Garanties légales et dispositifs commerciaux</h2>
    <div class="legal">${H.LEGAL.map(l=>`<div class="card"><b>${esc(l.titre)}</b><p>${esc(l.txt)}</p></div>`).join('')}</div>
    <p class="hint">Pour une situation précise, rapprochez-vous d'une association de consommateurs ou d'un professionnel du droit (votre assurance protection juridique, si vous en avez une).</p>
    <h2 class="h2">4. Préparer les démarches</h2>
    <div class="card"><b>Documents utiles</b><ul class="checks">${H.documents(v,AG.defect,pol).map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>
    <div class="card"><b>Questions à poser au garage</b><ul class="checks">${H.garageQuestions(sel&&sel.d,pol).map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>
    <div class="card"><b>Coordonnées et liens officiels</b>
      <p style="margin:6px 0 0">${pol.some(i=>i.policy.source_officielle)?'Voir les sources officielles ci-dessus.':`${NA} dans la base : aucune page officielle du constructeur n'est encore enregistrée. Adressez-vous au réseau agréé ${esc(H.describe(v).m.marque)} ou au service relations clientèle indiqué dans le carnet de garantie.`}</p></div>
    <div class="card noprint-pad"><div class="bar"><b>Modèle de courrier factuel</b><button class="btn small noprint" id="ag-copy">Copier</button></div>
      <textarea class="inp letter" id="ag-letter" rows="16" aria-label="Modèle de courrier">${esc(letter)}</textarea>
      <p class="hint">Complétez les passages entre crochets. Le courrier décrit des faits et demande un examen : il n'affirme aucun droit.</p></div>
    </section>
    <div class="inline wrap noprint"><button class="btn primary-s" id="ag-print">Imprimer le récapitulatif</button><button class="btn" data-go="decider">Analyser un devis</button></div>
    ${disclaimer}
  </div></section>`;
  bindCommon();
  const sd=$('#ag-def');if(sd)sd.onchange=e=>{AG.defect=e.target.value||null;viewAgir();};
  $('#ag-copy').onclick=()=>copy($('#ag-letter').value,'Courrier copié');
  $('#ag-print').onclick=()=>print();
}
function policyCard(it){
  const p=it.policy,stTone={ok:'ok',warn:'warn',muted:'muted'}[it.status.tone];
  const state={ok:['ok','Rempli'],ko:['crit','Non rempli'],unknown:['muted','À vérifier']};
  return `<article class="card pol">
    <div class="dc-top">${tagHtml(stTone,it.status.label)}${tagHtml('muted',it.nature)}</div>
    <h3>${esc(p.constructeur)} · ${esc(p.resume)}</h3>
    ${it.status.why?`<p class="hint" style="margin:0">${esc(it.status.why)}</p>`:''}
    <table class="elig"><tbody>${it.checks.map(c=>`<tr><th scope="row">${esc(c.label)}</th><td>${tagHtml(state[c.state][0],state[c.state][1])}</td><td>${esc(c.txt)}</td></tr>`).join('')}</tbody></table>
    <dl class="kv">
      <div><dt>Conditions d'éligibilité</dt><dd>${val(p.conditions)}</dd></div>
      <div><dt>Dates de validité</dt><dd>${p.validite&&(p.validite.debut||p.validite.fin)?`${p.validite.debut?'à partir de '+fmtDate(p.validite.debut):''}${p.validite.fin?' jusqu\'au '+fmtDate(p.validite.fin):''}`:val(null)}</dd></div>
      ${p.remboursement_retroactif?`<div><dt>Remboursement de frais passés</dt><dd>${esc(p.remboursement_retroactif)}</dd></div>`:''}
      <div><dt>Procédure de demande</dt><dd>${val(p.procedure)}</dd></div>
      <div><dt>Dernière vérification</dt><dd>${p.derniere_verification?fmtDate(p.derniere_verification):'Jamais vérifiée spécifiquement : vérification nécessaire'}</dd></div>
    </dl>
    <details class="srcbox"><summary class="linkbtn">Sources (${p.sources.length})${p.source_officielle?'':' · aucune source officielle'}</summary>
      <ul class="srcs">${p.sources.map(s=>`<li>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a>`:esc(s.titre)}${s.type==='forum'?' '+tagHtml('muted','Témoignages'):''}</li>`).join('')}</ul></details>
    <p class="hint" style="margin:0">Une politique constructeur peut évoluer ou expirer : faites confirmer l'éligibilité par le réseau, avec le numéro VIN, avant toute réparation.</p>
  </article>`;
}

return {views:{vehicule:viewVehicule,ajout:viewAjout,anticiper:viewAnticiper,decider:viewDecider,agir:viewAgir},
  hasVehicle,startEdit:()=>{A=formFrom(active());},state:()=>G};
}
if(typeof module!=='undefined')module.exports=ownerViews;
