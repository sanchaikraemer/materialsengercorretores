# Portfólio Senger Corretores

Site de portfólio dos empreendimentos da Construtora Senger (Carazinho/RS), com
um painel administrativo que o dono usa pelo celular.

## Como o dono trabalha

- **Publique sempre ao terminar, sem perguntar.** Ao final de uma tarefa: commit
  na branch de trabalho, abre o pull request e faz o merge na `main`. Não pare
  para pedir autorização de publicação.
- **Toda alteração sobe a versão.** Antes de publicar, incremente o número em
  `index.html` (todos os `?v=`) e em `sw.js` (o `CACHE` e os `?v=` do `CORE`),
  com a data do dia no nome do cache:
  `const CACHE = "senger-portfolio-v117-20260813"`. Vale para qualquer mudança,
  inclusive as que só afetam o painel — o número é o registro do que está no ar,
  e é por ele que o dono confere se recebeu a atualização.
- Ele acompanha pelo resultado na tela, não pelo código. Explique o que mudou em
  linguagem de leigo, sem jargão de programação.

## Estrutura

- `index.html` + `app.js` + `styles.css` — o site público.
- `data.js` — a fonte de todos os dados: `META` (INCC, mês da tabela) e
  `EMPREENDIMENTOS`.
- `admin/index.html` — o painel administrativo, uma página só, sem build. Lê e
  grava o `data.js` direto pela API do GitHub, na branch `main`.
- `sw.js` — service worker. Navegação e arquivos do site são buscados da rede
  primeiro, então o painel nunca fica preso em cache.

## data.js

Cada empreendimento usa uma destas formas de estoque, lidas pelo `app.js`:
`grupos` (unidades por tipologia), `terrenos` ou `outros`.

**Qualquer outro campo é invisível para o site.** É assim que os `boxes` do
Evolutti existem só no painel: o `app.js` não lê esse campo.

Status válidos: `disponivel`, `vendido`, `alugado`. **Não existe "reservado"** —
a construtora não reserva unidades.

O estoque cadastrado é o prédio inteiro, não só o que está à venda: unidade
vendida fica no `data.js` com `status: "vendido"`, **sem `preco`** (o valor de
tabela não vale mais) e **sem número de dormitórios** (o comprador costuma
modificar a planta). O site esconde as vendidas e omite o grupo que ficar sem
nenhuma disponível; se a venda for desfeita, o preço aparece como "Sob consulta"
até alguém informar o novo valor.

## Metragens no site

Sempre **truncadas**, nunca arredondadas para cima: 99,6188 m² vira "99 m²", e
73,665 m² vira "73 m²". O site nunca anuncia área maior que a real.

## Painel administrativo

- A senha é comparada por hash SHA-256; o token do GitHub fica no `localStorage`
  do aparelho.
- As alterações ficam pendentes (`estado.ops`) e só vão para o `data.js` quando
  o dono clica em "Publicar no site".
- A gravação é **edição textual** do `data.js`, não regravação do objeto, para
  preservar comentários e formatação. Ver `aplicarStatus`.
- Ao publicar pelo painel, a versão do cache (`?v=` no `index.html` e o `CACHE`
  do `sw.js`) sobe sozinha — ele lê o número atual e soma 1. Alteração feita
  direto no repositório precisa subir o número à mão, antes do merge.
- Cada empreendimento tem abas Disponíveis / Vendidos / Alugados / Todos, que
  filtram unidades e box juntos.
- O cartão mostra o estoque por tipologia. O rótulo vem de `estoque` (na
  unidade ou no grupo) e cai para `grupo.tipo` quando não há — é assim que as
  Casas Suspensas do Renaissance contam junto com o andar delas.
- `vagasPorTipologia` liga cada rótulo de estoque aos box que a unidade leva, e
  o painel confere se as vagas fecham. A troca vale **dos dois lados**, decisão
  do dono: faltando box duplo, dois simples fazem o lugar dele; faltando box
  simples, um duplo faz o lugar dele (passa uma vaga, mas é um box de verdade e
  o apartamento sai com garagem). **Só falta garagem quando acaba o box** — box
  duplo sobrando nunca é falta.

## Testar o painel

Não há suíte de testes. Para exercitar o painel sem token de verdade, carregue
`admin/index.html` no Chromium (Playwright) interceptando `https://api.github.com/**`
e devolvendo os arquivos locais em base64, com
`sessionStorage["senger-admin-ok"]="1"` e um token qualquer no `localStorage`.

Vale sempre conferir duas coisas: que a rotina de publicação altera o item certo
sem tocar nos vizinhos, e que o site público continua sem mostrar o que é só do
painel.
