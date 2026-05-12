# test_simple.py
"""Script de test simple pour l'agent de prospection"""

import sys
import os
from pathlib import Path

# Ajouter le chemin du projet agentProspection
agent_path = Path(__file__).parent / "agentProspection"
if agent_path.exists():
    sys.path.insert(0, str(agent_path))
    print(f"✓ Chemin ajouté: {agent_path}")
else:
    print(f"✗ Dossier agentProspection non trouvé dans: {agent_path}")
    print("Recherche dans le répertoire courant...")
    sys.path.insert(0, str(Path(__file__).parent))

def test_imports():
    """Test des imports des modules"""
    print("\n=== TEST DES IMPORTS ===")
    
    modules_to_test = [
        ("ddgs", "DDGS"),
        ("requests", "requests"),
        ("chromadb", "chromadb"),
    ]
    
    all_ok = True
    for module_name, attr_name in modules_to_test:
        try:
            if module_name == "ddgs":
                from ddgs import DDGS
            elif module_name == "requests":
                import requests
            elif module_name == "chromadb":
                import chromadb
            
            print(f"✓ {module_name} importé avec succès")
        except ImportError as e:
            print(f"✗ {module_name} non trouvé: {e}")
            all_ok = False
    
    return all_ok

def test_tools():
    """Test des outils de prospection"""
    print("\n=== TEST DES OUTILS ===")
    
    try:
        # Essayer d'importer les outils
        from tools.duckduckgo_search import _ddg_search
        
        # Test simple de recherche DuckDuckGo
        print("Test de recherche DuckDuckGo...")
        results = _ddg_search("restaurant Tunis", max_results=2)
        
        if results and len(results) > 0:
            print(f"✓ Recherche OK - {len(results)} résultats trouvés")
            for i, r in enumerate(results[:2]):
                title = r.get('title', 'Sans titre')
                print(f"  {i+1}. {title[:60]}...")
        else:
            print("⚠ Recherche DuckDuckGo retourne 0 résultat")
            print("  (peut être normal, vérifiez votre connexion internet)")
        
        return True
    except ImportError as e:
        print(f"✗ Erreur d'import: {e}")
        print("  Vérifiez que le dossier 'tools' existe avec les fichiers nécessaires")
        return False
    except Exception as e:
        print(f"✗ Erreur lors du test: {e}")
        return False

def test_memory_system():
    """Test du système de mémoire"""
    print("\n=== TEST DU SYSTÈME DE MÉMOIRE ===")
    
    try:
        from memory import MemorySystem
        
        # Créer un dossier pour les tests
        test_dir = "./test_chroma_db"
        memory = MemorySystem(persist_dir=test_dir)
        stats = memory.get_stats()
        
        print(f"✓ Système de mémoire initialisé")
        print(f"  - Mode fallback: {stats.get('fallback', True)}")
        print(f"  - Disponible: {stats.get('available', False)}")
        
        # Test de stockage
        test_company = {
            "name": "Test Company",
            "city": "Tunis",
            "country": "Tunisia",
            "phone": "+216 71 123 456"
        }
        
        doc_id = memory.store_company(test_company)
        if doc_id:
            print(f"✓ Stockage entreprise OK - ID: {doc_id}")
            
            # Test de recherche
            similar = memory.search_similar("Test Company Tunis", "company", top_k=1)
            if similar:
                print(f"✓ Recherche OK - Score: {similar[0]['score']}")
            else:
                print("⚠ Recherche retourne 0 résultat")
        else:
            print("⚠ Stockage entreprise retourne None")
        
        return True
    except ImportError as e:
        print(f"✗ Erreur d'import: {e}")
        print("  Vérifiez que le fichier memory.py existe")
        return False
    except Exception as e:
        print(f"✗ Erreur lors du test: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_scorer():
    """Test du système de scoring"""
    print("\n=== TEST DU SCORER ===")
    
    try:
        from scorer import ProspectScorer
        
        scorer = ProspectScorer()
        
        # Test de scoring contact
        test_contact = {
            "email": "contact@test.com",
            "email_confidence": 80,
            "linkedin_url": "https://linkedin.com/in/test",
            "role": "CEO"
        }
        
        test_company = {
            "phone": "+216 71 123 456",
            "website": "https://test.com",
            "has_social": True,
            "rating": 4.5
        }
        
        score = scorer.score(test_contact, test_company)
        print(f"✓ Score contact: {score}/100")
        
        # Test d'évaluation
        evaluation = scorer.to_evaluation(score)
        print(f"✓ Évaluation: {evaluation}")
        
        return True
    except ImportError as e:
        print(f"✗ Erreur d'import: {e}")
        print("  Vérifiez que le fichier scorer.py existe")
        return False
    except Exception as e:
        print(f"✗ Erreur lors du test: {e}")
        return False

def test_mcp_components():
    """Test des composants MCP"""
    print("\n=== TEST DES COMPOSANTS MCP ===")
    
    try:
        from mcp_loop import MCPState, MCPPhase
        
        # Créer un état de test
        state = MCPState(
            user_query="restaurants à Tunis",
            company_id=1,
            user_id=1,
            requested_radius_km=5,
            requested_max_results=5
        )
        
        print(f"✓ MCPState créé avec succès")
        print(f"  - Query: {state.user_query}")
        print(f"  - Phase: {state.phase.value}")
        
        return True
    except ImportError as e:
        print(f"✗ Erreur d'import: {e}")
        print("  Vérifiez que mcp_loop.py existe")
        return False
    except Exception as e:
        print(f"✗ Erreur lors du test: {e}")
        return False

def main():
    """Fonction principale de test"""
    print("=" * 60)
    print("TEST DE L'AGENT DE PROSPECTION")
    print("=" * 60)
    
    tests = [
        ("Imports", test_imports),
        ("Outils", test_tools),
        ("Mémoire", test_memory_system),
        ("Scorer", test_scorer),
        ("MCP Composants", test_mcp_components)
    ]
    
    results = {}
    for test_name, test_func in tests:
        results[test_name] = test_func()
    
    print("\n" + "=" * 60)
    print("RÉSUMÉ DES TESTS")
    print("=" * 60)
    
    all_passed = True
    for test_name, passed in results.items():
        status = "✓ PASSED" if passed else "✗ FAILED"
        if passed:
            print(f"\033[92m{status}\033[0m - {test_name}")
        else:
            print(f"\033[91m{status}\033[0m - {test_name}")
            all_passed = False
    
    if all_passed:
        print("\n\033[92m✓ TOUS LES TESTS ONT RÉUSSI !\033[0m")
        print("\n\033[93mProchaines étapes:\033[0m")
        print("1. Configurez votre clé API Gemini (optionnel):")
        print("   $env:GEMINI_API_KEY='votre_clé_api'")
        print("\n2. Lancez le serveur Django:")
        print("   python manage.py runserver")
        print("\n3. Testez l'API avec:")
        print("   Invoke-RestMethod -Uri 'http://localhost:8000/api/agent/prospect/' -Method Post -Body '{\"query\":\"restaurants à Tunis\"}' -ContentType 'application/json'")
    else:
        print("\n\033[91m✗ CERTAINS TESTS ONT ÉCHOUÉ\033[0m")
        print("\nVérifications à faire:")
        print("1. Assurez-vous que tous les fichiers sont dans le dossier 'agentProspection'")
        print("2. Vérifiez la structure des dossiers:")
        print("   agentProspection/")
        print("   ├── __init__.py")
        print("   ├── tools/")
        print("   │   ├── __init__.py")
        print("   │   ├── duckduckgo_search.py")
        print("   │   ├── ...")
        print("   ├── memory.py")
        print("   ├── scorer.py")
        print("   └── mcp_loop.py")
        print("\n3. Installez les dépendances manquantes:")
        print("   pip install ddgs chromadb sentence-transformers")

if __name__ == "__main__":
    main()