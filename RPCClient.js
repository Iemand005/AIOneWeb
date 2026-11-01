export default class RPCClient {
	constructor(options = {}) {
		this.workerUrl = options.workerUrl ??
			new URL("./shared-worker.js", import.meta.url);

		this.pending = new Map();
		this.nextId = 0;
	}

	connect() {
		return new Promise((resolve, reject) => {
			this.worker = new SharedWorker(this.workerUrl, {
				type: "module",
				name: "AIOne"
			});

			this.port = this.worker.port;

			this.port.onmessage = ({ data }) => {
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
				reject(new Error("AIOne worker message error"));
			};

			this.port.start();

			this.call("hello").then(resolve, reject);
		});
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
}