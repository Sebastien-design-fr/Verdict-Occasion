# Verdict Occasion

Évaluation d'un achat de voiture d'occasion à partir d'une base de défauts connus, sourcée et recoupée.

## Contenu

- `data/modeles.json` : catalogue des modèles, avec leurs motorisations et boîtes (codes moteur partagés entre modèles).
- `data/defauts.json` : base des défauts. Chaque défaut est rattaché à des codes moteur, des codes boîte ou un carburant (et peut être limité à certains modèles, par exemple pour un rappel propre à un modèle), avec ses années, sa plage de kilométrage, sa gravité, sa fréquence, ses coûts, ses sources et son niveau de confiance.
- `page.html` + `app.js` : l'application.
- `build.py` : vérifie la cohérence de la base, puis génère `index.html` (version du dépôt) et `dist/verdict-occasion.html` (version autonome).

## Règle de confiance

Un défaut est « confirmé » s'il fait l'objet d'un rappel officiel ou s'il est décrit par au moins deux sources indépendantes. Sinon il reste « à confirmer » et pèse moins dans le score.

## Ajouter un défaut ou un modèle

1. Ajouter l'entrée dans `data/defauts.json` ou `data/modeles.json`.
2. Lancer `python3 build.py` : le script refuse une base incohérente (code moteur inconnu, défaut sans source, « confirmé » avec une seule source…).

## Avancement

- Lot 1 (octobre 2026) : 48 modèles 2010-2026, 33 défauts.
- Lot 2 (octobre 2026) : Hyundai, Kia, Mercedes, Toyota C-HR, Auris et Corolla ; recoupement de défauts du lot 1. Total : 67 modèles, 50 défauts dont 32 confirmés.
- Prochains lots : Opel hors Stellantis, Skoda Fabia, Seat Arona, VW T-Roc et Tiguan, Mini, Honda, Mazda, Suzuki, puis 2000-2010.
