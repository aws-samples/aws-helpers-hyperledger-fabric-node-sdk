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

const AWS = require('aws-sdk');
const Cache = require('timed-cache')
const logger = require("./logging").getLogger("parameter-store-kvs");
const DEFAULT_TTL = 60 * 60 * 1000; // Default cache TTL is 1 hour

module.exports = class ParameterStoreKVS {
    constructor(params) {

        this.__ssm = new AWS.SSM();

        this.prefix = `${(params && params.prefix) || ''}`;
        if (this.prefix.length) {
            this.prefix += '/';
        }

        this.maxRetries = 10;
        const cacheTTL = (params && params.cacheTtl) || DEFAULT_TTL;
        logger.debug(`Set default TTL to ${cacheTTL}`)
        this.__cache = new Cache({
            defaultTtl: cacheTTL
        }); /*Will store cached values of the secrets*/

        return this;

    }

    // Get parameter from parameter store by Id
    getValue(key) {
        const fcnName = "[ParameterStoreKVS.getValue]";
        const paramId = this.prefix + key;
        const ssm = this.__ssm;

        return new Promise((resolve, reject) => {
            // Retrieving cached value first if it exists
            const cachedValue = this.__cache.get(paramId);
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
                        this.__cache.put(paramId, data.Parameter.Value);
                        resolve(data.Parameter.Value);
                    }
                });
            }
        });
    };

    //Put parameter to Parameter Store by Id
    setValue(key, value) {
        const fcnName = "[ParameterStoreKVS.setValue]";
        const paramId = this.prefix + key;
        const data = value;
        const ssm = this.__ssm;

        return new Promise(async (resolve, reject) => {
            let params = {
                Name: paramId,
                /* required */
                Type: "String",
                /* required */
                Value: data,
                /* required */
                //AllowedPattern: 'STRING_VALUE',
                Description: 'Parameter for a custom application',
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
            const paramValue = await this.getValue(key);
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
                    this.__cache.put(paramId, value);

                    resolve(data);
                }
            });
        });
    };
}