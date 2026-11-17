"""Descarga un snapshot de TeleGeography Submarine Cable Map (CC BY-SA 4.0).

Uso:  python3 scripts/descargar_datos.py
Deja todo en data/raw/ y anota la fecha en data/raw/FECHA.txt.
"""
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

API = "https://www.submarinecablemap.com/api/v3"
RAW = Path(__file__).resolve().parent.parent / "data" / "raw"


def get(path):
    for intento in range(4):
        try:
            req = urllib.request.Request(f"{API}/{path}", headers={"User-Agent": "mincutSCM-curso"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception:
            time.sleep(2 ** intento)
    raise RuntimeError(f"no se pudo descargar {path}")


def main():
    (RAW / "cables").mkdir(parents=True, exist_ok=True)
    for path, nombre in [("cable/all.json", "all.json"),
                         ("cable/cable-geo.json", "cable-geo.json"),
                         ("landing-point/landing-point-geo.json", "landing-point-geo.json")]:
        (RAW / nombre).write_text(json.dumps(get(path)))
    ids = [c["id"] for c in json.loads((RAW / "all.json").read_text())]

    def uno(cid):
        destino = RAW / "cables" / f"{cid}.json"
        if not destino.exists():
            destino.write_text(json.dumps(get(f"cable/{cid}.json")))

    # ponytail: 8 hilos para no saturar el servidor; ~1000 archivos en un par de minutos
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(uno, ids))
    (RAW / "FECHA.txt").write_text(date.today().isoformat() + "\n")
    print(f"{len(ids)} cables descargados en {RAW}")


if __name__ == "__main__":
    main()
