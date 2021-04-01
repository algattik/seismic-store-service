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

import { Response as expResponse } from 'express';
import xssfilters from 'xss-filters';
import { Config, LoggerFactory } from '../cloud';
import { Feature, FeatureFlags } from './featureflags';


export class Response {

    public static writeOK(res: expResponse, data: any = {}, code: number = 200) {
        this.write(res, code, data);
    }

    public static writeError(res: expResponse, err: any) {
        if (err) {
            const code = typeof (err.error) === 'object' && typeof (err.error.code) === 'number' ?
                err.error.code : typeof (err.code) === 'number' ? err.code : 500;
            const message = typeof (err.error) === 'object' && typeof (err.error.message) === 'string' ?
                err.error.message : typeof (err.message) === 'string' ? err.message : err;
            if (FeatureFlags.isEnabled(Feature.LOGGING)) {
                LoggerFactory.build(Config.CLOUDPROVIDER).error(JSON.stringify(err));
            }
            this.write(res, code < 100 ? 500 : code, message);
        } else {
            if (FeatureFlags.isEnabled(Feature.LOGGING)) {
                LoggerFactory.build(Config.CLOUDPROVIDER).error('Unexpected Error');
            }
            this.write(res, 500, 'Internal Server Error');
        }
    }

    public static write(res: expResponse, code: number, data: any = {}) {
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Content-Security-Policy': 'script-src \'self\' \'' +
                'sha256-/jDKvbQ8cdux+c5epDIqkjHbXDaIY8RucT1PmAe8FG4=\' \'' +
                'sha256-Zs5IcTe3sZcSKyWwfnpj4Arf2O14pmf4PcoigyHlHK8=\' \'' +
                'sha256-BeXIQk2DxxoDrgnnoH683KOnlwQvO0HH1fT4VFQTi8g=\'',
            'Expires': '0',
            'Service-Provider': Config.CLOUDPROVIDER,
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1',
        }).status(code).send(JSON.parse(xssfilters.inHTMLData(JSON.stringify(data))));
        this.writeMetric('Response Size', res.get('content-length') ? +res.get('content-length') : 0);
    }
    public static writeMetric(key: string, val: any): void {
        if (FeatureFlags.isEnabled(Feature.LOGGING)) {
            LoggerFactory.build(Config.CLOUDPROVIDER).metric(key, val);
        }
    }
}
