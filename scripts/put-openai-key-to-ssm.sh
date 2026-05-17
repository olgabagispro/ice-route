#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-default}"
AWS_REGION="${AWS_REGION:-us-east-1}"
PARAMETER_NAME="${OPENAI_API_KEY_PARAMETER:-/ice-route/openai/api-key}"
ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" && -f ".env.local" ]]; then
  ENV_FILE=".env.local"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Create .env or pass the env file path as the first argument." >&2
  exit 1
fi

OPENAI_API_KEY_VALUE="$(
  grep -E '^OPENAI_API_KEY=' "$ENV_FILE" |
  tail -n 1 |
  sed -E 's/^OPENAI_API_KEY=//; s/^"//; s/"$//; s/^'\''//; s/'\''$//'
)"

if [[ -z "$OPENAI_API_KEY_VALUE" || "$OPENAI_API_KEY_VALUE" == "MY_OPENAI_API_KEY" ]]; then
  echo "OPENAI_API_KEY is missing or still set to the example placeholder in $ENV_FILE." >&2
  exit 1
fi

aws ssm put-parameter \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --name "$PARAMETER_NAME" \
  --type SecureString \
  --value "$OPENAI_API_KEY_VALUE" \
  --overwrite >/dev/null

echo "Stored OPENAI_API_KEY in SSM parameter $PARAMETER_NAME ($AWS_REGION, profile $AWS_PROFILE)."

