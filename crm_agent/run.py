"""
run.py — Interface CLI pour l'agent CRM avec authentification Django.

Usage :
    python crm_agent/run.py
    python crm_agent/run.py --username ahmed
"""
import os
import sys
import argparse
import django

# ─── Setup Django AVANT tout import des models ───
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from crm_agent.agent import chat_with_memory, reset_memory


BANNER = """
╔══════════════════════════════════════════╗
║       Agent CRM Intelligent 🤖           ║
║   Pilotez votre CRM en langage naturel   ║
╠══════════════════════════════════════════╣
║  Commandes spéciales :                   ║
║   • 'quit' ou 'exit' → quitter           ║
║   • 'reset' → effacer l'historique       ║
║   • 'aide'  → exemples de commandes      ║
╚══════════════════════════════════════════╝
"""

AIDE = """
📖 Exemples de commandes :

👤 Prospects :
  • Ajoute un prospect : Ahmed Ben Ali, email ahmed@test.com, entreprise TechTN, Tunis
  • Montre les prospects chauds
  • Cherche le prospect ahmed
  • Mets le prospect 3 en statut qualifié et évaluation hot
  • Donne-moi les détails du prospect 5

💼 Opportunités :
  • Crée une opportunité "Projet Web" de 8000€ pour le prospect 3
  • Montre les opportunités en négociation
  • Passe l'opportunité 2 en won

📋 Tâches :
  • Crée une tâche "Appel de suivi" pour le prospect 3, priorité haute
  • Montre mes tâches en retard
  • Passe la tâche 7 en done

📊 Statistiques :
  • Stats du CRM
  • Aperçu du pipeline
"""


def get_django_user(username: str):
    """Récupère l'utilisateur Django par son username."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        return User.objects.get(username=username)
    except User.DoesNotExist:
        return None


def list_django_users():
    """Liste tous les utilisateurs Django disponibles."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    users = User.objects.filter(is_active=True).values_list("username", flat=True)
    return list(users)


def main():
    parser = argparse.ArgumentParser(description="Agent CRM CLI")
    parser.add_argument(
        "--username",
        default="",
        help="Username Django pour s'authentifier",
    )
    args = parser.parse_args()

    print(BANNER)

    # ── Authentification ──────────────────────────
    username = args.username
    user = None

    if username:
        user = get_django_user(username)
        if not user:
            print(f"❌ Utilisateur '{username}' introuvable.")
            username = ""

    if not user:
        # Demande à l'utilisateur de choisir
        users = list_django_users()
        if users:
            print("👥 Utilisateurs disponibles :")
            for i, u in enumerate(users, 1):
                print(f"  {i}. {u}")
            print()
            username = input("Entrez votre username : ").strip()
            user = get_django_user(username)
            if not user:
                print(f"❌ '{username}' introuvable — session anonyme.")
                username = "anonymous"
                user_id = "user_anonymous"
                company_id = 1
            else:
                user_id = f"user_{user.id}"
                # Récupère le company_id si disponible
                company_id = getattr(user, "company_id", 1) or 1
        else:
            print("⚠️  Aucun utilisateur Django trouvé — session anonyme.")
            username = "anonymous"
            user_id = "user_anonymous"
            company_id = 1
    else:
        user_id = f"user_{user.id}"
        company_id = getattr(user, "company_id", 1) or 1

    print(f"\n✅ Connecté en tant que : {username} (ID: {user_id}, Company: {company_id})\n")
    print("─" * 50)

    # ── Boucle principale ─────────────────────────
    while True:
        try:
            user_input = input("\nVous : ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n👋 Au revoir !")
            break

        if not user_input:
            continue

        cmd = user_input.lower()

        if cmd in ("quit", "exit"):
            print("👋 Au revoir !")
            break
        elif cmd == "reset":
            print(reset_memory(user_id))
            continue
        elif cmd == "aide":
            print(AIDE)
            continue

        print("\nAgent : ⏳ Traitement en cours...")
        try:
            response = chat_with_memory(
                user_id=user_id,
                user_message=user_input,
                username=username,
                company_id=company_id,
            )
            print(f"\nAgent : {response}")
            print("\n" + "─" * 50)
        except Exception as e:
            print(f"\n❌ Erreur : {str(e)}")


if __name__ == "__main__":
    main()