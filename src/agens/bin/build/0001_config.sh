#!/bin/sh
#
# DATABASE CONFIGURATION
#
# Configure database by creating templates, loading extensions and creating
# users.
#

set -e

if [ -r /run/secrets/env ]; then
    echo "Exporting environment variables from secrets."
    export $(egrep "^(AGENS_PW|AGENS_AIRFLOW_USER|AGENS_AIRFLOW_PW|AGENS_WIFI_ADM_USER|AGENS_WIFI_ADM_PW)" /run/secrets/env | xargs)
fi

# Create the 'template_postgis' template db
# sourced from https://github.com/mcaramma/sv2/blob/master/initdb-postgis.sh
echo "Creating template_postgis."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_USER}:${AGENS_PW}@/postgres" <<- EOSQL
CREATE DATABASE template_postgis;
UPDATE pg_database SET datistemplate = TRUE WHERE datname = 'template_postgis';
EOSQL

# Load PostGIS into both template_database and $POSTGRES_DB
echo "Loading PostGIS and data wrapper extensions into template_postgis."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_USER}:${AGENS_PW}@/template_postgis" <<- EOSQL
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;
CREATE EXTENSION IF NOT EXISTS ogr_fdw;
CREATE EXTENSION IF NOT EXISTS postgres_fdw;
CREATE EXTENSION IF NOT EXISTS file_fdw;
EOSQL

# Create wifi and airflow databases
echo "Creating airflowdb database."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_USER}:${AGENS_PW}@/postgres" <<- EOSQL
CREATE DATABASE airflowdb
TEMPLATE template0;
EOSQL

echo "Creating wifidb database."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_USER}:${AGENS_PW}@/postgres" <<- EOSQL
CREATE DATABASE wifidb
TEMPLATE template_postgis;
EOSQL

#  Create data wrapper servers in wifi database.
echo "Creating extension servers in wifidb."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_USER}:${AGENS_PW}@/wifidb" <<- EOSQL
CREATE SERVER csv_fdw
FOREIGN DATA WRAPPER file_fdw;
EOSQL

# Create wifi and airflow users.
echo "Creating ${AGENS_AIRFLOW_USER}."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_USER}:${AGENS_PW}@/airflowdb" <<- EOSQL
BEGIN;
CREATE USER $AGENS_AIRFLOW_USER
WITH PASSWORD '$AGENS_AIRFLOW_PW';
ALTER DATABASE airflowdb
OWNER TO $AGENS_AIRFLOW_USER;
END;
EOSQL

psql -v ON_ERROR_STOP=1 "postgres://${AGENS_USER}:${AGENS_PW}@/wifidb" <<- EOSQL
CREATE ROLE wifiuser INHERIT;
EOSQL

echo "Creating ${AGENS_WIFI_ADM_USER}."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_USER}:${AGENS_PW}@/wifidb" <<- EOSQL
BEGIN;
CREATE USER $AGENS_WIFI_ADM_USER
WITH PASSWORD '$AGENS_WIFI_ADM_PW'
IN ROLE wifiuser;
ALTER DATABASE wifidb
OWNER TO $AGENS_WIFI_ADM_USER;
END;
BEGIN;
GRANT USAGE
ON FOREIGN DATA WRAPPER ogr_fdw
TO $AGENS_WIFI_ADM_USER;
GRANT USAGE
ON FOREIGN DATA WRAPPER file_fdw
TO $AGENS_WIFI_ADM_USER;
END;
EOSQL

if [ -r /run/secrets/env ]; then
    echo "Creating additional wifidb users."
    names=$(sed -n -E 's/^AGENS_WIFI_(\w+)_USER.*$/\1/p' /run/secrets/env)
    for name in $names; do
        if [ $name = "ADM" ]; then continue; fi
        echo "Creating $name user."
        username=$(sed -n -E "s/^AGENS_WIFI_${name}_USER=(.*)$/\1/p" /run/secrets/env)
        pw=$(sed -n -E "s/^AGENS_WIFI_${name}_PW=(.*)$/\1/p" /run/secrets/env)
        psql -v ON_ERROR_STOP=1 "postgres://${AGENS_USER}:${AGENS_PW}@/wifidb" <<- EOSQL
BEGIN;
CREATE USER $username
WITH PASSWORD '$pw'
IN ROLE wifiuser;
END;
EOSQL
    done
fi
