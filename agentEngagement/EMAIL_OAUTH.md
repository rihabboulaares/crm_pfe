# Agent Engagement Email OAuth

The engagement agent sends commercial emails only through the authenticated user's connected mailbox.
It must not use `DEFAULT_FROM_EMAIL` for prospecting or commercial messages.

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
openid email profile https://www.googleapis.com/auth/gmail.send
```

Microsoft OAuth scopes:

```text
offline_access User.Read Mail.Send
```

The token fields are centralized behind `UserEmailConnection.get_*_token` and `set_*_token`
so encryption can be added later without changing the provider API.
