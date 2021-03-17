// Copyright © 2020 Amazon Web Services
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


import {
    AbstractDataEcosystemCore,
    DataEcosystemCoreFactory,
    IDESEntitlementGroupMembersModel } from '../../dataecosystem';
import { AWSCredentials } from './credentials';

@DataEcosystemCoreFactory.register('aws')
export class AWSDataEcosystemServices extends AbstractDataEcosystemCore {
    public getDataPartitionIDRestHeaderName(): string { return 'data-partition-id'; }
    public getEntitlementBaseUrlPath(): string { return '/entitlements/v1'; };
    public getComplianceBaseUrlPath(): string { return '/legal/v1'; };
    public getStorageBaseUrlPath(): string { return '/storage/v2'; };

    public async getAuthorizationHeader(userToken: string): Promise<string> {
        return 'Bearer ' + await new AWSCredentials().getServiceCredentials();
    }

    public fixGroupMembersResponse(groupMembers: any): IDESEntitlementGroupMembersModel {
        return groupMembers as IDESEntitlementGroupMembersModel;
    }

    public getUserAddBodyRequest(userEmail: string, role: string): {email: string, role: string} | string[] {
        return { email: userEmail, role }
    }

    public tenantNameAndDataPartitionIDShouldMatch() {
        return false;
    }

}