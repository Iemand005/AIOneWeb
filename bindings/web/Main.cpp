#include <emscripten/bind.h>
#include "ModelSession.hpp"

using namespace emscripten;

static bool loadModelWithProgressCallback(
    AIOne::ModelSession* session,
    const std::string& path,
    emscripten::val onProgress
) {
    ProgressCallback callback = nullptr;

    if (!onProgress.isUndefined() && !onProgress.isNull()) {
        callback = [onProgress](const float progress) {
            onProgress(progress);
        };
    }

    return session->loadModel(path, callback);
}

static bool isFunction(const emscripten::val& value) {
    return !value.isUndefined()
        && !value.isNull()
        && value.typeOf().as<std::string>() == "function";
}

static AIOne::GenerateCallbacks generateCallbacksFromValue(const emscripten::val& callbacks) {
    AIOne::GenerateCallbacks result;

    if (callbacks.isUndefined() || callbacks.isNull()) return result;

    const auto onToken = callbacks["onToken"];
    if (isFunction(onToken)) {
        result.onToken = [onToken](const std::string& token) {
            onToken(token);
        };
    }

    const auto onTokenReasoning = callbacks["onTokenReasoning"];
    if (isFunction(onTokenReasoning)) {
        result.onTokenReasoning = [onTokenReasoning](const std::string& token, bool thinking) {
            onTokenReasoning(token, thinking);
        };
    }

    const auto onInputEval = callbacks["onInputEval"];
    if (isFunction(onInputEval)) {
        result.onInputEval = [onInputEval](const float progress) {
            onInputEval(progress);
        };
    }

    const auto onGenerationStart = callbacks["onGenerationStart"];
    if (isFunction(onGenerationStart)) {
        result.onGenerationStart = [onGenerationStart]() {
            onGenerationStart();
        };
    }

    const auto onThinkStateChange = callbacks["onThinkStateChange"];
    if (isFunction(onThinkStateChange)) {
        result.onThinkStateChange = [onThinkStateChange](bool thinking) {
            onThinkStateChange(thinking);
        };
    }

    return result;
}

static emscripten::val generateWithCallbacks(
    AIOne::ModelSession* session,
    const std::string& prompt,
    unsigned int maxTokens,
    emscripten::val callbacks
) {
    auto result = session->generate(prompt, maxTokens, generateCallbacksFromValue(callbacks));

    emscripten::val stats = emscripten::val::object();
    stats.set("promptTokens", static_cast<double>(result.tokensEvaluated));
    stats.set("cachedTokens", static_cast<double>(result.tokensCached));
    stats.set("generatedTokens", static_cast<double>(result.tokensGenerated));
    stats.set("promptEvalMs", result.promptEvalMs);
    stats.set("generationMs", result.generationMs);
    stats.set("promptTokensPerSecond", result.promptTokensPerSecond);
    stats.set("tokensPerSecond", result.tokensPerSecond);

    emscripten::val output = emscripten::val::object();
    output.set("content", result.output.content);
    output.set("stats", stats);
    return output;
}

EMSCRIPTEN_BINDINGS(ai_one) {

    class_<AIOne::ModelSession>("ModelSession")
        .constructor<>()
        .function(
            "loadModel",
            &loadModelWithProgressCallback,
            allow_raw_pointer<arg<0>>(),
            emscripten::async()
        )
        .function(
            "generate",
            &generateWithCallbacks,
            allow_raw_pointer<arg<0>>(),
            emscripten::async()
        )
        .function("unloadModel", &AIOne::ModelSession::unloadModel, emscripten::async())
        .function("isLoaded", &AIOne::ModelSession::isLoaded);
}
