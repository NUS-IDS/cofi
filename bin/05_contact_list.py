#!/bin/python
#
# CONTACT LIST
# ============
#
# This executable produces a contact list of users who shared an access point
# for at least 10 minutes.
#
# The program took about 2 hours and 30 minutes to complete in a table with 90k
# userids and 13 million sessions. The warehouse was hosted in a server running
# with Intel Xeon E5 v4 2.20GHz with 40 CPU cores and 500Gb of total memory.
# The warehouse was deployed via Docker containers, only 20 CPU cores and 100Gb
# of memory were made available to it.

import logging
import argparse
from sqlalchemy import create_engine
from __init__ import resolve_args


def create_view(engine):

    with engine.begin() as conn:
        conn.execute(
            f"""
        CREATE MATERIALIZED VIEW IF NOT EXISTS views.contact_list AS
        SELECT *
        FROM (
            SELECT
                a.userid_key AS userid_key,
                b.userid_key AS userid_key_other,
                a.ap_key,
                GREATEST(a.session_start, b.session_start) AS overlap_start,
                LEAST(a.session_end, b.session_end) AS overlap_end,
                LEAST(a.session_end, b.session_end) - GREATEST(a.session_start, b.session_start) AS overlap_duration
            FROM views.stationary_session a, views.stationary_session b
            WHERE
                a.ap_key = b.ap_key AND
                (a.session_start, a.session_end) OVERLAPS (b.session_start, b.session_end) AND
                a.userid_key <> b.userid_key
        ) f
        WHERE f.overlap_duration > '10 minutes'
        ORDER BY userid_key, userid_key_other, overlap_end
        WITH NO DATA
        """
        )
        conn.execute(
            f"""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_contact_list_userid_key_userid_key_other_overlap_start
        ON views.contact_list (userid_key, overlap_start, userid_key_other)
        """
        )
        conn.execute("REFRESH MATERIALIZED VIEW views.contact_list")


def main(args):

    engine = create_engine(args.wifi_conn)
    logging.info("Creating the contact list.")
    create_view(engine)
    logging.info("Done.")


if __name__ == "__main__":

    cli = argparse.ArgumentParser(description="Creates the contact list.")
    args = resolve_args(cli)
    main(args)
