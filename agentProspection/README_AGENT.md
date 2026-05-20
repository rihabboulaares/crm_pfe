# Agent de prospection - architecture production

## Flux actif

Le vrai agent de prospection utilise uniquement ce chemin:

1. `views.py`
   Expose `POST /agentProspection/rechercher/` et `POST /agentProspection/importer/`.

2. `agent/service.py`
   Facade applicative appelee par Django. Elle construit une requete naturelle si le frontend envoie des champs structures, puis appelle le ReAct agent.

3. `agent/react_agent.py`
   Coeur de l'agent autonome. Il choisit les outils, appelle Gemini, parse la reponse JSON, force une synthese JSON si le modele repond mal, et bascule vers un modele Gemini de secours si necessaire.

4. `agent/tools_registry.py`
   Registre unique des outils LangChain: Google Maps, recherche web, enrichissement, reseaux sociaux, profils LinkedIn/Instagram/Facebook, scoring local.

5. `prompts/catalog.py`
   Seul fichier de prompts de production: prompt systeme principal et prompt de synthese JSON.

6. `agent/schemas.py`
   Normalisation des criteres et des resultats.

7. `agent/json_utils.py`
   Extraction robuste du JSON retourne par le LLM.

8. `tools/*.py`
   Implementations concretes des sources de donnees publiques.

## Fichiers supprimes

Ces fichiers appartenaient a l'ancienne confusion "pipeline" ou a des options non branchees au ReAct actuel:

- `agent/graph.py`
  Ancienne orchestration deterministe LangGraph avec etapes fixes.

- `agent/prompts.py`
  Prompts de l'ancien graph.

- `agent/memory_store.py`
  Memoire Chroma branchee sur l'ancien graph.

- `agent/redis_memory.py`
  Cache/historique branche sur l'ancien graph.

- `agent/vector_store.py`
  Stockage RAG Chroma non utilise par le ReAct actuel.

- `tools/gemini_tool.py`
  Scoring Gemini de l'ancien pipeline. Le ReAct actuel utilise `score_entity` avec `tools/scoring_tool.py`.

- `management/commands/ingest_prospection_sources.py`
  Commande d'indexation RAG liee a `vector_store.py`.

- `crm-backend/test_simple.py`
  Script manuel de debug hors flux Django.

## Memoire recommandee pour la production

La memoire a utiliser pour un vrai agent production est une memoire conversationnelle persistante pour LangGraph.

Aujourd'hui `react_agent.py` utilise `MemorySaver`. C'est propre pour le developpement, mais ce n'est pas suffisant en production parce que la memoire reste en RAM et disparait au redemarrage du serveur.

Recommandation:

- PostgreSQL checkpointer LangGraph si ton backend Django utilise PostgreSQL en production.
  C'est le choix le plus coherent: durable, auditable, sauvegardable, et aligne avec la base CRM.

- Redis uniquement pour le cache court terme.
  Redis est excellent pour eviter de refaire la meme recherche externe pendant quelques minutes, ou pour stocker des sessions tres courtes. Il ne doit pas etre la memoire longue principale si tu veux garder un historique fiable.

Donc la cible production ideale est:

`LangGraph ReAct + PostgreSQL checkpointer + Redis cache optionnel`

Chroma/RAG n'est pas obligatoire pour le bon fonctionnement de l'agent. Tu pourras le rajouter plus tard si tu veux connecter des documents internes, des playbooks commerciaux ou un historique de prospection consultable par similarite.
