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

const AWS = require('aws-sdk');
const Cache = require('timed-cache')
const logger = require("./logging").getLogger("parameter-store-kvs");
const DEFAULT_TTL = 60 * 60 * 1000; // Default cache TTL is 1 hour

module.exports = class ParameterStoreKVS {
    constructor(params) {

        this.__ssm = new AWS.SSM();
        this.prefix = params ? params.prefix + "/" : "/";
        this.maxRetries = 10;
        const cacheTTL = params ? params.cacheTtl ? params.cacheTtl : DEFAULT_TTL : DEFAULT_TTL;
        logger.debug(`Set default TTL to ${cacheTTL}`)
        this.__cache = new Cache({
            defaultTtl: cacheTTL
        }); /*Will store cached values of the secrets*/

        return this;

    }

    // Get parameter from parameter store by Id
    getValue(key) {
        const fcnName = "[ParameterStoreKVS.getValue]";
        const self = this;
        const paramId = self.prefix + key;
        const ssm = self.__ssm;

        return new Promise((resolve, reject) => {
            // Retrieving cached value first if it exists
            const cachedValue = self.__cache.get(paramId);
            if (cachedValue) {
                logger.debug(`${fcnName}: Retrieved value from cache`);
                resolve(cachedValue);
            } else {
                const params = {
                    Name: paramId,
                    WithDecryption: true
                };
                ssm.getParameter(params, (err, data) => {
                    if (err) {
                        logger.error(`${fcnName}: Error: ${err}`);
                        resolve(null);
                        //throw new Error(`${fcnName}: ${err}`)
                    } else {
                        // Saving value to cache
                        self.__cache.put(paramId, data.Parameter.Value);

                        resolve(data.Parameter.Value);
                    }
                });
            }
        });
    };

    //Put parameter to Parameter Store by Id
    setValue(key, value) {
        const fcnName = "[ParameterStoreKVS.setValue]";
        const self = this;
        const paramId = self.prefix + key;
        const data = value;
        const ssm = self.__ssm;

        return new Promise(async (resolve, reject) => {
            let params = {
                Name: paramId,
                /* required */
                Type: "String",
                /* required */
                Value: data,
                /* required */
                //AllowedPattern: 'STRING_VALUE',
                //Description: 'STRING_VALUE',
                //KeyId: 'STRING_VALUE',
                //Overwrite: true,
                //Policies: 'STRING_VALUE',
                // Tags: [{
                //     Key: 'type',
                //     /* required */
                //     Value: 'blockchain' /* required */
                // }],
                Tier: "Intelligent-Tiering"
            };
            const paramValue = await self.getValue(key);
            // If param does not yet exists in the store, create a new one and tag it
            // else: overwrite existing version.
            if (!paramValue) {
                params.Tags = [{
                    Key: 'type',
                    Value: 'kvs'
                }]
            } else {
                params.Overwrite = true;
            }

            ssm.putParameter(params, (err, data) => {
                if (err) {
                    if (err.toString().includes("TooManyUpdates")) {
                        this.maxRetries--;
                        if (this.maxRetries == 0) {
                            reject(`${fcnName} ${err}`);
                        }
                        setTimeout(async () => {
                            try {
                                const data = this.setValue(key, value);
                                resolve(data);
                            } catch (err) {
                                reject(`${fcnName} ${err}`);
                            }
                        }, 1000);
                    } else {
                        reject(`${fcnName}: ${err}`);
                    }
                } else {
                    // Updating cache first
                    self.__cache.put(paramId, value);

                    resolve(data);
                }
            });
        });
    };
}