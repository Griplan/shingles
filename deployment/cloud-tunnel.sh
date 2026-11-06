#!/bin/sh
set -eu
exec ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes -o UpdateHostKeys=no -o ForwardAgent=no -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -N -L 127.0.0.1:18001:127.0.0.1:8001 acupuncture-server
