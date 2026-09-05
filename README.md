# SEMCAS — Plataforma de Avaliações, Consultas e Votações

Sistema web institucional para avaliações, pesquisas, consultas e votações em eventos presenciais da SEMCAS.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres, Auth, Realtime)
- Vercel (hospedagem)

## Supabase — projeto vigilancia

1. Aplique o schema em `supabase/schema.sql` e, em seguida, os patches na
   ordem documentada em `docs/supabase-patches.md` (o patch
   `patch-2026-09-05-join-canonical.sql` deve ser o último que redefine o join).

2. Preencha no `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
   ```

3. Crie o evento de teste:
   ```bash
   npm run seed
   ```

4. Defina um admin (já existe um usuário no Supabase Auth):
   ```bash
   npm run set-admin -- seu@email.com
   ```

## Desenvolvimento

```bash
npm run dev
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Verificação TypeScript |
| `npm run test` | Testes unitários |
| `npm run seed` | Cria evento de teste |
| `npm run load-test` | Cria um cenário isolado, simula 200 votantes e remove os dados ao terminar |
| `npm run set-admin` | Concede acesso de administrador a um usuário do Supabase Auth |

## Rotas principais

| Rota | Descrição |
|------|-----------|
| `/e/[slug]` | Entrada do participante (QR fixo) |
| `/admin` | Painel administrativo |
| `/projector/[slug]` | Tela do projetor |
| `/print/[slug]` | Cartaz A4 |

## Segurança

- Participantes: sessão própria via cookie HttpOnly (sem Supabase Auth)
- Admin: Supabase Auth + tabela `admins` (equivalente ao custom claim)
- Gravações: somente via API server-side (`service_role`, que ignora RLS)
- RLS: deny-by-default nas tabelas privadas; leitura pública só em `public_events`/`public_round_stats`
