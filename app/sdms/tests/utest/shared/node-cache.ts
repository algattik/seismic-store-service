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

import { InMemoryCache } from '../../../src/shared/node-cache';
import { Tx } from '../utils';

import sinon from 'sinon';

export class TestNodeCache {
   public static spy: sinon.SinonSandbox;

   public static run() {

      describe(Tx.testInit('seismic store shared logger test'), () => {

         beforeEach(() => { this.spy = sinon.createSandbox(); });
         afterEach(() => { this.spy.restore(); });

         this.TestflushAll();

      });

   }

   private static TestflushAll() {

      Tx.sectionInit('Test flushAll');

      Tx.testExp((done: any) => {
         const trace = new InMemoryCache();
         trace.flushAll();
         done();
      });
   }

}
