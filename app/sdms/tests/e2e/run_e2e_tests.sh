#!/bin/bash
#  ***************************************************************************
#  Copyright 2017 - 2021, Schlumberger
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

# usage menu function
usage() {
    printf  "\n[USAGE] ./e2e/tests/run_e2e_tests.sh --seistore-svc-url=... " \
            "--seistore-svc-api-key=... --user-idtoken=... --tenant=..." \
            "--datapartition=... --legaltag01=... --legaltag02=... " \
            "--newuser(optional)=... --newusergroup(optional)=... --VCS-provider(optional)=... " \
            "--admin-email(optional)=... --de-app-key(optional)=... --subproject(optional)=... \n "
    printf "\n[ERROR] %s\n" "$1"
}

# script to execute from root directory #will not work in internal pipelines
#if [ ! -f "tsconfig.json" ]; then
#    printf "\n%s\n" "[ERROR] The script must be called from the project root directory."
#    exit 1
#fi

# check required parameters
# argument [seistore-svc-url] seismic store service url - required
# argument [seistore-svc-api-key] seismic store service api key - required
# argument [user-idtoken] user credentail token - required
# argument [tenant] seismic store working tenant name - required
# argument [datapartition] data partition id - required
# argument [legaltag01] test legal tag - required
# argument [legaltag02] test legal tag  - required
# argument [newuser] user email for a new user to be added into subproject - required if [VCS-Provider] is not 'gitlab'
# argument [newusergroup] user group email for a group to be added into subproject - required if [VCS-Provider] is not 'gitlab'
# argument [VCS-Provider] valid value is 'gitlab'. Provided will skip USER and IMPTOKEN API endpoints tests - optional
# argument [de-app-key] DELFI application key - optional
# argument [admin-email] user credentail email - optional (deprecated)
# argument [subproject] subproject name to use in e2e tests - optional

for i in "$@"; do
case $i in
  --seistore-svc-url=*)
  seistore_svc_url="${i#*=}"
  shift
  ;;
  --seistore-svc-api-key=*)
  seistore_svc_api_key="${i#*=}"
  shift
  ;;
  --user-idtoken=*)
  user_idtoken="${i#*=}"
  shift
  ;;
  --tenant=*)
  working_tenant="${i#*=}"
  shift
  ;;
  --datapartition=*)
  datapartition="${i#*=}"
  shift
  ;;
  --legaltag01=*)
  legaltag01="${i#*=}"
  shift
  ;;
  --legaltag02=*)
  legaltag02="${i#*=}"
  shift
  ;;
  --newuser=*)
  newuser="${i#*=}"
  shift
  ;;
  --newusergroup=*)
  newusergroup="${i#*=}"
  shift
  ;;
  --de-app-key=*)
  de_app_key="${i#*=}"
  shift
  ;;
  --VCS-Provider=*)
  VCS_Provider="${i#*=}"
  shift
  ;;
  --admin-email=*)
  admin_email="${i#*=}"
  shift
  ;;
  --subproject=*)
  subproject="${i#*=}"
  shift
  ;;
  *)
  usage "unknown option $i"
  ;;
esac
done

# required parameters
if [ -z "${seistore_svc_api_key}" ]; then usage "seistore-svc-api-key not defined" && exit 1; fi
if [ -z "${seistore_svc_url}" ]; then usage "seistore-svc-url not defined" && exit 1; fi
if [ -z "${user_idtoken}" ]; then usage "user-idtoken not defined" && exit 1; fi
if [ -z "${working_tenant}" ]; then usage "tenant not defined" && exit 1; fi
if [ -z "${datapartition}" ]; then usage "datapartition not defined" && exit 1; fi
if [ -z "${legaltag01}" ]; then usage "legaltag01 not defined" && exit 1; fi
if [ -z "${legaltag02}" ]; then usage "legaltag02 not defined" && exit 1; fi

# required parameter should be skipped for GitLab
if [[ "${VCS_Provider}" == true || "${VCS_Provider}" == "true" || "${VCS_Provider}" == "gitlab" ]]; then
   VCS_Provider="gitlab"
else
   if [ -z "${newuser}" ]; then usage "newuser not defined" && exit 1; fi
   if [ -z "${newusergroup}" ]; then usage "newusergroup not defined" && exit 1; fi
   VCS_Provider="any"
fi

# optional parameters (with defaults)
if [ -z "${de_app_key}" ]; then
   de_app_key="random_string"
fi

if [ -z "${subproject}" ]; then
   sed -i "s/#{SUBPROJECT}#//g" ./tests/e2e/postman_env.json
fi

if [ -z "${admin_email}" ]; then
 sed -i "s/#{ADMINEMAIL}#//g" ./tests/e2e/postman_env.json 
fi

# print logs
printf "\n%s\n" "--------------------------------------------"
printf "%s\n" "seismic store regression tests"
printf "%s\n" "--------------------------------------------"
printf "%s\n" "seistore service apikey = ${seistore_svc_api_key}"
printf "%s\n" "seistore service url = ${seistore_svc_url}"
printf "%s\n" "working tenant = ${working_tenant}"
printf "%s\n" "user test admin = ${admin_email}"
printf "%s\n" "datapartition = ${datapartition}"
printf "%s\n" "legaltag01 = ${legaltag01}"
printf "%s\n" "legaltag02 = ${legaltag02}"
printf "%s\n" "newuser = ${newuser}"
printf "%s\n" "newusergroup = ${newusergroup}"
printf "%s\n" "VCS_Provider = ${VCS_Provider}"
printf "%s\n" "subproject = ${subproject}"
printf "%s\n" "--------------------------------------------"

# replace values in the main env
cp ./tests/e2e/postman_env.json ./tests/e2e/postman_env_original.json
sed -i "s,#{SVC_URL}#,${seistore_svc_url},g" ./tests/e2e/postman_env.json
sed -i "s/#{SVC_API_KEY}#/${seistore_svc_api_key}/g" ./tests/e2e/postman_env.json
sed -i "s/#{STOKEN}#/${user_idtoken}/g" ./tests/e2e/postman_env.json
sed -i "s/#{TENANT}#/${working_tenant}/g" ./tests/e2e/postman_env.json
sed -i "s/#{ADMINEMAIL}#/${admin_email}/g" ./tests/e2e/postman_env.json
sed -i "s/#{DATAPARTITION}#/${datapartition}/g" ./tests/e2e/postman_env.json
sed -i "s/#{LEGALTAG01}#/${legaltag01}/g" ./tests/e2e/postman_env.json
sed -i "s/#{LEGALTAG02}#/${legaltag02}/g" ./tests/e2e/postman_env.json
sed -i "s/#{NEWUSEREMAIL}#/${newuser}/g" ./tests/e2e/postman_env.json
sed -i "s/#{NEWUSERGROUP}#/${newusergroup}/g" ./tests/e2e/postman_env.json
sed -i "s/#{VCS_PROVIDER}#/${VCS_Provider}/g" ./tests/e2e/postman_env.json
sed -i "s/#{DE_APP_KEY}#/${de_app_key}/g" ./tests/e2e/postman_env.json
sed -i "s/#{SUBPROJECT}#/${subproject}/g" ./tests/e2e/postman_env.json

# install requied packages
npm ci 

# run tests
if [ -f "./node_modules/newman/bin/newman.js" ]; then
   ./node_modules/newman/bin/newman.js run ./tests/e2e/postman_collection.json \
      -e ./tests/e2e/postman_env.json \
      --insecure \
      --timeout 600000 \
      --iteration-count 3 \
      --reporters cli,htmlextra \
      --reporter-htmlextra-skipHeaders "Authorization appkey x-api-key" \
      --reporter-htmlextra-export ./tests/e2e/results/e2e_tests.html \
      --bail
else
   npm install -g newman
   npm install -g newman-reporter-htmlextra
   newman run ./tests/e2e/postman_collection.json \
      -e ./tests/e2e/postman_env.json \
      --insecure \
      --timeout 600000 \
      --iteration-count 3 \
      --reporters cli,htmlextra \
      --reporter-htmlextra-skipHeaders "Authorization appkey x-api-key" \
      --reporter-htmlextra-export ./tests/e2e/results/e2e_tests.html \
      --bail
fi

resTest=$?

# restore configuraiton and remove installed dependencies
cp ./tests/e2e/postman_env_original.json ./tests/e2e/postman_env.json
rm ./tests/e2e/postman_env_original.json

# exit the script
printf "%s\n" "--------------------------------------------"
if [ $resTest -ne 0 ]; then exit 1; fi