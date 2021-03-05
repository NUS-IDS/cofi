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
from dotenv import load_dotenv, find_dotenv


def resolve_args(cli, with_env=True, with_verbose=True):
    """ Resolve CLI args, load env variables and adjust log. """

    if with_env:
        here = Path(__file__)
        cli.add_argument(
            "-e",
            "--env-file",
            default=(here / "../../.env"),
            metavar="",
            help=f"environment file with database connection settings (default={(here / '../../.env').resolve()})",
        )

    if with_verbose:
        cli.add_argument(
            "-v",
            "--verbose",
            action="store_true",
            help="log additional SQLAlchemy information",
        )

    args = cli.parse_args()

    if "env_file" in args:
        args.env_file = Path(args.env_file).resolve()

    load_dotenv(f"{args.env_file}")

    args.wifi_conn = (
        f"postgresql://"
        + f"{os.getenv('WIFI_USER')}:{os.getenv('WIFI_PW')}"
        + f"@0.0.0.0:{os.getenv('AGENS_PORT')}/wifidb"
    )

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

    if args.verbose:
        logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

    return args
