# Secrets Manager KVS

A simple Key-Value store interface library for Amazon Secrets Manager service. It can be used stand-alone for simple use cases when all you need is to just put a value or get a value to/from Secrets Manager. It is also compatible with [Hyperledger Fabric Node SDK](https://fabricdocs.readthedocs.io/en/latest/nodeSDK/node-sdk-indepth.html#pluggability), so that you can put blockchain user's private keys configuration to the Secrets Manager and securely share it across all instances of your blockchain client application. 

### Pre-requisites

1. Make sure you are using NodeJS version 10 and above.
2. Configure your [AWS NodeJS SDK](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/configuring-the-jssdk.html)
3. Please make sure you set environment variable `AWS_REGION` to the region you are planning to you use, like this: `export AWS_REGION=us-east-1`

### Usage

``` Javascript
const SecretsManagerKVS = require("secretsmanagerkvs");

(async () => {
    const key = "key-priv"
    const value = "privateKey"
    try {
        const kvs = new SecretsManagerKVS({
            prefix: "/myappSecretsPrefix",
            cacheTtl: 60 * 1000
        })
        // Put value to Systems Manager under key "/myappSecretsPrefix/key-priv" and value "privateKey"
        const response = await kvs.setValue(key, value);

        if (response) {
            console.log(`Response from setValue: ${JSON.stringify(response)}`);
        } else {
            console.log(`Could not set value for key ${key} not found.`);
        }

        // Get value for key "/myappSecretsPrefix/config"
        const secretValue = await kvs.getValue(key, value);

        if (value) {
            console.log(`Value from config: ${secretValue}`);
        } else {
            console.log(`Value for key ${key} not found.`);
        }
    } catch (err) {
        console.error(`Error: ${err}`);
    }
})()
```

### Notes
- setValue() function will ignore keys tailing with `-pub` to avoid storing public keys in Secrets Manager
- getValue() will cache the values retrieved from Secrets Manager, so it is safe to call it multiple times in case we need to re-use the same secrets throughout an application