let module;
let session;
let initializing;
let mountedFile;

let operationQueue = Promise.resolve();

const WORKER_URL = new URL(self.location.href);
const SEARCH_PARAMS = WORKER_URL.searchParams;
const USE_THREADS = SEARCH_PARAMS.get("threads") === "1";

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

if (typeof Module === "undefined") {
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
            module = await Module({
                workerFile: file,
                locateFile
            });

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

    session.loadModel("/models/" + file.name);
}

async function invoke(method, args) {
    switch (method) {
        case "loadModel":
            return initialize(args.file);

        case "generate":
            if (!session?.isLoaded()) {
                throw new Error("No model is loaded");
            }

            return session.generate(args.prompt, args.maxTokens ?? 512);

        case "unloadModel":
            if (session?.isLoaded()) {
                session.unloadModel();
            }
            return;

        default:
            throw new Error(`Unknown method: ${method}`);
    }
}

self.onconnect = event => {
    const port = event.ports[0];

    port.onmessage = ({ data }) => {
        const execute = operationQueue.then(() =>
            invoke(data.method, data.args ?? {})
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