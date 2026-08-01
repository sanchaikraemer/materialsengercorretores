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

    setText("header-version", APP_VERSION);
    setText("meta-month", META.mesTabela || "—");
    setText("meta-incc", META.incc ? `${META.incc.valor} (${META.incc.variacao})` : "—");
    setText("meta-cities", cities.map((city) => city.replace("/RS", "")).join(" · "));
    setText("header-month", META.mesTabela || "—");
    setText("header-incc", META.incc ? `${META.incc.valor} (${META.incc.variacao})` : "—");
    const citiesLabel = cities.map((city) => city.replace("/RS", "")).join(" · ");
    setText("header-cities", citiesLabel);
    document.getElementById("header-cities")?.setAttribute("title", citiesLabel);

    const stats = [
      [EMPREENDIMENTOS.length, "empreendimentos"],
      [available.length, "opções disponíveis"],
      [marketable.length, "opções comercializáveis"],
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
    setHtml("results-count", `<strong>${enterprises.length}</strong> ${enterprises.length === 1 ? "empreendimento encontrado" : "empreendimentos encontrados"}`);

    grid.innerHTML = enterprises.map((emp) => {
      const active = marketableItems(emp);
      const minimum = minPrice(emp);
      const statusClass = emp.status === "pronto" ? "pronto" : "obra";
      const typeLabel = CATEGORY_LABELS[emp.categoria] || emp.categoria;
      return `
        <article class="portfolio-card">
          <div class="card-media">
            <img src="${escapeHtml(assetUrl(cardImage(emp)))}" alt="${escapeHtml(emp.nome)}" loading="lazy">
            ${emp.logo ? `<img class="card-logo" src="${escapeHtml(assetUrl(emp.logo))}" alt="">` : ""}
          </div>
          <div class="card-body">
            <div class="card-badges">
              <span class="badge badge-stage ${statusClass}">${escapeHtml(emp.statusLabel || emp.entrega || "")}</span>
              <span class="badge">${escapeHtml(typeLabel)}</span>
            </div>
            <span class="card-kicker">${escapeHtml(emp.cidade)}</span>
            <h3 class="card-title">${escapeHtml(emp.nome)}</h3>
            <p class="card-tagline">${escapeHtml(emp.tagline || emp.entrega || "Consulte informações e disponibilidade.")}</p>
            <div class="card-metrics">
              <div class="card-metric"><span>Opções ativas</span><strong>${active.length}</strong></div>
              <div class="card-metric card-price-panel">
                <span class="card-price-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false"><path d="M4 21V8.5L12 4l8 4.5V21M8 21v-8h8v8M9 9h.01M12 9h.01M15 9h.01"/></svg>
                </span>
                <span class="card-price-copy"><span>A partir de</span><strong class="price-value">${minimum ? money(minimum) : "Sob consulta"}</strong></span>
              </div>
            </div>
          </div>
          <div class="card-footer">
            <span class="button button-dark card-open-label" aria-hidden="true">Ver empreendimento</span>
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

    const isPlantMedia = (item) => /planta/i.test(`${item?.src || ""} ${item?.legenda || ""}`);
    const photoMedia = media.filter((item) => !isPlantMedia(item)).slice(0, 8);
    const humanizedPlants = media.filter((item) => isPlantMedia(item) && !/\.pdf(?:$|\?)/i.test(item.src || ""));
    const technicalPlants = media.filter((item) => isPlantMedia(item) && /\.pdf(?:$|\?)/i.test(item.src || ""));

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
              <h1>${escapeHtml(emp.nome)}</h1>
              <p>${escapeHtml(emp.tagline || emp.entrega || "Consulte informações e disponibilidade.")}</p>
              <div class="detail-actions">
                <button class="button button-primary" type="button" id="share-emp-prices">Compartilhar com preços</button>
                <button class="button button-outline" type="button" id="share-emp-no-prices">Compartilhar sem preços</button>
                ${local.mapsUrl ? `<a class="button button-outline" href="${escapeHtml(local.mapsUrl)}" target="_blank" rel="noopener">Ver localização</a>` : ""}
                ${emp.folder ? `<a class="button button-outline" href="${escapeHtml(assetUrl(emp.folder))}" target="_blank" rel="noopener">Baixar folder</a>` : ""}
                <button class="button button-outline" type="button" id="print-detail">Gerar PDF</button>
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
              <div class="fact-card"><span>Opções ativas</span><strong>${active.length}</strong></div>
              <div class="fact-card"><span>Preço inicial</span><strong class="price-value">${minimum ? money(minimum) : "Sob consulta"}</strong></div>
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
    document.getElementById("print-detail").addEventListener("click", printDocument);
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
        <div class="inventory-toolbar"><p>${marketableItems(emp).length} opções comercializáveis nesta tabela.</p></div>
        ${groups.map((group, groupIndex) => {
          const units = (group.unidades || []).map((unit, unitIndex) => itemMap.get(`${emp.id}:unit:${groupIndex}:${unitIndex}`));
          return `
            <article class="unit-group">
              <div class="unit-group-header">
                <div><h3>${escapeHtml(group.tipo)}</h3><p>${escapeHtml([group.area, group.garagem, group.obs].filter(Boolean).join(" · "))}</p></div>
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
        <div class="inventory-toolbar"><p>${marketableItems(emp).length} opções comercializáveis nesta tabela.</p></div>
        <table class="units-table">
          <thead><tr><th>Lote</th><th>Área</th><th>Rua</th><th>Status</th><th>Valor</th><th></th></tr></thead>
          <tbody>${items.map((item) => renderOpportunityRow(item, item.rua)).join("")}</tbody>
        </table>
        <div class="mobile-units">${items.map((item) => renderMobileOpportunity(item, item.rua)).join("")}</div>
      </section>
    `;
  }

  function renderOtherInventory(emp) {
    const items = itemsFor(emp);
    return `
      <section class="content-section" id="unidades">
        <div class="section-title-row"><h2>Imóveis disponíveis</h2><p>Oportunidades complementares</p></div>
        <div class="inventory-toolbar"><p>${marketableItems(emp).length} opções comercializáveis nesta tabela.</p></div>
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
      <tr>
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
      <article class="mobile-unit-card">
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
    root.querySelectorAll("[data-share-item]").forEach((button) => button.addEventListener("click", () => shareItem(itemMap.get(button.dataset.shareItem), true)));
    root.querySelectorAll("[data-select-item]").forEach((button) => button.addEventListener("click", () => toggleSelection(button.dataset.selectItem)));
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
    if (emp.entrega) lines.push(`Entrega: ${semPonto(emp.entrega)}`);
    lines.push("", `Tabela ${META.mesTabela || ""}. Valores e disponibilidade sujeitos a alteração.`);
    return lines.filter((line, index, array) => line !== "" || array[index - 1] !== "").join("\n");
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
    const etiquetas = (item.tags || []).map((t) => t.toLowerCase());
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

  function shareEnterprise(emp, includePrices) {
    if (!emp) return;
    sendShare(enterpriseMessage(emp, includePrices), emp.nome, [coverPhoto(emp)]);
  }

  function shareItem(item, includePrice) {
    if (!item) return;
    sendShare(itemMessage(item, includePrice), `${item.emp.nome} — ${itemLabel(item)}`, [coverPhoto(item.emp)]);
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

  let printing = false;

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
    document.getElementById("print-catalog").addEventListener("click", printDocument);
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
    document.getElementById("share-selected-prices").addEventListener("click", () => shareSelection(true));
    document.getElementById("share-selected-no-prices").addEventListener("click", () => shareSelection(false));

    document.querySelectorAll("[data-close-share]").forEach((button) => button.addEventListener("click", closeShareModal));
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

  buildInventory();
  renderMetadata();
  renderFilters();
  bindGlobalEvents();
  updateSelectionUi();
  renderPortfolio();
  renderRoute();
  registerServiceWorker();
})();
