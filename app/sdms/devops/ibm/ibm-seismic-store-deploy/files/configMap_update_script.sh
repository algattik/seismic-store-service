#!/bin/sh

mkdir /tmp/cm-config

export HOME=/tmp/cm-config

cd /tmp/cm-config

COUCH_SECRET_NAME=$(kubectl get secrets |grep Opaque| grep couchdb| awk '{ print $1 }')

VALUE_COUCH_SECRET=$(kubectl get secret $COUCH_SECRET_NAME -o jsonpath="{ .data.adminPassword}" |base64 -d)

kubectl patch cm seismic-store-config -p "{\"data\": {\"ibm.db.password\": \"$VALUE_COUCH_SECRET\"}}"

kubectl patch cm seismic-store-config -p "{\"data\": {\"DB_URL\": \"http://admin:$VALUE_COUCH_SECRET@$1-couchdb:5984\"}}"
