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

export interface IDatasetModel {
    name: string;
    tenant: string;
    subproject: string;
    path: string;
    created_date: string;
    last_modified_date: string;
    created_by: string;
    metadata: any;
    filemetadata: any;
    gcsurl: string;
    type: string;
    ltag: string;
    ctag: string;
    sbit: string;
    sbit_count: number;
    gtags: string[];
    readonly: boolean;
    seismicmeta_guid: string;
    transfer_status: string;
}

export interface IPaginationModel {
    limit: number;
    cursor: string;
}
