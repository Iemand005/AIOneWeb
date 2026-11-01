#include <emscripten/bind.h>
#include "ModelSession.hpp"

using namespace emscripten;

static std::string generateWithTokenCallback(
    AIOne::ModelSession* session,
    const std::string& prompt,
    unsigned int maxTokens,
    emscripten::val onToken
) {
    AIOne::TokenCallback callback = nullptr;

    if (!onToken.isUndefined() && !onToken.isNull()) {
        callback = [onToken](const std::string& token) {
            onToken(token);
        };
    }

    return session->generate(prompt, maxTokens, callback);
}

EMSCRIPTEN_BINDINGS(ai_one) {

    class_<AIOne::ModelSession>("ModelSession")
        .constructor<>()
        .function("loadModel", &AIOne::ModelSession::loadModel, emscripten::async())
        .function("generate", &generateWithTokenCallback, emscripten::async())
        .function("unloadModel", &AIOne::ModelSession::unloadModel, emscripten::async())
        .function("isLoaded", &AIOne::ModelSession::isLoaded);
}