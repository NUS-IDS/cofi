#!/bin/sh
#
# PREPOPULATE DATABASE
#
# Pre-populate dimension tables.

# Perform all actions as $AGENS_WIFI_ADM_USER in the wifidb
export PGUSER=$AGENS_WIFI_ADM_USER
export PGDATABASE=wifidb
export PGPASSWORD=$AGENS_WIFI_ADM_PW

echo "Prepopulating dimension.building."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_WIFI_ADM_USER}:${AGENS_WIFI_ADM_PW}@/wifidb" <<- EOSQL
BEGIN;
    CREATE SERVER building_server
    FOREIGN DATA WRAPPER ogr_fdw
    OPTIONS (datasource '/home/agens/userdata/building.geojson', format 'GeoJSON');
    CREATE FOREIGN TABLE etl.building (
        fid BIGINT,
        geom GEOMETRY(MultiPolygon, 4326),
        key TEXT,
        description TEXT,
        lon DOUBLE PRECISION,
        lat DOUBLE PRECISION,
        zone TEXT
    )
    SERVER building_server
    OPTIONS (layer 'building');
    INSERT INTO dimension.building (
        fid,
        geom,
        key,
        description,
        lon,
        lat,
        zone
    )
    SELECT * FROM etl.building;
    DROP FOREIGN TABLE etl.building;
    DROP SERVER building_server;
END;
EOSQL

echo "Prepopulating dimension.user."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_WIFI_ADM_USER}:${AGENS_WIFI_ADM_PW}@/wifidb" <<- EOSQL
INSERT INTO dimension.userid (name) VALUES ('N/A');
EOSQL

echo "Prepopulating dimension.ap."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_USER}:${AGENS_PW}@/wifidb" <<- EOSQL
BEGIN;
    CREATE FOREIGN TABLE etl.ap (
        name TEXT,
        path TEXT,
        area TEXT,
        building TEXT,
        floor TEXT,
        apid TEXT,
        prepopulated BOOLEAN,
        location_resolved_by_name BOOLEAN,
        rule_log TEXT,
        building_key TEXT,
        description TEXT,
        it_prefix TEXT,
        it_description TEXT,
        floor_key INTEGER
    )
    SERVER csv_fdw
    OPTIONS (
        FILENAME '/home/agens/userdata/ap.csv',
        FORMAT 'csv',
        HEADER 'true'
    );
    INSERT INTO dimension.ap (
        name,
        path,
        area,
        building,
        floor,
        apid,
        prepopulated,
        location_resolved_by_name,
        rule_log,
        building_key,
        description,
        it_prefix,
        it_description,
        floor_key
    )
    SELECT * FROM etl.ap;
    DROP FOREIGN TABLE etl.ap;
END;
EOSQL

echo "Prepopulating dimension.ssid."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_USER}:${AGENS_PW}@/wifidb" <<- EOSQL
BEGIN;
    CREATE FOREIGN TABLE etl.ssid (
        name TEXT,
        in_it_configuration BOOLEAN,
        tmp BOOLEAN,
        authentication_type TEXT,
        user_class TEXT,
        prepopulated BOOLEAN
    )
    SERVER csv_fdw
    OPTIONS (
        FILENAME '/home/agens/userdata/ssid.csv',
        FORMAT 'csv',
        HEADER 'true'
    );
    INSERT INTO dimension.ssid (
        name,
        in_it_configuration,
        tmp,
        authentication_type,
        user_class,
        prepopulated
    )
    SELECT * FROM etl.ssid;
    DROP FOREIGN TABLE etl.ssid;
END;
EOSQL

echo "Prepopulating dimension.protocol."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_USER}:${AGENS_PW}@/wifidb" <<- EOSQL
BEGIN;
    CREATE FOREIGN TABLE etl.protocol (
        name TEXT,
        frequency NUMERIC,
        prepopulated BOOLEAN
    )
    SERVER csv_fdw
    OPTIONS (
        FILENAME '/home/agens/userdata/protocol.csv',
        FORMAT 'csv',
        HEADER 'true'
    );
    INSERT INTO dimension.protocol (
        name,
        frequency,
        prepopulated
    )
    SELECT * FROM etl.protocol;
    DROP FOREIGN TABLE etl.protocol;
END;
EOSQL

echo "Prepopulating dimension.day."
psql -v ON_ERROR_STOP=1 "postgres://${AGENS_USER}:${AGENS_PW}@/wifidb" <<- EOSQL
BEGIN;
    CREATE FOREIGN TABLE etl.day (
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
        pull_hours_missing INTEGER,
        prepopulated         BOOLEAN
    )
    SERVER csv_fdw
    OPTIONS (
        FILENAME '/home/agens/userdata/day.csv',
        FORMAT 'csv',
        HEADER 'true'
    );
    INSERT INTO dimension.day (
        day,
        dow_number,
        dow_char,
        month_number,
        month_char,
        academic_year,
        academic_semester,
        academic_week,
        public_holiday,
        intervention,
        pull_hours_missing,
        prepopulated
    )
    SELECT * FROM etl.day;
    DROP FOREIGN TABLE etl.day;
END;
EOSQL
