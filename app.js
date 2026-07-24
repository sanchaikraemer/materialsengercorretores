/* Construtora Senger — Portfólio Comercial v1.0 */
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
    category: "todos",
    city: "todos",
    stage: "todos",
    price: "todos",
    availableOnly: true,
    sort: "destaque",
    hidePrices: storage.get("senger-hide-prices", "false") === "true",
    selected: new Set(JSON.parse(storage.get("senger-selection", "[]"))),
    lightbox: { media: [], index: 0 },
  };

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

  const compactMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "Sob consulta";
    if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
    return `R$ ${Math.round(n / 1_000).toLocaleString("pt-BR")} mil`;
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
  const isAvailable = (status) => (status || "disponivel") === "disponivel";
  const isMarketable = (status) => !["vendido", "reservado"].includes(status || "disponivel");
  const safeUrl = (url) => /^https?:\/\//i.test(url || "") ? url : `https://${url}`;
  const whatsappUrl = (text, phone = "") => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

  function enterpriseUrl(emp) {
    if (location.protocol === "file:") return `#emp-${emp.id}`;
    return `${location.origin}${location.pathname}#emp-${emp.id}`;
  }

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

  function availableItems(emp) {
    return itemsFor(emp).filter((item) => isAvailable(item.status));
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
    const available = allItems.filter((item) => isAvailable(item.status));
    const marketable = allItems.filter((item) => isMarketable(item.status));
    const cities = unique(EMPREENDIMENTOS.flatMap((emp) => emp.cidade.split(" · ")));
    const categories = unique(EMPREENDIMENTOS.map((emp) => emp.categoria));

    setText("header-date", META.dataTabela || "Não informada");
    setText("header-available", available.length.toLocaleString("pt-BR"));
    setText("meta-month", META.mesTabela || "—");
    setText("meta-incc", META.incc ? `${META.incc.valor} (${META.incc.variacao})` : "—");
    setText("meta-cities", cities.map((city) => city.replace("/RS", "")).join(" · "));

    const stats = [
      [EMPREENDIMENTOS.length, "empreendimentos"],
      [available.length, "opções disponíveis"],
      [marketable.length, "opções comercializáveis"],
      [categories.length, "categorias"],
    ];
    document.getElementById("hero-stats").innerHTML = stats.map(([value, label]) => `
      <div class="hero-stat"><strong>${Number(value).toLocaleString("pt-BR")}</strong><span>${escapeHtml(label)}</span></div>
    `).join("");

    const generalMessage = `Olá! Gostaria de informações sobre os imóveis da Construtora Senger. Tabela: ${META.mesTabela || "atual"}.`;
    document.getElementById("header-whatsapp").href = whatsappUrl(generalMessage, META.contato?.whatsapp || "");

    const footer = document.getElementById("footer-contacts");
    footer.innerHTML = [
      ...(META.contato?.telefones || []).map((phone) => `<a href="tel:${phone.replace(/\D/g, "")}">${escapeHtml(phone)}</a>`),
      META.contato?.instagram ? `<a href="https://instagram.com/${META.contato.instagram.replace("@", "")}" target="_blank" rel="noopener">${escapeHtml(META.contato.instagram)}</a>` : "",
      META.contato?.site ? `<a href="${safeUrl(META.contato.site)}" target="_blank" rel="noopener">${escapeHtml(META.contato.site)}</a>` : "",
    ].join("");
    setText("footer-address", META.contato?.endereco || "");
    setText("footer-version", `Tabela ${META.mesTabela || ""} · atualizada em ${META.dataTabela || "—"}`);
  }

  function renderFilters() {
    const categoryContainer = document.getElementById("category-filter");
    categoryContainer.innerHTML = Object.entries(CATEGORY_LABELS).map(([value, label]) => `
      <button type="button" data-category="${value}" class="${state.category === value ? "active" : ""}">${label}</button>
    `).join("");

    categoryContainer.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      state.category = button.dataset.category;
      categoryContainer.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      renderPortfolio();
    });

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
    document.getElementById("available-only").addEventListener("change", (event) => { state.availableOnly = event.target.checked; renderPortfolio(); });
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
    state.category = "todos";
    state.city = "todos";
    state.stage = "todos";
    state.price = "todos";
    state.availableOnly = true;
    document.getElementById("search-input").value = "";
    document.getElementById("city-filter").value = "todos";
    document.getElementById("stage-filter").value = "todos";
    document.getElementById("price-filter").value = "todos";
    document.getElementById("available-only").checked = true;
    document.querySelectorAll("[data-category]").forEach((button) => button.classList.toggle("active", button.dataset.category === "todos"));
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
      if (state.category !== "todos" && emp.categoria !== state.category) return false;
      if (state.city !== "todos" && !emp.cidade.split(" · ").includes(state.city)) return false;
      if (state.stage !== "todos" && emp.status !== state.stage) return false;
      if (state.availableOnly && marketableItems(emp).length === 0) return false;
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
    setHtml("results-count", `<strong>${enterprises.length}</strong> ${enterprises.length === 1 ? "empreendimento encontrado" : "empreendimentos encontrados"}`);

    grid.innerHTML = enterprises.map((emp) => {
      const active = marketableItems(emp);
      const minimum = minPrice(emp);
      const statusClass = emp.status === "pronto" ? "pronto" : "obra";
      const typeLabel = CATEGORY_LABELS[emp.categoria] || emp.categoria;
      return `
        <article class="portfolio-card">
          <div class="card-media">
            <img src="${escapeHtml(cardImage(emp))}" alt="${escapeHtml(emp.nome)}" loading="lazy">
            <div class="card-badges">
              <span class="badge badge-stage ${statusClass}">${escapeHtml(emp.statusLabel || emp.entrega || "")}</span>
              <span class="badge">${escapeHtml(typeLabel)}</span>
            </div>
            ${emp.logo ? `<img class="card-logo" src="${escapeHtml(emp.logo)}" alt="">` : ""}
          </div>
          <div class="card-body">
            <span class="card-kicker">${escapeHtml(emp.cidade)}</span>
            <h3 class="card-title">${escapeHtml(emp.nome)}</h3>
            <p class="card-tagline">${escapeHtml(emp.tagline || emp.entrega || "Consulte informações e disponibilidade.")}</p>
            <div class="card-metrics">
              <div class="card-metric"><span>Opções ativas</span><strong>${active.length}</strong></div>
              <div class="card-metric"><span>A partir de</span><strong class="price-value">${minimum ? compactMoney(minimum) : "Sob consulta"}</strong></div>
            </div>
          </div>
          <div class="card-footer">
            <button class="button button-dark" type="button" data-open-emp="${emp.id}">Ver empreendimento</button>
            <button class="card-share" type="button" data-share-emp="${emp.id}" aria-label="Compartilhar ${escapeHtml(emp.nome)}">↗</button>
          </div>
        </article>
      `;
    }).join("");

    grid.querySelectorAll("[data-open-emp]").forEach((button) => button.addEventListener("click", () => navigateToEnterprise(button.dataset.openEmp)));
    grid.querySelectorAll("[data-share-emp]").forEach((button) => button.addEventListener("click", () => shareEnterprise(findEnterprise(button.dataset.shareEmp), false)));
    applyPriceVisibility();
  }

  function findEnterprise(id) {
    return EMPREENDIMENTOS.find((emp) => emp.id === id);
  }

  function navigateToEnterprise(id) {
    if (location.hash === `#emp-${id}`) renderRoute();
    else location.hash = `emp-${id}`;
  }

  function navigateHome() {
    history.pushState(null, "", `${location.pathname}${location.search}`);
    renderRoute();
  }

  function renderRoute() {
    const match = location.hash.match(/^#emp-([\w-]+)/);
    const emp = match ? findEnterprise(match[1]) : null;
    if (emp) renderDetail(emp);
    else renderHome();
  }

  function renderHome() {
    document.getElementById("home-hero").hidden = false;
    document.querySelector(".trust-strip").hidden = false;
    document.getElementById("catalogo").hidden = false;
    document.getElementById("detail-view").hidden = true;
    document.getElementById("detail-view").innerHTML = "";
    document.title = "Construtora Senger — Portfólio Comercial";
    applyPriceVisibility();
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
    const inventory = renderInventory(emp);
    const differentials = (emp.diferenciais || []).length ? `
      <section class="content-section">
        <div class="section-title-row"><h2>Diferenciais</h2><p>Características do empreendimento</p></div>
        <div class="differentials-grid">
          ${(emp.diferenciais || []).map((item, index) => `
            <article class="differential-card">
              <div class="differential-icon">${String(index + 1).padStart(2, "0")}</div>
              <h3>${escapeHtml(item.titulo)}</h3>
              <p>${escapeHtml(item.desc)}</p>
            </article>
          `).join("")}
        </div>
      </section>
    ` : "";

    const gallery = media.length ? `
      <section class="content-section">
        <div class="section-title-row"><h2>Imagens e plantas</h2><p>${media.length} ${media.length === 1 ? "arquivo" : "arquivos"}</p></div>
        <div class="gallery-grid">
          ${media.slice(0, 7).map((item, index) => `
            <button class="gallery-button" type="button" data-gallery-index="${index}">
              <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.legenda || emp.nome)}" loading="lazy">
              <span class="gallery-caption">${escapeHtml(item.legenda || emp.nome)}</span>
              ${index === 6 && media.length > 7 ? `<span class="gallery-more">+${media.length - 7} imagens</span>` : ""}
            </button>
          `).join("")}
        </div>
      </section>
    ` : "";

    const video = local.video ? `
      <section class="content-section">
        <div class="section-title-row"><h2>Vídeo do empreendimento</h2><p>Apresentação em vídeo</p></div>
        <div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(local.video)}" title="Vídeo ${escapeHtml(emp.nome)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
      </section>
    ` : "";

    detail.innerHTML = `
      <section class="detail-hero">
        <img class="detail-hero-image" src="${escapeHtml(cardImage(emp))}" alt="${escapeHtml(emp.nome)}">
        <div class="shell detail-hero-content">
          <button class="button detail-back" type="button" id="detail-back">← Voltar ao portfólio</button>
          <div class="detail-title-row">
            <div>
              <div class="detail-badges">
                <span class="badge badge-stage ${statusClass}">${escapeHtml(emp.statusLabel || emp.entrega || "")}</span>
                <span class="badge">${escapeHtml(emp.cidade)}</span>
                <span class="badge">${escapeHtml(CATEGORY_LABELS[emp.categoria] || emp.categoria)}</span>
              </div>
              <h1>${escapeHtml(emp.nome)}</h1>
              <p>${escapeHtml(emp.tagline || emp.entrega || "Consulte informações e disponibilidade.")}</p>
              <div class="detail-actions">
                <button class="button button-primary" type="button" id="share-emp-prices">Compartilhar com preços</button>
                <button class="button button-outline" type="button" id="share-emp-no-prices">Compartilhar sem preços</button>
                ${local.mapsUrl ? `<a class="button button-outline" href="${escapeHtml(local.mapsUrl)}" target="_blank" rel="noopener">Ver localização</a>` : ""}
                ${emp.folder ? `<a class="button button-outline" href="${escapeHtml(emp.folder)}" target="_blank" rel="noopener">Baixar folder</a>` : ""}
                <button class="button button-outline" type="button" id="print-detail">Gerar PDF</button>
              </div>
            </div>
            ${emp.logo ? `<img class="detail-brand-logo" src="${escapeHtml(emp.logo)}" alt="Logo ${escapeHtml(emp.nome)}">` : ""}
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
          </article>
          <article class="info-card">
            <p class="eyebrow dark">Resumo comercial</p>
            <h2>Informações principais</h2>
            <div class="fact-grid">
              <div class="fact-card"><span>Etapa</span><strong>${escapeHtml(emp.entrega || emp.statusLabel || "—")}</strong></div>
              <div class="fact-card"><span>Opções ativas</span><strong>${active.length}</strong></div>
              <div class="fact-card"><span>Preço inicial</span><strong class="price-value">${minimum ? money(minimum) : "Sob consulta"}</strong></div>
              <div class="fact-card"><span>Registro</span><strong>${escapeHtml((emp.ri || []).join(" · ") || "Não informado")}</strong></div>
            </div>
          </article>
        </div>
        ${differentials}
        ${gallery}
        ${video}
        ${inventory}
      </div>
    `;

    document.getElementById("detail-back").addEventListener("click", navigateHome);
    document.getElementById("share-emp-prices").addEventListener("click", () => shareEnterprise(emp, true));
    document.getElementById("share-emp-no-prices").addEventListener("click", () => shareEnterprise(emp, false));
    document.getElementById("print-detail").addEventListener("click", () => window.print());
    detail.querySelectorAll("[data-gallery-index]").forEach((button) => button.addEventListener("click", () => openLightbox(media, Number(button.dataset.galleryIndex))));
    bindInventoryEvents(detail);
    applyPriceVisibility();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderInventory(emp) {
    if ((emp.grupos || []).length) return renderUnitGroups(emp);
    if ((emp.terrenos || []).length) return renderLandInventory(emp);
    if ((emp.outros || []).length) return renderOtherInventory(emp);
    return "";
  }

  function renderUnitGroups(emp) {
    const groups = emp.grupos || [];
    return `
      <section class="content-section" id="unidades">
        <div class="section-title-row"><h2>Unidades e valores</h2><p>Selecione opções para encaminhar ao cliente</p></div>
        <div class="inventory-toolbar"><p>${marketableItems(emp).length} opções comercializáveis nesta tabela.</p><button class="button button-outline button-small" type="button" data-toggle-prices>${state.hidePrices ? "Exibir preços" : "Ocultar preços"}</button></div>
        ${groups.map((group, groupIndex) => {
          const units = (group.unidades || []).map((unit, unitIndex) => itemMap.get(`${emp.id}:unit:${groupIndex}:${unitIndex}`));
          const active = units.filter((item) => isMarketable(item.status)).length;
          return `
            <article class="unit-group">
              <div class="unit-group-header">
                <div><h3>${escapeHtml(group.tipo)}</h3><p>${escapeHtml([group.area, group.garagem, group.obs].filter(Boolean).join(" · "))}</p></div>
                <span class="group-availability">${active} ${active === 1 ? "opção ativa" : "opções ativas"}</span>
              </div>
              <table class="units-table">
                <thead><tr><th>Unidade</th><th>Área</th><th>Garagem</th><th>Status</th><th>Valor</th><th></th></tr></thead>
                <tbody>${units.map(renderUnitRow).join("")}</tbody>
              </table>
              <div class="mobile-units">${units.map(renderMobileUnit).join("")}</div>
            </article>
          `;
        }).join("")}
      </section>
    `;
  }

  function renderUnitRow(item) {
    const selectable = isMarketable(item.status);
    const selected = state.selected.has(item.key);
    return `
      <tr>
        <td><strong>${escapeHtml(itemLabel(item))}</strong>${item.tags.length ? `<br><small>${escapeHtml(item.tags.join(" · "))}</small>` : ""}</td>
        <td>${escapeHtml(item.area || "—")}</td>
        <td>${escapeHtml(item.garage || "—")}</td>
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
      <article class="mobile-unit-card">
        <div class="mobile-unit-head"><strong>${escapeHtml(itemLabel(item))}</strong><span class="status-pill status-${item.status}">${escapeHtml(STATUS_LABELS[item.status] || item.status)}</span></div>
        <div class="mobile-unit-meta">
          <div><span>Área</span><strong>${escapeHtml(item.area || "—")}</strong></div>
          <div><span>Valor</span><strong class="price-value">${money(item.price)}</strong></div>
        </div>
        <div class="mobile-unit-actions"><button class="unit-action" type="button" data-share-item="${item.key}">Compartilhar</button><button class="selection-control ${selected ? "selected" : ""}" type="button" data-select-item="${item.key}" ${selectable ? "" : "disabled"}>${selected ? "Selecionado" : "Selecionar"}</button></div>
      </article>
    `;
  }

  function renderLandInventory(emp) {
    const items = itemsFor(emp);
    return `
      <section class="content-section" id="unidades">
        <div class="section-title-row"><h2>Lotes e valores</h2><p>Disponibilidade por quadra e lote</p></div>
        <div class="inventory-toolbar"><p>${marketableItems(emp).length} opções comercializáveis nesta tabela.</p><button class="button button-outline button-small" type="button" data-toggle-prices>${state.hidePrices ? "Exibir preços" : "Ocultar preços"}</button></div>
        <div class="land-grid">${items.map((item) => renderOpportunity(item, `${item.lote || emp.nome}`, [itemLabel(item), item.rua, item.area])).join("")}</div>
      </section>
    `;
  }

  function renderOtherInventory(emp) {
    const items = itemsFor(emp);
    return `
      <section class="content-section" id="unidades">
        <div class="section-title-row"><h2>Imóveis disponíveis</h2><p>Oportunidades complementares</p></div>
        <div class="other-grid">${items.map((item) => renderOpportunity(item, item.nome, [item.local, item.area], item.description)).join("")}</div>
      </section>
    `;
  }

  function renderOpportunity(item, title, chips, description = "") {
    const selectable = isMarketable(item.status);
    const selected = state.selected.has(item.key);
    return `
      <article class="opportunity-card">
        <span class="status-pill status-${item.status}">${escapeHtml(STATUS_LABELS[item.status] || item.status)}</span>
        <h3>${escapeHtml(title)}</h3>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
        <div class="opportunity-data">${chips.filter(Boolean).map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}</div>
        <div class="opportunity-price price-value">${item.pricePrefix ? `${escapeHtml(item.pricePrefix)} ` : ""}${money(item.price)}</div>
        ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}
        <div class="opportunity-actions"><button class="unit-action" type="button" data-share-item="${item.key}">Compartilhar</button><button class="selection-control ${selected ? "selected" : ""}" type="button" data-select-item="${item.key}" ${selectable ? "" : "disabled"}>${selected ? "Selecionado" : "Selecionar"}</button></div>
      </article>
    `;
  }

  function bindInventoryEvents(root) {
    root.querySelectorAll("[data-share-item]").forEach((button) => button.addEventListener("click", () => shareItem(itemMap.get(button.dataset.shareItem), true)));
    root.querySelectorAll("[data-select-item]").forEach((button) => button.addEventListener("click", () => toggleSelection(button.dataset.selectItem)));
    root.querySelectorAll("[data-toggle-prices]").forEach((button) => button.addEventListener("click", togglePrices));
  }

  function enterpriseMessage(emp, includePrices) {
    const items = marketableItems(emp);
    const lines = [
      `*${emp.nome} — Construtora Senger*`,
      emp.cidade,
      emp.tagline || emp.entrega || "",
      "",
    ];
    if (includePrices) {
      lines.push(`Valores a partir de: *${minPrice(emp) ? money(minPrice(emp)) : "sob consulta"}*`);
      lines.push(`${items.length} ${items.length === 1 ? "opção comercializável" : "opções comercializáveis"} na tabela.`);
    } else {
      lines.push(`${items.length} ${items.length === 1 ? "opção comercializável" : "opções comercializáveis"}. Consulte valores e condições.`);
    }
    if (emp.entrega) lines.push(`Etapa: ${emp.entrega}`);
    lines.push("", `Veja a apresentação completa: ${enterpriseUrl(emp)}`, "", `Tabela ${META.mesTabela || ""}, atualizada em ${META.dataTabela || "—"}. Valores e disponibilidade sujeitos a alteração.`);
    return lines.filter((line, index, array) => line !== "" || array[index - 1] !== "").join("\n");
  }

  function itemMessage(item, includePrice) {
    const lines = [
      `*${item.emp.nome} — ${itemLabel(item)}*`,
      item.emp.cidade,
    ];
    if (item.group?.tipo) lines.push(item.group.tipo);
    if (item.description) lines.push(item.description);
    if (item.area) lines.push(`Área: ${item.area}`);
    if (item.garage) lines.push(`Garagem: ${item.garage}`);
    if (item.rua) lines.push(`Localização: ${item.rua}`);
    if (item.tags?.length) lines.push(`Diferencial: ${item.tags.join(" · ")}`);
    if (includePrice) lines.push(`Valor: *${money(item.price)}*`);
    else lines.push("Valor: consulte a equipe comercial");
    lines.push(`Status: ${STATUS_LABELS[item.status] || item.status}`);
    if (item.notes) lines.push(item.notes);
    lines.push("", `Apresentação: ${enterpriseUrl(item.emp)}`, `Tabela ${META.mesTabela || ""}, atualizada em ${META.dataTabela || "—"}. Valores e disponibilidade sujeitos a alteração.`);
    return lines.join("\n");
  }

  async function sendShare(text, title = "Construtora Senger") {
    if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      try {
        await navigator.share({ title, text });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    window.open(whatsappUrl(text), "_blank", "noopener");
  }

  function shareEnterprise(emp, includePrices) {
    if (!emp) return;
    sendShare(enterpriseMessage(emp, includePrices), emp.nome);
  }

  function shareItem(item, includePrice) {
    if (!item) return;
    sendShare(itemMessage(item, includePrice), `${item.emp.nome} — ${itemLabel(item)}`);
  }

  function togglePrices() {
    state.hidePrices = !state.hidePrices;
    storage.set("senger-hide-prices", String(state.hidePrices));
    applyPriceVisibility();
    showToast(state.hidePrices ? "Preços ocultados na tela." : "Preços exibidos na tela.");
  }

  function applyPriceVisibility() {
    document.body.classList.toggle("price-hidden", state.hidePrices);
    const mainToggle = document.getElementById("toggle-prices");
    mainToggle.textContent = state.hidePrices ? "Exibir preços" : "Ocultar preços";
    mainToggle.setAttribute("aria-pressed", String(state.hidePrices));
    document.querySelectorAll("[data-toggle-prices]").forEach((button) => { button.textContent = state.hidePrices ? "Exibir preços" : "Ocultar preços"; });
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
    applyPriceVisibility();
  }

  function selectedMessage(includePrices) {
    const items = [...state.selected].map((key) => itemMap.get(key)).filter(Boolean);
    const lines = ["*Seleção de imóveis — Construtora Senger*", ""];
    items.forEach((item, index) => {
      lines.push(`*${index + 1}. ${item.emp.nome} — ${itemLabel(item)}*`);
      if (item.group?.tipo) lines.push(item.group.tipo);
      if (item.area) lines.push(`Área: ${item.area}`);
      if (item.garage) lines.push(`Garagem: ${item.garage}`);
      if (item.rua) lines.push(`Localização: ${item.rua}`);
      lines.push(includePrices ? `Valor: *${money(item.price)}*` : "Valor: consulte a equipe comercial");
      lines.push(`Apresentação: ${enterpriseUrl(item.emp)}`, "");
    });
    lines.push(`Tabela ${META.mesTabela || ""}, atualizada em ${META.dataTabela || "—"}. Valores e disponibilidade sujeitos a alteração.`);
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

  function openLightbox(media, index) {
    state.lightbox.media = media;
    state.lightbox.index = index;
    updateLightbox();
    const box = document.getElementById("lightbox");
    box.classList.add("open");
    box.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }

  function closeLightbox() {
    const box = document.getElementById("lightbox");
    box.classList.remove("open");
    box.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  }

  function updateLightbox() {
    const item = state.lightbox.media[state.lightbox.index];
    if (!item) return;
    document.getElementById("lightbox-image").src = item.src;
    document.getElementById("lightbox-image").alt = item.legenda || "Imagem do empreendimento";
    setText("lightbox-caption", `${item.legenda || ""} · ${state.lightbox.index + 1}/${state.lightbox.media.length}`);
    document.getElementById("lightbox-prev").hidden = state.lightbox.media.length < 2;
    document.getElementById("lightbox-next").hidden = state.lightbox.media.length < 2;
  }

  function moveLightbox(direction) {
    const total = state.lightbox.media.length;
    if (!total) return;
    state.lightbox.index = (state.lightbox.index + direction + total) % total;
    updateLightbox();
  }

  let toastTimer;
  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
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
    document.getElementById("brand-home").addEventListener("click", navigateHome);
    document.getElementById("toggle-prices").addEventListener("click", togglePrices);
    document.getElementById("print-catalog").addEventListener("click", () => window.print());
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
    document.getElementById("share-selected-prices").addEventListener("click", () => state.selected.size && sendShare(selectedMessage(true), "Seleção de imóveis"));
    document.getElementById("share-selected-no-prices").addEventListener("click", () => state.selected.size && sendShare(selectedMessage(false), "Seleção de imóveis"));

    document.querySelectorAll("[data-close-lightbox]").forEach((button) => button.addEventListener("click", closeLightbox));
    document.getElementById("lightbox-prev").addEventListener("click", () => moveLightbox(-1));
    document.getElementById("lightbox-next").addEventListener("click", () => moveLightbox(1));

    window.addEventListener("hashchange", renderRoute);
    window.addEventListener("popstate", renderRoute);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { closeDrawer(); closeLightbox(); }
      if (document.getElementById("lightbox").classList.contains("open") && event.key === "ArrowLeft") moveLightbox(-1);
      if (document.getElementById("lightbox").classList.contains("open") && event.key === "ArrowRight") moveLightbox(1);
    });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js?v=2").catch(() => {});
    }
  }

  buildInventory();
  renderMetadata();
  renderFilters();
  bindGlobalEvents();
  updateSelectionUi();
  renderPortfolio();
  renderRoute();
  registerServiceWorker();
})();
