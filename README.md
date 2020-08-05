## AWS helper libraries for Hyperledger Fabric NodeJS SDK

A set of simple Key-Value store interface libraries for AWS Systems Manager Parameter Store and AWS Secrets Manager services. They can be used stand-alone for simple use cases when all you need is to just put a value or get a value to/from the AWS Systems Manager Parameter Store or AWS Secrets Manager. It is also compatible with [Hyperledger Fabric Node SDK](https://fabricdocs.readthedocs.io/en/latest/nodeSDK/node-sdk-indepth.html#pluggability), so that you can:
1. Put Connection Profile configuration to the Parameter Store and share it across all instances of your blockchain client application. 
2. Use AWS Secrets Manager as a wallet to store private keys and user login/passwords for your client applications.

For details please see README.md file in the respective directory:

- [KVS for AWS Systems Manager Parameter Store README](./parameterstorekvs/README.md)
- [KVS for AWS Secrets Manager Store README](secretsmanagerkvs/README.md)

## License

This library is licensed under the Apache 2.0 License.

