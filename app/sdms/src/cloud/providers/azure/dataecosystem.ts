// ============================================================================
// Copyright 2017-2019, Schlumberger
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
// ============================================================================

import axios from 'axios';
import { Error, getInMemoryCacheInstance } from '../../../shared';
import {
    AbstractDataEcosystemCore,
    DataEcosystemCoreFactory,
    IDESEntitlementGroupMembersModel
} from '../../dataecosystem';
import { AzureConfig } from './config';
import { AzureCredentials } from './credentials';
import { Keyvault } from './keyvault';
import request from 'request-promise';

@DataEcosystemCoreFactory.register('azure')
export class AzureDataEcosystemServices extends AbstractDataEcosystemCore {

    public getUserAssociationSvcBaseUrlPath(): string { return 'userAssociation/v1'; }
    public getDataPartitionIDRestHeaderName(): string { return 'data-partition-id'; }
    public getEntitlementBaseUrlPath(): string { return '/api/entitlements/v2'; };
    public getComplianceBaseUrlPath(): string { return '/api/legal/v1'; };
    public getStorageBaseUrlPath(): string { return '/api/storage/v2'; };
    public getPolicySvcBaseUrlPath(): string { return '/api/policy/v1'; }
    

    public async getAuthorizationHeader(userToken: string): Promise<string> {
        return userToken.startsWith('Bearer') ? userToken : 'Bearer ' + userToken;
    }

    public fixGroupMembersResponse(groupMembers: any): IDESEntitlementGroupMembersModel {
        return groupMembers as IDESEntitlementGroupMembersModel;
    }

    public getUserAddBodyRequest(userEmail: string, role: string): { email: string, role: string; } | string[] {
        return { email: userEmail, role };
    }

    public tenantNameAndDataPartitionIDShouldMatch() {
        return true;
    }

    public static async getStorageEndpoint(dataPartitionID: string): Promise<string> {
        const config = await AzureDataEcosystemServices.getPartitionConfiguration(dataPartitionID).catch((error) => {
            throw (Error.makeForHTTPRequest(error));
        });
        
        if (!config) {
            throw Error.makeForHTTPRequest(`Storage endpoint is null`);
        }

        return config.storageAccountBlobEndpoint
            ? config.storageAccountBlobEndpoint
            : `https://${config.sdmsStorageAccountName}.blob.core.windows.net`;
    }

    public static async getCosmosConnectionParams(dataPartitionID: string):
        Promise<{ endpoint: string, key: string; }> {
        const config = await AzureDataEcosystemServices.getPartitionConfiguration(dataPartitionID).catch((error) => {
            throw (Error.makeForHTTPRequest(error));
        });

        if (!config) {
            throw Error.makeForHTTPRequest(`Cosmos endpoint is null`);
        }

        return { endpoint: config.cosmosEndpoint, key: config.cosmosPrimaryKey };
    }


    public static async getPartitions(): Promise<string[]> {
        return AzureDataEcosystemServices.partitionServiceCall(AzureConfig.DataPartitionSvcBaseUrlPath)
    }

    private static async getPartitionConfiguration(dataPartitionID: string): Promise<PartitionConfiguration> {

        const partitionValues = await AzureDataEcosystemServices
            .partitionServiceCall(`${AzureConfig.DataPartitionSvcBaseUrlPath}/${dataPartitionID}`);
        const [
                storageAccountBlobEndpoint,
                cosmosEndpoint,
                cosmosPrimaryKey,
                sdmsStorageAccountName] = await Promise.all([
                this.getConfigurationItem(partitionValues, Keyvault.STORAGE_ACCOUNT_BLOB_ENDPOINT),
                this.getConfigurationItem(partitionValues, Keyvault.DATA_PARTITION_COSMOS_ENDPOINT),
                this.getConfigurationItem(partitionValues, Keyvault.DATA_PARTITION_COSMOS_PRIMARY_KEY),
                this.getConfigurationItem(partitionValues, Keyvault.DATA_PARTITION_STORAGE_ACCOUNT_NAME)
            ]);
        const res = {
                storageAccountBlobEndpoint,
                cosmosEndpoint,
                cosmosPrimaryKey,
                sdmsStorageAccountName
            } as PartitionConfiguration;

        return res;
    }

    private static async getConfigurationItem(values: any, key: string): Promise<string> {
        const item = values[key];
        if (!item) {
          throw Error.makeForHTTPRequest(`Partition Configuration error. Missing configuration value: ${key}`);
        }
        if (!item.sensitive) {
          return item.value;
        }

        return (await Keyvault.CreateSecretClient().getSecret(item.value)).value;
    }

    private static async partitionServiceCall<T>(endpoint: string): Promise<T> {
        const credentials = AzureCredentials.getCredential()
        const aud = AzureConfig.SP_APP_RESOURCE_ID;
        const accessToken = (await credentials.getToken(`${aud}/.default`)).token
        const options = {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            url: AzureConfig.DES_SERVICE_HOST_PARTITION + endpoint
        };
        try {
            return JSON.parse(await request.get(options));
        } catch (error) {
            throw (Error.makeForHTTPRequest(error));
        }
    }
}

class PartitionConfiguration {

    /**
     * Partition Property: 'storage-account-blob-endpoint'
     */
    storageAccountBlobEndpoint: string;

    /**
     * Partition Property: 'cosmos-endpoint'
     */
    cosmosEndpoint: string;

    /**
     * Partition Property: 'cosmos-primary-key'
     *
     * @deprecated this property was deprecated. We need to migrate to MSI for cosmosDb interaction.
     */
    cosmosPrimaryKey: string;

    /**
     * Partition Property: 'sdms-storage-account-name'
     *
     * @deprecated this property was deprecated. Please use `storageAccountBlobEndpoint` instead.
     */
    sdmsStorageAccountName: string;
}

