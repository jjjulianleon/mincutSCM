"""Comprobaciones con los ejemplos de las presentaciones y los de la conversación de modelado.
Uso: python3 scripts/test_flujo.py"""
from flujo import INF, Red, corte_minimo, edmonds_karp, rutas
from calcular import construir_red, nodo_pais


def test_presentacion_max_flow():
    cap = {"s": {"a": 3, "c": 9}, "a": {"d": 4, "b": 2}, "c": {"b": 5},
           "d": {"t": 2}, "b": {"t": 3}}
    red = Red(cap)
    valor, pasos = edmonds_karp(red, "s", "t")
    assert valor == 5 and len(pasos) == 4
    assert any(inv for _, _, inv in pasos), "algún aumento debe deshacer (usar una inversa)"
    S, cortadas = corte_minimo(red, "s")
    assert sum(cap[u][v] for u, v in cortadas) == 5


def test_presentacion_min_cut():
    cap = {"s": {"a": 6, "d": 9}, "a": {"c": 4, "b": 7}, "d": {"a": 8, "b": 1},
           "c": {"t": 8}, "b": {"t": 9}}
    red = Red(cap)
    valor, _ = edmonds_karp(red, "s", "t")
    S, cortadas = corte_minimo(red, "s")
    assert valor == 12 and S == {"s", "a", "d"}
    assert sorted(cortadas) == [("a", "b"), ("a", "c"), ("d", "b")]
    assert len(rutas(red, "s", "t")) == 12


def test_un_cable_tres_paises_cuenta_1():
    # opción C: un cable que toca Ecuador, Panamá y USA es UNA falla
    cables = [{"id": "x", "paises": ["Ecuador", "Panama", "United States"]}]
    red = Red(construir_red(cables))
    valor, _ = edmonds_karp(red, nodo_pais("Ecuador"), nodo_pais("United States"))
    assert valor == 1


def test_cuello_escondido():
    # 3 cables de Ecuador a Panamá, 1 de Panamá a USA: el corte es 1, no 3
    cables = [{"id": f"c{i}", "paises": ["Ecuador", "Panama"]} for i in (1, 2, 3)]
    cables.append({"id": "c4", "paises": ["Panama", "United States"]})
    red = Red(construir_red(cables))
    s, t = nodo_pais("Ecuador"), nodo_pais("United States")
    valor, _ = edmonds_karp(red, s, t)
    _, cortadas = corte_minimo(red, s)
    assert valor == 1 and cortadas == [("C:c4:in", "C:c4:out")]
    assert all(red.cap[u][v] != INF for u, v in cortadas)


if __name__ == "__main__":
    for nombre, fn in list(globals().items()):
        if nombre.startswith("test_"):
            fn()
            print("ok", nombre)
