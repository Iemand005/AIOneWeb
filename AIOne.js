export default class AIOne {
	static async create(options = {}) {
		const workerUrl = new URL(
			options.workerUrl ?? "/aio1-worker.js",
			globalThis.location?.href ?? import.meta.url
		);

		if (options.threads) {
			workerUrl.searchParams.set("threads", "1");
		}

		if (options.runtimeUrl) {
			workerUrl.searchParams.set("runtime", options.runtimeUrl);
		}

		if (options.wasmUrl) {
			workerUrl.searchParams.set("wasm", options.wasmUrl);
		}

		if (typeof SharedWorker === "undefined") {
			throw new Error("SharedWorker is not supported by this browser");
		}

		const worker = new SharedWorker(workerUrl, {
			name: options.name ?? "AIOne",
			type: "classic"
		});

		worker.onerror = event => {
			console.error("AIOne SharedWorker error:", event);
		};

		const client = new AIOne(worker.port);
		await client.ready();

		return client;
	}

	constructor(port) {
		this.port = port;
		this.nextId = 0;
		this.pending = new Map();

		this.readyPromise = new Promise((resolve, reject) => {
			this.resolveReady = resolve;
			this.rejectReady = reject;
		});

		this.port.onmessage = ({ data }) => {
			if (data.type === "ready") {
				this.resolveReady();
				return;
			}

			const pending = this.pending.get(data.id);
			if (!pending) return;

			this.pending.delete(data.id);

			if (data.error) {
				pending.reject(new Error(data.error));
			} else {
				pending.resolve(data.result);
			}
		};

		this.port.onmessageerror = () => {
			this.rejectReady(new Error("AIOne worker message error"));

			for (const pending of this.pending.values()) {
				pending.reject(new Error("AIOne worker message error"));
			}

			this.pending.clear();
		};

		this.port.start();
	}

	ready() {
		return this.readyPromise;
	}

	call(method, args = {}) {
		const id = ++this.nextId;

		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject });

			this.port.postMessage({
				id,
				method,
				args
			});
		});
	}

	loadModel(file) {
		return this.call("loadModel", { file });
	}

	generate(prompt, maxTokens = 512) {
		return this.call("generate", { prompt, maxTokens });
	}

	unloadModel() {
		return this.call("unloadModel");
	}

	close() {
		this.port.close();

		for (const pending of this.pending.values()) {
			pending.reject(new Error("AIOne connection closed"));
		}

		this.pending.clear();
	}
}