use aws_sdk_bedrockruntime::config::Token;
use aws_sdk_bedrockruntime::types::{
    ContentBlock, ConversationRole, Message, SystemContentBlock,
};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AiResult {
    pub text: String,
}

#[tauri::command]
pub async fn ai_generate(
    instruction: String,
    selected_text: String,
) -> Result<AiResult, String> {
    let model = "us.anthropic.claude-opus-4-6-v1".to_string();

    let shared_config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;

    let region = shared_config
        .region()
        .map(|r| r.to_string())
        .unwrap_or_else(|| "no region configured".to_string());

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

    let user_content = format!(
        "<instruction>\n{instruction}\n</instruction>\n\n<text>\n{selected_text}\n</text>"
    );

    let message = Message::builder()
        .role(ConversationRole::User)
        .content(ContentBlock::Text(user_content))
        .build()
        .map_err(|e| format!("Failed to build message: {e}"))?;

    let response = client
        .converse()
        .model_id(&model)
        .system(SystemContentBlock::Text(
            "You are a writing assistant embedded in a text editor. \
             The user will provide an instruction and a piece of text. \
             Apply the instruction to the text and return ONLY the revised text. \
             Do not include any explanation, commentary, or surrounding tags — \
             just the final text."
                .to_string(),
        ))
        .messages(message)
        .send()
        .await
        .map_err(|e| {
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

    let output = response
        .output()
        .ok_or_else(|| "No output in response".to_string())?;

    let msg = output
        .as_message()
        .map_err(|_| "Response output is not a message".to_string())?;

    let text = msg
        .content()
        .iter()
        .filter_map(|block| block.as_text().ok())
        .cloned()
        .collect::<Vec<String>>()
        .join("");

    if text.is_empty() {
        return Err("Empty response from model".to_string());
    }

    Ok(AiResult { text })
}
