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
import { TenantDAO, TenantGroups, TenantModel } from '../../../src/services/tenant';
import { TenantHandler } from '../../../src/services/tenant/handler';
import { Auth, AuthGroups } from '../../../src/auth';
import { google, JournalFactoryServiceClient } from '../../../src/cloud';
import { Config } from '../../../src/cloud';
import { SubProjectDAO } from '../../../src/services/subproject';
import { TenantOP } from '../../../src/services/tenant/optype';
import { TenantParser } from '../../../src/services/tenant/parser';
import { Response } from '../../../src/shared';
import { Tx } from '../utils';

import sinon from 'sinon';

export class TestTenantSVC {

    public static run() {
        TestTenantSVC.testDb = new Datastore({ projectId: 'GPRJ' });

        describe(Tx.testInit('tenant'), () => {

            beforeEach(() => {
                this.sandbox = sinon.createSandbox();
                this.journal = this.sandbox.createStubInstance(google.DatastoreDAO);
                this.journal.createQuery.callsFake(
                    (namespace, kind) => TestTenantSVC.testDb.createQuery(namespace, kind));
                this.journal.createKey.callsFake((specs) => TestTenantSVC.testDb.key(specs));
                this.journal.KEY = Datastore.KEY;

                this.sandbox.stub(JournalFactoryServiceClient, 'get').returns(this.journal);
                this.sandbox.stub(Response, 'writeMetric').returns()
                this.tenant = {
                    name: 'tenant-a',
                    esd: 'esd',
                    gcpid: 'gcpid',
                    default_acls: 'users.datalake.admin@datapartition'
                };
            });
            afterEach(() => { this.sandbox.restore(); });

            this.get();
            this.getTenantSDPath();
            this.createTenant();
            this.getTenant();
            this.deleteTenant();
            this.parseParams();
            this.getAdminGroup();

        });

    }

    private static sandbox: sinon.SinonSandbox;
    private static journal: any;
    private static testDb: Datastore;
    private static tenant: TenantModel;

    private static get() {

        Tx.sectionInit('get');

        Tx.testExp(async (done: any) => {
            this.journal.get.resolves([{}] as never);
            await TenantDAO.get('tnx');
            done();
        });

        Tx.testExp(async (done: any) => {
            process.env.GCLOUD_PROJECT = 'ON';
            this.journal.get.resolves([{ name: 'name' }] as never);
            await TenantDAO.get('tnx');
            delete process.env.GCLOUD_PROJECT;
            done();
        });

        Tx.testExp(async (done: any) => {
            this.journal.get.resolves([] as never);
            try {
                await TenantDAO.get('tnx');
            } catch (e) { Tx.check404(e.error.code, done); }
        });

    }

    private static getTenantSDPath() {

        Tx.sectionInit('get tenant sdpath');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.datapartition = 'datapartition';
            this.sandbox.stub(TenantDAO, 'getAll').resolves([{name:'tenant01', default_acls:'x', esd:'datapartition.domain.com', gcpid:'any'}])
            this.sandbox.stub(Auth, 'isUserRegistered').resolves();
            Tx.checkTrue((await TenantHandler.getTenantSDPath(expReq)) === Config.SDPATHPREFIX + 'tenant01', done);
        });

    }

    private static createTenant() {

        Tx.sectionInit('create tenant');


        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.datapartition = 'datapartition';
            this.sandbox.stub(TenantParser, 'create').returns(this.tenant);
            this.sandbox.stub(Response, 'writeError').returns();
            this.sandbox.stub(TenantDAO, 'exist').resolves(false);
            this.sandbox.stub(TenantDAO, 'register').resolves();

            await TenantHandler.handler(expReq, expRes, TenantOP.CREATE);
            done();
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.datapartition = 'datapartition';
            this.tenant.default_acls = undefined;
            this.sandbox.stub(TenantParser, 'create').returns(this.tenant);
            const errorStub = this.sandbox.stub(Response, 'writeError');
            errorStub.returns();

            await TenantHandler.handler(expReq, expRes, TenantOP.CREATE);
            Tx.checkTrue(errorStub.calledOnce === true, done);
        });


        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.datapartition = 'datapartition';
            this.sandbox.stub(TenantParser, 'create').returns(this.tenant);
            this.sandbox.stub(TenantDAO, 'register').resolves();

            this.sandbox.stub(TenantDAO, 'exist').resolves(true);
            const errorStub = this.sandbox.stub(Response, 'writeError');
            errorStub.returns();

            await TenantHandler.handler(expReq, expRes, TenantOP.CREATE);
            Tx.checkTrue(errorStub.calledOnce === true, done);

        });

    }

    private static getTenant() {

        Tx.sectionInit('get tenant');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.datapartition = 'datapartition';
            this.sandbox.stub(TenantDAO, 'get').resolves(this.tenant);
            this.sandbox.stub(Auth, 'isUserAuthorized').resolves(true);

            await TenantHandler.handler(expReq, expRes, TenantOP.GET);
            Tx.checkTrue(expRes.statusCode === 200, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.datapartition = 'datapartition';
            this.sandbox.stub(TenantDAO, 'get').resolves(this.tenant);
            this.sandbox.stub(Auth, 'isUserAuthorized').resolves(false);

            await TenantHandler.handler(expReq, expRes, TenantOP.GET);
            Tx.checkTrue(expRes.statusCode === 200, done);
        });
    }

    private static deleteTenant() {

        Tx.sectionInit('delete tenant');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.datapartition = 'datapartition';
            this.sandbox.stub(TenantDAO, 'get').resolves(this.tenant);
            this.sandbox.stub(Auth, 'isUserAuthorized').resolves(true);
            this.sandbox.stub(TenantDAO, 'delete').resolves();
            this.sandbox.stub(SubProjectDAO, 'list').resolves([]);


            await TenantHandler.handler(expReq, expRes, TenantOP.DELETE);
            Tx.checkTrue(expRes.statusCode === 200, done);
        });



        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.datapartition = 'datapartition';
            this.sandbox.stub(TenantDAO, 'get').resolves(this.tenant);
            this.sandbox.stub(TenantDAO, 'delete').resolves();
            this.sandbox.stub(SubProjectDAO, 'list').resolves([{ name: 'subproject-a', tenant: 'tenant-a', admin: 'admin', storage_class: 'class', storage_location: 'location', ltag: 'ltag', gcs_bucket: 'bucket' }]);
            const errorStub = this.sandbox.stub(Response, 'writeError');
            errorStub.returns();

            await TenantHandler.handler(expReq, expRes, TenantOP.DELETE);
            Tx.checkTrue(errorStub.calledOnce === true, done);
        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.datapartition = 'datapartition';
            this.tenant.default_acls = undefined;
            this.sandbox.stub(TenantDAO, 'get').resolves(this.tenant);
            this.sandbox.stub(Auth, 'isUserAuthorized').resolves(true);
            this.sandbox.stub(TenantDAO, 'delete').resolves();
            this.sandbox.stub(SubProjectDAO, 'list').resolves([]);
            this.sandbox.stub(AuthGroups, 'clearGroup').resolves();


            await TenantHandler.handler(expReq, expRes, TenantOP.DELETE);
            Tx.checkTrue(expRes.statusCode === 200, done);
        });
    }

    private static parseParams() {

        Tx.sectionInit('tenant parser');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.datapartition = 'datapartition';
            expReq.params.tenantid = 'tenant-a';
            expReq.body.esd = 'esd';
            expReq.body.gcpid = 'gcpid';
            expReq.body.default_acls = 'userdatalakeadmin@group.com';
            await TenantParser.create(expReq);
            done();
        });
    }

    private static getAdminGroup() {

        Tx.sectionInit('get admin group');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.datapartition = 'datapartition';
            this.tenant.default_acls = 'authgroup@dp.com';

            const result = TenantGroups.adminGroup(this.tenant);
            Tx.checkTrue(result === 'authgroup@dp.com', done);

        });

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            expReq.query.datapartition = 'datapartition';
            this.tenant.default_acls = undefined;

            const result = TenantGroups.adminGroup(this.tenant);
            const expectedString = 'service.seistore.' + Config.SERVICE_ENV + '.tenant-a.admin@esd';
            Tx.checkTrue(result === expectedString, done);

        });
    }

}
