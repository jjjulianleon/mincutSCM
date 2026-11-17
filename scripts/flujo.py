"""Edmonds-Karp y corte mínimo, línea por línea como en las presentaciones de clase
(max-flow, diap. 5; min-cut, diap. 7).

La red es un dict de dicts: cap[u][v] = capacidad de la arista u -> v.
Como en CLRS §24.1, se exige que no haya aristas antiparalelas.
"""
import math
from collections import defaultdict, deque

INF = math.inf


class Red:
    def __init__(self, cap):
        for u in cap:
            for v in cap[u]:
                assert u not in cap.get(v, {}), f"arista antiparalela {u} <-> {v}"
        self.cap = cap
        self.ady = defaultdict(set)  # vecinos en G_f: aristas de G y sus inversas
        for u in cap:
            for v in cap[u]:
                self.ady[u].add(v)
                self.ady[v].add(u)
        self.f = defaultdict(lambda: defaultdict(int))  # flujo, solo en aristas de G

    def en_G(self, u, v):
        return v in self.cap.get(u, {})

    def cf(self, u, v):
        """Capacidad residual: directa c - f, o inversa f (lo que se puede deshacer)."""
        if self.en_G(u, v):
            return self.cap[u][v] - self.f[u][v]
        return self.f[v][u]

    def bfs(self, s):
        """Árbol BFS en G_f desde s: padre[v] para cada v alcanzable."""
        padre = {s: None}
        cola = deque([s])
        while cola:
            u = cola.popleft()
            for v in sorted(self.ady[u]):  # orden fijo: resultados reproducibles
                if v not in padre and self.cf(u, v) > 0:
                    padre[v] = u
                    cola.append(v)
        return padre


def edmonds_karp(red, s, t):
    """Devuelve (|f|, pasos). Cada paso = (camino de nodos, cuello b, aristas inversas usadas)."""
    valor, pasos = 0, []
    while True:
        padre = red.bfs(s)  # BFS: el camino aumentante de MENOS aristas
        if t not in padre:
            return valor, pasos
        camino = [t]
        while camino[-1] != s:
            camino.append(padre[camino[-1]])
        camino.reverse()
        aristas = list(zip(camino, camino[1:]))
        b = min(red.cf(u, v) for u, v in aristas)  # cuello de botella
        assert b < INF, "camino de capacidad infinita: no existe corte finito"
        inversas = []
        for u, v in aristas:
            if red.en_G(u, v):
                red.f[u][v] += b  # empujar
            else:
                red.f[v][u] -= b  # deshacer
                inversas.append((u, v))
        valor += b
        pasos.append((camino, b, inversas))


def corte_minimo(red, s):
    """S = alcanzables desde s en G_f. Devuelve (S, aristas de S a T)."""
    S = set(red.bfs(s))
    return S, [(u, v) for u in S for v in red.cap.get(u, {}) if v not in S]


def corte_cerca_de_t(red, t):
    """Otro corte mínimo: T = los que llegan a t en G_f. Si difiere del anterior,
    el corte mínimo no es único (min-cut, diap. 14)."""
    T = {t}
    cola = deque([t])
    while cola:
        v = cola.popleft()
        for u in red.ady[v]:
            if u not in T and red.cf(u, v) > 0:
                T.add(u)
                cola.append(u)
    return [(u, v) for u in red.cap for v in red.cap[u] if u not in T and v in T]


def rutas(red, s, t):
    """Descompone el flujo final en caminos s -> t (uno por unidad de flujo)."""
    g = {u: {v: red.f[u][v] for v in red.cap[u] if red.f[u][v] > 0} for u in red.cap}
    caminos = []
    while True:
        padre = {s: None}
        cola = deque([s])
        while cola and t not in padre:
            u = cola.popleft()
            for v in sorted(g.get(u, {})):
                if v not in padre and g[u][v] > 0:
                    padre[v] = u
                    cola.append(v)
        if t not in padre:
            return caminos
        camino = [t]
        while camino[-1] != s:
            camino.append(padre[camino[-1]])
        camino.reverse()
        b = min(g[u][v] for u, v in zip(camino, camino[1:]))
        for u, v in zip(camino, camino[1:]):
            g[u][v] -= b
        caminos.extend([camino] * int(b))
