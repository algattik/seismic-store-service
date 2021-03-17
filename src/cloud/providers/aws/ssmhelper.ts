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

import AWS from 'aws-sdk/global';
import {AWSConfig} from './config';
import SSM from 'aws-sdk/clients/ssm';

export class AWSSSMhelper {

    private ssm: SSM;

    public constructor() {
        AWS.config.update({ region: AWSConfig.AWS_REGION });
        this.ssm = new SSM({apiVersion: '2014-11-06'});
    }



    public async getSSMParameter(paramName: string): Promise<string> {

        const options = {
            Name: paramName,
            WithDecryption: true
        };
        try {
            const data = await this.ssm.getParameter(options).promise();
           // console.log(data.Parameter.Value);
            return data.Parameter.Value;
        } catch (err) {
            console.log(err.code + ': ' + err.message);
        }
    }
}