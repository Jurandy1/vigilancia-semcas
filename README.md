# SEMCAS — Plataforma de Avaliações, Consultas e Votações

Sistema web institucional para avaliações, pesquisas, consultas e votações em eventos presenciais da SEMCAS.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Firebase (Firestore, Auth, App Check)
- Vercel (hospedagem)

## Firebase — vigilancia-c2917

O projeto Web já está configurado em `.env.local`.

### Para ativar o Firebase real (sair do modo simulado)

1. **Service Account (Admin SDK)**  
   Firebase Console → Configurações do projeto → Contas de serviço → **Gerar nova chave privada**

2. Preencha no `.env.local`:
   ```
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@vigilancia-c2917.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

3. Desative o mock:
   ```
   USE_DEV_MOCK=false
   NEXT_PUBLIC_USE_DEV_MOCK=false
   ```

4. Deploy das regras:
   ```bash
   firebase deploy --only firestore:rules
   ```

5. Crie o evento de teste:
   ```bash
   npm run seed
   ```

6. Defina um admin:
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
| `npm run load-test` | Simula 100 participantes (somente isTest) |
| `npm run set-admin` | Define custom claim admin |

## Rotas principais

| Rota | Descrição |
|------|-----------|
| `/e/[slug]` | Entrada do participante (QR fixo) |
| `/admin` | Painel administrativo |
| `/projector/[slug]` | Tela do projetor |
| `/print/[slug]` | Cartaz A4 |

## Segurança

- Participantes: sessão própria via cookie HttpOnly (sem Firebase Auth)
- Admin: Firebase Auth + custom claim `admin: true`
- Gravações: somente via API server-side (Firebase Admin SDK)
- Firestore Rules: deny-by-default
