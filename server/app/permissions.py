"""Central definition of every permission key in the admin panel.

The frontend fetches this via GET /api/admin/permissions to render the role-form
matrix, and the backend uses PERMISSION_KEYS to validate incoming role payloads.
Adding a new module = add its actions here and grant them to the Super Admin in
seed.py. No database migration required — permission_key is a plain text column.
"""

ACTIONS = ("view", "create", "update", "delete")

PERMISSIONS: dict[str, list[str]] = {
    "products": list(ACTIONS),
    "categories": list(ACTIONS),
    "users": list(ACTIONS),
    "roles": list(ACTIONS),
}


def all_permission_keys() -> list[str]:
    """Every valid permission key, e.g. ['products.view', 'products.create', ...]."""
    return [f"{module}.{action}" for module, actions in PERMISSIONS.items() for action in actions]


PERMISSION_KEYS = frozenset(all_permission_keys())
