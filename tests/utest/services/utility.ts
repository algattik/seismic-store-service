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

import { Datastore } from '@google-cloud/datastore';
import { Request as expRequest, Response as expResponse } from 'express';
import sinon from 'sinon';
import { Auth } from '../../../src/auth';
import { Config, google, JournalFactoryTenantClient } from '../../../src/cloud';
import { IDESEntitlementGroupModel } from '../../../src/cloud/dataecosystem';
import { DESEntitlement, DESUtils } from '../../../src/dataecosystem';
import { DatasetDAO } from '../../../src/services/dataset';
import { Locker } from '../../../src/services/dataset/locker';
import { SubProjectDAO } from '../../../src/services/subproject';
import { TenantDAO, TenantGroups, TenantModel } from '../../../src/services/tenant';
import { UtilityHandler } from '../../../src/services/utility/handler';
import { UtilityOP } from '../../../src/services/utility/optype';
import { UtilityParser } from '../../../src/services/utility/parser';
import { Response, Utils } from '../../../src/shared';
import { Tx } from '../utils';


export class TestUtilitySVC {

    public static run() {

        TestUtilitySVC.testDb = new Datastore({ projectId: 'GPRJ' });

        describe(Tx.testInit('utility'), () => {

            beforeEach(() => {
                this.sandbox = sinon.createSandbox();
                this.transaction = this.sandbox.createStubInstance(google.DatastoreTransactionDAO);
                this.transaction.createQuery.callsFake(
                    (namespace, kind) => TestUtilitySVC.testDb.createQuery(namespace, kind));

                this.journal = this.sandbox.createStubInstance(google.DatastoreDAO);
                this.journal.createKey.callsFake((specs) => TestUtilitySVC.testDb.key(specs));
                this.journal.createQuery.callsFake(
                    (namespace, kind) => TestUtilitySVC.testDb.createQuery(namespace, kind));
                this.journal.getTransaction.returns(this.transaction);
                this.journal.KEY = Datastore.KEY;
                this.sandbox.stub(Response, 'writeMetric').returns();
                this.sandbox.stub(JournalFactoryTenantClient, 'get').returns(this.journal);
                Config.CLOUDPROVIDER = 'google';
            });
            afterEach(() => { this.sandbox.restore(); });

            this.gcstoken();
            this.list();
            // this.cp();
            this.others();

        });

    }

    private static sandbox: sinon.SinonSandbox;
    private static testDb: Datastore;
    private static journal: any;
    private static transaction: any;

    private static gcstoken() {

        Tx.sectionInit('gcstoken');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.sdpath = 'sd://tnx/spx';
            this.sandbox.stub(TenantDAO, 'get').resolves({} as any);
            this.sandbox.stub(SubProjectDAO, 'get').resolves({acls:{viewers: [], admins: []}} as any);
            this.sandbox.stub(Auth, 'isReadAuthorized');
            this.sandbox.stub(DESUtils, 'getDataPartitionID');
            this.sandbox.stub(google.Credentials.prototype, 'getStorageCredentials');
            await UtilityHandler.handler(expReq, expRes, UtilityOP.GCSTOKEN);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.sdpath = 'sd://tnx/spx';
            expReq.query.readonly = 'false';
            this.sandbox.stub(TenantDAO, 'get').resolves({} as any);
            this.sandbox.stub(SubProjectDAO, 'get').resolves({acls:{viewers: [], admins: []}} as any);
            this.sandbox.stub(Auth, 'isWriteAuthorized');
            this.sandbox.stub(DESUtils, 'getDataPartitionID');
            this.sandbox.stub(google.Credentials.prototype, 'getStorageCredentials');
            await UtilityHandler.handler(expReq, expRes, UtilityOP.GCSTOKEN);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest) => {
            expReq.query.sdpath = 'sdx://tnx';
            try {
                UtilityParser.gcsToken(expReq);
            } catch (e) { Tx.check400(e.error.code, done); }
        });

        Tx.testExp(async (done: any, expReq: expRequest) => {
            expReq.query.sdpath = 'sd://tnx';
            try {
                UtilityParser.gcsToken(expReq);
            } catch (e) { Tx.check400(e.error.code, done); }
        });

        Tx.testExp(async (done: any, expReq: expRequest) => {
            expReq.query.sdpath = 'sd://tnx/spx';
            expReq.query.readonly = 'wrong';
            try {
                UtilityParser.gcsToken(expReq);
            } catch (e) { Tx.check400(e.error.code, done); }
        });

    }

    private static list() {

        Tx.sectionInit('list');

        // Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
        //     expReq.query.sdpath = 'sd://tnx/spx';
        //     this.sandbox.stub(TenantDAO, 'get').resolves({esd: 'esd'} as any);
        //     this.sandbox.stub(DESUtils, 'getDataPartitionID');
        //     this.sandbox.stub(DESEntitlement, 'getUserGroups');
        //     this.sandbox.stub(Auth, 'isReadAuthorized');
        //     this.sandbox.stub(DatasetDAO, 'listContent').resolves({ directories: ['abc'], datasets: [] } as never);
        //     this.sandbox.stub(SubProjectDAO, 'list').resolves([{ 'name': 'subprojec-a' },
        //     { 'name': 'subproject-b' }] as any);
        //     await UtilityHandler.handler(expReq, expRes, UtilityOP.LS);
        //     Tx.check200(expRes.statusCode, done);
        // });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.sdpath = 'sd://tnx';
            const prefix = TenantGroups.serviceGroupPrefix('tnx');
            this.sandbox.stub(TenantDAO, 'get').resolves({} as any);
            this.sandbox.stub(DESUtils, 'getDataPartitionID');
            this.sandbox.stub(DESEntitlement, 'getUserGroups').resolves([{ name: prefix + '.spx.admin' }] as never);
            this.sandbox.stub(SubProjectDAO, 'list').resolves([{ 'name': 'subprojec-a' },
            { 'name': 'subproject-b' }] as any);
            await UtilityHandler.handler(expReq, expRes, UtilityOP.LS);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.sdpath = 'sd://tnx';
            const prefix = TenantGroups.serviceGroupPrefix('tnx');
            this.sandbox.stub(TenantDAO, 'get').resolves({} as any);
            this.sandbox.stub(DESUtils, 'getDataPartitionID');
            this.sandbox.stub(DESEntitlement, 'getUserGroups').resolves([{ name: prefix + '.spx.editor' }] as never);
            this.sandbox.stub(SubProjectDAO, 'list').resolves([{ 'name': 'subprojec-a' },
            { 'name': 'subproject-b' }] as any);
            await UtilityHandler.handler(expReq, expRes, UtilityOP.LS);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.sdpath = 'sd://tnx';
            const prefix = TenantGroups.serviceGroupPrefix('tnx');
            this.sandbox.stub(TenantDAO, 'get').resolves({} as any);
            this.sandbox.stub(DESUtils, 'getDataPartitionID');
            this.sandbox.stub(DESEntitlement, 'getUserGroups').resolves([{ name: prefix + '.spx.viewer' }] as never);
            this.sandbox.stub(SubProjectDAO, 'list').resolves([{ 'name': 'subprojec-a' },
            { 'name': 'subproject-b' }] as any);
            await UtilityHandler.handler(expReq, expRes, UtilityOP.LS);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.sdpath = 'sd://tnx';
            const prefix = TenantGroups.serviceGroupPrefix('tnx');
            this.sandbox.stub(TenantDAO, 'get').resolves({} as any);
            this.sandbox.stub(DESUtils, 'getDataPartitionID');
            this.sandbox.stub(DESEntitlement, 'getUserGroups').resolves([{ name: '' }] as never);
            this.sandbox.stub(SubProjectDAO, 'list').resolves([{ 'name': 'subprojec-a' },
            { 'name': 'subproject-b' }] as any);
            await UtilityHandler.handler(expReq, expRes, UtilityOP.LS);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest) => {
            expReq.query.sdpath = 'sdx://tnx';
            try {
                await UtilityParser.ls(expReq);
            } catch (e) { Tx.check400(e.error.code, done); }
        });

        Tx.testExp(async (done: any, expReq: expRequest) => {
            expReq.query.sdpath = 'sd://';
            await UtilityParser.ls(expReq);
            done();
        });

        // for sd://, ls endpoint returns all tenants that have subprojects
        // here tenant-b does not have a subproject, so it would not be included in the result
        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.sdpath = 'sd://';
            this.sandbox.stub(TenantDAO, 'getAll').resolves([{
                name: 'tenant-a',
                default_acls: 'users.datalake.admin@dp.p4d.domain.com',
                esd: 'dp.p4d.domain.com',
            }, {
                name: 'tenant-b',
                default_acls: 'users.datalake.admin@dp.p4d.domain.com',
                esd: 'dp.p4d.domain.com',
            }, {
                name: 'tenant-c',
                default_acls: 'users.datalake.admin@dp02.p4d.domain.com',
                esd: 'dp02.p4d.domain.com',
            }] as TenantModel[]);


            const userGroupsStub = this.sandbox.stub(DESEntitlement, 'getUserGroups');
            userGroupsStub.onCall(0).resolves([{
                'name': `${Config.SERVICEGROUPS_PREFIX}.${Config.SERVICE_ENV}.tenant-a.subproj01.admin`,
                'email': `${Config.SERVICEGROUPS_PREFIX}.${Config.SERVICE_ENV}.tenant-a.subproj01.admin@dp.p4d.domain.com`
            }, {
                'name': `${Config.SERVICEGROUPS_PREFIX}.${Config.SERVICE_ENV}.tenant-a.admin`,
                'email': `${Config.SERVICEGROUPS_PREFIX}.${Config.SERVICE_ENV}.tenant-a.admin@dp.p4d.domain.com`
            }] as IDESEntitlementGroupModel[]);

            userGroupsStub.onCall(1).resolves([{
                'name': `${Config.SERVICEGROUPS_PREFIX}.${Config.SERVICE_ENV}.tenant-c.subproj2.admin`,
                'email': `${Config.SERVICEGROUPS_PREFIX}.${Config.SERVICE_ENV}.tenant-c.subproj2.admin@dp02.p4d.domain.com`
            }, {
                'name': `${Config.SERVICEGROUPS_PREFIX}.${Config.SERVICE_ENV}.tenant-c.admin`,
                'email': `${Config.SERVICEGROUPS_PREFIX}.${Config.SERVICE_ENV}.tenant-c.admin@dp02.p4d.domain.com`
            }] as IDESEntitlementGroupModel[]);

            const responseStub = this.sandbox.stub(Response, 'writeOK');
            responseStub.resolves();


            await UtilityHandler.handler(expReq, expRes, UtilityOP.LS);
            Tx.checkTrue(
                responseStub.args[0][1].includes('tenant-a') &&
                responseStub.args[0][1].includes('tenant-c'), done);
        });

    }

    private static cp() {

        Tx.sectionInit('cp');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.sdpath_from = 'sd://tnx/spx1/a1/dsx01';
            expReq.query.sdpath_to = 'sd://tnx/spx1/a2/dsx01';
            this.sandbox.stub(TenantDAO, 'get').resolves({} as any);
            this.sandbox.stub(Locker, 'getLock');
            this.sandbox.stub(Locker, 'createWriteLock');
            this.sandbox.stub(Locker, 'unlock');
            this.sandbox.stub(Auth, 'isWriteAuthorized');
            this.sandbox.stub(Auth, 'isReadAuthorized');
            this.sandbox.stub(SubProjectDAO, 'get').resolves({ gcs_bucket: 'b', ltag: 'l' } as any);
            this.sandbox.stub(DatasetDAO, 'get').onCall(0).resolves(
                [{ ltag: 'l', gcsurl: 'b/p' }] as any).onCall(1).resolves([] as any);
            this.sandbox.stub(Auth, 'isLegalTagValid');
            this.sandbox.stub(DatasetDAO, 'register');
            this.sandbox.stub(google.GCS.prototype, 'copy');
            this.sandbox.stub(google.GCS.prototype, 'saveObject');
            this.sandbox.stub(Locker, 'acquireMutex').resolves('mutex');
            this.sandbox.stub(Locker, 'releaseMutex').resolves();
            this.sandbox.stub(google.GoogleSeistore.prototype, 'getEmailFromTokenPayload').resolves('email')
            this.transaction.run.resolves();
            await UtilityHandler.handler(expReq, expRes, UtilityOP.CP);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.sdpath_from = 'sd://tnx/spx1/a1/dsx01';
            expReq.query.sdpath_to = 'sd://tnx/spx2/a2/dsx01';
            this.sandbox.stub(TenantDAO, 'get').resolves({} as any);
            this.sandbox.stub(Auth, 'isWriteAuthorized');
            this.sandbox.stub(Auth, 'isReadAuthorized');
            this.sandbox.stub(Locker, 'getLock');
            this.sandbox.stub(Locker, 'createWriteLock').resolves(
                {idempotent: undefined, wid: undefined, mutex: undefined, key: undefined});
            this.sandbox.stub(Locker, 'acquireMutex').resolves();
            this.sandbox.stub(Locker, 'releaseMutex').resolves();
            this.sandbox.stub(Locker, 'unlock').resolves();
            this.sandbox.stub(SubProjectDAO, 'get').resolves({ gcs_bucket: 'b', ltag: 'l' } as any);
            this.sandbox.stub(DatasetDAO, 'get').onCall(0).resolves(
                [{ gcsurl: 'b/p' }] as any).onCall(1).resolves([] as any);
            this.sandbox.stub(Auth, 'isLegalTagValid');
            this.sandbox.stub(DatasetDAO, 'register');
            this.sandbox.stub(google.GCS.prototype, 'copy');
            this.sandbox.stub(google.GCS.prototype, 'saveObject');
            this.transaction.run.resolves();
            this.sandbox.stub(google.GoogleSeistore.prototype, 'getEmailFromTokenPayload').resolves('email')
            await UtilityHandler.handler(expReq, expRes, UtilityOP.CP);
            Tx.check200(expRes.statusCode, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.sdpath_from = 'sd://tnx/spx1/a1/dsx01';
            expReq.query.sdpath_to = 'sd://tnx/spx1/a2/dsx01';
            this.sandbox.stub(TenantDAO, 'get').resolves({} as any);
            this.sandbox.stub(Auth, 'isWriteAuthorized');
            this.sandbox.stub(Auth, 'isReadAuthorized');
            this.sandbox.stub(SubProjectDAO, 'get').resolves({ gcs_bucket: 'b', ltag: 'l' } as any);
            this.sandbox.stub(DatasetDAO, 'get').onCall(0).resolves([] as any);
            this.sandbox.stub(Response, 'writeError');
            this.transaction.run.resolves();
            this.sandbox.stub(Locker, 'acquireMutex').resolves('mutex');
            this.sandbox.stub(Locker, 'releaseMutex').resolves();
            this.sandbox.stub(Locker, 'createWriteLock').resolves();
            this.sandbox.stub(Locker, 'unlock').resolves();
            await UtilityHandler.handler(expReq, expRes, UtilityOP.CP);
            done();
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.sdpath_from = 'sd://tnx/spx1/a1/dsx01';
            expReq.query.sdpath_to = 'sd://tnx/spx1/a2/dsx01';
            this.sandbox.stub(TenantDAO, 'get').resolves({} as any);
            this.sandbox.stub(Locker, 'getLock');
            this.sandbox.stub(Locker, 'createWriteLock').resolves();
            this.sandbox.stub(Locker, 'unlock').resolves();
            this.sandbox.stub(Auth, 'isWriteAuthorized');
            this.sandbox.stub(Auth, 'isReadAuthorized');
            this.sandbox.stub(SubProjectDAO, 'get').resolves({ gcs_bucket: 'b', ltag: 'l' } as any);
            this.sandbox.stub(DatasetDAO, 'get').onCall(0).resolves(
                [{ ltag: 'l', gcsurl: 'b/p' }] as any).onCall(1).resolves([{ ltag: 'l', gcsurl: 'b/p' }] as any);
            this.sandbox.stub(Auth, 'isLegalTagValid');
            this.sandbox.stub(Response, 'writeError');
            this.sandbox.stub(Locker, 'acquireMutex').resolves('mutex');
            this.sandbox.stub(Locker, 'releaseMutex').resolves();
            this.transaction.run.resolves();
            await UtilityHandler.handler(expReq, expRes, UtilityOP.CP);
            done();
        });

        Tx.testExp(async (done: any, expReq: expRequest) => {
            expReq.query.sdpath_from = 'sdx://tnx/spx1/a1/dsx01';
            expReq.query.sdpath_to = 'sd://tnx/spx2/a2/dsx01';
            try {
                UtilityParser.cp(expReq);
            } catch (e) { Tx.check400(e.error.code, done); }
        });

        Tx.testExp(async (done: any, expReq: expRequest) => {
            expReq.query.sdpath_from = 'sd://tnx/spx1/a1/dsx01';
            expReq.query.sdpath_to = 'sdx://tnx/spx2/a2/dsx01';
            try {
                UtilityParser.cp(expReq);
            } catch (e) { Tx.check400(e.error.code, done); }
        });

        Tx.testExp(async (done: any, expReq: expRequest) => {
            expReq.query.sdpath_from = 'sd://tnx';
            expReq.query.sdpath_to = 'sd://tnx/spx2/a2/dsx01';
            try {
                UtilityParser.cp(expReq);
            } catch (e) { Tx.check400(e.error.code, done); }
        });

        Tx.testExp(async (done: any, expReq: expRequest) => {
            expReq.query.sdpath_from = 'sd://tnx/spx1/a1/dsx01';
            expReq.query.sdpath_to = 'sd://tnx';
            try {
                UtilityParser.cp(expReq);
            } catch (e) { Tx.check400(e.error.code, done); }
        });

        Tx.testExp(async (done: any, expReq: expRequest) => {
            expReq.query.sdpath_from = 'sd://tnx/spx1/a1/dsx01';
            expReq.query.sdpath_to = 'sd://tnx2/spx2/a2/dsx01';
            try {
                UtilityParser.cp(expReq);
            } catch (e) { Tx.check400(e.error.code, done); }
        });

    }

    private static others() {

        Tx.sectionInit('others');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            this.sandbox.stub(Response, 'writeError');
            await UtilityHandler.handler(expReq, expRes, undefined);
            done();
        });

    }

}
