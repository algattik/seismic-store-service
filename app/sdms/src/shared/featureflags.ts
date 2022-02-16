// ============================================================================
// Copyright 2017-2021, Schlumberger
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

import { Config } from '../cloud';

export enum Feature {
    AUTHORIZATION,
    LEGALTAG,
    SEISMICMETA_STORAGE,
    STORAGE_CREDENTIALS,
    IMPTOKEN,
    TRACE,
    LOGGING,
    STACKDRIVER_EXPORTER,
    CCM_INTERACTION,
    POLICY_SERVICE_INTERACTION,
}

export class FeatureFlags {
    public static isEnabled(flag: Feature): boolean {
        return flag === Feature.AUTHORIZATION && Config.FEATURE_FLAG_AUTHORIZATION ||
            flag === Feature.LEGALTAG && Config.FEATURE_FLAG_LEGALTAG ||
            flag === Feature.SEISMICMETA_STORAGE && Config.FEATURE_FLAG_SEISMICMETA_STORAGE ||
            flag === Feature.STORAGE_CREDENTIALS && Config.FEATURE_FLAG_STORAGE_CREDENTIALS ||
            flag === Feature.IMPTOKEN && Config.FEATURE_FLAG_IMPTOKEN ||
            flag === Feature.TRACE && Config.FEATURE_FLAG_TRACE ||
            flag === Feature.LOGGING && Config.FEATURE_FLAG_LOGGING ||
            flag === Feature.STACKDRIVER_EXPORTER && Config.FEATURE_FLAG_STACKDRIVER_EXPORTER ||
            flag === Feature.CCM_INTERACTION && Config.FEATURE_FLAG_CCM_INTERACTION ||
            flag === Feature.POLICY_SERVICE_INTERACTION && Config.FEATURE_FLAG_POLICY_SVC_INTERACTION;

    }
}
