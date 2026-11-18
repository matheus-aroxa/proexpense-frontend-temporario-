# ProExpense — Frontend

Interface web (React 19 + Vite + Tailwind 4) para o backend ProExpense (branch `feature/expenses_installments`).

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173
```

Por padrão o frontend consome o backend publicado em `https://proexpense-backend.onrender.com`.

- **Desenvolvimento**: as chamadas a `/api` passam pelo proxy do Vite (o backend não habilita CORS). Para usar o
  backend local, crie um `.env.local` com `VITE_BACKEND_URL=http://localhost:8090`.
- **Build de produção**: o navegador chama o backend diretamente, em `VITE_API_BASE_URL` (padrão: o Render). Isso
  exige CORS liberado no backend para a origem do frontend. Alternativa: definir `VITE_API_BASE_URL=` (vazio) e
  servir o frontend atrás de um proxy reverso que encaminhe `/api` ao backend.
- O plano gratuito do Render hiberna o serviço; a primeira requisição após inatividade pode levar até ~1 minuto.

## Funcionalidades

- **Usuário e conta**: o backend ainda não tem autenticação, então a entrada é a escolha (ou criação) de um usuário e
  de uma conta. A seleção fica salva no navegador.
- **Despesas**: visão mensal com filtros por cartão, categoria e busca; criação, edição e exclusão.
- **Compras parceladas**: no crédito, divide o valor total em 2 a 120 parcelas com vencimento mensal, em dia fixo do mês
  ou em intervalo personalizado (dias/meses/anos). A prévia replica o `InstallmentScheduler` e o rateio do backend
  (centavos restantes vão para a 1ª parcela).
- **Parcelamentos**: agrupa as parcelas de cada compra (o backend não expõe um id de grupo; o agrupamento usa conta,
  dono, nome e número de parcelas), mostra progresso, saldo a vencer e permite excluir a compra inteira.
- **Cartões**, **Categorias** e **Membros** da conta.

## Estrutura

```
src/
  api/         cliente HTTP (ProblemDetail → ApiError), tipos e endpoints
  lib/         datas, formatação, lógica de parcelas
  session/     usuário/conta selecionados e dados carregados da conta
  components/  UI base, ícones e toasts
  pages/       seleção de usuário/conta e layout da conta
  features/    despesas, parcelamentos, cartões, categorias, membros
```
