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

export interface ISecrets {
    getSecret(key: string): Promise<string>;
}

export abstract class AbstractSecrets implements ISecrets {
    public abstract getSecret(key: string): Promise<string>;
}

export class SecretsFactory extends CloudFactory {
    public static build(providerLabel: string): ISecrets {
        return CloudFactory.build(providerLabel, AbstractSecrets) as ISecrets;
    }
}
