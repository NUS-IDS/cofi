#!/usr/bin/env bash
#
# DOCKER ENTRYPOINT
#
# This custom entrypoint sources environment secrets and export the relevant
# environment variables before calling the default entrypoint.

# install python requirements
if [ -r /requirements.txt ]; then 
    echo "Installing additional python dependencies."
    pip install --user --no-cache-dir -r /requirements.txt 
fi

# upgrade metadata database to latest version
echo "Upgrading metadata database to latest version."
airflow db upgrade

if [ -r /run/secrets/env ]; then
    echo "Creating Airflow UI users."
    names=$(sed -n -E 's/^AIRFLOW_UI_(\w+)_USER.*$/\1/p' /run/secrets/env)
    for name in $names; do
        echo "Creating $name Airflow UI user."
        username=$(sed -n -E "s/^AIRFLOW_UI_${name}_USER=(.*)$/\1/p" /run/secrets/env)
        pw=$(sed -n -E "s/^AIRFLOW_UI_${name}_PW=(.*)$/\1/p" /run/secrets/env)
        airflow users create -u $username -p $pw -f $username -l $username -r Admin -e $username@example.org
    done
fi

# schedule tasks
echo "Scheduling tasks."
if [ -r airflow-scheduler.pid ]; then
    echo "Killing pre-existing airflow scheduler process."
    kill $(cat airflow-scheduler.pid)
    rm airflow-scheduler.*
fi
airflow scheduler -D

# start webserver
echo "Starting webserver."
exec airflow webserver
