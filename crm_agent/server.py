"""
server.py — Serveur MCP CRM complet
"""
import os
import sys
from pathlib import Path

print("🟡 [MCP] Démarrage server.py...", file=sys.stderr, flush=True)
print(f"🟡 [MCP] Python : {sys.executable}", file=sys.stderr, flush=True)
print(f"🟡 [MCP] CWD    : {os.getcwd()}", file=sys.stderr, flush=True)

try:
    BASE_DIR = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(BASE_DIR))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    import django
    django.setup()
    print("✅ [MCP] Django setup OK", file=sys.stderr, flush=True)
except Exception as e:
    print(f"❌ [MCP] ERREUR : {e}", file=sys.stderr, flush=True)
    sys.exit(1)

from mcp.server.fastmcp import FastMCP
from asgiref.sync import sync_to_async
from django.db.models import Q, Sum, Avg
from django.utils import timezone

mcp = FastMCP("crm-tools")


def _user_display(user):
    return f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip() or user.username


def _get_assignable_user(user_id, company_id):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.get(id=user_id, company_id=company_id, is_active=True)


def _apply_assignee(data, assigned_to_id, company_id, changed=None):
    if assigned_to_id:
        user = _get_assignable_user(assigned_to_id, company_id)
        data["assigned_to"] = user
        if changed is not None:
            changed.append(f"assigné à {_user_display(user)}")
        return user
    return None


# ═══════════════════════════════════════════════════════════════
# UTILISATEURS
# ═══════════════════════════════════════════════════════════════

@mcp.tool()
async def get_users(company_id: int = 1) -> str:
    """
    Lister les commerciaux disponibles dans le CRM.
    Utilise cet outil pour trouver à qui assigner une tâche ou un prospect.
    """
    @sync_to_async
    def _run():
        from django.contrib.auth import get_user_model
        User = get_user_model()
        users = list(User.objects.filter(company_id=company_id, is_active=True)
                     .values("id", "username", "email", "role"))
        if not users:
            return "Aucun utilisateur trouvé."
        lines = ["👥 Commerciaux disponibles :"]
        for u in users:
            lines.append(f"  [{u['id']}] {u['username']} | {u['email']} | Rôle: {u['role']}")
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur : {str(e)}"


@mcp.tool()
async def get_user_detail(user_id: int) -> str:
    """Obtenir les détails d'un commercial."""
    @sync_to_async
    def _run():
        from django.contrib.auth import get_user_model
        User = get_user_model()
        u = User.objects.get(id=user_id)
        return (
            f"👤 Utilisateur #{u.id}\n"
            f"  Nom       : {u.username}\n"
            f"  Email     : {u.email}\n"
            f"  Rôle      : {u.role}\n"
            f"  Téléphone : {u.phone_number or 'N/A'}\n"
            f"  Ville     : {u.city or 'N/A'} | Pays: {u.country or 'N/A'}\n"
            f"  Poste     : {u.job_title or 'N/A'}\n"
            f"  Actif     : {'Oui' if u.is_active else 'Non'}"
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Utilisateur #{user_id} introuvable : {str(e)}"


# ═══════════════════════════════════════════════════════════════
# PROSPECTS
# ═══════════════════════════════════════════════════════════════

@mcp.tool()
async def add_prospect(
    first_name: str, last_name: str, email: str, company_name: str,
    phone: str = "", title: str = "", city: str = "", country: str = "",
    origin: str = "website", evaluation: str = "warm", company_id: int = 1,
    assigned_to_id: int = None,
) -> str:
    """
    Ajouter un nouveau prospect.
    origin: website | facebook | linkedin | referral
    evaluation: cold | warm | hot
    assigned_to_id: commercial/admin responsable du prospect. Si absent, utilise l'utilisateur connecté.
    """
    @sync_to_async
    def _run():
        from sales.models import Prospect, ProspectCompany
        from users.models import Company
        crm_company = Company.objects.get(id=company_id)
        prospect_company, _ = ProspectCompany.objects.get_or_create(
            name=company_name, company=crm_company,
        )
        data = dict(
            first_name=first_name, last_name=last_name, email=email,
            phone=phone, title=title, city=city, country=country,
            origin=origin, evaluation=evaluation, status="new",
            prospect_company=prospect_company, company=crm_company,
        )
        assignee = _apply_assignee(data, assigned_to_id, company_id)
        prospect = Prospect.objects.create(**data)
        return (
            f"✅ Prospect ajouté !\n"
            f"  {first_name} {last_name} | {email}\n"
            f"  Entreprise: {company_name} | Éval: {evaluation}"
            + (f"\n  Assigné à: {_user_display(assignee)}" if assignee else "\n  Assignation: à compléter")
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur ajout prospect : {str(e)}"


@mcp.tool()
async def search_prospect(query: str, company_id: int = 1) -> str:
    """Rechercher un prospect par nom, prénom, email, téléphone ou entreprise."""
    @sync_to_async
    def _run():
        from sales.models import Prospect
        results = Prospect.objects.filter(company_id=company_id).filter(
            Q(first_name__icontains=query) | Q(last_name__icontains=query)
            | Q(email__icontains=query) | Q(phone__icontains=query)
            | Q(prospect_company__name__icontains=query)
        ).select_related("prospect_company", "assigned_to")[:10]
        if not results.exists():
            return f"🔍 Aucun prospect trouvé pour '{query}'"
        lines = [f"🔍 {results.count()} résultat(s) pour '{query}' :"]
        for p in results:
            assigned = p.assigned_to.username if p.assigned_to else "Non assigné"
            lines.append(
                f"  [{p.id}] {p.first_name} {p.last_name} | {p.email} | "
                f"Statut: {p.status} | Éval: {p.evaluation or 'N/A'} | "
                f"Entreprise: {p.prospect_company.name} | Assigné: {assigned}"
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur recherche : {str(e)}"


@mcp.tool()
async def get_prospects(
    status: str = "", evaluation: str = "", limit: int = 10, company_id: int = 1,
) -> str:
    """
    Lister les prospects avec filtres optionnels.
    status: new | contacted | qualified | lost | won
    evaluation: cold | warm | hot
    """
    @sync_to_async
    def _run():
        from sales.models import Prospect
        qs = Prospect.objects.filter(company_id=company_id).select_related("prospect_company", "assigned_to")
        if status:
            qs = qs.filter(status=status)
        if evaluation:
            qs = qs.filter(evaluation=evaluation)
        qs = qs.order_by("-created_at")[:limit]
        if not qs.exists():
            return "👤 Aucun prospect trouvé."
        label = f"evaluation={evaluation}" if evaluation else f"status={status or 'tous'}"
        lines = [f"👤 {qs.count()} prospect(s) [{label}] :"]
        for p in qs:
            assigned = p.assigned_to.username if p.assigned_to else "—"
            lines.append(
                f"  [{p.id}] {p.first_name} {p.last_name} | "
                f"Statut: {p.status} | Éval: {p.evaluation or 'N/A'} | "
                f"Assigné: {assigned} | {p.prospect_company.name}"
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur liste prospects : {str(e)}"


@mcp.tool()
async def get_prospect_detail(prospect_id: int) -> str:
    """Obtenir tous les détails d'un prospect par son ID."""
    @sync_to_async
    def _run():
        from sales.models import Prospect
        p = Prospect.objects.select_related("prospect_company", "assigned_to").get(id=prospect_id)
        assigned = p.assigned_to.username if p.assigned_to else "Non assigné"
        return (
            f"👤 Prospect #{p.id}\n"
            f"  Nom       : {p.first_name} {p.last_name}\n"
            f"  Email     : {p.email}\n"
            f"  Téléphone : {p.phone or 'N/A'}\n"
            f"  Titre     : {p.title or 'N/A'}\n"
            f"  Ville     : {p.city or 'N/A'} | Pays: {p.country or 'N/A'}\n"
            f"  Entreprise: {p.prospect_company.name}\n"
            f"  Statut    : {p.status} | Évaluation: {p.evaluation or 'N/A'}\n"
            f"  Origine   : {p.origin} | Assigné à: {assigned}\n"
            f"  Créé le   : {p.created_at.strftime('%d/%m/%Y %H:%M')}"
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Prospect #{prospect_id} introuvable : {str(e)}"


@mcp.tool()
async def update_prospect_status(prospect_id: int, status: str, evaluation: str = "") -> str:
    """
    Mettre à jour statut et/ou évaluation d'un prospect.
    status: new | contacted | qualified | lost | won
    evaluation: cold | warm | hot
    """
    @sync_to_async
    def _run():
        from sales.models import Prospect
        p = Prospect.objects.get(id=prospect_id)
        old_status = p.status
        p.status = status
        if evaluation:
            p.evaluation = evaluation
        p.save()
        return (
            f"✅ {p.first_name} {p.last_name} : {old_status} → {status}"
            + (f" | Éval: {evaluation}" if evaluation else "")
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur update prospect : {str(e)}"


@mcp.tool()
async def update_prospect_info(
    prospect_id: int, phone: str = "", city: str = "",
    country: str = "", title: str = "", email: str = "",
) -> str:
    """Mettre à jour les informations d'un prospect. Passe uniquement les champs à modifier."""
    @sync_to_async
    def _run():
        from sales.models import Prospect
        p = Prospect.objects.get(id=prospect_id)
        changed = []
        if phone:   p.phone = phone;     changed.append(f"tél → {phone}")
        if city:    p.city = city;       changed.append(f"ville → {city}")
        if country: p.country = country; changed.append(f"pays → {country}")
        if title:   p.title = title;     changed.append(f"titre → {title}")
        if email:   p.email = email;     changed.append(f"email → {email}")
        p.save()
        return f"✅ Prospect #{prospect_id} mis à jour : {' | '.join(changed)}"
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur mise à jour prospect : {str(e)}"


@mcp.tool()
async def assign_prospect(prospect_id: int, user_id: int) -> str:
    """Assigner un prospect à un commercial."""
    @sync_to_async
    def _run():
        from sales.models import Prospect
        p = Prospect.objects.get(id=prospect_id)
        user = _get_assignable_user(user_id, p.company_id)
        p.assigned_to = user
        p.save(update_fields=["assigned_to", "updated_at"])
        return f"✅ Prospect '{p.first_name} {p.last_name}' assigné à {_user_display(user)}"
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur assignation prospect : {str(e)}"


# ═══════════════════════════════════════════════════════════════
# CONTACTS
# ═══════════════════════════════════════════════════════════════

@mcp.tool()
async def get_contacts(query: str = "", company_id: int = 1) -> str:
    """Rechercher ou lister les contacts clients."""
    @sync_to_async
    def _run():
        from sales.models import Contact
        qs = Contact.objects.filter(company_id=company_id)
        if query:
            qs = qs.filter(
                Q(first_name__icontains=query) | Q(last_name__icontains=query)
                | Q(email__icontains=query)
            )
        qs = qs.select_related("account", "assigned_to")[:10]
        if not qs.exists():
            return "📇 Aucun contact trouvé."
        lines = [f"📇 {qs.count()} contact(s) :"]
        for c in qs:
            account_name = c.account.name if c.account else "N/A"
            assigned = c.assigned_to.username if c.assigned_to else "—"
            lines.append(
                f"  [{c.id}] {c.first_name} {c.last_name} | "
                f"{c.email} | {c.phone or 'N/A'} | "
                f"Compte: {account_name} | Assigné: {assigned}"
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur contacts : {str(e)}"


@mcp.tool()
async def add_contact(
    first_name: str, last_name: str, email: str,
    phone: str = "", title: str = "", city: str = "", country: str = "",
    account_id: int = None, company_id: int = 1, assigned_to_id: int = None,
) -> str:
    """Ajouter un nouveau contact client et l'assigner à un commercial/admin."""
    @sync_to_async
    def _run():
        from sales.models import Contact
        from users.models import Company
        data = {
            "first_name": first_name, "last_name": last_name,
            "email": email, "phone": phone, "title": title, "city": city, "country": country,
            "company": Company.objects.get(id=company_id),
        }
        if account_id:
            from sales.models import Account
            data["account"] = Account.objects.get(id=account_id)
        assignee = _apply_assignee(data, assigned_to_id, company_id)
        contact = Contact.objects.create(**data)
        return (
            f"✅ Contact créé : {first_name} {last_name} | {email}"
            + (f"\n  Assigné à: {_user_display(assignee)}" if assignee else "\n  Assignation: à compléter")
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur création contact : {str(e)}"


@mcp.tool()
async def get_contact_detail(contact_id: int) -> str:
    """Obtenir tous les détails d'un contact."""
    @sync_to_async
    def _run():
        from sales.models import Contact
        c = Contact.objects.select_related("account", "assigned_to").get(id=contact_id)
        return (
            f"📇 Contact #{c.id}\n"
            f"  Nom       : {c.first_name} {c.last_name}\n"
            f"  Email     : {c.email}\n"
            f"  Téléphone : {c.phone or 'N/A'}\n"
            f"  Titre     : {c.title or 'N/A'}\n"
            f"  Ville     : {c.city or 'N/A'} | Pays: {c.country or 'N/A'}\n"
            f"  Compte    : {c.account.name if c.account else 'N/A'}\n"
            f"  Assigné à : {c.assigned_to.username if c.assigned_to else 'N/A'}\n"
            f"  Créé le   : {c.created_at.strftime('%d/%m/%Y %H:%M')}"
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Contact #{contact_id} introuvable : {str(e)}"


@mcp.tool()
async def assign_contact(contact_id: int, user_id: int) -> str:
    """Assigner un contact à un commercial."""
    @sync_to_async
    def _run():
        from sales.models import Contact
        c = Contact.objects.get(id=contact_id)
        user = _get_assignable_user(user_id, c.company_id)
        c.assigned_to = user
        c.save(update_fields=["assigned_to", "updated_at"])
        return f"✅ Contact '{c.first_name} {c.last_name}' assigné à {_user_display(user)}"
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur assignation contact : {str(e)}"


# ═══════════════════════════════════════════════════════════════
# COMPTES (ACCOUNTS)
# ═══════════════════════════════════════════════════════════════

@mcp.tool()
async def get_accounts(query: str = "", company_id: int = 1) -> str:
    """Lister ou rechercher les comptes clients."""
    @sync_to_async
    def _run():
        from sales.models import Account
        qs = Account.objects.filter(company_id=company_id)
        if query:
            qs = qs.filter(Q(name__icontains=query) | Q(industry__icontains=query))
        qs = qs[:10]
        if not qs.exists():
            return "🏢 Aucun compte trouvé."
        lines = [f"🏢 {qs.count()} compte(s) :"]
        for a in qs:
            lines.append(
                f"  [{a.id}] {a.name} | {a.industry or 'N/A'} | "
                f"{a.city or 'N/A'}, {a.country or 'N/A'}"
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur comptes : {str(e)}"


@mcp.tool()
async def get_account_detail(account_id: int) -> str:
    """Obtenir les détails d'un compte client avec ses contacts."""
    @sync_to_async
    def _run():
        from sales.models import Account
        a = Account.objects.prefetch_related("contacts").get(id=account_id)
        contacts = list(a.contacts.all()[:5])
        contact_list = ", ".join(f"{c.first_name} {c.last_name}" for c in contacts) or "Aucun"
        return (
            f"🏢 Compte #{a.id}\n"
            f"  Nom       : {a.name}\n"
            f"  Secteur   : {a.industry or 'N/A'}\n"
            f"  Téléphone : {a.phone or 'N/A'}\n"
            f"  Email     : {a.email or 'N/A'}\n"
            f"  Ville     : {a.city or 'N/A'} | Pays: {a.country or 'N/A'}\n"
            f"  Contacts  : {contact_list}"
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Compte #{account_id} introuvable : {str(e)}"


# ═══════════════════════════════════════════════════════════════
# OPPORTUNITÉS
# ═══════════════════════════════════════════════════════════════

@mcp.tool()
async def add_opportunity(
    name: str, amount: float, prospect_id: int = None, contact_id: int = None,
    stage: str = "new", expected_close_date: str = "", company_id: int = 1,
    assigned_to_id: int = None,
) -> str:
    """
    Créer une nouvelle opportunité commerciale.
    stage: new | qualified | proposal | negotiation | won | lost
    expected_close_date: format YYYY-MM-DD (optionnel)
    assigned_to_id: commercial/admin responsable. Si absent, utilise l'utilisateur connecté.
    """
    @sync_to_async
    def _run():
        from sales.models import Opportunity
        from users.models import Company
        crm_company = Company.objects.get(id=company_id)
        data = {"name": name, "amount": amount, "stage": stage, "company": crm_company}
        if prospect_id:
            from sales.models import Prospect
            data["prospect"] = Prospect.objects.get(id=prospect_id)
        if contact_id:
            from sales.models import Contact
            data["contact"] = Contact.objects.get(id=contact_id)
        if expected_close_date:
            from datetime import date
            data["expected_close_date"] = date.fromisoformat(expected_close_date)
        assignee = _apply_assignee(data, assigned_to_id, company_id)
        opp = Opportunity.objects.create(**data)
        return (
            f"💼 Opportunité créée : {name} | {amount}€ | Stage: {stage}"
            + (f"\n  Assignée à: {_user_display(assignee)}" if assignee else "\n  Assignation: à compléter")
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur création opportunité : {str(e)}"


@mcp.tool()
async def get_opportunities(stage: str = "", company_id: int = 1, limit: int = 10) -> str:
    """
    Lister les opportunités avec filtre optionnel par stage.
    stage: new | qualified | proposal | negotiation | won | lost
    """
    @sync_to_async
    def _run():
        from sales.models import Opportunity
        qs = Opportunity.objects.filter(company_id=company_id).select_related("prospect", "contact", "assigned_to")
        if stage:
            qs = qs.filter(stage=stage)
        qs = qs.order_by("-created_at")[:limit]
        if not qs.exists():
            return "💼 Aucune opportunité trouvée."
        lines = [f"💼 {qs.count()} opportunité(s) :"]
        for o in qs:
            linked = ""
            if o.prospect:
                linked = f"| 👤 {o.prospect.first_name} {o.prospect.last_name}"
            elif o.contact:
                linked = f"| 📇 {o.contact.first_name} {o.contact.last_name}"
            assigned = f"| 👷 {o.assigned_to.username}" if o.assigned_to else ""
            lines.append(f"  [{o.id}] {o.name} | {o.amount}€ | {o.stage} {linked}{assigned}")
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur liste opportunités : {str(e)}"


@mcp.tool()
async def get_opportunity_detail(opportunity_id: int) -> str:
    """Obtenir tous les détails d'une opportunité."""
    @sync_to_async
    def _run():
        from sales.models import Opportunity
        o = Opportunity.objects.select_related("prospect", "contact", "assigned_to").get(id=opportunity_id)
        linked = ""
        if o.prospect: linked = f"{o.prospect.first_name} {o.prospect.last_name}"
        elif o.contact: linked = f"{o.contact.first_name} {o.contact.last_name}"
        return (
            f"💼 Opportunité #{o.id}\n"
            f"  Nom       : {o.name}\n"
            f"  Montant   : {o.amount}€\n"
            f"  Stage     : {o.stage}\n"
            f"  Lié à     : {linked or 'N/A'}\n"
            f"  Assigné à : {o.assigned_to.username if o.assigned_to else 'N/A'}\n"
            f"  Clôture   : {o.expected_close_date or 'N/A'}\n"
            f"  Créé le   : {o.created_at.strftime('%d/%m/%Y %H:%M')}"
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Opportunité #{opportunity_id} introuvable : {str(e)}"


@mcp.tool()
async def update_opportunity_stage(opportunity_id: int, new_stage: str) -> str:
    """
    Changer le stage d'une opportunité.
    new_stage: new | qualified | proposal | negotiation | won | lost
    """
    @sync_to_async
    def _run():
        from sales.models import Opportunity
        opp = Opportunity.objects.get(id=opportunity_id)
        old_stage = opp.stage
        opp.stage = new_stage
        opp.save()
        return f"✅ Opportunité '{opp.name}' : {old_stage} → {new_stage}"
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur update opportunité : {str(e)}"


@mcp.tool()
async def update_opportunity(
    opportunity_id: int, name: str = "", amount: float = None,
    expected_close_date: str = "", assigned_to_id: int = None,
) -> str:
    """Modifier les informations d'une opportunité. Passe uniquement les champs à modifier."""
    @sync_to_async
    def _run():
        from sales.models import Opportunity
        opp = Opportunity.objects.get(id=opportunity_id)
        changed = []
        if name:
            opp.name = name
            changed.append(f"nom → {name}")
        if amount is not None:
            opp.amount = amount
            changed.append(f"montant → {amount}€")
        if expected_close_date:
            from datetime import date
            opp.expected_close_date = date.fromisoformat(expected_close_date)
            changed.append(f"clôture → {expected_close_date}")
        if assigned_to_id:
            user = _get_assignable_user(assigned_to_id, opp.company_id)
            opp.assigned_to = user
            changed.append(f"assigné → {_user_display(user)}")
        opp.save()
        return f"✅ Opportunité '{opp.name}' mise à jour : {' | '.join(changed)}"
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur update opportunité : {str(e)}"


@mcp.tool()
async def assign_opportunity(opportunity_id: int, user_id: int) -> str:
    """Assigner une opportunité à un commercial/admin. Utilise get_users pour trouver l'utilisateur."""
    @sync_to_async
    def _run():
        from sales.models import Opportunity

        opp = Opportunity.objects.get(id=opportunity_id)
        user = _get_assignable_user(user_id, opp.company_id)
        opp.assigned_to = user
        opp.save(update_fields=["assigned_to", "updated_at"])
        return f"✅ Opportunité '{opp.name}' assignée à {_user_display(user)}"
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur assignation opportunité : {str(e)}"


# ═══════════════════════════════════════════════════════════════
# TÂCHES
# ═══════════════════════════════════════════════════════════════

@mcp.tool()
async def add_task(
    title: str, description: str = "", priority: str = "medium", status: str = "todo",
    prospect_id: int = None, contact_id: int = None, opportunity_id: int = None,
    due_date: str = "", company_id: int = 1, assigned_to_id: int = None,
) -> str:
    """
    Créer une tâche dans le CRM.
    priority: low | medium | high
    status: todo | in_progress | done | cancelled
    due_date: format YYYY-MM-DD HH:MM (optionnel)
    assigned_to_id: commercial/admin responsable. Si absent, utilise l'utilisateur connecté.
    """
    @sync_to_async
    def _run():
        from sales.models import Task
        from users.models import Company
        data = {
            "title": title, "description": description,
            "priority": priority, "status": status,
            "company": Company.objects.get(id=company_id),
        }
        if prospect_id:    data["prospect_id"] = prospect_id
        if contact_id:     data["contact_id"] = contact_id
        if opportunity_id: data["opportunity_id"] = opportunity_id
        assignee = _apply_assignee(data, assigned_to_id, company_id)
        if due_date:
            from django.utils.dateparse import parse_datetime
            data["due_date"] = parse_datetime(due_date)
        task = Task.objects.create(**data)
        return (
            f"📋 Tâche créée : {title}\n"
            f"  Priorité: {priority} | Statut: {status}"
            + (f" | Échéance: {due_date}" if due_date else "")
            + (f"\n  Assignée à: {_user_display(assignee)}" if assignee else "\n  Assignation: à compléter")
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur création tâche : {str(e)}"


@mcp.tool()
async def get_tasks(
    status: str = "todo", priority: str = "",
    assigned_to_id: int = None, company_id: int = 1, limit: int = 15,
) -> str:
    """
    Lister les tâches avec filtres.
    status: todo | in_progress | done | cancelled
    priority: low | medium | high
    assigned_to_id: filtrer par commercial (optionnel)
    """
    @sync_to_async
    def _run():
        from sales.models import Task
        qs = Task.objects.filter(company_id=company_id).select_related(
            "prospect", "contact", "assigned_to"
        )
        if status:
            qs = qs.filter(status=status)
        if priority:
            qs = qs.filter(priority=priority)
        if assigned_to_id:
            qs = qs.filter(assigned_to_id=assigned_to_id)
        qs = qs.order_by("due_date", "-created_at")[:limit]
        if not qs.exists():
            return "📋 Aucune tâche trouvée."
        lines = [f"📋 {qs.count()} tâche(s) :"]
        for t in qs:
            retard = " ⚠️ EN RETARD" if t.is_overdue else ""
            linked = ""
            if t.prospect: linked = f"| 👤 {t.prospect.first_name} {t.prospect.last_name}"
            elif t.contact: linked = f"| 📇 {t.contact.first_name} {t.contact.last_name}"
            assigned = f"| 👷 {t.assigned_to.username}" if t.assigned_to else ""
            lines.append(
                f"  [{t.id}] {t.title} | {t.priority} | {t.status} {linked}{assigned}{retard}"
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur liste tâches : {str(e)}"


@mcp.tool()
async def get_task_detail(task_id: int) -> str:
    """Obtenir tous les détails d'une tâche avec ses activités."""
    @sync_to_async
    def _run():
        from sales.models import Task
        t = Task.objects.select_related(
            "prospect", "contact", "opportunity", "assigned_to"
        ).get(id=task_id)
        linked = ""
        if t.prospect: linked = f"{t.prospect.first_name} {t.prospect.last_name}"
        elif t.contact: linked = f"{t.contact.first_name} {t.contact.last_name}"
        return (
            f"📋 Tâche #{t.id}\n"
            f"  Titre     : {t.title}\n"
            f"  Desc      : {t.description or 'N/A'}\n"
            f"  Priorité  : {t.priority} | Statut: {t.status}\n"
            f"  Lié à     : {linked or 'N/A'}\n"
            f"  Assigné à : {t.assigned_to.username if t.assigned_to else 'N/A'}\n"
            f"  Échéance  : {t.due_date.strftime('%d/%m/%Y %H:%M') if t.due_date else 'N/A'}\n"
            f"  En retard : {'⚠️ Oui' if t.is_overdue else 'Non'}\n"
            f"  Activités : appels={t.calls_count} | emails={t.emails_count} | meetings={t.meetings_count} | notes={t.notes_count}"
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Tâche #{task_id} introuvable : {str(e)}"


@mcp.tool()
async def update_task_status(task_id: int, status: str) -> str:
    """
    Mettre à jour le statut d'une tâche.
    status: todo | in_progress | done | cancelled
    """
    @sync_to_async
    def _run():
        from sales.models import Task
        task = Task.objects.get(id=task_id)
        old_status = task.status
        task.status = status
        if status == "done" and not task.closed_at:
            task.closed_at = timezone.now()
        task.save()
        return f"✅ Tâche '{task.title}' : {old_status} → {status}"
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur update tâche : {str(e)}"


@mcp.tool()
async def update_task(
    task_id: int, title: str = "", description: str = "",
    priority: str = "", due_date: str = "",
) -> str:
    """Modifier les informations d'une tâche. Passe uniquement les champs à modifier."""
    @sync_to_async
    def _run():
        from sales.models import Task
        task = Task.objects.get(id=task_id)
        changed = []
        if title:       task.title = title;             changed.append(f"titre → {title}")
        if description: task.description = description; changed.append("description mise à jour")
        if priority:    task.priority = priority;       changed.append(f"priorité → {priority}")
        if due_date:
            from django.utils.dateparse import parse_datetime
            task.due_date = parse_datetime(due_date)
            changed.append(f"échéance → {due_date}")
        task.save()
        return f"✅ Tâche '{task.title}' mise à jour : {' | '.join(changed)}"
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur update tâche : {str(e)}"


@mcp.tool()
async def assign_task(task_id: int, user_id: int) -> str:
    """Assigner une tâche à un commercial. Utilise get_users pour trouver l'ID."""
    @sync_to_async
    def _run():
        from sales.models import Task
        task = Task.objects.get(id=task_id)
        user = _get_assignable_user(user_id, task.company_id)
        task.assigned_to = user
        task.save(update_fields=["assigned_to", "updated_at"])
        return f"✅ Tâche '{task.title}' assignée à {_user_display(user)}"
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur assignation : {str(e)}"


@mcp.tool()
async def close_task(task_id: int, closing_report: str = "") -> str:
    """Clôturer une tâche avec un rapport optionnel."""
    @sync_to_async
    def _run():
        from sales.models import Task
        task = Task.objects.get(id=task_id)
        task.status = "done"
        task.closing_report = closing_report
        task.closed_at = timezone.now()
        task.save()
        return f"✅ Tâche '{task.title}' clôturée" + (f" avec rapport." if closing_report else ".")
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur clôture tâche : {str(e)}"


# ═══════════════════════════════════════════════════════════════
# ACTIVITÉS DE TÂCHE (TaskActivity)
# ═══════════════════════════════════════════════════════════════

@mcp.tool()
async def add_task_activity(
    task_id: int,
    activity_type: str,
    notes: str = "",
    performed_by_id: int = None,
    prospect_id: int = None,
    contact_id: int = None,
    call_result: str = "",
    call_duration_minutes: int = None,
    email_subject: str = "",
    email_sent_to: str = "",
    meeting_date: str = "",
    meeting_location: str = "",
    company_id: int = 1,
) -> str:
    """
    Enregistrer une activité sur une tâche.
    activity_type: call | email | note | meeting | status_change
    call_result: interested | callback | not_interested | no_answer
    meeting_date: format YYYY-MM-DD HH:MM (optionnel)
    """
    @sync_to_async
    def _run():
        from sales.models import TaskActivity
        data = {
            "task_id": task_id,
            "activity_type": activity_type,
            "notes": notes,
        }
        if performed_by_id:
            data["performed_by"] = User.objects.get(id=performed_by_id)
        if prospect_id:
            data["prospect_id"] = prospect_id
        if contact_id:
            data["contact_id"] = contact_id
        if call_result:
            data["call_result"] = call_result
        if call_duration_minutes:
            data["call_duration_minutes"] = call_duration_minutes
        if email_subject:
            data["email_subject"] = email_subject
        if email_sent_to:
            data["email_sent_to"] = email_sent_to
        if meeting_date:
            from django.utils.dateparse import parse_datetime
            data["meeting_date"] = parse_datetime(meeting_date)
        if meeting_location:
            data["meeting_location"] = meeting_location
        activity = TaskActivity.objects.create(**data)
        return f"✅ Activité '{activity_type}' enregistrée sur la tâche #{task_id}"
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur création activité : {str(e)}"


@mcp.tool()
async def get_task_activities(task_id: int, limit: int = 10) -> str:
    """Lister les activités d'une tâche."""
    @sync_to_async
    def _run():
        from sales.models import TaskActivity
        activities = TaskActivity.objects.filter(task_id=task_id).select_related(
            "performed_by", "prospect", "contact"
        )[:limit]
        if not activities.exists():
            return f"📝 Aucune activité pour la tâche #{task_id}"
        lines = [f"📝 {activities.count()} activité(s) pour tâche #{task_id} :"]
        for a in activities:
            performer = a.performed_by.username if a.performed_by else "N/A"
            lines.append(
                f"  [{a.id}] {a.activity_type} | par {performer} | "
                f"{a.created_at.strftime('%d/%m/%Y %H:%M')}"
                + (f" | {a.notes[:50]}" if a.notes else "")
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur activités : {str(e)}"


@mcp.tool()
async def add_task_comment(task_id: int, content: str, author_id: int) -> str:
    """Ajouter un commentaire à une tâche."""
    @sync_to_async
    def _run():
        from sales.models import TaskComment
        from django.contrib.auth import get_user_model
        User = get_user_model()
        comment = TaskComment.objects.create(
            task_id=task_id,
            content=content,
            author=User.objects.get(id=author_id),
        )
        return f"✅ Commentaire ajouté à la tâche #{task_id}"
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur commentaire : {str(e)}"


@mcp.tool()
async def get_task_comments(task_id: int) -> str:
    """Lister les commentaires d'une tâche."""
    @sync_to_async
    def _run():
        from sales.models import TaskComment
        comments = TaskComment.objects.filter(task_id=task_id).select_related("author")[:10]
        if not comments.exists():
            return f"💬 Aucun commentaire pour la tâche #{task_id}"
        lines = [f"💬 {comments.count()} commentaire(s) :"]
        for c in comments:
            author = c.author.username if c.author else "N/A"
            lines.append(
                f"  [{c.id}] {author} ({c.created_at.strftime('%d/%m/%Y %H:%M')}) : {c.content[:100]}"
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur commentaires : {str(e)}"


# ═══════════════════════════════════════════════════════════════
# PIPELINE
# ═══════════════════════════════════════════════════════════════

@mcp.tool()
async def get_pipeline_overview(company_id: int = 1) -> str:
    """Afficher un aperçu du pipeline commercial avec le nombre d'opportunités par étape."""
    @sync_to_async
    def _run():
        from sales.models import Pipeline
        pipelines = Pipeline.objects.filter(
            company_id=company_id, is_active=True
        ).prefetch_related("stages", "opportunities")
        if not pipelines.exists():
            return "🔄 Aucun pipeline trouvé."
        lines = ["🔄 Pipeline commercial :"]
        for pipeline in pipelines:
            lines.append(f"\n  ▸ {pipeline.name} ({pipeline.pipeline_type})")
            for stage in pipeline.stages.order_by("order"):
                count = stage.pipeline_opportunities.count()
                bar = "█" * min(count, 10)
                lines.append(f"    {stage.name:<20} {bar} {count}")
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur pipeline : {str(e)}"


@mcp.tool()
async def get_pipeline_alerts(company_id: int = 1, severity: str = "") -> str:
    """
    Lister les alertes pipeline actives.
    severity: info | warning | critical (optionnel)
    """
    @sync_to_async
    def _run():
        from sales.models import PipelineAlert
        qs = PipelineAlert.objects.filter(
            company_id=company_id, is_resolved=False
        ).select_related("opportunity_pipeline__opportunity", "assigned_to")
        if severity:
            qs = qs.filter(severity=severity)
        qs = qs[:15]
        if not qs.exists():
            return "✅ Aucune alerte pipeline active."
        lines = [f"🚨 {qs.count()} alerte(s) pipeline :"]
        for a in qs:
            opp_name = a.opportunity_pipeline.opportunity.name
            lines.append(
                f"  [{a.id}] [{a.severity.upper()}] {a.get_alert_type_display()} | "
                f"Opportunité: {opp_name} | {a.message[:60]}"
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur alertes pipeline : {str(e)}"


@mcp.tool()
async def move_opportunity_pipeline_stage(
    opportunity_pipeline_id: int, stage_id: int, notes: str = "", performed_by_id: int = None,
) -> str:
    """Déplacer une opportunité vers une nouvelle étape du pipeline."""
    @sync_to_async
    def _run():
        from sales.models import OpportunityPipeline, PipelineStage, StageHistory
        from django.contrib.auth import get_user_model
        User = get_user_model()
        op = OpportunityPipeline.objects.select_related("current_stage", "opportunity").get(id=opportunity_pipeline_id)
        new_stage = PipelineStage.objects.get(id=stage_id)
        old_stage = op.current_stage
        elapsed = (timezone.now() - op.stage_entered_at).total_seconds() / 3600
        StageHistory.objects.create(
            opportunity_pipeline=op,
            from_stage=old_stage,
            to_stage=new_stage,
            action="moved_forward" if (new_stage.order > (old_stage.order if old_stage else 0)) else "moved_backward",
            performed_by=User.objects.get(id=performed_by_id) if performed_by_id else None,
            notes=notes,
            duration_in_stage_hours=round(elapsed, 1),
            company=op.company,
        )
        op.current_stage = new_stage
        op.stage_entered_at = timezone.now()
        op.refresh_computed_fields()
        return (
            f"✅ Opportunité '{op.opportunity.name}' déplacée :\n"
            f"  {old_stage.name if old_stage else 'N/A'} → {new_stage.name}"
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur déplacement pipeline : {str(e)}"


# ═══════════════════════════════════════════════════════════════
# CALENDRIER
# ═══════════════════════════════════════════════════════════════

@mcp.tool()
async def get_calendar_events(
    start_date: str = "", end_date: str = "",
    event_type: str = "", company_id: int = 1, limit: int = 10,
) -> str:
    """
    Lister les événements du calendrier CRM.
    event_type: task | meeting | deadline | reminder | stage | activity | pipeline_alert
    start_date / end_date: format YYYY-MM-DD (optionnel)
    """
    @sync_to_async
    def _run():
        from calendar_module.models import CalendarEvent
        qs = CalendarEvent.objects.filter(company_id=company_id).select_related("assigned_to")
        if event_type:
            qs = qs.filter(event_type=event_type)
        if start_date:
            from django.utils.dateparse import parse_date
            qs = qs.filter(start__date__gte=parse_date(start_date))
        if end_date:
            from django.utils.dateparse import parse_date
            qs = qs.filter(start__date__lte=parse_date(end_date))
        qs = qs.order_by("start")[:limit]
        if not qs.exists():
            return "📅 Aucun événement trouvé."
        lines = [f"📅 {qs.count()} événement(s) :"]
        for e in qs:
            assigned = e.assigned_to.username if e.assigned_to else "—"
            lines.append(
                f"  [{e.id}] {e.title} | {e.event_type} | "
                f"{e.start.strftime('%d/%m/%Y %H:%M')} | Assigné: {assigned}"
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur calendrier : {str(e)}"


@mcp.tool()
async def add_calendar_event(
    title: str, start: str, event_type: str = "meeting",
    description: str = "", end: str = "", priority: str = "medium",
    assigned_to_id: int = None, task_id: int = None,
    opportunity_id: int = None, reminder: int = None,
    company_id: int = 1,
) -> str:
    """
    Créer un événement dans le calendrier CRM.
    event_type: task | meeting | deadline | reminder | stage | activity
    start / end: format YYYY-MM-DD HH:MM
    priority: low | medium | high | critical
    reminder: minutes avant l'événement (optionnel)
    """
    @sync_to_async
    def _run():
        from calendar_module.models import CalendarEvent
        from users.models import Company
        from django.utils.dateparse import parse_datetime
        from django.contrib.auth import get_user_model
        User = get_user_model()
        data = {
            "title": title,
            "event_type": event_type,
            "description": description,
            "priority": priority,
            "start": parse_datetime(start),
            "company": Company.objects.get(id=company_id),
        }
        if end:
            data["end"] = parse_datetime(end)
        assignee = _apply_assignee(data, assigned_to_id, company_id)
        if task_id:
            data["task_id"] = task_id
        if opportunity_id:
            data["opportunity_id"] = opportunity_id
        if reminder:
            data["reminder"] = reminder
        event = CalendarEvent.objects.create(**data)
        return (
            f"📅 Événement créé : {title} | {event_type} | {start}"
            + (f"\n  Assigné à: {_user_display(assignee)}" if assignee else "")
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur création événement : {str(e)}"


# ═══════════════════════════════════════════════════════════════
# NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════

@mcp.tool()
async def get_notifications(user_id: int, unread_only: bool = True, limit: int = 10) -> str:
    """Lister les notifications d'un utilisateur."""
    @sync_to_async
    def _run():
        from Notifications.models import Notification
        qs = Notification.objects.filter(recipient_id=user_id)
        if unread_only:
            qs = qs.filter(is_read=False)
        qs = qs[:limit]
        if not qs.exists():
            return "🔔 Aucune notification."
        lines = [f"🔔 {qs.count()} notification(s) :"]
        for n in qs:
            read_status = "✅" if n.is_read else "🆕"
            lines.append(
                f"  {read_status} [{n.id}] {n.title} | {n.notif_type} | "
                f"{n.created_at.strftime('%d/%m/%Y %H:%M')}"
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur notifications : {str(e)}"


@mcp.tool()
async def mark_notifications_read(user_id: int) -> str:
    """Marquer toutes les notifications d'un utilisateur comme lues."""
    @sync_to_async
    def _run():
        from Notifications.models import Notification
        count = Notification.objects.filter(recipient_id=user_id, is_read=False).update(is_read=True)
        return f"✅ {count} notification(s) marquée(s) comme lues."
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur : {str(e)}"


@mcp.tool()
async def get_history_logs(company_id: int = 1, entity_type: str = "", limit: int = 10) -> str:
    """
    Lister l'historique des actions CRM.
    entity_type: prospect | contact | opportunity | task | activity | user | team
    """
    @sync_to_async
    def _run():
        from Notifications.models import HistoryLog
        qs = HistoryLog.objects.filter(company_id=company_id).select_related("actor")
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        qs = qs[:limit]
        if not qs.exists():
            return "📜 Aucun historique trouvé."
        lines = [f"📜 {qs.count()} action(s) :"]
        for h in qs:
            actor = h.actor.username if h.actor else "Système"
            lines.append(
                f"  [{h.id}] {h.get_action_display()} | {h.entity_type} '{h.entity_name}' | "
                f"par {actor} | {h.created_at.strftime('%d/%m/%Y %H:%M')}"
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur historique : {str(e)}"


# ═══════════════════════════════════════════════════════════════
# PERFORMANCE & KPIs
# ═══════════════════════════════════════════════════════════════

@mcp.tool()
async def get_performance_scores(company_id: int = 1, year: int = None, month: int = None) -> str:
    """Lister les scores de performance des commerciaux."""
    @sync_to_async
    def _run():
        from sales.models import PerformanceScore
        from django.utils import timezone
        now = timezone.now()
        qs = PerformanceScore.objects.filter(company_id=company_id).select_related("commercial")
        if year:
            qs = qs.filter(year=year)
        if month:
            qs = qs.filter(month=month)
        if not year and not month:
            qs = qs.filter(year=now.year, month=now.month)
        qs = qs.order_by("-score")[:10]
        if not qs.exists():
            return "📊 Aucun score de performance trouvé."
        lines = [f"📊 Scores de performance :"]
        for s in qs:
            lines.append(
                f"  {s.commercial.username} | Score: {s.score:.1f}% | "
                f"Tâches: {s.tasks_done}/{s.tasks_total} | "
                f"Opps gagnées: {s.opportunities_won} | "
                f"{s.month:02d}/{s.year}"
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur scores : {str(e)}"


@mcp.tool()
async def get_performance_goals(company_id: int = 1, commercial_id: int = None) -> str:
    """Lister les objectifs de performance des commerciaux."""
    @sync_to_async
    def _run():
        from sales.models import PerformanceGoal
        qs = PerformanceGoal.objects.filter(company_id=company_id).select_related("commercial", "created_by")
        if commercial_id:
            qs = qs.filter(commercial_id=commercial_id)
        qs = qs.filter(status="active")[:10]
        if not qs.exists():
            return "🎯 Aucun objectif actif trouvé."
        lines = ["🎯 Objectifs de performance :"]
        for g in qs:
            lines.append(
                f"  {g.commercial.username} | {g.get_goal_type_display()} | "
                f"{g.current_value}/{g.target_value} ({g.progress_pct}%) | "
                f"{g.month:02d}/{g.year}"
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur objectifs : {str(e)}"


@mcp.tool()
async def add_performance_goal(
    commercial_id: int, goal_type: str, target_value: int,
    year: int, month: int, created_by_id: int, company_id: int = 1,
) -> str:
    """
    Créer un objectif de performance pour un commercial.
    goal_type: prospects_contacted | opportunities_won | calls | emails | meetings | tasks_done
    """
    @sync_to_async
    def _run():
        from sales.models import PerformanceGoal
        from django.contrib.auth import get_user_model
        from users.models import Company
        User = get_user_model()
        goal = PerformanceGoal.objects.create(
            commercial=User.objects.get(id=commercial_id),
            created_by=User.objects.get(id=created_by_id),
            company=Company.objects.get(id=company_id),
            goal_type=goal_type,
            target_value=target_value,
            year=year,
            month=month,
        )
        commercial_name = goal.commercial.username
        return f"🎯 Objectif créé pour {commercial_name} : {goal.get_goal_type_display()} → {target_value} ({month:02d}/{year})"
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur création objectif : {str(e)}"


@mcp.tool()
async def get_commercial_badges(company_id: int = 1, commercial_id: int = None) -> str:
    """Lister les badges des commerciaux."""
    @sync_to_async
    def _run():
        from sales.models import CommercialBadge
        qs = CommercialBadge.objects.filter(company_id=company_id).select_related("commercial")
        if commercial_id:
            qs = qs.filter(commercial_id=commercial_id)
        qs = qs[:15]
        if not qs.exists():
            return "🏅 Aucun badge trouvé."
        lines = ["🏅 Badges :"]
        for b in qs:
            lines.append(
                f"  {b.commercial.username} | {b.get_badge_type_display()} | "
                f"{b.month:02d}/{b.year}"
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur badges : {str(e)}"


@mcp.tool()
async def get_manager_feedbacks(company_id: int = 1, commercial_id: int = None) -> str:
    """Lister les feedbacks manager pour les commerciaux."""
    @sync_to_async
    def _run():
        from sales.models import ManagerFeedback
        qs = ManagerFeedback.objects.filter(company_id=company_id).select_related("given_by", "commercial")
        if commercial_id:
            qs = qs.filter(commercial_id=commercial_id)
        qs = qs[:10]
        if not qs.exists():
            return "💬 Aucun feedback trouvé."
        lines = ["💬 Feedbacks manager :"]
        for f in qs:
            lines.append(
                f"  {f.given_by.username} → {f.commercial.username} | "
                f"Note: {'⭐' * f.rating} | "
                f"{f.created_at.strftime('%d/%m/%Y')}"
                + (f" | {f.comment[:60]}" if f.comment else "")
            )
        return "\n".join(lines)
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur feedbacks : {str(e)}"


@mcp.tool()
async def add_manager_feedback(
    given_by_id: int, commercial_id: int, rating: int,
    comment: str = "", year: int = None, month: int = None,
    company_id: int = 1,
) -> str:
    """
    Donner un feedback à un commercial.
    rating: 1 à 5
    """
    @sync_to_async
    def _run():
        from sales.models import ManagerFeedback
        from django.contrib.auth import get_user_model
        from users.models import Company
        from django.utils import timezone
        User = get_user_model()
        now = timezone.now()
        feedback = ManagerFeedback.objects.create(
            given_by=User.objects.get(id=given_by_id),
            commercial=User.objects.get(id=commercial_id),
            company=Company.objects.get(id=company_id),
            rating=rating,
            comment=comment,
            year=year or now.year,
            month=month or now.month,
        )
        commercial_name = feedback.commercial.username
        return f"✅ Feedback {'⭐' * rating} donné à {commercial_name}"
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur feedback : {str(e)}"


# ═══════════════════════════════════════════════════════════════
# STATISTIQUES GLOBALES
# ═══════════════════════════════════════════════════════════════

@mcp.tool()
async def get_crm_stats(company_id: int = 1) -> str:
    """Statistiques générales du CRM : prospects, opportunités, tâches, contacts, CA."""
    @sync_to_async
    def _run():
        from sales.models import Prospect, Opportunity, Task, Contact, Account
        total_prospects = Prospect.objects.filter(company_id=company_id).count()
        hot_prospects   = Prospect.objects.filter(company_id=company_id, evaluation="hot").count()
        new_prospects   = Prospect.objects.filter(company_id=company_id, status="new").count()
        total_opps      = Opportunity.objects.filter(company_id=company_id).count()
        won_opps        = Opportunity.objects.filter(company_id=company_id, stage="won").count()
        total_revenue   = Opportunity.objects.filter(
            company_id=company_id, stage="won"
        ).aggregate(total=Sum("amount"))["total"] or 0
        tasks_todo      = Task.objects.filter(company_id=company_id, status="todo").count()
        tasks_in_progress = Task.objects.filter(company_id=company_id, status="in_progress").count()
        tasks_overdue   = sum(
            1 for t in Task.objects.filter(company_id=company_id, status__in=["todo", "in_progress"])
            if t.is_overdue
        )
        return (
            f"📊 Statistiques CRM\n"
            f"\n👤 Prospects\n"
            f"  Total     : {total_prospects}\n"
            f"  Nouveaux  : {new_prospects}\n"
            f"  Chauds 🔥 : {hot_prospects}\n"
            f"\n💼 Opportunités\n"
            f"  Total     : {total_opps}\n"
            f"  Gagnées ✅ : {won_opps}\n"
            f"  CA gagné  : {total_revenue:,.0f}€\n"
            f"\n📋 Tâches\n"
            f"  À faire      : {tasks_todo}\n"
            f"  En cours     : {tasks_in_progress}\n"
            f"  En retard ⚠️ : {tasks_overdue}\n"
            f"\n📇 Contacts : {Contact.objects.filter(company_id=company_id).count()}\n"
            f"🏢 Comptes  : {Account.objects.filter(company_id=company_id).count()}"
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur stats : {str(e)}"


@mcp.tool()
async def get_commercial_stats(user_id: int, company_id: int = 1) -> str:
    """Statistiques détaillées d'un commercial spécifique."""
    @sync_to_async
    def _run():
        from sales.models import Prospect, Opportunity, Task
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.get(id=user_id)
        prospects  = Prospect.objects.filter(company_id=company_id, assigned_to=user).count()
        opps_total = Opportunity.objects.filter(company_id=company_id, assigned_to=user).count()
        opps_won   = Opportunity.objects.filter(company_id=company_id, assigned_to=user, stage="won").count()
        revenue    = Opportunity.objects.filter(
            company_id=company_id, assigned_to=user, stage="won"
        ).aggregate(total=Sum("amount"))["total"] or 0
        tasks_todo = Task.objects.filter(company_id=company_id, assigned_to=user, status="todo").count()
        tasks_done = Task.objects.filter(company_id=company_id, assigned_to=user, status="done").count()
        tasks_late = sum(
            1 for t in Task.objects.filter(
                company_id=company_id, assigned_to=user, status__in=["todo", "in_progress"]
            ) if t.is_overdue
        )
        return (
            f"📊 Stats de {user.username}\n"
            f"  Prospects assignés   : {prospects}\n"
            f"  Opportunités         : {opps_total} (gagnées: {opps_won})\n"
            f"  CA généré            : {revenue:,.0f}€\n"
            f"  Tâches à faire       : {tasks_todo}\n"
            f"  Tâches terminées     : {tasks_done}\n"
            f"  Tâches en retard ⚠️  : {tasks_late}"
        )
    try:
        return await _run()
    except Exception as e:
        return f"❌ Erreur stats commercial : {str(e)}"


# ═══════════════════════════════════════════════════════════════
# LANCEMENT
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    mcp.run()
