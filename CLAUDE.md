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
  A interface usa navegação lateral em acordeão/colapsável (v169), com módulos separados e a paleta original do painel.
- `sw.js` — service worker. Navegação e arquivos do site são buscados da rede
  primeiro, então o painel nunca fica preso em cache.
- `l/` — as **páginas-ponte**, geradas por `tools/gerar-pontes.js`. Uma por
  empreendimento (`l/renaissance/`) e uma por unidade (`l/renaissance/u/501/`).
  Existem porque o robô do WhatsApp não roda JavaScript: sem elas a prévia de
  qualquer link seria sempre a mesma foto genérica. Cada ponte redireciona na
  hora para o portfólio, levando junto o que veio no endereço.

## data.js

Cada empreendimento usa uma destas formas de estoque, lidas pelo `app.js`:
`grupos` (unidades por tipologia), `terrenos` ou `outros`.

**Os materiais comerciais também ficam no `data.js`.** Cada empreendimento real deve ter `folder` (PDF) e `video` (YouTube, Vimeo ou arquivo MP4/WebM/Ogg). Capa (`hero`), logo (`logo`), galeria (`galeria`) e vínculos de planta (`planta`) também são administráveis pelo painel. O site lê esses campos; `boxes` continua sendo exclusivamente interno do painel.

Status válidos: `disponivel`, `vendido`, `alugado`. **Não existe "reservado"** —
a construtora não reserva unidades. `alugado` **continua na oferta**: é o
produto pronto para o investidor, que compra com o inquilino dentro. Só o
`vendido` sai da vitrine.

**Ao acrescentar ou remover unidade no `data.js`, rode
`node tools/gerar-pontes.js` e faça commit do que ele gerar.** Sem isso a
unidade nova fica sem ponte e o link enviado ao cliente cai em página
inexistente. Só mudar status não precisa: a ponte é gerada para toda unidade do
cadastro, inclusive a vendida, justamente para o painel poder desfazer uma
venda sem quebrar link.

O estoque cadastrado é o prédio inteiro, não só o que está à venda: unidade
vendida fica no `data.js` com `status: "vendido"`, **sem `preco`** (o valor de
tabela não vale mais) e **sem número de dormitórios** (o comprador costuma
modificar a planta). O site esconde as vendidas e omite o grupo que ficar sem
nenhuma disponível; se a venda for desfeita, o preço aparece como "Sob consulta"
até alguém informar o novo valor.


## Materiais obrigatórios por empreendimento

O padrão comercial é o mesmo para todos os empreendimentos reais (o agrupador `outros` não entra nessa regra):

- `folder` — exatamente um folder em PDF por empreendimento;
- `video` — exatamente um vídeo oficial por empreendimento.

O painel possui uma **Central de Materiais** que administra também capa, logo, fotos de galeria e plantas. Os uploads novos vão para pastas organizadas por empreendimento (`assets/<id>/...`), sem migrar ou quebrar os caminhos antigos.

Padrões informados e validados no painel:
- capa: WEBP/JPG/PNG, 1600×900 px, até 5 MB;
- galeria: WEBP/JPG/PNG, 1600×900 px, até 5 MB por foto;
- planta: WEBP/JPG/PNG, 2000×2000 px, até 6 MB;
- logo: PNG/WEBP, 1600×600 px, até 3 MB;
- folder: PDF, até 25 MB;
- vídeo: MP4/WebM/Ogg, recomendado 1920×1080, até 80 MB, ou YouTube/Vimeo.

A galeria permite adicionar várias fotos, editar legenda, reordenar e remover referências. A planta é anexada diretamente na tipologia/unidade; ao publicar, o painel atualiza a galeria e o campo `planta` correspondente no `data.js`.

O botão “Baixar folder” e a seção de vídeo só aparecem no site quando o respectivo campo está preenchido.

## Fotos

As fotos ficam em **webp** (`assets/`), que é bem mais leve no 4G do corretor na
rua. Duas exceções, de propósito:

- `assets/preview/*.jpg` continua **JPEG** — é a imagem que o robô de prévia do
  WhatsApp e do Facebook lê, e ele não trata webp de forma confiável.
- Toda foto que **sai** do site para o cliente (compartilhar, "Baixar") é
  reconvertida em JPEG na hora, pelo `comoJpeg()`. O WhatsApp trata webp como
  **figurinha**: a foto do empreendimento chegaria como sticker.

## As duas visões do portfólio

O cliente pergunta em apartamento; a vitrine responde em prédio. Por isso o
corretor tem um alternador **Prédios / Unidades** na barra de resultados:

- **Prédios** — a vitrine de sempre. Com filtro de unidade ligado, o cartão diz
  quantas unidades combinam e o "a partir de" passa a ser o menor preço
  **entre elas**, não do prédio inteiro.
- **Unidades** — os apartamentos de vários empreendimentos numa lista só.

Os filtros de dormitórios, faixa de valor e busca são conferidos **na mesma
unidade**: antes bastava existir alguma de 2 dormitórios e alguma na faixa de
preço, ainda que fossem unidades diferentes.

No link do cliente a visão é sempre a de empreendimentos, do jeito que ele
recebeu.

## O quadro de unidades é uma gaveta

Cada tipologia (e, no loteamento, cada quadra) é um `<details>` que abre ao
toque. O Renaissance tem sete tipologias e 49 apartamentos: numa lista só, achar
o que o cliente pediu era rolar sem fim. Fechadas, as tipologias cabem numa
tela — 51% menos rolagem no Renaissance, 74% no loteamento.

O cabeçalho mostra a tipologia, as áreas e **a partir de quanto** — nunca
quantas unidades há, que a v107 tirou do site de propósito.

Já abre aberta quando há **uma tipologia só** (não há o que escolher) ou no
**link do cliente** (ele recebeu unidades escolhidas, não um catálogo). Link de
unidade (`?u=`) e unidade aberta pela lista abrem a gaveta certa antes de rolar
até ela — sem isso a linha não tem posição na tela. O PDF sai sempre completo:
a folha é montada à parte, fora do quadro.

## O corretor dentro do link

Os dados de "Meu contato" ficam no aparelho do corretor; a página que o cliente
abre é a mesma, rodando no aparelho **dele**, que não sabe quem enviou. Então
nome, WhatsApp e CRECI viajam no próprio endereço (`c=`, `w=`, `cr=`) e viram o
botão verde **"Falar com…"** fixo na página do cliente. Sem `w=` no link, o
botão não aparece.

## Movimento do portfólio

O site **anota sozinho e não mostra nada**: cada empreendimento aberto, imóvel
enviado ao cliente e PDF gerado soma na chave `senger-uso` do aparelho
(`registrar()`, no `app.js`). Quem **mostra** é o painel administrativo, e só
ele — o portfólio é página aberta, e movimento de venda não se expõe. Painel e
site vivem no mesmo endereço, então o painel lê a mesma chave.

A conta é sempre **daquele aparelho**: não há servidor no meio, e o que os
corretores fazem fica no celular de cada um.

## Metragens no site

Sempre **truncadas**, nunca arredondadas para cima: 99,6188 m² vira "99 m²", e
73,665 m² vira "73 m²". O site nunca anuncia área maior que a real.

## Painel administrativo

- A senha é comparada por hash SHA-256; o token do GitHub fica no `localStorage`
  do aparelho.
- As alterações ficam pendentes (`estado.ops`) e só vão para o `data.js` quando
  o dono clica em "Publicar no site". Arquivos novos são enviados ao GitHub primeiro e o `data.js` só passa a apontar para eles depois do upload.
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
  o painel confere se a garagem fecha. **A conta é em box, não em vagas**: um
  box duplo tem as duas vagas uma atrás da outra e vai inteiro para um
  apartamento só — nunca se reparte entre dois. Somar vagas soltas dá um número
  que parece fechar sem fechar.
- A aba dos box mostra, quando há, o que **falta preencher no cadastro**: box
  vendido sem a unidade que o levou, unidade vendida sem box vinculado, box sem
  área. É por aí que se vê o que ainda precisa de planta ou tabela.
- A troca vale **dos dois lados**, decisão do dono: faltando box duplo, dois
  simples fazem o lugar dele; faltando box simples, um duplo faz o lugar dele
  (passa uma vaga, mas o apartamento sai com garagem). **Só falta garagem quando
  acaba o box** — box duplo sobrando nunca é falta.

## Testar o painel

Não há suíte de testes. Para exercitar o painel sem token de verdade, carregue
`admin/index.html` no Chromium (Playwright) interceptando `https://api.github.com/**`
e devolvendo os arquivos locais em base64, com
`sessionStorage["senger-admin-ok"]="1"` e um token qualquer no `localStorage`.

Vale sempre conferir duas coisas: que a rotina de publicação altera o item certo
sem tocar nos vizinhos, e que o site público continua sem mostrar o que é só do
painel.
