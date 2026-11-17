# mincutSCM: ¿cuántos cables submarinos tienen que fallar?

Resiliencia de la red de cables submarinos con **max-flow / min-cut** (CMP-4007 Algoritmos Avanzados).

1. **Ecuador.** ¿Cuántos cables tienen que fallar, como mínimo, para que Ecuador se quede sin ninguna ruta submarina hacia Estados Unidos? ¿Cuáles son?
2. **Ranking.** Con la misma medida, de más a menos resiliente: Ecuador, Colombia, Perú, Chile, Argentina, Uruguay, Brasil, Venezuela, Panamá y México.
3. **Abierta.** ¿Cuál es el país más resiliente del mundo? ¿Le creemos al resultado?

## Modelo

| Decisión | Elección |
|---|---|
| Vértices | Un vértice por país. Las estaciones de un mismo país se suponen conectadas por tierra. |
| Cables | Cada cable es un vértice de capacidad 1, partido en `C:id:in → C:id:out` (Erickson, *Algorithms*, §11.2). Las aristas `país → C:id:in` y `C:id:out → país` tienen capacidad ∞. Así, que un cable falle cuesta **1**, sin importar cuántos países toque. |
| Rutas | Una ruta puede pasar por otros países. |
| Cables incluidos | Escenario oficial: solo los cables en servicio (`is_planned = false`). Como comparación, hay un escenario que incluye los planeados. |
| Estados Unidos | Todo lo que el dataset etiqueta como `United States` (incluye Puerto Rico; Guam y las Islas Vírgenes de EE. UU. vienen como países aparte). |
| Medida ingenua | Número de cables que tocan el país y al menos otro país. Se usa para comparar y como segundo criterio en los empates. |

Como todas las capacidades son 1, max-flow = min-cut (teorema de Menger, Kleinberg & Tardos §7.6). El número de rutas que no comparten cable es igual al número mínimo de cables que hay que romper. Las rutas sirven de certificado de que con menos cables no alcanza, y el corte sirve de certificado de que con ese número sí alcanza.

## Uso

```bash
python3 scripts/descargar_datos.py     # snapshot de TeleGeography en data/raw/ (con fecha)
python3 scripts/test_flujo.py          # ejemplos de las presentaciones de clase
python3 scripts/calcular.py --pasos    # literales 1-3 en la terminal + genera docs/data.js
python3 scripts/calcular.py --pais Peru --planeados
python3 -m http.server -d docs 8000    # demo interactiva en http://localhost:8000
```

Solo usa la biblioteca estándar de Python 3.

- `scripts/flujo.py`: Edmonds-Karp y corte mínimo, línea por línea como en las presentaciones (max-flow, diap. 5; min-cut, diap. 7).
- `scripts/calcular.py`: arma la red, calcula los tres literales y exporta los resultados para la demo.
- `docs/`: mapa interactivo (Leaflet). Muestra el corte mínimo, las rutas independientes y cada aumento de Edmonds-Karp, en los dos escenarios.

## Fuentes y colaboración

- Datos: TeleGeography, *Submarine Cable Map*, https://www.submarinecablemap.com (CC BY-SA 4.0). Los datos derivados en `data/` y `docs/data.js` se comparten bajo la misma licencia. La fecha de descarga está en `data/raw/FECHA.txt`.
- Teoría: presentaciones de clase *Max-flow* y *Min-cut* (CMP-4007); Cormen et al., *Introduction to Algorithms* 4.ª ed., §24.1; Kleinberg & Tardos, *Algorithm Design*, §7.6; Erickson, *Algorithms*, cap. 10 y §11.1–11.2.
- Mapa base: Esri World Light Gray Canvas. Librería: Leaflet 1.9.4.
- Uso de IA: el código y la demo se escribieron con ayuda de Claude Code (Anthropic), un asistente de IA. Las decisiones de modelado se discutieron y aprobaron una por una por el autor del repositorio. Todos los resultados numéricos provienen de ejecutar este código sobre los datos descargados.
