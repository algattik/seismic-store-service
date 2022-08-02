// Copyright 2022 Google LLC
// Copyright 2022 EPAM Systems
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

import request from 'request-promise';

import { AbstractCredentials, CredentialsFactory, IAccessTokenModel } from '../../credentials';
import { AnthosConfig } from './config';
import { AnthosDataEcosystemServices } from './dataecosystem';
import { MinIOSTShelper } from './stshelper';
import { PartitionInfo } from './utils';
import { AnthosLogger } from './logger';

const logger = new AnthosLogger();

const KExpiresMargin = 300; // 5 minutes

@CredentialsFactory.register('anthos')
export class AnthosCredentials extends AbstractCredentials {

    private static servicePrincipalCredential: IAccessTokenModel = {
        access_token: undefined,
        expires_in: 0,
        token_type: undefined
    };

    // [OBSOLETE] to remove with /imptoken
    getAudienceForImpCredentials(): string {
        return '';
    }

    // [OBSOLETE] to remove with /imptoken
    getIAMResourceUrl(serviceSigner: string): string {
        return '';
    }

    // [OBSOLETE] to remove with /imptoken
    getPublicKeyCertificatesUrl(): string {
        return '';
    }

    // [OBSOLETE] to remove with /imptoken
    async getServiceAccountAccessToken(): Promise<IAccessTokenModel> {
        return undefined;
    }

    public static async getPartitionInfo(dataPartitionID: string): Promise<PartitionInfo> {
        const token = await AnthosCredentials.getServiceCredentials();
        const options = {
            headers: {
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            url: AnthosConfig.DES_SERVICE_HOST_PARTITION +
                AnthosDataEcosystemServices.getPartitionBaseUrlPath() + dataPartitionID
        };

        try {
            const response = JSON.parse(await request.get(options));

            const endpoint: string = response['properties']['obm.minio.endpoint']['value'];
            const accessKey: string = response['properties']['obm.minio.accessKey']['value'];
            const secretKey: string = response['properties']['obm.minio.secretKey']['value'];

            const partitionInfo: PartitionInfo = {
                endpoint,
                accessKey,
                secretKey,
            }

            return partitionInfo;
        }
        catch (err) {

            logger.info(err.code + ': ' + err.message);
            throw err;
        }
    }

    public async getStorageCredentials(
        tenant: string,
        subproject: string,
        subprojectPath: string, // <bucket_name>$$<subProjectFolder>
        readonly: boolean,
        _partition: string
    ): Promise<IAccessTokenModel> {
        let flagUpload = true;

        const partitionInfo: PartitionInfo = {
            endpoint: AnthosConfig.MINIO_ENDPOINT,
            accessKey: AnthosConfig.MINIO_ACCESS_KEY,
            secretKey: AnthosConfig.MINIO_SECRET_KEY,
        }

        const splitPath = subprojectPath.split('$$');
        const S3bucket = splitPath[0];
        const subprojectFolder = splitPath[1];

        // tslint:disable-next-line:triple-equals
        if (readonly) { // readOnly True
            flagUpload = false;
        } else   // readOnly False
        {
            flagUpload = true;
        }

        const minIOSTSHelper = new MinIOSTShelper(partitionInfo);
        const credentials = await minIOSTSHelper.getCredentials(
            S3bucket,
            subprojectFolder,
            'arn:x:ignored:by:minio:',
            flagUpload,
            '3600'
        );

        const result = {
            access_token: credentials,
            expires_in: 3599,
            token_type: 'Bearer',
        };
        return result;
    }

    // this will return access token
    public static async getServiceCredentials(): Promise<string> {
        if (AnthosCredentials.servicePrincipalCredential &&
            AnthosCredentials.servicePrincipalCredential.expires_in > Math.floor(Date.now() / 1000)) {
            return AnthosCredentials.servicePrincipalCredential.access_token;
        }

        const options = {
            form: {
                grant_type: 'client_credentials',
                scope: 'openid partition-and-entitlements',
                client_id: AnthosConfig.KEYCLOAK_CLIENT_ID,
                client_secret: AnthosConfig.KEYCLOAK_CLIENT_SECRET
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            url: AnthosConfig.KEYCLOAK_URL
        };
        const response = JSON.parse(await request.post(options));
        AnthosCredentials.servicePrincipalCredential = response as IAccessTokenModel;
        AnthosCredentials.servicePrincipalCredential.expires_in = Math.floor(Date.now() / 1000) +
            +AnthosCredentials.servicePrincipalCredential.expires_in - KExpiresMargin;
        const val = response['access_token'];
        return (Promise.resolve(val.toString()));
    }

}
