// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Config, ConfigFactory } from '../../config';

@ConfigFactory.register('aws')
export class AWSConfig extends Config {
    // scopes
    public static AWS_EP_OAUTH2: string;
    public static AWS_EP_IAM: string;
    public static AWS_REGION: string;
    public static AWS_ENVIRONMENT: string;
    // Logger
    public static LOGGER_LEVEL: string;
    // max len for a group name in DE
    public static DES_GROUP_CHAR_LIMIT = 256;

    public async init(): Promise<void> {

        // init AWS specific configurations
        AWSConfig.AWS_EP_OAUTH2 = process.env.WS_EP_OAUTH2;
        AWSConfig.AWS_EP_IAM = process.env.AWS_EP_IAM;
        AWSConfig.AWS_REGION = process.env.AWS_REGION;
        AWSConfig.AWS_ENVIRONMENT = process.env.ENVIRONMENT;

        // Logger
        AWSConfig.LOGGER_LEVEL = process.env.LOGGER_LEVEL || 'info';

        await Config.initServiceConfiguration({
            SERVICE_ENV: process.env.SERVICE_ENV,
            SERVICE_PORT: +process.env.PORT || 5000,
            API_BASE_PATH: process.env.API_BASE_PATH,
            IMP_SERVICE_ACCOUNT_SIGNER: process.env.IMP_SERVICE_ACCOUNT_SIGNER || '',
            LOCKSMAP_REDIS_INSTANCE_ADDRESS: process.env.LOCKSMAP_REDIS_INSTANCE_ADDRESS,
            LOCKSMAP_REDIS_INSTANCE_PORT: +process.env.LOCKSMAP_REDIS_INSTANCE_PORT,
            LOCKSMAP_REDIS_INSTANCE_KEY: process.env.LOCKSMAP_REDIS_INSTANCE_KEY || '',
            DES_REDIS_INSTANCE_ADDRESS: process.env.DES_REDIS_INSTANCE_ADDRESS,
            DES_REDIS_INSTANCE_PORT: +process.env.DES_REDIS_INSTANCE_PORT,
            DES_REDIS_INSTANCE_KEY: process.env.DES_REDIS_INSTANCE_KEY,
            DES_SERVICE_HOST_COMPLIANCE: process.env.LEGAL_BASE_URL,
            DES_SERVICE_HOST_ENTITLEMENT: process.env.ENTITLEMENTS_BASE_URL,
            DES_SERVICE_HOST_STORAGE: process.env.STORAGE_BASE_URL,
            DES_SERVICE_HOST_PARTITION: process.env.PARTITION_BASE_URL,
            DES_SERVICE_APPKEY: process.env.DES_SERVICE_APPKEY || '',
            DES_GROUP_CHAR_LIMIT: AWSConfig.DES_GROUP_CHAR_LIMIT,
            JWKS_URL: process.env.JWKS_URL,
            JWT_EXCLUDE_PATHS: process.env.JWT_EXCLUDE_PATHS || '',
            JWT_AUDIENCE: process.env.JWT_AUDIENCE || '',
            JWT_ENABLE_FEATURE: process.env.JWT_ENABLE_FEATURE ? process.env.JWT_ENABLE_FEATURE === 'true' : false,
            TENANT_JOURNAL_ON_DATA_PARTITION: true,
            SSL_ENABLED: process.env.SSL_ENABLED === 'true',
            SSL_KEY_PATH: process.env.SSL_KEY_PATH,
            SSL_CERT_PATH: process.env.SSL_CERT_PATH,
            FEATURE_FLAG_SEISMICMETA_STORAGE: process.env.FEATURE_FLAG_SEISMICMETA_STORAGE !== undefined ?
                process.env.FEATURE_FLAG_SEISMICMETA_STORAGE !== 'false' : true,
            FEATURE_FLAG_IMPTOKEN: process.env.FEATURE_FLAG_IMPTOKEN !== undefined ?
                process.env.FEATURE_FLAG_IMPTOKEN !== 'false' : true,
            FEATURE_FLAG_TRACE: process.env.FEATURE_FLAG_TRACE !== undefined ?
                process.env.FEATURE_FLAG_TRACE !== 'false' : true,
            FEATURE_FLAG_LOGGING: process.env.FEATURE_FLAG_LOGGING !== undefined ?
                process.env.FEATURE_FLAG_LOGGING !== 'false' : true,
            FEATURE_FLAG_STACKDRIVER_EXPORTER: process.env.FEATURE_FLAG_STACKDRIVER_EXPORTER !== undefined ?
                process.env.FEATURE_FLAG_STACKDRIVER_EXPORTER !== 'false' : true,
            FEATURE_FLAG_CCM_INTERACTION: process.env.FEATURE_FLAG_CCM_INTERACTION ?
                process.env.FEATURE_FLAG_CCM_INTERACTION === 'true' : false,
            FEATURE_FLAG_POLICY_SVC_INTERACTION: process.env.FEATURE_FLAG_POLICY_SVC_INTERACTION === 'true',
            CCM_SERVICE_URL: process.env.CCM_SERVICE_URL || '',
            CCM_TOKEN_SCOPE: process.env.CCM_TOKEN_SCOPE || '',
            CALLER_FORWARD_HEADERS: process.env.CALLER_FORWARD_HEADERS,
            USER_ID_CLAIM_FOR_SDMS: process.env.USER_ID_CLAIM_FOR_SDMS ? process.env.USER_ID_CLAIM_FOR_SDMS : 'subid',
            USER_ID_CLAIM_FOR_ENTITLEMENTS_SVC: process.env.USER_ID_CLAIM_FOR_ENTITLEMENTS_SVC ?
                process.env.USER_ID_CLAIM_FOR_ENTITLEMENTS_SVC : 'email',
            USER_ASSOCIATION_SVC_PROVIDER: process.env.USER_ASSOCIATION_SVC_PROVIDER,
            SDMS_PREFIX: process.env.SDMS_PREFIX ? process.env.SDMS_PREFIX : '/seistore-svc/api/v3',
            DES_POLICY_SERVICE_HOST: process.env.DES_POLICY_SERVICE_HOST || process.env.DES_SERVICE_HOST,
            APPLICATION_CORS_ENABLED: process.env.APPLICATION_CORS_ENABLED !== undefined ? 
                    process.env.APPLICATION_CORS_ENABLED === 'true' : true
        });

    }

}
