if (self.name?.startsWith("em-pthread")) {
    // Pthread worker: do nothing but load the Emscripten glue.
    importScripts(new URL("./build/Release-mt/AIOneWebMT.js", self.location.href).href);
} else {
    self.addEventListener("securitypolicyviolation", e => {
        console.error("CSP BLOCKED:", e.violatedDirective, e.blockedURI);
    });

    console.log("Worker runtime loaded");

    let module;
    let session;
    let initializing;
    let mountedFile;
    let ttsModule;
    let tts;

    let operationQueue = Promise.resolve();

    const WORKER_URL = new URL(self.location.href);
    const SEARCH_PARAMS = WORKER_URL.searchParams;

    const RUNTIME_OVERRIDE = SEARCH_PARAMS.get("runtime");
    const WASM_OVERRIDE = SEARCH_PARAMS.get("wasm");
    const WORKER_TYPE = SEARCH_PARAMS.get("workerType") ?? "shared";

    const HAS_EXTERNAL_RUNTIME = typeof Module !== "undefined";

    function getRuntimeUrl(threaded) {
        return new URL(
            threaded
                ? "./build/Release-mt/AIOneWebMT.js"
                : "./build/Release/AIOneWeb.js",
            WORKER_URL
        ).href;
    }

    let threaded =
        SEARCH_PARAMS.get("threads") === "1" &&
        typeof SharedArrayBuffer !== "undefined";

    let runtimeUrl = RUNTIME_OVERRIDE
        ? new URL(RUNTIME_OVERRIDE, WORKER_URL).href
        : getRuntimeUrl(threaded);

    if (!HAS_EXTERNAL_RUNTIME) {
        try {
            importScripts(runtimeUrl);
        } catch (error) {
            if (threaded && !RUNTIME_OVERRIDE) {
                console.warn("Threaded runtime failed; falling back:", error);

                threaded = false;
                runtimeUrl = getRuntimeUrl(false);
                importScripts(runtimeUrl);
            } else {
                throw error;
            }
        }
    }

    function locateFile(path) {
        if (WASM_OVERRIDE) {
            return new URL(WASM_OVERRIDE, WORKER_URL).href;
        }

        return new URL(path, runtimeUrl).href;
    }

    async function initialize(file, onProgress) {
        if (session) {
            throw new Error("A model is already loaded");
        }

        if (module && mountedFile !== file.name) {
            throw new Error(
                "This runtime is already initialized with another model file"
            );
        }

        if (!initializing && !module) {
            initializing = (async () => {
                const moduleOptions = {
                    workerFiles: [file]
                };

                if (WASM_OVERRIDE || !HAS_EXTERNAL_RUNTIME) {
                    moduleOptions.locateFile = locateFile;
                }

                module = await Module(moduleOptions);

                mountedFile = file.name;
                session = new module.ModelSession();
            })();

            try {
                await initializing;
            } catch (error) {
                initializing = undefined;
                module = undefined;
                throw error;
            }
        } else if (initializing) {
            await initializing;
        }

        await session.loadModel(
            "/models/" + file.name,
            onProgress ?? undefined
        );
    }

    async function initializeTts(files, options) {
        if (tts) {
            throw new Error("A TTS model is already loaded");
        }

        if (!ttsModule) {
            const moduleOptions = {
                workerFiles: files
            };

            if (WASM_OVERRIDE || !HAS_EXTERNAL_RUNTIME) {
                moduleOptions.locateFile = locateFile;
            }

            ttsModule = await Module(moduleOptions);
            tts = new ttsModule.TtsModel();
        }

        const modelPath = "/models/" + files[0].name;
        const mmprojPath = "/models/" + files[1].name;

        try {
            const loaded = await tts.loadModel(modelPath, mmprojPath, options ?? {});
            if (!loaded) {
                throw new Error(tts.lastError() || "Failed to load TTS model");
            }
        } catch (error) {
            tts.delete();
            tts = undefined;
            throw error;
        }
    }

    async function invoke(method, args, callbacks) {
        switch (method) {
            case "loadModel":
                return initialize(args.file, callbacks.onProgress);

            case "ttsLoadModel":
                return initializeTts(args.files, args.options);

            case "ttsSynthesize": {
                if (!tts?.isLoaded()) {
                    throw new Error("No TTS model is loaded");
                }

                const result = await tts.synthesize(args.prompt, args.options ?? {});
                if (!result.ok) {
                    throw new Error(result.error || tts.lastError() || "Failed to synthesize speech");
                }

                return result;
            }

            case "ttsUnloadModel":
                if (tts) {
                    tts.unloadModel();
                    tts.delete();
                    tts = undefined;
                }
                return;

            case "ttsVoices": {
                if (!tts?.isLoaded()) return "[]";
                return tts.voicesJson();
            }

            case "ttsIsLoaded":
                return Boolean(tts?.isLoaded());

            case "generate":
                if (!session?.isLoaded()) {
                    throw new Error("No model is loaded");
                }

                return session.generate(
                    args.prompt,
                    args.maxTokens ?? 512,
                    {
                        onTokenReasoning: callbacks.onToken,
                        onInputEval: callbacks.onPromptProgress,
                        onGenerationStart: callbacks.onGenerationStart,
                        onThinkStateChange: callbacks.onThinkingChange
                    }
                );

            case "unloadModel":
                if (session?.isLoaded()) {
                    await session.unloadModel();
                }
                return;

            default:
                throw new Error(`Unknown method: ${method}`);
        }
    }

    function handleConnection(port) {
        port.onmessage = ({ data }) => {
            const callbacks = {};

            if (data.args?.stream) {
                callbacks.onToken = (token, thinking) => port.postMessage({
                    id: data.id,
                    token,
                    thinking
                });
            }

            if (data.args?.thinkingState) {
                callbacks.onThinkingChange = thinking => port.postMessage({
                    id: data.id,
                    thinkingChange: thinking
                });
            }

            if (data.args?.promptProgress) {
                callbacks.onPromptProgress = progress => port.postMessage({
                    id: data.id,
                    promptProgress: progress
                });
            }

            if (data.args?.generationStart) {
                callbacks.onGenerationStart = () => port.postMessage({
                    id: data.id,
                    generationStart: true
                });
            }

            if (data.args?.progress) {
                callbacks.onProgress = progress => port.postMessage({
                    id: data.id,
                    progress
                });
            }

            const execute = operationQueue.then(() =>
                invoke(data.method, data.args ?? {}, callbacks)
            );

            operationQueue = execute.catch(() => {});

            execute.then(
                result => port.postMessage({
                    id: data.id,
                    result
                }),
                error => port.postMessage({
                    id: data.id,
                    error: error?.message ?? String(error)
                })
            );
        };

        port.start?.();
        port.postMessage({ type: "ready" });
    }

    if (WORKER_TYPE === "shared") {
        self.onconnect = event => {
            handleConnection(event.ports[0]);
        };
    } else if (WORKER_TYPE === "dedicated") {
        handleConnection(self);
    } else {
        throw new Error(`Unsupported worker type: ${WORKER_TYPE}`);
    }
}