use aws_sdk_bedrockruntime::config::Token;
use aws_sdk_bedrockruntime::types::{
    ContentBlock, ConversationRole, ConverseTokensRequest, CountTokensInput, Message,
};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct TokenCount {
    pub input_tokens: i32,
}

#[tauri::command]
pub async fn count_tokens(
    content: String,
    model_id: Option<String>,
) -> Result<TokenCount, String> {
    let model =
        model_id.unwrap_or_else(|| "anthropic.claude-sonnet-4-20250514-v1:0".to_string());

    let shared_config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;

    let region = shared_config
        .region()
        .map(|r| r.to_string())
        .unwrap_or_else(|| "no region configured".to_string());

    // Use bearer token from AWS_BEARER_TOKEN_BEDROCK if set, otherwise fall back to IAM credentials
    let has_token = std::env::var("AWS_BEARER_TOKEN_BEDROCK")
        .map(|t| !t.is_empty())
        .unwrap_or(false);

    let client = if has_token {
        let token = std::env::var("AWS_BEARER_TOKEN_BEDROCK").unwrap();
        let config = aws_sdk_bedrockruntime::config::Builder::from(&shared_config)
            .bearer_token(Token::new(token, None))
            .build();
        aws_sdk_bedrockruntime::Client::from_conf(config)
    } else {
        aws_sdk_bedrockruntime::Client::new(&shared_config)
    };

    let message = Message::builder()
        .role(ConversationRole::User)
        .content(ContentBlock::Text(content))
        .build()
        .map_err(|e| format!("Failed to build message: {e}"))?;

    let converse_input = ConverseTokensRequest::builder()
        .messages(message)
        .build();

    let response = client
        .count_tokens()
        .model_id(&model)
        .input(CountTokensInput::Converse(converse_input))
        .send()
        .await
        .map_err(|e| {
            // Extract detailed error info
            let source_chain = {
                let mut chain = Vec::new();
                let mut current: &dyn std::error::Error = &e;
                while let Some(source) = current.source() {
                    chain.push(format!("{source}"));
                    current = source;
                }
                chain.join(" -> ")
            };
            format!(
                "region={region} model={model} auth={} err={e} detail=[{source_chain}]",
                if has_token { "bearer" } else { "iam" }
            )
        })?;

    Ok(TokenCount {
        input_tokens: response.input_tokens(),
    })
}
