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

import { CloudFactory } from './cloud';

export interface ITrace {
    start(): void;
}

export abstract class AbstractTrace implements ITrace {
    public abstract start(): void;
}

export class TraceFactory extends CloudFactory {
    public static build(providerLabel: string): ITrace {
        return CloudFactory.build(providerLabel, AbstractTrace) as ITrace;
    }
}
