// Copyright 2022 Google LLC
// Copyright 2022 EPAM Systems
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

import { AbstractLogger, LoggerFactory } from '../../logger';

// fetch logger and export
@LoggerFactory.register('anthos')
export class AnthosLogger extends AbstractLogger {

    public info(data: any): void {
        // tslint:disable-next-line:no-logger
        console.log(data);
    }

    public debug(data: any): void {
        // tslint:disable-next-line:no-logger
        console.debug(data);
    }

    public error(data: any): void {
        // tslint:disable-next-line:no-logger
        console.error(data);
    }

    // [TODO] this method should report a metrics using CSP SDK
    public metric(key: string, data: any): void {
        return;
    }
}