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

import request from 'request-promise';
import { Cache, Error } from '../../../shared';
import {
    AbstractDataEcosystemCore,
    DataEcosystemCoreFactory,
    IDESEntitlementGroupMembersModel
} from '../../dataecosystem';
import { AzureConfig } from './config';
import { AzureCredentials } from './credentials';
import { Keyvault } from './keyvault';

@DataEcosystemCoreFactory.register('azure')
export class AzureDataEcosystemServices extends AbstractDataEcosystemCore {

    private static _partitionConfigCache: Cache<PartitionConfiguration>;

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
        const config = await AzureDataEcosystemServices.getPartitionConfiguration(dataPartitionID);
        return config.storageAccountBlobEndpoint
            ? config.storageAccountBlobEndpoint
            : `http://${config.sdmsStorageAccountName}.blob.core.windows.net`;
    }

    public static async getCosmosConnectionParams(dataPartitionID: string):
        Promise<{ endpoint: string, key: string; }> {
        const config = await AzureDataEcosystemServices.getPartitionConfiguration(dataPartitionID);
        return { endpoint: config.cosmcosmosEndpoint, key: config.cosmosPrimaryKey };
    }

    public static async getPartitions(): Promise<string[]> {
        return AzureDataEcosystemServices.partitionServiceCall('/api/partition/v1/partitions')
    }

    private static async getPartitionConfiguration(dataPartitionID: string): Promise<PartitionConfiguration> {
        if (!AzureDataEcosystemServices._partitionConfigCache) {
            AzureDataEcosystemServices._partitionConfigCache = new Cache<PartitionConfiguration>('partitionConfig');
        }

        const partitionConfig = await this._partitionConfigCache.get(dataPartitionID);
        if (partitionConfig !== undefined) {
            return partitionConfig;
        } else {
            const partitionValues = await AzureDataEcosystemServices
                .partitionServiceCall(`/api/partition/v1/partitions/${dataPartitionID}`);
            const [
                storageAccountBlobEndpoint,
                cosmcosmosEndpoint,
                cosmosPrimaryKey,
                sdmsStorageAccountName] = await Promise.all([
                this.getConfigurationItem(partitionValues, Keyvault.STORAGE_ACCOUNT_BLOB_ENDPOINT),
                this.getConfigurationItem(partitionValues, Keyvault.DATA_PARTITION_COSMOS_ENDPOINT),
                this.getConfigurationItem(partitionValues, Keyvault.DATA_PARTITION_COSMOS_PRIMARY_KEY),
                this.getConfigurationItem(partitionValues, Keyvault.DATA_PARTITION_STORAGE_ACCOUNT_NAME)
            ]);
            const res = {
                storageAccountBlobEndpoint,
                cosmcosmosEndpoint,
                cosmosPrimaryKey,
                sdmsStorageAccountName
            } as PartitionConfiguration;

            AzureDataEcosystemServices._partitionConfigCache.set(dataPartitionID, res)
                .catch(err => {
                    throw Error.makeForHTTPRequest(err)
                });
            return res;
        }
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
    cosmcosmosEndpoint: string;

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
