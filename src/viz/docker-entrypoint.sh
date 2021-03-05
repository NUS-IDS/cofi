#!/usr/bin/env bash
#
# DOCKER ENTRYPOINT
#
# This custom entrypoint sources environment secrets and export the relevant
# environment variables before calling the default entrypoint.

set -e

if [ -r /run/secrets/env ]; then
    echo "Exporting additional variables."
    export $(cat /run/secrets/env | grep -E '^(MAPBOX_TOKEN|WIFI_USER|WIFI_PW)=')
fi

# the commands below will start webservers appropriate for development; they are not well-tuned for production

# start frontend
cd /app/frontend && PORT=8000 REACT_APP_MAPBOX_ACCESS_TOKEN=$MAPBOX_TOKEN pm2 start --name "frontend" /app/frontend/node_modules/.bin/react-scripts -- start

# start backend-python
pm2 start --name "backend-python" python -- /app/backend-python/app.py

# start backend-julia
if [ -d /app/backend-julia/Tseir.jl/TseirServer.jl ]; then
    cd /app/backend-julia/Tseir.jl/TseirServer.jl && julia --project=. << EOF
using Pkg
Pkg.instantiate()
Pkg.precompile()
EOF
    cd /app/backend-julia/Tseir.jl/TseirServer.jl/ && pm2 start --name "backend-julia" julia -- --project=. ./bootstrap.jl s -p 8002
fi
