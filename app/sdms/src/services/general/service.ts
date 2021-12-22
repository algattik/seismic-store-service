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

import { Request as expRequest, Response as expResponse, Router } from 'express';
import { GeneralHandler } from './handler';
import { GeneralOP } from './optype';

const router = Router();

// get the service status response [jwt not required by proxy]
router.get('/', async (req: expRequest, res: expResponse) => {
    await GeneralHandler.handler(req, res, GeneralOP.Status);
});

// get the service status response [jwt required by proxy]
router.get('/access', async (req: expRequest, res: expResponse) => {
    await GeneralHandler.handler(req, res, GeneralOP.Access);
});

// get the service readiness status response [jwt not required by proxy]
router.get('/readiness', async (req: expRequest, res: expResponse) => {
    await GeneralHandler.handler(req, res, GeneralOP.Readiness);
});

export { router as GeneralRouter };
