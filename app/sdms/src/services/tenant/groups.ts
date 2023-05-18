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

import { TenantModel } from '.';
import { Config } from '../../cloud';

export class TenantGroups {

    public static serviceGroupPrefix(tenantName: string): string {
        return Config.SERVICEGROUPS_PREFIX + '.' + Config.SERVICE_ENV + '.' + tenantName;
    }

    public static dataGroupPrefix(tenantName: string): string {
        return Config.DATAGROUPS_PREFIX + '.' + tenantName;
    }

    public static adminGroupName(tenant: TenantModel): string {
        return tenant.default_acls.split('@')[0];
    }

    public static adminGroup(tenant: TenantModel): string {
        return tenant.default_acls;
    }

    public static datalakeUserAdminGroupEmail(esd: string): string {
        return TenantGroups.datalakeUserAdminGroupName() + '@' + esd;
    }

    public static datalakeUserAdminGroupName(): string {
        return 'users.datalake.admins';
    }

    public static userGroup(esd: string): string {
        return 'users@' + esd;
    }

}
