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
const logger = require("./logging").getLogger("secrets-manager");
const DEFAULT_TTL = 60 * 60 * 1000; // Default cache TTL is 1 hour

module.exports = class SecretsManagerKVS {
    constructor(params) {
        this.__sm = new AWS.SecretsManager();
        this.prefix = params ? params.prefix + "/" : "/";
        const cacheTTL = params ? params.cacheTtl ? params.cacheTtl : DEFAULT_TTL : DEFAULT_TTL;
        logger.debug(`Set default TTL to ${cacheTTL}`)
        this.__cache = new Cache({
            defaultTtl: cacheTTL
        }); /*Will store cached values of the secrets*/

        return this;
    }

    // Get parameter from parameter store by Id
    getValue(key) {
        const fcnName = "[SecretsManagerKVS.getValue]";
        const self = this;

        let keyType = null;
        if (key.search("-priv") >= 0) {
            keyType = "-priv";
        }
        if (key.search("-pub") >= 0) {
            keyType = "-pub";
        }
        const paramId = self.prefix + key;
        const sm = self.__sm;

        return new Promise(async (resolve, reject) => {

            // Retrieving cached value first if it exists
            const cachedValue = self.__cache.get(paramId);
            if (cachedValue) {
                resolve(cachedValue);
            } else if (keyType === "-pub") {
                resolve(null);
            } else {
                const params = {
                    SecretId: paramId /* required */
                    // VersionId: 'STRING_VALUE',
                    // VersionStage: 'STRING_VALUE'
                };
                await sm.getSecretValue(params, (err, data) => {
                    if (err) {
                        resolve(null);
                        //throw new Error(`${fcnName}: Secret ID: ${params.SecretId} ;${err}`)
                    } else {
                        if (typeof data.SecretString == "string") {
                            let secretString = "";
                            //Checking if data.SecretString is parsable to JSON
                            try {
                                secretString = JSON.parse(data.SecretString);
                            } catch (e) {
                                secretString = data.SecretString;
                            }
                            let value = secretString;
                            //logger.debug(`${fcnName} Value received: ${JSON.stringify(value)}`);
                            self.__cache.put(paramId, value);
                            resolve(value);
                        } else {
                            reject(`${fcnName}: Currently support secret values of string type only`);
                        }
                    }
                });
            }
        });
    }

    //Put parameter to Parameter Store by Id
    setValue(key, value) {
        const fcnName = "[SecretsManagerKVS.setValue]";
        const self = this;

        let keyType = null;
        if (key.search("-priv") >= 0) {
            keyType = "-priv";
        }
        if (key.search("-pub") >= 0) {
            keyType = "-pub";
        }
        const paramId = self.prefix + key;

        const data = typeof value === "string" ? value : JSON.stringify(value);
        const sm = self.__sm;

        return new Promise(async (resolve, reject) => {

            let value = data;

            const params = {
                SecretId: paramId,
                /* required */
                // ClientRequestToken: 'STRING_VALUE',
                // SecretBinary: Buffer.from('...') || 'STRING_VALUE' /* Strings will be Base-64 encoded on your behalf */ ,
                SecretString: value,
                // VersionStages: [
                //     'STRING_VALUE',
                //     /* more items */
                // ]
            };
            if (keyType !== "-pub") {
                sm.putSecretValue(params, (err, data) => {
                    if (err) {
                        if (err.code === 'ResourceNotFoundException') {
                            // If secret does not exist, create one
                            const params = {
                                //ClientRequestToken: "EXAMPLE1-90ab-cdef-fedc-ba987SECRET1",
                                Description: "Secret for custom application",
                                Name: paramId,
                                SecretString: value
                            };
                            sm.createSecret(params, (err, data) => {
                                if (err) {
                                    reject(`${fcnName}: Secret ID: ${params.SecretId} ;${err}`);
                                    throw new Error(`${fcnName}: Secret ID: ${params.SecretId} ;${err}`)
                                } else {
                                    self.__cache.put(paramId, value);
                                    resolve(value);
                                }
                            })
                        } else {
                            logger.error(`${fcnName}: Secret ID: ${params.SecretId} ;${err}`)
                            resolve(null);
                            //throw new Error(`${fcnName}: Secret ID: ${params.SecretId} ;${err}`)
                        }
                    } else {
                        //If all Ok, we update cached value as well
                        self.__cache.put(paramId, value);
                        resolve(value);
                    }
                });
            } else {
                resolve(value);
            }
        });
    };
}