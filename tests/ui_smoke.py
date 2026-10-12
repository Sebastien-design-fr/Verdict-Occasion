"""Parcours navigateur de bout en bout sur dist/verdict-occasion.html (Playwright, Chromium).
Usage : python3 build.py && python3 tests/ui_smoke.py
Vérifie : accueil, ajout d'un véhicule, tableau de bord, Anticiper, Décider, Agir, interventions,
persistance après rechargement, export/import JSON, analyse avant achat conservée, absence d'erreur JS,
absence de débordement horizontal sur téléphone, tablette et ordinateur."""
import asyncio, json, pathlib, sys, tempfile
from playwright.async_api import async_playwright

URL = (pathlib.Path(__file__).resolve().parent.parent / 'dist/verdict-occasion.html').as_uri()
ko = 0
def check(name, cond):
    global ko
    print(('OK ' if cond else 'KO ') + ' ' + name)
    if not cond: ko += 1

async def overflow(pg):
    return await pg.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')

async def run(w, h, tag):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': w, 'height': h}, accept_downloads=True)
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/fonts.*/**', lambda r: r.abort())
        await pg.goto(URL); await pg.wait_for_timeout(300)
        check(f'{tag} accueil : bienvenue et deux actions', await pg.is_visible('#add-first') and 'Analyser une voiture avant achat' in await pg.inner_text('#app'))
        await pg.click('#add-first')
        await pg.fill('#a-q', '308 puretech 2018'); await pg.click('[data-apick="0"]')
        await pg.fill('#a-km', '112000'); await pg.click('#a-save'); await pg.wait_for_timeout(200)
        t = await pg.inner_text('#app')
        check(f'{tag} tableau de bord : identification et connaissances', 'PEUGEOT 308 II' in t.upper() and 'défauts documentés' in t and 'puretech-t' in t)
        check(f'{tag} pas de score de fiabilité sur le tableau de bord', '/ 100' not in t)
        check(f'{tag} pas de débordement horizontal (tableau de bord)', not await overflow(pg))
        await pg.evaluate("location.hash='anticiper'"); await pg.wait_for_timeout(200)
        n = await pg.locator('.dcard').count()
        await pg.click('[data-sym="puretech-courroie-turbo"]'); await pg.wait_for_timeout(100)
        check(f'{tag} Anticiper : cartes affichées, symptôme → rouge', n >= 2 and await pg.locator('.dcard.lv-red[data-id="puretech-courroie-turbo"]').count() == 1)
        check(f'{tag} pas de débordement horizontal (Anticiper)', not await overflow(pg))
        await pg.evaluate("location.hash='decider'"); await pg.wait_for_timeout(200)
        await pg.check('[data-qdef="puretech-courroie-turbo"]'); await pg.fill('#q-amount', '2400'); await pg.fill('#q-value', '8000')
        await pg.click('#q-form button[type=submit]'); await pg.wait_for_timeout(200)
        t = await pg.inner_text('#q-res')
        check(f'{tag} Décider : 30 % avec valeur saisie, trois scénarios', '30 %' in t and await pg.locator('.scen article').count() == 3)
        check(f'{tag} pas de débordement horizontal (Décider)', not await overflow(pg))
        await pg.click('#q-agir'); await pg.wait_for_timeout(200)
        t = await pg.inner_text('#app')
        check(f'{tag} Agir : politique documentée, courrier, garanties légales', 'Politique documentée' in t and 'vices cachés' in t and await pg.input_value('#ag-letter') != '')
        check(f'{tag} pas de débordement horizontal (Agir)', not await overflow(pg))
        await pg.select_option('#ag-def', 'puretech-huile-turbo'); await pg.wait_for_timeout(100)
        check(f'{tag} Agir : changement de panne pris en compte', 'consommation' in (await pg.inner_text('.pol h3')).lower())
        await pg.evaluate("location.hash='vehicule'"); await pg.wait_for_timeout(200)
        await pg.click('#iv-open'); await pg.fill('#iv-titre', 'Vidange'); await pg.fill('#iv-km', '113000')
        await pg.click('#iv-form button[type=submit]'); await pg.wait_for_timeout(200)
        check(f'{tag} intervention ajoutée et kilométrage relevé à 113 000', 'Vidange' in await pg.inner_text('#hist') and '113' in await pg.inner_text('.kv'))
        await pg.reload(); await pg.wait_for_timeout(300)
        check(f'{tag} persistance après rechargement', 'Vidange' in await pg.inner_text('#app'))
        await pg.click('.data summary')
        async with pg.expect_download() as dl: await pg.click('#exp')
        path = await (await dl.value).path()
        data = json.loads(pathlib.Path(path).read_text())
        check(f'{tag} export JSON : 1 véhicule, 1 intervention, symptôme', len(data['vehicles']) == 1 and len(data['vehicles'][0]['interventions']) == 1 and data['vehicles'][0]['symptomes'] == ['puretech-courroie-turbo'])
        # import dans un navigateur vierge
        pg2 = await (await b.new_context(viewport={'width': w, 'height': h})).new_page()
        await pg2.route('**/fonts.*/**', lambda r: r.abort())
        await pg2.goto(URL); await pg2.wait_for_timeout(200)
        await pg2.click('.data summary'); await pg2.set_input_files('#imp-file', path); await pg2.wait_for_timeout(300)
        check(f'{tag} import JSON dans un navigateur vierge', 'Vidange' in await pg2.inner_text('#app'))
        # analyse avant achat conservée
        await pg.click('.buyer-link'); await pg.wait_for_timeout(200)
        await pg.click('[data-recent="0"]'); await pg.wait_for_timeout(200)
        t = await pg.inner_text('#app')
        check(f'{tag} Avant d\'acheter : verdict avec indice éditorial', 'Indice éditorial' in t and "n'est pas une probabilité" in t)
        for r in ['details', 'visite', 'comparer', 'repertoire']:
            await pg.evaluate(f"location.hash='{r}'"); await pg.wait_for_timeout(150)
        check(f'{tag} Avant d\'acheter : détails, visite, comparer, répertoire sans erreur', not errs)
        # moteur sans défaut documenté
        await pg.evaluate("location.hash='ajout'"); await pg.wait_for_timeout(100)
        await pg.click('#add-other') if await pg.is_visible('#add-other') else None
        await pg.select_option('#a-brand', 'Tesla'); await pg.wait_for_timeout(50)
        await pg.select_option('#a-model', index=1); await pg.select_option('#a-eng', index=1); await pg.select_option('#a-year', index=1)
        await pg.fill('#a-km', '40000'); await pg.click('#a-save'); await pg.wait_for_timeout(200)
        t = await pg.inner_text('#app')
        check(f'{tag} second véhicule : sélecteur et message honnête si aucun défaut', await pg.locator('[data-vsel]').count() == 2 and ("ne veut pas dire qu'elle est fiable" in t or 'défaut' in t))
        check(f'{tag} aucune erreur JavaScript', not errs)
        if errs: print(errs)
        await b.close()

async def main():
    for w, h, tag in [(390, 844, 'téléphone'), (820, 1180, 'tablette'), (1280, 900, 'ordinateur')]:
        await run(w, h, tag)
asyncio.run(main())
print(f'{ko} échec(s)' if ko else 'Tous les tests passent')
sys.exit(1 if ko else 0)
