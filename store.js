/* Ausculto V2 — stockage local des véhicules du propriétaire, export et import JSON.
   Aucune donnée ne quitte l'appareil. L'état de l'analyse avant achat (clé ausculto-v1) n'est pas touché. */
function createStore(opts){
const KEY='ausculto-v2-garage';
const SCHEMA='ausculto-garage';
const storage=opts&&opts.storage;
const MODELS=(opts&&opts.models)||[];
const empty=()=>({schema:SCHEMA,version:1,vehicles:[],activeId:null});

/* Vérifie un état (chargé ou importé) et écarte ce qui ne correspond plus au catalogue. */
function validate(raw){
  const errors=[],warnings=[];
  if(!raw||typeof raw!=='object')return {ok:false,errors:['Fichier illisible : ce n\'est pas un objet JSON.']};
  if(raw.schema!==SCHEMA)return {ok:false,errors:['Ce fichier n\'est pas une sauvegarde Ausculto.']};
  if(!Array.isArray(raw.vehicles))return {ok:false,errors:['Sauvegarde incomplète : liste de véhicules absente.']};
  const vehicles=[];
  raw.vehicles.forEach((v,i)=>{
    const m=v&&MODELS.find(x=>x.id===v.model);
    if(!m){warnings.push(`Véhicule ${i+1} ignoré : modèle inconnu du catalogue actuel.`);return;}
    if(!(v.eng>=0&&v.eng<m.moteurs.length)){warnings.push(`Véhicule ${i+1} ignoré : motorisation inconnue.`);return;}
    if(!(Number(v.km)>=0)){warnings.push(`Véhicule ${i+1} ignoré : kilométrage invalide.`);return;}
    vehicles.push({...v,km:Number(v.km),year:Number(v.year),box:v.box>=0&&v.box<m.boites.length?v.box:0,
      interventions:Array.isArray(v.interventions)?v.interventions.filter(x=>x&&x.titre):[],
      symptomes:Array.isArray(v.symptomes)?v.symptomes.filter(x=>typeof x==='string'):[]});
  });
  const activeId=vehicles.some(v=>v.id===raw.activeId)?raw.activeId:(vehicles[0]?vehicles[0].id:null);
  return {ok:true,data:{schema:SCHEMA,version:1,vehicles,activeId},errors,warnings};
}
function load(){
  if(!storage)return {state:empty(),available:false};
  try{
    const s=storage.getItem(KEY);if(!s)return {state:empty(),available:true};
    const r=validate(JSON.parse(s));
    return {state:r.ok?r.data:empty(),available:true,warnings:r.ok?r.warnings:r.errors};
  }catch(e){return {state:empty(),available:false};}
}
function save(state){
  if(!storage)return false;
  try{storage.setItem(KEY,JSON.stringify(state));return true;}catch(e){return false;}
}
function exportJSON(state){
  return JSON.stringify({...state,exportedAt:new Date().toISOString(),app:'Ausculto'},null,2);
}
function importJSON(text){
  let raw;try{raw=JSON.parse(text);}catch(e){return {ok:false,errors:['Fichier illisible : JSON invalide.']};}
  return validate(raw);
}
return {KEY,SCHEMA,empty,validate,load,save,exportJSON,importJSON};
}
if(typeof module!=='undefined')module.exports=createStore;
