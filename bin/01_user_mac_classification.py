#!/bin/python
#
# USER MAC CLASSIFICATION
# =======================
#
# This executable classifies userid-mac tuples into mobile and main, following
# the recommendations in Trivedi, Amee, Jeremy Gummeson, and Prashant Shenoy.
# “Empirical Characterization of Mobility of Multi-Device Internet Users.”
# ArXiv:2003.08512. http://arxiv.org/abs/2003.08512.
#
# Mobile (or always on) devices are those that are present in transitory
# sessions which are sessions that take place when an individual is
# transitioning from one place to another. We classify a userid-mac address
# pair as mobile if at least 10 percent of its sessions lasted less than 10
# minutes and if none of its sessions lasted over 24 hours. This is a very
# simple heuristic which could eventually be improved with additional modelling
# or empirical work.
#
# The mobile device that visited the largest number of locations on a given day
# is classified as the main (or primary) device for a given user on that day.
# Ties are broken arbitrarily (although not perfectly randomly). This allow us
# to track a single user despite his use of multiple devices. We assume that a
# user will carry his primary device to most of the places she/he visit on
# campus. Again more sophisticated modelling would be possible, but for now we
# will just employ this simple heuristic.
#

import logging
import argparse
from pathlib import Path
from sqlalchemy import create_engine
from __init__ import resolve_args


def create_dimension_table(engine):
    """ Create dimension table if it does not exist, insert new userid-mac pairs. """

    with engine.begin() as conn:
        conn.execute(
            f"""
        CREATE TABLE IF NOT EXISTS dimension.userid_mac (
            key SERIAL PRIMARY KEY,
            userid_key INTEGER REFERENCES dimension.userid(key),
            mac_key INTEGER REFERENCES dimension.mac(key),
            day_key INTEGER REFERENCES dimension.day(key),
            mobile BOOLEAN,
            main BOOLEAN,
            UNIQUE(userid_key, mac_key, day_key)
        )
        """
        )
        conn.execute(
            f"""
        INSERT INTO dimension.userid_mac (
            userid_key,
            mac_key,
            day_key,
            mobile,
            main
        )
        SELECT DISTINCT
            f.userid_key,
            f.mac_key,
            f.session_start_day_key,
            FALSE AS mobile,
            FALSE AS main
        FROM fact.session f, dimension.day d
        WHERE
            f.pulltime_last AND
            f.session_start_day_key = d.key AND
            d.pull_hours_missing = 0
        ON CONFLICT DO NOTHING
        """
        )


def classify_as_mobile(engine):
    """Classify userid-mac pairs as mobile or not.

    Mobile (or always on) devices are those that are present in transitory
    sessions which are sessions that take place when an individual is
    transitioning from one place to another. We classify a userid-mac address
    pair as mobile if at least 10 percent of its sessions lasted less than 10
    minutes and if none of its sessions lasted over 24 hours. This is a very
    simple heuristic which could eventually be improved with additional
    modelling or empirical work.
    """

    with engine.begin() as conn:
        conn.execute(
            f"""
        UPDATE dimension.userid_mac AS d SET mobile = FALSE
        """
        )
        conn.execute(
            f"""
        UPDATE dimension.userid_mac AS d SET mobile = TRUE
        FROM (
            SELECT a.userid_key, a.mac_key
            FROM (
                SELECT f.userid_key, f.mac_key, COUNT(*) AS total
                FROM fact.session f, dimension.day d
                WHERE
                    pulltime_last AND
                    f.session_start_day_key = d.key AND
                    d.pull_hours_missing = 0
                GROUP BY userid_key, mac_key
                HAVING NOT bool_or(session_duration > '24 hours')
            ) a
            JOIN (
                SELECT userid_key, mac_key, COUNT(*) AS total
                FROM fact.session f, dimension.day d
                WHERE
                    f.pulltime_last AND
                    f.session_duration < '10 minutes' AND
                    f.session_start_day_key = d.key AND
                    d.pull_hours_missing = 0
                GROUP BY userid_key, mac_key
            ) b
            ON a.userid_key = b.userid_key AND a.mac_key = b.mac_key
            WHERE (b.total::FLOAT / a.total::FLOAT) > 0.1
        ) f
        WHERE d.userid_key = f.userid_key AND d.mac_key = f.mac_key
        """
        )


def classify_as_main(engine):
    """Classify userid-mac pairs as main or not.

    The mobile device that visited the largest number of locations on a daily
    average is classified as the main (or primary) device for a given user.
    Ties are broken arbitrarily (although not perfectly randomly). This allow
    us to track a single user despite his use of multiple devices. We assume
    that a user will carry his primary device to most of the places she/he
    visit on campus. Again more sophisticated modelling would be possible, but
    for now we will just employ this simple heuristic.
    """

    with engine.begin() as conn:
        conn.execute(
            f"""
        UPDATE dimension.userid_mac AS d SET main = FALSE
        """
        )
        conn.execute(
            f"""
        UPDATE dimension.userid_mac AS u SET main = TRUE
        FROM (
            SELECT DISTINCT ON (f.userid_key, f.session_start_day_key) f.userid_key, f.mac_key, f.session_start_day_key
            FROM fact.session f, dimension.day d, dimension.userid_mac u
            WHERE
                pulltime_last AND
                f.session_start_day_key = d.key AND
                d.pull_hours_missing = 0 AND
                u.mobile AND
                u.userid_key = f.userid_key AND
                u.mac_key = f.mac_key AND
                u.day_key = f.session_start_day_key
            GROUP BY f.userid_key, f.mac_key, f.session_start_day_key
            ORDER BY f.userid_key, f.session_start_day_key, COUNT(*) DESC, f.mac_key
        ) f
        WHERE u.userid_key = f.userid_key AND u.mac_key = f.mac_key AND u.day_key = f.session_start_day_key
        """
        )


def main(args):

    engine = create_engine(args.wifi_conn)

    if args.force:
        logging.info(
            "Creating dimension.userid_mac and inserting new userid-mac pairs."
        )
        create_dimension_table(engine)

    logging.info("Classifying userid-mac pairs as mobile.")
    classify_as_mobile(engine)

    logging.info("Classifying userid-mac pairs as main.")
    classify_as_main(engine)


if __name__ == "__main__":

    cli = argparse.ArgumentParser(description="Classify user-mac pairs.")
    cli.add_argument(
        "-f",
        "--force",
        action="store_true",
        help="Re-create dimension table and insert new userid-mac pairs, otherwise just update.",
    )
    args = resolve_args(cli)
    main(args)
