# Parameter Store KVS

A simple Key-Value store interface library for Amazon Systems Manager Parameter Store service. It can be used stand-alone for simple use cases when all you need is to just put a value or get a value to/from the ParameterStore. It is also compatible with [Hyperledger Fabric Node SDK](https://fabricdocs.readthedocs.io/en/latest/nodeSDK/node-sdk-indepth.html#pluggability), so that you can put Connection Profile configuration to the Parameter Store and share it across all instances of your blockchain client application. 

### Pre-requisites

1. Make sure you are using NodeJS version 10 and above.
2. Configure your [AWS NodeJS SDK](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/configuring-the-jssdk.html)

### Usage

``` Javascript
const ParameterStoreKVS = require("aws-helper-fabric-node-sdk-parameterstorekvs");

(async () => {
    const key = "config"
    const value = "myAppConfigValue"
    try {
        // Pre-configuring all application-specific configuration keys to start with "/myAppConfigPrefix"
        const kvs = new ParameterStoreKVS({
            prefix: "/myAppConfigPrefix",
            cacheTtl: 60*60*1000
        })
        // Put value to Systems Manager under key "/myAppConfigPrefix/config" and value "myAppConfigValue"
        const response = await kvs.setValue(key, value);

        if (response) {
            console.log(`Response from setValue: ${JSON.stringify(response)}`);
        } else {
            console.log(`Could not set value for key ${key} not found.`);
        }

        // Get value for key "/myAppConfigPrefix/config"
        const valueFromConfig = await kvs.getValue(key, value);

        if (value) {
            console.log(`Value from config: ${valueFromConfig}`);
        } else {
            console.log(`Value for key ${key} not found.`);
        }
    } catch (err) {
        console.error(`Error: ${err}`);
    }
})()
```
