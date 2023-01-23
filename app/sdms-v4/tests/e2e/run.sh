#!/bin/bash
#  ***************************************************************************
#  Copyright 2017 - 2023, Schlumberger
#
#  Licensed under the Apache License, Version 2.0(the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#  ***************************************************************************

start=$(date +%s)

# print usage menu and exit
usage() {
  printf "\n# Error: $1\n"
  printf "\n%s" \
    "# Usage: $(pwd)/run.sh" \
    "           --osdu-url:       the osdu deployment URL (required)" \
    "           --sdms-svc-path:  the sdms service endpoints base path (optional, default=/seistore-svc/api/v4/)" \
    "           --access-token:   the user credentials (required)" \
    "           --partition:      the data partition id (required)"
  printf '\n'
  exit 1
}

# print error and exit
error() {
  printf "\n# Error: $1\n"
  exit 1
}

# create a legal tag
createLegalTag() {
  printf "%s\n\n" "# creating a legal tag via compliance service"
  response=$(curl -w " rcode:%{http_code}" --request POST "$osdu_url/api/legal/v1/legaltags" \
  --header 'accept: application/json' \
  --header "data-partition-id: $partition" \
  --header "Authorization: Bearer $access_token" \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "name": "'$1'",
    "description": "A legal tag used for sdms e2e test purposes.",
    "properties": {
      "countryOfOrigin": [
        "US"
      ],
      "contractId": "Unknown",
      "expirationDate": "2099-01-01",
      "originator": "OSDU",
      "dataType": "Public Domain Data",
      "securityClassification": "Public",
      "personalData": "No Personal Data",
      "exportClassification": "Not - Technical Data"
    }
  }')

  prefix=${response%%"rcode:"*}
  index=$((${#prefix}+6))
  code=${response:$index:3}
  if [[ $code != "409" ]] && [[ $code != "201" ]]; then
    error "$code"
  fi

}

# create an entitlement group
createEntitlementGroup() {
  printf "%s\n\n" "# creating a group via entitlement service"
  response=$(curl -w " rcode:%{http_code}" --request POST "$osdu_url/api/entitlements/v2/groups" \
  --header 'accept: application/json' \
  --header "data-partition-id: $partition" \
  --header "Authorization: Bearer $access_token" \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "name": "'$1'",
    "description": "A group used for sdms e2e test purposes."
  }')
  prefix=${response%%"rcode:"*}
  index=$((${#prefix}+6))
  code=${response:$index:3}
  if [[ $code != "409" ]] && [[ $code != "201" ]]; then
    error "$code"
  fi
}

# retrieve the entitlement groups domain
getEntitlementDomain() {
  printf "%s\n\n" "# retrieve entitlement groups domain"
  response=$(curl -X 'GET' -w " rcode:%{http_code}" "$osdu_url/api/entitlements/v2/groups" \
    --header "accept: application/json" \
    --header "data-partition-id: $partition" \
    --header "Authorization: Bearer $access_token")
  prefix=${response%%"rcode:"*}
  index=$((${#prefix}+6))
  code=${response:$index:3}
  if [[ $code != "200" ]]; then
    error "$code"
  fi
  groups=${response::-10}
  group=$(echo $groups | jq ".groups[:1][].email")
  IFS=@ read -r tmp domain <<< $group
  domain=${domain%?}
}

# prepare the test execution by computing required resources
printf "\n%s\n" "--------------------------------------------"
printf "%s\n" "Seismic DMS regression tests initialization"
printf "%s\n" "--------------------------------------------"

# check required parameters
# argument [osdu-url] seismic store service url - required
# argument [access-token] user credentail token - required
# argument [partition] data partition id - required
# argument [sdms-svc-path] the sdms service endpoints base path - optional
for i in "$@"; do
case $i in
  --osdu-url=*)
  osdu_url="${i#*=}"
  shift
  ;;
  --access-token=*)
  access_token="${i#*=}"
  shift
  ;;
  --partition=*)
  partition="${i#*=}"
  shift
  ;;
  --sdms-svc-path=*)
  sdms_svc_path="${i#*=}"
  shift
  ;;
  *)
  usage "unknown option $i"
  ;;
esac
done

# required parameters
if [ -z "${osdu_url}" ]; then usage "osdu-url not defined"; fi
if [ -z "${access_token}" ]; then usage "access-token not defined"; fi
if [ -z "${partition}" ]; then usage "partition not defined"; fi

#optional parameters
if [ -z "${sdms_svc_path}" ]; then sdms_svc_path="/seistore-svc/api/v4"; fi

# compute osdu resources
printf "\n" && legal_tag="sdms-e2e" && createLegalTag "$legal_tag" && legal_tag="$partition-"$legal_tag
printf "\n" && acl_owners="data.sdms-e2e.owners" && createEntitlementGroup "$acl_owners"
printf "\n" && acl_viewers="data.sdms-e2e.viewers" && createEntitlementGroup "$acl_viewers"
printf "\n" && getEntitlementDomain && acl_owners=$acl_owners"@"$domain && acl_viewers=$acl_viewers"@"$domain

# print execution configurations
printf "\n%s\n" "--------------------------------------------"
printf "%s\n" "Seismic DMS V4 regression tests parameters"
printf "%s\n" "--------------------------------------------"
printf "\n%s\n" "osdu deployment url = ${osdu_url}"
printf "%s\n" "sdms v4 service url = ${osdu_url}${sdms_svc_path}"
printf "%s\n" "partition = ${partition}"
printf "%s\n" "credentials = **********************"
printf "%s\n" "legal tag = ${legal_tag}"
printf "%s\n" "acl owners group = ${acl_owners}"
printf "%s\n" "acl viewers group = ${acl_viewers}"
printf "\n%s\n" "--------------------------------------------"
printf "%s\n" "Seismic DMS V4 regression tests"
printf "%s\n" "--------------------------------------------"

# set env variables and run tests
export URL=${osdu_url}${sdms_svc_path} \
&& export PARTITION=${partition} \
&& export TOKEN=${access_token} \
&& export ACL_ADMINS=${acl_owners} \
&& export ACL_VIEWERS=${acl_viewers} \
&& export LEGALTAGS=${legal_tag} \
&& npm run test
resTest=$?

# compute and print execution time and exit
printf "\n%s\n" "--------------------------------------------"
end=$(date +%s)
duration=$(expr $end - $start)
printf "%s\n" "Tests completed in $duration seconds"
printf "%s\n" "--------------------------------------------"
if [ $resTest -ne 0 ]; then exit 1; fi
