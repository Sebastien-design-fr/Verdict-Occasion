# Ausculto

Évaluation d'un achat de voiture d'occasion à partir d'une base de défauts connus, sourcée et recoupée.

## Contenu

- `data/modeles.json` : catalogue des modèles, avec leurs motorisations et boîtes (codes moteur partagés entre modèles).
- `data/defauts.json` : base des défauts. Chaque défaut est rattaché à des codes moteur, des codes boîte ou un carburant (et peut être limité à certains modèles, par exemple pour un rappel propre à un modèle), avec ses années, sa plage de kilométrage, sa gravité, sa fréquence, ses coûts, ses sources et son niveau de confiance.
- `data/prix_neufs.json` : prix catalogue d'entrée de gamme de chaque modèle (sourcé ou estimé).
- `data/decote.json` : paramètres de la cote estimée (courbe de décote, kilométrage, marques) et cotes de marché publiques servant de contrôle.
- `page.html` + `app.js` : l'application.
- `tests/cote.test.js` : vérifie que la cote estimée encadre les cotes de contrôle (`node tests/cote.test.js`).
- `build.py` : vérifie la cohérence de la base, puis génère `index.html` (version du dépôt) et `dist/verdict-occasion.html` (version autonome).

## Score

Le score final combine deux parties :

- **Mécanique** (sur 100) : défauts connus non traités, pondérés par leur gravité, leur fréquence, la position du kilométrage dans leur zone de risque et leur niveau de confiance ; historique d'entretien ; kilométrage annuel.
- **Prix** : le « prix réel » (prix demandé + frais à prévoir pour les défauts non traités) est comparé à la cote saisie (La Centrale, L'argus). Bonne affaire (−10 % ou moins) : +8 points. Cohérent (−10 % à +5 %) : 0. Un peu cher (+5 à +15 %) : −10. Cher (+15 à +30 %) : −25. Délirant (au-delà de +30 %) : −40, score plafonné à 25 et verdict « Trop cher », quel que soit l'état mécanique. Un prix demandé inférieur de plus de 35 % à la cote plafonne le score à 55 et déclenche une alerte (sinistre, kilométrage, arnaque).

## Cote estimée

Sans cote saisie, Ausculto estime la cote : prix neuf de référence × finition moyenne × motorisation × décote selon l'âge × ajustement au kilométrage × tenue de la marque × pénalité si le moteur a un défaut critique confirmé. La fourchette affichée est de ±15 %. Sur 11 cotes de marché publiques, l'écart va de -12 % à +12 %. 99 prix neufs sur 101 sont sourcés (presse auto, constructeurs) ; ceux du Peugeot Partner II et du Citroën Berlingo II restent estimés, faute de tarif 2008 retrouvé. Une cote officielle saisie par l'utilisateur remplace toujours l'estimation.

## Règle de confiance

Un défaut est « confirmé » s'il fait l'objet d'un rappel officiel ou s'il est décrit par au moins deux sources indépendantes. Deux pages d'un même éditeur comptent pour une seule source. Un fil de forum où plusieurs propriétaires décrivent le même défaut compte pour une source ; chaque source porte un type (`article` ou `forum`). Sinon le défaut reste « à confirmer » et pèse moins dans le score. Un défaut contredit par les sources est retiré de la base.

## Ajouter un défaut ou un modèle

1. Ajouter l'entrée dans `data/defauts.json` ou `data/modeles.json`.
2. Lancer `python3 build.py` : le script refuse une base incohérente (code moteur inconnu, défaut sans source, « confirmé » avec une seule source…).

## Avancement

- Lot 1 (octobre 2026) : 48 modèles 2010-2026, 33 défauts.
- Lot 2 (octobre 2026) : Hyundai, Kia, Mercedes, Toyota C-HR, Auris et Corolla ; recoupement de défauts du lot 1. Total : 67 modèles, 50 défauts dont 32 confirmés.
- Lot 3 (octobre 2026) : Opel Astra K, Mokka, Corsa E, Mini, Honda, Mazda, Suzuki, Skoda Fabia, Seat Arona, VW T-Roc, Tiguan et Golf VIII ; boîte DSG DQ381. Total : 87 modèles, 61 défauts dont 39 confirmés.
- Lot 4 (octobre 2026) : Renault Twingo III et Zoé, Dacia Spring, Nissan Micra et X-Trail, Citroën Berlingo, Peugeot Partner et Rifter, Fiat Panda et Tipo, Jeep Renegade, Volvo V40 et XC60. Total : 101 modèles, 76 défauts dont 47 confirmés.
- Passe de confirmation (octobre 2026) : 29 défauts repris, forums inclus. 22 confirmés, 2 retirés car contredits ou non étayés, 1 reformulé. Total : 101 modèles, 77 défauts dont 63 confirmés.
- Prochains lots : compléter 2010-2026 (Kia Niro, Hyundai Ioniq, Tesla Model 3, Peugeot 508, Citroën C4, Renault Austral et Arkana, Skoda Kodiaq, BMW X1 et Série 3 G20, Audi Q3 et A4), puis 2000-2010.
