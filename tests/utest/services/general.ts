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

import { Request as expRequest, Response as expResponse } from 'express';
import { GeneralHandler } from '../../../src/services/general/handler';
import { GeneralOP } from '../../../src/services/general/optype';
import { Tx } from '../utils';
import { Response } from '../../../src/shared';

export class TestGeneralSVC {

    public static spy: sinon.SinonSandbox;

    public static run() {

        describe(Tx.testInit('general', true), () => {

            beforeEach(() => {  this.spy = sinon.createSandbox();
                                this.spy.stub(Response, 'writeMetric').returns();
                             });
            afterEach(() => { this.spy.restore(); });

            this.status();
            this.statusAccess();
            this.others();

        });

    }

    private static status() {

        Tx.sectionInit('status');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            await GeneralHandler.handler(expReq, expRes, GeneralOP.Status);
            Tx.check200(expRes.statusCode, done);
        });

    }

    private static statusAccess() {

        Tx.sectionInit('status access');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            await GeneralHandler.handler(expReq, expRes, GeneralOP.Access);
            Tx.check200(expRes.statusCode, done);
        });

    }

    private static others() {

        Tx.sectionInit('others');

        Tx.testExp(async (done: any, expReq: expRequest, expRes: expResponse) => {
            await GeneralHandler.handler(expReq, expRes, undefined);
            Tx.check500(expRes.statusCode, done);
        });

    }

}
