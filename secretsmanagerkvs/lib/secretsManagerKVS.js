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
const logger = require("./logging").getLogger("secrets-manager");
const DEFAULT_TTL = 60 * 1000; // Default cache TTL is 1 minute

const KeyTypes = {
    Public: '-pub',
    Private: '-priv'
};

// When integrating with Hyperledger Fabric SDK, we need to detect a key type and 
// store only a private key to save us some costs. Public key will be derived from it by the SDK anyway.
function detectKeyType(key) {
    if (key.match(/-priv$/)) {
        return KeyTypes.Private;
    }
    if (key.match(/-pub$/)) {
        return KeyTypes.Public;
    }
    return null;
}

module.exports = class SecretsManagerKVS {
    constructor(params) {
        this.__sm = new AWS.SecretsManager();

        this.prefix = `${(params && params.prefix) || ''}`;
        if (this.prefix.length) {
            this.prefix += '/';
        }

        const cacheTTL = (params && params.cacheTtl) || DEFAULT_TTL;
        logger.debug(`Set default TTL to ${cacheTTL}`)
        this.__cache = new Cache({
            defaultTtl: cacheTTL
        }); /*Will store cached values of the secrets*/

        return this;
    }

    // Get parameter from Secrets Manager by Id
    getValue(key) {
        const fcnName = "[SecretsManagerKVS.getValue]";

        let keyType = detectKeyType(key);

        const secretIdentifier = this.prefix + key;
        const sm = this.__sm;

        return new Promise((resolve, reject) => {

            // Retrieving cached value first if it exists
            const cachedValue = this.__cache.get(secretIdentifier);
            if (cachedValue) {
                resolve(cachedValue);
            } else if (keyType === KeyTypes.Public) {
                // To make it compatible with Hyperledger Fabric SDK for NodeJS, returning null
                resolve(null);
            } else {
                const params = {
                    SecretId: secretIdentifier /* required */
                    // VersionId: 'STRING_VALUE',
                    // VersionStage: 'STRING_VALUE'
                };
                sm.getSecretValue(params, (err, data) => {
                    if (err) {
                        // To make it compatible with Hyperledger Fabric SDK for NodeJS, returning null
                        resolve(null);
                        //throw new Error(`${fcnName}: Secret ID: ${params.SecretId} ;${err}`)
                    } else {
                        let secretString = "";
                        //Checking if data.SecretString is parsable to JSON
                        try {
                            secretString = JSON.parse(data.SecretString);
                        } catch (e) {
                            secretString = data.SecretString;
                        }
                        let value = secretString;
                        //logger.debug(`${fcnName} Value received: ${JSON.stringify(value)}`);
                        this.__cache.put(secretIdentifier, value);
                        resolve(value);
                    }
                });
            }
        });
    }

    //Put parameter to Parameter Store by Id
    setValue(key, value) {
        const fcnName = "[SecretsManagerKVS.setValue]";

        let keyType = detectKeyType(key);

        const secretIdentifier = this.prefix + key;

        const data = typeof value === "string" ? value : JSON.stringify(value);

        const sm = this.__sm;

        return new Promise((resolve, reject) => {

            let value = data;

            const params = {
                SecretId: secretIdentifier,
                /* required */
                // ClientRequestToken: 'STRING_VALUE',
                // SecretBinary: Buffer.from('...') || 'STRING_VALUE' /* Strings will be Base-64 encoded on your behalf */ ,
                SecretString: value,
                // VersionStages: [
                //     'STRING_VALUE',
                //     /* more items */
                // ]
            };
            if (keyType !== KeyTypes.Public) {
                sm.putSecretValue(params, (err, data) => {
                    if (err) {
                        if (err.code === 'ResourceNotFoundException') {
                            // If secret does not exist, create one
                            const params = {
                                //ClientRequestToken: "EXAMPLE1-90ab-cdef-fedc-ba987SECRET1",
                                Description: "Secret for custom application",
                                Name: secretIdentifier,
                                SecretString: value
                            };
                            sm.createSecret(params, (errOnCreate, data) => {
                                if (errOnCreate) {
                                    reject(`${fcnName}: Secret ID: ${params.SecretId} ;${errOnCreate}`);
                                    throw new Error(`${fcnName}: Secret ID: ${params.SecretId} ;${errOnCreate}`)
                                } else {
                                    this.__cache.put(secretIdentifier, value);
                                    resolve(value);
                                }
                            })
                        } else {
                            logger.error(`${fcnName}: Secret ID: ${params.SecretId} ;${err}`)
                            // To make it compatible with Hyperledger Fabric SDK for NodeJS, returning null
                            resolve(null);
                            //throw new Error(`${fcnName}: Secret ID: ${params.SecretId} ;${err}`)
                        }
                    } else {
                        //If all Ok, we update cached value as well
                        this.__cache.put(secretIdentifier, value);
                        resolve(value);
                    }
                });
            } else {
                resolve(value);
            }
        });

    };
}