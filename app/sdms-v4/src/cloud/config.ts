// ============================================================================
// Copyright 2017-2022, Schlumberger
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

import { CloudFactory } from './cloud';

export interface IConfig {
    init(): Promise<void>;
}

export abstract class Config implements IConfig {
    public static SERVICE_PORT: number;

    // List of headers to forward on call to downstream services
    // To provide as comma separated string list
    // If this is set the default forward header list will be override.
    // https://github.com/WealthWizardsEngineering/hpropagate
    public static CALLER_FORWARD_HEADERS: string;

    // Server SSL
    public static SSL_ENABLED: boolean;
    public static SSL_KEY_PATH: string;
    public static SSL_CERT_PATH: string;

    // Apis base path
    public static APIS_BASE_PATH: string;

    // Cloud provider name (anthos/aws/azure/google/ibm/...)
    public static CLOUD_PROVIDER: string;

    // Core Services
    public static DATA_PARTITION_ID: string;
    public static CORE_SERVICE_HOST: string;
    public static CORE_SERVICE_PARTITION_BASE_PATH: string;
    public static CORE_SERVICE_STORAGE_BASE_PATH: string;
    public static CORE_SERVICE_COMPLIANCE_BASE_PATH: string;
    public static CORE_SERVICE_ENTITLEMENT_BASE_PATH: string;
    public static CORE_SEARCH_BASE_PATH: string;

    // Keys
    public static CORE_SERVICE_PARTITION_STORAGE_ACCOUNT_KEY: string;

    // Enable or disable schema format validation
    public static ENABLE_SCHEMA_PROPERTIES_FORMAT_VALIDATION: boolean;

    // Initialization methods
    public static setCloudProvider(cloudProvider: string | undefined) {
        if (!cloudProvider) {
            throw new Error(
                'The "CLOUD_PROVIDER" environment variable has not been set (required to start the server)'
            );
        }

        this.CLOUD_PROVIDER = cloudProvider;
    }

    // Load service configuration from environment.
    // In the init implementation, each CSP can override the default value
    public static async initialize(): Promise<void> {
        Config.SERVICE_PORT = this.getEnvNumber('SERVICE_PORT', 5000);
        Config.SSL_ENABLED = this.getEnvBoolean('SSL_ENABLED', false);
        Config.SSL_KEY_PATH = this.getEnvString('SSL_KEY_PATH');
        Config.SSL_CERT_PATH = this.getEnvString('SSL_CERT_PATH');
        Config.APIS_BASE_PATH = this.getEnvString('APIS_BASE_PATH', '/seistore-svc/api/v4');
        Config.CALLER_FORWARD_HEADERS = this.getEnvString('CALLER_FORWARD_HEADERS');
        Config.DATA_PARTITION_ID = this.getEnvString('DATA_PARTITION_HEADER_KEY', 'data-partition-id');
        Config.CORE_SERVICE_HOST = this.getEnvString('CORE_SERVICE_HOST');
        Config.CORE_SERVICE_STORAGE_BASE_PATH = this.getEnvString('STORAGE_SERVICE_BASE_PATH', '/api/storage/v2');
        Config.CORE_SERVICE_PARTITION_BASE_PATH = this.getEnvString('PARTITION_SERVICE_BASE_PATH', '/api/partition/v1');
        Config.CORE_SERVICE_COMPLIANCE_BASE_PATH = this.getEnvString('COMPLIANCE_SERVICE_BASE_PATH', '/api/legal/v1');
        Config.CORE_SEARCH_BASE_PATH = this.getEnvString('SEARCH_SERVICE_BASE_PATH', '/api/search/v2');
        Config.CORE_SERVICE_ENTITLEMENT_BASE_PATH = this.getEnvString(
            'ENTITLEMENT_SERVICE_BASE_PATH',
            '/api/entitlements/v2'
        );
        Config.CORE_SERVICE_PARTITION_STORAGE_ACCOUNT_KEY = this.getEnvString(
            'PARTITION_SVC_STORAGE_ACCOUNT_KEY',
            'sdms-storage-account-name'
        );
        Config.ENABLE_SCHEMA_PROPERTIES_FORMAT_VALIDATION = this.getEnvBoolean(
            'ENABLE_SCHEMA_PROPERTIES_FORMAT_VALIDATION',
            false
        );

        // Check required configurations
        this.checkRequiredConfig(Config.CORE_SERVICE_HOST, 'CORE_SERVICE_HOST');

        // Initialize the CSP specific configuration
        await ConfigFactory.build(Config.CLOUD_PROVIDER).init();
    }

    protected static getEnvBoolean(key: string, defaultValue?: boolean): boolean {
        return process.env[key] ? process.env[key].toLowerCase() === 'true' : defaultValue ? defaultValue : undefined;
    }

    protected static getEnvString(key: string, defaultValue?: string): string {
        return process.env[key] ? process.env[key] : defaultValue ? defaultValue : undefined;
    }

    protected static getEnvNumber(key: string, defaultValue?: number): number {
        return process.env[key] ? +process.env[key] : defaultValue ? defaultValue : undefined;
    }

    protected static checkRequiredConfig(config: any, name: string) {
        if (config === undefined || (typeof config === 'number' && isNaN(config))) {
            throw new Error('missing configuration: ' + name);
        }
    }

    // Must be implemented in the provider
    public abstract init(): Promise<void>;
}

export class ConfigFactory extends CloudFactory {
    public static build(providerLabel: string, args: { [key: string]: any } = {}): IConfig {
        return CloudFactory.build(providerLabel, Config, args) as IConfig;
    }
}
