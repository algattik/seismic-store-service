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

import { Datastore } from '@google-cloud/datastore';
import { Request as expRequest, Response as expResponse } from 'express';
import { Auth } from '../../../src/auth';
import { Config, google, StorageFactory } from '../../../src/cloud';
import { DESStorage, DESUtils, DESUserAssociation } from '../../../src/dataecosystem';
import { IStorage } from '../../../src/cloud/storage';
import { DatasetDAO, DatasetModel } from '../../../src/services/dataset';
import { DatasetHandler } from '../../../src/services/dataset/handler';
import { Locker } from '../../../src/services/dataset/locker';
import { IDatasetModel } from '../../../src/services/dataset/model';
import { DatasetOP } from '../../../src/services/dataset/optype';
import { DatasetParser } from '../../../src/services/dataset/parser';
import { SubProjectDAO, SubProjectModel } from '../../../src/services/subproject';
import { TenantDAO, TenantModel } from '../../../src/services/tenant';
import { Response } from '../../../src/shared';
import { Tx } from '../utils';

export class TestDatasetSVC {

    private static testSubProject = {
        name: 'test-subproject',
        admin: 'test-admin@domain.com',
        tenant: 'test-tenant',
        storage_class: 'geo-location',
        acls: {
            admins: ['admin-a@domain.com'],
            viewers: ['vieweres-b@domain.com']
        },
        ltag: 'legalTag',
        access_policy: 'uniform'
    } as SubProjectModel;

    private static dataset = {
        filemetadata: {},
        last_modified_date: '01/05/2019',
        metadata: {},
        name: 'd',
        path: 'p',
        subproject: 's',
        tenant: 't',
    } as DatasetModel;


    private static sandbox: sinon.SinonSandbox;

    private static journal: any;
    private static transaction: any;
    private static testDb: Datastore;

    public static run() {

        TestDatasetSVC.testDb = new Datastore({ projectId: 'GoogleProjectID' });

        describe(Tx.testInit('dataset'), () => {
            this.sandbox = sinon.createSandbox();

            beforeEach(() => {
                this.sandbox.stub(TenantDAO, 'get').resolves({} as any);
                this.sandbox.stub(SubProjectDAO, 'get').resolves(this.testSubProject as any);

                this.transaction = this.sandbox.createStubInstance(google.DatastoreTransactionDAO);
                this.transaction.createQuery.callsFake(
                    (namespace, kind) => TestDatasetSVC.testDb.createQuery(namespace, kind));

                this.journal = this.sandbox.createStubInstance(google.DatastoreDAO);
                this.journal.createKey.callsFake((specs) => TestDatasetSVC.testDb.key(specs));
                this.journal.createQuery.callsFake(
                    (namespace, kind) => TestDatasetSVC.testDb.createQuery(namespace, kind));
                this.journal.getTransaction.returns(this.transaction);
                this.journal.getQueryFilterSymbolContains.returns('-');
                this.journal.KEY = Datastore.KEY;
            });

            afterEach(() => { this.sandbox.restore(); });

            this.ctag();
            this.register();
            this.validateAcls();
            this.get();
            this.list();
            this.delete();
            this.patch();
            this.exist();
            this.sizes();
            this.size();
            this.listContent();
            this.permissions();
            this.others();
            this.putTags();
            this.lock();
            this.unlock();
            this.listPost();

        });

    }

    private static listPost() {

        Tx.sectionInit('listPost');

        Tx.testExp(async (done: any, expReq: expRequest) => {
            expReq.query.ctag = 'xxx';

            DatasetParser.listPost(expReq);
            done();

        });

        Tx.testExp(async (done: any, expReq: expRequest) => {
            // expReq.query.ctag = 'xxx';
            // expReq.body = {};

            DatasetParser.listPost(expReq);
            done();

        });

        // Tx.testExp(async (done: any, expReq: expRequest) => {
        //     // expReq.query.ctag = 'xxx';
        //     expReq.body.gtag = "tag";

        //     DatasetParser.listPost(expReq);
        //     done();

        // });
    }

    private static ctag() {

        Tx.sectionInit('ctag');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.params.path = '/';
            expReq.query.ctag = '000000000000000xxxxx';
            const dataset = {
                ctag: '00000000000xxxxx',
            } as DatasetModel;
            this.sandbox.stub(DatasetDAO, 'get').resolves([dataset, undefined]);
            await DatasetHandler.handler(expReq, expRes, DatasetOP.CheckCTag);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.params.path = '/';
            expReq.query.ctag = '000000000000000xxxxx';
            this.sandbox.stub(DatasetDAO, 'get').resolves([undefined, undefined]);
            await DatasetHandler.handler(expReq, expRes, DatasetOP.CheckCTag);
            Tx.check404(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest) => {
            expReq.query.ctag = 'xxx';
            try {
                DatasetParser.checkCTag(expReq);
            } catch (e) { Tx.check400(e.error.code, done); }
        });

    }

    private static register() {

        Tx.sectionInit('register');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetDAO, 'get').resolves([] as any);
            this.sandbox.stub(DatasetDAO, 'register').resolves();
            this.sandbox.stub(DESStorage, 'insertRecord').resolves();
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            this.sandbox.stub(Auth, 'isLegalTagValid').resolves(true);
            this.sandbox.stub(Locker, 'createWriteLock').resolves(
                { idempotent: false, key: 'x', mutex: 'x', wid: 'x' });
            this.sandbox.stub(Locker, 'removeWriteLock').resolves();
            this.sandbox.stub(DESUtils, 'getDataPartitionID');
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Register);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetDAO, 'get').resolves([{ ltag: 'l' }] as any);
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            this.sandbox.stub(Auth, 'isLegalTagValid').resolves(true);
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Register);
            Tx.check409(expRes.statusCode, done)
        });

        Tx.test(async (done: any) => {
            this.journal.runQuery.resolves([[], {}] as never);
            this.journal.save.resolves({} as never);

            const datasetKey = this.journal.createKey({
                namespace: Config.SEISMIC_STORE_NS + '-' + this.dataset.tenant + '-' + this.dataset.subproject,
                path: [Config.DATASETS_KIND],
            });

            await DatasetDAO.register(this.journal, { key: datasetKey, data: this.dataset });
            done();
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.body.seismicmeta = {
                data: { msg: 'seismic metadata' },
                kind: 'slb:seistore:seismic2d:1.0.0',
            };

            this.sandbox.stub(DatasetDAO, 'get').resolves([] as any);
            this.sandbox.stub(DatasetDAO, 'register').resolves();
            this.sandbox.stub(DESStorage, 'insertRecord').resolves();
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            this.sandbox.stub(Auth, 'isLegalTagValid').resolves(true);
            this.sandbox.stub(Locker, 'createWriteLock').resolves(
            { idempotent: false, key: 'x', mutex: 'x', wid: 'x' });
            this.sandbox.stub(Locker, 'removeWriteLock');
            this.sandbox.stub(DESUtils, 'getDataPartitionID').resolves('tenant-a');
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Register);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.transaction.run.throws();
            this.transaction.rollback.resolves();

            const writeErrorStub = this.sandbox.stub(Response, 'writeError');
            writeErrorStub.resolves();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Register);
            Tx.checkTrue(writeErrorStub.calledOnce, done);
        });

    }

    private static validateAcls() {}

    private static get() {

        Tx.sectionInit('get');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetDAO, 'get').resolves([{ sbit: null, ltag: '123' }, 'key'] as any);
            this.sandbox.stub(Auth, 'isLegalTagValid').resolves(true);
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(true);
            this.sandbox.stub(DatasetDAO, 'update').resolves();
            this.sandbox.stub(DESUtils, 'getDataPartitionID');
            this.sandbox.stub(DESStorage, 'getRecord');
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Get);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.openmode = 'write';
            this.sandbox.stub(DatasetDAO, 'get').resolves([{ sbit: null }, 'key'] as any);
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(true);
            this.sandbox.stub(DatasetDAO, 'update').resolves();
            this.sandbox.stub(DESUtils, 'getDataPartitionID');
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Get);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetDAO, 'get').resolves([{ sbit: 'R', sbit_count: 1 }, 'key'] as any);
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(undefined);
            this.sandbox.stub(DatasetDAO, 'update').resolves();
            this.sandbox.stub(DESUtils, 'getDataPartitionID');
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Get);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetDAO, 'get').resolves([undefined, undefined]);
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Get);
            Tx.check404(expRes.statusCode, done);
        });

        Tx.test(async (done: any) => {
            this.journal.runQuery.resolves([[], {}] as never);
            await DatasetDAO.get(this.journal, this.dataset);
            done();
        });

    }

    private static list() {

        Tx.sectionInit('list');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            Config.USER_ASSOCIATION_SVC_PROVIDER = 'ccm-internal';
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(undefined);
            this.sandbox.stub(DatasetDAO, 'list').resolves({ datasets: [{} as DatasetModel], nextPageCursor: null });
            this.sandbox.stub(DESUtils, 'getDataPartitionID').returns('datapartition');
            this.sandbox.stub(Auth, 'isLegalTagValid').resolves(true);
            this.sandbox.stub(DESUserAssociation.prototype, 'convertPrincipalIdentifierToUserInfo').resolves();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.List);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.limit = '10';
            Config.USER_ASSOCIATION_SVC_PROVIDER = 'ccm-internal';
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(undefined);
            this.sandbox.stub(DatasetDAO, 'list').resolves({ datasets: [this.dataset as DatasetModel], nextPageCursor: 'cursor' });
            this.sandbox.stub(DESUtils, 'getDataPartitionID').returns('datapartition');
            this.sandbox.stub(Auth, 'isLegalTagValid').resolves(true);
            this.sandbox.stub(DESUserAssociation.prototype, 'convertPrincipalIdentifierToUserInfo').resolves();
            const responseStub = this.sandbox.stub(Response, 'writeOK');
            responseStub.returns();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.List);
            const data = responseStub.getCall(0).args[1];
            Tx.checkTrue(data.datasets[0] === this.dataset && data.nextPageCursor === 'cursor', done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.limit = '10';
            Config.USER_ASSOCIATION_SVC_PROVIDER = 'ccm-internal';
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(undefined);
            this.sandbox.stub(DatasetDAO, 'list').resolves({ datasets: [this.dataset as DatasetModel], nextPageCursor: '' });
            this.sandbox.stub(DESUtils, 'getDataPartitionID').returns('datapartition');
            this.sandbox.stub(Auth, 'isLegalTagValid').resolves(true);
            this.sandbox.stub(DESUserAssociation.prototype, 'convertPrincipalIdentifierToUserInfo').resolves();
            const responseStub = this.sandbox.stub(Response, 'writeOK');
            responseStub.returns();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.List);
            const data = responseStub.getCall(0).args[1];
            Tx.checkTrue(data.datasets[0] === this.dataset && data.nextPageCursor === '', done);
        });

    }

    private static delete() {

        Tx.sectionInit('delete');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            const dataset = {
                gcsurl: 'gcs/path1',
                name: 'name',
                path: 'path',
                subproject: 'subproject-a',
                tenant: 'tenant-a',
            } as IDatasetModel;

            this.sandbox.stub(DatasetDAO, 'get').resolves([dataset, undefined]);

            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            this.sandbox.stub(DatasetDAO, 'delete').resolves();
            this.sandbox.stub(Locker, 'acquireMutex').resolves();
            this.sandbox.stub(Locker, 'releaseMutex').resolves();
            this.sandbox.stub(Locker, 'unlock').resolves();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Delete);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            const dataset = {
                gcsurl: 'gcs/path1',
                name: 'name',
                path: 'path',
                subproject: 'subproject-a',
                tenant: 'tenant-a',
            } as IDatasetModel;
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(undefined);
            this.sandbox.stub(DatasetDAO, 'get').resolves(undefined);
            const writeErrorStub = this.sandbox.stub(Response, 'writeError');
            writeErrorStub.returns();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Delete);
            Tx.checkTrue(writeErrorStub.calledOnce === true, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            const dataset = {
                name: 'name',
                path: 'path',
                subproject: 'subproject-a',
                tenant: 'tenant-a',
            } as IDatasetModel;
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            this.sandbox.stub(DatasetDAO, 'get').resolves([dataset, undefined]);
            const writeErrorStub = this.sandbox.stub(Response, 'writeError');
            writeErrorStub.returns();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Delete);
            Tx.checkTrue(writeErrorStub.calledOnce === true, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            const dataset = {
                gcsurl: 'gcs/path1',
                name: 'name',
                path: 'path',
                seismicmeta_guid: 'seismicmeta_guid',
                subproject: 'subproject-a',
                tenant: 'tenant-a',
            } as IDatasetModel;
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            this.sandbox.stub(DatasetDAO, 'delete').resolves();
            this.sandbox.stub(DatasetDAO, 'get').resolves([dataset, undefined]);
            this.sandbox.stub(DESStorage, 'deleteRecord').resolves();
            this.sandbox.stub(Locker, 'acquireMutex').resolves();
            this.sandbox.stub(Locker, 'releaseMutex').resolves();
            this.sandbox.stub(Locker, 'unlock').resolves();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Delete);
            Tx.check200(expRes.statusCode, done);
        });

    }

    private static patch() {

        Tx.sectionInit('patch');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.body.metadata = { 'k1': 'v1', 'k2': 'v2', 'k3': { 'k4': 'v4' } };
            expReq.body.filemetadata = { 'type': 'GENERIC', 'size': 1021 };
            expReq.body.gtags = ['tagA', 'tagB'];
            expReq.body.seismicmeta = {
                'kind': 'slb:seistore:seismic2d:1.0.0',
                'legal': {
                    'legaltags': [
                        'ltag'
                    ],
                    'otherRelevantDataCountries': [
                        'US'
                    ]
                },
                'data': {
                    'geometry': {
                        'coordinates': [
                            [
                                -93.61,
                                9.32
                            ],
                            [
                                -93.78,
                                29.44
                            ]
                        ],
                        'type': 'Polygon'
                    }
                }
            };

            this.sandbox.stub(Locker, 'unlock').resolves();
            this.sandbox.stub(DatasetDAO, 'get').resolves([this.dataset, undefined]);
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            this.sandbox.stub(DatasetDAO, 'update').resolves();
            this.sandbox.stub(DESUtils, 'getDataPartitionID');
            this.sandbox.stub(DESStorage, 'insertRecord').resolves();
            this.sandbox.stub(Locker, 'acquireMutex').resolves();
            this.sandbox.stub(Locker, 'releaseMutex').resolves();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Patch);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.body.metadata = { 'k1': 'v1', 'k2': 'v2', 'k3': { 'k4': 'v4' } };
            expReq.body.filemetadata = { 'type': 'GENERIC', 'size': 1021 };
            expReq.body.gtags = ['tagA', 'tagB'];
            expReq.body.seismicmeta = {
                'kind': 'slb:seistore:seismic2d:1.0.0',
                'legal': {
                    'legaltags': [
                        'ltag'
                    ],
                    'otherRelevantDataCountries': [
                        'US'
                    ]
                },
                'data': {
                    'geometry': {
                        'coordinates': [
                            [
                                -93.61,
                                9.32
                            ],
                            [
                                -93.78,
                                29.44
                            ]
                        ],
                        'type': 'Polygon'
                    }
                }
            };
            this.sandbox.stub(DatasetDAO, 'get').resolves([{ sbit: 'W', sbit_count: 0 }, 'key'] as any);
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            this.sandbox.stub(DatasetDAO, 'update').resolves();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Patch);
            Tx.check404(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.body.metadata = { 'k1': 'v1', 'k2': 'v2', 'k3': { 'k4': 'v4' } };
            expReq.body.filemetadata = { 'type': 'GENERIC', 'size': 1021 };
            expReq.body.gtags = ['tagA', 'tagB'];
            expReq.body.seismicmeta = {
                'kind': 'slb:seistore:seismic2d:1.0.0',
                'legal': {
                    'legaltags': [
                        'ltag'
                    ],
                    'otherRelevantDataCountries': [
                        'US'
                    ]
                },
                'data': {
                    'geometry': {
                        'coordinates': [
                            [
                                -93.61,
                                9.32
                            ],
                            [
                                -93.78,
                                29.44
                            ]
                        ],
                        'type': 'Polygon'
                    }
                }
            };
            this.sandbox.stub(DatasetDAO, 'get').resolves([undefined, undefined] as any);
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            this.sandbox.stub(DatasetDAO, 'update').resolves();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Patch);
            Tx.check404(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetDAO, 'get').resolves([{ sbit: 'R', sbit_count: 1 }, 'key'] as any);
            this.sandbox.stub(Auth, 'isReadAuthorized').throws();
            this.sandbox.stub(DatasetDAO, 'update').resolves();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Patch);
            Tx.check400(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {

            expReq.body.metadata = { 'k1': 'v1', 'k2': 'v2', 'k3': { 'k4': 'v4' } };
            const metadata = { 'k1': 'v1', 'k2': 'v2', 'k3': { 'k4': 'v4' } };
            const filemetadata = { 'type': 'GENERIC', 'size': 1021 };
            const gtags = ['tagA', 'tagB'];

            const inputSeismicmeta = {
                'kind': 'slb:seistore:seismic2d:1.0.0',
                'legal': {
                    'legaltags': [
                        'ltag'
                    ],
                    'otherRelevantDataCountries': [
                        'US'
                    ]
                },
                'data': {
                    'geometry': {
                        'coordinates': [
                            [
                                -93.61,
                                9.32
                            ],
                            [
                                -93.78,
                                29.44
                            ]
                        ],
                        'type': 'Polygon'
                    }
                }
            };

            // datastore has no seismicmeta for the dataset
            const datasetOUT = this.dataset;

            this.dataset.gtags = gtags;
            this.dataset.filemetadata = filemetadata;
            this.dataset.metadata = metadata;
            this.dataset.name = 'dataset-01';

            this.sandbox.stub(DatasetParser, 'patch').returns(
             [this.dataset, 'new-dataset-01', 'WLockRes']);
            this.sandbox.stub(Locker, 'unlock').resolves(undefined);
            this.sandbox.stub(DatasetDAO, 'get').resolves([datasetOUT, undefined]);
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            this.sandbox.stub(DatasetDAO, 'update').resolves();
            this.sandbox.stub(DESUtils, 'getDataPartitionID').returns('datapartition');
            this.sandbox.stub(Locker, 'acquireMutex').resolves();
            this.sandbox.stub(Locker, 'releaseMutex').resolves();
            this.sandbox.stub(DESStorage, 'insertRecord').resolves();

            await DatasetHandler.handler(expReq, expRes, DatasetOP.Patch);

            Tx.check409(expRes.statusCode, done);
        });

    }

    private static exist() {

        Tx.sectionInit('exist');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.body.datasets = ['spx01/dsx01', '/'];
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(undefined);
            this.sandbox.stub(DatasetDAO, 'get').resolves(undefined);
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Exists);
            done();
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.body.datasets = [];
            try {
                DatasetParser.exists(expReq);
            } catch (e) { Tx.check400(e.error.code, done); }
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.body.datasets = [''];
            try {
                DatasetParser.exists(expReq);
            } catch (e) { Tx.check400(e.error.code, done); }
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.body.datasets = ['spx01/dsx01', '/'];
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(undefined);
            this.sandbox.stub(DatasetDAO, 'get').resolves([this.dataset, undefined]);
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Exists);
            Tx.check200(expRes.statusCode, done);
        });

    }

    private static sizes() {

        Tx.sectionInit('sizes');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.body.datasets = ['spx01/dsx01', '/'];
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(true);
            this.sandbox.stub(DatasetDAO, 'get').resolves(undefined);
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Sizes);
            done();
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.body.datasets = ['spx01/dsx01', '/'];
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(true);
            this.sandbox.stub(DatasetParser, 'sizes').returns([this.dataset]);
            this.dataset.filemetadata = { size: 100 };
            this.sandbox.stub(DatasetDAO, 'get').resolves([this.dataset, undefined]);
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Sizes);
            Tx.checkTrue(expRes.statusCode === 200, done);
        });

    }

    private static size() {

        Tx.sectionInit('size');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            const dataset = {
                gcsurl: 'gcs/path1',
                name: 'name',
                path: 'path',
                subproject: 'subproject-a',
                tenant: 'tenant-a',
            } as IDatasetModel;

            const storage: IStorage = {
                async deleteFiles() {
                    await new Promise(resolve => setTimeout(resolve, 1));
                },
                async deleteBucket() {
                    await new Promise(resolve => setTimeout(resolve, 1));
                },
                async createBucket() { return; },
                async bucketExists() { return false; },
                async deleteObjects() { return; },
                async saveObject() { return; },
                async copy() { return; },
                async randomBucketName() { return ''; },
                getStorageTiers() { return ['tier-a', 'tier-b', 'tier-c']; },
                async getObjectSize() { return 1; }
            };

            this.sandbox.stub(DatasetParser, 'size').returns(dataset);
            this.sandbox.stub(DatasetDAO, 'get').resolves([dataset, undefined]);
            this.sandbox.stub(DatasetDAO, 'update').resolves();
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            this.sandbox.stub(Auth, 'isLegalTagValid').resolves(true);
            this.sandbox.stub(Locker, 'createWriteLock').resolves(
                { idempotent: false, key: 'x', mutex: 'x', wid: 'x' });
            this.sandbox.stub(Locker, 'removeWriteLock').resolves();
            this.sandbox.stub(StorageFactory, 'build').returns(storage);
            this.sandbox.stub(DESUtils, 'getDataPartitionID');

            await DatasetHandler.handler(expReq, expRes, DatasetOP.ComputeSize);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetDAO, 'get').resolves([undefined, undefined]);
            await DatasetHandler.handler(expReq, expRes, DatasetOP.ComputeSize);
            Tx.check404(expRes.statusCode, done);
        });

    }

    private static listContent() {

        Tx.sectionInit('contents');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            const expectedValue = ({ datasets: ['dataset01'], directories: ['a', 'd'] });
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(true);
            this.sandbox.stub(DatasetDAO, 'listContent').resolves(expectedValue);
            await DatasetHandler.handler(expReq, expRes, DatasetOP.ListContent);
            Tx.check200(expRes.statusCode, done);
        });

    }

    private static permissions() {

        Tx.sectionInit('permissions');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetDAO, 'get').resolves(undefined);
            const responseErrorStub = this.sandbox.stub(Response, 'writeError');
            responseErrorStub.resolves();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Permission);
            Tx.checkTrue(responseErrorStub.calledOnce === true, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            const tenant = {
                name: 'tenant-a',
                gcpid: 'gcp-id'
            } as TenantModel;
            this.sandbox.stub(DatasetDAO, 'get').resolves([this.dataset, undefined]);
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(true);
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Permission);
            Tx.checkTrue(expRes.statusCode === 200, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            const tenant = {
                name: 'tenant-a',
                gcpid: 'gcp-id'
            } as TenantModel;
            this.sandbox.stub(DatasetDAO, 'get').resolves([undefined, undefined] as any);
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(true);
            await DatasetHandler.handler(expReq, expRes, DatasetOP.Permission);
            Tx.check404(expRes.statusCode, done);
        });

    }

    private static others() {

        Tx.sectionInit('others');

        Tx.test(async (done: any) => {
            this.journal.runQuery.resolves([[{}], {}] as never);
            this.sandbox.stub(DatasetDAO, 'fixOldModel').resolves();
            await DatasetDAO.list(this.journal, this.dataset, null);
            done();
        });

    }

    private static putTags() {
        Tx.sectionInit('put tags');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.gtag = ['tagA', 'tagB'];
            this.sandbox.stub(DatasetDAO, 'get').resolves([{ name: 'dataset-a' } as IDatasetModel, undefined]);
            this.sandbox.stub(DatasetDAO, 'update').resolves();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.PutTags);
            done();
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetDAO, 'get').resolves(
                [{ name: 'dataset-a', gtags: ['tag01', 'tag02'] } as IDatasetModel, undefined]);
            this.sandbox.stub(Locker, 'acquireMutex').resolves();
            this.sandbox.stub(Locker, 'releaseMutex').resolves();
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            const updateStub = this.sandbox.stub(DatasetDAO, 'update');
            updateStub.resolves();

            await DatasetHandler.handler(expReq, expRes, DatasetOP.PutTags);

            Tx.checkTrue(JSON.stringify(
                updateStub.getCall(0).args[1].gtags) === JSON.stringify(['tag01', 'tag02', undefined]), done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetDAO, 'get').resolves(
                [{ name: 'dataset-a', gtags: ['tag01', 'tag02'] } as IDatasetModel, undefined]);
            this.sandbox.stub(Locker, 'acquireMutex').resolves();
            this.sandbox.stub(Locker, 'releaseMutex').resolves();
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves();
            const updateStub = this.sandbox.stub(DatasetDAO, 'update');
            updateStub.resolves();

            await DatasetHandler.handler(expReq, expRes, DatasetOP.PutTags);

            Tx.checkTrue(JSON.stringify(
                updateStub.getCall(0).args[1].gtags) === JSON.stringify(['tag01', 'tag02', undefined]), done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetDAO, 'get').resolves([undefined, undefined]);
            this.sandbox.stub(Locker, 'acquireMutex').resolves();
            this.sandbox.stub(Locker, 'releaseMutex').resolves();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.PutTags);
            Tx.check404(expRes.statusCode, done);
        });

    }

    private static lock() {

        Tx.sectionInit('lock');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetParser, 'lock').returns(
                { dataset: this.dataset, open4write: true, wid: undefined });
            this.sandbox.stub(DatasetDAO, 'get').resolves([this.dataset, undefined]);
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves(true);
            this.sandbox.stub(Locker, 'acquireWriteLock').resolves({ cnt: 1, id: 'WCacheLockValue' });
            this.sandbox.stub(DESUtils, 'getDataPartitionID');

            await DatasetHandler.handler(expReq, expRes, DatasetOP.Lock);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetParser, 'lock').returns(
                { dataset: this.dataset, open4write: true, wid: undefined });
            this.sandbox.stub(DatasetDAO, 'get').resolves([undefined, undefined]);

            await DatasetHandler.handler(expReq, expRes, DatasetOP.Lock);
            Tx.check404(expRes.statusCode, done);
        });


        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetParser, 'lock').returns(
                { dataset: this.dataset, open4write: false, wid: undefined });
            this.sandbox.stub(DatasetDAO, 'get').resolves([this.dataset, undefined]);
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(true);
            this.sandbox.stub(Locker, 'acquireReadLock').resolves({ cnt: 1, id: 'RCacheLockValue' });
            this.sandbox.stub(DESUtils, 'getDataPartitionID');

            await DatasetHandler.handler(expReq, expRes, DatasetOP.Lock);
            Tx.check200(expRes.statusCode, done);
        });


        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.dataset.ltag = 'ltag';
            this.sandbox.stub(DatasetParser, 'lock').returns(
                { dataset: this.dataset, open4write: false, wid: undefined });
            this.sandbox.stub(DatasetDAO, 'get').resolves([this.dataset, undefined]);
            this.sandbox.stub(Auth, 'isReadAuthorized').resolves(true);
            this.sandbox.stub(Auth, 'isLegalTagValid').resolves(true);
            this.sandbox.stub(Locker, 'acquireReadLock').resolves({ cnt: 1, id: 'RCacheLockValue' });
            this.sandbox.stub(DESUtils, 'getDataPartitionID');

            await DatasetHandler.handler(expReq, expRes, DatasetOP.Lock);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.openmode = 'write';
            expReq.query.wid = 'sbit';
            expReq.params.datasetid = 'dataset-01';
            expReq.params.tenantid = 'tenant-01';
            expReq.params.subprojectid = 'subproject-01';
            expReq.query.path = 'a%2Fb%2Fc';
            const result = DatasetParser.lock(expReq);

            Tx.checkTrue((result.dataset.name === 'dataset-01' &&
                result.dataset.path === '/a/b/c/' &&
                result.dataset.subproject === 'subproject-01' &&
                result.dataset.tenant === 'tenant-01' &&
                result.open4write === true &&
                result.wid === 'sbit'), done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.openmode = 'wrong_mode';
            try {
                DatasetParser.lock(expReq);
            } catch (e) {
                Tx.check400(e.error.code, done);
            }
        });

    }

    private static unlock() {

        Tx.sectionInit('unlock');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetDAO, 'get').resolves([this.dataset, undefined]);
            this.sandbox.stub(Auth, 'isWriteAuthorized').resolves();
            this.sandbox.stub(Locker, 'unlock').resolves();
            await DatasetHandler.handler(expReq, expRes, DatasetOP.UnLock);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(DatasetDAO, 'get').resolves([undefined, undefined]);
            await DatasetHandler.handler(expReq, expRes, DatasetOP.UnLock);
            Tx.check404(expRes.statusCode, done);
        });

    }

}
