import os
import pendulum
from pathlib import Path

WIFI_CONN = os.getenv(
    "AIRFLOW_CONN_WIFIDB",
    (
        f"postgres://"
        + f"agens:{os.getenv('AGENS_PW')}"
        + f"@0.0.0.0:{os.getenv('AGENS_PORT')}"
        f"/wifidb"
    ),
)

AIRFLOW_DEFAULT_ARGS = {"start_date": pendulum.parse("2021-01-19")}

AIRFLOW_DATA = Path(os.getenv("HOST_DATA", "/opt/airflow/data/"))
AIRFLOW_RAW = AIRFLOW_DATA / os.getenv("HOST_RAW", "raw")
AIRFLOW_IMPORT = AIRFLOW_DATA / os.getenv("HOST_IMPORT", "import")

RAW_GLOB = os.getenv("RAW_GLOB", r"*-v2.tsv")

POSTGRES_IMPORT = Path("/home/agens/import")
