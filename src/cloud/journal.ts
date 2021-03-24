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

import { Config } from './config';
import { CloudFactory } from './cloud';
import { TenantModel } from '../services/tenant';

export interface IJournalQueryModel {
    filter(property: string, value: {}): IJournalQueryModel;
    filter(
        property: string,
        operator: '=' | '<' | '>' | '<=' | '>=' | 'HAS_ANCESTOR',
        value: {}): IJournalQueryModel;
    start(start: string | Buffer): IJournalQueryModel;
    limit(n: number): IJournalQueryModel;
    groupBy(fieldNames: string | string[]): IJournalQueryModel;
    select(fieldNames: string | string[]): IJournalQueryModel;
}

export interface IJournal {
    get(key: any): Promise<[any | any[]]>;
    save(entity: any): Promise<void>;
    delete(key: any): Promise<void>;
    createQuery(namespace: string, kind: string): IJournalQueryModel;
    runQuery(query: IJournalQueryModel): Promise<[any[], {endCursor?: string}]>;
    createKey(specs: any): object;
    getTransaction(): IJournalTransaction;
    getQueryFilterSymbolContains(): string;
    KEY: symbol;
}

export interface IJournalTransaction {
    get(key: any): Promise<[any | any[]]>;
    save(entity: any): Promise<void>;
    delete(key: any): Promise<void>;
    createQuery(namespace: string, kind: string): IJournalQueryModel;
    runQuery(IJournalQueryModel: any): Promise<[any[], {endCursor?: string}]>;
    run(): Promise<void>;
    rollback(): Promise<void>;
    commit(): Promise<void>;
    getQueryFilterSymbolContains(): string;
    KEY: symbol;
}

export abstract class AbstractJournal implements IJournal {
    public abstract KEY: symbol;
    public abstract get(key: any): Promise<[any | any[]]>;
    public abstract save(entity: any): Promise<void>;
    public abstract delete(key: any): Promise<void>;
    public abstract createQuery(namespace: string, kind: string): IJournalQueryModel;
    public abstract runQuery(query: IJournalQueryModel): Promise<[any[], {endCursor?: string}]>;
    public abstract createKey(specs: any): object;
    public abstract getTransaction(): IJournalTransaction;
    public abstract getQueryFilterSymbolContains(): string;
}

export abstract class AbstractJournalTransaction implements IJournalTransaction {
    public abstract KEY: symbol;
    public abstract get(key: any): Promise<[any | any[]]>;;
    public abstract save(entity: any): Promise<void>;
    public abstract delete(key: any): Promise<void>;
    public abstract createQuery(namespace: string, kind: string): IJournalQueryModel;
    public abstract runQuery(query: IJournalQueryModel): Promise<[any[], {endCursor?: string}]>;
    public abstract run(): Promise<void>;
    public abstract rollback(): Promise<void>;
    public abstract commit(): Promise<void>;
    public abstract getQueryFilterSymbolContains(): string;
}

export class JournalFactory extends CloudFactory {
    public static build(providerLabel: string, args: { [key: string]: any } = {}): IJournal {
        return CloudFactory.build(providerLabel, AbstractJournal, args) as IJournal;
    }
}

export class JournalFactoryServiceClient {
    public static get(tenant?: TenantModel): IJournal {
        return JournalFactory.build(Config.CLOUDPROVIDER, tenant) as IJournal;
    }
}

export class JournalFactoryTenantClient {
    public static get(tenant: TenantModel): IJournal {
        return JournalFactory.build(Config.CLOUDPROVIDER, tenant) as IJournal;
    }
}
