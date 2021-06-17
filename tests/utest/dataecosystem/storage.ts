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

import request from 'request-promise';
import sinon from 'sinon';
import { Config } from '../../../src/cloud';
import { google } from '../../../src/cloud/providers';
import { ConfigGoogle } from '../../../src/cloud/providers/google';
import { DESStorage, DESUtils } from '../../../src/dataecosystem';
import { RecordLatency } from '../../../src/metrics/metrics';
import { Tx } from '../utils';


export class TestStorage {
   public static run() {

      describe(Tx.testInit('dataecosystem storage service'), () => {

         ConfigGoogle.DATA_PARTITION_REST_HEADER_KEY = 'data-partition-id'

         beforeEach(() => {
            this.sandbox = sinon.createSandbox();
            this.sandbox.stub(RecordLatency.prototype, 'record').resolves();
            this.sandbox.stub(google.Credentials.prototype, 'getServiceCredentials').resolves('usertoken');
            this.sandbox.stub(DESUtils, 'getDataPartitionID').returns('tenant-a');

         });
         afterEach(() => { this.sandbox.restore(); });

         this.createPutRecord();
         this.deleteRecord();
      });

   }
   private static sandbox: sinon.SinonSandbox;

   private static createPutRecord() {

      Tx.sectionInit('create put record');

      Tx.test(async (done: any) => {
         this.sandbox.stub(request, 'put').resolves();
         await DESStorage.insertRecord('usertoken', JSON.stringify({ seismetadata: 'data' }), 'esd', 'appkey');
         done();
      });

      Tx.test(async (done: any) => {
         this.sandbox.stub(request, 'put').resolves();
         await DESStorage.insertRecord('usertoken', undefined, 'esd', 'appkey');
         done();
      });

      Tx.test(async (done: any) => {
         const requestStub = this.sandbox.stub(request, 'put');
         requestStub.resolves();
         await DESStorage.insertRecord('usertoken', JSON.stringify({ seismetadata: 'data' }), 'esd', 'appkey');

         const options = {
            headers: {
               'Accept': 'application/json',
               'AppKey': 'appkey',
               'Authorization': 'Bearer usertoken',
               'Content-Type': 'application/json',
               'data-partition-id': 'tenant-a',
            },
            json: JSON.stringify({ seismetadata: 'data' }),
            url: Config.DES_SERVICE_HOST_STORAGE + '/storage/v2/records',
         };
         Tx.checkTrue(requestStub.calledWith(options), done);
      });

      Tx.test(async (done: any) => {
         this.sandbox.stub(request, 'put').throws();
         try {
            await DESStorage.insertRecord('usertoken', JSON.stringify({ seismetadata: 'data' }), 'esd', 'appkey');
         } catch (e) {
            Tx.check500(500, done);
         }
      });

   }

   private static deleteRecord() {
      Tx.sectionInit('delete record');

      Tx.test(async (done: any) => {
         const requestStub = this.sandbox.stub(request, 'post');
         requestStub.resolves();
         await DESStorage.deleteRecord('usertoken', 'uid', 'esd', 'appkey');
         done();
      });

      Tx.test(async (done: any) => {
         this.sandbox.stub(request, 'post').resolves();
         await DESStorage.deleteRecord('usertoken', 'uid', 'esd', 'appkey');
         done();
      });

      Tx.test(async (done: any) => {
         this.sandbox.stub(request, 'post').throws();
         try {
            await DESStorage.deleteRecord('usertoken', 'uid', 'esd', 'appkey');
         } catch (e) {
            Tx.check500(500, done);
         }
      });

      Tx.test(async (done: any) => {
         const requestStub = this.sandbox.stub(request, 'post').resolves();
         requestStub.resolves();
         await DESStorage.deleteRecord('usertoken', 'uid', 'esd', 'appkey');

         const options = {
            headers: {
               'Accept': 'application/json',
               'AppKey': 'appkey',
               'Authorization': 'Bearer usertoken',
               'Content-Type': 'application/json',
               'data-partition-id': 'tenant-a',
            },
            url: Config.DES_SERVICE_HOST_STORAGE + '/storage/v2/records/uid' + ':delete',
         };

         Tx.checkTrue(requestStub.calledWith(options), done);

      });
   }
}
