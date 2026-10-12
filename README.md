# Ausculto

Assistant personnel de santé mécanique automobile : connaître les faiblesses de son véhicule, anticiper les problèmes mécaniques et prendre les bonnes décisions avant de dépenser. L'analyse d'une voiture avant achat reste disponible dans la rubrique « Avant d'acheter ».

## V2 : le propriétaire au centre

- **Mon véhicule** : ajout en quelques secondes (recherche libre ou marque → modèle → motorisation), tableau de bord (identification, état des connaissances mécaniques, points de vigilance), historique des interventions, export et import JSON. Aucun compte, aucun serveur : tout reste dans le navigateur (`store.js`, clé `ausculto-v2-garage`).
- **Anticiper** : une carte par défaut documenté (organe, symptômes, kilométrage indicatif, gravité, contrôles, prévention, coût en fourchette, niveau de preuve, sources). Trois niveaux : rouge si l'utilisateur signale un symptôme ou si un rappel n'est pas marqué fait ; orange pour un défaut majeur ou critique dont la plage documentée approche, est atteinte ou dépassée sans intervention enregistrée ; vert sinon. Ce ne sont pas des probabilités.
- **Décider** : analyse d'un devis. Défauts correspondants (jamais présentés comme un diagnostic), part du devis dans la valeur du véhicule (valeur saisie prioritaire sur l'estimation, fourchette affichée), autres points listés sans addition de coûts, trois scénarios avec arguments pour et contre, synthèse imprimable.
- **Agir** : politiques constructeur recensées (`data/politiques.json`), statut (documentée / à actualiser / aucune / informations insuffisantes), critères confrontés au véhicule, garanties légales distinguées des dispositifs commerciaux, documents, questions au garage, courrier type factuel, récapitulatif imprimable.
- Fonctions potentiellement payantes repérées dans `health.js` (`TIERS`, `isUnlocked()`), toutes ouvertes pendant les tests.

Fichiers V2 : `health.js` (logique, sans interface, testable sous Node), `store.js` (stockage local), `owner.js` (écrans propriétaire), `data/politiques.json` (15 politiques tirées des fiches défauts, sans invention ; champs inconnus à `null`), `data/organes.json` (organe de chaque défaut, généré par `tools/make_organes.py` puis relu). `defauts.json` et `modeles.json` ne sont pas modifiés.

Tests : `node tests/health.test.js` (véhicule, vigilance, devis, politiques, stockage), `python3 tests/ui_smoke.py` (parcours complet dans Chromium, téléphone, tablette et ordinateur).

## Contenu

- `data/modeles.json` : catalogue des modèles, avec leurs motorisations et boîtes (codes moteur partagés entre modèles).
- `data/defauts.json` : base des défauts. Chaque défaut est rattaché à des codes moteur, des codes boîte ou un carburant (et peut être limité à certains modèles, par exemple pour un rappel propre à un modèle), avec ses années, sa plage de kilométrage, sa gravité, sa fréquence, ses coûts, ses sources et son niveau de confiance.
- `data/prix_neufs.json` : prix catalogue d'entrée de gamme de chaque modèle (sourcé ou estimé).
- `data/decote.json` : paramètres de la cote estimée (courbe de décote, kilométrage, marques) et cotes de marché publiques servant de contrôle.
- `engine.js` : le moteur de calcul, sans interface (cote, défauts applicables, score, prix, argumentaire, recherche, lecture d'une annonce collée). Utilisable dans le navigateur et sous Node.
- `page.html` + `ui.js` : l'interface. Parcours en trois étapes (trouver le véhicule, décrire l'annonce, verdict), puis détails, mode visite, comparaison de deux ou trois annonces et répertoire. Les données saisies restent dans le navigateur.
- `tests/cote.test.js` et `tests/cote.cases.js` : vérifient que la cote estimée encadre les 36 cotes de contrôle (`node tests/cote.test.js`).
- `tests/engine.test.js` : recherche, lecture d'annonce et évaluation (`node tests/engine.test.js`).
- `build.py` : vérifie la cohérence de la base (y compris politiques et organes), puis génère `index.html` (version du dépôt) et `dist/verdict-occasion.html` (version autonome).

## Score

Le score final combine deux parties :

- **Mécanique** (sur 100) : défauts connus non traités, pondérés par leur gravité, leur fréquence, la position du kilométrage dans leur zone de risque et leur niveau de confiance ; historique d'entretien ; kilométrage annuel.
- **Prix** : le « prix réel » (prix demandé + frais à prévoir pour les défauts non traités) est comparé à la cote saisie (La Centrale, L'argus). Bonne affaire (−10 % ou moins) : +8 points. Cohérent (−10 % à +5 %) : 0. Un peu cher (+5 à +15 %) : −10. Cher (+15 à +30 %) : −25. Délirant (au-delà de +30 %) : −40, score plafonné à 25 et verdict « Trop cher », quel que soit l'état mécanique. Un prix demandé inférieur de plus de 35 % à la cote plafonne le score à 55 et déclenche une alerte (sinistre, kilométrage, arnaque).

## Cote estimée

Sans cote saisie, Ausculto estime la cote : prix neuf de référence × finition moyenne × motorisation × décote selon l'âge × ajustement au kilométrage × maintien des versions puissantes × tenue de la marque × pénalité si le moteur a un défaut critique confirmé. La motorisation tient compte du carburant et de la puissance : chaque moteur porte une puissance type (`ch`), que l'utilisateur peut corriger dans le formulaire ; le prix neuf varie comme (ch / 150)^0,5 et les versions de plus de 150 ch perdent un peu moins de valeur. Les sportives compactes (GTI, GTi, RS, ST, M135i, JCW…) portent `sport: true` et un bonus de maintien de 30 %. Les hybrides ont un effet puissance réduit, les électriques aucun. La fourchette affichée est de ±15 %. Sur 36 cotes de marché publiques (autobiz), dont 25 versions premium ou sportives, l'écart va de -12 % à +13 %. 262 prix neufs sur 264 sont sourcés (L'argus, presse auto, constructeurs) ; pour les générations ajoutées en octobre 2026, c'est le prix du neuf le plus bas de la génération selon L'argus ; ceux du Peugeot Partner II et du Citroën Berlingo II restent estimés, faute de tarif 2008 retrouvé. Une cote officielle saisie par l'utilisateur remplace toujours l'estimation.

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
- Consolidation par marque (octobre 2026) : toutes les générations courantes depuis 2010 et leurs motorisations pour BMW et Mini, le groupe Volkswagen (VW, Audi, Skoda, Seat, Cupra), Stellantis (Peugeot, Citroën, DS, Opel, Fiat, Jeep), Renault, Dacia, Nissan, Mercedes, Ford, Toyota, Hyundai, Kia, Mazda, Volvo, Tesla, Suzuki et Honda. 28 défauts ajoutés (chaîne N20, rappels EGR BMW, dieselgate EA189, EA888, 3.0 TDI, S tronic DL501, Multitronic, AL4, turbo 1.6 HDi, E-Tech, 7G-Tronic, rappels 1.6 EcoBoost et Kuga PHEV…). Total : 264 générations, 105 défauts dont 87 confirmés.
- Prochains lots : compléter 2010-2026 (Kia Niro, Hyundai Ioniq, Tesla Model 3, Peugeot 508, Citroën C4, Renault Austral et Arkana, Skoda Kodiaq, BMW X1 et Série 3 G20, Audi Q3 et A4), puis 2000-2010.
- Correction de la cote (octobre 2026) : la cote des versions puissantes était sous-estimée (BMW 440i de 2017 estimée à 18 100 € contre environ 27 000 € sur autobiz). Ajout de la puissance par moteur, d'un champ Puissance, d'un maintien de cote pour les versions puissantes et sportives, de 25 cotes de contrôle et de corrections par modèle (X1 F48, Classe C W205, A4 B9, Classe A W176, Mini F56).
- Première interface web (octobre 2026) : parcours issu de la maquette validée, recherche libre et par marque, lecture d'une annonce collée, verdict avec prix à proposer, mode visite avec score en direct, comparaison, thème clair et sombre. Les rappels pèsent désormais moins dans le score (réparation gratuite, à vérifier).
