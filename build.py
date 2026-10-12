"""Construit les deux versions de l'app à partir de page.html, app.js et data/.
- index.html : version du dépôt (GitHub Pages), qui charge data/*.json
- dist/verdict-occasion.html : version autonome, données intégrées
Usage : python3 build.py
"""
import json, pathlib
root = pathlib.Path(__file__).parent
page = (root / 'page.html').read_text(encoding='utf-8')
app = (root / 'app.js').read_text(encoding='utf-8')
mod = json.loads((root / 'data/modeles.json').read_text(encoding='utf-8'))
dfx = json.loads((root / 'data/defauts.json').read_text(encoding='utf-8'))

# Contrôles de cohérence de la base
codes_m = {e['code'] for m in mod['modeles'] for e in m['moteurs']}
codes_b = {b['code'] for m in mod['modeles'] for b in m['boites']}
ids_mod = {m['id'] for m in mod['modeles']}
errors = []
ids = [d['id'] for d in dfx['defauts']]
if len(ids) != len(set(ids)): errors.append('identifiants de défauts en double')
for d in dfx['defauts']:
    for c in d.get('moteurs', []):
        if c not in codes_m: errors.append(f"{d['id']} : moteur inconnu {c}")
    for c in d.get('boites', []):
        if c not in codes_b: errors.append(f"{d['id']} : boîte inconnue {c}")
    for c in d.get('modeles', []):
        if c not in ids_mod: errors.append(f"{d['id']} : modèle inconnu {c}")
    if d.get('modeles') and d.get('moteurs'):
        for mid in d['modeles']:
            mm = next((m for m in mod['modeles'] if m['id'] == mid), None)
            if mm and not any(e['code'] in d['moteurs'] for e in mm['moteurs']):
                errors.append(f"{d['id']} : le modèle {mid} n'a aucun des moteurs visés")
    if not d.get('sources'): errors.append(f"{d['id']} : aucune source")
    if d['confiance'] == 'confirmé' and not d.get('rappel') and len(d['sources']) < 2:
        errors.append(f"{d['id']} : « confirmé » sans rappel ni deux sources")
    if d['km'][0] > d['km'][1] or d['cout'][0] > d['cout'][1]: errors.append(f"{d['id']} : plage incohérente")
if errors:
    raise SystemExit('Base invalide :\n- ' + '\n- '.join(errors))

doc_head = '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
(root / 'index.html').write_text(doc_head + page.replace('<style>', '<style>\nbody{margin:0}', 1).replace('<div class="wrap">', '</head>\n<body>\n<div class="wrap">', 1) + '<script src="app.js"></script>\n</body>\n</html>\n', encoding='utf-8')
data = {'modeles': mod['modeles'], 'defauts': dfx['defauts'], 'version': dfx['version']}
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/verdict-occasion.html').write_text(page + '<script>window.VO_DATA=' + json.dumps(data, ensure_ascii=False).replace('</', '<\\/') + ';</script>\n<script>\n' + app + '</script>\n', encoding='utf-8')
print(f"OK : {len(mod['modeles'])} modèles, {len(dfx['defauts'])} défauts")
