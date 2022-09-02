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

import axios from 'axios';
import sinon from 'sinon';
import { Config } from '../../../src/cloud';
import { google } from '../../../src/cloud/providers';
import { ConfigGoogle } from '../../../src/cloud/providers/google';
import { DESEntitlement } from '../../../src/dataecosystem';
import { Error } from '../../../src/shared/error';
import { Tx } from '../utils';


export class TestDESEntitlement {

   public static run() {

      describe(Tx.testInit('dataecosystem entitlements'), () => {

         ConfigGoogle.ENTITLEMENT_BASE_URL_PATH = '/entitlements'
         ConfigGoogle.DATA_PARTITION_REST_HEADER_KEY = 'data-partition-id'

         beforeEach(() => {
            this.sandbox = sinon.createSandbox();
            this.sandbox.stub(google.Credentials.prototype, 'getServiceCredentials').resolves('token');

         });
         afterEach(() => { this.sandbox.restore(); });

         this.getUsersGroups();
         // this.addUserToGroup();
         this.removeUserFromGroup();
         this.createGroup();
         this.getGroupMembers();

      });

   }

   private static sandbox: sinon.SinonSandbox;

   private static getUsersGroups() {

      Tx.sectionInit('get users groups');

      Tx.test(async (done: any) => {

         const requestStub = this.sandbox.stub(axios, 'get');
         requestStub.resolves({ status: 200, data: { groups: ['group1,', 'group2'] } });

         await DESEntitlement.getUserGroups('usertoken', 'tenant-one','appkey');

         const options = {
            headers: {
               'Accept': 'application/json',
               'AppKey': 'appkey',
               'Authorization': 'Bearer usertoken',
               'Content-Type': 'application/json',
               'data-partition-id': 'tenant-one',
            }
         };
         const url = Config.DES_SERVICE_HOST_ENTITLEMENT + '/entitlements' + '/groups';
         Tx.checkTrue(requestStub.calledWith(url, options), done);
      });

      Tx.test(async (done: any) => {
         const requestStub = this.sandbox.stub(axios, 'get');
         requestStub.throws(Error.make(500, 'Error', 'mprefix'));
         try {
            await DESEntitlement.getUserGroups('usertoken', 'tenant-one', 'appkey');
         } catch (e) {
            Tx.check500(500, done);
         }

      });
   }

   private static addUserToGroup() {

      Tx.sectionInit('add user to group');

      Tx.test(async (done: any) => {
         const requestStub = this.sandbox.stub(axios, 'post');
         requestStub.resolves();
         await DESEntitlement.addUserToGroup('usertoken', 'group-a', 'tenant-a', 'user@email', 'role-a','appkey');

         const options = {
            headers: {
               'Accept': 'application/json',
               'AppKey': 'appkey',
               'Authorization': 'Bearer usertoken',
               'Content-Type': 'application/json',
               'data-partition-id': 'tenant-a',
            },
            json: {
               email: 'user@email',
               role: 'role-a',
            }
         };
         const url = Config.DES_SERVICE_HOST_ENTITLEMENT + '/entitlements' + '/groups' + '/group-a' + '/members';

         Tx.checkTrue(requestStub.calledWith(url, options), done);

      });
 
      Tx.test(async (done: any) => {
         this.sandbox.stub(axios, 'post').throws();
         try {
            await DESEntitlement.addUserToGroup('usertoken', 'group-a', 'tenant-a', 'user@email', 'role-a', 'appkey');
         } catch (e) {
            Tx.check500(500, done);
         }
      });
   }

   private static removeUserFromGroup() {
      Tx.sectionInit('remove user from group');

      Tx.test(async (done: any) => {
         const requestStub = this.sandbox.stub(axios, 'delete');
         requestStub.resolves();

         await DESEntitlement.removeUserFromGroup('usertoken', 'group-a', 'tenant-a', 'user@email', 'appkey');

         const options = {
            headers: {
               'Accept': 'application/json',
               'AppKey': 'appkey',
               'Authorization': 'Bearer usertoken',
               'Content-Type': 'application/json',
               'data-partition-id': 'tenant-a',
            }
         };
         const url = Config.DES_SERVICE_HOST_ENTITLEMENT + '/entitlements/groups/' + 'group-a' + '/members/' + 'user@email';

         Tx.checkTrue(requestStub.calledWith(url, options), done);
      });

      Tx.test(async (done: any) => {
         this.sandbox.stub(axios, 'delete').throws();
         try {
            await DESEntitlement.removeUserFromGroup('usertoken', 'group-a', 'tenant-a', 'user@email', 'appkey');
         } catch (e) {
            Tx.check500(500, done);
         }
      });
   }

   private static createGroup() {
      Tx.sectionInit('create group');

      Tx.test(async (done: any) => {
         const requestStub = this.sandbox.stub(axios, 'post');
         requestStub.resolves();

         await DESEntitlement.createGroup('usertoken', 'group-a', 'group desc', 'tenant-a','appkey');

         const options = {
            headers: {
               'Accept': 'application/json',
               'AppKey':'appkey',
               'Authorization': 'Bearer usertoken',
               'Content-Type': 'application/json',
               'data-partition-id': 'tenant-a',
            }
         };
         const data = {
            description: 'group desc',
            name: 'group-a',
         }
         const url = Config.DES_SERVICE_HOST_ENTITLEMENT + '/entitlements/groups';

         Tx.checkTrue(requestStub.calledWith(url, data, options), done);

      });

      Tx.test(async (done: any) => {
         const requestStub = this.sandbox.stub(axios, 'post');
         requestStub.throws();

         try {
            await DESEntitlement.createGroup('usertoken', 'group-a', 'group-desc', 'tenant-a','appkey');
         } catch (e) {
            Tx.check500(500, done);
         }

      });
   }

   private static getGroupMembers() {
      Tx.sectionInit('get group members');

      Tx.test(async (done: any) => {
         const requestStub = this.sandbox.stub(axios, 'get');
         requestStub.resolves({ status: 200, data: 
            {
               cursor: 'cursor',
               members: [{
                  email: 'member1@email',
                  role: 'role1',
               },
               {
                  email: 'member2@email',
                  role: 'role2',
               },

               ],
            }}
         );

         const results = await DESEntitlement.listUsersInGroup('userToken', 'group-a', 'tenant-a', undefined);
         Tx.checkTrue(results.members.length === 2 && results.nextCursor === 'cursor', done);

      });

      Tx.test(async (done: any) => {
         const requestStub = this.sandbox.stub(axios, 'get');
         requestStub.throws();
         try {
            await DESEntitlement.listUsersInGroup('userToken', 'group-a', 'tenant-a', undefined);
         } catch (e) {
            Tx.check500(500, done);
         }
      });
   }
}
