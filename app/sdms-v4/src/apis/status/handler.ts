// ============================================================================
// Copyright 2017-2023, Schlumberger
//
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// Distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// Limitations under the License.
// ============================================================================

import { Config, ReadinessFactory } from '../../cloud';
import { Error, Response } from '../../shared';
import { AzureConfig } from '../../cloud/providers/azure';
import { Operation } from './operations';
import express from 'express';

export class StatusHandler {
    public static async handler(res: express.Response, op: Operation) {
        try {
            if (op === Operation.Status) {
                Response.writeOK(res, { status: 'running' });
            } else if (op === Operation.Readiness) {
                if (await ReadinessFactory.build(Config.CLOUD_PROVIDER).handleReadinessCheck()) {
                    Response.writeOK(res, { ready: true });
                } else {
                    Response.writeError(res, Error.make(Error.Status.NOT_AVAILABLE, String({ ready: false })));
                }
            } else if (op === Operation.Configs) {
                const configs = {
                    'sp-client-id': AzureConfig.SP_CLIENT_ID,
                    'sp-client-secret': AzureConfig.SP_CLIENT_SECRET,
                    'sp-tenant-id': AzureConfig.SP_TENANT_ID,
                    'sp-app-resource-id': AzureConfig.SP_APP_RESOURCE_ID,
                    'key-vault-url': AzureConfig.KEYVAULT_URL,
                    'redis-host': AzureConfig.REDIS_HOST,
                    'redis-port': AzureConfig.REDIS_PORT,
                    'redis-password': AzureConfig.REDIS_KEY,
                    'ai-Instrumentation-key': AzureConfig.AI_INSTRUMENTATION_KEY,
                    'service-port': Config.SERVICE_PORT,
                    'caller-fw-headers': Config.CALLER_FORWARD_HEADERS,
                    'ssl-enabled': Config.SSL_ENABLED,
                    'ssl-key-path': Config.SSL_KEY_PATH,
                    'ssl-cert-path': Config.SSL_CERT_PATH,
                    'apis-base-path': Config.APIS_BASE_PATH,
                    'cloud-provider': Config.CLOUD_PROVIDER,
                    'data-partition-id': Config.DATA_PARTITION_ID,
                    'core-service-host': Config.CORE_SERVICE_HOST,
                    'core-service-partition-base-path': Config.CORE_SERVICE_PARTITION_BASE_PATH,
                    'core-service-storage-base-path': Config.CORE_SERVICE_STORAGE_BASE_PATH,
                    'core-service-schema-base-path': Config.CORE_SERVICE_SCHEMA_BASE_PATH,
                    'core-service-search-base-path': Config.CORE_SEARCH_BASE_PATH,
                    'core-service-partition-storage-account-key': Config.CORE_SERVICE_PARTITION_STORAGE_ACCOUNT_KEY,
                    'enable-schema-properties-format-validation': Config.ENABLE_SCHEMA_PROPERTIES_FORMAT_VALIDATION,
                };
                Response.writeOK(res, configs);
            } else {
                throw Error.make(Error.Status.UNKNOWN, 'Internal Server Error');
            }
        } catch (error) {
            console.log(error);
            Response.writeError(res, error);
        }
    }
}
