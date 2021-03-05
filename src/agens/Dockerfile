#
# AGENS GRAPH DOCKERFILE
#

# Many parts of this Dockerfile come from the official Postgres Dockerfile.
# Since AgensGraph is a customized Postgres database, it is a good idea to
# align this file with the Postgres one.
FROM debian:buster-slim

ENV LC_ALL en_US.UTF-8
ENV LC_CTYPE en_US.UTF-8
ENV SRC_FOLDER /usr/local/src

#
# Explicitly set user/group IDs.
#
RUN set -eux \
    && groupadd -r agens --gid=999 \
    # https://salsa.debian.org/postgresql/postgresql-common/blob/997d842ee744687d99a2b2d95c1083a2615c79e8/debian/postgresql-common.postinst#L32-35
    && useradd -r -g agens --uid=999 --home-dir=/home/agens --shell=/bin/bash agens \
    # also create the agens user's home directory with appropriate permissions
    # see https://github.com/docker-library/postgres/issues/274
    && mkdir -p /home/agens \
    && chown -R agens:agens /home/agens \
    && chmod -R 700 /home/agens

#
#  Set up locale settings.
#
ENV LANG en_US.utf8
RUN set -eux \
    # if this file exists, we're likely in "debian:xxx-slim", and locales are
    # thus being excluded so we need to remove that exclusion (since we need
    # locales)
    && grep -q '/usr/share/locale' /etc/dpkg/dpkg.cfg.d/docker \
    && sed -ri '/\/usr\/share\/locale/d' /etc/dpkg/dpkg.cfg.d/docker \
    && ! grep -q '/usr/share/locale' /etc/dpkg/dpkg.cfg.d/docker \
    && apt-get update \
    && apt-get install -y --no-install-recommends locales locales-all \
    && locale-gen \
    && localedef -i en_US -c -f UTF-8 -A /usr/share/locale/locale.alias en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge -y --auto-remove

#
# Install gpg if not available.
#
RUN set -ex \
    && if ! command -v gpg > /dev/null; then \
        apt-get update \
        && apt-get install -y --no-install-recommends \
        gnupg \
        dirmngr \
        && rm -rf /var/lib/apt/lists/*; \
    fi

#
# Grab gosu for easy step-down from root.
#
# https://github.com/tianon/gosu/releases
ENV GOSU_VERSION 1.12
RUN set -eux \
    && savedAptMark="$(apt-mark showmanual)" \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget \
    && rm -rf /var/lib/apt/lists/* \
    && dpkgArch="$(dpkg --print-architecture | awk -F- '{ print $NF }')" \
    && wget -O /usr/bin/gosu "https://github.com/tianon/gosu/releases/download/$GOSU_VERSION/gosu-$dpkgArch" \
    && wget -O /usr/bin/gosu.asc "https://github.com/tianon/gosu/releases/download/$GOSU_VERSION/gosu-$dpkgArch.asc" \
    && export GNUPGHOME="$(mktemp -d)" \
    && gpg --batch --keyserver hkps://keys.openpgp.org --recv-keys B42F6819007F00F88E364FD4036A9C25BF357DD4 \
    && gpg --batch --verify /usr/bin/gosu.asc /usr/bin/gosu \
    && gpgconf --kill all \
    && rm -rf "$GNUPGHOME" /usr/bin/gosu.asc \
    && apt-mark auto '.*' > /dev/null \
    && [ -z "$savedAptMark" ] || apt-mark manual $savedAptMark > /dev/null \
    && apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
    && chmod +x /usr/bin/gosu \
    && gosu --version \
    && gosu nobody true

#
# Install nss_wrapper to bypass "/etc/passwd" and "/etc/group" requirements.
#
RUN set -eux \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
    # install "nss_wrapper" in case we need to fake "/etc/passwd" and "/etc/group" (especially for OpenShift)
    # https://github.com/docker-library/postgres/issues/359
    # https://cwrap.org/nss_wrapper.html
    libnss-wrapper \
    # install "xz-utils" for .sql.xz docker-entrypoint-initdb.d files
    xz-utils \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge -y --auto-remove

#
# AgensGraph
#
# sourced from https://github.com/mcaramma/sv2/blob/master/Dockerfile
ENV AG_VERSION 2.1.2

ENV AGDATA=/home/agens/data \
    PATH=/home/agens/agens/bin:$PATH \
    LD_LIBRARY_PATH=/home/agens/agens/lib:$LD_LIBRARY_PATH \
    AGHOME=/home/agens/agens

RUN mkdir -p $AGDATA $AGHOME

VOLUME /home/agens/data

RUN apt-get update \
    && apt-get -y --no-install-recommends install \
        build-essential \
        pkg-config \
        git \
        libreadline-dev \
        zlib1g-dev \
        bison \
        flex \
        uuid \
        openssl \
        libnss3 \
        libssl-dev \
        libperl-dev \
        libossp-uuid-dev \
        libkeyutils-dev \
        libldap2-dev \
        libxslt1-dev \
        libxml2-dev \
        libc++-dev \
        libc++abi-dev \
        icu-devtools \
        libicu-dev \
        libpam0g-dev \
        pgtop \
        tcl \
        tcl-dev \
        python3 \
        python3-dev \
        python3-pip \
        python3-setuptools \
        wget \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && ln -s /usr/bin/pip3 /usr/bin/pip \
    && cd ${SRC_FOLDER} \
    && wget -c https://github.com/bitnine-oss/agensgraph/archive/v${AG_VERSION}.tar.gz \
    && tar zxvf v${AG_VERSION}.tar.gz \
    && rm v${AG_VERSION}.tar.gz \
    && cd agensgraph-${AG_VERSION} \
    && ./configure --prefix=$AGHOME \
                   --enable-thread-safety \
                   --with-pam \
                   --with-ldap \
                   --with-openssl \
                   --with-uuid=ossp \
                   --with-libxslt \
                   --with-libxml \
                   --with-python \
                   --with-perl \
                   --with-tcl \
                   --with-icu \
    && make install-world \
    && apt purge -y --auto-remove \
    && rm -rf /var/lib/apt/lists/*

RUN cd ${SRC_FOLDER} \
    && wget -c https://github.com/lesovsky/pgcenter/releases/download/v0.5.0/pgcenter.linux-amd64.tar.gz \
    && tar zxvf pgcenter.linux-amd64.tar.gz \
    && rm pgcenter.linux-amd64.tar.gz \
    && mv pgcenter /usr/bin \
    && pip install pgxnclient \
    # && pgxn install multicorn \
    # && pgxn install plv8 \
    && pgxn install acl \
    && pgxn install icu_ext \
    && apt purge -y --auto-remove \
    && rm -rf /var/lib/apt/lists/*

RUN sed -ri "s!^#?(listen_addresses)\s*=\s*\S+.*!\1 = '*'!" $AGHOME/share/postgresql/postgresql.conf.sample \
    && grep -F "listen_addresses = '*'" $AGHOME/share/postgresql/postgresql.conf.sample

#
# PostGIS
#
# sourced from https://github.com/mcaramma/sv2/blob/master/Dockerfile
ENV POSTGIS_VERSION 3.0.1

RUN apt-get update \
    && apt-get -y --no-install-recommends install \
        libxml2-dev \
        libgeos-dev \
        libgdal-dev \
        libproj-dev \
        libkrb5-dev \
        wget \
    && cd ${SRC_FOLDER} \
    && wget -c https://download.osgeo.org/postgis/source/postgis-${POSTGIS_VERSION}.tar.gz \
    && tar zxvf postgis-${POSTGIS_VERSION}.tar.gz \
    && cd postgis-${POSTGIS_VERSION} \
    && ./configure \
    && make \
    && make install \
    && apt purge -y --auto-remove \
    && rm -rf /var/lib/apt/lists/*

#
# OGR File Data Wrapper
#
ENV OGRFDW_VERSION 1.0.12

RUN apt-get update \
    && apt-get -y --no-install-recommends install \
        wget \
    && cd ${SRC_FOLDER} \
    && wget -c https://launchpad.net/ubuntu/+archive/primary/+sourcefiles/pgsql-ogr-fdw/1.0.12-1build1/pgsql-ogr-fdw_${OGRFDW_VERSION}.orig.tar.gz \
    && tar zxvf pgsql-ogr-fdw_${OGRFDW_VERSION}.orig.tar.gz \
    && cd pgsql-ogr-fdw-${OGRFDW_VERSION} \
    && make \
    && make install \
    && apt purge -y --auto-remove \
    && rm -rf /var/lib/apt/lists/*

#
#  Wrap-up by adding entrypoints, exposing ports and defining docker default
#  command.
#
RUN rm -rf ${SRC_FOLDER}/* \
    && apt-get autoremove \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# add entrypoint directory and make agens owner of the entrypoint
COPY --chown=agens ./bin/build/* /docker-entrypoint-initdb.d/

## copy file spinup build scripts to be executed
RUN mkdir -p /home/agens/scripts
ADD docker-entrypoint.sh /home/agens/scripts
RUN chmod +x /home/agens/scripts/docker-entrypoint.sh
ENTRYPOINT ["/home/agens/scripts/docker-entrypoint.sh"]

EXPOSE 5432
CMD ["postgres"]
