user_whereabouts = """
    SELECT
       ap.floor_key AS bdg_fl_key,
       ap.building_key,
       ap.FLOOR,
       f.START AS session_interval_start,
       COUNT(*) AS session_count 
    FROM
       (
          SELECT
             ap_key,
             generate_series( make_timestamp(EXTRACT(YEAR FROM session_start)::INTEGER, EXTRACT(MONTH FROM session_start)::INTEGER, EXTRACT(DAY FROM session_start)::INTEGER, EXTRACT(HOUR FROM session_start)::INTEGER, 15*(EXTRACT(MINUTE FROM session_start)::INTEGER / 15),0), make_timestamp(EXTRACT(YEAR FROM session_end)::INTEGER, EXTRACT(MONTH FROM session_end)::INTEGER, EXTRACT(DAY FROM session_end)::INTEGER, EXTRACT(HOUR FROM session_end)::INTEGER, 15*(EXTRACT(MINUTE FROM session_end)::INTEGER / 15),0), '15 minutes' ) AS START 
          FROM
             views.stationary_session 
          WHERE
             userid_key = {} 
       )
       f 
       JOIN
          dimension.ap 
          ON ap.key = f.ap_key 

    GROUP BY
       ap.floor_key,
       ap.building_key,
       ap.FLOOR,
       f.START
"""

user_layered_session_counts = """
    SELECT
      building_key,
      floor,
      concat(building_key,' ',floor) AS layer_key,session_interval_start,
      session_count
    FROM (
        SELECT
            building_key,
            EXTRACT(epoch FROM session_interval_start at time zone 'utc-8')::INTEGER AS session_interval_start,
            session_count::INTEGER as session_count,
            CASE
                WHEN floor = 'B1' THEN '0'
                WHEN floor = 'B2' THEN '0'
                WHEN floor = 'BS' THEN '1'
                WHEN floor = 'AU1' THEN '1'
                WHEN floor = 'AU2' THEN '1'
                WHEN floor = 'G01' THEN '1'
                else floor
            END::INTEGER AS floor
        FROM ({}) as _
        WHERE session_interval_start >= '{}' AND session_interval_start <= '{}'
        AND floor is NOT null AND floor != 'B1' and floor !='B2' AND floor != 'N/A'
    ) session_count_table_without_layer_key
    ORDER BY session_interval_start
"""

layered_session_counts = """
    SELECT
      building_key,
      floor,
      concat(building_key,' ',floor) AS layer_key,session_interval_start,
      session_count
    FROM (
        SELECT
            building_key,
            EXTRACT(epoch FROM session_interval_start at time zone 'utc-8')::INTEGER AS session_interval_start,
            session_count::INTEGER as session_count,
            CASE
                WHEN floor = 'B1' THEN '0'
                WHEN floor = 'B2' THEN '0'
                WHEN floor = 'BS' THEN '1'
                WHEN floor = 'AU1' THEN '1'
                WHEN floor = 'AU2' THEN '1'
                WHEN floor = 'G01' THEN '1'
                else floor
            END::INTEGER AS floor
        FROM views.bdg_fl_count
        WHERE session_interval_start >= '{}' AND session_interval_start <= '{}'
        AND floor is NOT null AND floor != 'B1' and floor !='B2' AND floor != 'N/A'
    ) session_count_table_without_layer_key
    ORDER BY session_interval_start
"""

user_non_layered_session_counts = """
    SELECT
      building_details.building_key,
      building_details.floor,
      concat(building_details.building_key,' ',building_details.floor) AS layer_key,session_interval_start,
      session_count
    FROM (
        SELECT 
            building_key,
            EXTRACT(epoch FROM session_interval_start at time zone 'utc-8')::INTEGER AS session_interval_start,
            SUM(session_count)::INTEGER as session_count
        FROM ({}) as _
        WHERE session_interval_start >= '{}' AND session_interval_start <= '{}'
        GROUP BY building_key, session_interval_start
    ) session_count_details
    join (SELECT building_key,
                    Max(floor) AS FLOOR
             FROM   (SELECT building_key,
                            CASE
                              WHEN floor = 'B1' THEN '0'
                              WHEN floor = 'B2' THEN '0'
                              WHEN floor = 'BS' THEN '1'
                              WHEN floor = 'AU1' THEN '1'
                              WHEN floor = 'AU2' THEN '1'
                              WHEN floor = 'G01' THEN '1'
                              ELSE floor
                            END :: INTEGER AS FLOOR
                     FROM   VIEWS.bdg_fl_count
                     WHERE  floor IS NOT NULL
                            AND floor != 'B1' and floor !='B2'
                            AND floor != 'N/A') _
             GROUP  BY building_key) building_details
         ON session_count_details.building_key = building_details.building_key
    ORDER BY session_interval_start
"""


non_layered_session_counts = """
SELECT building_details.building_key,
       building_details.floor,
       Concat(building_details.building_key, ' ', building_details.floor) AS
       layer_key,
       session_interval_start,
       session_count
FROM   (SELECT building_key,
               Extract(epoch FROM session_interval_start AT TIME zone 'utc-8')
               ::
               INTEGER AS
               session_interval_start,
               SUM(session_count) :: INTEGER
                      AS session_count
        FROM   VIEWS.bdg_fl_count
        WHERE  session_interval_start >= '{}'
               AND session_interval_start <= '{}'
        GROUP  BY building_key,
                  session_interval_start) session_count_details
       join (SELECT building_key,
                    Max(floor) AS FLOOR
             FROM   (SELECT building_key,
                            CASE
                              WHEN floor = 'B1' THEN '0'
                              WHEN floor = 'B2' THEN '0'
                              WHEN floor = 'BS' THEN '1'
                              WHEN floor = 'AU1' THEN '1'
                              WHEN floor = 'AU2' THEN '1'
                              WHEN floor = 'G01' THEN '1'
                              ELSE floor
                            END :: INTEGER AS FLOOR
                     FROM   VIEWS.bdg_fl_count
                     WHERE  floor IS NOT NULL
                            AND floor != 'B1' and floor !='B2'
                            AND floor != 'N/A') _
             GROUP  BY building_key) building_details
         ON session_count_details.building_key = building_details.building_key
ORDER  BY session_interval_start
"""

# Need to find out what is going on with ST_AsGeoJSON here.
# See https://stackoverflow.com/questions/42388451/how-to-convert-from-postgresql-to-geojson-format
# Also see https://dba.stackexchange.com/questions/27732/set-names-to-attributes-when-creating-json-with-row-to-json
# '6' in ST_AsGeoJSON means precision of GPS coordinates
buildings = """
    SELECT row_to_json(_)
    FROM (
        SELECT
          'FeatureCollection' AS type,
          'building' AS name,
          array_to_json(array_agg(_)) AS features
        FROM (
            SELECT
                'Feature' AS type,
                ST_AsGeoJSON((_.geom), 6, 0):: json AS geometry,
                (
                SELECT
                  row_to_json(_)
                FROM (SELECT _.key, _.zone, _.floor, _.area, _.lon, _.lat, _.description) _
                ) AS properties
            FROM (
                SELECT geom,st_area(geom::geography) area, key::text, floor, zone, lon, lat, description
                FROM dimension.building
                JOIN (
                    SELECT building_key, max(floor) AS floor
                    FROM (
                        SELECT
                          building_key,
                          CASE
                          WHEN floor = 'B1' THEN '0'
                          WHEN floor = 'B2' THEN '0'
                          WHEN floor = 'BS' THEN '1'
                          WHEN floor = 'AU1' THEN '1'
                          WHEN floor = 'AU2' THEN '1'
                          WHEN floor = 'G01' THEN '1'
                          else floor
                          END::INTEGER AS floor
                        FROM
                          views.bdg_fl_count
                        WHERE floor is NOT null AND floor != 'B1' and floor !='B2' AND floor != 'N/A'
                      ) _
                    GROUP BY building_key
                ) _ 
                ON key = building_key
            ) _
        ) _
    ) _
"""

users = """
SELECT JSON_AGG(key) FROM dimension.userid;
"""

session_overlaps = """
select userid_key_other as userid_key,overlap_start as session_start,overlap_end as session_end,overlap_duration from views.contact_list cl 
JOIN dimension.ap ap ON cl.ap_key = ap.key
where cl.userid_key = {} and
overlap_start < '{}' AND overlap_end > '{}';
"""

total_overlap_duration_per_userid = """
select userid_key_other as userid_key,extract(epoch from sum(overlap_duration)) as total_duration from views.contact_list cl 
JOIN dimension.ap ap ON cl.ap_key = ap.key
where cl.userid_key = {} and
cl.overlap_start < '{}' AND cl.overlap_end > '{}'
group by cl.userid_key_other
order by total_duration desc;
"""

simulation_check = """
SELECT key FROM simulation.params WHERE params = '{}';
"""

simulation_retrieve = """
SELECT location, elapsed, SUM(value) FROM simulation.results WHERE params_key = {} and metric = 'infection' GROUP BY location, elapsed;
"""