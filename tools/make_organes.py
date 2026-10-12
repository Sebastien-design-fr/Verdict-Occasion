"""Génère data/organes.json : organe mécanique concerné par chaque défaut.
Classement par mots-clés du titre, puis exceptions relues à la main. Ne modifie pas defauts.json."""
import json, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
D = json.loads((root / 'data/defauts.json').read_text(encoding='utf-8'))['defauts']
RULES = [
  ('Boîte de vitesses', lambda d, t: bool(d.get('boites'))),
  ('Freinage', lambda d, t: 'pompe à vide' in t or 'freinage' in t),
  ('Distribution', lambda d, t: re.search(r'courroie de distribution|chaîne|chaine|tendeur de chaîne|déphaseur|arbre à cames|guides de chaîne|courroie « humide »', t)),
  ('Batterie haute tension et système hybride ou électrique', lambda d, t: re.search(r'hybride|haute tension|moteur électrique|chargeur|charge interrompue', t)),
  ('Dépollution (EGR, FAP, AdBlue)', lambda d, t: re.search(r'egr|filtre à particules|fap|adblue|dieselgate|antipollution', t)),
  ('Refroidissement', lambda d, t: re.search(r'refroidissement|pompe à eau|thermostat|surchauffe|durite de refroidissement', t)),
  ('Injection et alimentation', lambda d, t: re.search(r'injecteur|pompe haute pression|pompe à carburant|calamin', t)),
  ('Suralimentation (turbo)', lambda d, t: re.search(r'turbo\b|\(turbo|actionneur de turbo|^turbo', t) and 'consommation' not in t),
  ('Lubrification et consommation d\'huile', lambda d, t: re.search(r"huile|segments", t)),
  ('Suspension', lambda d, t: 'suspension' in t),
  ('Climatisation', lambda d, t: 'climatisation' in t),
  ('Électricité et électronique', lambda d, t: re.search(r'batterie 12|logiciel|faisceau', t)),
]
OVERRIDE = {
  'puretech-courroie-turbo': 'Distribution',
  'ecoboost-courroie': 'Distribution',
  'ecoboost-tendeur-pompe-huile': "Lubrification et consommation d'huile",
  'ecoboost-durite': 'Refroidissement',
  'twinair-uniair': "Distribution",
  'multiair14-module': "Distribution",
  'tce13-fuite': "Lubrification et consommation d'huile",
  'r9m-carter-fuite': "Lubrification et consommation d'huile",
  'mjt13-fap': 'Dépollution (EGR, FAP, AdBlue)',
  'mhev48-poulie': "Courroie et galets d'accessoires",
  'i20-depression-rappel': 'Freinage',
  'ea211-act': 'Moteur (fonctionnement)',
  'ea211evo-froid': 'Moteur (fonctionnement)',
  'twingo-sce-acoups': 'Moteur (fonctionnement)',
  'volvo-collecteur-rappel': "Admission d'air",
  'n13-calamine': "Admission d'air",
  'n54-pompe-hp': 'Injection et alimentation',
  'hdi16-turbo': 'Suralimentation (turbo)',
  'opel14t-huile': "Lubrification et consommation d'huile",
  'd4d14-huile': "Lubrification et consommation d'huile",
  'honda15t-dilution': "Lubrification et consommation d'huile",
  'skyd22-dilution': "Lubrification et consommation d'huile",
  'skyd22-joints-injecteurs': 'Injection et alimentation',
  'twingo-edc-rappel': 'Boîte de vitesses',
  'hybride-batterie-12v': 'Électricité et électronique',
  'spring-rouille': 'Carrosserie et soubassement (corrosion)',
  'id3-logiciel': 'Électricité et électronique',
  'yaris4-hybride-rappel': 'Batterie haute tension et système hybride ou électrique',
  'auris-hybride-logiciel': 'Batterie haute tension et système hybride ou électrique',
  'chr-faisceau-rappel': 'Batterie haute tension et système hybride ou électrique',
  'etech-moteur-huile': 'Batterie haute tension et système hybride ou électrique',
  'mini-r56-pompe-eau-rappel': 'Refroidissement',
}
out = {}
for d in D:
    t = d['titre'].lower()
    o = OVERRIDE.get(d['id']) or next((n for n, f in RULES if f(d, t)), None)
    out[d['id']] = o or 'Information non disponible'
doc = {'version': '2026-10-12', 'note': "Organe mécanique principal de chaque défaut, déduit du titre de la fiche puis relu. Fichier indépendant de defauts.json.", 'organes': out}
(root / 'data/organes.json').write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
for k, v in out.items(): print(f'{v:55} {k}')
