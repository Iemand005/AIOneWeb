#include <emscripten/bind.h>
#include "ModelSession.hpp"

using namespace emscripten;

EMSCRIPTEN_BINDINGS(ai_one) {

    class_<AIOne::ModelSession>("ModelSession")
        .constructor<>()
        .function("loadModel", &AIOne::ModelSession::loadModel)
        .function("generate", &AIOne::ModelSession::generate)
        .function("unloadModel", &AIOne::ModelSession::unloadModel)
        .function("isLoaded", &AIOne::ModelSession::isLoaded);
}