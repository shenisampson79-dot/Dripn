# StyleWise client security

Backend policy, threat model, incident response, and the pre-release checklist live in the **Dripn-Server** repo:

- `SECURITY.md` — vulnerability disclosure
- `docs/security/THREAT_MODEL.md`
- `docs/security/INCIDENT_RESPONSE.md`
- `docs/security/PRE_RELEASE_CHECKLIST.md`

## Client gates (this repo)

| Gate | Command / location | What it enforces |
|------|--------------------|------------------|
| Security smoke | `npm run security:smoke` | JWT in SecureStore, no hardcoded API keys, no secret-looking `EXPO_PUBLIC_*`, plus release regression checks |
| Secret scan | `npm run security:scan-secrets` | Regex scan for `sk_live`, `sk-`, `AIza`, private keys, etc. |
| Release smoke | (included by security smoke) | Subscription nav helper, voice panel, opaque headers, API health |
| CI | `.github/workflows/security.yml` | Runs smoke + secret scan on PRs and `main` |
| Dependabot | `.github/dependabot.yml` | Weekly npm updates |

## Client rules of thumb

1. **Auth tokens** (`dripn_token`, admin, stylist) → `expo-secure-store` via `utils/secureTokenStore.ts` — never plain AsyncStorage.
2. **No server secrets in the app binary** — OpenAI / Stripe / ElevenLabs keys stay on Dripn-Server; AI calls go through the API.
3. **Cross-tab Subscription** → `navigateToSubscription()` (ProfileTab), never `navigate('Subscription')` from StylistTab.
4. Run `npm run security:smoke` before App Store / Play submit.
