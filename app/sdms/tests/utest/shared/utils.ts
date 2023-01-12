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

import { Utils } from '../../../src/shared';
import { Buffer } from 'buffer';
import * as crypto from 'crypto';
import { Tx } from '../utils';

import sinon from 'sinon';
import { Config } from '../../../src/cloud/config';

export class TestUtils {
   public static sandbox: sinon.SinonSandbox;
   public static jwtToken: string;


   public static run() {
      describe(Tx.testInit('seismic store shared utils'), () => {
         beforeEach(() => { this.sandbox = sinon.createSandbox(); });
         afterEach(() => { this.sandbox.restore(); });

         this.testGetPropertyFromTokenPayload();
         this.testGetIssFromPayload();
         this.testExpTimeFromPayload();
         this.testAudienceFromPayload();
         this.testAzpFromPayload();
         this.testPayloadFromStringToken();
         this.testdecrypt();
         this.testexponentialBackOff();
         this.testisEmail();
         this.resolveJsonRefs();
         this.checkSauthV1EmailDomainName();


      });

      this.jwtToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyQGVtYWls
      IiwiaXNzIjoiYXV0aC1pc3N1ZXIiLCJhdWQiOiJhdWRpZW5jZTAxIiwiaWF0IjoxNTcyOTc0MjkxLC
      JleHAiOjE1NzMwNjA2OTEsInByb3ZpZGVyIjoiY29tcCIsImNsaWVudCI6ImctYXBwIiwidXNlcmlk
      IjoidXNlckBlbWFpbCIsImVtYWlsIjoidXNlckBlbWFpbCIsImF1dGh6IjoiYXV0aHotaW5mbyIsIm
      xhc3RuYW1lIjoidXNlci1sYXN0bmFtZSIsImZpcnN0bmFtZSI6InVzZXItZmlyc3RuYW1lIiwiY291
      bnRyeSI6IiIsImNvbXBhbnkiOiIiLCJqb2J0aXRsZSI6IiIsInN1YmlkIjoiMWVuVmZkc2FvOTRsNm
      Y2aVNSWERxMmR3IiwiaWRwIjoibzM2NSIsImhkIjoiY29tcC5jb20iLCJkZXNpZCI6InVzZXJAY29t
      cC5kZXNpZC5jb20iLCJjb250YWN0X2VtYWlsIjoidXNlckBlbWFpbCJ9.vC2Iw7lShi-JKNaPwDAM4
      V7XIxEqYMs9NXSFlSlZIDc`;

   }

   private static testGetPropertyFromTokenPayload() {
      Tx.sectionInit('get property from token payload');

      Tx.test((done: any) => {
         const emailid = Utils.getPropertyFromTokenPayload(this.jwtToken, 'desid');
         Tx.checkTrue(emailid === 'user@comp.desid.com', done);
      });

   }

   private static testGetIssFromPayload() {
      Tx.sectionInit('get iss from token payload');

      Tx.test((done: any) => {
         const emailid = Utils.getPropertyFromTokenPayload(this.jwtToken, 'iss');
         Tx.checkTrue(emailid === 'auth-issuer', done);
      });

   }

   private static testExpTimeFromPayload() {

      Tx.sectionInit('get expiry time from payload');

      Tx.test((done: any) => {
         const expiryTime = Utils.getExpTimeFromPayload(this.jwtToken);
         Tx.checkTrue(expiryTime === 1573060691, done);
      });
   }

   private static testAudienceFromPayload() {
      
      Tx.sectionInit('get Audience from payload');

      Tx.test((done: any) => {
         const audience = Utils.getAudienceFromPayload(this.jwtToken);
         Tx.checkTrue(audience === 'audience01', done);
      });

   }

   private static testAzpFromPayload() {

      Tx.sectionInit('get Azp from payload');
      Tx.test((done: any) => {
         const azp = Utils.getAzpFromPayload(this.jwtToken);
         Tx.checkTrue(azp === undefined, done);

      });
      
      // done();


   }

   private static testPayloadFromStringToken() {

      Tx.sectionInit('test PayloadFromStringToken');
      Tx.test((done: any) => {
         const basePayload = Utils.getPayloadFromStringToken(undefined);
         Tx.checkTrue(basePayload === undefined, done);
      });

      // Tx.test((done: any) => {
      //    const basePayload = Utils.getPayloadFromStringToken('abcde.fghijk');
      //    Tx.checkTrue(basePayload === undefined, done);
      // });
   }

   private static testdecrypt() {
      Tx.sectionInit('test decrypt');
      // Tx.test((done: any) => {
      //    // const hash = this.sandbox.stub(crypto, 'createHash').resolves('hash');
      //    this.sandbox.stub(crypto, 'createDecipher').resolves();
      //    Utils.decrypt('encryptedText', 'encryptedTextIV', 'key')
      //    done();
      // });   

   }

   private static testexponentialBackOff() {
      Tx.sectionInit('test exponential BackOff');
      Tx.test((done: any) => {
         const methodToCall = {} as any;
         Utils.exponentialBackOff(methodToCall);
         done();
      });   

   }

   private static testisEmail() {
      Tx.sectionInit('test is Email');

      Tx.test((done: any) => {
         const methodToCall = {} as any;
         const input1 = 'abc'
         const res = Utils.isEmail(input1);
         Tx.checkFalse(res, done);
      });

      Tx.test((done: any) => {
         const methodToCall = {} as any;
         const input1 = 'abc@test.com'
         const res = Utils.isEmail(input1);
         Tx.checkTrue(res, done);
      });   

   }

   private static resolveJsonRefs() {
      Tx.sectionInit('resolve JsonRefs');

      Tx.test((done: any) => {
         const methodToCall = {} as any;
         const input1 = 'abc'
         const res = Utils.resolveJsonRefs(input1);
         done();
         Tx.checkFalse(typeof res === "object", done);
      });  
   }

   private static checkSauthV1EmailDomainName() {
      Tx.sectionInit('resolve JsonRefs');

      Tx.test((done: any) => {
         // const methodToCall = {} as any;
         // const input1 = 'abc'
         const temp = Config.CLOUDPROVIDER;
         Config.CLOUDPROVIDER = 'google';
         const res = Utils.checkSauthV1EmailDomainName('slbservice.com@slb.com');
         Config.CLOUDPROVIDER = temp;
         done();
      });  
   }
}
