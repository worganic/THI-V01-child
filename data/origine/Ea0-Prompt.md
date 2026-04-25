* J'ai un projet dans le fichier @docs/A-prompt.md, il faut extraire toutes les exigences fonctionnelles une par une du fichier en te basant sur les critères du @docs/origine/Ba0-Redaction_et_Qualite_des_Exigences_Fonctionnelles.md, met toutes les informations dans un nouveau fichier ./docs/Bg0-Exigences_Fonctionnelles_Structurees.md
* Chaque exigences doit être basé sur un titre de type : 
 - Exigences métier : “BM”  Objectifs stratégiques
  - Exigences utilisateur : “EU” User Stories détaillées
  - Exigences système fonctionnelles : “EF-SYS” Organisées en 8 sections
  - Exigences non-fonctionnelles : “ENF-SYS” Performance, sécurité, scalabilité, etc.
* Chaque exigence inclut :
  - ✅ Identifiant unique (EF-SYS-001, etc.)
  - ✅ Description claire et non-ambiguë
  - ✅ Traçabilité (vers les exigences supérieures)
  - ✅ Priorité (Must Have / Should Have)
  - ✅ Critères d'acceptation testables
  - ✅ Dépendances explicites
  - ✅ Complexité estimée (pour les systèmes)

* Fichier attendus : 
	**  ./docs/C-Exigences_Fonctionnelles_Structurees.md
* Fichiers à utiliser : 
** ./docs/A-prompt.md
** ./docs/origine/Ba0-Redaction_et_Qualite_des_Exigences_Fonctionnelles.md