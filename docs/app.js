/* Demo interactiva: min-cut de cables submarinos. Los resultados vienen de
   scripts/calcular.py (window.DATA); aquí solo se dibujan. */
const D = window.DATA;
const USA = "United States";
const PALETA = ["#0b6bcb", "#2f9e44", "#9c36b5", "#e8590c", "#0c8599", "#c2255c", "#5c940d", "#364fc7"];
const S = { tab: "1", esc: "servicio", pais: "Ecuador", paso: -1, ruta: null, filtro: "" };
const sel = { "1": "Ecuador", "2": "Ecuador", "3": null };

const map = L.map("map", { preferCanvas: true, worldCopyJump: true, minZoom: 2 }).setView([10, -60], 3);
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap", maxZoom: 10,
}).addTo(map);

const capaCable = {};
for (const [id, partes] of Object.entries(D.geo)) {
  if (!D.cables[id]) continue;
  const c = D.cables[id];
  capaCable[id] = L.polyline(partes.map(p => p.map(([x, y]) => [y, x])), { weight: 1.5 })
    .bindTooltip(c.n, { sticky: true })
    .on("click", () => L.popup().setLatLng(capaCable[id].getCenter())
      .setContent(`<b>${c.n}</b><br>${c.paises.join(", ")}<br>RFS: ${c.rfs ?? "?"}${c.plan ? " · <b>planeado</b>" : ""}`)
      .openOn(map));
}
const capaCorte = L.featureGroup().addTo(map);
const capaLp = {};
for (const [id, [x, y, nombre, pais]] of Object.entries(D.lps)) {
  capaLp[id] = L.circleMarker([y, x], { radius: 2, weight: 0, fillOpacity: .6 }).bindTooltip(nombre);
}

const $ = s => document.querySelector(s);
const res = () => D.esc[S.esc];
const nombre = id => D.cables[id].n;
const visible = id => S.esc === "planeados" || !D.cables[id].plan;
const cablesDe = t => t.filter(x => x.c).map(x => x.c);
const esc_ = s => s.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

function ranking(paises) {
  const r = res();
  return paises.filter(p => r[p]).sort((a, b) => r[b].v - r[a].v || r[b].ing - r[a].ing || a.localeCompare(b));
}

function txtRuta(t) {
  return t.map(x => x.p ? esc_(x.p)
    : `<span class="${x.inv ? "inv" : "cab"}">[${esc_(nombre(x.c))}]${x.inv ? " ↩︎ inversa" : ""}</span>`).join(" → ");
}

/* ---------- mapa ---------- */
function pintarMapa() {
  const r = S.pais && res()[S.pais];
  const estilo = {};
  for (const id in capaCable) {
    const c = D.cables[id];
    if (!visible(id)) { estilo[id] = null; continue; }
    const delPais = r && c.paises.includes(S.pais) && c.paises.length > 1;
    estilo[id] = r
      ? { color: delPais ? "#6b7480" : "#9aa5b1", weight: delPais ? 2 : 1, opacity: delPais ? .6 : .25, dashArray: c.plan ? "4 4" : null }
      : { color: c.col, weight: 1.5, opacity: .8, dashArray: c.plan ? "4 4" : null };
  }
  const arriba = [];
  if (r) {
    if (S.paso >= 0) {
      r.pasos.slice(0, S.paso).forEach(p => cablesDe(p.t).forEach(id => {
        estilo[id] = { color: "#3b82f6", weight: 3, opacity: .7 }; arriba.push(id);
      }));
      r.pasos[S.paso].t.filter(x => x.c).forEach(x => {
        estilo[x.c] = { color: "#f59e0b", weight: 5, opacity: 1, dashArray: x.inv ? "8 6" : null }; arriba.push(x.c);
      });
    } else {
      r.rutas.forEach((ru, i) => {
        if (S.ruta !== null && S.ruta !== i) return;
        cablesDe(ru).forEach(id => { estilo[id] = { color: PALETA[i % PALETA.length], weight: 3.5, opacity: .95 }; arriba.push(id); });
      });
    }
  }
  // el corte va como trazo rojo punteado ENCIMA del color de su ruta, para que se vean las dos cosas
  capaCorte.clearLayers();
  if (r && S.paso < 0 && S.ruta === null) r.corte.forEach(id => capaCable[id] &&
    capaCorte.addLayer(L.polyline(capaCable[id].getLatLngs(), { color: "#e5484d", weight: 2.5, dashArray: "2 7", interactive: false })));
  for (const id in capaCable) {
    const l = capaCable[id];
    if (!estilo[id]) { map.removeLayer(l); continue; }
    l.setStyle({ dashArray: null, ...estilo[id] });
    if (!map.hasLayer(l)) l.addTo(map);
  }
  arriba.forEach(id => capaCable[id] && map.hasLayer(capaCable[id]) && capaCable[id].bringToFront());
  capaCorte.bringToFront();
  pintarEstaciones();
  pintarLeyenda(r);
}

function pintarEstaciones() {
  const heat = S.tab === "3";
  const max = Math.max(...Object.values(res()).map(x => x.v), 1);
  for (const [id, m] of Object.entries(capaLp)) {
    const pais = D.lps[id][3];
    let st = null;
    if (pais === S.pais) st = { radius: 5, fillColor: "#1b1b1f", fillOpacity: 1 };
    else if (pais === USA && S.pais) st = { radius: 4, fillColor: "#0b6bcb", fillOpacity: .9 };
    else if (heat && res()[pais]) {
      const k = res()[pais].v / max;
      st = { radius: 2 + 4 * k, fillColor: `hsl(${200 - 200 * k}, 75%, 45%)`, fillOpacity: .85 };
    }
    if (!st) { map.removeLayer(m); continue; }
    m.setStyle({ weight: 0, ...st });
    if (!map.hasLayer(m)) m.addTo(map);
  }
}

function pintarLeyenda(r) {
  const fila = (c, t, dash) => `<div><i style="background:${c};${dash ? "background:repeating-linear-gradient(90deg," + c + " 0 5px,transparent 5px 8px)" : ""}"></i>${t}</div>`;
  let h = "";
  if (r && S.paso >= 0) h = fila("#f59e0b", "aumento actual") + fila("#f59e0b", "usa arista inversa", 1) + fila("#3b82f6", "aumentos anteriores");
  else if (r) h = `<div><i style="background:linear-gradient(90deg,${PALETA.slice(0, 4).join(",")})"></i>rutas independientes (un color c/u)</div>` +
    (S.ruta === null ? fila("#e5484d", "cable del corte mínimo", 1) : "") + `<div><i style="background:#1b1b1f;height:8px;width:8px;border-radius:50%"></i>estaciones de ${esc_(S.pais)}</div>`;
  if (S.tab === "3") h += `<div><i style="background:linear-gradient(90deg,hsl(200,75%,45%),hsl(150,75%,45%),hsl(100,75%,45%),hsl(50,75%,45%),hsl(0,75%,45%))"></i>min-cut del país (bajo → alto)</div>`;
  if (S.esc === "planeados") h += fila("#666", "cable planeado", 1);
  $("#legend").innerHTML = h;
  $("#legend").style.display = h ? "" : "none";
}

function encuadrar() {
  const r = S.pais && res()[S.pais];
  if (!r) return;
  map.invalidateSize();
  const ids = new Set(r.rutas.flatMap(cablesDe));
  const capas = [...ids].filter(id => capaCable[id]).map(id => capaCable[id]);
  Object.entries(D.lps).forEach(([id, v]) => { if (v[3] === S.pais) capas.push(capaLp[id]); });
  if (capas.length) map.fitBounds(L.featureGroup(capas).getBounds(), { padding: [30, 30], maxZoom: 5 });
}

/* ---------- panel ---------- */
function detalle(p) {
  const r = res()[p];
  if (!r) return `<p class="muted">${esc_(p)} no tiene cables internacionales en este escenario.</p>`;
  let badge;
  if (r.v === 0) badge = `<span class="badge">Sin ninguna ruta submarina a EE. UU. en los datos</span>`;
  else if (r.v < r.ing) badge = `<span class="badge">Cuello de botella escondido: tiene ${r.ing} cables, pero bastan ${r.v} fallas</span>`;
  else badge = `<span class="badge ok">Cada cable del país aporta una ruta independiente</span>`;
  let h = `<h2>${esc_(p)} → Estados Unidos</h2>
    <div class="stats">
      <div class="stat"><b>${r.ing}</b><span>cables internacionales que tocan ${esc_(p)} (medida ingenua)</span></div>
      <div class="stat cut"><b>${r.v}</b><span>cables que deben fallar, como mínimo (min-cut)</span></div>
    </div>${badge}`;
  if (r.v === 0) return h;
  h += `<h3>Corte mínimo: estos ${r.v} cables aíslan a ${esc_(p)}</h3>` +
    r.corte.map(id => `<span class="chip cut" data-cable="${id}">✂ ${esc_(nombre(id))}</span>`).join("");
  if (r.corte_alt) h += `<p class="muted">Hay otro corte mínimo distinto (el corte mínimo no es único, diap. 14 de min-cut):</p>` +
    r.corte_alt.map(id => `<span class="chip" data-cable="${id}">${esc_(nombre(id))}</span>`).join("");
  h += `<h3>Certificado: ${r.rutas.length} rutas que no comparten cable</h3>
    <p class="muted">Cada cable aguanta 1, así que estas rutas no comparten ningún cable. Para aislar el país hay que romper al menos un cable de cada una: con menos de ${r.v} no alcanza.
    <b>Toca una ruta para verla sola en el mapa.</b> Se dibuja el cable completo, aunque la ruta solo use el tramo entre los países que nombra.</p>` +
    r.rutas.map((ru, i) => `<div class="route${S.ruta === i ? " on" : ""}" data-ruta="${i}"><span class="dot" style="background:${PALETA[i % PALETA.length]}"></span>${txtRuta(ru)}</div>`).join("");
  const n = r.pasos.length, k = S.paso;
  h += `<h3>Edmonds-Karp paso a paso</h3>
    <div class="stepper">
      <button data-paso="prev" ${k <= 0 && k !== -1 ? "disabled" : ""}>◀</button>
      <span>${k === -1 ? `Resultado final: |f| = ${r.v}` : `Aumento ${k + 1} de ${n} · cuello = ${r.pasos[k].b}`}</span>
      <button data-paso="next">▶</button>
      ${k !== -1 ? `<button data-paso="fin">Final</button>` : ""}
    </div>`;
  if (k === -1) h += `<p class="muted">Pulsa ▶ para recorrer los ${n} aumentos. Cada uno es el camino de menos aristas (BFS) en la red residual G<sub>f</sub>; después del último, s ya no llega a t y los alcanzables desde s definen el corte.</p>`;
  else {
    const inv = r.pasos[k].t.some(x => x.inv);
    h += `<div class="route on">${txtRuta(r.pasos[k].t)}</div>
      <p class="muted">|f| pasa de ${k} a ${k + 1}.${inv ? " Este aumento usa una <b>arista inversa</b>: deshace parte de un aumento anterior para redirigirlo (diap. 4 de max-flow)." : ""}</p>`;
  }
  return h;
}

function tabla(paises, conBarra, puesto = (p, i) => i + 1) {
  const r = res();
  const max = Math.max(...paises.map(p => r[p].ing), 1);
  return `<table><tr><th>#</th><th>País</th><th>min-cut</th><th>cables</th>${conBarra ? "<th></th>" : ""}</tr>` +
    paises.map((p, i) => `<tr class="row${p === S.pais ? " on" : ""}" data-pais="${esc_(p)}"><td>${puesto(p, i)}</td><td>${esc_(p)}</td><td><b>${r[p].v}</b></td><td>${r[p].ing}</td>` +
      (conBarra ? `<td><div class="bars"><i class="n" style="width:${100 * r[p].ing / max}%"></i><i class="m" style="width:${100 * r[p].v / max}%"></i></div></td>` : "") + `</tr>`).join("") +
    `</table>`;
}

function pintarPanel() {
  let h = "";
  if (S.tab === "1") {
    h = `<p class="q">¿Cuántos cables submarinos tienen que fallar, como mínimo, para que Ecuador se quede sin ninguna ruta submarina hacia Estados Unidos? ¿Cuáles son?</p>` + detalle("Ecuador");
  } else if (S.tab === "2") {
    const orden = ranking(D.lista10);
    h = `<p class="q">Con la misma medida, del más al menos resiliente. Empate → más cables (medida ingenua).</p>` +
      tabla(orden, true) + `<p class="muted">Barra gris: cables del país. Barra roja: los que de verdad hay que romper. Toca una fila.</p>` +
      (S.pais ? detalle(S.pais) : "");
  } else if (S.tab === "3") {
    const todos = ranking(Object.keys(res()));
    const f = S.filtro.toLowerCase();
    const lista = f ? todos.filter(p => p.toLowerCase().includes(f)) : todos.slice(0, 25);
    h = `<p class="q">Según la medida, ¿cuál es el país más resiliente del mundo? ¿Le creen al resultado?</p>
      <input type="search" id="buscar" placeholder="Buscar país (${todos.length} con cables internacionales)" value="${esc_(S.filtro)}">` +
      tabla(lista, true, p => todos.indexOf(p) + 1) +
      (f ? "" : `<p class="muted">Top 25. En el mapa, cada estación se colorea según el min-cut de su país.</p>`) +
      (S.pais ? detalle(S.pais) : "");
  } else {
    h = `<h2>El modelo</h2>
      <svg viewBox="0 0 380 120" width="100%" style="max-width:380px">
        <g font-size="11" text-anchor="middle" font-family="system-ui">
          <circle cx="40" cy="60" r="22" fill="#1b1b1f"/><text x="40" y="64" fill="#fff">país A</text>
          <rect x="120" y="45" width="56" height="30" rx="6" fill="#fff" stroke="#e5484d" stroke-width="2"/><text x="148" y="64">cable·in</text>
          <rect x="210" y="45" width="56" height="30" rx="6" fill="#fff" stroke="#e5484d" stroke-width="2"/><text x="238" y="64">cable·out</text>
          <circle cx="340" cy="60" r="22" fill="#0b6bcb"/><text x="340" y="64" fill="#fff">país B</text>
          <line x1="62" y1="60" x2="118" y2="60" stroke="#999" stroke-width="2"/><text x="90" y="52" fill="#666">∞</text>
          <line x1="176" y1="60" x2="208" y2="60" stroke="#e5484d" stroke-width="3"/><text x="192" y="40" fill="#e5484d">1</text>
          <line x1="266" y1="60" x2="318" y2="60" stroke="#999" stroke-width="2"/><text x="292" y="52" fill="#666">∞</text>
          <text x="190" y="105" fill="#666">romper un cable = cortar la arista in → out (cuesta 1)</text>
        </g></svg>
      <table>
        <tr><td><b>Vértices</b></td><td>Un punto por país; las estaciones de un país se conectan por tierra.</td></tr>
        <tr><td><b>Cables</b></td><td>Cada cable es un vértice de capacidad 1, partido en in → out (Erickson §11.2). Las aristas país–cable valen ∞.</td></tr>
        <tr><td><b>Rutas</b></td><td>Pueden pasar por otros países.</td></tr>
        <tr><td><b>Cables</b></td><td>Solo en servicio; el escenario "con planeados" es una comparación.</td></tr>
        <tr><td><b>EE. UU.</b></td><td>Todo lo que el dataset etiqueta "United States" (incluye Puerto Rico).</td></tr>
        <tr><td><b>Ingenua</b></td><td>Cables que tocan el país y al menos otro país.</td></tr>
      </table>
      <p class="muted">Por max-flow = min-cut con capacidades 1 (Menger, K&amp;T §7.6): rutas que no comparten cable = cables que hay que romper.</p>`;
  }
  $("#panel").innerHTML = h;
  const b = $("#buscar");
  if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
}

function render(refit) {
  pintarPanel();
  pintarMapa();
  if (refit) encuadrar();
}

/* ---------- eventos ---------- */
$("#fecha").textContent = "datos del " + D.fecha;
$("#tabs").addEventListener("click", e => {
  const t = e.target.dataset.t; if (!t) return;
  S.tab = t; document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x.dataset.t === t));
  S.pais = t === "m" ? null : (sel[t] ?? (t === "3" ? null : "Ecuador"));
  S.paso = -1; S.ruta = null;
  if (t === "3" && !S.pais) map.setView([15, 10], 2);
  render(!!S.pais);
});
$("#esc").addEventListener("click", e => {
  const v = e.target.dataset.e; if (!v) return;
  S.esc = v; S.paso = -1; S.ruta = null;
  document.querySelectorAll("#esc button").forEach(x => x.classList.toggle("on", x.dataset.e === v));
  render(false);
});
$("#panel").addEventListener("click", e => {
  const el = e.target.closest("[data-pais],[data-ruta],[data-paso],[data-cable]"); if (!el) return;
  if (el.dataset.pais) { S.pais = el.dataset.pais; sel[S.tab] = S.pais; S.paso = -1; S.ruta = null; render(true); return; }
  if (el.dataset.cable) { const l = capaCable[el.dataset.cable]; l && map.fitBounds(l.getBounds(), { padding: [40, 40], maxZoom: 5 }); return; }
  if (el.dataset.ruta) {
    const i = +el.dataset.ruta; S.ruta = S.ruta === i ? null : i; S.paso = -1; render(S.ruta === null);
    if (S.ruta !== null) map.fitBounds(L.featureGroup(cablesDe(res()[S.pais].rutas[i]).map(id => capaCable[id])).getBounds(), { padding: [30, 30], maxZoom: 5 });
    return;
  }
  const n = res()[S.pais].pasos.length, a = el.dataset.paso;
  if (a === "prev") S.paso = S.paso === -1 ? n - 1 : S.paso - 1;
  if (a === "next") S.paso = S.paso === -1 ? 0 : (S.paso + 1 >= n ? -1 : S.paso + 1);
  if (a === "fin") S.paso = -1;
  S.ruta = null; render(false);
});
$("#panel").addEventListener("input", e => { if (e.target.id === "buscar") { S.filtro = e.target.value; pintarPanel(); } });

window.addEventListener("load", () => render(true));
