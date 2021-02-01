# README for `src/agens/data`

This document contains a discussion about the data required for this warehouse.

## Raw data

Raw data consists of flat, tab-delimited files without headers. The raw files
are placed in a single directory named after the date in which they were pulled
as `YYYY_MM_DD_HH_mm_ss.tsv`.

Each line of the logfile contains the following fields:

> * username: hashed username.
> * macaddress: hashed mac address.
> * protocol: wifi protocol used during the session.
> * apname: ap name, usually in the format <building>-<floor>-<apid>.
> * location: hierarchical location path for internal use by IT.
>   usually in the format <area> > <building> > <floor>.
> * ssid: ssid used during the session.
> * sessionstarttime: session start time in ms from epoch, in UTC+00:00
> * sessionendtime: session end time in ms from epoch, in UTC+00:00
> * pulltime: time data was pulled from IT system in s from epoch, in UTC+00:00
> * rssi: received signal strength indication, likely in
>   dBm (needs confirmation)

Wifi session logs are logged at 5 minutes interval. If a session is not
over, `sessionendtime` will be equal to `2100-01-01`. Whenever the session
is completed, `sessionendtime` will have the correct expire time of the
session and this session will not be logged in the system anymore.

The raw data preprocessing routine is located in 
`src/airflow/dag/dag_etl.py::preprocess_callable`. The main idea of this 
routine is to pick for every unique session its latest entry in the 
current logfile, raising errors in case there are any inconsistencies.

As of version 0.5 of the database there are some issues with the raw data:

* some sessions have a start time later than the end and/or the pull time, this
  seems to be caused by sessions with a start and end time within the same log
  window;

* some sessions had the exact same session start time despite taking place in
  different APs.

## ETL

The logs extracted from the source database are stored in csv files named after
the time in which they were extracted ("pulltime"). Each row in those files
contains information about wifi sessions. When sessions expire they will have a
corresponding end time. Otherwise, the end time field will have a value
representing a missing value (ie a date very far in the future) and the
observation will have a non-empty pulltime value. A row is generated for each
open session every 5 minutes with an updated pulltime.

First we consolidate all sessions into a single row. Sessions are grouped
according to the session start day. The sessions ingested in the database will
have an end time which corresponds to either the actual end time or the latest
pull time. For every new pull, we update all sessions in our consolidated
database that have duplicate start time, username and macaddress. That way we
ensure that all sessions are unique and each row spans the whole duration of a
session.

In practical terms we split the log file obtained from the source database into
smaller files for each day in the raw file. Creating a new table for a given
day is a cheap operation, since we just copy the data from the first file with
observations from a given day. Any new file that contains information about
sessions that started in a previous day, we cause a deduplicate operation in
the existing table which is a more expensive operation. Therefore, this process
assumes that the bulk of the data for a given day is ingested the first time
the table is created. If we pull new data once a day, this is a valid
assumption.

The whole ETL process is managed with Airflow.

## User and Mac addresses

The username and mac addresses are hashed according to a routine outside of our
control. However, it is knwon that the hashing algorihtm always produces the
same output given an input.

For now, we do not generate any pre-populated table of user and mac addresses
since we do not associate any additional information with these dimensions.

## Dates

The database contains log sessions from 3rd December 2019 to 17 January 2021 inclusive, except for dates from 30th July 2020 to 26th October 2020 inclusive, and 19th November 2020.

We create a pre-populated table with dates that appear on the database with
associated key events and information, field description follows below:

`day.csv`
> * day: date formatted as YYYY-MM-DD.
> * dow_number: day of the week as number, from 1=Sunday to 7=Saturday.
> * dow_char: day of the week as a 3 characters abbreviation.
> * month_number: month as number.
> * month_char: month as a 3 characters abbreviations.
> * academic_year: university academic year
> * academic_semester: university academic semester
> * academic_week: academic week label
> * public_holiday: whether day is a public holiday
> * intervention: COVID-19 interventions
> * pull_hours_missing: number of hour intervals with no recorded sessions

## SSID

In a Wifi network the service set identifier (SSID) is the primary name
associated with an 802.11 wireless local area network. This is the network name
that generally appears to users when they connect to a Wifi network.

We create a pre-populated table of SSID names that appear on the database,
field description follows below:

`ssid.csv`
> * name: service set identifier (SSID) name, primary name associated with an
>    802.11 wireless local area network.
> * in_it_configuration: whether SSID belongs to IT configuration.
> * tmp: whether SSID is temporary, missing if SSID does not belong to IT configuration.
> * authentication type: type of authentication required to connect to the
>    SSID, missing if SSID is temporary or does not belong to IT
>    configuration.
> * user_class: class of users allowed to use the SSID, either staff, student,
>   mobile phone (anyone with a mobile phone), eduroam alliance (anyone from an
>   education institution belonging to eduroam alliance), etc.

## Protocol

The Wifi network is implemented according to a set of media access control
(MAC) and physical layer (PHY) protocols in various frequencies, most popularly
2.4GHz and 5GHz. The family of IEEE 802 standards specify a number of protocols
associated with local area networks (a Wifi network is a type of local area network).

We create a pre-populated table of protocols that appear on the database, field description follows below:

`protocol.csv`
> * name: protocol name.
> * frequency: radio frequency in GHz.

## Access points

The location information contained in the raw AP data is processed according to
`src/bin/clean_ap_locations.py`. The source code that contains the routine to
generate the above file tries to be as commented as possible to ensure that
data wrangling is well documented. This script will be specific to different
organization settings. Based on this routine we create a pre-populated table of
aps that appear on the database, field description follows below:

`ap.csv`
> * name: AP name in the raw data.
> * path: AP path in the raw data.
> * area: derived AP area.
> * building: derived AP building.
> * floor: derived AP floor.
> * apid: derived AP ID, not necessarily unique and could be missing.
> * resolved_by_name: whether AP information could be extracted exclusively
>   from the name field.
> * rule_log: rules applied to AP name and path to extract its information.
> * building_key: the building key which is the foreign key to the
>   dimension.building table.
> * description: a description of the building.
> * nusit_prefix: prefix of the building assigned by NUSIT.
> * nusit_description: description of the building by NUSIT.
> * floor_key: the building-floor key.

In our case, about 93 percent of all the APs have a name which is consistent
with the IT naming convention. There are still a number of APs that do not
contain any location information, in which case we mark them as unresolved.

The extracted information is then manually merged with the geospatial data 
to generate the final AP prepopulated table.

## Geospatial data

The geospatial data was manually compiled by the team using a combination of
OpenstreetMaps, GoogleMaps and university data. The IT focal point also shared
with us a list of location acronyms that were used to identify buildings
derived from the AP data in these external geospatial datasets.  We also used
our own interpretation of names and acronyms to locate buildings that were not
in the IT acronym list and where this list was unclear and/or missing.

All of the geographical information was compiled in `./building.geojson`.  Each
geometry contains the following additional features:

> * key: the building key used throughout the project.
> * description: a building description, usually its name.
> * lon: building centroid longitude.
> * lat: building centroid latitude.
> * zone: university COVID-19 zones.
