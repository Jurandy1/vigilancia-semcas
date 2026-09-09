# Patches Supabase — ordem obrigatória

Não aplique só `schema.sql` em ambientes que já têm patches. Para ambiente
novo: `schema.sql` e depois os patches na ordem abaixo. O último patch de join
(`patch-2026-09-05-join-canonical.sql`) **deve** ser o último que redefine
`join_event_participant`, senão a idempotência (`client_token`) some.

## Ordem

1. `schema.sql` (baseline)
2. Demais patches históricos conforme já aplicados em produção
3. `patch-2026-09-04-rate-limit.sql` — exige `check_rate_limit`
4. `patch-2026-09-04-reduce-lock-contention.sql` — cuidado: redefine join **sem** client_token
5. **`patch-2026-09-05-join-canonical.sql`** — join idempotente + status `open` + sem FOR UPDATE longo
6. **`patch-2026-09-06-close-atomic-rpc-lockdown.sql`** — `close_round_atomic` + REVOKE EXECUTE das RPCs sensíveis
7. **`patch-2026-09-08-integrity-hardening.sql`** — lock compartilhado submit/close, privacidade do join, criação de rodada e sequência atômicas, espelho por trigger

O `schema.sql` é consolidado e já inclui os patches obrigatórios acima para
instalações novas. Depois de alterar um patch consolidado, execute
`node scripts/consolidate-schema.mjs`.

## Checagens (CI)

O workflow `.github/workflows/ci.yml` verifica se o repositório ainda contém:

- `client_token` / `p_client_token` no patch canônico de join
- `check_rate_limit` no patch de rate limit
- `close_round_atomic` no patch de close atômico
- `FOR KEY SHARE`, `create_round_content` e `save_event_sequence_atomic` no patch de integridade
- os mesmos contratos no `schema.sql` consolidado
