import { PluginManager, Hook } from "@server/utils/PluginManager";
import config from "../plugin.json";
import router from "./api/ai";
import env from "./env";

const enabled = !!env.AI_PROVIDER && (
  (env.AI_PROVIDER === "anthropic" && !!env.ANTHROPIC_API_KEY) ||
  (env.AI_PROVIDER === "openai" && !!env.OPENAI_API_KEY)
);

if (enabled) {
  PluginManager.add([
    {
      ...config,
      type: Hook.API,
      value: router,
    },
  ]);
}
