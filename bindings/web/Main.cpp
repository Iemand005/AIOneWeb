#include <emscripten/bind.h>
#include "ModelSession.hpp"

using namespace emscripten;

EMSCRIPTEN_BINDINGS(ai_one) {

    class_<AIOne::ModelSession>("ModelSession")
        .constructor<>()
        .function("loadModel", &AIOne::ModelSession::loadModel, emscripten::async())
        .function("generate", &AIOne::ModelSession::generate, emscripten::async())
        .function("unloadModel", &AIOne::ModelSession::unloadModel, emscripten::async())
        .function("isLoaded", &AIOne::ModelSession::isLoaded);
}