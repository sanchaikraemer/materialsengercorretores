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
  A interface usa navegação lateral em acordeão/colapsável (v173), com módulos separados e a paleta original do painel. Preços e margem é um módulo próprio desde a v210. Configurações não é um módulo: a chave do GitHub fica recolhida em Publicação > Acesso técnico.
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


### A fazer na próxima atualização

- **Botão "voltar" em todas as telas do painel** (pedido em 10/09/2026), não só
  em Preços e margem. As telas são longas e não há como subir nem sair de
  nenhuma delas sem rolar tudo.

### A tabela começa vazia (v225)

**Não há mais preço no `data.js`** — os 264 preços foram apagados a pedido do
dono, que está remontando a tabela pelo custo. Enquanto o preço não é publicado,
o site e o PDF mostram **"Sob consulta"**. O preço volta item a item: o dono
informa o **custo** e a **venda desejada** em Preços e margem, e o "Publicar no
site" grava. Como a linha do item pode não ter mais o campo `preco`,
`aplicarPreco` **acrescenta** o campo quando ele não existe (antes do `status:`)
em vez de falhar, e `precosDesejadosPendentes` deixou de exigir um preço atual.

**O INCC corrige custo, não preço (v225).** *"Nessa tela tem que aparecer o
custo e não venda — INCC corrige custo; venda e margem é outra coisa."* A
pré-visualização lista **Custo atual → Custo novo** dos custos guardados, o
"Aplicar correção" sobe todos na hora, e o "Publicar no site" grava só o mês, a
data, o índice e o histórico no `data.js`. O seletor de arredondamento ficou
escondido: ele existia para preço.

### Custos e margem (somente painel)

**Preços e margem é uma tela própria (v210)**, no menu, ao lado da Correção pelo
INCC. Antes era um apêndice da tela de INCC, com uma tabela de nove colunas que
só cabia rolando para o lado; o dono disse, com razão, que ela estava confusa.
Agora cada item é uma linha com **quatro números — custo, preço no site, venda
desejada e margem** — e nada mais. **Nunca grave custo no `data.js` ou em outro
arquivo público do repositório.** O painel permite importar/exportar um JSON de
backup.

**Não existe mais coluna "Preço no site" (v217).** *"Quero que 'preço no site'
não exista mais, somente venda desejada — que é o que vai pro site."* A
**Venda desejada é o preço**. O preço publicado continua guardado na linha
(`data-preco`) — é com ele que a marca "vai para o site", o "desfazer" e a fila
de publicação comparam.

**A linha fica em branco até o dono precificar (v221).** A v217 preenchia a
venda desejada com o preço que estava no ar quando não havia margem guardada; o
dono pediu o contrário — *"apague a venda desejada também, deixe tudo zerado"*.
Agora **custo, venda desejada, `Margem %` e `Margem` só aparecem quando ele
informa**: sem venda desejada, `margemDaLinha` devolve nulo e a linha inteira
fica vazia. É o que faz o "Apagar tudo" deixar a tela realmente limpa. Efeito
colateral aceito: o preço que está no ar não aparece mais nessa tela — quem
mostra preço publicado é o site e o PDF.

**Uma margem só na tela (v210).** Enquanto a venda desejada está vazia, a margem
mostrada é a do preço que está no site; assim que o dono informa a venda
desejada, ela passa a ser a margem dessa venda, e a letra miúda embaixo diz
sobre qual das duas ela é. Duas colunas de margem lado a lado era o que mais
confundia.

**Os descontos ficam na gaveta (v210), atrás de um botão que diz o nome deles
(v211).** `Custo - 5%` e `Custo - 10%` só servem na hora de uma proposta, então
saíram da linha. Na v210 a gaveta abria num `⌄` sem legenda e **o dono não achou
os descontos** — agora o botão embaixo do nome diz **"▾ margem % e descontos"**.
Dentro dela ficam a margem em %, a margem em reais, os dois descontos e o botão
**"Deixar igual ao preço do site"**, que desfaz a mudança de preço daquele item.
As contas continuam as mesmas (`custo × 0,95` e `custo × 0,90`).

**A margem também se digita em porcentagem (v211).** "Quero 5% em cima do
custo" é como o dono pensa, então a gaveta tem o campo **Margem sobre o custo**
em %: digitar 5 faz a venda desejada virar `custo × 1,05`. Os três campos —
porcentagem, margem em reais e venda desejada — conversam entre si; **o que fica
guardado continua sendo a margem em reais**, então cofre e backup não mudam de
formato.

**Aplicar a porcentagem em vários itens (v211).** Acima da lista há
`[ 5 ] % · Aplicar aos itens da lista`: ele coloca a mesma margem em tudo o que
o filtro e a busca estão mostrando naquele momento — item a item em 245 unidades
ninguém faria. Pede confirmação dizendo quantos itens vão mudar, pula o que não
tem custo lançado (e diz quantos foram), e nada vai para o site antes do
"Publicar no site".

**Um percentual para o prédio inteiro (v212).** Dentro de cada empreendimento,
logo abaixo do nome dele, há `Margem sobre o custo de todo o <nome>: [ 5 ] % ·
Aplicar a todas as unidades`. Diferente da faixa do topo da tela (que respeita o
filtro e a busca), **esta vale para todas as unidades à venda daquele
empreendimento**, filtro ligado ou não. Pula quem não tem custo lançado e diz
quantos ficaram de fora. O campo mostra a porcentagem quando o prédio inteiro
está com a mesma margem, e fica **vazio quando elas estão misturadas** — é assim
que se vê, de relance, se alguma unidade fugiu do padrão.

**As colunas ocupam a largura toda (v212).** Na v210/v211 sobrava um vão entre
o nome do apartamento e o custo: as colunas de número tinham largura fixa e
ficavam encostadas na direita. Agora elas crescem juntas (`fr` com mínimo), e a
lista mede a si mesma (`container-type: inline-size`), não a janela — o menu
lateral entra na conta.

**As oito colunas aparecem sempre — elas se apertam, não somem (v215).** As
v212/v214 escondiam `Custo − 5%` e `Custo − 10%` quando a lista era estreita
(v212 mandava para a gaveta, v214 para uma linha miúda embaixo do nome). O dono
foi claro: *"tem que ficar aparecendo todas as colunas, aperte elas pra caber"*.
Então as oito ficam na linha em qualquer largura de computador, em **três faixas
de aperto** (`@container` sobre a `.precos-lista`): confortável acima de 1060 px,
média acima de 860 e apertada abaixo disso. Só abaixo de **760 px** a linha vira
cartão — e ali cada valor aparece com o nome em cima, então nenhuma coluna some
nem no celular. (A gaveta que ainda restava foi removida na v216.)

**Não existe mais gaveta na linha (v216).** O botão "▾ mais opções" foi
removido: *"não pode aparecer 'mais opções' pra abrir"*. Tudo o que estava
dentro dele saiu para a própria linha:

- a **margem em reais** virou a coluna **Margem**, que agora é campo. Ela mostra
  a margem calculada (verde ou vermelha) e aceita digitação — digitar ali é o
  terceiro jeito de precificar, junto com a `Margem %` e a `Venda desejada`;
- o "Deixar igual ao preço do site" virou um **"desfazer"** miúdo dentro da
  célula da venda desejada, que só aparece na linha marcada "vai para o site".

**Cuidado herdado disso:** a coluna Margem é display e campo ao mesmo tempo,
então quem lê margem desejada tem de usar `margemDesejadaInterna(chave)`, nunca
o que está escrito no campo. O handler do custo lia o campo e, só de digitar o
custo, a margem que estava na tela virava margem desejada e disparava a venda.
Pelo mesmo motivo o `blur` do campo de margem chama `atualizarLinhaFinanceira`
em vez de esvaziar: sem margem desejada guardada, a coluna volta a mostrar a
margem que o preço do site dá hoje.

**O "R$" saiu das células da lista (v215).** É o que fez tudo caber: repetir
"R$" em oito colunas custava ~22 px em cada uma. A tela inteira é dinheiro e o
cabeçalho nomeia cada coluna, então a célula mostra `1.502.665,00`. Vale para os
campos digitáveis também (`dinheiroDaLinha`); `moedaFinanceira` continua com o
"R$" em todo o resto do painel — avisos, confirmações, a gaveta e a tela de INCC.

**Cuidado com a ordem das regras.** As larguras e os corpos de letra de cada
faixa usam o prefixo `.precos-lista` de propósito: sem ele, as declarações
gerais de `.preco-campo` e `.valor-suave`, que vêm depois no arquivo, ganhavam
por ordem e o texto não diminuía — as colunas então estouravam a própria
largura.

**Box vendido vai para uma gaveta recolhida (v223).** Ele não tem o que
precificar e enchia a lista — no Personalité são 60 de 65, no Prime 39 de 40.
Agora fica numa gaveta no fim do empreendimento ("N box vendidos — toque para
ver"), fechada por padrão e que lembra se o dono a deixou aberta. **Só o box
vendido** vai para lá: disponível e alugado continuam na lista, e a unidade
vendida também, em vermelho, como antes.

**Todo box vai para gaveta, não só o vendido (v232).** A v223 recolheu só o box
vendido; o dono pediu o resto também — no Renaissance são 65 box para 43
apartamentos, e a lista de preço é dos apartamentos. Agora cada empreendimento
termina com duas gavetas fechadas, "N box à venda" e "N box vendidos", cada uma
lembrando se foi deixada aberta. A unidade vendida continua na lista, em
vermelho.

**A faixa de "versão antiga" compara painel com painel (v232).** Ela olhava o
`?v=` do `index.html`, que **sobe sozinho a cada publicação do dono** — então
logo depois de publicar a faixa acusava desatualizado e o "Atualizar agora"
recarregava a mesma página: *"to clicando em atualizar e nada acontece"*. Agora
`conferirVersaoDoPainel` lê o `VERSAO_PAINEL` do `admin/index.html` que está no
site e compara com o desta página — a faixa só aparece quando existe mesmo uma
página de painel mais nova.

**O "Todos" conta em apartamento, não em box (v234).** A soma do chip incluía a
garagem e dava 638 — só no Renaissance são 65 box para 43 apartamentos. Agora o
`todos` pula `item.tipo === "box"` (270 no cadastro de setembro). Os outros três
chips continuam contando box de propósito: no Renaissance o box é venda separada
e precisa de custo, e é por "Falta custo" que se vê isso.

**Três filtros e uma busca (v210)**: `Falta custo`, `Vai mudar de preço` e
`Abaixo do custo`, cada um com a contagem ao lado, refeita a cada tecla
digitada. Com filtro ligado os empreendimentos abrem sozinhos. A linha que vai
mudar de preço ganha faixa amarela na lateral e a marca "vai para o site" — é a
mesma conta da fila de publicação, para a tela nunca dizer uma coisa e o botão
"Publicar no site" outra.

**No celular a linha vira cartão (v210)**, com o nome de cada valor em cima
dele. Não há mais rolagem lateral em tela nenhuma.

**Apagar tudo e recomeçar (v220).** Ao lado do "Exportar backup" há
**Apagar tudo**: limpa todos os custos e margens **do aparelho, do rascunho e do
cofre**. Só limpar o aparelho não adiantaria — ao reabrir, a fusão da v190
traria os valores de volta do cofre. Pede confirmação dizendo quantos custos e
quantas margens vão embora e lembrando do Exportar backup; **não mexe em preço
nenhum do site**. Existe porque reimportar por cima só soma, e às vezes o dono
quer começar do zero.

**Onde o custo mora (v176).** Em três lugares, nesta ordem:

1. `senger-admin-financeiro-rascunho` — o que está sendo digitado e ainda não foi salvo. Existe porque fechar a aba sem salvar apagava tudo em silêncio; ao reabrir, o painel recupera o rascunho e continua marcando **Alterações não salvas**.
2. `senger-admin-financeiro-v2` — a cópia salva naquele aparelho (`senger-admin-custos-v1` continua sendo escrita, para os backups v171).
3. **Cofre privado**: o repositório **`sanchaikraemer/senger-financeiro`** (privado), arquivo `financeiro.json`, alcançado com a mesma chave do GitHub do painel. É o que faz o mesmo custo aparecer no celular e em qualquer computador. O painel lê o cofre ao abrir e grava nele ao salvar; se o repositório não existir, ele é criado sozinho como privado. Custo continua **fora** do repositório do site, que é público.

**Uma limpeza vence o cofre (v226).** A fusão da v190 soma os dois lados, então
uma limpeza **nunca ganhava**: o dono apagava tudo, o cofre devolvia na abertura
seguinte, e outra aba aberta com os valores velhos empurrava tudo de volta para
lá. Ele apagou três vezes antes de me dizer isso. Agora o pacote guarda
`apagadoEm`:

- conteúdo do cofre **mais antigo que a última limpeza deste aparelho** é
  ignorado;
- limpeza no cofre **mais nova que o pacote deste aparelho** limpa o aparelho;
- e o aparelho só devolve ao cofre quando é o mais recente (`quandoLocal >=
  quandoRemoto`) — antes uma aba velha ressuscitava tudo.

O "Apagar tudo" confere a conta depois de limpar e avisa em `alert` se ainda
sobrou algo lá, lembrando de fechar as outras abas.

**Por que a limpeza da v226 nunca funcionou (v228).** O `apagadoEm` era gravado
mas **jogado fora na leitura**: `lerPacoteFinanceiro` devolvia só `custos`,
`margensDesejadas` e `salvoEm`. Ao reabrir, o painel achava que nunca se apagara
nada, o cofre vencia e os custos voltavam — e a gravação seguinte ainda apagava a
marca do cofre. O dono apagou dezenas de vezes por causa disso. Agora o
`apagadoEm` é lido junto, e o "Apagar tudo" funciona **mesmo com o aparelho já
vazio** (o que sobrou pode estar só no cofre, que é de onde os valores voltavam).

**Quem não sabe da limpeza limpa a si mesmo antes de falar (v229).** O que
realmente devolvia os custos era **outra aba do painel**, aberta antes do
"Apagar tudo" e com os valores velhos na memória: bastava ela salvar (ou ser
recarregada) para reenviar tudo ao cofre — no dia 10/09 a limpeza foi às
13:37:28 e os 118 custos voltaram às 13:38:20. Agora `acatarLimpezaDaConta`
roda **antes de toda gravação no cofre** e também na abertura: se o cofre traz
um `apagadoEm` mais novo que o desta aba, a aba se limpa (aparelho, rascunho e
tela) e só então grava. A limpeza vence inclusive digitação em andamento — era o
`financeiroSujo` que fazia o painel nem olhar o cofre.

**Era o "Descartar" que devolvia os custos (v230).** A correcão do INCC guarda
um retrato dos custos (`financeiroAntesDaPrevia`) para o "Descartar" poder voltar
atrás. O "Apagar tudo" não apagava esse retrato: bastava clicar em **Descartar**
depois de apagar e os custos voltavam inteiros à tela, ao aparelho e ao cofre no
salvamento seguinte. Foi o que aconteceu em 10/09 — limpeza às 13:37:28, 118
custos de volta às 13:38:20. Agora o "Apagar tudo" esquece o retrato junto.
(Reproduzido no Chromium antes e depois: antes voltavam 18 de 18; depois, zero.)

**Os dois lados se juntam, nunca se apagam (v190).** Ao abrir, o painel funde o cofre com o que está no aparelho: custo lançado aqui e custo lançado lá somam, e quando o mesmo item tem valor dos dois lados vale o do pacote com `salvoEm` mais recente. Se o aparelho tinha algo que faltava no cofre, ele devolve para o cofre na hora. Isso evita o acidente clássico: abrir num computador com poucos custos e apagar os de todos os outros. Digitação em andamento nunca é atropelada pelo cofre. Se a chave não tiver permissão para o repositório privado, nada quebra: os custos ficam no aparelho e a tela explica, apontando o **Exportar/Importar backup**.

A linha de status diz a verdade — `X de Y itens com custo ✓ · salvo em dd/mm/aaaa`, ou "Nenhum custo guardado neste aparelho". O antigo "Dados salvos neste computador ✓" aparecia mesmo com a tabela vazia.

**O vendido continua na tabela (v181).** A tabela financeira mostra o prédio inteiro: os vendidos vão para o fim da lista, em vermelho e com a situação "Vendido". Eles ficam **fora** da conta `X de Y itens com custo` — não há mais o que precificar — e o cabeçalho do empreendimento diz "N itens à venda · M vendidos".

**Os box entram na tabela financeira (v180), só onde são venda separada (v185).** No **Renaissance** o box tem valor próprio e é vendido à parte — lá o `data.js` marca `boxSeparado: true` no empreendimento e guarda `preco` no box (interno; o site não lê `boxes`), e a tabela financeira lista unidades **e** box, com coluna **Situação** e a marca simples/duplo. Em **todos os outros empreendimentos o box já está dentro do preço do apartamento**: ele aparece na tabela (v187) depois das unidades, com a situação Disponível/Vendido e a frase "Já incluso no preço do apartamento" no lugar dos valores — assim o dono acompanha o que está livre sem que a garagem entre duas vezes na conta. Esses box ficam fora de `X de Y itens com custo`, e o cabeçalho do empreendimento os anuncia à parte: "14 itens à venda · 19 vendidos · 36 box no preço".

**A tipologia aparece embaixo do nome (v205).** Na tabela financeira, cada
unidade mostra em letra miúda a tipologia em que ela conta — "Apto 404 · 2
dormitórios (1 suíte)" — antes do box que foi junto. Só pelo número do
apartamento o dono não sabia se estava precificando um 2 ou um 3 dormitórios. O
texto vem de `estoque` (na unidade ou no grupo) e cai para `grupo.tipo`; o box
não recebe tipologia, continua com a marca simples/duplo.

**Quem levou qual box (v188).** Na tabela financeira, embaixo do nome, a unidade lista os box que foram com ela ("Apto 803 · Box 104") e o box mostra a unidade que o levou ("Box 104 · Apto 803"). A ligação vem do campo `apto` do box no `data.js` — vale para vendidos e disponíveis, e sai sozinha quando o campo está vazio. **O Evolutti é o único sem esses vínculos preenchidos.**

**Importar backup** reconhece a linha pelo código interno e, se ele mudou, pelo nome da unidade — sempre **dentro do mesmo empreendimento e do mesmo tipo** (`u`, `b`, `t`, `o`), para o Box 101 nunca virar o Apto 101 nem o 401 de outro prédio. A importação só preenche a tela (fica "Alterações não salvas"); quem grava é o dono, no botão. Embaixo dos botões fica uma linha fixa dizendo quantos custos entraram, quantos não têm correspondência, ou o motivo da falha.

**A venda desejada vira o preço do site (v202).** Custo e margem são internos e
não vão para lugar nenhum. A **venda desejada**, porém, é preço: toda vez que ela
fica diferente do preço que está no ar, isso já entra na fila de publicação
(`tipoOp: "preco"`) e o **"Publicar no site"** acende sozinho — **não há um
segundo botão**. As v200/v201 tinham um "mandar para o site" separado, que o dono
leu, com razão, como dois botões para a mesma coisa.

**Publicar já salva o que foi digitado (v203).** Não há ordem de botão para
acertar: "Publicar no site" grava antes o custo e a margem no aparelho e no
cofre, e só então mexe no site. "Salvar custos e margens" continua existindo
para quem quer guardar só o que é interno, sem mudar preço nenhum.

Acima da tabela financeira uma faixa avisa quantos itens estão diferentes. Ao
clicar em "Publicar no site", o painel lista o que vai mudar (de → para) e só
grava depois do "ok". **Descartar** também vale para o preço, senão ele voltaria
sozinho na linha seguinte; ele reaparece assim que a venda desejada mudar de
valor. Ficam de fora o vendido, o box que já está no preço do apartamento e o
item cuja venda desejada é igual ao preço atual. A gravação é textual
(`aplicarPreco`), pela mesma chave do resto do painel, e mexe só na linha do item.

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

## O PDF do portfólio é a lista (v208)

O botão "Gerar PDF / imprimir" da home monta **uma página por empreendimento com
todas as unidades** — tipologia, área, situação e valor, mais lotes e os imóveis
de `outros`. As tabelas vêm de `tabelasDeUnidades(emp)`, a mesma função que a
folha de um empreendimento usa.

Antes da v197 saía só o "a partir de" de cada prédio; a v197 juntou os cartões
e a lista, e a v208 tirou os cartões: o corretor leva a tabela, não a vitrine.

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

## Tipologias iguais viram um quadro só (v213)

Quando dois grupos do `data.js` têm **o mesmo tipo, a mesma metragem, a mesma
garagem e a mesma observação**, a vitrine mostra **um quadro só**, com o "a
partir de" sendo o menor preço entre todas as unidades dos dois. É o caso do
**Evolutti**, onde a coluna do final 3 e a do final 4 são grupos separados mas o
mesmo produto: o cliente via "2 dormitórios (1 suíte)" duas vezes seguidas, com
preços diferentes, como se fossem apartamentos distintos.

A junção é **só na hora de mostrar** (`blocosDeTipologia`, no `app.js`), e vale
para a vitrine e para o PDF. O `data.js` continua com os grupos separados de
propósito: é por eles que o painel confere a garagem de cada coluna, e cada
unidade guarda a sua própria planta e a sua própria área. No quadro que juntou,
as unidades saem em ordem de número (503, 504, 603, 604…) em vez de uma coluna
inteira depois da outra; os quadros que não juntaram mantêm a ordem do cadastro.

**O sufixo diz de qual final é a tipologia (v213).** O campo `sufixo` do grupo
aparece ao lado do nome, em letra mais leve: "Sala comercial · final 01".
No **Premium Office** havia cinco "Sala comercial" seguidas e só pela metragem
não se sabia de qual coluna do prédio cada uma era; lá o segundo pavimento
também é anunciado ("Salas comerciais · 2º pavimento"). O sufixo entra na
assinatura da junção — duas tipologias com sufixos diferentes nunca se juntam.

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

## Antes de publicar: nunca passe por cima do painel

O dono publica correções de INCC e de preço pelo próprio painel, direto na
`main`. Uma branch de trabalho aberta antes disso carrega um `data.js` velho, e
um merge desatento devolve a tabela antiga ao ar — foi o que aconteceu na v197,
que trouxe agosto de volta depois de setembro já publicado, deixando os preços
abaixo do custo.

Então, **em todo merge e em toda publicação**, antes de mandar para a `main`:

1. `git fetch origin main` e comparar o `data.js` do trabalho com o da `main`:
   `git diff origin/main -- data.js`.
2. Se aparecer diferença em `META` (mês da tabela, INCC, histórico) ou em
   `preco` sem que a tarefa fosse mexer nisso, **a versão certa é a da `main`** —
   é publicação do dono. Traga a dela (`git checkout origin/main -- data.js`) e
   refaça só o que a tarefa pedia.
3. Depois do merge, conferir de novo no que ficou na `main`: mês da tabela,
   valor do INCC, tamanho do `historicoIncc` e um preço conhecido.
4. Resolver conflito com `--ours`/`--theirs` sem olhar é proibido; sempre
   `grep -c "<<<<<<<" ` nos arquivos tocados e ler o `data.js` resultante.

Custo e preço vivem separados: o custo corrigido pelo INCC continua no cofre
mesmo quando o preço volta atrás, e é isso que faz a margem aparecer negativa.
Margem negativa depois de uma publicação é sinal de tabela errada no ar, não de
custo errado.

## O painel diz a própria versão (v227)

O número no alto do painel vinha do `index.html` lido pela API — ou seja, **do
site**, não da página aberta. Uma cópia velha guardada pelo navegador se
anunciava como nova, e o dono passou horas mexendo numa tela antiga achando que
o sistema não obedecia ("apaguei três vezes e não apaga").

Agora `admin/index.html` traz **`VERSAO_PAINEL`**, que é o que aparece no
cabeçalho e no rodapé. Quando o site está numa versão maior que a da página,
uma faixa amarela avisa e oferece **Atualizar agora** (recarrega com
`?atualizar=<hora>`, que obriga o navegador a buscar a página nova).

**Ao publicar qualquer mudança no painel, suba o `VERSAO_PAINEL` junto com o
`?v=` do `index.html` e o `CACHE` do `sw.js`.** Se esquecer, a faixa passa a
acusar desatualizado sem motivo.

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

### Financeiro interno (v173)
- Em Correção pelo INCC, custos e margens desejadas são dados privados do painel e não entram no `data.js`/site público.
- O usuário edita custo e margem extra desejada por item e confirma em **Salvar custos e margens**; antes disso o painel mostra **Alterações não salvas** e alerta ao fechar a aba.
- `Margem extra atual = preço de venda atual - custo`; `Venda desejada = custo + margem extra desejada`.
- **Margem desejada e venda desejada são os dois editáveis (v192)** e conversam entre si: digitar a venda calcula a margem (`venda − custo`), digitar a margem calcula a venda. O que fica guardado é sempre a **margem** — backup e cofre não mudam de formato. Venda abaixo do custo grava margem negativa, de propósito; sem custo lançado, o painel avisa em vez de adivinhar.
- **A correção aparece no painel na hora (v224).** Antes, "Aplicar correção" só
  anotava: preços e custos continuavam os antigos na tela até publicar, e o dono
  reclamou com razão — *"tem que corrigir no sistema primeiro"*. Agora, ao
  aplicar, o painel já mostra tudo corrigido: os preços a partir de um retrato
  do que veio do arquivo (`precosOriginais`) e os custos e margens a partir de
  um retrato do que estava guardado (`financeiroAntesDaPrevia`). **Descartar
  desfaz os dois lados.** Publicar continua sendo o único passo que mexe no
  site — e, como a prévia já corrigiu custo e margem, o publicar não corrige de
  novo: ele só grava.
- **A correção do INCC também corrige os custos (v195).** O custo sai da tabela do mês; ao publicar a correção, o painel multiplica `custos` e `margensDesejadas` pela mesma variação, grava no aparelho e manda para o cofre. O aviso diz quantos foram corrigidos. Sem isso a margem apareceria maior sem ninguém ter ganhado nada.
- **Novo INCC e variação são os dois editáveis (v193)** e conversam: informar o novo índice calcula a variação sobre `META.incc.valor`, e informar a variação calcula o novo índice (`anterior × (1 + pct/100)`, arredondado ao centavo). Apagar a variação limpa o novo índice.
- Backups financeiros v2 levam `custos` e `margensDesejadas`; backups/custos legados v171 continuam importáveis.


### INCC e histórico (v173)
- **O arredondamento é sempre para cima (v207)**, em R$ 100 (o padrão) ou R$ 1.000.
  Arredondar para o "mais próximo" jogava o preço para baixo do valor corrigido —
  o custo sobe pelo INCC sem arredondar, então 43 unidades ficaram de R$ 5 a R$ 30
  **abaixo do custo** depois da correção de setembro, e a margem apareceu
  negativa. A correção do mês nunca pode diminuir a margem.
- O painel lembra a escolha do aparelho: antes voltava sozinho para R$ 1.000 a
  cada abertura, mesmo depois do dono ter escolhido outro (v199).
- O campo de novo INCC usa formatação monetária brasileira com duas casas decimais.
- A variação mensal é calculada automaticamente e o painel mostra também a variação anterior.
- A data da tabela usa input de data real; ao publicar, grava dd/mm/aaaa.
- META.historicoIncc guarda mês, data, valor e variação de cada correção publicada.
- A tela de Preços e margem não tem rolagem horizontal: no computador é uma grade de sete colunas em qualquer largura, e abaixo de 760 px um cartão por item.
