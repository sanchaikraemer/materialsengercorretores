/* Construtora Senger — cache do site.

   v107 — como era antes: TODA abertura do site buscava index.html, app.js, data.js e
   styles.css na rede com { cache: "no-store" }, ou seja, ignorando o cache do
   navegador e sem prazo para desistir. Em 4G fraco ou no navegador de dentro do
   WhatsApp, a pagina ficava parada esperando o servidor — mesmo com tudo ja salvo
   no aparelho.

   Como e agora: responde na hora com o que esta salvo e, em paralelo, busca a
   versao nova para a proxima abertura ("stale-while-revalidate"). Quem ja abriu o
   site uma vez entra instantaneamente, mesmo sem sinal. Quem nunca abriu busca na
   rede normalmente, mas passando pelo cache do navegador (que era desligado).

   Como o corretor ve a versao nova: assim que o arquivo novo chega, o service
   worker avisa a pagina (mensagem "versao-nova") e o app se recarrega sozinho
   quando ninguem esta no meio de alguma coisa. */

const CACHE = "senger-portfolio-v107-imagens-leves";
const CORE = ["./index.html", "./styles.css?v=107", "./data.js?v=107", "./app.js?v=107", "./manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll falha inteiro se um arquivo falhar; um a um, o que der certo fica salvo.
      .then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const RAIZ = new URL("./", self.location).href;
const INDEX = new URL("./index.html", self.location).href;

// Abrir o site propriamente dito. Todo link do cliente cai no MESMO index.html, so
// mudando o que vem depois do "?" (?cliente&u=501, ?cliente&sel=..., &lista=...),
// entao tudo isso e uma coisa so no cache.
// Nao entram aqui: as pontes /l/<empreendimento>/ (cada uma e uma pagina propria) e
// o folder em PDF, que tambem chegam como "navegacao" — esses seguem o caminho
// normal do navegador, sem o service worker no meio.
function ehAberturaDoSite(url) {
  const semBusca = url.origin + url.pathname;
  return semBusca === RAIZ || semBusca === INDEX;
}

// Arquivos do "esqueleto": sao os que mudam a cada versao do site.
function ehArquivoCore(url) {
  return /\/(styles\.css|data\.js|app\.js|manifest\.json)$/.test(url.pathname);
}

async function avisarVersaoNova() {
  const clientes = await self.clients.matchAll({ type: "window" });
  clientes.forEach((cliente) => cliente.postMessage({ tipo: "versao-nova" }));
}

// Responde com o que esta salvo e atualiza por tras. Se nao houver nada salvo,
// espera a rede (primeira visita).
async function salvoEnquantoAtualiza(event, chave) {
  const cache = await caches.open(CACHE);
  const salvo = await cache.match(chave);

  const rede = fetch(event.request)
    .then(async (resposta) => {
      if (resposta && resposta.ok) {
        const paraGuardar = resposta.clone();
        const mudou = salvo ? (await paraGuardar.clone().text()) !== (await salvo.clone().text()) : false;
        await cache.put(chave, paraGuardar);
        if (mudou) avisarVersaoNova();
      }
      return resposta;
    })
    .catch(() => null);

  if (salvo) {
    event.waitUntil(rede);
    return salvo;
  }
  const resposta = await rede;
  return resposta || (await cache.match(INDEX)) || Response.error();
}

// Foto, planta e logo nunca mudam de conteudo sem mudar de endereco (?v=NNN),
// entao valem para sempre: primeiro o cache, rede so quando falta.
async function primeiroOCache(event) {
  const cache = await caches.open(CACHE);
  const salvo = await cache.match(event.request);
  if (salvo) return salvo;
  const resposta = await fetch(event.request);
  if (resposta && resposta.ok) cache.put(event.request, resposta.clone());
  return resposta;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) return;
  const url = new URL(event.request.url);

  if (event.request.mode === "navigate") {
    if (ehAberturaDoSite(url)) event.respondWith(salvoEnquantoAtualiza(event, INDEX));
    return;
  }
  if (ehArquivoCore(url)) {
    event.respondWith(salvoEnquantoAtualiza(event, event.request));
    return;
  }
  // Foto, planta, logo e icone: o endereco ja carrega a versao (?v=NNN), entao o que
  // esta salvo nunca fica errado.
  event.respondWith(primeiroOCache(event).catch(() => fetch(event.request)));
});
