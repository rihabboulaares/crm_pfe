# Agent IA de recommandation commerciale

Le module `agentEngagement` contient maintenant un agent de recommandation, pas un robot
d'execution automatique.

Flux actif :
- construire le contexte CRM du prospect ;
- resoudre les canaux disponibles ;
- proposer une strategie commerciale ;
- generer un email, un script d'appel ou un message social a utiliser manuellement ;
- enregistrer une interaction humaine ;
- analyser la reponse ;
- mettre a jour la memoire du prospect ;
- replanifier la prochaine action.

Ce que le module ne fait plus :
- lancement batch de l'ancien agent ;
- scraping navigateur ;
- sessions Playwright ;
- envoi social automatise ;
- verification automatique de conversations sociales ;
- envoi email direct depuis l'ancien endpoint `send`.

Les URLs de profils sociaux restent des metadonnees CRM utilisables pour la
personnalisation, mais l'action reste manuelle.
