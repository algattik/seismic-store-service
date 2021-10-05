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

import sinon from 'sinon';
import { AuthGroups, UserRoles } from '../../../src/auth';
import { Config } from '../../../src/cloud';
import { IDESEntitlementGroupModel, IDESEntitlementMemberModel } from '../../../src/cloud/dataecosystem';
import { DESEntitlement, DESUtils } from '../../../src/dataecosystem';
import { Tx } from '../utils';


export class TestAuthGroups {

   public static run() {

      describe(Tx.testInit('Groups authorization'), () => {

         beforeEach(() => {
            this.spy = sinon.createSandbox();
            Config.CLOUDPROVIDER = 'google';
         });
         afterEach(() => { this.spy.restore(); });

         this.datalakeUserAdminGroupName();
         this.createGroup();
         this.addUserToGroup();
         this.removeUserFromGroup();
         this.listUsersInGroup();
         this.getUserGroups();
         this.hasOneInGroups();
         this.isMemberOfaGroup();
      });

   }

   private static spy: sinon.SinonSandbox;

   private static datalakeUserAdminGroupName() {

      Tx.sectionInit('get datalake user admin group name');
      Tx.test((done: any) => {
         const result = AuthGroups.datalakeUserAdminGroupName();
         Tx.checkTrue(result === 'users.datalake.admins', done);

      });

   }

   private static createGroup() {

      Tx.sectionInit('create group');
      Tx.test(async (done: any) => {
         const stub = this.spy.stub(DESEntitlement, 'createGroup');
         stub.resolves();
         this.spy.stub(DESUtils, 'getDataPartitionID').returns('partition-a');
         await AuthGroups.createGroup(undefined, 'group-a', 'group-desc', 'esd', 'appkey');
         Tx.checkTrue(stub.calledWith(undefined, 'group-a', 'group-desc', 'partition-a'), done);
      });

   }

   private static isMemberOfaGroup() {

      Tx.sectionInit('Is member of a group ');
      Tx.test(async (done: any) => {
         this.spy.stub(DESUtils, 'getDataPartitionID').returns('data-partition-a');
         const members: IDESEntitlementMemberModel[] = [
            {
               email: 'member-email-one', role: 'OWNER',
            },
            {
               email: 'member-email-two', role: 'MEMBER',
            }];
         const nextCursor = 'nextCursor';
         this.spy.stub(DESEntitlement, 'listUsersInGroup').resolves({
            members, nextCursor,
         });

         const result = await AuthGroups.isMemberOfaGroup(undefined, 'member-email-two', 'group', 'esd', 'cursor');

         Tx.checkTrue(result === true, done);

      });
   }

   private static hasOneInGroups() {

      Tx.sectionInit('has one in groups');
      Tx.test(async (done: any) => {
         this.spy.stub(DESUtils, 'getDataPartitionID').returns('data-partition-a');
         const groups: IDESEntitlementGroupModel[] = [
            {
               description: 'group-a-description',
               email: 'email-a',
               name: 'group-a',
            },
            {
               description: 'group-b-description',
               email: 'email-b',
               name: 'group-b',
            },
         ];
         this.spy.stub(DESEntitlement, 'getUserGroups').resolves(groups);
         const result = await AuthGroups.isMemberOfAtLeastOneGroup('token', ['email-a'], 'esd', 'appkey');

         Tx.checkTrue(result === true, done);
      });

   }

   private static getUserGroups() {

      Tx.sectionInit('get user groups');
      Tx.test(async (done: any) => {
         this.spy.stub(DESUtils, 'getDataPartitionID').resolves('data-partition-a');
         const groups: IDESEntitlementGroupModel[] = [{
            description: 'group-a-desc',
            email: 'email-a',
            name: 'group-a',
         }];

         this.spy.stub(DESEntitlement, 'getUserGroups').resolves(groups);
         const result = await AuthGroups.getUserGroups('token', 'esd', 'appkey');

         Tx.checkTrue(result === groups, done);
      });
   }

   private static listUsersInGroup() {

      Tx.sectionInit('list users in group');
      Tx.test(async (done: any) => {
         const members: IDESEntitlementMemberModel[] = [
            {
               email: 'member-email-one', role: 'OWNER',
            },
            {
               email: 'member-email-two', role: 'MEMBER',
            }];
         const nextCursor: string = 'nextCursor';
         const listUsersInGroupStub = this.spy.stub(DESEntitlement, 'listUsersInGroup');
         listUsersInGroupStub.resolves({ members, nextCursor });

         this.spy.stub(DESUtils, 'getDataPartitionID').returns('data-partition-a');
         const result = await AuthGroups.listUsersInGroup(undefined, 'group-a', 'esd', 'appkey');

         Tx.checkTrue(result === members, done);
      });
   }

   private static addUserToGroup() {

      Tx.sectionInit('add user to group');
      Tx.test(async (done: any) => {
         const addUserToGroupStub = this.spy.stub(DESEntitlement, 'addUserToGroup');
         addUserToGroupStub.resolves();

         this.spy.stub(DESUtils, 'getDataPartitionID').returns('data-partition-a');

         await AuthGroups.addUserToGroup(undefined, 'group-a', 'useremail', 'esd', 'appkey', UserRoles.Member);

         const calledWithResult = addUserToGroupStub.calledWith(undefined, 'group-a', 'data-partition-a', 'useremail', UserRoles.Member, 'appkey');

         Tx.checkTrue(calledWithResult === true, done);
      });
   }

   private static removeUserFromGroup() {

      Tx.sectionInit('remove user from group');
      Tx.test(async (done: any) => {
         const removeUserFromGroupStub = this.spy.stub(DESEntitlement, 'removeUserFromGroup');
         removeUserFromGroupStub.resolves();

         this.spy.stub(DESUtils, 'getDataPartitionID').returns('data-partition-a');
         await AuthGroups.removeUserFromGroup(undefined, 'group-a', 'useremail', 'esd', 'appkey');

         const calldedWithResult = removeUserFromGroupStub.calledWith(undefined, 'group-a', 'data-partition-a', 'useremail', 'appkey');

         Tx.checkTrue(calldedWithResult === true, done);
      });
   }

}
