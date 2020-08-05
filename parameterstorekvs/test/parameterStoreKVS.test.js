/*
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with
 * the License. A copy of the License is located at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions
 * and limitations under the License.
 */

const SystemsManagerKVS = require('../app');
const assert = require('assert');

const key = "config"
const value = "myAppConfigValue"

let kvs;
describe('Test SystemsManagerKVS', () => {
    it('Test constructor', async () => {
        kvs = new SystemsManagerKVS({
            prefix: "/myAppConfigPrefix",
            cacheTtl: 1000
        });
    });

    it('Test setValue', async () => {
        const res = await kvs.setValue(key, value);
        assert.equal(res.Tier, "Standard");
    }).timeout(5000);

    it('Test getValue from cache', async () => {
        const res = await kvs.getValue(key);
        assert.equal(res, value);
    });

    it('Test getValue with cache expired', () => {
        setTimeout(async () => {
            const res = await kvs.getValue(key);
            assert.equal(res, value);
        }, 1000)
    });
});