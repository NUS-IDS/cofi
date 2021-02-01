#!/bin/python
#
# BINARIES AND EXECUTABLES
# ========================
#
# This module holds executables that are useful for this project. Each
# executable file contains further information about their purpose. Files are
# named in order of use.
#
# This file contains helpers to faciltate executable development.

import os
import sys
import logging
import argparse
from pathlib import Path
from sqlalchemy import create_engine
from dotenv import load_dotenv, find_dotenv


def init_db_engine():
    """ Initializes a DB engine using environment variables. """

    WIFI_CONN = (
        f"postgres://"
        + f"{os.getenv('WIFI_USER')}:{os.getenv('WIFI_PW')}"
        + f"@0.0.0.0:{os.getenv('AGENS_PORT')}/wifidb"
    )
    logging.info(f"Database connection: {WIFI_CONN}")

    engine = create_engine(WIFI_CONN)

    return engine


def resolve_args(cli):
    """ Resolve CLI args, load env variables and adjust log. """

    args = cli.parse_args()

    if "env_file" in args:
        args.env_file = Path(args.env_file).resolve()

    load_dotenv(f"{args.env_file}")

    handlers = []
    handlers.append(logging.StreamHandler(sys.stdout))

    if ("log_save" in args) and args.log_save:
        handlers.append(
            logging.FileHandler(filename=args.output_dir / "{cli.prog}.log")
        )

    logging.basicConfig(
        level=logging.INFO,
        format="[{asctime} {filename}:{lineno} {levelname}]\n    {message}",
        style="{",
        handlers=handlers,
    )
    logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

    return args
