# aws-lambda-ytdl

Download YouTube videos to S3 using Lambda powered by [ytdl](https://www.npmjs.com/package/ytdl-core).

## Deploy and Test

> You need an up-to-date [AWS CLI](https://aws.amazon.com/cli/) installed and configured on your machine and [Node.js v12](https://nodejs.org/).

If you never worked with `aws cloudformation package` before, create an S3 bucket that stores the ZIP files that the `package` command generates. Run the following command and replace `YOUR_BUCKET` with a unique bucket name: `aws s3 mb s3://YOUR_BUCKET`.

Run the following commands (replace `$BUCKET` with your S3 bucket name to store ZIP files) to package the source code:
```
yarn
aws cloudformation package --s3-bucket $BUCKET --template-file template.yml --output-template-file .packaged.yml
```

Your output will look like this:
```
Uploading to 864a6c31b9b19e4abfba8d28d719b9a8  8460482 / 8460482.0  (100.00%)
Successfully packaged artifacts and wrote output template to file .packaged.yml.
Execute the following command to deploy the packaged template:
aws cloudformation deploy --template-file .../.packaged.yml --stack-name <YOUR STACK NAME>
```

Now it's time to deploy the CloudFormation stack (replace `$STACK` with your desired name):
```
aws cloudformation deploy --stack-name $STACK --template-file .packaged.yml --capabilities CAPABILITY_IAM
```

Your output will look like this:
```
Waiting for changeset to be created..
Waiting for stack create/update to complete
Successfully created/updated stack - $STACK
```

## Create a REST API to invoke your function

Find the same steps, with detailed explanations, in the [AWS Lambda Docs](https://docs.aws.amazon.com/lambda/latest/dg/services-apigateway-tutorial.html).

```
aws apigateway create-rest-api --name $STACK
```
Grab the `id` from the response; from now on we will refer to it as `$API`
```
aws apigateway get-resources --rest-api-id $API
```
Grab the `id` from the response; from now on we will refer to it as `$PARENT`
```
aws apigateway create-resource --rest-api-id $API --path-part $STACK --parent-id $PARENT
```
Grab the `id` from the response; from now on we will refer to it as `$RESOURCE`
```
aws apigateway put-method --rest-api-id $API --resource-id $RESOURCE --http-method GET --authorization-type NONE
```
In the following commands:
- `$REGION` refers to the region where you want the API to be deployed;
- `$ACCOUNT` refers to your account id (find it in your [Console account settings](https://console.aws.amazon.com/billing/home?#/account))
```
aws apigateway put-integration --rest-api-id $API --resource-id $RESOURCE --http-method GET --type AWS_PROXY --integration-http-method GET \
--uri arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$ACCOUNT:function:$STACK
```
```
aws apigateway put-method-response --rest-api-id $API --resource-id $RESOURCE --http-method GET \
--status-code 200 --response-models application/json=Empty
```
```
aws apigateway put-integration-response --rest-api-id $API --resource-id $RESOURCE --http-method GET \
--status-code 200 --response-templates application/json=""
```
```
aws apigateway create-deployment --rest-api-id $API --stage-name prod
```
```
aws lambda add-permission --function-name $STACK --statement-id apigateway-test-2 --action lambda:InvokeFunction \
--principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT:$API/*/GET/$STACK"
```
```
aws lambda add-permission --function-name $STACK --statement-id apigateway-prod-2 --action lambda:InvokeFunction \
--principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT:$API/prod/GET/$STACK"
```

> To clean up:
> - empty the S3 bucket that stores your video
> - remove the CloudFormation stack you created
> - remove the API gateway you created

## Invokation

`GET` `https://$API.execute-api.$REGION.amazonaws.com/prod/$STACK?videoId=<ANY PUBLIC YOUTUBE VIDEO ID>`

or

`GET` `https://$API.execute-api.$REGION.amazonaws.com/prod/$STACK?videoUrl=<ANY PUBLIC YOUTUBE VIDEO URL>`

or

`GET` `https://$API.execute-api.$REGION.amazonaws.com/prod/$STACK?videoId=<ANY PUBLIC YOUTUBE VIDEO ID>&path=/some/folder/path/in/the/s3/bucket`

`Note` See the queryParameters in `index.js`.

### Response

```
{
  "bucketName": "test",
  "path": "xyz.mp4",
  "url": "s3://test/xyz.mp4"
}
```

## Limitations

* The download from YouTube and upload to S3 must finish within 15 minutes (I have not found a video that was too big).
