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

import { Config, ConfigFactory } from '../../config';

import { AzureSecrets } from './secrets';

@ConfigFactory.register('azure')
export class AzureConfig extends Config {
    // Service Principal;
    public static SP_TENANT_ID: string;
    public static SP_CLIENT_ID: string;
    public static SP_CLIENT_SECRET: string;
    public static SP_APP_RESOURCE_ID: string;

    // Logs and Monitor
    public static AI_INSTRUMENTATION_KEY: string;
    private static CORRELATION_ID = 'correlation-id';

    // KeyVault Url
    public static KEYVAULT_URL: string;

    public async init(): Promise<void> {
        AzureConfig.KEYVAULT_URL = process.env.KEYVAULT_URL;
        Config.checkRequiredConfig(AzureConfig.KEYVAULT_URL, 'KEYVAULT_URL');
        await AzureSecrets.loadSecrets();
        Config.CALLER_FORWARD_HEADERS = Config.CALLER_FORWARD_HEADERS
            ? Config.CALLER_FORWARD_HEADERS + ',' + AzureConfig.CORRELATION_ID
            : AzureConfig.CORRELATION_ID;
    }
}
