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
import { TenantHandler } from './handler';
import { TenantOP } from './optype';

const router = Router();

router.get('/sdpath', async (req: expRequest, res: expResponse) => {
    await TenantHandler.handler(req, res, TenantOP.GETSDPATH);
});

// create a tenant project
router.post('/:tenantid', async (req: expRequest, res: expResponse) => {
    await TenantHandler.handler(req, res, TenantOP.CREATE);
});

// get a tenant project
router.get('/:tenantid', async (req: expRequest, res: expResponse) => {
    await TenantHandler.handler(req, res, TenantOP.GET);
});

// delete a tenant project
router.delete('/:tenantid', async (req: expRequest, res: expResponse) => {
    await TenantHandler.handler(req, res, TenantOP.DELETE);
});

export { router as TenantRouter };
