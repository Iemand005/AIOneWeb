let module;
let session;
let initializing;
let mountedFile;

let operationQueue = Promise.resolve();

const WORKER_URL = new URL(self.location.href);
const SEARCH_PARAMS = WORKER_URL.searchParams;
const USE_THREADS =
    SEARCH_PARAMS.get("threads") === "1" && typeof Worker !== "undefined";

const DEFAULT_RUNTIME_DIR = new URL(
    USE_THREADS ? "./build/Release-mt/" : "./build/Release/",
    WORKER_URL
);

const RUNTIME_URL = SEARCH_PARAMS.get("runtime")
    ? new URL(SEARCH_PARAMS.get("runtime"), WORKER_URL).href
    : new URL(
        USE_THREADS ? "AIOneWebMT.js" : "AIOneWeb.js",
        DEFAULT_RUNTIME_DIR
    ).href;

const WASM_URL = SEARCH_PARAMS.get("wasm");
const HAS_EXTERNAL_RUNTIME = typeof Module !== "undefined";

if (!HAS_EXTERNAL_RUNTIME) {
    importScripts(RUNTIME_URL);
}

function locateFile(path) {
    if (WASM_URL) {
        return new URL(WASM_URL, WORKER_URL).href;
    }

    return new URL(path, RUNTIME_URL).href;
}

async function initialize(file) {
    if (session) {
        throw new Error("A model is already loaded");
    }

    if (module && mountedFile !== file.name) {
        throw new Error("This runtime is already initialized with another model file");
    }

    if (!initializing && !module) {
        initializing = (async () => {
            const moduleOptions = { workerFile: file };

            if (WASM_URL || !HAS_EXTERNAL_RUNTIME) {
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

            return await session.generate(
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

self.onconnect = event => {
    const port = event.ports[0];

    port.onmessage = ({ data }) => {
        const onToken = data.args?.stream
            ? token => port.postMessage({ id: data.id, token })
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

    port.start();
    port.postMessage({ type: "ready" });
};