/* Construtora Senger — Portfólio Comercial v68 */
(() => {
  "use strict";

  const source = window.SENGER || {};
  const storage = {
    memory: new Map(),
    get(key, fallback = null) {
      try {
        const value = window.localStorage.getItem(key);
        return value === null ? fallback : value;
      } catch (_) {
        return this.memory.has(key) ? this.memory.get(key) : fallback;
      }
    },
    set(key, value) {
      const normalized = String(value);
      try { window.localStorage.setItem(key, normalized); } catch (_) { this.memory.set(key, normalized); }
    },
  };
  const META = source.META || {};
  const EMPREENDIMENTOS = (source.EMPREENDIMENTOS || []).filter((emp) => emp.confirmado !== false);
  const LOCAIS = source.LOCAIS || {};

  const APP_VERSION = (() => {
    const src = document.currentScript?.src || "";
    const match = src.match(/[?&]v=([^&]+)/);
    return match ? `v${match[1]}` : "—";
  })();

  const CATEGORY_LABELS = {
    todos: "Todos",
    residencial: "Residencial",
    comercial: "Comercial",
    terreno: "Terrenos",
    outros: "Outros",
  };

  const STATUS_LABELS = {
    disponivel: "Disponível",
    alugado: "Alugado",
    reservado: "Reservado",
    vendido: "Vendido",
  };

  const state = {
    query: "",
    city: "todos",
    stage: "todos",
    price: "todos",
    sort: "destaque",
    selected: new Set(JSON.parse(storage.get("senger-selection", "[]"))),
    // Empreendimentos marcados para a lista enviada ao cliente. Vazio = todos os filtrados.
    picks: new Set(JSON.parse(storage.get("senger-picks", "[]"))),
  };

  // Link enviado ao cliente (?cliente): a pagina fica travada no empreendimento
  // aberto, sem voltar ao portfolio nem botoes internos da equipe.
  const CLIENT_MODE = new URLSearchParams(location.search).has("cliente");
  const clientLockHash = CLIENT_MODE ? location.hash : "";
  // v90 — link de LISTA (?cliente&lista=id1,id2,...): a home vira a vitrine do cliente com SO
  // esses empreendimentos (cada um com a sua foto), navegando entre eles e mais nada. Substitui
  // o envio da lista como texto: o WhatsApp so mostra UMA imagem de previa por mensagem, entao
  // o texto antigo saia com a foto do primeiro empreendimento e os demais "pelados" — confuso.
  // v94 — link de SELECAO DE UNIDADES (?cliente&sel=emp~cod,emp~cod,...): o cliente ve so as
  // unidades escolhidas, de um ou de varios empreendimentos. Cada pedaco e "empId~codigo"
  // (o ~ separa, porque codigo pode ter hifen). E o mesmo tratamento do ?u= de uma unidade,
  // agora valendo pra selecao inteira do carrinho.
  const CLIENT_SEL = (() => {
    if (!CLIENT_MODE) return null;
    const raw = String(new URLSearchParams(location.search).get("sel") || "").trim();
    if (!raw) return null;
    const porEmp = new Map();
    raw.split(",").map((s) => s.trim()).filter(Boolean).forEach((par) => {
      const corte = par.indexOf("~");
      if (corte < 1) return;
      const empId = par.slice(0, corte);
      const code = par.slice(corte + 1);
      if (!code) return;
      if (!porEmp.has(empId)) porEmp.set(empId, new Set());
      porEmp.get(empId).add(code);
    });
    return porEmp.size ? porEmp : null;
  })();

  const CLIENT_LIST_IDS = (() => {
    if (!CLIENT_MODE) return null;
    const raw = String(new URLSearchParams(location.search).get("lista") || "").trim();
    // Sem lista= mas com sel=: a vitrine mostra os empreendimentos das unidades escolhidas.
    if (!raw) return CLIENT_SEL ? [...CLIENT_SEL.keys()] : null;
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return ids.length ? ids : null;
  })();

  const itemMap = new Map();
  const enterpriseItems = new Map();

  const money = (value) => {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) return "Sob consulta";
    return Number(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  };

  const escapeHtml = (text = "") => String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const normalizeText = (text = "") => String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const unique = (values) => [...new Set(values.filter(Boolean))];
  const isMarketable = (status) => !["vendido", "reservado"].includes(status || "disponivel");
  const safeUrl = (url) => /^https?:\/\//i.test(url || "") ? url : `https://${url}`;

  const assetUrl = (path) => {
    if (!path) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}v=${APP_VERSION.replace(/^v/, "")}`;
  };

  function itemLabel(item) {
    if (item.kind === "unit") {
      const prefix = item.emp.categoria === "comercial" ? "Sala" : "Apto";
      return /^\d/.test(String(item.code)) ? `${prefix} ${item.code}` : String(item.code);
    }
    if (item.kind === "land") return `Quadra ${item.quadra} · Lote ${item.numero}`;
    return item.nome;
  }

  function buildInventory() {
    EMPREENDIMENTOS.forEach((emp) => {
      const items = [];

      (emp.grupos || []).forEach((group, groupIndex) => {
        (group.unidades || []).forEach((unit, unitIndex) => {
          const item = {
            key: `${emp.id}:unit:${groupIndex}:${unitIndex}`,
            kind: "unit",
            emp,
            group,
            code: unit.apto,
            price: Number(unit.preco) || 0,
            status: unit.status || "disponivel",
            area: unit.areaUnit || group.area || "",
            garage: group.garagem || "",
            tags: unit.tags || [],
            notes: unit.obs || group.obs || "",
            // v96 — planta propria da unidade (ex.: Casa Suspensa tem uma por apto);
            // sem ela, vale a planta da tipologia.
            planta: unit.planta || group.planta || "",
          };
          items.push(item);
          itemMap.set(item.key, item);
        });
      });

      (emp.terrenos || []).forEach((land, index) => {
        const item = {
          key: `${emp.id}:land:${index}`,
          kind: "land",
          emp,
          code: `${land.quadra}-${land.numero}`,
          quadra: land.quadra,
          numero: land.numero,
          lote: land.lote || emp.nome,
          rua: land.rua || "",
          price: Number(land.preco) || 0,
          status: land.status || "disponivel",
          area: land.area ? `${Number(land.area).toLocaleString("pt-BR")} m²` : "",
          garage: "",
          tags: [],
          notes: "",
        };
        items.push(item);
        itemMap.set(item.key, item);
      });

      (emp.outros || []).forEach((other, index) => {
        const item = {
          key: `${emp.id}:other:${index}`,
          kind: "other",
          emp,
          code: other.nome,
          nome: other.nome,
          local: other.local || "",
          description: other.descricao || "",
          price: Number(other.preco) || 0,
          pricePrefix: other.precoPrefixo || "",
          status: other.status || "disponivel",
          area: other.area || "",
          garage: "",
          tags: [],
          notes: other.obs || "",
        };
        items.push(item);
        itemMap.set(item.key, item);
      });

      enterpriseItems.set(emp.id, items);
    });

    state.selected = new Set([...state.selected].filter((key) => itemMap.has(key)));
    saveSelection();
  }

  function itemsFor(emp) {
    return enterpriseItems.get(emp.id) || [];
  }

  function marketableItems(emp) {
    return itemsFor(emp).filter((item) => isMarketable(item.status));
  }

  function minPrice(emp) {
    const priced = marketableItems(emp).map((item) => item.price).filter((price) => price > 0);
    return priced.length ? Math.min(...priced) : 0;
  }

  function maxPrice(emp) {
    const priced = marketableItems(emp).map((item) => item.price).filter((price) => price > 0);
    return priced.length ? Math.max(...priced) : 0;
  }

  function mediaFor(emp) {
    const media = [];
    if (emp.hero) media.push({ src: emp.hero, legenda: emp.nome });
    (emp.galeria || []).forEach((item) => {
      if (item?.src && !media.some((current) => current.src === item.src)) media.push(item);
    });
    return media;
  }

  function portfolioSearchText(emp) {
    const inventory = itemsFor(emp).map((item) => [
      itemLabel(item), item.area, item.garage, item.rua, item.local, item.description,
      ...(item.tags || []), item.group?.tipo, item.notes,
    ].join(" ")).join(" ");
    return normalizeText([
      emp.nome, emp.cidade, emp.categoria, emp.statusLabel, emp.entrega,
      emp.tagline, emp.localizacao, emp.condicoes,
      ...(emp.diferenciais || []).flatMap((d) => [d.titulo, d.desc]),
      inventory,
    ].join(" "));
  }

  function renderMetadata() {
    const allItems = EMPREENDIMENTOS.flatMap(itemsFor);
    const marketable = allItems.filter((item) => isMarketable(item.status));
    const cities = unique(EMPREENDIMENTOS.flatMap((emp) => emp.cidade.split(" · ")));
    const categories = unique(EMPREENDIMENTOS.map((emp) => emp.categoria));

    setText("header-version", APP_VERSION);
    setText("meta-month", META.mesTabela || "—");
    setText("meta-incc", META.incc ? `${META.incc.valor} (${META.incc.variacao})` : "—");
    setText("meta-cities", cities.map((city) => city.replace("/RS", "")).join(" · "));
    setText("header-month", META.mesTabela || "—");
    setText("header-incc", META.incc ? `${META.incc.valor} (${META.incc.variacao})` : "—");
    const citiesLabel = cities.map((city) => city.replace("/RS", "")).join(" · ");
    setText("header-cities", citiesLabel);
    document.getElementById("header-cities")?.setAttribute("title", citiesLabel);

    // v100 — o cliente nao ve mais quantas opcoes existem, em lugar nenhum:
    // nem "182 opcoes a venda" aqui no topo, nem "Opcoes ativas" no cartao e na
    // ficha, nem a barra acima do quadro de unidades. Dizer o tamanho do estoque
    // tira a urgencia da venda. Decisao do dono. O corretor continua vendo tudo.
    const stats = [
      [EMPREENDIMENTOS.length, "empreendimentos"],
      ...(CLIENT_MODE ? [] : [[marketable.length, "opções à venda"]]),
      [categories.length, "categorias"],
    ];
    document.getElementById("hero-stats").innerHTML = stats.map(([value, label]) => `
      <div class="hero-stat"><strong>${Number(value).toLocaleString("pt-BR")}</strong><span>${escapeHtml(label)}</span></div>
    `).join("");

    const footer = document.getElementById("footer-contacts");
    footer.innerHTML = [
      ...(META.contato?.telefones || []).map((phone) => `<a href="tel:${phone.replace(/\D/g, "")}">${escapeHtml(phone)}</a>`),
      META.contato?.instagram ? `<a href="https://instagram.com/${META.contato.instagram.replace("@", "")}" target="_blank" rel="noopener">${escapeHtml(META.contato.instagram)}</a>` : "",
      META.contato?.site ? `<a href="${safeUrl(META.contato.site)}" target="_blank" rel="noopener">${escapeHtml(META.contato.site)}</a>` : "",
    ].join("");
    setText("footer-address", META.contato?.endereco || "");
  }

  function renderFilters() {
    const citySelect = document.getElementById("city-filter");
    const cities = unique(EMPREENDIMENTOS.flatMap((emp) => emp.cidade.split(" · "))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    citySelect.innerHTML = `<option value="todos">Todas as cidades</option>${cities.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`).join("")}`;

    document.getElementById("search-input").addEventListener("input", (event) => {
      state.query = event.target.value.trim();
      renderPortfolio();
    });
    citySelect.addEventListener("change", (event) => { state.city = event.target.value; renderPortfolio(); });
    document.getElementById("stage-filter").addEventListener("change", (event) => { state.stage = event.target.value; renderPortfolio(); });
    document.getElementById("price-filter").addEventListener("change", (event) => { state.price = event.target.value; renderPortfolio(); });
    document.getElementById("sort-filter").addEventListener("change", (event) => { state.sort = event.target.value; renderPortfolio(); });
    document.getElementById("clear-filters").addEventListener("click", clearFilters);
    document.getElementById("empty-clear").addEventListener("click", clearFilters);

    const filterToggle = document.getElementById("filter-toggle");
    filterToggle.addEventListener("click", () => {
      const body = document.getElementById("filters-body");
      const open = body.classList.toggle("open");
      filterToggle.setAttribute("aria-expanded", String(open));
    });
  }

  function clearFilters() {
    state.query = "";
    state.city = "todos";
    state.stage = "todos";
    state.price = "todos";
    state.sort = "destaque";
    document.getElementById("search-input").value = "";
    document.getElementById("city-filter").value = "todos";
    document.getElementById("stage-filter").value = "todos";
    document.getElementById("price-filter").value = "todos";
    document.getElementById("sort-filter").value = "destaque";
    renderPortfolio();
  }

  function priceRangeMatches(emp) {
    if (state.price === "todos") return true;
    const [minRaw, maxRaw] = state.price.split("-");
    const min = Number(minRaw) || 0;
    const max = maxRaw === "inf" ? Infinity : Number(maxRaw);
    return marketableItems(emp).some((item) => item.price > 0 && item.price >= min && item.price <= max);
  }

  function filteredEnterprises() {
    const query = normalizeText(state.query);
    const result = EMPREENDIMENTOS.filter((emp) => {
      if (CLIENT_LIST_IDS && !CLIENT_LIST_IDS.includes(emp.id)) return false;
      if (state.city !== "todos" && !emp.cidade.split(" · ").includes(state.city)) return false;
      if (state.stage !== "todos" && emp.status !== state.stage) return false;
      if (marketableItems(emp).length === 0) return false;
      if (!priceRangeMatches(emp)) return false;
      if (query && !portfolioSearchText(emp).includes(query)) return false;
      return true;
    });

    return result.sort((a, b) => {
      if (state.sort === "menor-preco") return (minPrice(a) || Infinity) - (minPrice(b) || Infinity);
      if (state.sort === "maior-preco") return maxPrice(b) - maxPrice(a);
      if (state.sort === "mais-opcoes") return marketableItems(b).length - marketableItems(a).length;
      if (state.sort === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
      return Number(Boolean(b.destaque)) - Number(Boolean(a.destaque)) || EMPREENDIMENTOS.indexOf(a) - EMPREENDIMENTOS.indexOf(b);
    });
  }

  function cardImage(emp) {
    return emp.hero || "assets/fachada.jpg";
  }

  function renderPortfolio() {
    const grid = document.getElementById("portfolio-grid");
    const enterprises = filteredEnterprises();
    document.getElementById("empty-state").hidden = enterprises.length > 0;
    setHtml("results-count", CLIENT_LIST_IDS
      ? `Seleção preparada para você — <strong>${enterprises.length}</strong> ${enterprises.length === 1 ? "empreendimento" : "empreendimentos"}. Toque em um deles para ver fotos, valores e disponibilidade.`
      : `<strong>${enterprises.length}</strong> ${enterprises.length === 1 ? "empreendimento encontrado" : "empreendimentos encontrados"}`);

    const filtrando = state.picks.size > 0;
    grid.innerHTML = enterprises.map((emp) => {
      const active = marketableItems(emp);
      const minimum = minPrice(emp);
      const statusClass = emp.status === "pronto" ? "pronto" : "obra";
      const typeLabel = CATEGORY_LABELS[emp.categoria] || emp.categoria;
      const napista = state.picks.has(emp.id);
      // v95 — link de selecao (?sel=): o cartao da vitrine mostra AS UNIDADES escolhidas com o
      // valor de cada uma, no lugar dos numeros do predio inteiro ("43 opcoes ativas / a partir
      // de...") — senao parece que a escolha do corretor se perdeu no caminho.
      const selCodes = CLIENT_SEL ? CLIENT_SEL.get(emp.id) : null;
      const selUnits = selCodes ? itemsFor(emp).filter((it) => selCodes.has(String(it.code))) : null;
      const metricas = selUnits && selUnits.length ? `
            <div class="card-units-sel">
              <span>${selUnits.length === 1 ? "Unidade escolhida para você" : "Unidades escolhidas para você"}</span>
              ${selUnits.slice(0, 4).map((it) => `<div class="card-unit-line"><strong>${escapeHtml(itemLabel(it))}</strong><strong class="price-value">${money(it.price)}</strong></div>`).join("")}
              ${selUnits.length > 4 ? `<div class="card-unit-line"><strong>e mais ${selUnits.length - 4} no detalhe…</strong></div>` : ""}
            </div>` : `
            <div class="card-metrics">
              ${CLIENT_MODE ? "" : `<div class="card-metric"><span>Opções ativas</span><strong>${active.length}</strong></div>`}
              <div class="card-metric card-price-panel">
                <span class="card-price-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false"><path d="M4 21V8.5L12 4l8 4.5V21M8 21v-8h8v8M9 9h.01M12 9h.01M15 9h.01"/></svg>
                </span>
                <span class="card-price-copy"><span>A partir de</span><strong class="price-value">${minimum ? money(minimum) : "Sob consulta"}</strong></span>
              </div>
            </div>`;
      return `
        <article class="portfolio-card${filtrando && !napista ? " is-unpicked" : ""}">
          <div class="card-media">
            <img src="${escapeHtml(assetUrl(cardImage(emp)))}" alt="${escapeHtml(emp.nome)}" loading="lazy">
            ${emp.logo ? `<img class="card-logo" src="${escapeHtml(assetUrl(emp.logo))}" alt="">` : ""}
            <button class="card-pick${napista ? " picked" : ""}" type="button" data-pick-emp="${emp.id}" aria-pressed="${napista}">${napista ? "✓ Na lista" : "+ Lista"}</button>
          </div>
          <div class="card-body">
            <div class="card-badges">
              <span class="badge badge-stage ${statusClass}">${escapeHtml(emp.statusLabel || emp.entrega || "")}</span>
              <span class="badge">${escapeHtml(typeLabel)}</span>
            </div>
            <span class="card-kicker">${escapeHtml(emp.cidade)}</span>
            <h3 class="card-title">${escapeHtml(emp.nome)}</h3>
            <p class="card-tagline">${escapeHtml(emp.tagline || emp.entrega || "Consulte informações e disponibilidade.")}</p>
            ${metricas}
          </div>
          <div class="card-footer">
            <span class="button button-dark card-open-label" aria-hidden="true">${selUnits && selUnits.length ? (selUnits.length > 1 ? "Ver minhas unidades" : "Ver minha unidade") : "Ver empreendimento"}</span>
            <button class="card-share" type="button" data-share-emp="${emp.id}" aria-label="Compartilhar ${escapeHtml(emp.nome)}">↗</button>
          </div>
          <a class="card-open-overlay" href="#emp-${emp.id}" aria-label="Abrir detalhes do empreendimento ${escapeHtml(emp.nome)}"></a>
        </article>
      `;
    }).join("");

    grid.querySelectorAll("[data-share-emp]").forEach((button) => button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      shareEnterprise(findEnterprise(button.dataset.shareEmp), false);
    }));

    grid.querySelectorAll("[data-pick-emp]").forEach((button) => button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      togglePick(button.dataset.pickEmp);
    }));

    updatePicksUi();
  }

  function togglePick(id) {
    if (state.picks.has(id)) state.picks.delete(id);
    else state.picks.add(id);
    storage.set("senger-picks", JSON.stringify([...state.picks]));
    renderPortfolio();
  }

  function clearPicks() {
    state.picks.clear();
    storage.set("senger-picks", JSON.stringify([]));
    renderPortfolio();
  }

  // Lista que vai para o cliente: os marcados ou, se nenhum estiver marcado, os filtrados.
  function portfolioList() {
    const enterprises = filteredEnterprises();
    if (!state.picks.size) return enterprises;
    return enterprises.filter((emp) => state.picks.has(emp.id));
  }

  function updatePicksUi() {
    const total = portfolioList().length;
    const marcados = state.picks.size;
    document.getElementById("clear-picks").hidden = marcados === 0;
    const button = document.getElementById("share-portfolio");
    button.disabled = total === 0;
    button.textContent = marcados ? `Enviar lista (${total})` : "Enviar lista";
    document.getElementById("print-list").disabled = total === 0;
  }

  function findEnterprise(id) {
    return EMPREENDIMENTOS.find((emp) => emp.id === id);
  }

  function navigateToEnterprise(id) {
    if (location.hash === `#emp-${id}`) renderRoute();
    else location.hash = `emp-${id}`;
  }

  function navigateHome() {
    // No link de LISTA a home e a vitrine do cliente — voltar pra ela e permitido.
    if (CLIENT_MODE && !CLIENT_LIST_IDS) return;
    history.pushState(null, "", `${location.pathname}${location.search}`);
    renderRoute();
  }

  function renderRoute() {
    if (CLIENT_MODE && CLIENT_LIST_IDS) {
      // Lista do cliente: pode ficar na home (vitrine) ou abrir um empreendimento DA lista.
      const m = location.hash.match(/^#emp-([\w-]+)/);
      const permitido = !location.hash || location.hash === "#" || (m && CLIENT_LIST_IDS.includes(m[1]));
      if (!permitido) { location.hash = ""; return; }
    } else if (CLIENT_MODE && location.hash !== clientLockHash) {
      location.hash = clientLockHash;
      return;
    }
    const match = location.hash.match(/^#emp-([\w-]+)/);
    const emp = match ? findEnterprise(match[1]) : null;
    if (emp) renderDetail(emp);
    else renderHome();
  }

  function renderHome() {
    // Lista do cliente: esconde o "palco" do corretor (hero, faixa da tabela, filtros) e deixa
    // so a vitrine com os empreendimentos escolhidos.
    const vitrineCliente = Boolean(CLIENT_LIST_IDS);
    document.getElementById("home-hero").hidden = vitrineCliente;
    const strip = document.querySelector(".trust-strip");
    if (strip) strip.hidden = vitrineCliente;
    const filtros = document.getElementById("filters-panel");
    if (filtros) filtros.hidden = vitrineCliente;
    document.getElementById("catalogo").hidden = false;
    document.getElementById("detail-view").hidden = true;
    document.getElementById("detail-view").innerHTML = "";
    document.title = "Construtora Senger — Portfólio Comercial";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderDetail(emp) {
    document.getElementById("home-hero").hidden = true;
    document.querySelector(".trust-strip").hidden = true;
    document.getElementById("catalogo").hidden = true;

    const detail = document.getElementById("detail-view");
    detail.hidden = false;
    document.title = `${emp.nome} — Construtora Senger`;

    const media = mediaFor(emp);
    const local = LOCAIS[emp.id] || {};
    const active = marketableItems(emp);
    const minimum = minPrice(emp);
    const statusClass = emp.status === "pronto" ? "pronto" : "obra";
    // Link do cliente com unidade (?cliente&u=501): a pagina mostra so essa
    // unidade — sem os precos das demais nem as plantas das outras tipologias.
    const unitParam = new URLSearchParams(location.search).get("u");
    // v94 — o foco pode ser UMA unidade (?u=) ou a SELECAO (?sel=): sempre uma lista.
    const focusItems = (() => {
      if (!CLIENT_MODE) return null;
      if (unitParam) {
        const unico = itemsFor(emp).find((it) => String(it.code) === unitParam);
        return unico ? [unico] : null;
      }
      const codes = CLIENT_SEL ? CLIENT_SEL.get(emp.id) : null;
      if (!codes) return null;
      const escolhidos = itemsFor(emp).filter((it) => codes.has(String(it.code)));
      return escolhidos.length ? escolhidos : null;
    })();
    const focusItem = focusItems && focusItems.length === 1 ? focusItems[0] : null;
    // v98 — com 2+ unidades escolhidas o resumo fala DA SELECAO, nao do predio:
    // antes sobravam ali "opcoes ativas" e "preco inicial" do empreendimento
    // inteiro, contradizendo as unidades que o corretor tinha escolhido mandar.
    const focusRange = (() => {
      if (!focusItems || focusItems.length < 2) return null;
      const precos = focusItems.map((it) => Number(it.price) || 0).filter((p) => p > 0);
      if (!precos.length) return "Sob consulta";
      const menor = Math.min(...precos);
      const maior = Math.max(...precos);
      return menor === maior ? money(menor) : `${money(menor)} a ${money(maior)}`;
    })();
    const inventory = renderInventory(emp, focusItems);

    const isPlantMedia = (item) => /planta/i.test(`${item?.src || ""} ${item?.legenda || ""}`);
    const photoMedia = media.filter((item) => !isPlantMedia(item)).slice(0, 12);
    let humanizedPlants = media.filter((item) => isPlantMedia(item) && !/\.pdf(?:$|\?)/i.test(item.src || ""));
    let technicalPlants = media.filter((item) => isPlantMedia(item) && /\.pdf(?:$|\?)/i.test(item.src || ""));
    if (focusItems) {
      const plantas = unique(focusItems.map((f) => f.planta || f.group?.planta).filter(Boolean));
      // v101 — so filtra quando as unidades escolhidas APONTAM pra uma planta.
      // Antes, se nao apontassem, a pagina do cliente ficava SEM PLANTA NENHUMA:
      // um link de selecao do Evolutti nao mostrava planta alguma, porque nenhum
      // grupo de la tinha a ligacao preenchida. Ficar sem planta e pior do que
      // mostrar as do empreendimento, entao agora esse e o piso.
      if (plantas.length) {
        humanizedPlants = humanizedPlants.filter((item) => plantas.some((p) => (item.src || "").includes(p)));
        technicalPlants = technicalPlants.filter((item) => plantas.some((p) => (item.src || "").includes(p)));
      }
    }

    const THUMB_W = 84;
    const THUMB_GAP = 10;
    const stripWidth = photoMedia.length > 1 ? photoMedia.length * THUMB_W + (photoMedia.length - 1) * THUMB_GAP : 0;

    const gallery = photoMedia.length ? `
      <section class="content-section">
        <div class="section-title-row"><h2>Imagens</h2><p>${photoMedia.length} ${photoMedia.length === 1 ? "imagem disponível" : "imagens disponíveis"}</p></div>
        <div class="gallery-showcase" data-gallery-showcase${stripWidth ? ` style="max-width:${stripWidth}px"` : ""}>
          <div class="gallery-featured">
            <img src="${escapeHtml(assetUrl(photoMedia[0].src))}" alt="${escapeHtml(photoMedia[0].legenda || emp.nome)}" data-gallery-featured>
            ${photoMedia.length > 1 ? `<span class="gallery-counter" data-gallery-counter>1 / ${photoMedia.length}</span>` : ""}
          </div>
          ${photoMedia.length > 1 ? `
            <div class="gallery-strip">
              ${photoMedia.map((item, index) => `
                <button class="gallery-thumb ${index === 0 ? "active" : ""}" type="button" data-gallery-thumb="${index}" aria-label="Exibir ${escapeHtml(item.legenda || emp.nome)} na imagem principal">
                  <img src="${escapeHtml(assetUrl(item.src))}" alt="" loading="lazy">
                </button>
              `).join("")}
            </div>
          ` : ""}
        </div>
      </section>
    ` : "";

    const plantSection = (technicalPlants.length || humanizedPlants.length) ? `
      <section class="content-section plant-section">
        <div class="section-title-row"><h2>Plantas</h2></div>
        <div class="plant-viewer">
          <div class="plant-viewer-list">
            ${technicalPlants.length ? `
              <div class="plant-link-group">
                <h3>Planta técnica</h3>
                <div class="plant-link-list">
                  ${technicalPlants.map((item) => `<a class="plant-link" href="${escapeHtml(assetUrl(item.src))}" target="_blank" rel="noopener">${escapeHtml(item.legenda || "Planta técnica")}</a>`).join("")}
                </div>
              </div>
            ` : ""}
            ${humanizedPlants.length ? `
              <div class="plant-link-group">
                <h3>Planta humanizada</h3>
                <div class="plant-link-list">
                  ${humanizedPlants.map((item, index) => `<button class="plant-link ${index === 0 ? "active" : ""}" type="button" data-plant-preview="${index}">${escapeHtml(item.legenda || "Planta humanizada")}</button>`).join("")}
                </div>
              </div>
            ` : ""}
          </div>
          ${humanizedPlants.length ? `
            <div class="plant-viewer-preview">
              <img src="${escapeHtml(assetUrl(humanizedPlants[0].src))}" alt="${escapeHtml(humanizedPlants[0].legenda || emp.nome)}" data-plant-preview-image>
            </div>
          ` : ""}
        </div>
      </section>
    ` : "";

    detail.innerHTML = `
      <section class="detail-hero">
        <img class="detail-hero-image" src="${escapeHtml(assetUrl(cardImage(emp)))}" alt="${escapeHtml(emp.nome)}">
        <div class="shell detail-hero-content">
          <button class="button detail-back" type="button" id="detail-back">← Voltar ao portfólio</button>
          <div class="detail-title-row">
            <div>
              <div class="detail-badges">
                <span class="badge badge-stage ${statusClass}">${escapeHtml(emp.statusLabel || emp.entrega || "")}</span>
                <span class="badge">${escapeHtml(emp.cidade)}</span>
                <span class="badge">${escapeHtml(CATEGORY_LABELS[emp.categoria] || emp.categoria)}</span>
              </div>
              <h1>${escapeHtml(emp.nome)}${focusItem ? ` — ${escapeHtml(itemLabel(focusItem))}` : ""}</h1>
              <p>${escapeHtml(emp.tagline || emp.entrega || "Consulte informações e disponibilidade.")}</p>
              <div class="detail-actions">
                <button class="button button-primary" type="button" id="share-emp-prices">WhatsApp com preços</button>
                <button class="button button-outline" type="button" id="share-emp-no-prices">WhatsApp sem preços</button>
                <button class="button button-outline" type="button" id="share-emp-link">Enviar link</button>
                <button class="button button-outline" type="button" id="print-detail">Gerar PDF</button>
                ${local.mapsUrl ? `<a class="button button-outline" href="${escapeHtml(local.mapsUrl)}" target="_blank" rel="noopener">Ver localização</a>` : ""}
                ${emp.folder ? `<a class="button button-outline" href="${escapeHtml(assetUrl(emp.folder))}" target="_blank" rel="noopener">Baixar folder</a>` : ""}
              </div>
            </div>
            ${emp.logo ? `<img class="detail-brand-logo" src="${escapeHtml(assetUrl(emp.logo))}" alt="Logo ${escapeHtml(emp.nome)}">` : ""}
          </div>
        </div>
      </section>

      <div class="shell detail-content">
        <div class="detail-summary-grid">
          <article class="info-card">
            <p class="eyebrow dark">Apresentação</p>
            <h2>Sobre o empreendimento</h2>
            <p>${escapeHtml(emp.localizacao || emp.tagline || "Consulte a equipe comercial para mais informações.")}</p>
            ${emp.condicoes ? `<div class="condition-note"><strong>Condições:</strong> ${escapeHtml(emp.condicoes)}</div>` : ""}
            ${(emp.diferenciais || []).length ? `
              <div class="info-differentials">
                ${emp.diferenciais.map((item) => `
                  <div class="info-differential"><h4>${escapeHtml(item.titulo)}</h4><p>${escapeHtml(item.desc)}</p></div>
                `).join("")}
              </div>
            ` : ""}
          </article>
          <article class="info-card">
            <p class="eyebrow dark">Resumo comercial</p>
            <h2>Informações principais</h2>
            <div class="fact-grid">
              <div class="fact-card"><span>Etapa</span><strong>${escapeHtml(emp.entrega || emp.statusLabel || "—")}</strong></div>
              ${focusItem ? `
                <div class="fact-card"><span>Área</span><strong>${escapeHtml(focusItem.area || "—")}</strong></div>
                <div class="fact-card"><span>Valor</span><strong class="price-value">${money(focusItem.price)}</strong></div>
              ` : focusRange ? `
                <div class="fact-card"><span>Unidades selecionadas</span><strong>${focusItems.length}</strong></div>
                <div class="fact-card"><span>Valores</span><strong class="price-value">${focusRange}</strong></div>
              ` : `
                ${CLIENT_MODE ? "" : `<div class="fact-card"><span>Opções ativas</span><strong>${active.length}</strong></div>`}
                <div class="fact-card"><span>Preço inicial</span><strong class="price-value">${minimum ? money(minimum) : "Sob consulta"}</strong></div>
              `}
              <div class="fact-card"><span>Registro</span><strong>${escapeHtml((emp.ri || []).join(" · ") || "Não informado")}</strong></div>
            </div>
          </article>
        </div>
        ${inventory}
        ${gallery}
        ${plantSection}
      </div>
    `;

    document.getElementById("detail-back").addEventListener("click", navigateHome);
    document.getElementById("share-emp-prices").addEventListener("click", () => shareEnterprise(emp, true));
    document.getElementById("share-emp-no-prices").addEventListener("click", () => shareEnterprise(emp, false));
    document.getElementById("share-emp-link").addEventListener("click", () => shareClientLink(emp));
    document.getElementById("print-detail").addEventListener("click", (event) => printEnterprise(emp, event));
    const featuredImage = detail.querySelector("[data-gallery-featured]");
    const featuredCounter = detail.querySelector("[data-gallery-counter]");
    detail.querySelectorAll("[data-gallery-thumb]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.galleryThumb);
        const item = photoMedia[index];
        if (!item || !featuredImage) return;
        featuredImage.src = assetUrl(item.src);
        featuredImage.alt = item.legenda || emp.nome;
        if (featuredCounter) featuredCounter.textContent = `${index + 1} / ${photoMedia.length}`;
        detail.querySelectorAll("[data-gallery-thumb]").forEach((thumb) => thumb.classList.remove("active"));
        button.classList.add("active");
      });
    });
    const plantPreviewImage = detail.querySelector("[data-plant-preview-image]");
    detail.querySelectorAll("[data-plant-preview]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = humanizedPlants[Number(button.dataset.plantPreview)];
        if (!item || !plantPreviewImage) return;
        plantPreviewImage.src = assetUrl(item.src);
        plantPreviewImage.alt = item.legenda || emp.nome;
        detail.querySelectorAll("[data-plant-preview]").forEach((thumb) => thumb.classList.remove("active"));
        button.classList.add("active");
      });
    });
    bindInventoryEvents(detail);

    // Link de unidade (?u=501): so destaca a linha. A pagina abre no topo,
    // para o cliente ver o empreendimento e os diferenciais antes do preco.
    const unitCode = new URLSearchParams(location.search).get("u");
    if (unitCode) {
      detail.querySelectorAll(`[data-unit-code="${CSS.escape(unitCode)}"]`).forEach((el) => el.classList.add("unit-highlight"));
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderInventory(emp, focusItems = null) {
    if ((emp.grupos || []).length) return renderUnitGroups(emp, focusItems);
    if ((emp.terrenos || []).length) return renderLandInventory(emp, focusItems);
    if ((emp.outros || []).length) return renderOtherInventory(emp, focusItems);
    return "";
  }

  function renderUnitGroups(emp, focusItems = null) {
    const groups = emp.grupos || [];
    const focusKeys = focusItems ? new Set(focusItems.map((f) => f.key)) : null;
    return `
      <section class="content-section" id="unidades">
        <div class="section-title-row"><h2>${focusItems ? (focusItems.length > 1 ? "Suas unidades" : "Sua unidade") : "Unidades e valores"}</h2><p>Selecione opções para encaminhar ao cliente</p></div>
        ${CLIENT_MODE ? "" : `<div class="inventory-toolbar"><p>${marketableItems(emp).length} opções comercializáveis nesta tabela.</p></div>`}
        ${groups.map((group, groupIndex) => {
          let units = (group.unidades || []).map((unit, unitIndex) => itemMap.get(`${emp.id}:unit:${groupIndex}:${unitIndex}`));
          if (focusKeys) units = units.filter((it) => it && focusKeys.has(it.key));
          if (!units.length) return "";
          // v103 — a area da tipologia fica so no cabecalho. A coluna Area da tabela
          // aparece apenas quando alguma unidade tem area diferente da do grupo.
          const showArea = units.some((it) => hasOwnArea(it));
          const showGarage = units.some((it) => normalizeText(it.garage) !== normalizeText(group.garagem || ""));
          return `
            <article class="unit-group">
              ${renderGroupHeader(group)}
              <table class="units-table">
                <thead><tr><th>Unidade</th>${showArea ? "<th>Área</th>" : ""}${showGarage ? "<th>Garagem</th>" : ""}<th>Status</th><th>Valor</th><th></th></tr></thead>
                <tbody>${units.map((item) => renderUnitRow(item, showArea, showGarage)).join("")}</tbody>
              </table>
              <div class="mobile-units">${units.map(renderMobileUnit).join("")}</div>
            </article>
          `;
        }).join("")}
      </section>
    `;
  }

  // v103 — a unidade so tem area propria quando ela existe e e diferente da tipologia.
  function hasOwnArea(item) {
    if (!item || !item.area) return false;
    const groupArea = item.group?.area || "";
    return normalizeText(item.area) !== normalizeText(groupArea);
  }

  // v103 — "Casa Suspensa" nao e uma etiqueta comum: e a unidade da mesma tipologia
  // com area aberta maior (antes chamada de terraco). Fica no grupo dos iguais, so
  // apresentada de forma diferente.
  const CASA_SUSPENSA = "Casa Suspensa";
  const isCasaSuspensa = (tag) => normalizeText(tag) === normalizeText(CASA_SUSPENSA);
  const casaSuspensaTag = (item) => (item.tags || []).some(isCasaSuspensa);
  const otherTags = (item) => (item.tags || []).filter((tag) => !isCasaSuspensa(tag));

  // v103 — modelo A: faixa colorida com o tipo em destaque e a area/garagem em etiquetas.
  function renderGroupHeader(group) {
    const chips = String(group.area || "")
      .split("·")
      .map((part) => part.trim())
      .filter(Boolean);
    if (group.garagem) chips.push(String(group.garagem).trim());
    return `
      <div class="unit-group-header">
        <h3>${escapeHtml(group.tipo)}</h3>
        ${chips.length ? `<div class="unit-group-chips">${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}</div>` : ""}
        ${group.obs ? `<p class="unit-group-obs">${escapeHtml(group.obs)}</p>` : ""}
      </div>
    `;
  }

  function renderUnitRow(item, showArea = true, showGarage = true) {
    const selectable = isMarketable(item.status);
    const selected = state.selected.has(item.key);
    return `
      <tr data-unit-code="${escapeHtml(String(item.code))}">
        <td>
          <strong>${escapeHtml(itemLabel(item))}</strong>
          ${casaSuspensaTag(item) ? `<br><span class="casa-suspensa-tag">${CASA_SUSPENSA}</span>` : ""}
          ${otherTags(item).length ? `<br><small>${escapeHtml(otherTags(item).join(" · "))}</small>` : ""}
        </td>
        ${showArea ? `<td>${hasOwnArea(item) ? escapeHtml(item.area) : "—"}</td>` : ""}
        ${showGarage ? `<td>${escapeHtml(item.garage || "—")}</td>` : ""}
        <td><span class="status-pill status-${item.status}">${escapeHtml(STATUS_LABELS[item.status] || item.status)}</span></td>
        <td><strong class="price-value">${money(item.price)}</strong></td>
        <td><div class="unit-actions"><button class="unit-action" type="button" data-share-item="${item.key}">Compartilhar</button><button class="selection-control ${selected ? "selected" : ""}" type="button" data-select-item="${item.key}" ${selectable ? "" : "disabled"}>${selected ? "Selecionado" : "Selecionar"}</button></div></td>
      </tr>
    `;
  }

  function renderMobileUnit(item) {
    const selectable = isMarketable(item.status);
    const selected = state.selected.has(item.key);
    return `
      <article class="mobile-unit-card" data-unit-code="${escapeHtml(String(item.code))}">
        <div class="mobile-unit-line">
          <div class="mobile-unit-id">
            <strong>${escapeHtml(itemLabel(item))}</strong>
            <span class="status-pill status-${item.status}">${escapeHtml(STATUS_LABELS[item.status] || item.status)}</span>
          </div>
          <strong class="price-value mobile-unit-price">${money(item.price)}</strong>
        </div>
        ${casaSuspensaTag(item)
          ? `<p class="mobile-unit-casa"><span>${CASA_SUSPENSA}</span>${hasOwnArea(item) ? escapeHtml(item.area) : ""}</p>`
          : hasOwnArea(item) ? `<p class="mobile-unit-area">Esta unidade: ${escapeHtml(item.area)}</p>` : ""}
        ${otherTags(item).length ? `<p class="mobile-unit-tags">${escapeHtml(otherTags(item).join(" · "))}</p>` : ""}
        <div class="mobile-unit-actions"><button class="unit-action" type="button" data-share-item="${item.key}">Compartilhar</button><button class="selection-control ${selected ? "selected" : ""}" type="button" data-select-item="${item.key}" ${selectable ? "" : "disabled"}>${selected ? "Selecionado" : "Selecionar"}</button></div>
      </article>
    `;
  }

  function renderLandInventory(emp, focusItems = null) {
    const focusKeys = focusItems ? new Set(focusItems.map((f) => f.key)) : null;
    const items = focusKeys ? itemsFor(emp).filter((it) => focusKeys.has(it.key)) : itemsFor(emp);
    return `
      <section class="content-section" id="unidades">
        <div class="section-title-row"><h2>Lotes e valores</h2><p>Disponibilidade por quadra e lote</p></div>
        ${CLIENT_MODE ? "" : `<div class="inventory-toolbar"><p>${marketableItems(emp).length} opções comercializáveis nesta tabela.</p></div>`}
        <table class="units-table">
          <thead><tr><th>Lote</th><th>Área</th><th>Rua</th><th>Status</th><th>Valor</th><th></th></tr></thead>
          <tbody>${items.map((item) => renderOpportunityRow(item, item.rua)).join("")}</tbody>
        </table>
        <div class="mobile-units">${items.map((item) => renderMobileOpportunity(item, item.rua)).join("")}</div>
      </section>
    `;
  }

  function renderOtherInventory(emp, focusItems = null) {
    const focusKeys = focusItems ? new Set(focusItems.map((f) => f.key)) : null;
    const items = focusKeys ? itemsFor(emp).filter((it) => focusKeys.has(it.key)) : itemsFor(emp);
    return `
      <section class="content-section" id="unidades">
        <div class="section-title-row"><h2>Imóveis disponíveis</h2><p>Oportunidades complementares</p></div>
        ${CLIENT_MODE ? "" : `<div class="inventory-toolbar"><p>${marketableItems(emp).length} opções comercializáveis nesta tabela.</p></div>`}
        <table class="units-table">
          <thead><tr><th>Imóvel</th><th>Área</th><th>Local</th><th>Status</th><th>Valor</th><th></th></tr></thead>
          <tbody>${items.map((item) => renderOpportunityRow(item, item.local, item.description)).join("")}</tbody>
        </table>
        <div class="mobile-units">${items.map((item) => renderMobileOpportunity(item, item.local, item.description)).join("")}</div>
      </section>
    `;
  }

  function renderOpportunityRow(item, secondary, description = "") {
    const selectable = isMarketable(item.status);
    const selected = state.selected.has(item.key);
    return `
      <tr data-unit-code="${escapeHtml(String(item.code))}">
        <td><strong>${escapeHtml(itemLabel(item))}</strong>${description ? `<br><small>${escapeHtml(description)}</small>` : ""}</td>
        <td>${escapeHtml(item.area || "—")}</td>
        <td>${escapeHtml(secondary || "—")}</td>
        <td><span class="status-pill status-${item.status}">${escapeHtml(STATUS_LABELS[item.status] || item.status)}</span></td>
        <td><strong class="price-value">${item.pricePrefix ? `${escapeHtml(item.pricePrefix)} ` : ""}${money(item.price)}</strong></td>
        <td><div class="unit-actions"><button class="unit-action" type="button" data-share-item="${item.key}">Compartilhar</button><button class="selection-control ${selected ? "selected" : ""}" type="button" data-select-item="${item.key}" ${selectable ? "" : "disabled"}>${selected ? "Selecionado" : "Selecionar"}</button></div></td>
      </tr>
    `;
  }

  function renderMobileOpportunity(item, secondary, description = "") {
    const selectable = isMarketable(item.status);
    const selected = state.selected.has(item.key);
    return `
      <article class="mobile-unit-card" data-unit-code="${escapeHtml(String(item.code))}">
        <div class="mobile-unit-head"><strong>${escapeHtml(itemLabel(item))}</strong><span class="status-pill status-${item.status}">${escapeHtml(STATUS_LABELS[item.status] || item.status)}</span></div>
        ${description ? `<p class="mobile-unit-note">${escapeHtml(description)}</p>` : ""}
        <div class="mobile-unit-meta">
          <div><span>Área</span><strong>${escapeHtml(item.area || "—")}</strong></div>
          <div><span>Valor</span><strong class="price-value">${item.pricePrefix ? `${escapeHtml(item.pricePrefix)} ` : ""}${money(item.price)}</strong></div>
        </div>
        <div class="mobile-unit-actions"><button class="unit-action" type="button" data-share-item="${item.key}">Compartilhar</button><button class="selection-control ${selected ? "selected" : ""}" type="button" data-select-item="${item.key}" ${selectable ? "" : "disabled"}>${selected ? "Selecionado" : "Selecionar"}</button></div>
      </article>
    `;
  }

  function bindInventoryEvents(root) {
    root.querySelectorAll("[data-share-item]").forEach((button) => button.addEventListener("click", () => openSendChoice(itemMap.get(button.dataset.shareItem))));
    root.querySelectorAll("[data-select-item]").forEach((button) => button.addEventListener("click", () => toggleSelection(button.dataset.selectItem)));
  }

  function enterpriseMessage(emp, includePrices) {
    const lines = [
      `*${emp.nome} — Construtora Senger*`,
      emp.cidade,
      emp.tagline || emp.entrega || "",
      "",
    ];
    // v99 — a mensagem NAO diz mais quantas opcoes existem na tabela. Anunciar
    // "43 opcoes comercializaveis" tirava a urgencia da venda: passava a ideia de
    // que sobra escolha e da pra decidir depois. Decisao do dono, vale para todos
    // os empreendimentos. A contagem segue na tela do corretor, que precisa dela.
    if (includePrices) {
      lines.push(`Valores a partir de: *${minPrice(emp) ? money(minPrice(emp)) : "sob consulta"}*`);
    } else {
      lines.push("Consulte valores e condições.");
    }
    if (emp.entrega) lines.push(`Entrega: ${semPonto(emp.entrega)}`);
    lines.push("", `Tabela ${META.mesTabela || ""}. Valores e disponibilidade sujeitos a alteração.`);
    return lines.filter((line, index, array) => line !== "" || array[index - 1] !== "").join("\n");
  }

  // Resumo do portfolio para o cliente que ainda nao sabe o que quer:
  // nome, cidade, prazo de entrega e valor inicial de cada empreendimento.
  // v90 — a lista vai como LINK, no mesmo molde dos links de empreendimento e de unidade.
  // O texto antigo (um bloco com todos os empreendimentos) saia no WhatsApp com a foto SO do
  // primeiro e os demais sem imagem — o proprio dono vetou ("nao da pra mandar isso nunca").
  // Agora: mensagem curta + link; o cliente abre a vitrine com todos, cada um com a sua foto.
  function listClientLink(enterprises) {
    const ids = enterprises.map((emp) => emp.id).join(",");
    return `${location.origin}${location.pathname}?cliente&lista=${ids}`;
  }

  function carregarImagem(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // v92 — a imagem da mensagem e um BANNER DE FAIXAS DIAGONAIS (estilo escolhido pelo dono a
  // partir de um exemplo real de material de lancamento): as fachadas dividem a faixa em
  // diagonais separadas por filetes bronze, com o cabecalho da marca em serifada e o nome de
  // cada empreendimento discreto na base da faixa. SEM preco (decisao dele: valor fica pro
  // link e pra conversa). Qualquer quantidade fecha a linha sem sobrar espaco; ate 6 fotos —
  // com 7+, a ultima faixa vira "+N veja no link". Historico: a v90 mandava so a capa do
  // primeiro (vetado), a v91 usou cartoes claros (vetado como simples demais pra imovel de
  // R$ 1 milhao+).
  async function montarMosaicoLista(enterprises) {
    if (enterprises.length < 2) return null; // 1 so: a capa dele e a imagem certa
    const MAX = 6;
    const visiveis = enterprises.length > MAX ? enterprises.slice(0, MAX - 1) : enterprises.slice(0, MAX);
    const extras = enterprises.length - visiveis.length;
    const imgs = await Promise.all(visiveis.map((emp) => carregarImagem(assetUrl(cardImage(emp)))));
    const blocos = visiveis.map((emp, i) => ({ emp, img: imgs[i] })).filter((b) => b.img);
    if (blocos.length < 2) return null;
    const total = blocos.length + (extras > 0 ? 1 : 0);
    const SERIF = "Georgia, 'Times New Roman', serif";
    const SANS = "system-ui, -apple-system, sans-serif";
    const BRONZE = "#b08d57";
    const W = 1500, BANNER = 680, HEAD = 120, FOOT = 110, SKEW = 110, LINHA = 7;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = HEAD + BANNER + FOOT;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#14181c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f4efe8";
    ctx.font = `600 44px ${SERIF}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("Construtora Senger", W / 2, 52);
    ctx.font = `500 24px ${SANS}`;
    ctx.fillStyle = BRONZE;
    ctx.fillText("SELEÇÃO EXCLUSIVA DE EMPREENDIMENTOS", W / 2, 96);
    const y0 = HEAD, y1 = HEAD + BANNER;
    const passo = (W + SKEW) / total;
    const cover = (img, x, y, w, h) => {
      const s = Math.max(w / img.width, h / img.height);
      const iw = img.width * s, ih = img.height * s;
      ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    };
    const faixa = (i, pintar) => {
      const xTopo = -SKEW + i * passo, xBase = xTopo + SKEW;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xTopo + (i === 0 ? -SKEW : 0), y0);
      ctx.lineTo(xTopo + passo, y0);
      ctx.lineTo(xBase + passo, y1);
      ctx.lineTo(xBase + (i === 0 ? -SKEW : 0), y1);
      ctx.closePath();
      ctx.clip();
      pintar(xTopo, xBase);
      ctx.restore();
      if (i > 0) { // filete bronze na divisa
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xTopo - LINHA / 2, y0);
        ctx.lineTo(xTopo + LINHA / 2, y0);
        ctx.lineTo(xBase + LINHA / 2, y1);
        ctx.lineTo(xBase - LINHA / 2, y1);
        ctx.closePath();
        const lg = ctx.createLinearGradient(0, y0, 0, y1);
        lg.addColorStop(0, "#d8b87e");
        lg.addColorStop(0.5, "#b08d57");
        lg.addColorStop(1, "#d8b87e");
        ctx.fillStyle = lg;
        ctx.fill();
        ctx.restore();
      }
    };
    blocos.forEach((bloco, i) => faixa(i, (xTopo) => {
      cover(bloco.img, Math.max(0, xTopo - 140), y0, passo + 280, BANNER);
      const cx = xTopo + passo / 2 + SKEW / 2;
      const grad = ctx.createLinearGradient(0, y1 - 120, 0, y1);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,.78)");
      ctx.fillStyle = grad;
      ctx.fillRect(xTopo - SKEW, y1 - 120, passo + SKEW * 2, 120);
      ctx.fillStyle = "#f4efe8";
      ctx.textAlign = "center";
      ctx.font = `600 ${total > 4 ? 26 : 32}px ${SERIF}`;
      ctx.textBaseline = "bottom";
      ctx.fillText(bloco.emp.nome, cx, y1 - 18, passo - 30);
    }));
    if (extras > 0) faixa(total - 1, (xTopo) => {
      ctx.fillStyle = "#1d242c";
      ctx.fillRect(xTopo - SKEW, y0, passo + SKEW * 2, BANNER);
      // centro recuado da borda pra caber o "veja no link" inteiro na ultima faixa
      const cx = Math.min(xTopo + passo / 2 + SKEW / 2, W - 130);
      ctx.fillStyle = "#f4efe8";
      ctx.textAlign = "center";
      ctx.font = `700 96px ${SERIF}`;
      ctx.textBaseline = "middle";
      ctx.fillText(`+${extras}`, cx, y0 + BANNER / 2 - 26);
      ctx.fillStyle = BRONZE;
      ctx.font = `500 28px ${SANS}`;
      ctx.fillText("veja no link", cx, y0 + BANNER / 2 + 48);
    });
    ctx.fillStyle = BRONZE;
    ctx.fillRect(0, y1, W, 3);
    ctx.fillStyle = "#9aa4ab";
    ctx.textAlign = "center";
    ctx.font = `500 26px ${SANS}`;
    ctx.textBaseline = "middle";
    ctx.fillText("Fotos, valores e disponibilidade no link", W / 2, y1 + FOOT / 2 + 2);
    ctx.textAlign = "left";
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ? new File([blob], "selecao-senger.jpg", { type: "image/jpeg" }) : null;
  }

  async function sharePortfolio() {
    const enterprises = portfolioList();
    if (!enterprises.length) return;
    const nomes = enterprises.map((emp) => emp.nome);
    const resumoNomes = nomes.length <= 3 ? nomes.join(", ") : `${nomes.slice(0, 3).join(", ")} e mais ${nomes.length - 3}`;
    const text = [
      `*Construtora Senger — Seleção de ${enterprises.length === 1 ? "empreendimento" : "empreendimentos"}*`,
      resumoNomes,
      "",
      "👇 Clique no link abaixo para ver cada um com fotos, valores e disponibilidade:",
      listClientLink(enterprises),
    ].join("\n");
    const title = "Seleção Construtora Senger";
    if (navigator.share) {
      const file = enterprises.length === 1
        ? await loadShareFile(assetUrl(cardImage(enterprises[0])))
        : await montarMosaicoLista(enterprises);
      if (file && navigator.canShare && navigator.canShare({ title, text, files: [file] })) {
        try { await navigator.share({ title, text, files: [file] }); return; }
        catch (error) { if (error?.name === "AbortError") return; }
      }
      // Sem mosaico, melhor SEM foto do que com a foto de um so (a previa do link mostra a
      // imagem generica da marca — neutra, nao engana o cliente).
      try { await navigator.share({ title, text }); return; }
      catch (error) { if (error?.name === "AbortError") return; }
    }
    openShareModal(text, enterprises.map(coverPhoto));
  }

  const semPonto = (texto = "") => String(texto).trim().replace(/\.$/, "");

  // "172 m² global · 132 m² privativo" -> "172m² global e 132m² privativos"
  function areaResumo(area = "") {
    const g = String(area).match(/([\d.,]+)\s*m²\s*global/i);
    const p = String(area).match(/([\d.,]+)\s*m²\s*privativ/i);
    if (g && p) return `${g[1]}m² global e ${p[1]}m² privativos`;
    if (g) return `${g[1]}m² global`;
    if (p) return `${p[1]}m² privativos`;
    return String(area).trim();
  }

  // 902 -> 9, 1302 -> 13, 802A -> 8. Sem andar para salas e terrenos.
  function andarDe(codigo) {
    const m = String(codigo).match(/^(\d+)\d{2}[A-Za-z]?$/);
    return m ? Number(m[1]) : null;
  }

  // "Outros Imóveis" e um agrupamento, nao um predio: a unidade fala por si.
  const titulo = (item) => (item.emp.id === "outros"
    ? `*${itemLabel(item)}*`
    : `*${item.emp.nome} — ${itemLabel(item)}*`);

  // A localizacao ja traz a cidade; usa-la evita repetir "Carazinho" no titulo.
  const ondeFica = (item) => (item.emp.id === "outros" ? item.local : item.emp.localizacao) || item.emp.cidade;

  function itemBullets(item) {
    const bullets = [];
    // "Casa Suspensa" e nome de produto: mantem as maiusculas na mensagem.
    const etiquetas = (item.tags || []).map((t) => (isCasaSuspensa(t) ? CASA_SUSPENSA : t.toLowerCase()));
    // A linha do prazo de entrega ja diz se e novo, pronto ou pre-lancamento:
    // aqui so entram os status que mudam a oferta (reservado, vendido, alugado).
    const cond = item.status !== "disponivel" ? (STATUS_LABELS[item.status] || item.status).toLowerCase() : "";
    const primeiro = [cond, ...etiquetas].filter(Boolean).join(" e ");
    if (primeiro) bullets.push(primeiro.replace(/^./, (c) => c.toUpperCase()));

    const tipo = item.group?.tipo;
    const privativa = item.area ? areaResumo(item.area) : "";
    if (tipo && privativa) bullets.push(`${tipo}, ${privativa}`);
    else if (tipo) bullets.push(tipo);
    else if (privativa) bullets.push(privativa);

    // Box opcional nao acompanha a unidade; o valor sem box ja e informado no rodape.
    if (item.garage && !/opcional|consultar/i.test(item.garage)) bullets.push(item.garage);
    const andar = andarDe(item.code);
    if (andar) bullets.push(`${andar}º andar`);
    if (item.rua) bullets.push(`Rua ${item.rua}`);
    if (item.local && item.emp.id !== "outros") bullets.push(item.local);
    if (item.description) bullets.push(semPonto(item.description));

    // Diferenciais marcados com naMensagem: false descrevem outras unidades do predio.
    (item.emp.diferenciais || [])
      .filter((d) => d.naMensagem !== false)
      .forEach((d) => bullets.push(semPonto(d.desc)));
    return bullets;
  }

  function itemMessage(item, includePrice) {
    const emp = item.emp;
    const lines = [titulo(item), semPonto(ondeFica(item)) + "."];

    // Prazo de entrega logo no topo: data prevista, "Pronto para morar" ou "Pre-lancamento".
    const prazo = emp.id !== "outros" ? semPonto(emp.entrega || emp.statusLabel || "") : "";
    if (prazo) lines.push(`🗓️ ${prazo}`);
    lines.push("");

    itemBullets(item).forEach((b) => lines.push(`✅ ${b}`));
    lines.push("");

    // Observacoes ficam coladas no valor: elas explicam o que o preco inclui.
    if (includePrice) lines.push(`💰 *${money(item.price)}*`);
    else lines.push("💰 Valor sob consulta.");

    if (emp.condicoes) lines.push(semPonto(emp.condicoes) + ".");
    if (item.notes) lines.push(semPonto(item.notes) + ".");
    lines.push("", `Tabela ${META.mesTabela || ""}. Valores e disponibilidade sujeitos a alteração.`);
    return lines.join("\n");
  }

  // photos: [{ src, nome }] — uma por empreendimento presente na mensagem.
  function openShareModal(text, photos = []) {
    const modal = document.getElementById("share-modal");
    const textarea = document.getElementById("share-modal-text");
    const list = document.getElementById("share-modal-photos");
    const hint = document.getElementById("share-modal-hint");
    textarea.value = text;
    document.getElementById("share-modal-copy").textContent = "Copiar mensagem";

    list.innerHTML = photos.map((photo, index) => `
      <div class="share-photo-row">
        <img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.nome)}" loading="lazy">
        <div class="share-photo-info">
          <span class="share-photo-name">${escapeHtml(photo.nome)}</span>
          <div class="share-photo-buttons">
            ${canCopyImage() ? `<button class="button button-primary" type="button" data-copy-photo="${index}">Copiar foto</button>` : ""}
            <a class="button button-outline" href="${escapeHtml(photo.src)}" download>Baixar</a>
          </div>
        </div>
      </div>
    `).join("");
    list.hidden = !photos.length;
    list.querySelectorAll("[data-copy-photo]").forEach((button) => {
      button.addEventListener("click", () => copySharePhoto(photos[Number(button.dataset.copyPhoto)].src, button));
    });
    hint.textContent = photos.length > 1
      ? `São ${photos.length} empreendimentos: copie e cole cada foto no WhatsApp, depois cole a mensagem.`
      : "No WhatsApp: cole a foto primeiro, depois cole a mensagem na legenda.";

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }

const canCopyImage = () => Boolean(window.ClipboardItem && navigator.clipboard?.write);

  // WhatsApp Web aceita imagem colada; o PNG e o formato que a area de
  // transferencia do navegador aceita de forma confiavel.
  async function copySharePhoto(src, button) {
    if (!src || !canCopyImage()) return;
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = src;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("sem blob");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      button.textContent = "Copiada!";
      showToast("Foto copiada. Cole no WhatsApp.");
    } catch (_) {
      showToast("Não foi possível copiar a foto. Use \"Baixar\".");
    }
  }

  function closeShareModal() {
    const modal = document.getElementById("share-modal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  }

  function copyShareModalText() {
    const textarea = document.getElementById("share-modal-text");
    const copyButton = document.getElementById("share-modal-copy");
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    let copied = false;
    try { copied = document.execCommand("copy"); } catch (_) { copied = false; }
    if (copied) {
      copyButton.textContent = "Copiado!";
      showToast("Mensagem copiada.");
      return;
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textarea.value).then(() => {
        copyButton.textContent = "Copiado!";
        showToast("Mensagem copiada.");
      }).catch(() => showToast("Selecione o texto acima e copie manualmente."));
      return;
    }
    showToast("Selecione o texto acima e copie manualmente.");
  }

  async function loadShareFile(imageUrl) {
    if (!imageUrl || !navigator.canShare) return null;
    try {
      const blob = await (await fetch(imageUrl)).blob();
      return new File([blob], "foto.jpg", { type: blob.type || "image/jpeg" });
    } catch (_) {
      return null;
    }
  }

  async function sendShare(text, title = "Construtora Senger", photos = []) {
    const imageUrl = photos[0]?.src || "";
    if (navigator.share) {
      const file = await loadShareFile(imageUrl);
      if (file && navigator.canShare({ title, text, files: [file] })) {
        try {
          await navigator.share({ title, text, files: [file] });
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      try {
        await navigator.share({ title, text });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    openShareModal(text, photos);
  }

  const coverPhoto = (emp) => ({ src: assetUrl(cardImage(emp)), nome: emp.nome });

  // Uma foto por empreendimento, sem repetir quando ha varias unidades do mesmo.
  function coverPhotosFor(items) {
    const seen = new Set();
    return items.reduce((photos, item) => {
      if (!seen.has(item.emp.id)) { seen.add(item.emp.id); photos.push(coverPhoto(item.emp)); }
      return photos;
    }, []);
  }

  // v100 — o link do cliente passa por uma pagina-ponte (l/<empreendimento>/).
  // Ela existe so pra fazer a foto certa aparecer na previa do WhatsApp: o robo
  // que monta essa previa nao roda o JavaScript do site, entao, lendo o
  // index.html unico do portfolio, ele nunca saberia se o link e do Renaissance
  // ou do Boulevard — mostraria sempre a mesma foto generica. A ponte e um
  // arquivo por empreendimento, com o nome e a foto daquele predio escritos
  // dentro, e redireciona na hora pro endereco de sempre, com os mesmos
  // parametros. Gerada por tools/gerar-pontes.js; rodar apos mexer em data.js.
  function pontePara(empId, query = "") {
    const raiz = location.pathname.replace(/\/[^/]*$/, "/");
    return `${location.origin}${raiz}l/${empId}/${query ? `?${query}` : ""}`;
  }

  function clientLinkFor(emp) {
    return pontePara(emp.id);
  }

  // Envia o link travado no empreendimento, com a foto de capa e um texto
  // explicando o que fazer. O cliente ve fotos, plantas e opcoes, sem
  // conseguir navegar para o resto do portfolio.
  async function shareClientLink(emp) {
    const url = clientLinkFor(emp);
    const text = [
      `*${emp.nome} — Construtora Senger*`,
      emp.cidade,
      "",
      "👇 Clique no link abaixo para ver fotos, plantas, valores e todas as informações:",
      url,
    ].join("\n");
    if (navigator.share) {
      const file = await loadShareFile(assetUrl(cardImage(emp)));
      if (file && navigator.canShare({ text, files: [file] })) {
        try {
          await navigator.share({ title: emp.nome, text, files: [file] });
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      try {
        await navigator.share({ title: emp.nome, text });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    openShareModal(text, [coverPhoto(emp)]);
  }

  function shareEnterprise(emp, includePrices) {
    if (!emp) return;
    sendShare(enterpriseMessage(emp, includePrices), emp.nome, [coverPhoto(emp)]);
  }

  function shareItem(item, includePrice) {
    if (!item) return;
    sendShare(itemMessage(item, includePrice), `${item.emp.nome} — ${itemLabel(item)}`, [coverPhoto(item.emp)]);
  }

  // Link do modo cliente apontando para a unidade: abre o empreendimento
  // travado e rola ate a linha do apartamento, destacada.
  async function shareUnitLink(item) {
    const emp = item.emp;
    const url = pontePara(emp.id, `u=${encodeURIComponent(item.code)}`);
    const text = [
      `*${emp.nome} — ${itemLabel(item)}*`,
      emp.cidade,
      "",
      "👇 Clique no link abaixo para ver fotos, planta, valores e todas as informações desta unidade:",
      url,
    ].join("\n");
    if (navigator.share) {
      const file = await loadShareFile(assetUrl(cardImage(emp)));
      if (file && navigator.canShare({ text, files: [file] })) {
        try {
          await navigator.share({ title: `${emp.nome} — ${itemLabel(item)}`, text, files: [file] });
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      try {
        await navigator.share({ title: `${emp.nome} — ${itemLabel(item)}`, text });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    openShareModal(text, [coverPhoto(emp)]);
  }

  function openSendChoice(item) {
    if (!item) return;
    const modal = document.getElementById("send-choice");
    document.getElementById("send-choice-title").textContent = `${item.emp.nome} — ${itemLabel(item)}`;
    const message = document.getElementById("choice-message");
    const link = document.getElementById("choice-link");
    message.onclick = () => { closeSendChoice(); shareItem(item, true); };
    link.onclick = () => { closeSendChoice(); shareUnitLink(item); };
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeSendChoice() {
    const modal = document.getElementById("send-choice");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function toggleSelection(key) {
    const item = itemMap.get(key);
    if (!item || !isMarketable(item.status)) return;
    if (state.selected.has(key)) state.selected.delete(key);
    else state.selected.add(key);
    saveSelection();
    updateSelectionUi();

    document.querySelectorAll("[data-select-item]").forEach((button) => {
      if (button.dataset.selectItem !== key) return;
      const selected = state.selected.has(key);
      button.classList.toggle("selected", selected);
      button.textContent = selected ? "Selecionado" : "Selecionar";
    });
    showToast(state.selected.has(key) ? "Imóvel adicionado à seleção." : "Imóvel removido da seleção.");
  }

  function saveSelection() {
    storage.set("senger-selection", JSON.stringify([...state.selected]));
  }

  function updateSelectionUi() {
    const count = state.selected.size;
    const fab = document.getElementById("selection-fab");
    fab.hidden = count === 0;
    setText("selection-count", count);

    const list = document.getElementById("selection-list");
    if (!count) {
      list.innerHTML = `<div class="drawer-empty"><strong>Nenhum imóvel selecionado.</strong><p>Use o botão “Selecionar” nas unidades para montar uma apresentação rápida.</p></div>`;
    } else {
      list.innerHTML = [...state.selected].map((key) => {
        const item = itemMap.get(key);
        if (!item) return "";
        return `<div class="drawer-item"><div><strong>${escapeHtml(item.emp.nome)} · ${escapeHtml(itemLabel(item))}</strong><span>${escapeHtml(item.area || item.group?.tipo || item.local || "")}</span><span class="price-value">${money(item.price)}</span></div><button class="drawer-remove" type="button" data-remove-selection="${item.key}">Remover</button></div>`;
      }).join("");
      list.querySelectorAll("[data-remove-selection]").forEach((button) => button.addEventListener("click", () => toggleSelection(button.dataset.removeSelection)));
    }
  }

  function selectedItems() {
    return [...state.selected].map((key) => itemMap.get(key)).filter(Boolean);
  }

  function shareSelection(includePrices) {
    const items = selectedItems();
    if (!items.length) return;
    sendShare(selectedMessage(includePrices), "Seleção de imóveis", coverPhotosFor(items));
  }

  // v94 — a selecao tambem vai como LINK (mesma janela que uma unidade sozinha ja tinha):
  // o cliente abre a vitrine so com os empreendimentos escolhidos e, dentro de cada um,
  // so as unidades selecionadas. Um empreendimento so: o link ja abre direto nele.
  async function shareSelectionLink() {
    const items = selectedItems();
    if (!items.length) return;
    closeDrawer();
    const emps = [];
    const vistos = new Set();
    items.forEach((item) => { if (!vistos.has(item.emp.id)) { vistos.add(item.emp.id); emps.push(item.emp); } });
    const sel = items.map((item) => `${item.emp.id}~${encodeURIComponent(String(item.code))}`).join(",");
    // Um empreendimento so: vai pela ponte dele, e a previa mostra a foto certa.
    // Varios: nao ha uma foto unica que represente todos, entao segue direto —
    // e a mensagem ja leva as capas de cada um como anexo separado.
    const url = emps.length === 1
      ? pontePara(emps[0].id, `sel=${sel}`)
      : `${location.origin}${location.pathname}?cliente&sel=${sel}`;
    const linhas = [`*Construtora Senger — Seleção de ${items.length === 1 ? "imóvel" : "imóveis"}*`, ""];
    items.forEach((item) => linhas.push(`• ${item.emp.nome} — ${itemLabel(item)}`));
    linhas.push("", "👇 Clique no link abaixo para ver fotos, plantas, valores e todas as informações:", url);
    const text = linhas.join("\n");
    const title = "Seleção Construtora Senger";
    if (navigator.share) {
      const file = emps.length === 1
        ? await loadShareFile(assetUrl(cardImage(emps[0])))
        : await montarMosaicoLista(emps);
      if (file && navigator.canShare && navigator.canShare({ title, text, files: [file] })) {
        try { await navigator.share({ title, text, files: [file] }); return; }
        catch (error) { if (error?.name === "AbortError") return; }
      }
      try { await navigator.share({ title, text }); return; }
      catch (error) { if (error?.name === "AbortError") return; }
    }
    openShareModal(text, emps.map(coverPhoto));
  }

  function selectedMessage(includePrices) {
    const items = selectedItems();
    const lines = ["*Seleção de imóveis — Construtora Senger*", ""];
    items.forEach((item, index) => {
      lines.push(`*${index + 1}. ${item.emp.nome} — ${itemLabel(item)}*`);
      if (item.group?.tipo) lines.push(item.group.tipo);
      if (item.area) lines.push(`Área: ${item.area}`);
      if (item.garage) lines.push(`Garagem: ${item.garage}`);
      if (item.rua) lines.push(`Localização: ${item.rua}`);
      const prazo = item.emp.id !== "outros" ? semPonto(item.emp.entrega || item.emp.statusLabel || "") : "";
      if (prazo) lines.push(`Entrega: ${prazo}`);
      lines.push(includePrices ? `Valor: *${money(item.price)}*` : "Valor: consulte a equipe comercial");
      lines.push("");
    });
    lines.push(`Tabela ${META.mesTabela || ""}. Valores e disponibilidade sujeitos a alteração.`);
    return lines.join("\n");
  }

  function openDrawer() {
    const drawer = document.getElementById("selection-drawer");
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }

  function closeDrawer() {
    const drawer = document.getElementById("selection-drawer");
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  }

  let toastTimer;
  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function loadAllImages(timeout = 8000) {
    const images = Array.from(document.querySelectorAll("img")).filter((img) => !img.complete || img.naturalWidth === 0);
    images.forEach((img) => {
      img.loading = "eager";
      img.removeAttribute("loading");
      if (!img.complete) img.src = img.src;
    });
    if (!images.length) return Promise.resolve();
    const ready = Promise.all(images.map((img) => new Promise((resolve) => {
      if (img.complete && img.naturalWidth) return resolve();
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    })));
    return Promise.race([ready, new Promise((resolve) => setTimeout(resolve, timeout))]);
  }

  // Folha exclusiva do PDF: capa de cada empreendimento, prazo de entrega e valor inicial.
  function buildPrintSheet(enterprises) {
    const contato = [META.contato?.telefones?.[0], META.contato?.instagram, META.contato?.site].filter(Boolean).join(" · ");
    const cidades = unique(enterprises.flatMap((emp) => emp.cidade.split(" · ")))
      .map((city) => city.replace("/RS", "")).join(" · ");

    const cards = enterprises.map((emp) => {
      const minimo = minPrice(emp);
      const opcoes = marketableItems(emp).length;
      const prazo = semPonto(emp.entrega || emp.statusLabel || "");
      return `
        <article class="ps-card">
          <div class="ps-media"><img src="${escapeHtml(assetUrl(cardImage(emp)))}" alt="${escapeHtml(emp.nome)}"></div>
          <div class="ps-body">
            <div class="ps-badges">
              <span class="ps-badge ps-badge-stage">${escapeHtml(emp.statusLabel || prazo)}</span>
              <span class="ps-badge">${escapeHtml(CATEGORY_LABELS[emp.categoria] || emp.categoria)}</span>
            </div>
            <h2>${escapeHtml(emp.nome)}</h2>
            <p class="ps-city">${escapeHtml(emp.cidade)}</p>
            <p class="ps-tagline">${escapeHtml(emp.tagline || "")}</p>
            <div class="ps-facts">
              <div class="ps-fact-wide"><span>Entrega</span><strong>${escapeHtml(prazo || "Consultar")}</strong></div>
              <div class="ps-fact-row">
                <div><span>A partir de</span><strong>${minimo ? money(minimo) : "Sob consulta"}</strong></div>
                <div><span>Opções</span><strong>${opcoes}</strong></div>
              </div>
            </div>
          </div>
        </article>
      `;
    });

    // Paginacao explicita (a quebra automatica do Chrome e imprevisivel):
    // 2 cartoes por linha, 3 linhas por pagina A4.
    const rows = [];
    for (let i = 0; i < cards.length; i += 2) rows.push(`<div class="ps-row">${cards[i]}${cards[i + 1] || ""}</div>`);
    const pages = [];
    for (let i = 0; i < rows.length; i += 3) pages.push(`<div class="ps-page">${rows.slice(i, i + 3).join("")}</div>`);

    setHtml("print-sheet", `
      <header class="ps-head">
        <img class="ps-logo" src="${escapeHtml(assetUrl("assets/senger-logo.png"))}" alt="Construtora Senger">
        <div>
          <p class="ps-eyebrow">Portfólio comercial</p>
          <h1>Empreendimentos e oportunidades</h1>
          <p class="ps-meta">Tabela ${escapeHtml(META.mesTabela || "")}${cidades ? ` · ${escapeHtml(cidades)}` : ""}</p>
          <p class="ps-contact">${contato ? `${escapeHtml(contato)} — ` : ""}Valores e disponibilidade sujeitos a alteração sem aviso prévio. Imagens meramente ilustrativas.</p>
        </div>
      </header>
      ${pages.join("")}
    `);
  }

  // Folha A4 de um empreendimento: fotos lado a lado (2 por linha) e
  // plantas em tamanho grande, uma por linha — pensado para leitura em PDF.
  function buildEnterprisePrintSheet(emp) {
    const contato = [META.contato?.telefones?.[0], META.contato?.instagram, META.contato?.site].filter(Boolean).join(" · ");
    const prazo = semPonto(emp.entrega || emp.statusLabel || "");
    const minimo = minPrice(emp);
    const media = mediaFor(emp);
    const isPlant = (item) => /planta/i.test(`${item?.src || ""} ${item?.legenda || ""}`);
    const photos = media.filter((item) => !isPlant(item) && !/\.pdf(?:$|\?)/i.test(item.src || "")).slice(0, 8);
    const plants = media.filter((item) => isPlant(item) && !/\.pdf(?:$|\?)/i.test(item.src || ""));

    const photoRows = [];
    for (let i = 0; i < photos.length; i += 2) {
      photoRows.push(`<div class="ps-row">${photos.slice(i, i + 2).map((item) => `
        <figure class="ps-photo"><img src="${escapeHtml(assetUrl(item.src))}" alt="">${item.legenda ? `<figcaption>${escapeHtml(item.legenda)}</figcaption>` : ""}</figure>
      `).join("")}</div>`);
    }

    const plantBlocks = plants.map((item) => `
      <figure class="ps-plant"><img src="${escapeHtml(assetUrl(item.src))}" alt="">${item.legenda ? `<figcaption>${escapeHtml(item.legenda)}</figcaption>` : ""}</figure>
    `).join("");

    const groupTables = (emp.grupos || []).map((group, groupIndex) => {
      const units = (group.unidades || []).map((unit, unitIndex) => itemMap.get(`${emp.id}:unit:${groupIndex}:${unitIndex}`)).filter(Boolean);
      if (!units.length) return "";
      // v103 — no PDF a area do tipo tambem fica so na linha de resumo do grupo.
      const showArea = units.some((item) => hasOwnArea(item));
      return `
        <div class="ps-group">
          <h3>${escapeHtml(group.tipo)}</h3>
          <p class="ps-group-note">${escapeHtml([group.area, group.garagem, group.obs].filter(Boolean).join(" · "))}</p>
          <table class="ps-table">
            <thead><tr><th>Unidade</th>${showArea ? "<th>Área</th>" : ""}<th>Status</th><th>Valor</th></tr></thead>
            <tbody>${units.map((item) => `
              <tr><td>${escapeHtml(itemLabel(item))}${casaSuspensaTag(item) ? ` <b>· ${CASA_SUSPENSA}</b>` : ""}</td>${showArea ? `<td>${hasOwnArea(item) ? escapeHtml(item.area) : "—"}</td>` : ""}<td>${escapeHtml(STATUS_LABELS[item.status] || item.status)}</td><td>${money(item.price)}</td></tr>
            `).join("")}</tbody>
          </table>
        </div>
      `;
    }).join("");

    const landTable = (emp.terrenos || []).length ? `
      <div class="ps-group">
        <h3>Lotes</h3>
        <table class="ps-table">
          <thead><tr><th>Quadra · Lote</th><th>Rua</th><th>Área</th><th>Valor</th></tr></thead>
          <tbody>${itemsFor(emp).filter((item) => item.kind === "land").map((item) => `
            <tr><td>${escapeHtml(itemLabel(item))}</td><td>${escapeHtml(item.rua || "—")}</td><td>${escapeHtml(item.area || "—")}</td><td>${money(item.price)}</td></tr>
          `).join("")}</tbody>
        </table>
      </div>
    ` : "";

    const diffs = (emp.diferenciais || []).map((d) => `
      <div class="ps-diff"><strong>${escapeHtml(d.titulo)}</strong><span>${escapeHtml(d.desc)}</span></div>
    `).join("");

    setHtml("print-sheet", `
      <header class="ps-head">
        <img class="ps-logo" src="${escapeHtml(assetUrl("assets/senger-logo.png"))}" alt="Construtora Senger">
        <div>
          <p class="ps-eyebrow">${escapeHtml(emp.cidade)} · ${escapeHtml(CATEGORY_LABELS[emp.categoria] || emp.categoria)}</p>
          <h1>${escapeHtml(emp.nome)}</h1>
          <p class="ps-meta">${escapeHtml(prazo)}${minimo ? ` · A partir de ${money(minimo)}` : ""} · Tabela ${escapeHtml(META.mesTabela || "")}</p>
          <p class="ps-contact">${contato ? `${escapeHtml(contato)} — ` : ""}Valores e disponibilidade sujeitos a alteração sem aviso prévio. Imagens meramente ilustrativas.</p>
        </div>
      </header>
      ${emp.localizacao ? `<p class="ps-address">${escapeHtml(emp.localizacao)}</p>` : ""}
      ${diffs ? `<div class="ps-diffs">${diffs}</div>` : ""}
      ${groupTables || landTable ? `<h2 class="ps-section">Unidades e valores</h2>${groupTables}${landTable}` : ""}
      ${photoRows.length ? `<h2 class="ps-section">Imagens</h2>${photoRows.join("")}` : ""}
      ${plantBlocks ? `<h2 class="ps-section">Plantas</h2>${plantBlocks}` : ""}
    `);
  }

  let printing = false;

  async function printEnterprise(emp, event) {
    buildEnterprisePrintSheet(emp);
    document.body.classList.add("print-list");
    try {
      await printDocument(event);
    } finally {
      document.body.classList.remove("print-list");
    }
  }

  // Impressao pelo menu do navegador (sem passar pelo botao): monta a folha
  // certa na hora — portfolio na home, empreendimento no detalhe.
  window.addEventListener("beforeprint", () => {
    if (document.body.classList.contains("print-list")) return;
    const match = location.hash.match(/^#emp-([\w-]+)/);
    const emp = match ? findEnterprise(match[1]) : null;
    if (emp) buildEnterprisePrintSheet(emp);
    else buildPrintSheet(portfolioList());
    document.body.classList.add("print-list");
    window.addEventListener("afterprint", () => document.body.classList.remove("print-list"), { once: true });
  });

  async function printPortfolio(event) {
    const enterprises = portfolioList();
    if (!enterprises.length) return;
    buildPrintSheet(enterprises);
    document.body.classList.add("print-list");
    try {
      await printDocument(event);
    } finally {
      document.body.classList.remove("print-list");
    }
  }

  async function printDocument(event) {
    if (printing) return;
    printing = true;
    const button = event?.currentTarget;
    const label = button ? button.textContent : "";
    if (button) {
      button.disabled = true;
      button.textContent = "Preparando…";
    }
    try {
      showToast("Carregando as imagens para o PDF…");
      await loadAllImages();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.print();
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = label;
      }
      printing = false;
    }
  }

  // Instalacao como app (PWA). O navegador dispara beforeinstallprompt quando
  // da para instalar — e nunca dispara se o app ja esta instalado ou se a
  // pagina ja abriu pelo app, entao o aviso some sozinho nesses casos.
  let installPrompt = null;
  const INSTALL_DISMISS_KEY = "senger-install-adiado";
  const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    if (CLIENT_MODE || isStandalone()) return;
    const adiadoEm = Number(storage.get(INSTALL_DISMISS_KEY, "0"));
    if (adiadoEm && Date.now() - adiadoEm < 7 * 24 * 60 * 60 * 1000) return;
    installPrompt = event;
    document.getElementById("install-banner").hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    document.getElementById("install-banner").hidden = true;
    installPrompt = null;
    showToast("Aplicativo instalado! Procure o ícone Senger na tela inicial.");
  });

  // iPhone/iPad: o Safari NUNCA dispara beforeinstallprompt — a Apple so permite
  // instalacao manual (Compartilhar → Adicionar a Tela de Inicio). Entao la o mesmo
  // aviso aparece, mas ensinando o caminho em vez de oferecer um botao que nao existe.
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function mostrarDicaInstalacaoIOS() {
    if (!isIOS() || CLIENT_MODE || isStandalone()) return;
    const adiadoEm = Number(storage.get(INSTALL_DISMISS_KEY, "0"));
    if (adiadoEm && Date.now() - adiadoEm < 7 * 24 * 60 * 60 * 1000) return;
    const banner = document.getElementById("install-banner");
    banner.querySelector("strong").textContent = "Adicionar à tela inicial";
    banner.querySelector("span").innerHTML =
      "Toque em <strong>Compartilhar</strong> <span aria-hidden=\"true\">(&#x2BAD;)</span> " +
      "e depois em <strong>&ldquo;Adicionar à Tela de Início&rdquo;</strong>.";
    document.getElementById("install-app").hidden = true;
    banner.hidden = false;
  }

  function bindInstallEvents() {
    document.getElementById("install-app").addEventListener("click", async () => {
      if (!installPrompt) return;
      document.getElementById("install-banner").hidden = true;
      installPrompt.prompt();
      try { await installPrompt.userChoice; } catch (_) { /* usuario fechou o dialogo */ }
      installPrompt = null;
    });
    const adiar = () => {
      document.getElementById("install-banner").hidden = true;
      storage.set(INSTALL_DISMISS_KEY, String(Date.now()));
    };
    document.getElementById("install-dismiss").addEventListener("click", adiar);
    const depois = document.getElementById("install-later");
    if (depois) depois.addEventListener("click", adiar);
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setHtml(id, value) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = value;
  }

  function bindGlobalEvents() {
    bindInstallEvents();
    mostrarDicaInstalacaoIOS();
    document.getElementById("brand-home").addEventListener("click", navigateHome);
    document.getElementById("print-catalog").addEventListener("click", printPortfolio);
    document.getElementById("print-list").addEventListener("click", printPortfolio);
    document.getElementById("share-portfolio").addEventListener("click", sharePortfolio);
    document.getElementById("clear-picks").addEventListener("click", clearPicks);
    document.getElementById("selection-fab").addEventListener("click", openDrawer);
    document.querySelectorAll("[data-close-drawer]").forEach((button) => button.addEventListener("click", closeDrawer));
    document.getElementById("clear-selection").addEventListener("click", () => {
      state.selected.clear();
      saveSelection();
      updateSelectionUi();
      closeDrawer();
      renderRoute();
      showToast("Seleção limpa.");
    });
    document.getElementById("share-selected-link").addEventListener("click", shareSelectionLink);
    document.getElementById("share-selected-prices").addEventListener("click", () => shareSelection(true));
    document.getElementById("share-selected-no-prices").addEventListener("click", () => shareSelection(false));

    document.querySelectorAll("[data-close-share]").forEach((button) => button.addEventListener("click", closeShareModal));
    document.querySelectorAll("[data-close-choice]").forEach((button) => button.addEventListener("click", closeSendChoice));
    document.getElementById("share-modal-copy").addEventListener("click", copyShareModalText);
    document.getElementById("share-modal-open").addEventListener("click", () => window.open("https://web.whatsapp.com/", "_blank", "noopener"));

    window.addEventListener("hashchange", renderRoute);
    window.addEventListener("popstate", renderRoute);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { closeDrawer(); closeShareModal(); }
    });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js?v=45").catch(() => {});
    }
  }

  if (CLIENT_MODE) document.body.classList.add("client-mode");
  if (CLIENT_LIST_IDS) document.body.classList.add("client-list");
  buildInventory();
  renderMetadata();
  renderFilters();
  bindGlobalEvents();
  updateSelectionUi();
  renderPortfolio();
  renderRoute();
  registerServiceWorker();
})();
