// ============================================================================
// Copyright 2017-2023, Schlumberger
//
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// Distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// Limitations under the License.
// ============================================================================

import { SharedCache, Utils } from '../shared';
import { Config } from '../cloud';
import path from 'path';

async function ServerStart() {
    try {
        console.log('- Initializing cloud provider');
        Config.setCloudProvider(process.env.CLOUD_PROVIDER);

        console.log('- Initializing ' + Config.CLOUD_PROVIDER + ' Configurations');
        await Config.initialize();

        console.log('- Initializing shared cache');
        await SharedCache.init();

        console.log(`- Initializing header forwarding`);
        const hpropagate = require('hpropagate');
        Config.CALLER_FORWARD_HEADERS
            ? hpropagate({
                  headersToPropagate: Config.CALLER_FORWARD_HEADERS.split(','),
              })
            : hpropagate();

        const server = new (await import('./server')).Server();
        server.start();

        console.log(`- Initializing openapi documentation`);
        server.setSwagger();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

ServerStart();
