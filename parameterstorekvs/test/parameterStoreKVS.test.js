/*
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy of
# this software and associated documentation files (the "Software"), to deal in
# the Software without restriction, including without limitation the rights to
# use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
# the Software, and to permit persons to whom the Software is furnished to do so.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
# FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
# COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
# IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
# CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
#
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