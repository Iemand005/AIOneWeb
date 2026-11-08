#include <cstdint>
#include <string>

#include <emscripten/bind.h>
#include "AIOne.h"
#include "ModelSession.hpp"

using namespace emscripten;

static bool loadModelWithProgressCallback(
    AIOne::ModelSession* session,
    const std::string& path,
    emscripten::val onProgress
) {
    ProgressCallback callback = nullptr;

    if (!onProgress.isUndefined() && !onProgress.isNull()) {
        callback = [onProgress](const float progress, const int a, const int b) {
            onProgress(progress, a, b);
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
        // TODO fisx
        // result.onInputEval = [onInputEval](const float progress) {
        //     onInputEval(progress);
        // };
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
    stats.set("promptTokens", static_cast<double>(result.tokensEvaluated + result.tokensCached));
    stats.set("evaluatedTokens", static_cast<double>(result.tokensEvaluated));
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

static bool hasValue(const emscripten::val& value) {
    return !value.isUndefined() && !value.isNull();
}

static emscripten::val property(const emscripten::val& object, const char* name) {
    if (!hasValue(object)) return emscripten::val::undefined();
    return object[name];
}

static std::string stringField(const emscripten::val& object, const char* name) {
    const auto value = property(object, name);
    return hasValue(value) ? value.as<std::string>() : std::string();
}

static void ttsLoadProgress(int stage, float progress, void* userData) {
    auto* callback = static_cast<emscripten::val*>(userData);
    const char* stageName = "mmproj";
    switch (stage) {
        case AIONE_TTS_LOAD_STAGE_BACKBONE:
            stageName = "backbone";
            break;
        case AIONE_TTS_LOAD_STAGE_BACKBONE_READY:
            stageName = "backbone-ready";
            break;
        case AIONE_TTS_LOAD_STAGE_MMPROJ_READY:
            stageName = "mmproj-ready";
            break;
        default:
            break;
    }
    (*callback)(stageName, progress);
}

static void ttsSynthesisProgress(int frameIndex, void* userData) {
    auto* callback = static_cast<emscripten::val*>(userData);
    (*callback)(std::string("synthesis"), frameIndex + 1);
}

static int ttsDeviceFromValue(const emscripten::val& value) {
    if (!hasValue(value)) return AIONE_TTS_DEVICE_ANY;
    if (value.typeOf().as<std::string>() == "number") return value.as<int>();

    const auto name = value.as<std::string>();
    if (name == "cpu") return AIONE_TTS_DEVICE_CPU;
    if (name == "igpu") return AIONE_TTS_DEVICE_IGPU;
    if (name == "dgpu") return AIONE_TTS_DEVICE_DGPU;
    if (name == "accelerator") return AIONE_TTS_DEVICE_ACCELERATOR;
    return AIONE_TTS_DEVICE_ANY;
}

static aione_tts_load_options ttsLoadOptionsFromValue(
    const emscripten::val& value
) {
    aione_tts_load_options options{};
    options.flash_attention = 1;

    if (!hasValue(value)) return options;

    const auto threadCount = property(value, "threadCount");
    if (hasValue(threadCount)) options.thread_count = threadCount.as<int>();

    const auto flashAttention = property(value, "flashAttention");
    if (hasValue(flashAttention)) {
        options.flash_attention = flashAttention.as<bool>() ? 1 : 0;
    }

    options.device = ttsDeviceFromValue(property(value, "device"));
    return options;
}

static aione_tts_synthesis_options ttsSynthesisOptionsFromValue(
    const emscripten::val& value,
    std::string& referenceFile,
    std::string& builtInName,
    std::string& lang
) {
    aione_tts_synthesis_options options{};
    options.output_type = AIONE_TTS_AUDIO_WAV;
    options.top_k = 50;
    options.top_p = 1.0f;
    options.seed = 0xFFFFFFFFu;
    options.batch_size = 512;
    options.max_tokens = -1;

    if (!hasValue(value)) return options;

    const auto outputType = property(value, "outputType");
    if (hasValue(outputType) && outputType.as<std::string>() == "pcm") {
        options.output_type = AIONE_TTS_AUDIO_PCM;
    }

    const auto voice = property(value, "voice");
    referenceFile = stringField(voice, "referenceFile");
    builtInName = stringField(voice, "builtInName");

    const auto builtInIndex = property(voice, "builtInIndex");
    if (hasValue(builtInIndex)) {
        options.voice.built_in_index = builtInIndex.as<int>();
    }

    lang = stringField(value, "lang");

    const auto topK = property(value, "topK");
    if (hasValue(topK)) options.top_k = topK.as<int>();

    const auto topP = property(value, "topP");
    if (hasValue(topP)) options.top_p = static_cast<float>(topP.as<double>());

    const auto seed = property(value, "seed");
    if (hasValue(seed)) options.seed = static_cast<unsigned int>(seed.as<double>());

    const auto batchSize = property(value, "batchSize");
    if (hasValue(batchSize)) options.batch_size = batchSize.as<int>();

    const auto maxTokens = property(value, "maxTokens");
    if (hasValue(maxTokens)) options.max_tokens = maxTokens.as<int>();

    options.voice.reference_file = referenceFile.empty() ? nullptr : referenceFile.c_str();
    options.voice.built_in_name = builtInName.empty() ? nullptr : builtInName.c_str();
    options.lang = lang.empty() ? nullptr : lang.c_str();
    return options;
}

class TtsSession {
public:
    TtsSession() : handle_(aione_tts_create()) {}

    ~TtsSession() {
        if (handle_) aione_tts_destroy(handle_);
    }

    bool loadModel(
        const std::string& modelPath,
        const std::string& mmprojPath,
        emscripten::val options,
        emscripten::val onProgress
    ) {
        if (!handle_) return false;

        const auto rawOptions = ttsLoadOptionsFromValue(options);
        const bool reportProgress = isFunction(onProgress);
        return aione_tts_load_model_with_progress(
            handle_,
            modelPath.c_str(),
            mmprojPath.c_str(),
            &rawOptions,
            reportProgress ? ttsLoadProgress : nullptr,
            reportProgress ? &onProgress : nullptr
        ) != 0;
    }

    void unloadModel() {
        if (handle_) aione_tts_unload_model(handle_);
    }

    bool isLoaded() const {
        return handle_ && aione_tts_is_loaded(handle_) != 0;
    }

    std::string voicesJson() {
        if (!handle_) return "[]";

        char* json = aione_tts_voices_json(handle_);
        if (!json) return "[]";

        std::string value(json);
        aione_string_free(json);
        return value;
    }

    emscripten::val synthesize(
        const std::string& prompt,
        emscripten::val options,
        emscripten::val onProgress
    ) {
        emscripten::val output = emscripten::val::object();
        if (!handle_) {
            output.set("ok", false);
            output.set("error", lastError());
            return output;
        }

        std::string referenceFile;
        std::string builtInName;
        std::string lang;
        const auto rawOptions = ttsSynthesisOptionsFromValue(
            options,
            referenceFile,
            builtInName,
            lang
        );

        auto result = aione_tts_synthesize(
            handle_,
            prompt.c_str(),
            &rawOptions,
            isFunction(onProgress) ? ttsSynthesisProgress : nullptr,
            isFunction(onProgress) ? &onProgress : nullptr
        );

        if (!result.ok) {
            const std::string error = lastError();
            aione_tts_synthesis_result_free(&result);
            output.set("ok", false);
            output.set("error", error);
            return output;
        }

        emscripten::val audio = emscripten::val::global("Uint8Array").new_(0);
        if (result.data && result.data_size > 0) {
            emscripten::val view(emscripten::typed_memory_view(
                static_cast<size_t>(result.data_size),
                reinterpret_cast<const std::uint8_t*>(result.data)
            ));
            audio = view.call<emscripten::val>("slice");
        }

        emscripten::val stats = emscripten::val::object();
        stats.set("promptEvalMs", result.prompt_eval_ms);
        stats.set("generationMs", result.generation_ms);
        stats.set("conversionMs", result.conversion_ms);

        output.set("ok", true);
        output.set("sampleRate", result.sample_rate);
        output.set("samples", static_cast<double>(result.samples));
        output.set("audioType", result.audio_type == AIONE_TTS_AUDIO_WAV ? "wav" : "pcm");
        output.set("audio", audio);
        output.set("stats", stats);

        aione_tts_synthesis_result_free(&result);
        return output;
    }

    std::string lastError() const {
        const char* error = aione_last_error();
        return error ? error : std::string();
    }

private:
    aione_tts* handle_ = nullptr;
};

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

    class_<TtsSession>("TtsModel")
        .constructor<>()
        .function("loadModel", &TtsSession::loadModel, emscripten::async())
        .function("synthesize", &TtsSession::synthesize, emscripten::async())
        .function("unloadModel", &TtsSession::unloadModel)
        .function("isLoaded", &TtsSession::isLoaded)
        .function("voicesJson", &TtsSession::voicesJson)
        .function("lastError", &TtsSession::lastError);
}
