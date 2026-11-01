
self.addEventListener("securitypolicyviolation", e => {
    console.error("CSP BLOCKED:", e.violatedDirective, e.blockedURI);
});

console.log("Worker runtime loaded");

let module;
let session;
let initializing;
let mountedFile;

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

async function initialize(file) {
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
                workerFile: file,
                mainScriptUrlOrBlob: runtimeUrl
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

    await session.loadModel("/models/" + file.name);
}

async function invoke(method, args, onToken) {
    switch (method) {
        case "loadModel":
            return initialize(args.file);

        case "generate":
            if (!session?.isLoaded()) {
                throw new Error("No model is loaded");
            }

            return session.generate(
                args.prompt,
                args.maxTokens ?? 512,
                onToken
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
        const onToken = data.args?.stream
            ? token => port.postMessage({
                id: data.id,
                token
            })
            : null;

        const execute = operationQueue.then(() =>
            invoke(data.method, data.args ?? {}, onToken)
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
