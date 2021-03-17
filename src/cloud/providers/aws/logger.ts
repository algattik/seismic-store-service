// Copyright © 2020 Amazon Web Services
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

import { getLogger } from 'log4js';
import {AbstractLogger, LoggerFactory} from '../../logger';
import { AWSConfig } from './config';

// fetch logger and export
@LoggerFactory.register('aws')
export class AwsLogger extends AbstractLogger {

	public info(data: any): void {
        logger.info(data); 
    }

    public debug(data: any): void {
        logger.debug(data); 
    }

    public error(data: any): void {
        logger.error(data);
    }
    
    public metric(key:string,data: any): void {
        logger.info("No Metric");
    }
}

export const logger = getLogger();

export function config()
{
    logger.level = AWSConfig.LOGGER_LEVEL;
}