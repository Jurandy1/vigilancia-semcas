repo: Jurandy1/vigilancia-semcas
branch: main

## Last sync

date: 2026-09-03T13:10:00Z

### Updated in this project

- Redesign institucional do painel administrativo (sidebar 244px, topbar, faixas de KPI, gráficos).
- Nova Visão geral com donut de situação da participação e barras por rodada.
- Relatórios reorganizados em resumo + participação por rodada + abas de rodada.
- Telas públicas redesenhadas: login, projetor (3 estados) e fluxo do participante.

## Screen map

| Tela no projeto | Arquivos do repositório |
|---|---|
| Painel SEMCAS.dc.html — shell (sidebar/topbar) | src/components/admin/AdminShell.tsx, src/app/globals.css, tailwind.config.ts |
| Painel SEMCAS.dc.html — Visão geral | src/components/admin/EventDashboardView.tsx, src/components/admin/DonutChart.tsx, src/components/admin/HorizontalBarChart.tsx, src/lib/admin/dashboard-state.ts |
| Painel SEMCAS.dc.html — Eventos | src/app/admin/eventos/page.tsx |
| Painel SEMCAS.dc.html — Ao vivo | src/app/admin/eventos/[eventId]/ao-vivo/page.tsx |
| Painel SEMCAS.dc.html — Participantes | src/app/admin/eventos/[eventId]/participantes/page.tsx, src/components/admin/LiveParticipantList.tsx |
| Painel SEMCAS.dc.html — Perguntas do evento | src/app/admin/eventos/[eventId]/rodadas/page.tsx |
| Painel SEMCAS.dc.html — Resultados e relatórios | src/app/admin/eventos/[eventId]/relatorios/page.tsx, src/app/admin/eventos/[eventId]/rodadas/[roundId]/resultados/page.tsx |
| Painel SEMCAS.dc.html — Configurações | src/app/admin/eventos/[eventId]/configuracoes/page.tsx |
| Telas-Publicas-SEMCAS.dc.html — Login | src/app/admin/login/page.tsx |
| Telas-Publicas-SEMCAS.dc.html — Projetor | src/app/projector/[eventSlug]/page.tsx |
| Telas-Publicas-SEMCAS.dc.html — Participante | src/app/e/[eventSlug]/*, src/components/participant/ParticipantShell.tsx |

Assets copiados: public/images/logo-prefeitura-saoluis.jpg
