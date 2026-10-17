#!/bin/sh
set -eu

if [ -z "${TURN_SHARED_SECRET:-}" ]; then
  echo "TURN_SHARED_SECRET is required" >&2
  exit 1
fi

# The secret format is restricted so inserting it into the config is safe.
case "$TURN_SHARED_SECRET" in
  *[!A-Fa-f0-9]*) echo "TURN_SHARED_SECRET must contain only hexadecimal characters" >&2; exit 1 ;;
esac

sed "s/__TURN_SHARED_SECRET__/$TURN_SHARED_SECRET/" \
  /etc/coturn/turnserver.conf > /tmp/turnserver.conf
exec turnserver -c /tmp/turnserver.conf
