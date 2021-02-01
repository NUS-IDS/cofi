#!/bin/sh
#
# SCHEMAS
#
# Create database schemas and empty tables.
#
# ETL: Staging schema for extract, transform and load operations.
#
# DIMENSION: Dimensions captured during a Wi-Fi session such as user
# credentials, macaddress, access point information, etc.
#
# FACT: Facts about AP sessions in terms of fact keys and timestamp.
#

set -e

if [ -r /run/secrets/env ]; then
    echo "Exporting environment variables from secrets."
    export $(egrep "^(AGENS_PW|AGENS_WIFI_ADM_USER|AGENS_WIFI_ADM_PW)" /run/secrets/env | xargs)
fi

# ETL
echo "Creating etl schema."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_WIFI_ADM_USER}:${AGENS_WIFI_ADM_PW}@/wifidb" <<- EOSQL
CREATE TYPE ETLSTATUS AS ENUM ('ongoing', 'completed', 'quarantine');
EOSQL

psql -v ON_ERROR_STOP=1 "postgres://${AGENS_WIFI_ADM_USER}:${AGENS_WIFI_ADM_PW}@/wifidb" <<- EOSQL
BEGIN;
    CREATE SCHEMA IF NOT EXISTS etl;
    CREATE TABLE IF NOT EXISTS etl.etl (
        id            SERIAL NOT NULL,
        task_type      TEXT,
        task_name      TEXT,
        task_timestamp TIMESTAMP,
        status        ETLSTATUS,
        triggered     TIMESTAMP,
        PRIMARY KEY (id)
    );
END;
EOSQL

echo "Creating wifidb schemas."
for schema in "fact" "dimension" "views"; do
    echo "Creating schema $schema."
    psql -v ON_ERROR_STOP=1 "postgres://${AGENS_WIFI_ADM_USER}:${AGENS_WIFI_ADM_PW}@/wifidb" <<- EOSQL
CREATE SCHEMA IF NOT EXISTS ${schema};
    GRANT USAGE ON SCHEMA ${schema} TO wifiuser;
    ALTER DEFAULT PRIVILEGES FOR ROLE ${AGENS_WIFI_ADM_USER} IN SCHEMA ${schema}
    GRANT SELECT ON TABLES TO wifiuser;
EOSQL
    psql -v ON_ERROR_STOP=1 "postgres://${AGENS_USER}:${AGENS_PW}@/wifidb" <<- EOSQL
ALTER DEFAULT PRIVILEGES FOR ROLE ${AGENS_USER} IN SCHEMA ${schema}
    GRANT SELECT ON TABLES TO wifiuser;
EOSQL
done

# DIMENSION
echo "Creating dimension tables."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_WIFI_ADM_USER}:${AGENS_WIFI_ADM_PW}@/wifidb" <<- EOSQL
BEGIN;
    CREATE TYPE SESSIONSTATUS AS ENUM ('ongoing', 'completed');
    CREATE TABLE IF NOT EXISTS dimension.building(
        fid BIGINT,
        geom GEOMETRY(MultiPolygon, 4326),
        key TEXT,
        description TEXT,
        lon DOUBLE PRECISION,
        lat DOUBLE PRECISION,
        zone TEXT,
        UNIQUE(key)
    );
    CREATE TABLE IF NOT EXISTS dimension.userid(
        key  SERIAL PRIMARY KEY,
        name TEXT,
        UNIQUE(name)
    );
    CREATE TABLE IF NOT EXISTS dimension.mac(
        key     SERIAL PRIMARY KEY,
        address TEXT,
        UNIQUE(address)
    );
    CREATE TABLE IF NOT EXISTS dimension.ap(
        key  SERIAL PRIMARY KEY,
        name TEXT,
        path TEXT,
        area TEXT,
        building TEXT,
        floor TEXT,
        apid TEXT,
        prepopulated BOOLEAN,
        location_resolved_by_name BOOLEAN,
        rule_log TEXT,
        building_key TEXT REFERENCES dimension.building(key),
        description TEXT,
        it_prefix TEXT,
        it_description TEXT,
        floor_key INTEGER,
        UNIQUE(name, path)
    );
    CREATE TABLE IF NOT EXISTS dimension.ssid(
        key  SERIAL PRIMARY KEY,
        name TEXT,
        in_it_configuration BOOLEAN,
        tmp BOOLEAN,
        authentication_type TEXT,
        user_class TEXT,
        prepopulated BOOLEAN,
        UNIQUE(name)
    );
    CREATE TABLE IF NOT EXISTS dimension.protocol(
        key  SERIAL PRIMARY KEY,
        name TEXT,
        frequency NUMERIC,
        prepopulated BOOLEAN,
        UNIQUE(name)
    );
    CREATE TABLE IF NOT EXISTS dimension.day(
        key               SERIAL PRIMARY KEY,
        day               DATE,
        dow_number        INTEGER,
        dow_char          TEXT,
        month_number      INTEGER,
        month_char        TEXT,
        academic_year     TEXT,
        academic_semester TEXT,
        academic_week     TEXT,
        public_holiday    BOOLEAN,
        intervention      TEXT,
        prepopulated         BOOLEAN,
        UNIQUE(day)
    );
END;
EOSQL

# FACT
echo "Creating fact table."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_WIFI_ADM_USER}:${AGENS_WIFI_ADM_PW}@/wifidb" <<- EOSQL
BEGIN;
    CREATE TABLE IF NOT EXISTS fact.session(
            userid_key               INTEGER REFERENCES dimension.userid(key),
            mac_key                  INTEGER REFERENCES dimension.mac(key),
            ap_key                   INTEGER REFERENCES dimension.ap(key),
            ssid_key                 INTEGER REFERENCES dimension.ssid(key),
            protocol_key             INTEGER REFERENCES dimension.protocol(key),
            session_start            TIMESTAMP,
            session_start_day_key    INTEGER REFERENCES dimension.day(key),
            session_end              TIMESTAMP,
            session_end_day_key      INTEGER REFERENCES dimension.day(key),
            session_duration         INTERVAL,
            pulltime                 TIMESTAMP,
            pulltime_day_key         INTEGER REFERENCES dimension.day(key),
            pulltime_last            BOOLEAN,
            status                   SESSIONSTATUS,
            rssi                     INTEGER
    );
END;
EOSQL
