"""Resiliencia de cables submarinos con min-cut.

Modelo (decisiones del planteamiento):
  1. Un vértice por país (las estaciones de un país se conectan por tierra).
  2. Cada cable es un vértice con capacidad 1: C:id:in -> C:id:out (Erickson §11.2).
     Las aristas país -> C:id:in y C:id:out -> país tienen capacidad infinita.
  3. Una ruta puede pasar por otros países.
  4. Escenario oficial: solo cables en servicio (is_planned = false).
  5. "Estados Unidos" = lo que TeleGeography etiqueta "United States".

Uso:
  python3 scripts/calcular.py                 # literales 1, 2 y 3 en la terminal + docs/data.js
  python3 scripts/calcular.py --pais Peru --pasos
  python3 scripts/calcular.py --planeados     # escenario con cables planeados
"""
import argparse
import json
from pathlib import Path

from flujo import INF, Red, corte_cerca_de_t, corte_minimo, edmonds_karp, rutas

RAIZ = Path(__file__).resolve().parent.parent
RAW = RAIZ / "data" / "raw"
USA = "United States"
LISTA_10 = ["Ecuador", "Colombia", "Peru", "Chile", "Argentina", "Uruguay",
            "Brazil", "Venezuela", "Panama", "Mexico"]


def nodo_pais(p):
    return "P:" + p


def construir_red(cables):
    """cables: [{'id', 'paises'}]. Solo sirven los que tocan 2+ países."""
    cap = {}
    for c in cables:
        if len(c["paises"]) < 2:
            continue
        cin, cout = f"C:{c['id']}:in", f"C:{c['id']}:out"
        cap[cin] = {cout: 1}
        cap[cout] = {nodo_pais(p): INF for p in c["paises"]}
        for p in c["paises"]:
            cap.setdefault(nodo_pais(p), {})[cin] = INF
    return cap


def cargar_cables():
    cables = []
    for f in sorted((RAW / "cables").glob("*.json")):
        d = json.loads(f.read_text())
        cables.append({
            "id": d["id"], "nombre": d["name"], "planeado": bool(d.get("is_planned")),
            "rfs": d.get("rfs_year"), "lps": [lp["id"] for lp in d["landing_points"]],
            "paises": sorted({lp["country"] for lp in d["landing_points"]}),
            "lp_info": d["landing_points"],
        })
    return cables


def a_tokens(camino, inversas=()):
    """Camino de nodos -> [{'p': país} | {'c': cable, 'inv': bool}]."""
    inv = set(inversas)
    out = []
    for i, n in enumerate(camino):
        if n.startswith("P:"):
            out.append({"p": n[2:]})
            continue
        cid = n.split(":")[1]
        toca = {(camino[i - 1], n)} | ({(n, camino[i + 1])} if i + 1 < len(camino) else set())
        usa_inversa = bool(toca & inv)
        if out and out[-1].get("c") == cid:
            out[-1]["inv"] = out[-1]["inv"] or usa_inversa
        else:
            out.append({"c": cid, "inv": usa_inversa})
    return out


def cables_de_corte(aristas):
    return sorted(u.split(":")[1] for u, v in aristas)


def analizar(cables, pais):
    red = Red(construir_red(cables))
    s, t = nodo_pais(pais), nodo_pais(USA)
    if s not in red.cap or t not in red.cap:
        return {"v": 0, "corte": [], "corte_alt": None, "rutas": [], "pasos": []}
    valor, pasos = edmonds_karp(red, s, t)
    _, aristas = corte_minimo(red, s)
    corte = cables_de_corte(aristas)
    alt = cables_de_corte(corte_cerca_de_t(red, t))
    assert len(corte) == valor == len(alt), "el corte debe certificar el flujo"
    return {
        "v": valor, "corte": corte, "corte_alt": alt if alt != corte else None,
        "rutas": [a_tokens(r) for r in rutas(red, s, t)],
        "pasos": [{"t": a_tokens(c, inv), "b": b} for c, b, inv in pasos],
    }


def escenario(cables, con_planeados):
    usados = [c for c in cables if con_planeados or not c["planeado"]]
    intl = [c for c in usados if len(c["paises"]) >= 2]
    paises = sorted({p for c in intl for p in c["paises"]} - {USA})
    res = {}
    for p in paises:
        r = analizar(intl, p)
        r["ing"] = sum(1 for c in intl if p in c["paises"])  # medida ingenua
        res[p] = r
    return res


def ranking(res, paises):
    # mayor corte primero; empate -> más cables (medida ingenua); luego nombre
    return sorted(paises, key=lambda p: (-res[p]["v"], -res[p]["ing"], p))


def exportar(cables, esc):
    geo = json.loads((RAW / "cable-geo.json").read_text())
    lineas, color = {}, {}
    for ft in geo["features"]:
        cid = ft["properties"]["id"]
        color[cid] = ft["properties"].get("color", "#888")
        g = ft["geometry"]
        partes = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        lineas.setdefault(cid, []).extend(
            [[round(x, 2), round(y, 2)] for x, y in parte] for parte in partes)
    pais_lp = {lp["id"]: lp["country"] for c in cables for lp in c["lp_info"]}
    lps = {}
    for ft in json.loads((RAW / "landing-point-geo.json").read_text())["features"]:
        pid = ft["properties"]["id"]
        x, y = ft["geometry"]["coordinates"]
        lps[pid] = [round(x, 3), round(y, 3), ft["properties"]["name"], pais_lp.get(pid, "")]
    data = {
        "fecha": (RAW / "FECHA.txt").read_text().strip(),
        "cables": {c["id"]: {"n": c["nombre"], "col": color.get(c["id"], "#888"),
                             "plan": c["planeado"], "rfs": c["rfs"], "paises": c["paises"],
                             "lps": c["lps"]} for c in cables},
        "geo": lineas, "lps": lps, "lista10": LISTA_10, "esc": esc,
    }
    destino = RAIZ / "docs" / "data.js"
    destino.write_text("window.DATA = " + json.dumps(data, separators=(",", ":")) + ";\n")
    return destino


def imprimir(res, cables, pais, pasos):
    nombre = {c["id"]: c["nombre"] for c in cables}
    r = res[pais]
    def txt(tokens):
        return " → ".join(t["p"] if "p" in t else f"[{nombre[t['c']]}]" + (" (inversa)" if t["inv"] else "")
                          for t in tokens)
    print(f"\n=== {pais} → {USA} ===")
    print(f"cables internacionales que tocan {pais} (medida ingenua): {r['ing']}")
    print(f"mínimo de cables que deben fallar (min-cut): {r['v']}")
    print("un corte mínimo:", ", ".join(nombre[c] for c in r["corte"]) or "—")
    if r["corte_alt"]:
        print("otro corte mínimo:", ", ".join(nombre[c] for c in r["corte_alt"]))
    print(f"{len(r['rutas'])} rutas que no comparten cable (certifican que no basta con menos):")
    for i, ru in enumerate(r["rutas"], 1):
        print(f"  {i}. {txt(ru)}")
    if pasos:
        print("aumentos de Edmonds-Karp:")
        for i, p in enumerate(r["pasos"], 1):
            print(f"  aumento {i} (cuello {p['b']}): {txt(p['t'])}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pais", default="Ecuador")
    ap.add_argument("--pasos", action="store_true")
    ap.add_argument("--planeados", action="store_true")
    a = ap.parse_args()
    cables = cargar_cables()
    esc = {"servicio": escenario(cables, False), "planeados": escenario(cables, True)}
    res = esc["planeados" if a.planeados else "servicio"]
    print(f"Datos: TeleGeography Submarine Cable Map (CC BY-SA 4.0), descargados el "
          f"{(RAW / 'FECHA.txt').read_text().strip()}. Escenario: "
          f"{'con planeados' if a.planeados else 'solo en servicio'}.")
    imprimir(res, cables, a.pais, a.pasos)
    print("\n=== Literal 2: ranking (más → menos resiliente) ===")
    for i, p in enumerate(ranking(res, LISTA_10), 1):
        print(f"  {i:2}. {p:10}  min-cut = {res[p]['v']:2}   cables = {res[p]['ing']}")
    print("\n=== Literal 3: top 10 mundial ===")
    for i, p in enumerate(ranking(res, list(res))[:10], 1):
        print(f"  {i:2}. {p:22}  min-cut = {res[p]['v']:2}   cables = {res[p]['ing']}")
    print(f"\nescrito {exportar(cables, esc).relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
