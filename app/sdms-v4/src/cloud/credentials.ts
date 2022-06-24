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

export interface IAccessTokenModel {
    access_token: string | null;
    expires_in: number;
    token_type: string | null;
}

export interface ICredentials {
    getStorageCredentials(bucket: string, readonly: boolean, partitionID: string): Promise<IAccessTokenModel>;
    getServiceCredentials(): Promise<IAccessTokenModel>;
}

export abstract class AbstractCredentials implements ICredentials {
    public abstract getStorageCredentials(
        bucket: string,
        readonly: boolean,
        partitionID: string
    ): Promise<IAccessTokenModel>;
    public abstract getServiceCredentials(): Promise<IAccessTokenModel>;
}

export class CredentialsFactory extends CloudFactory {
    public static build(providerLabel: string, args: { [key: string]: any } = {}): ICredentials {
        return CloudFactory.build(providerLabel, AbstractCredentials, args) as ICredentials;
    }
}
