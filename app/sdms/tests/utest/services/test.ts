// ============================================================================
// Copyright 2017-2021, Schlumberger
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

import { TestAppSVC } from './app';
import { TestDatasetSVC } from './dataset';
import { TestGeneralSVC } from './general';
import { TestImpTokenSVC } from './imptoken';
import { TestImpersonationTokenSVC } from './impersonation_token';
// import { TestLocker } from './locker';
import { TestSubProjectSVC } from './subproject';
import { TestTenantSVC } from './tenant';
import { TestUserSVC } from './user';
import { TestUtilitySVC } from './utility';
import { Tx } from '../utils';

export class TestServices {
	public static run() {
		describe(Tx.title('utest seismic store [services]'), () => {

			TestGeneralSVC.run();
			TestDatasetSVC.run();
			TestImpTokenSVC.run();
			TestImpersonationTokenSVC.run();
			TestSubProjectSVC.run();
			TestTenantSVC.run();
			TestAppSVC.run();
			TestUserSVC.run();
			TestUtilitySVC.run();
			// TestLocker.run();
		});
	}
}
