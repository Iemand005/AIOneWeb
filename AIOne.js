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

		const workerType = options.threads ? "dedicated" : (options.workerType ?? "shared");

		workerUrl.searchParams.set("workerType", workerType);

		const worker = workerType === "shared"
			? new SharedWorker(workerUrl, {
				name: options.name ?? "AIOne",
				type: "classic"
			})
			: new Worker(workerUrl, {
				name: options.name ?? "AIOne",
				type: "classic"
			});

		worker.onerror = event => {
			console.error("AIOne worker error:", event);
		};

		const client = new AIOne(
			workerType === "shared" ? worker.port : worker
		);

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

			if (data.token !== undefined) {
				pending.onToken?.(data.token, data.thinking ?? false);

				if (data.thinking) {
					pending.onThinkingToken?.(data.token);
				}

				return;
			}

			if (data.thinkingChange !== undefined) {
				pending.onThinkingChange?.(data.thinkingChange);
				return;
			}

			if (data.promptProgress !== undefined) {
				pending.onPromptProgress?.(data.promptProgress);
				return;
			}

			if (data.generationStart !== undefined) {
				pending.onGenerationStart?.();
				return;
			}

			if (data.progress !== undefined) {
				pending.onProgress?.(data.progress);
				return;
			}

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

		this.port.start?.();
	}

	ready() {
		return this.readyPromise;
	}

	call(method, args = {}, callbacks = null) {
		const id = ++this.nextId;

		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject, ...callbacks });

			this.port.postMessage({
				id,
				method,
				args
			});
		});
	}

	loadModel(file, onProgress = null) {
		return this.call(
			"loadModel",
			{ file, progress: Boolean(onProgress) },
			{ onProgress }
		);
	}

	generate(prompt, maxTokens = 512, callbacks = null) {
		if (typeof callbacks === "function") {
			callbacks = { onToken: callbacks };
		}

		return this.call(
			"generate",
			{
				prompt,
				maxTokens,
				stream: Boolean(callbacks?.onToken || callbacks?.onThinkingToken),
				thinkingState: Boolean(callbacks?.onThinkingChange),
				promptProgress: Boolean(callbacks?.onPromptProgress),
				generationStart: Boolean(callbacks?.onGenerationStart)
			},
			callbacks
		);
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