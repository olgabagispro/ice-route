#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-default}"
AWS_REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="${ICE_ANALYSIS_FUNCTION_NAME:-ice-route-ice-analysis}"
ROLE_NAME="${ICE_ANALYSIS_ROLE_NAME:-ice-route-ice-analysis-role}"
API_NAME="${ICE_ANALYSIS_API_NAME:-ice-route-ice-analysis}"
PARAMETER_NAME="${OPENAI_API_KEY_PARAMETER:-/ice-route/openai/api-key}"
OPENAI_MODEL="${OPENAI_MODEL:-gpt-5.4}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAMBDA_DIR="$ROOT_DIR/aws/ice-analysis/lambda"
BUILD_DIR="$ROOT_DIR/tmp/ice-analysis-build"
ZIP_PATH="$BUILD_DIR/ice-analysis.zip"

ACCOUNT_ID="$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)"
ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"
PARAMETER_ARN="arn:aws:ssm:$AWS_REGION:$ACCOUNT_ID:parameter${PARAMETER_NAME}"

mkdir -p "$BUILD_DIR"
rm -f "$ZIP_PATH"

(
  cd "$LAMBDA_DIR"
  zip -qr "$ZIP_PATH" .
)

if ! aws iam get-role --profile "$AWS_PROFILE" --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role \
    --profile "$AWS_PROFILE" \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null

  aws iam attach-role-policy \
    --profile "$AWS_PROFILE" \
    --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole >/dev/null

  sleep 10
fi

aws iam put-role-policy \
  --profile "$AWS_PROFILE" \
  --role-name "$ROLE_NAME" \
  --policy-name ice-route-ice-analysis-ssm-read \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"ssm:GetParameter\"],\"Resource\":\"$PARAMETER_ARN\"}]}" >/dev/null

if aws lambda get-function --profile "$AWS_PROFILE" --region "$AWS_REGION" --function-name "$FUNCTION_NAME" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$ZIP_PATH" >/dev/null

  aws lambda wait function-updated \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --function-name "$FUNCTION_NAME"

  aws lambda update-function-configuration \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --function-name "$FUNCTION_NAME" \
    --handler lambda_handler.lambda_handler \
    --runtime python3.12 \
    --timeout 30 \
    --memory-size 256 \
    --environment "Variables={OPENAI_API_KEY_PARAMETER=$PARAMETER_NAME,OPENAI_MODEL=$OPENAI_MODEL,OPENAI_TIMEOUT_SECONDS=25}" >/dev/null
else
  aws lambda create-function \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --function-name "$FUNCTION_NAME" \
    --runtime python3.12 \
    --handler lambda_handler.lambda_handler \
    --role "$ROLE_ARN" \
    --timeout 30 \
    --memory-size 256 \
    --environment "Variables={OPENAI_API_KEY_PARAMETER=$PARAMETER_NAME,OPENAI_MODEL=$OPENAI_MODEL,OPENAI_TIMEOUT_SECONDS=25}" \
    --zip-file "fileb://$ZIP_PATH" >/dev/null
fi

aws lambda wait function-active \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --function-name "$FUNCTION_NAME"

LAMBDA_ARN="$(aws lambda get-function --profile "$AWS_PROFILE" --region "$AWS_REGION" --function-name "$FUNCTION_NAME" --query 'Configuration.FunctionArn' --output text)"
API_ID="$(aws apigatewayv2 get-apis --profile "$AWS_PROFILE" --region "$AWS_REGION" --query "Items[?Name=='$API_NAME'].ApiId | [0]" --output text)"

if [[ "$API_ID" == "None" || -z "$API_ID" ]]; then
  API_ID="$(aws apigatewayv2 create-api \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --name "$API_NAME" \
    --protocol-type HTTP \
    --cors-configuration 'AllowOrigins=["https://ice-navigator.com","https://www.ice-navigator.com","http://localhost:3000","http://127.0.0.1:3000"],AllowMethods=["POST","OPTIONS"],AllowHeaders=["Content-Type"]' \
    --query ApiId \
    --output text)"
fi

INTEGRATION_ID="$(aws apigatewayv2 get-integrations --profile "$AWS_PROFILE" --region "$AWS_REGION" --api-id "$API_ID" --query "Items[?IntegrationUri=='$LAMBDA_ARN'].IntegrationId | [0]" --output text)"

if [[ "$INTEGRATION_ID" == "None" || -z "$INTEGRATION_ID" ]]; then
  INTEGRATION_ID="$(aws apigatewayv2 create-integration \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-method POST \
    --integration-uri "$LAMBDA_ARN" \
    --payload-format-version "2.0" \
    --query IntegrationId \
    --output text)"
fi

ROUTE_ID="$(aws apigatewayv2 get-routes --profile "$AWS_PROFILE" --region "$AWS_REGION" --api-id "$API_ID" --query "Items[?RouteKey=='POST /ice-class-analysis'].RouteId | [0]" --output text)"

if [[ "$ROUTE_ID" == "None" || -z "$ROUTE_ID" ]]; then
  aws apigatewayv2 create-route \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --api-id "$API_ID" \
    --route-key "POST /ice-class-analysis" \
    --target "integrations/$INTEGRATION_ID" >/dev/null
fi

STAGE_NAME="\$default"
if ! aws apigatewayv2 get-stage --profile "$AWS_PROFILE" --region "$AWS_REGION" --api-id "$API_ID" --stage-name "$STAGE_NAME" >/dev/null 2>&1; then
  aws apigatewayv2 create-stage \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --api-id "$API_ID" \
    --stage-name "$STAGE_NAME" \
    --auto-deploy >/dev/null
fi

aws lambda add-permission \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --function-name "$FUNCTION_NAME" \
  --statement-id AllowIceAnalysisHttpApiInvoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$AWS_REGION:$ACCOUNT_ID:$API_ID/*/*/ice-class-analysis" >/dev/null 2>&1 || true

API_ENDPOINT="$(aws apigatewayv2 get-api --profile "$AWS_PROFILE" --region "$AWS_REGION" --api-id "$API_ID" --query ApiEndpoint --output text)"
echo "$API_ENDPOINT/ice-class-analysis"

