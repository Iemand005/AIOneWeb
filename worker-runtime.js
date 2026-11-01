let module;
let session;
let initializing;
let mountedFile;

let operationQueue = Promise.resolve();

const BASE_URL = "https://iemand005.github.io/AIOneJS/web/";

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

                locateFile: path =>
                    new URL(path, BASE_URL).href
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