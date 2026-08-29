# Agent Engagement Email OAuth

Le flux V2 de l'agent d'engagement ne declenche plus d'envoi email direct.
La connexion email reste disponible pour verifier la boite de l'utilisateur et signaler
si le canal email est pret, mais la generation de contenu et l'enregistrement
d'interaction restent separes de l'execution.

Si un futur flux d'envoi explicite est ajoute, il devra utiliser uniquement la boite
connectee de l'utilisateur authentifie et ne jamais utiliser `DEFAULT_FROM_EMAIL`
pour la prospection ou les messages commerciaux.

Required environment variables:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/api/engagement/connections/gmail/callback/

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:8000/api/engagement/connections/microsoft/callback/
```

Google OAuth scopes:

```text
openid email profile
```

Microsoft OAuth scopes:

```text
offline_access User.Read
```

The token fields are centralized behind `UserEmailConnection.get_*_token` and `set_*_token`
so encryption can be added later without changing the provider API.
