# Cofi: A Data Warehouse of Wi-Fi Sessions for Contact Tracing and Outbreak Investigation

To be better prepared for the emergence and re-emergence of coronavirus
epidemics, we seek to leverage on the availability of common existing digital
infrastructure such as the increasingly ubiquitous Wi-Fi networks that can be
readily activated to assist in large-scale contact tracing. 

This project implements an experimental data warehouse of Wi-Fi sessions for
contact tracing and disease outbreak investigation on a large local university
campus in Singapore.

The datasets and resources, which are not freely available for academic use,
are excluded.

## Data

This project focuses on analysing Wifi log sessions provided by the IT
department of a large local university in Singapore. For more information about
the data and data processing routines please see the [data
README.md](./src/agens/data/README.md) file.

## Repository structure

`src`
> Source-code to support project implementation, data wrangling, visualization
> and analysis. More info below.

`bin`
> Contains executables and routines for managing different parts of the
> project.


## Source-code

The source-code developed for this project is hosted in its dedicated
directory and support many tasks in the project.

`src/airflow`
> Contains Airflow DAGs that spin up a number of tasks for this project, such
> as the ETL process. It also contains a requirements.txt file with python
> dependencies that are installed when the container is created. To install new
> dependencies, it is possible to do it interactively with `docker exec`, but
> make sure to document it in the requirements file.

`src/agens`
> Contains the Dockerfile for the project's database and additional
> configuration. It also contains prepopulated tables and more information
> about the data.

## Development environment

It is possible to set up a development environment via Docker containers and
environment variables.

`docker-compose.yml`
> This spins up the required Docker containers for this project.

`.env-deploy`
> Environment variables. For local deployment, the recommendation is to copy
> this file to `.env` and tweak as required while maintaining an authoritative
> environment file.
