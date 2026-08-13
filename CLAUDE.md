# Portfólio Senger Corretores

Site de portfólio dos empreendimentos da Construtora Senger (Carazinho/RS), com
um painel administrativo que o dono usa pelo celular.

## Como o dono trabalha

- **Publique sempre ao terminar, sem perguntar.** Ao final de uma tarefa: commit
  na branch de trabalho, abre o pull request e faz o merge na `main`. Não pare
  para pedir autorização de publicação.
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
- Ao publicar, a versão do cache (`?v=` no `index.html` e o `CACHE` do `sw.js`)
  sobe sozinha.
- Cada empreendimento tem abas Disponíveis / Vendidos / Alugados / Todos, que
  filtram unidades e box juntos.

## Testar o painel

Não há suíte de testes. Para exercitar o painel sem token de verdade, carregue
`admin/index.html` no Chromium (Playwright) interceptando `https://api.github.com/**`
e devolvendo os arquivos locais em base64, com
`sessionStorage["senger-admin-ok"]="1"` e um token qualquer no `localStorage`.

Vale sempre conferir duas coisas: que a rotina de publicação altera o item certo
sem tocar nos vizinhos, e que o site público continua sem mostrar o que é só do
painel.
