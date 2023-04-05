# ============================================================================
# Copyright 2017-2021, Schlumberger
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ============================================================================

#ARG docker_node_image_version=14-alpine

# -------------------------------
# Compilation stage
# -------------------------------
FROM mcr.microsoft.com/cbl-mariner/base/nodejs:16.14 as runtime-builder

ADD ./ /service
WORKDIR /service

RUN npm install --quiet node-gyp -g \
    && npm install --quiet \
    && npm run build \
    && mkdir artifact \
    && cp -r package.json npm-shrinkwrap.json dist artifact
# -------------------------------
# Package stage
# -------------------------------
FROM mcr.microsoft.com/cbl-mariner/base/nodejs:16.14 as release

COPY --from=runtime-builder /service/artifact /seistore-service
WORKDIR /seistore-service

RUN tdnf upgrade --security \
    && tdnf install -y shadow-utils \
    && tdnf clean all
RUN groupadd appgroup \
    && useradd -g appgroup appuser
RUN chown -R appuser:appgroup /seistore-service \
    && echo '%appgroup ALL=(ALL) NOPASSWD: /usr/bin/npm' >> /etc/sudoers \
    && echo '%appgroup ALL=(ALL) NOPASSWD: /usr/bin/node' >> /etc/sudoers \
    && npm install --production --quiet 

ENTRYPOINT ["node", "--trace-warnings", "--trace-uncaught", "./dist/server/server-start.js"]