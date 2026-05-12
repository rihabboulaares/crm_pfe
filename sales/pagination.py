# sales/pagination.py

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    """
    Pagination standard pour toutes les listes CRM.
    Usage : GET /api/sales/prospects/?page=1&page_size=20
    """
    page_size             = 10           # défaut
    page_size_query_param = "page_size"  # ?page_size=50
    max_page_size         = 100          # maximum autorisé
    page_query_param      = "page"       # ?page=2

    def get_paginated_response(self, data):
        return Response({
            "total":    self.page.paginator.count,       # total enregistrements
            "pages":    self.page.paginator.num_pages,   # nombre de pages
            "page":     self.page.number,                # page actuelle
            "page_size":self.get_page_size(self.request),
            "next":     self.get_next_link(),
            "previous": self.get_previous_link(),
            "results":  data,                            # données de la page
        })

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "properties": {
                "total":     {"type": "integer"},
                "pages":     {"type": "integer"},
                "page":      {"type": "integer"},
                "page_size": {"type": "integer"},
                "next":      {"type": "string", "nullable": True},
                "previous":  {"type": "string", "nullable": True},
                "results":   schema,
            },
        }


# ── Dans settings.py ajouter ─────────────────────────────────────
# REST_FRAMEWORK = {
#     "DEFAULT_PAGINATION_CLASS": "sales.pagination.StandardPagination",
#     "PAGE_SIZE": 10,
# }