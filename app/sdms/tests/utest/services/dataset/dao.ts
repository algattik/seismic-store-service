// ============================================================================
// Copyright 2017-2023, Schlumberger
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

import sinon from 'sinon';
import { DatasetModel, PaginationModel } from '../../../../src/services/dataset';
import { Config, IJournal, IJournalTransaction } from '../../../../src/cloud';
import { AzureConfig } from '../../../../src/cloud/providers/azure';
import { Utils } from '../../../../src/shared';
import { Locker } from '../../../../src/services/dataset/locker';
import { PaginatedDatasetList } from '../../../../src/services/dataset/model';
import { AzureCosmosDbQuery } from '../../../../src/cloud/providers/azure';
import { DatasetDAO as DAO } from '../../../../src/services/dataset/';
import { Tx } from '../../utils';
import { IJournalQueryModel } from '../../../../src/cloud/journal';
import { threadId } from 'worker_threads';

export class DatasetDAOTest {

    private static sandbox: sinon.SinonSandbox;

    public static run() {

        describe(Tx.testInit("Dataset/DAO"), () => {

            this.sandbox = sinon.createSandbox();
            let datasetModel: DatasetModel = {
                name: 'name',
                tenant: 'tenant',
                subproject: 'subproject',
                path: 'sd://tenant/subproject/path/mydata.txt',
                created_date: '',
                last_modified_date: '',
                created_by: '',
                metadata: undefined,
                filemetadata: undefined,
                gcsurl: '',
                type: '',
                ltag: '',
                ctag: '0000000000000000',
                sbit: '',
                sbit_count: 0,
                gtags: ["gtag1"],
                readonly: false,
                seismicmeta_guid: '',
                transfer_status: '',
                acls: { admins: [], viewers: [] },
                access_policy: ''
            };

            let iJournalQueryModel: IJournalQueryModel = {
                filter: function (property: string, value: {}): IJournalQueryModel {
                    return iJournalQueryModel;
                },
                start: function (start: string | Buffer): IJournalQueryModel {
                    return iJournalQueryModel;
                },
                limit: function (n: number): IJournalQueryModel {
                    return iJournalQueryModel;
                },
                groupBy: function (fieldNames: string | string[]): IJournalQueryModel {
                    return iJournalQueryModel;
                },
                select: function (fieldNames: string | string[]): IJournalQueryModel {
                    return iJournalQueryModel;
                }
            };

            let pagination: PaginationModel = {
                limit: 1,
                cursor: 'cursor'
            };

            let journalClient: IJournal = {
                get: function (key: any): Promise<[any]> {
                    return Promise.resolve([ datasetModel ]);
                },
                save: function (entity: any): Promise<any> {
                    return Promise.resolve("exit saved");
                },
                delete: function (key: any): Promise<any> {
                    return Promise.resolve("exit delete");
                },
                createQuery: function (namespace: string, kind: string): IJournalQueryModel {
                    return iJournalQueryModel;
                },
                runQuery: function (query: IJournalQueryModel): Promise<[any[], { endCursor?: string | undefined; }]> {
                    return Promise.resolve( [[datasetModel], {}] );
                },
                createKey: function (specs: any): object {
                    return {};
                },
                getTransaction: function (): IJournalTransaction {
                    throw new Error('Function not implemented.');
                },
                getQueryFilterSymbolContains: function (): string {
                    return "=";
                },
                KEY: undefined
            };

            //beforeEach(() => {  });
            afterEach(() => { this.sandbox.restore(); });

            this.registerTest(journalClient, datasetModel);
            this.getByKeyTest(journalClient, datasetModel);
            this.getTest(journalClient, datasetModel);
            this.updateTest(journalClient, datasetModel);
            this.updateAllTest(journalClient, datasetModel);
            this.listTest(journalClient, datasetModel, pagination);
            this.deleteAllTest(journalClient, datasetModel);
            this.deleteTest(journalClient, datasetModel);
            this.paginatedListContentTest(journalClient, datasetModel, pagination);
            this.listDatasetsTest(journalClient, datasetModel, pagination);
            this.listContentTest(journalClient, datasetModel);
            this.fixOldModelTest(datasetModel);

        } );
    };

    private static registerTest(journalClient: IJournal, datasetModel: DatasetModel) {

        Tx.sectionInit("registerTest");

        Tx.testExp(async (done: any) => {
            let datasetEntity: { key: object, data: DatasetModel; } = {
                key: {},
                data: datasetModel
            };
            await DAO.register(journalClient, datasetEntity);
            done();

        } );
        
    };
    
    private static getByKeyTest(journalClient: IJournal, datasetModel: DatasetModel) {

        Tx.sectionInit("getByKeyTest");

        Tx.testExp(async (done: any) => {

            let dm = await DAO.getByKey(journalClient, datasetModel);
            Tx.checkTrue(!(dm === undefined), done);

        } );
        
    };

    private static getTest(journalClient: IJournal, datasetModel: DatasetModel) {

        Tx.sectionInit("getTest");

        Tx.testExp(async (done: any) => {

            let dm = await DAO.get(journalClient, datasetModel);
            Tx.checkTrue(!(dm === undefined), done);

        } );
        
    };

    private static updateTest(journalClient: IJournal, datasetModel: DatasetModel) {

        Tx.sectionInit("updateTest");

        Tx.testExp(async (done: any) => {

            await DAO.update(journalClient, datasetModel, { key: "" });
            done();

        } );
        
    };

    private static updateAllTest(journalClient: IJournal, datasetModel: DatasetModel) {

        Tx.sectionInit("updateAllTest");

        Tx.testExp(async (done: any) => {

            await DAO.updateAll(journalClient, [{ data: datasetModel,  key: "" } ]);
            done();

        } );
        
    };

    private static listTest(journalClient: IJournal, datasetModel: DatasetModel, pagination: PaginationModel) {

        Tx.sectionInit("listTest");

        Tx.testExp(async (done: any) => {

            let pm = await DAO.list(journalClient, datasetModel, pagination);
            Tx.checkTrue(!(pm === undefined), done);

        } );

        Tx.testExp(async (done: any) => {

            datasetModel.gtags = [];
            let pm = await DAO.list(journalClient, datasetModel, pagination);
            datasetModel.gtags = ["gtags"];
            Tx.checkTrue(!(pm === undefined), done);

        } );
        
    };

    private static deleteAllTest(journalClient: IJournal, datasetModel: DatasetModel) {

        Tx.sectionInit("deleteAllTest");

        Tx.testExp(async (done: any) => {

            await DAO.deleteAll(journalClient, datasetModel.tenant, datasetModel.subproject);
            done();

        } );
        
    };

    private static deleteTest(journalClient: IJournal, datasetModel: DatasetModel) {

        Tx.sectionInit("deleteTest");

        Tx.testExp(async (done: any) => {

            await DAO.delete(journalClient, datasetModel);
            done();

        } );
        
    };

    private static paginatedListContentTest(journalClient: IJournal, datasetModel: DatasetModel, pagination: PaginationModel) {

        Tx.sectionInit("paginatedListContentTest");

        Tx.testExp(async (done: any) => {

            let output = await DAO.paginatedListContent(journalClient, datasetModel, "datasets", pagination);
            Tx.checkTrue(!(output === undefined), done);

        } );

        Tx.testExp(async (done: any) => {

            pagination.cursor = '';
            let output = await DAO.paginatedListContent(journalClient, datasetModel, "dirs", pagination);
            pagination.cursor = 'cursor';
            Tx.checkTrue(!(output === undefined), done);

        } );
        
    };

    private static listDatasetsTest(journalClient: IJournal, datasetModel: DatasetModel, pagination: PaginationModel) {

        Tx.sectionInit("listDatasetsTest");

        Tx.testExp(async (done: any) => {

            let output = await DAO.listDatasets(journalClient, datasetModel.tenant, datasetModel.subproject, pagination);
            Tx.checkTrue(!(output === undefined), done);

        } );
        
    };

    private static listContentTest(journalClient: IJournal, datasetModel: DatasetModel) {

        Tx.sectionInit("listContentTest");

        Tx.testExp(async (done: any) => {

            let results = await DAO.listContent(journalClient, datasetModel, "dirs");
            Tx.checkTrue(!(results === undefined), done);

        } );

        Tx.testExp(async (done: any) => {

            let results = await DAO.listContent(journalClient, datasetModel, "datasets");
            Tx.checkTrue(!(results === undefined), done);

        } );
        
    };

    private static fixOldModelTest(datasetModel: DatasetModel) {

        Tx.sectionInit("fixOldModelTest");

        Tx.testExp(async (done: any) => {

            this.sandbox.stub(Locker, "getLock").resolves(["xx"]);
            let entity = await DAO.fixOldModel(datasetModel, datasetModel.tenant, datasetModel.subproject);
            Tx.checkTrue(!(entity === undefined), done);

        } );

        Tx.testExp(async (done: any) => {

            this.sandbox.stub(Locker, "getLock").resolves("xx");
            let entity = await DAO.fixOldModel(datasetModel, datasetModel.tenant, datasetModel.subproject);
            Tx.checkTrue(!(entity === undefined), done);

        } );

        Tx.testExp(async (done: any) => {

            let datasetModelclone = JSON.parse(JSON.stringify(datasetModel));
            datasetModelclone.tenant = '';
            datasetModelclone.subproject = '';
            datasetModelclone.ctag = '';
            datasetModelclone.readonly = true;
            let entity = await DAO.fixOldModel(datasetModelclone, datasetModel.tenant, datasetModel.subproject);
            Tx.checkTrue(!(entity === undefined), done);

        } );
        
    };

}