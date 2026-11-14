# Space Companion integration layer

The UI talks only to the `CompanionProvider` interface (`provider.ts`), supplied through
`CompanionContext` (`src/lib/companion-context.tsx`). The default and only enabled
implementation is `sample-provider.ts`: static demonstration data in memory, with
check-ins, reflections and listening history persisted to `localStorage`.

**No network calls are made by default.**

## Optional backend (future work)

An existing optional backend endpoint could be wrapped by a future provider:

```
POST /api/companion/support
SupportRequest  { astronaut_id: string, allow_online: boolean }
SupportResponse { summary, relaxation_action, family_message_suggestion, selection_reason, source }
```

A future `HttpCompanionProvider` could implement `getRecommendations` by calling this
endpoint and mapping `family_message_suggestion` to a message id and `selection_reason`
into `Recommendation.reasons`. It must remain opt-in (explicit configuration), fall back to
the sample provider on failure, and must not introduce medical or diagnostic claims.

All thresholds in `recommendations.ts` are illustrative sample rules — not validated, not clinical.
