from tornado.web import Application, RequestHandler
from tornado.ioloop import IOLoop

import querybank

import os
import psycopg2
from datetime import datetime
import json
import copy
import logging
import traceback
import io
import csv
# Set logging threshold level
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)


def timer(func):
    """
    Displays execution time of encapsulated function
    """

    def aux(*args, **kwargs):
        from datetime import datetime

        timer_start = datetime.now()
        result = func(*args, **kwargs)
        timer_end = datetime.now()
        logging.debug("This function took {} to run".format(timer_end - timer_start))
        return result

    return aux


def connect_to_db():
    """
    Connect to wifidb and returns the connection cursor
    """
    user = os.getenv("WIFI_USER")
    password = os.getenv("WIFI_PW")
    conn = psycopg2.connect(
        "host=wifi_db dbname=wifidb user=" + user + " password=" + password
    )
    cur = conn.cursor()
    return cur


def get_user_whereabouts_table(
    start_string="2019-12-05 00:00:00", end_string="2019-12-31 23:00:00", layered="1"
,userid_key=4005):
    try:
        # Validate input strings
        start = datetime.strptime(start_string, "%Y-%m-%d %H:%M:%S")
        end = datetime.strptime(end_string, "%Y-%m-%d %H:%M:%S")
    except ValueError as e:
        logging.error(e)
        return None
    date_format = r"%Y-%m-%d %H:%M:%S"
    start_timestamp = start.strftime(date_format)
    end_timestamp = end.strftime(date_format)
    # Extract building_key, session_interval_start as epoch seconds integer, and session counts for each building at every timestamp
    try:
        cur = connect_to_db()
        if layered == "0":
            logging.info("Retrieving user non-layered session counts...")
            sql_query = querybank.user_non_layered_session_counts.format(
                querybank.user_whereabouts.format(str(userid_key)),start_timestamp, end_timestamp
            )
        else:
            logging.info("Retrieving user layered session counts...")
            sql_query = querybank.user_layered_session_counts.format(
                querybank.user_whereabouts.format(str(userid_key)),start_timestamp, end_timestamp
            )
        cur.execute(sql_query)
    except Exception as e:
        logging.error(traceback.format_exc())
        return None
    else:
        # Save sql results as tsv_string
        values = cur.fetchall()
        columns = [desc[0] for desc in cur.description]
        output = io.StringIO()
        tsv_writer = csv.writer(output, delimiter="\t", lineterminator="\n")
        tsv_writer.writerow(columns)
        for row in values:
            tsv_writer.writerow(row)
        tsv_string = output.getvalue()

    return tsv_string


def get_session_count_table(
    start_string="2019-12-01 21:00:00", end_string="2019-12-01 23:00:00", layered="0"
):
    """
    INPUT: Starting timestamp string and Ending timestamp string in UTC+8.
    OUTPUT: TSV string where each row denotes total session count for
    a building or for a building floor (if layered=True) at a given timestamp
    (session_interval_start). Timestamps are given in epoch seconds in UTC+8.
    """
    try:
        # Validate input strings
        start = datetime.strptime(start_string, "%Y-%m-%d %H:%M:%S")
        end = datetime.strptime(end_string, "%Y-%m-%d %H:%M:%S")
    except ValueError as e:
        logging.error(e)
        return None
    date_format = r"%Y-%m-%d %H:%M:%S"
    start_timestamp = start.strftime(date_format)
    end_timestamp = end.strftime(date_format)
    # Extract building_key, session_interval_start as epoch seconds integer, and session counts for each building at every timestamp
    try:
        cur = connect_to_db()
        if layered == "0":
            logging.info("Retrieving non-layered session counts...")
            sql_query = querybank.non_layered_session_counts.format(
                start_timestamp, end_timestamp
            )
        else:
            logging.info("Retrieving layered session counts...")
            sql_query = querybank.layered_session_counts.format(
                start_timestamp, end_timestamp
            )
        cur.execute(sql_query)
    except Exception as e:
        logging.error(traceback.format_exc())
        return None
    else:
        # Save sql results as tsv_string
        values = cur.fetchall()
        columns = [desc[0] for desc in cur.description]
        output = io.StringIO()
        tsv_writer = csv.writer(output, delimiter="\t", lineterminator="\n")
        tsv_writer.writerow(columns)
        for row in values:
            tsv_writer.writerow(row)
        tsv_string = output.getvalue()

    return tsv_string


def get_buildings(layered="0"):
    # Extract building spatial data or floor-by-floor
    try:
        cur = connect_to_db()
        sql_query = querybank.buildings
        cur.execute(sql_query)
    except Exception as e:
        logging.error(traceback.format_exc())
        values = ""
    else:
        values = cur.fetchall()[0][0]
        expanded_features = []
        # To estimate total building heights, we define average building floor height as 4 metres
        building_floor_height = 4
        if layered == "0":
            # Non-layered session counts
            # For each building
            #   set its base height to zero metres (ground level),
            #   height as highest_floor_number * building_floor_height (a rough estimate of building total height),
            #   name its layer_key after its building_key + highest_floor_number
            for building in values["features"]:
                highest_floor_number = building["properties"]["floor"]
                building["properties"]["base_height"] = 0
                building["properties"]["height"] = (
                    int(highest_floor_number) * building_floor_height
                )
                building["properties"]["layer_key"] = (
                    building["properties"]["key"] + " " + str(highest_floor_number)
                )
                expanded_features.append(building)
        else:
            # Layered session counts
            # For each building
            #   For each floor
            #     clone the current `building` dictionary as `building_floor`
            #     set its base height to the calculated height of the previous floor [(floor_number - 1) * building_floor_height],
            #     height as floor_number * building_floor_height,
            #     name its layer_key after its building_key + its floor_number
            for building in values["features"]:
                for floor_number in range(1, int(building["properties"]["floor"]) + 1):
                    building_floor = copy.deepcopy(building)
                    building_floor["properties"]["floor"] = str(floor_number)
                    building_floor["properties"]["base_height"] = (
                        int(floor_number) - 1
                    ) * building_floor_height
                    building_floor["properties"]["height"] = (
                        int(floor_number) * building_floor_height
                    )
                    building_floor["properties"]["layer_key"] = (
                        building_floor["properties"]["key"] + " " + str(floor_number)
                    )
                    expanded_features.append(building_floor)

        values["features"] = expanded_features
        return json.dumps(values)

def get_userid_keys():
    # Get list of userid_keys
    try:
        cur = connect_to_db()
        sql_query = querybank.users
        cur.execute(sql_query)
    except Exception as e:
        logging.error(traceback.format_exc())
        values = ""
    else:
        values = cur.fetchall()[0][0]
    return json.dumps(values)

def get_session_overlaps(userid_key,end_timestamp,start_timestamp):
    date_format = r"%Y-%m-%d %H:%M:%S"
    try:
        cur = connect_to_db()
        sql_query = querybank.session_overlaps.format(userid_key,end_timestamp,start_timestamp)
        cur.execute(sql_query)
    except Exception as e:
        logging.error(traceback.format_exc())
    else:
        overlaps = [{"userID":value[0],"startDate":value[1].strftime(date_format),"endDate":value[2].strftime(date_format)} for value in cur.fetchall()]
        
    try:
        cur = connect_to_db()
        sql_query = querybank.total_overlap_duration_per_userid.format(userid_key,end_timestamp,start_timestamp)
        cur.execute(sql_query)
    except Exception as e:
        logging.error(traceback.format_exc())
    else:
        # totalDuration is in seconds
        total_overlap_duration_per_userid = [{"userID":value[0],"totalDuration":value[1]} for value in cur.fetchall()]

    return json.dumps({"overlaps":overlaps,"total_overlap_duration_per_userid":total_overlap_duration_per_userid})

def get_simulation(params):
    simulation_data_available = False
    params_key = None
    
    try:
        cur = connect_to_db()
        sql_query = querybank.simulation_check.format(params)
        cur.execute(sql_query)
    except Exception as e:
        logging.error(traceback.format_exc())
    else:
        values = cur.fetchall()
        if len(values) == 1:
            simulation_data_available = True
            params_key = values[0][0]
    if simulation_data_available:
        try:
            cur = connect_to_db()
            sql_query = querybank.simulation_retrieve.format(params_key)
            cur.execute(sql_query)
        except Exception as e:
            logging.error(traceback.format_exc())
        else:
            values = cur.fetchall()
            return json.dumps({})
    else:
        return json.dumps({})


class SessionCount(RequestHandler):
    def set_default_headers(self):
        # Setting headers for Access Control
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "x-requested-with")
        self.set_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    def options(self):
        # no body
        self.set_status(204)
        self.finish()

    @timer
    def get(self):
        start_string = self.get_query_argument("start_timestamp")
        end_string = self.get_query_argument("end_timestamp")
        layered = self.get_query_argument("layered")
        userid_key = self.get_query_argument("userid_key")
        if userid_key == "false":
            response = get_session_count_table(start_string, end_string, layered)
        else:
            response = get_user_whereabouts_table(start_string, end_string, layered, userid_key)

        self.write(response)


class Buildings(RequestHandler):
    def set_default_headers(self):
        # Setting headers for Access Control
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "x-requested-with")
        self.set_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    def options(self):
        # no body
        self.set_status(204)
        self.finish()

    def get(self):
        layered = self.get_query_argument("layered")
        response = get_buildings(layered)
        self.write(response)


class Users(RequestHandler):
    def set_default_headers(self):
        # Setting headers for Access Control
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "x-requested-with")
        self.set_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    def options(self):
        # no body
        self.set_status(204)
        self.finish()

    def get(self):
        response = get_userid_keys()
        self.write(response)

class SessionOverlaps(RequestHandler):
    def set_default_headers(self):
        # Setting headers for Access Control
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "x-requested-with")
        self.set_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    def options(self):
        # no body
        self.set_status(204)
        self.finish()

    def get(self):
        #building_key = self.get_query_argument("building_key")
        #floor = self.get_query_argument("floor")
        userid_key = self.get_query_argument("userid_key")
        end_timestamp = self.get_query_argument("end_timestamp")
        start_timestamp = self.get_query_argument("start_timestamp")
        response = get_session_overlaps(userid_key,end_timestamp,start_timestamp)
        self.write(response)

class Simulation(RequestHandler):
    def set_default_headers(self):
        # Setting headers for Access Control
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "x-requested-with")
        self.set_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    def options(self):
        # no body
        self.set_status(204)
        self.finish()

    def get(self):
        params = self.get_query_argument("params")
        response = get_simulation(params)
        self.write(response)


def make_app():
    urls = [("/api/session_counts", SessionCount), ("/api/buildings", Buildings), ("/api/users", Users), ("/api/session_overlaps", SessionOverlaps), ("/api/simulation", Simulation)]
    return Application(urls, debug=True)


# Given a start_timestamp and end_timestamp, return all sessions between those 2 timestamps
if __name__ == "__main__":
    app = make_app()
    app.listen(8001)
    IOLoop.instance().start()
