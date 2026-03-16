import { IsIn, IsOptional, IsString } from "class-validator";
import { Environment } from "@server/env";
import environment from "@server/utils/environment";

class AIPluginEnvironment extends Environment {
  /**
   * The AI provider to use for writing assistance.
   * Supported values: "anthropic", "openai"
   */
  @IsOptional()
  @IsIn(["anthropic", "openai"])
  public AI_PROVIDER = this.toOptionalString(environment.AI_PROVIDER) as
    | "anthropic"
    | "openai"
    | undefined;

  /**
   * Anthropic API key for Claude models.
   */
  @IsOptional()
  @IsString()
  public ANTHROPIC_API_KEY = this.toOptionalString(environment.ANTHROPIC_API_KEY);

  /**
   * OpenAI API key.
   */
  @IsOptional()
  @IsString()
  public OPENAI_API_KEY = this.toOptionalString(environment.OPENAI_API_KEY);

  /**
   * The model to use for AI completions. Defaults to the provider's recommended model.
   */
  @IsOptional()
  @IsString()
  public AI_MODEL = this.toOptionalString(environment.AI_MODEL);
}

export default new AIPluginEnvironment();
