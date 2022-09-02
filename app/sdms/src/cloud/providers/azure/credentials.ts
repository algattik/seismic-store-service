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
import qs from 'qs';

import { Error } from '../../../shared';
import { AbstractCredentials, CredentialsFactory, IAccessTokenModel } from '../../credentials';
import {
    ContainerSASPermissions,
    BlobServiceClient,
    generateBlobSASQueryParameters,
    SASProtocol,
    UserDelegationKey
} from '@azure/storage-blob';
import { DefaultAzureCredential, TokenCredential, DefaultAzureCredentialOptions } from '@azure/identity';
import { AzureDataEcosystemServices } from './dataecosystem';
import {ExponentialRetryPolicyOptions} from '@azure/core-rest-pipeline'
import { AccessToken, GetTokenOptions } from '@azure/core-auth';

const KExpiresMargin = 300; // 5 minutes
const UserDelegationKeyValidityInMinutes = 3599; // expires at the same time as the sas token
const ExpirationLeadInMinutes = 15; // expire 15 minutes before actual date
const SasExpirationInMinutes = 3599; // shortly under 2.5 days

interface ICachedUserDelegationKey {
    key: UserDelegationKey;
    expiration: Date;
}

@CredentialsFactory.register('azure')
export class AzureCredentials extends AbstractCredentials {
    private delegationKeyMap: Map<string, ICachedUserDelegationKey>;
    private defaultAzureCredential: TokenCredential;

    private static servicePrincipalCredential: IAccessTokenModel = {
        access_token: undefined,
        expires_in: 0,
        token_type: undefined
    };

    public constructor() {
        super();
        this.delegationKeyMap = new Map<string, ICachedUserDelegationKey>();
        this.defaultAzureCredential = AzureCredentials.getCredential();
    }

    public static getCredential(): TokenCredential {

        // To leverage managed identity when running locally,
        // the local environment expects the following three environment variables:
        // - AZURE_TENANT_ID: The tenant ID in Azure Active Directory
        // - AZURE_CLIENT_ID: The application (client) ID registered in the AAD tenant
        // - AZURE_CLIENT_SECRET: The client secret for the registered application
        // https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview

        return new RetriableAzureCredential();
    }

    public static async getAzureServicePrincipalAccessToken(
        clientID: string, clientSecret: string, tenantID: string, appResourceID: string): Promise<IAccessTokenModel> {

        if (AzureCredentials.servicePrincipalCredential &&
            AzureCredentials.servicePrincipalCredential.expires_in > Math.floor(Date.now() / 1000) &&
            AzureCredentials.servicePrincipalCredential.token_type ===
            'internal;' + clientID + ';' + clientSecret + ';' + tenantID + ';' + appResourceID) {
            return AzureCredentials.servicePrincipalCredential;
        }

        const data = qs.stringify({
            grant_type: 'client_credentials',
            client_id: clientID,
            // pragma: allowlist nextline secret
            client_secret: clientSecret,
            resource: appResourceID
        });
        const headers = {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        const url = 'https://login.microsoftonline.com/' + tenantID + '/oauth2/token';

        const results = await axios.post(url, data, headers).catch((error) => {
            throw (Error.makeForHTTPRequest(error));
        });
        AzureCredentials.servicePrincipalCredential = results.data as IAccessTokenModel;
        AzureCredentials.servicePrincipalCredential.expires_in = Math.floor(Date.now() / 1000) +
            +AzureCredentials.servicePrincipalCredential.expires_in - KExpiresMargin;
        AzureCredentials.servicePrincipalCredential.token_type =
            'internal;' + clientID + ';' + clientSecret + ';' + tenantID + ';' + appResourceID;
        return AzureCredentials.servicePrincipalCredential;
    }

    public async getStorageCredentials(
        tenant: string, subproject: string,
        bucket: string,readonly: boolean,partition: string): Promise<IAccessTokenModel> {
        const accountName = await AzureDataEcosystemServices.getStorageResourceName(partition);
        const now = new Date();
        const expiration = this.addMinutes(now, SasExpirationInMinutes);
        const sasToken = await this.generateSASToken(accountName, bucket, expiration, readonly);
        const result = {
            access_token: sasToken,
            expires_in: 3599,
            token_type: 'SasUrl',
        };
        return result;
    }

    private async generateSASToken(
        accountName: string, containerName: string, expiration: Date, readOnly: boolean): Promise<string> {

        const blobServiceClient = new BlobServiceClient(
            `https://${accountName}.blob.core.windows.net`,
            this.defaultAzureCredential
        );

        const userDelegationKey = await this.getDelegationKey(blobServiceClient);

        const permissions = new ContainerSASPermissions();
        permissions.list = true;
        permissions.write = !readOnly;
        permissions.create = !readOnly;
        permissions.delete = !readOnly;
        permissions.read = true;

        const containerSAS = generateBlobSASQueryParameters({
            containerName,
            permissions,
            protocol: SASProtocol.Https,
            expiresOn: expiration
        }, userDelegationKey, // UserDelegationKey
            accountName);
        return `https://${accountName}.blob.core.windows.net/${containerName}?${containerSAS.toString()}`;
    }

    private async getDelegationKey(blobServiceClient: BlobServiceClient): Promise<UserDelegationKey> {
        const key = blobServiceClient.accountName;
        const now = new Date();
        const cache = this.delegationKeyMap.get(key);
        if (cache && cache.expiration > now) {
            return cache.key;
        }

        const expiresOn = this.addMinutes(now, UserDelegationKeyValidityInMinutes);

        // Getting a key that is valid from ExpirationLeadInMinutes ago, in order to handle clock differences
        const response = await blobServiceClient.getUserDelegationKey(
            this.addMinutes(now, -ExpirationLeadInMinutes),
            expiresOn);

        // Expiring the key ExpirationLeadInMinutes before it stops being valid in order to handle clock differences
        const keyExpiration = this.addMinutes(expiresOn, -ExpirationLeadInMinutes);
        this.delegationKeyMap.set(key, { key: response, expiration: keyExpiration });

        return response;
    }

    private addMinutes(d: Date, minutes: number): Date {
        return new Date(d.valueOf() + (minutes * 60 * 1000));
    }

    // [OBSOLETE] to remove with /imptoken
    public async getServiceAccountAccessToken(): Promise<IAccessTokenModel> {
        throw (Error.make(Error.Status.NOT_IMPLEMENTED, 'Method not implemented.'));
    }

    // [OBSOLETE] to remove with /imptoken
    public getIAMResourceUrl(serviceSigner: string): string {
        throw (Error.make(Error.Status.NOT_IMPLEMENTED, 'Method not implemented.'));
    }

    // [OBSOLETE] to remove with /imptoken
    public getAudienceForImpCredentials(): string {
        throw (Error.make(Error.Status.NOT_IMPLEMENTED, 'Method not implemented.'));
    }

    // [OBSOLETE] to remove with /imptoken
    public getPublicKeyCertificatesUrl(): string {
        throw (Error.make(Error.Status.NOT_IMPLEMENTED, 'Method not implemented.'));
    }

}

class RetriableAzureCredential extends DefaultAzureCredential {

    private static DefaultRetryCount = 10;
    private static DefaultRetryInterval = 1000;
    private static DefaultMaxRetryInterval = 64 * 1000;
    private static DefaultRequestTimeout = 5 * 1000;

    private options:ExponentialRetryPolicyOptions  = {
        maxRetries: RetriableAzureCredential.DefaultRetryCount,
        retryDelayInMs: RetriableAzureCredential.DefaultRetryInterval, // Not supported yet
        maxRetryDelayInMs: RetriableAzureCredential.DefaultMaxRetryInterval // Not supported yet
    };

    private credentials: DefaultAzureCredential;

    private defaultRequestOptions = {
        requestOptions: {
            timeout: RetriableAzureCredential.DefaultRequestTimeout
        }
    };

    public constructor(tokenCredentialOptions?: DefaultAzureCredentialOptions) {
        super(tokenCredentialOptions);
        const retryOptions = tokenCredentialOptions?.retryOptions;
        this.options = {...this.options, ...retryOptions}
        this.credentials = new DefaultAzureCredential();
    }

    public getToken(scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> {
        const requestOptions = {...options, ...this.defaultRequestOptions};
        return this.retry(() => this.credentials.getToken(scopes, requestOptions));
    }

    private async retry <T> (fn: () => Promise<T>, retries: number = this.options.maxRetries): Promise<T> {
        if(retries <= 0) {
            return Promise.reject('Failed after several attempts');
        }

        const prom = fn();
        return prom
            .then(res => prom)
            .catch(err => this.retry(fn, retries - 1))
    }
}
